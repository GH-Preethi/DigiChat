import os
from dotenv import load_dotenv
import google.generativeai as genai
from google.generativeai.types import content_types
from PyPDF2 import PdfReader
import docx
import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse
from rag_text import index_scraped_content, query_context

# Load environment variables
load_dotenv()
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

# Configure Models
model_text = genai.GenerativeModel("models/gemini-2.0-flash")
model_vision = genai.GenerativeModel("gemini-pro-vision")
chat_model = genai.GenerativeModel("gemini-2.0-flash").start_chat()

# Generate text response
def generate_response(prompt):
    response = model_text.generate_content(prompt)
    return response.text

# Generate chat reply
def chat_response(prompt, history=None):
    response = chat_model.send_message(prompt)
    return response.text

# File Handling
def process_file(file_storages, prompt):
    responses = []

    for file_storage in file_storages:
        filename = file_storage.filename.lower()

        try:
            # Handler for Images
            if filename.endswith(('.jpeg', '.jpg', '.png')):
                image_bytes = file_storage.read()
                image_part = content_types.Part.from_bytes(data=image_bytes, mime_type="image/jpeg")
                response = model_vision.generate_content([prompt, image_part])
                responses.append(f"🖼️ {filename}:\n{response.text}")

            # Handler for PDFs
            elif filename.endswith('.pdf'):
                reader = PdfReader(file_storage)
                text = "".join([page.extract_text() or "" for page in reader.pages])
                full_prompt = f"{prompt}\n\n{text}"
                response_text = generate_response(full_prompt)
                responses.append(f"📄 {filename}:\n{response_text}")

            # Handler for DOCX
            elif filename.endswith('.docx'):
                doc = docx.Document(file_storage)
                text = "\n".join([para.text for para in doc.paragraphs])
                full_prompt = f"{prompt}\n\n{text}"
                response_text = generate_response(full_prompt)
                responses.append(f"📝 {filename}:\n{response_text}")

            else:
                responses.append(f"⚠️ {filename}: Unsupported file type.")

        except Exception as e:
            responses.append(f"{filename}: Error processing file - {str(e)}")

    return "\n\n".join(responses)

# Web Search Functionality
def web_search(query):
    api_key = os.getenv("SERPAPI_KEY")

    url = "https://serpapi.com/search"
    params = {
        "q": query,
        "api_key": api_key,
        "engine": "google",
        "num": 3  # Top 3 results
    }

    res = requests.get(url, params=params)
    if res.status_code != 200:
        raise Exception(f"SerpAPI error: {res.status_code} {res.text}")

    data = res.json()
    results = data.get("organic_results", [])
    if not results:
        return "No results found."

    # Format search results
    lines = []
    for result in results:
        title = result.get("title", "")
        link = result.get("link", "")
        snippet = result.get("snippet", "")
        lines.append(f"🔹 {title}\n{snippet}\n🔗 {link}\n")

    return "\n".join(lines)

# Website Scraping 
def scrape_site(base_url, max_pages=10):
    visited = set()
    to_visit = [base_url]
    contents = []

    while to_visit and len(visited) < max_pages:
        url = to_visit.pop()
        if url in visited:
            continue

        try:
            res = requests.get(url, timeout=10)
            soup = BeautifulSoup(res.text, 'html.parser')
            paragraphs = soup.find_all('p')
            page_text = '\n'.join(p.get_text() for p in paragraphs if p.get_text().strip())
            contents.append(page_text)
            visited.add(url)

            for a in soup.find_all('a', href=True):
                link = urljoin(url, a['href'])
                if urlparse(link).netloc == urlparse(base_url).netloc and link not in visited:
                    to_visit.append(link)

        except Exception as e:
            print(f"Error fetching {url}: {e}")

    return "\n".join(contents)

# RAG Answer
def generate_rag_answer_from_site(url, question, max_pages=10):
    scraped_text = scrape_site(url, max_pages)
    index_scraped_content(url, scraped_text)  # Index into Chroma

    context_chunks = query_context(question)
    context = "\n".join(context_chunks)

    prompt = f"Use the following context from {url} to answer:\n\n{context}\n\nQ: {question}"
    return generate_response(prompt)