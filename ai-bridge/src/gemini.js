import { GoogleGenerativeAI } from '@google/generative-ai';
import { SYSTEM_PROMPT, CREATE_PAGE_FUNCTION } from './components.js';
import { createCanvasPage } from './drupal-client.js';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/** In-memory session store: socketId → { chat } */
const sessions = new Map();

function buildModel() {
  return genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    systemInstruction: SYSTEM_PROMPT,
    tools: [{ functionDeclarations: [CREATE_PAGE_FUNCTION] }],
    toolConfig: { functionCallingConfig: { mode: 'AUTO' } },
  });
}

/**
 * Returns the chat session for a socket.
 * Creates a new session if one does not exist.
 */
function getOrCreateSession(socketId) {
  if (!sessions.has(socketId)) {
    const model = buildModel();
    const chat = model.startChat({ history: [] });
    sessions.set(socketId, { chat });
  }
  return sessions.get(socketId);
}

/** Remove the session when a socket disconnects. */
export function clearSession(socketId) {
  sessions.delete(socketId);
}

/**
 * Handles one turn of the conversation.
 * Streams text back via `onChunk`, calls Drupal if a function call occurs,
 * and resolves when the turn is complete.
 *
 * @param {string} socketId
 * @param {string|Array} message  – plain string or Gemini parts array
 * @param {{ onChunk, onToolStart, onPageCreated, onError }} callbacks
 */
export async function handleMessage(socketId, message, callbacks) {
  const { onChunk, onToolStart, onPageCreated, onError } = callbacks;
  const { chat } = getOrCreateSession(socketId);

  try {
    let currentMessage = message;

    // Loop to handle potential chained function calls
    while (true) {
      const result = await chat.sendMessageStream(currentMessage);

      // Stream text chunks to the client
      for await (const chunk of result.stream) {
        const text = chunk.text();
        if (text) onChunk(text);
      }

      const response = await result.response;
      const parts = response.candidates?.[0]?.content?.parts ?? [];

      // Look for a function call in the response parts
      const functionCallPart = parts.find((p) => p.functionCall);

      if (!functionCallPart) {
        // No function call – conversation turn is complete
        break;
      }

      const { name, args } = functionCallPart.functionCall;
      onToolStart(name);

      let functionResult;
      try {
        if (name === 'create_drupal_page') {
          const page = await createCanvasPage(args.title, args.components);
          functionResult = {
            success: true,
            message: `Page "${args.title}" created successfully.`,
            url: page.publicUrl,
            nodeId: page.nodeId,
          };
          onPageCreated(page);
        } else {
          functionResult = { success: false, error: `Unknown function: ${name}` };
        }
      } catch (err) {
        functionResult = { success: false, error: err.message };
      }

      // Feed the function result back and continue the loop
      currentMessage = [
        {
          functionResponse: {
            name,
            response: functionResult,
          },
        },
      ];
    }
  } catch (err) {
    onError(err.message || 'An unexpected error occurred.');
  }
}
