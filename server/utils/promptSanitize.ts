/**
 * Prompt injection sanitization for LLM inputs.
 * Strips control characters, role-injection markers, and enforces length limits.
 */

const ROLE_TAG_RE = /<\/?(system|model|assistant|user|human|tool|function)>/gi;

const INJECTION_MARKERS_RE =
  /(\bignore\s+(all\s+)?(previous|above|prior)\s+(instructions?|prompts?|rules?))|(\bsystem\s*prompt\b)|(\bdo\s+not\s+follow\b)|(\bnew\s+instructions?\b)/gi;

export function sanitizeForPrompt(
  s: string | undefined | null,
  maxLen = 2000,
): string {
  if (!s) return '';
  let out = '';
  for (let i = 0; i < s.length && out.length < maxLen; i++) {
    const code = s.charCodeAt(i);
    if (code < 0x20 && code !== 0x0a) continue; // keep newlines, strip other control chars
    if (code === 0x7f) continue;
    out += s[i];
  }
  return out
    .replace(ROLE_TAG_RE, '')
    .replace(INJECTION_MARKERS_RE, '[filtered]')
    .slice(0, maxLen);
}

export function sanitizePromptArray(
  arr: string[] | undefined | null,
  maxLenPerItem = 500,
): string[] {
  if (!arr || !Array.isArray(arr)) return [];
  return arr.map((item) => sanitizeForPrompt(String(item), maxLenPerItem));
}
