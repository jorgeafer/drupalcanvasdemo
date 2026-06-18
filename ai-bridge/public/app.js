// DrupalCanvas AI – chat frontend
const socket = io();

const messagesEl   = document.getElementById('messages');
const inputEl      = document.getElementById('user-input');
const sendBtn      = document.getElementById('send-btn');
const statusDot    = document.getElementById('status-dot');
const statusText   = document.getElementById('status-text');
const toolIndicator= document.getElementById('tool-indicator');
const toolText     = document.getElementById('tool-text');
const previewPane  = document.getElementById('preview-panel');
const previewIframe= document.getElementById('preview-iframe');
const previewPH    = document.getElementById('preview-placeholder');
const previewLink  = document.getElementById('preview-link');
const resetBtn     = document.getElementById('reset-btn');

let isWaiting = false;
let currentBubble = null;  // the bubble being streamed into

// ── Helpers ──────────────────────────────────────────────────────────────

function setStatus(state, text) {
  statusDot.className = 'status-dot ' + state;
  statusText.textContent = text;
}

function scrollToBottom() {
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function setWaiting(on) {
  isWaiting = on;
  sendBtn.disabled = on || !inputEl.value.trim();
  inputEl.disabled = on;
}

function appendMessage(role, html) {
  const msg = document.createElement('div');
  msg.className = `message ${role}`;

  const avatar = document.createElement('div');
  avatar.className = 'message-avatar';
  avatar.textContent = role === 'user' ? 'You' : 'AI';

  const bubble = document.createElement('div');
  bubble.className = 'message-bubble';
  bubble.innerHTML = html;

  msg.appendChild(avatar);
  msg.appendChild(bubble);
  messagesEl.appendChild(msg);
  scrollToBottom();
  return bubble;
}

function openAssistantBubble() {
  const msg = document.createElement('div');
  msg.className = 'message assistant';

  const avatar = document.createElement('div');
  avatar.className = 'message-avatar';
  avatar.textContent = 'AI';

  const bubble = document.createElement('div');
  bubble.className = 'message-bubble streaming';
  bubble.innerHTML = '';

  msg.appendChild(avatar);
  msg.appendChild(bubble);
  messagesEl.appendChild(msg);
  currentBubble = bubble;
  scrollToBottom();
  return bubble;
}

function appendTextToBubble(text) {
  if (!currentBubble) openAssistantBubble();
  // Convert newlines to <br> on the fly
  currentBubble.innerHTML += text.replace(/\n/g, '<br>');
  scrollToBottom();
}

function closeAssistantBubble() {
  if (currentBubble) {
    currentBubble.classList.remove('streaming');
    currentBubble = null;
  }
}

function addPageCreatedCard(url) {
  if (!currentBubble) return;
  const card = document.createElement('div');
  card.className = 'page-created-card';
  card.innerHTML = `
    <div class="page-title">✅ Page created in Drupal!</div>
    <a href="${url}" target="_blank">View page → ${url}</a>
  `;
  currentBubble.appendChild(card);
  scrollToBottom();
}

// ── Send message ─────────────────────────────────────────────────────────

function sendMessage() {
  const text = inputEl.value.trim();
  if (!text || isWaiting) return;

  appendMessage('user', `<p>${escapeHtml(text)}</p>`);
  inputEl.value = '';
  inputEl.style.height = 'auto';
  sendBtn.disabled = true;

  setWaiting(true);
  openAssistantBubble();
  socket.emit('chat:message', { text });
}

function escapeHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');
}

// ── Socket events ─────────────────────────────────────────────────────────

socket.on('connect', () => {
  setStatus('connected', 'Connected to AI Bridge');
  sendBtn.disabled = false;
});

socket.on('disconnect', () => {
  setStatus('error', 'Disconnected – refresh to reconnect');
  setWaiting(false);
});

socket.on('connect_error', () => {
  setStatus('error', 'Connection error');
});

socket.on('chat:thinking', () => {
  setStatus('thinking', 'AI is thinking...');
});

socket.on('chat:chunk', ({ text }) => {
  appendTextToBubble(text);
});

socket.on('chat:tool_start', ({ message }) => {
  closeAssistantBubble();
  toolText.textContent = message || 'Working...';
  toolIndicator.classList.remove('hidden');
  setStatus('thinking', 'Creating page in Drupal...');
  openAssistantBubble();
});

socket.on('chat:page_created', ({ url }) => {
  toolIndicator.classList.add('hidden');
  addPageCreatedCard(url);
  // Show preview
  previewIframe.src = url;
  previewIframe.classList.remove('hidden');
  previewPH.classList.add('hidden');
  previewLink.href = url;
  previewLink.classList.remove('hidden');
});

socket.on('chat:complete', () => {
  closeAssistantBubble();
  toolIndicator.classList.add('hidden');
  setWaiting(false);
  setStatus('connected', 'Ready');
});

socket.on('chat:error', ({ message }) => {
  closeAssistantBubble();
  toolIndicator.classList.add('hidden');
  appendMessage('assistant', `<p style="color:#ef4444">⚠️ ${escapeHtml(message)}</p>`);
  setWaiting(false);
  setStatus('error', 'Error occurred');
});

socket.on('chat:reset_done', () => {
  messagesEl.innerHTML = '';
  previewIframe.src = '';
  previewIframe.classList.add('hidden');
  previewPH.classList.remove('hidden');
  previewLink.classList.add('hidden');
  appendMessage('assistant', '<p>Conversation reset. What page would you like to build?</p>');
  setWaiting(false);
  setStatus('connected', 'Ready');
});

// ── UI event listeners ────────────────────────────────────────────────────

sendBtn.addEventListener('click', sendMessage);

inputEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

inputEl.addEventListener('input', () => {
  // Auto-grow textarea
  inputEl.style.height = 'auto';
  inputEl.style.height = Math.min(inputEl.scrollHeight, 140) + 'px';
  sendBtn.disabled = isWaiting || !inputEl.value.trim();
});

resetBtn.addEventListener('click', () => {
  socket.emit('chat:reset');
});

// Example prompts in sidebar
document.querySelectorAll('.example-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    if (isWaiting) return;
    inputEl.value = btn.dataset.text;
    inputEl.dispatchEvent(new Event('input'));
    inputEl.focus();
  });
});
