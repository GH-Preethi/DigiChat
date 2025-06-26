import chromadb
from chromadb.utils import embedding_functions
from sentence_transformers import SentenceTransformer
import uuid

# Initialize Chroma
client = chromadb.Client()
collection = client.get_or_create_collection("web_rag")

# Embed Moddel
model = SentenceTransformer("all-MiniLM-L6-v2")

# Split Text into Chunks
def chunk_text(text, chunk_size=500):
    words = text.split()
    return [' '.join(words[i:i+chunk_size]) for i in range(0, len(words), chunk_size)]

# Add Scraped Content to Chroma
def index_scraped_content(url, text):
    chunks = chunk_text(text)
    embeddings = model.encode(chunks).tolist()

    ids = [f"{url}-{uuid.uuid4()}" for _ in chunks]
    collection.add(documents=chunks, embeddings=embeddings, ids=ids, metadatas=[{"url": url} for _ in chunks])

# Query Chroma for Relevant Chunks
def query_context(question, top_k=3):
    query_embedding = model.encode([question]).tolist()[0]
    results = collection.query(query_embeddings=[query_embedding], n_results=top_k)
    return results['documents'][0]
