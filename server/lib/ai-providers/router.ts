// Intelligent router to choose between Claude (complex) and Gemini (fast)
import type { AIProvider } from './types';
import claudeProvider from './claude';
import geminiProvider from './gemini';

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
  // Heuristic: command is complex if it contains certain keywords or is very long
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
  ];

  const hasComplexKeywords = complexKeywords.some((kw) =>
    command.toLowerCase().includes(kw)
  );

  const isLongCommand = command.length > 100;
  const isLargeContext = contextSize > 30;

  // If it's a complex command, large context, or contains multiple operations, use Claude
  if (hasComplexKeywords || isLongCommand || isLargeContext) {
    console.log('[Router] Using Claude for complex request');
    return claudeProvider;
  }

  // Default to Gemini for speed
  console.log('[Router] Using Gemini for simple request');
  return geminiProvider;
}

export { claudeProvider, geminiProvider };
