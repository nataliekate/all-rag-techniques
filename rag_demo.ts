import os
import json
import numpy as np
import pandas as pd
import tiktoken
from openai import OpenAI
from pypdf import PdfReader
from docx import Document

# --- CONFIGURATION ---
# Export your key: export OPENAI_API_KEY="sk-..."
client = OpenAI(api_key="YOUR_OPENAI_API_KEY")

EMBEDDING_MODEL = "text-embedding-3-small"
CHAT_MODEL = "gpt-4o-mini"
CHUNK_SIZE = 800
CHUNK_OVERLAP = 100

# Directory to save different vector stores (e.g. uploads.json, confluence.json)
STORE_DIR = "vector_stores"
os.makedirs(STORE_DIR, exist_ok=True)

# ==========================================
# PART 1: FILE LOADING & TEXT EXTRACTION
# ==========================================

def extract_text_from_pdf(file_path):
    reader = PdfReader(file_path)
    text = ""
    for page in reader.pages:
        content = page.extract_text()
        if content:
            text += content + "\n"
    return text

def extract_text_from_docx(file_path):
    doc = Document(file_path)
    return "\n".join([para.text for para in doc.paragraphs if para.text])

def extract_text_from_excel(file_path):
    df = pd.read_excel(file_path)
    df = df.fillna("")
    text_rows = []
    for _, row in df.iterrows():
        # Format: "Column: Value | Column: Value"
        row_text = " | ".join([f"{col}: {val}" for col, val in row.items()])
        text_rows.append(row_text)
    return "\n".join(text_rows)

def extract_text_from_doc_legacy(file_path):
    """
    Reads legacy .doc files using the local Word application (Windows Only).
    """
    if os.name != 'nt':
        print(f"⚠️ Legacy .doc support is Windows-only. Skipping {file_path}")
        return ""

    import win32com.client as win32

    abs_path = os.path.abspath(file_path)
    if not os.path.exists(abs_path):
        return ""

    word = None
    doc = None
    text = ""

    try:
        word = win32.Dispatch("Word.Application")
        word.Visible = False
        word.DisplayAlerts = 0
        doc = word.Documents.Open(abs_path)
        text = doc.Range().Text
        text = text.replace('\r', '\n').replace('\x07', '') # Clean weird chars
    except Exception as e:
        print(f"⚠️ Error reading .doc file: {e}")
    finally:
        if doc: doc.Close(SaveChanges=False)
        if word: word.Quit()

    return text

def load_file_content(file_path):
    """Detects file type and returns raw text."""
    if not os.path.exists(file_path):
        print(f"❌ File not found: {file_path}")
        return None

    ext = os.path.splitext(file_path)[1].lower()

    try:
        if ext == ".pdf":
            return extract_text_from_pdf(file_path)
        elif ext == ".docx":
            return extract_text_from_docx(file_path)
        elif ext == ".doc":
            return extract_text_from_doc_legacy(file_path)
        elif ext in [".xlsx", ".xls"]:
            return extract_text_from_excel(file_path)
        else:
            print(f"⚠️ Unsupported file type: {ext}")
            return None
    except Exception as e:
        print(f"⚠️ Error reading {file_path}: {e}")
        return None

# ==========================================
# PART 2: TOKEN-SAFE CHUNKING
# ==========================================

def chunk_text(text, model=EMBEDDING_MODEL, max_tokens=CHUNK_SIZE, overlap=CHUNK_OVERLAP):
    """
    Splits text into chunks that strictly obey token limits.
    """
    if not text:
        return []

    encoding = tiktoken.encoding_for_model(model)
    tokens = encoding.encode(text)

    chunks = []
    step_size = max_tokens - overlap

    for i in range(0, len(tokens), step_size):
        chunk_tokens = tokens[i : i + max_tokens]
        chunk_text = encoding.decode(chunk_tokens)
        chunks.append(chunk_text)

    return chunks

# ==========================================
# PART 3: EMBEDDING & INDEXING
# ==========================================

def get_embedding(text):
    text = text.replace("\n", " ")
    response = client.embeddings.create(input=[text], model=EMBEDDING_MODEL)
    return response.data[0].embedding

def get_store_path(store_name):
    """Generates a safe filename like 'vector_stores/confluence.json'"""
    clean_name = "".join(c for c in store_name if c.isalnum() or c in ('-','_'))
    return os.path.join(STORE_DIR, f"{clean_name}.json")

def index_files(file_list, store_name="uploads"):
    """
    Indexes files into a SPECIFIC vector store (e.g. 'confluence' or 'uploads').
    """
    store_path = get_store_path(store_name)
    vector_store = []

    # Load existing data for THIS specific store
    if os.path.exists(store_path):
        try:
            with open(store_path, "r") as f:
                vector_store = json.load(f)
        except:
            vector_store = [] # Start fresh if corrupt

    print(f"🔄 Indexing {len(file_list)} files into store: '{store_name}'...")

    for file_path in file_list:
        filename = os.path.basename(file_path)

        # UPDATE LOGIC: Remove old chunks for this specific file before adding new ones
        initial_count = len(vector_store)
        vector_store = [item for item in vector_store if item["source_file"] != filename]
        if len(vector_store) < initial_count:
            print(f"   Refreshed existing data for: {filename}")

        # Load and Chunk
        raw_text = load_file_content(file_path)
        if not raw_text:
            continue

        chunks = chunk_text(raw_text)
        print(f"   -> {filename}: {len(chunks)} chunks generated.")

        for i, chunk in enumerate(chunks):
            # Embed
            vector = get_embedding(chunk)

            # Add to store
            vector_store.append({
                "id": f"{filename}_{i}",
                "source_file": filename,
                "store_name": store_name,
                "text": chunk,
                "embedding": vector
            })

    # Save to the specific JSON file
    with open(store_path, "w") as f:
        json.dump(vector_store, f)

    print(f"✅ Indexing complete! Saved {len(vector_store)} total chunks to {store_path}")

# ==========================================
# PART 4: RETRIEVAL (SEARCH)
# ==========================================

def cosine_similarity(v1, v2):
    # Dot product is sufficient if vectors are normalized (OpenAI's are)
    return np.dot(v1, v2)

def retrieve_context(query, store_name="all", top_k=3):
    """
    Search ONLY the specific store requested.
    Pass store_name="all" to search all JSON files in the directory.
    """
    target_stores = []

    # 1. Determine which files to search
    if store_name == "all":
        # Load ALL json files in the directory
        for f in os.listdir(STORE_DIR):
            if f.endswith(".json"):
                target_stores.append(os.path.join(STORE_DIR, f))
    else:
        # Load specific store
        path = get_store_path(store_name)
        if os.path.exists(path):
            target_stores.append(path)

    if not target_stores:
        print(f"⚠️ No knowledge base found for '{store_name}'")
        return []

    query_vector = get_embedding(query)
    all_results = []

    # 2. Iterate through all relevant stores
    for store_path in target_stores:
        try:
            with open(store_path, "r") as f:
                data = json.load(f)

            for item in data:
                score = cosine_similarity(query_vector, item["embedding"])

                # Add metadata for debugging/UI
                item["_score"] = score
                item["_origin_store"] = os.path.basename(store_path)
                all_results.append(item)
        except Exception as e:
            print(f"⚠️ Error reading {store_path}: {e}")

    # 3. Sort by score descending & Slice
    all_results.sort(key=lambda x: x["_score"], reverse=True)
    return all_results[:top_k]

# ==========================================
# PART 5: GENERATION (RAG)
# ==========================================

def chat_with_docs(user_query, store_name="all"):
    print(f"\n❓ Question: {user_query} (Scope: {store_name})")

    # 1. Retrieve
    relevant_chunks = retrieve_context(user_query, store_name=store_name)

    if not relevant_chunks:
        return "I couldn't find any relevant information in your documents."

    # 2. Construct Context
    # We include the Source File name in the text so the LLM knows where info comes from
    context_text = "\n\n---\n\n".join(
        [f"Source: {chunk['source_file']}\nContent: {chunk['text']}" for chunk in relevant_chunks]
    )

    # 3. Prompt the LLM
    system_prompt = """You are a helpful knowledge assistant.
    Answer the user's question using ONLY the context provided below.
    If the answer is not in the context, say you don't know."""

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": f"Context:\n{context_text}\n\nQuestion:\n{user_query}"}
    ]

    response = client.chat.completions.create(
        model=CHAT_MODEL,
        messages=messages,
        temperature=0.3 # Keep it factual
    )

    answer = response.choices[0].message.content
    print(f"🤖 Answer Generated")
    return answer

# ==========================================
# MAIN EXECUTION (TESTING)
# ==========================================

if __name__ == "__main__":
    # Example Usage
    test_files = ["./project_specs.pdf"]

    # Index into 'uploads'
    # index_files(test_files, store_name="uploads")

    # Chat across everything
    # response = chat_with_docs("What is the project deadline?", store_name="all")
    # print(f"\nResponse:\n{response}")
    pass