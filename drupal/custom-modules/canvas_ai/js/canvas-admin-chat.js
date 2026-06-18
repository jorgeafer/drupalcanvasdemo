/**
 * @file
 * Canvas AI admin chat – embeds the AI page-builder chat inside Drupal admin.
 * Communicates with the Node.js bridge via Socket.io.
 */
(function (Drupal, drupalSettings, once) {
  'use strict';

  Drupal.behaviors.canvasAiAdmin = {
    attach: function (context, settings) {
      // Run only once per page load.
      const [app] = once('canvas-ai-admin', '#canvas-ai-app', context);
      if (!app) return;

      const bridgeUrl = settings.canvasAi.bridgeUrl;

      // ── Socket connection ───────────────────────────────────────────────
      const socket = io(bridgeUrl, { transports: ['websocket', 'polling'] });

      // ── DOM refs ────────────────────────────────────────────────────────
      const messagesEl    = document.getElementById('cai-messages');
      const inputEl       = document.getElementById('cai-input');
      const sendBtn       = document.getElementById('cai-send');
      const statusDot     = document.getElementById('cai-status-dot');
      const statusText    = document.getElementById('cai-status-text');
      const resetBtn      = document.getElementById('cai-reset');
      const toolBanner    = document.getElementById('cai-tool-banner');

      let isWaiting = false;
      let streamBubble = null;

      // ── Helpers ─────────────────────────────────────────────────────────
      function setStatus(state, text) {
        statusDot.className = 'cai-dot cai-dot--' + state;
        statusText.textContent = text;
      }

      function setWaiting(on) {
        isWaiting = on;
        sendBtn.disabled = on || !inputEl.value.trim();
        inputEl.disabled = on;
      }

      function scrollBottom() {
        messagesEl.scrollTop = messagesEl.scrollHeight;
      }

      function escHtml(s) {
        return s
          .replace(/&/g, '&amp;').replace(/</g, '&lt;')
          .replace(/>/g, '&gt;').replace(/\n/g, '<br>');
      }

      function appendMessage(role, html) {
        const row = document.createElement('div');
        row.className = 'cai-msg cai-msg--' + role;

        const av = document.createElement('div');
        av.className = 'cai-avatar';
        av.textContent = role === 'user' ? 'You' : 'AI';

        const bubble = document.createElement('div');
        bubble.className = 'cai-bubble';
        bubble.innerHTML = html;

        row.appendChild(av);
        row.appendChild(bubble);
        messagesEl.appendChild(row);
        scrollBottom();
        return bubble;
      }

      function openStreamBubble() {
        const row = document.createElement('div');
        row.className = 'cai-msg cai-msg--assistant';

        const av = document.createElement('div');
        av.className = 'cai-avatar';
        av.textContent = 'AI';

        const bubble = document.createElement('div');
        bubble.className = 'cai-bubble cai-bubble--streaming';

        row.appendChild(av);
        row.appendChild(bubble);
        messagesEl.appendChild(row);
        streamBubble = bubble;
        scrollBottom();
      }

      function appendChunk(text) {
        if (!streamBubble) openStreamBubble();
        streamBubble.innerHTML += text.replace(/\n/g, '<br>');
        scrollBottom();
      }

      function closeStreamBubble() {
        if (streamBubble) {
          streamBubble.classList.remove('cai-bubble--streaming');
          streamBubble = null;
        }
      }

      function addPageCard(url, nodeId) {
        if (!streamBubble) return;
        const editUrl = '/node/' + nodeId + '/edit';
        const card = document.createElement('div');
        card.className = 'cai-page-card';
        card.innerHTML =
          '<strong>✅ Page created!</strong><br>' +
          '<a href="' + url + '" target="_blank">View page ↗</a> &nbsp;|&nbsp; ' +
          '<a href="' + editUrl + '">Edit in Drupal ✏️</a>';
        streamBubble.appendChild(card);
        scrollBottom();
      }

      // ── Send ─────────────────────────────────────────────────────────────
      function sendMessage() {
        const text = inputEl.value.trim();
        if (!text || isWaiting) return;

        appendMessage('user', '<p>' + escHtml(text) + '</p>');
        inputEl.value = '';
        inputEl.style.height = 'auto';
        sendBtn.disabled = true;
        setWaiting(true);
        openStreamBubble();
        socket.emit('chat:message', { text });
      }

      // ── Socket events ─────────────────────────────────────────────────────
      socket.on('connect', () => {
        setStatus('connected', 'Connected');
        sendBtn.disabled = false;
      });

      socket.on('disconnect', () => {
        setStatus('error', 'Disconnected – refresh to reconnect');
        setWaiting(false);
      });

      socket.on('chat:thinking', () =>
        setStatus('thinking', 'AI is thinking…')
      );

      socket.on('chat:chunk', ({ text }) => appendChunk(text));

      socket.on('chat:tool_start', ({ message }) => {
        closeStreamBubble();
        toolBanner.textContent = message || '🔧 Creating page in Drupal…';
        toolBanner.hidden = false;
        setStatus('thinking', 'Building page…');
        openStreamBubble();
      });

      socket.on('chat:page_created', ({ url, nodeId }) => {
        toolBanner.hidden = true;
        addPageCard(url, nodeId);
      });

      socket.on('chat:complete', () => {
        closeStreamBubble();
        toolBanner.hidden = true;
        setWaiting(false);
        setStatus('connected', 'Ready');
      });

      socket.on('chat:error', ({ message }) => {
        closeStreamBubble();
        toolBanner.hidden = true;
        appendMessage('assistant', '<p style="color:#d32f2f">⚠️ ' + escHtml(message) + '</p>');
        setWaiting(false);
        setStatus('error', 'Error occurred');
      });

      socket.on('chat:reset_done', () => {
        messagesEl.innerHTML = '';
        appendMessage('assistant', '<p>Conversation reset. What page would you like to build?</p>');
        setWaiting(false);
        setStatus('connected', 'Ready');
      });

      // ── UI listeners ──────────────────────────────────────────────────────
      sendBtn.addEventListener('click', sendMessage);

      inputEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          sendMessage();
        }
      });

      inputEl.addEventListener('input', () => {
        inputEl.style.height = 'auto';
        inputEl.style.height = Math.min(inputEl.scrollHeight, 130) + 'px';
        sendBtn.disabled = isWaiting || !inputEl.value.trim();
      });

      resetBtn.addEventListener('click', () => socket.emit('chat:reset'));

      document.querySelectorAll('.cai-example').forEach((btn) => {
        btn.addEventListener('click', () => {
          if (isWaiting) return;
          inputEl.value = btn.dataset.text;
          inputEl.dispatchEvent(new Event('input'));
          inputEl.focus();
        });
      });
    },
  };
}(Drupal, drupalSettings, once));
