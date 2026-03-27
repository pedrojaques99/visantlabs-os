// Intelligent router to choose between Claude (complex) and Gemini (fast)
import type { AIProvider } from './types.js';
import claudeProvider from './claude.js';
import geminiProvider from './gemini.js';

// ═══════════════════════════════════════════
// Keyword-based routing (fast, no API call)
// ═══════════════════════════════════════════

const COMPLEX_KEYWORDS = [
  'página', 'section', 'seção', 'layout', 'design', 'sistema',
  'completo', 'complete', 'estrutura', 'structure',
  'vários', 'multiple', 'múltiplas', ' e ', ' and ', ',',
  // Research keywords → Claude with web_search
  'pesquis', 'busca', 'busque', 'search',
  'referência', 'referencia', 'reference',
  'inspiração', 'inspiracao', 'inspiration',
  'tendência', 'tendencia', 'trend',
  'exemplo', 'example', 'similar', 'como',
  'estilo de', 'style of', 'parecido com', 'like',
];

/**
 * Fast keyword-based complexity check (no API call).
 */
function hasComplexitySignals(command: string, contextSize: number): boolean {
  const lower = command.toLowerCase();
  const hasKeywords = COMPLEX_KEYWORDS.some(kw => lower.includes(kw));
  const isLong = command.length > 100;
  const isLargeContext = contextSize > 30;

  return hasKeywords || isLong || isLargeContext;
}

/**
 * Chooses an AI provider based on command complexity and context size.
 * Uses fast keyword heuristics by default.
 *
 * @param command - The user command/prompt
 * @param contextSize - Number of elements in context
 */
export function chooseProvider(
  command: string,
  contextSize: number
): AIProvider {
  // If Claude API key is not configured, always use Gemini
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log('[Router] ANTHROPIC_API_KEY not set — using Gemini');
    return geminiProvider;
  }

  if (hasComplexitySignals(command, contextSize)) {
    console.log('[Router] Using Claude for complex request');
    return claudeProvider;
  }

  console.log('[Router] Using Gemini for simple request');
  return geminiProvider;
}

export { claudeProvider, geminiProvider };
