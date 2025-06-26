const chatBox = document.getElementById('chat-box');
const userInput = document.getElementById('user-input');
const fileInput = document.getElementById('file-input');
const sendBtn = document.querySelector('button[onclick="sendMessage()"]');
const filePreviewBox = document.getElementById('file-preview');

let chatHistory = [];
let selectedFiles = [];

// Enable/Disable Send Button
userInput.addEventListener('input', () => {
  sendBtn.disabled = userInput.value.trim() === '';
});

// Render Chat 
function renderChat() {
  chatBox.innerHTML = '';
  chatHistory.forEach(msg => {
    const div = document.createElement('div');
    div.className = 'message ' + (msg.role === 'user' ? 'user' : 'assistant');
    div.textContent = msg.content;
    chatBox.appendChild(div);
  });
  chatBox.scrollTop = chatBox.scrollHeight;
}

// Send Message
async function sendMessage() {
  const text = userInput.value.trim();
  const files = Array.from(fileInput.files);

  if (files.length > 0) {
    await sendFile(text);
    return;
  }

  if (!text) return;
  chatHistory.push({ role: 'user', content: text });
  chatHistory.push({ role: 'assistant', content: 'Loading...' });
  renderChat();
  userInput.value = '';

  try {
    const urlRegex = /\bhttps?:\/\/[^\s]+\.[^\s]+/i;
    const hasUrl = urlRegex.test(text);
    const wantsToScrape = hasUrl && /[?]/.test(text);
    const wantsToSearch = /\bsearch\b|\bgoogle\b|\bnews\b|\blatest\b/i.test(text) && !hasUrl;

    let data;

    // Web Scraping
    if (wantsToScrape) {
    const urlMatch = text.match(urlRegex);
    const url = urlMatch[0];
    const question = text.replace(urlRegex, '').trim();
    data = await postCall('/llm', JSON.stringify({
        action: 'scrape_site',
        url,
        question,
        max_pages: 5
      }));
    } 
    // Searching
    else if (wantsToSearch) {
      data = await postCall('/llm', JSON.stringify({ action: 'search', query: text }));
    } 
    // Normal Chat
    else {
      data = await postCall('/llm', JSON.stringify({
        action: chatHistory.length > 0 ? 'chat' : 'generate',
        prompt: text,
        history: chatHistory
      }));
    }

      chatHistory[chatHistory.length - 1].content = data?.response || `Error: ${data?.error || 'No response'}`;
    } catch (err) {
      chatHistory[chatHistory.length - 1].content = "Request failed: " + err.message;
    }

    renderChat();
}

// Send Files
async function sendFile(promptText) {
  const files = Array.from(fileInput.files);
  const prompt = promptText?.trim() || userInput.value.trim() || "Describe this file.";

  if (files.length === 0) return alert("Please select at least one file.");
  const fileList = files.map(f => f.name).join(", ");

  chatHistory.push({ role: 'user', content: `${prompt} (${fileList})` });
  chatHistory.push({ role: 'assistant', content: 'Processing file...' });
  renderChat();

  const formData = new FormData();
  formData.append('prompt', prompt);
  formData.append('action', 'file_processing');
  files.forEach(file => formData.append('file', file));

  try {
    const res = await fetch('/llm', { method: 'POST', body: formData });
    const contentType = res.headers.get("content-type") || "";
    if (!res.ok || !contentType.includes("application/json")) {
      const fallback = await res.text();
      throw new Error("Non-JSON response: " + fallback.slice(0, 100));
    }
    const data = await res.json();
    chatHistory[chatHistory.length - 1].content = data.response || `Error: ${data.error}`;
  } catch (err) {
    chatHistory[chatHistory.length - 1].content = "Request failed: " + err.message;
  }

  renderChat();
  fileInput.value = '';
  selectedFiles = [];
  filePreviewBox.innerHTML = '';
  userInput.value = '';
}

// Preview Files
function renderFilePreview() {
  selectedFiles = Array.from(fileInput.files);
  filePreviewBox.innerHTML = '';
  selectedFiles.forEach((file, i) => {
    const chip = document.createElement('div');
    chip.className = 'file-chip';
    chip.innerHTML = `
      ${file.name}
      <button onclick="removeFile(${i})" class="remove-btn">
        <i class="fa-solid fa-trash"></i>
      </button>
    `;
    filePreviewBox.appendChild(chip);
  });
}

// Remove File
function removeFile(index) {
  selectedFiles.splice(index, 1);
  const dt = new DataTransfer();
  selectedFiles.forEach(file => dt.items.add(file));
  fileInput.files = dt.files;
  renderFilePreview();
}

// File Preview, and File Resubmission
fileInput.addEventListener('click', () => { fileInput.value = ''; });
fileInput.addEventListener('change', renderFilePreview);

// Monitor Keypress
userInput.addEventListener("keypress", function (e) {
  if (e.key === "Enter") {
    e.preventDefault();
    sendMessage();
  }
});

// Clear Chat
function clearChat() {
  chatHistory = [];
  chatBox.innerHTML = '';
}

// POST Call Function
async function postCall(endPoint, data) {
  const headers = new Headers({
    "Accept": "application/json",
    "Content-Type": "application/json"
  });

  try {
    const response = await fetch(baseUrl + endPoint, {
      method: "POST",
      headers,
      body: data,
    });
    const responseData = await response.json();
    if (response.ok) return responseData;
    throw new Error(responseData?.message || "Unknown server error");
  } catch (error) {
    alert(error.message);
    return null;
  }
}
