import type { ChatBaseMessage } from '../../../shared/types/chat.js';

/**
 * Convert a chat message array into Gemini's `history` format.
 * Slices to the last `maxRecent` messages (default 20) to keep prompts bounded.
 */
export function formatGeminiHistory(messages: ChatBaseMessage[], maxRecent = 20) {
  return messages.slice(-maxRecent).map(m => ({
    role: m.role === 'user' ? 'user' : 'model',
    parts: [{ text: m.content }],
  }));
}
