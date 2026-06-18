import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server as SocketIO } from 'socket.io';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { handleMessage, clearSession } from './gemini.js';
import { isDrupalReady } from './drupal-client.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT || '3000', 10);

const app = express();
const httpServer = createServer(app);
const io = new SocketIO(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

// Serve the chat UI
app.use(express.static(join(__dirname, '../public')));

// Health endpoint
app.get('/health', async (_req, res) => {
  const drupalOk = await isDrupalReady();
  res.json({
    status: 'ok',
    drupal: drupalOk ? 'connected' : 'unreachable',
    gemini: process.env.GEMINI_API_KEY ? 'configured' : 'missing key',
  });
});

io.on('connection', (socket) => {
  console.log(`[Bridge] Client connected: ${socket.id}`);

  socket.on('chat:message', async (data) => {
    const userText = typeof data === 'string' ? data : data?.text;
    if (!userText?.trim()) return;

    console.log(`[Bridge] [${socket.id}] → ${userText.slice(0, 80)}`);

    socket.emit('chat:thinking');

    await handleMessage(socket.id, userText, {
      onChunk: (text) => socket.emit('chat:chunk', { text }),

      onToolStart: (toolName) => {
        console.log(`[Bridge] [${socket.id}] tool call: ${toolName}`);
        socket.emit('chat:tool_start', {
          tool: toolName,
          message: '🔧 Creating your page in Drupal...',
        });
      },

      onPageCreated: (page) => {
        console.log(`[Bridge] [${socket.id}] page created: ${page.publicUrl}`);
        socket.emit('chat:page_created', {
          url: page.publicUrl,
          nodeId: page.nodeId,
        });
      },

      onError: (message) => {
        console.error(`[Bridge] [${socket.id}] error: ${message}`);
        socket.emit('chat:error', { message });
      },
    });

    socket.emit('chat:complete');
  });

  socket.on('chat:reset', () => {
    clearSession(socket.id);
    socket.emit('chat:reset_done');
    console.log(`[Bridge] [${socket.id}] session reset`);
  });

  socket.on('disconnect', () => {
    clearSession(socket.id);
    console.log(`[Bridge] Client disconnected: ${socket.id}`);
  });
});

httpServer.listen(PORT, () => {
  console.log(`
  ╔══════════════════════════════════════╗
  ║   DrupalCanvas AI Bridge             ║
  ║   Chat UI  → http://localhost:${PORT}   ║
  ║   Health   → http://localhost:${PORT}/health ║
  ╚══════════════════════════════════════╝
  `);
});
