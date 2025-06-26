from flask import Flask, request, jsonify, send_file, send_from_directory
from flask_cors import CORS
from response import generate_response, chat_response, process_file, web_search, generate_rag_answer_from_site
import traceback

app = Flask(__name__)
CORS(app)

@app.route('/favicon.ico')
def favicon():
    return '', 204  

# Obtaining response.html
@app.route('/')
def serve_index():
    return send_file('response.html')

# Obtaining assets
@app.route('/assets/<path:filename>')
def serve_assets(filename):
    return send_from_directory('assets', filename)

# Combined Endpoint
@app.route('/llm', methods=['POST'])
def llm_router():
    try:
        content_type = request.content_type or ""

        if 'multipart/form-data' in content_type:
            action = request.form.get('action')
            if action == 'file_processing':
                return file_processing()
        else:
            data = request.get_json()
            action = data.get('action')

            if action == 'generate':
                return generate(data)
            elif action == 'chat':
                return chat(data)
            elif action == 'search':
                return search(data)
            elif action == 'scrape_site':
                return scrape_site_route(data)

        return jsonify({'error': 'Invalid action or unsupported content type'}), 400  

    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500
    
# Function for single prompting
def generate(data):
    prompt = data.get('prompt')
    if not prompt:
        return jsonify({'error': 'No prompt provided'}), 400

    try:
        response_text = generate_response(prompt)
        return jsonify({'response': response_text})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Function for multiple prompting
def chat(data):
    prompt = data.get('prompt')
    history = data.get('history', [])

    if not prompt:
        return jsonify({'error': 'No prompt provided'}), 400

    try:
        reply = chat_response(prompt, history)
        return jsonify({'response': reply})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Function for File Processing
def file_processing():
    file = request.files.get('file')
    prompt = request.form.get('prompt', 'Describe this file.')

    if not file:
        return jsonify({'error': 'No file uploaded'}), 400

    try:
        response_text = process_file(file, prompt)
        return jsonify({'response': response_text})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Function for Web Search
def search(data):
    query = data.get('query')

    if not query:
        return jsonify({'error': 'No search query provided'}), 400

    try:
        result = web_search(query)
        return jsonify({'response': result})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Function for Web Scraping
def scrape_site_route(data):
    url = data.get('url')
    question = data.get('question')
    max_pages = int(data.get('max_pages', 5))

    if not url or not question:
        return jsonify({'error': 'Missing URL or question'}), 400

    try:
        answer = generate_rag_answer_from_site(url, question, max_pages)
        return jsonify({'response': answer})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    app.run(debug=True, use_reloader=False)