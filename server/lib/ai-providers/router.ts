// Intelligent router to choose between Claude (complex) and Gemini (fast)
import type { AIProvider } from './types.js';
import claudeProvider from './claude.js';
import geminiProvider from './gemini.js';

/**
 * Chooses an AI provider based on command complexity and context size
 *
 * Heuristics:
 * - Complex commands (multi-step, long text) → Claude (better reasoning)
 * - Large context (>50 elements) → Claude (larger context window)
 * - Simple edits or quick generation → Gemini (faster, cheaper)
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

  const complexKeywords = [
    'página',
    'section',
    'seção',
    'layout',
    'design',
    'sistema',
    'completo',
    'complete',
    'estrutura',
    'structure',
    'vários',
    'multiple',
    'múltiplas',
    ' e ',
    ' and ',
    ',',
    // Search/research keywords → Claude agent with web_search
    'pesquis',
    'busca',
    'busque',
    'search',
    'referência',
    'referencia',
    'reference',
    'inspiração',
    'inspiracao',
    'inspiration',
    'tendência',
    'tendencia',
    'trend',
    'exemplo',
    'example',
    'similar',
    'como',
    'estilo de',
    'style of',
    'parecido com',
    'like',
  ];

  const hasComplexKeywords = complexKeywords.some((kw) =>
    command.toLowerCase().includes(kw)
  );

  const isLongCommand = command.length > 100;
  const isLargeContext = contextSize > 30;

  if (hasComplexKeywords || isLongCommand || isLargeContext) {
    console.log('[Router] Using Claude for complex request');
    return claudeProvider;
  }

  console.log('[Router] Using Gemini for simple request');
  return geminiProvider;
}

export { claudeProvider, geminiProvider };
