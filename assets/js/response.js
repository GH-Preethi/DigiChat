const chatBox = document.getElementById('chat-box');
const userInput = document.getElementById('user-input');
const fileInput = document.getElementById('file-input');
const sendBtn = document.querySelector('button[onclick="sendMessage()"]');
const filePreviewBox = document.getElementById('file-preview');

let chatHistory = [];
let selectedFiles = [];

// Enable or Disable Send Button
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

// Chat Response Handling
async function sendMessage() {
  const text = userInput.value.trim();
  const files = Array.from(fileInput.files);

  // Call sendFile() on File Upload
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
    let data;
    const urlRegex = /(https?:\/\/[^\s]+)/i;
    const hasUrl = urlRegex.test(text);
    const isQuestion = /[?]/.test(text);
    const isLikelySearch = /(news|latest|trending|who|what|how|when|why|top)/i.test(text);

    // Web Scraping
    if (hasUrl && isQuestion) {
      const urlMatch = text.match(urlRegex);
      const question = text.replace(urlRegex, '').trim();
      const url = urlMatch[0];

      data = await postCall('/llm', JSON.stringify({
        action: 'scrape_site',
        url,
        question,
        max_pages: 5
      }));
    }

    // Search 
    else if (isLikelySearch && !hasUrl && text.length < 100) {
      data = await postCall('/llm', JSON.stringify({
        action: 'search',
        query: text
      }));
    } 
    
    // Normal Query
    else {
      data = await postCall('/llm', JSON.stringify({
        action: 'chat',
        prompt: text,
        history: chatHistory
      }));
    }

    chatHistory[chatHistory.length - 1].content = data?.response || `Error: ${data?.error || 'No response'}`;
  } catch (err) {
    chatHistory[chatHistory.length - 1].content = "Request failed: " + err.message;
  }

  renderChat();
  userInput.value = '';
}

// Handle File Uploads
async function sendFile(promptText) {
  const files = Array.from(fileInput.files);
  const prompt = promptText?.trim() || userInput.value.trim() || "Describe this file.";

  if (files.length === 0) return alert("Please select at least one file.");

  const fileList = files.map(f => `${f.name}`).join(", ");
  chatHistory.push({ role: 'user', content: `${prompt} (${fileList})` });
  chatHistory.push({ role: 'assistant', content: 'Processing file...' });
  renderChat();

  const formData = new FormData();
  formData.append('prompt', prompt);
  formData.append('action', 'file_processing');
  files.forEach(file => formData.append('file', file));

  try {
    const res = await fetch('/llm', {
      method: 'POST',
      body: formData
    });

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
  document.getElementById('file-preview').innerHTML = '';
  userInput.value = '';
}

// Preview File Uploads
function renderFilePreview() {
  selectedFiles = Array.from(fileInput.files);
  const box = document.getElementById('file-preview');
  box.innerHTML = '';

  selectedFiles.forEach((file, i) => {
    const chip = document.createElement('div');
    chip.className = 'file-chip';
    chip.innerHTML = `
      ${file.name}
      <button onclick="removeFile(${i})" class="remove-btn">
        <i class="fa-solid fa-trash"></i>
      </button>
    `;
    box.appendChild(chip);
  });
}

// Function to Remove File
function removeFile(index) {
  selectedFiles.splice(index, 1);
  const dt = new DataTransfer();
  selectedFiles.forEach(file => dt.items.add(file));
  fileInput.files = dt.files;
  renderFilePreview();
}

// Clear Chat
function clearChat() {
  chatHistory = [];
  chatBox.innerHTML = '';
}

async function postCall(endPoint, data) {
  var myHeaders = new Headers();
  myHeaders.append("Accept", "application/json");
  myHeaders.append("Content-Type", "application/json");

  try {
    const response = await fetch(baseUrl + endPoint, {
      method: "POST",
      headers: myHeaders,
      body: data,
    });
    const responseData = await response.json();
    if (response.status == 200) {
      return responseData;
    } else if (response.status == 401) {
      throw new Error(responseData.result.message ?? "Not Authenticated");
    } else if (response.status == 409) {
      return responseData;
    } else {
      throw new Error(responseData.message ?? "Unknown error occurred");
    }
  } catch (error) {
    alert(error);
    return null;
  }
}

// Handle Keypress
userInput.addEventListener("keypress", function (e) {
  if (e.key === "Enter") {
    e.preventDefault();
    sendMessage();
  }
});

// Show Preview of File on Change
fileInput.addEventListener("change", () => {
  renderFilePreview();
});

// Enable Reselection of Same File
document.getElementById('file-input').addEventListener('click', function () {
  this.value = ''; 
});

