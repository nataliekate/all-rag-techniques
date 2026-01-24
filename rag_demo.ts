import os
import json
import numpy as np
import pandas as pd
import tiktoken
from openai import OpenAI
from pypdf import PdfReader
from docx import Document

# --- CONFIGURATION ---
# ideally, set this in your environment variables: export OPENAI_API_KEY="sk-..."
client = OpenAI(api_key="YOUR_OPENAI_API_KEY")

VECTOR_STORE_FILE = "vector_store.json"
EMBEDDING_MODEL = "text-embedding-3-small"
CHAT_MODEL = "gpt-4o-mini" # Or "gpt-3.5-turbo"
CHUNK_SIZE = 800  # Well under the 8191 limit
CHUNK_OVERLAP = 100

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

    # Iterate through tokens with overlap
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

def index_files(file_list, store_file=VECTOR_STORE_FILE):
    """
    Reads files, chunks them, embeds them, and saves to JSON.
    """
    vector_store = []

    # Load existing store if it exists (optional, to append)
    if os.path.exists(store_file):
        try:
            with open(store_file, "r") as f:
                vector_store = json.load(f)
        except:
            pass # Start fresh if corrupt

    print(f"🔄 Starting indexing for {len(file_list)} files...")

    for file_path in file_list:
        raw_text = load_file_content(file_path)
        if not raw_text:
            continue

        chunks = chunk_text(raw_text)
        print(f"   -> {file_path}: {len(chunks)} chunks found.")

        for i, chunk in enumerate(chunks):
            # Embed
            vector = get_embedding(chunk)

            # Add to store
            vector_store.append({
                "id": f"{os.path.basename(file_path)}_{i}",
                "source": file_path,
                "text": chunk,
                "embedding": vector
            })

    # Save to JSON
    with open(store_file, "w") as f:
        json.dump(vector_store, f)

    print(f"✅ Indexing complete! Saved {len(vector_store)} chunks to {store_file}")

# ==========================================
# PART 4: RETRIEVAL (SEARCH)
# ==========================================

def cosine_similarity(v1, v2):
    return np.dot(v1, v2) / (np.linalg.norm(v1) * np.linalg.norm(v2))

def retrieve_context(query, store_file=VECTOR_STORE_FILE, top_k=3):
    """
    Finds the most relevant chunks for a query.
    """
    if not os.path.exists(store_file):
        print("⚠️ No index found. Please index files first.")
        return []

    with open(store_file, "r") as f:
        vector_store = json.load(f)

    query_vector = get_embedding(query)

    scored_results = []
    for item in vector_store:
        score = cosine_similarity(query_vector, item["embedding"])
        scored_results.append((score, item))

    # Sort by score descending
    scored_results.sort(key=lambda x: x[0], reverse=True)

    # Return just the text and metadata of top_k
    return [item for score, item in scored_results[:top_k]]

# ==========================================
# PART 5: GENERATION (RAG)
# ==========================================

def chat_with_docs(user_query):
    print(f"\n❓ Question: {user_query}")

    # 1. Retrieve
    relevant_chunks = retrieve_context(user_query)
    if not relevant_chunks:
        return "I couldn't find any relevant information in your documents."

    # 2. Construct Context
    context_text = "\n\n---\n\n".join([chunk["text"] for chunk in relevant_chunks])

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

    return response.choices[0].message.content

# ==========================================
# MAIN EXECUTION
# ==========================================

if __name__ == "__main__":
    # --- STEP 1: INDEXING (Run this once or when files change) ---
    # Put your actual file paths here
    my_files = [
        "project_specs.pdf",
        "budget_2024.xlsx",
        "meeting_notes.docx"
    ]

    # Only index if you haven't already (or force it)
    # index_files(my_files)

    # --- STEP 2: CHAT ---
    response = chat_with_docs("What is the budget for the marketing department?")
    print(f"\n🤖 Answer:\n{response}")