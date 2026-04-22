import type { ChatBaseMessage } from '../../../shared/types/chat.js';

/** Rough token estimate: 1 token ≈ 4 chars (works for English + Portuguese). */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Convert a chat message array into Gemini's `history` format with adaptive
 * token limiting. Always keeps the 4 most recent messages; older ones are
 * included until the token budget is exhausted.
 *
 * Default budget is 80 000 tokens — well under Gemini's 1M context but
 * leaves room for system prompt + RAG context + the new user message.
 */
export function formatGeminiHistory(
  messages: ChatBaseMessage[],
  maxTokens = 80_000,
) {
  if (messages.length === 0) return [];

  // Always keep the 4 most recent (tail) regardless of size
  const tail = messages.slice(-4);
  const older = messages.slice(0, -4);

  const tailTokens = tail.reduce((sum, m) => sum + estimateTokens(m.content), 0);
  let budget = maxTokens - tailTokens;

  // Walk older messages newest-first, include while budget allows
  const included: ChatBaseMessage[] = [];
  for (let i = older.length - 1; i >= 0 && budget > 0; i--) {
    const tokens = estimateTokens(older[i].content);
    if (tokens > budget) break;
    included.unshift(older[i]);
    budget -= tokens;
  }

  return [...included, ...tail].map(m => ({
    role: m.role === 'user' ? 'user' : 'model',
    parts: [{ text: m.content }],
  }));
}
