/**
 * Groq chat integration (file kept as gemini.js for import compatibility).
 * Uses llama-3.3-70b-versatile via Groq's free tier.
 */
import Groq from 'groq-sdk';
import { SYSTEM_PROMPT, CREATE_PAGE_TOOL } from './components.js';
import { createCanvasPage } from './drupal-client.js';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const MODEL = 'llama-3.3-70b-versatile';
const TOOLS = [CREATE_PAGE_TOOL];

/** In-memory session store: socketId → { messages: [] } */
const sessions = new Map();

function getOrCreateSession(socketId) {
  if (!sessions.has(socketId)) {
    sessions.set(socketId, { messages: [] });
  }
  return sessions.get(socketId);
}

export function clearSession(socketId) {
  sessions.delete(socketId);
}

/**
 * Handles one conversational turn.
 * Streams text to the client, executes tool calls when the model requests them,
 * then continues until the model finishes.
 */
export async function handleMessage(socketId, userText, callbacks) {
  const { onChunk, onToolStart, onPageCreated, onError } = callbacks;
  const session = getOrCreateSession(socketId);

  session.messages.push({ role: 'user', content: userText });

  try {
    // Loop to handle chained tool calls
    while (true) {
      const stream = await groq.chat.completions.create({
        model: MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          ...session.messages,
        ],
        tools: TOOLS,
        tool_choice: 'auto',
        max_tokens: 4096,
        stream: true,
      });

      // Accumulate the full response while streaming text to the client
      let textAccum = '';
      const toolCalls = [];

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta;

        // Stream text chunks
        if (delta?.content) {
          textAccum += delta.content;
          onChunk(delta.content);
        }

        // Accumulate tool call fragments (they arrive in multiple chunks)
        if (delta?.tool_calls) {
          for (const tc of delta.tool_calls) {
            const idx = tc.index ?? 0;
            if (!toolCalls[idx]) {
              toolCalls[idx] = { id: '', type: 'function', function: { name: '', arguments: '' } };
            }
            if (tc.id) toolCalls[idx].id = tc.id;
            if (tc.function?.name) toolCalls[idx].function.name += tc.function.name;
            if (tc.function?.arguments) toolCalls[idx].function.arguments += tc.function.arguments;
          }
        }
      }

      // Save assistant turn to history
      const assistantMsg = { role: 'assistant', content: textAccum || null };
      if (toolCalls.length > 0) assistantMsg.tool_calls = toolCalls;
      session.messages.push(assistantMsg);

      // No tool calls → turn is complete
      if (toolCalls.length === 0) break;

      // Execute each tool call and push the results back into history
      for (const tc of toolCalls) {
        const { name, arguments: argsStr } = tc.function;
        onToolStart(name);

        let toolResult;
        try {
          const args = JSON.parse(argsStr);
          if (name === 'create_drupal_page') {
            const page = await createCanvasPage(args.title, args.components);
            toolResult = {
              success: true,
              message: `Page "${args.title}" created successfully.`,
              url: page.publicUrl,
              nodeId: page.nodeId,
            };
            onPageCreated(page);
          } else {
            toolResult = { success: false, error: `Unknown tool: ${name}` };
          }
        } catch (err) {
          toolResult = { success: false, error: err.message };
        }

        session.messages.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: JSON.stringify(toolResult),
        });
      }
      // Continue loop so the model can respond after tool execution
    }
  } catch (err) {
    onError(err.message || 'Unexpected error from Groq.');
  }
}
