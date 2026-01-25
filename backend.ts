# backend.py using FastAPI
from fastapi import FastAPI, Request
from rag_app import chat_with_docs, index_files

app = FastAPI()

@app.post("/chat")
async def chat_endpoint(request: Request):
    data = await request.json()
    user_query = data.get("query")

    # Get store from frontend (default to 'all' if not provided)
    selected_store = data.get("store_name", "all")

    answer = chat_with_docs(user_query, store_name=selected_store)
    return {"answer": answer}

@app.post("/upload")
async def upload_endpoint(request: Request):
    # ... file handling logic ...

    # When user uploads manually, save to "uploads" store
    index_files([saved_file_path], store_name="uploads")
    return {"status": "ok"}