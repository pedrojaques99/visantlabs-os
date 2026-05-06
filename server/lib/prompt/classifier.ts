/**
 * AI-First Prompt System - Intent Classifier
 *
 * Fast keyword-based classification (no LLM call needed).
 * Determines what modules to inject into the prompt.
 */

import type { ClassifiedIntent, IntentType, ComplexityLevel } from './types.js';
import { detectFormat } from './presets.js';
import { COLOR_SPEC_PATTERNS } from './modules/color-spec.js';

// Keyword patterns for intent detection
const INTENT_PATTERNS: Record<IntentType, RegExp[]> = {
  create: [
    /\b(cria|criar|crie|faz|fazer|faca|faça|gera|gerar|desenha|desenhar|monta|montar|adiciona|adicionar|novo|nova)\b/i,
    /\b(create|make|build|design|add|new|generate)\b/i,
  ],
  edit: [
    /\b(edita|editar|muda|mudar|altera|alterar|troca|trocar|modifica|modificar|ajusta|ajustar|atualiza|atualizar)\b/i,
    /\b(edit|change|modify|update|adjust|fix|alter)\b/i,
    /\b(dark|light|claro|escuro)\s*(mode|modo|tema|theme)?\b/i,
    /\b(invert|inverter|inverte)\b/i,
  ],
  clone: [
    /\b(clona|clonar|duplica|duplicar|copia|copiar|replica|replicar)\b/i,
    /\b(clone|duplicate|copy|replicate)\b/i,
  ],
  delete: [
    /\b(deleta|deletar|remove|remover|apaga|apagar|exclui|excluir)\b/i,
    /\b(delete|remove|erase|clear)\b/i,
  ],
  arrange: [
    /\b(organiza|organizar|alinha|alinhar|distribui|distribuir|posiciona|posicionar|move|mover)\b/i,
    /\b(arrange|align|distribute|position|layout)\b/i,
  ],
  chat: [
    /\b(oi|ola|olá|hey|hello|hi|como|what|how|why|quando|where|pode|can|help|ajuda)\b/i,
    /^\?/, // Starts with question mark
  ],
};

// Complexity indicators
const COMPLEXITY_INDICATORS = {
  simple: [
    /\b(simples|simple|basico|básico|rapido|rápido|quick|basic)\b/i,
    /\b(um|uma|one|single)\b/i,
  ],
  complex: [
    /\b(completo|complete|detalhado|detailed|varios|várias|multiple|muitos|muitas)\b/i,
    /\b(sistema|system|dashboard|layout|page|pagina|página)\b/i,
    /\b(carrossel|carousel|galeria|gallery|grid)\b/i,
    /\b(\d+)\s*(destaques?|slides?|cards?|posts?|stories|frames?|items?|elementos?)\b/i, // "5 destaques", "3 slides"
    /\b(destaques?|slides?|cards?|posts?|stories|frames?)\s*(\d+)\b/i, // "destaques 5"
  ],
};

// Template indicators
const TEMPLATE_PATTERNS = [
  /\[template\]/i,
  /\btemplate\b/i,
  /\bmodelo\b/i,
];

// Chart/Data visualization indicators
const CHART_PATTERNS = [
  /\b(chart|charts|graph|graphs|grafico|gráfico|graficos|gráficos)\b/i,
  /\b(barra|barras|bar|bars|linha|line|pizza|pie|scatter|donut)\b/i,
  /\b(dashboard|dados|data|visualization|visualização|visualizacao)\b/i,
  /\b(eixo|axis|legenda|legend|serie|series)\b/i,
];

// Dimension requirement indicators (when format is unknown)
const NEEDS_DIMENSIONS_PATTERNS = [
  /\b(banner|flyer|poster|cartaz|outdoor|card|modal|popup)\b/i,
];

/**
 * Classify user intent from prompt
 */
export function classifyIntent(
  prompt: string,
  hasSelection: boolean = false,
): ClassifiedIntent {
  const normalized = prompt.toLowerCase();
  const keywords: string[] = [];

  // Detect primary intent
  let intent: IntentType = 'chat';
  let maxMatches = 0;

  for (const [intentType, patterns] of Object.entries(INTENT_PATTERNS)) {
    let matches = 0;
    for (const pattern of patterns) {
      const match = normalized.match(pattern);
      if (match) {
        matches++;
        keywords.push(match[0]);
      }
    }
    if (matches > maxMatches) {
      maxMatches = matches;
      intent = intentType as IntentType;
    }
  }

  // Detect format
  const format = detectFormat(prompt);

  // Detect complexity
  let complexity: ComplexityLevel = 'medium';
  for (const pattern of COMPLEXITY_INDICATORS.simple) {
    if (pattern.test(normalized)) {
      complexity = 'simple';
      break;
    }
  }
  for (const pattern of COMPLEXITY_INDICATORS.complex) {
    if (pattern.test(normalized)) {
      complexity = 'complex';
      break;
    }
  }

  // Check if template-related
  const isTemplate = TEMPLATE_PATTERNS.some(p => p.test(normalized));

  // Check if chart/data visualization
  const isChart = CHART_PATTERNS.some(p => p.test(normalized));

  // Check if color specification request
  const isColorSpec = COLOR_SPEC_PATTERNS.some(p => p.test(normalized));

  // Check if needs dimensions (unknown format + dimension-needing keywords)
  const needsDimensions =
    format === 'unknown' &&
    intent === 'create' &&
    NEEDS_DIMENSIONS_PATTERNS.some(p => p.test(normalized));

  // Calculate confidence
  const confidence = Math.min(0.95, 0.5 + maxMatches * 0.15 + (format !== 'unknown' ? 0.2 : 0));

  return {
    intent,
    format,
    complexity,
    confidence,
    needsDimensions,
    hasSelection,
    isTemplate,
    isChart,
    isColorSpec,
    keywords,
  };
}

// Short commands that are design actions, not chat
const SHORT_ACTION_PATTERNS = [
  /\b(dark|light|invert)\s*(mode|tema|theme)?\b/i,
  /\b(bold|italic|uppercase|lowercase)\b/i,
  /\b(red|blue|green|black|white|gray|grey)\s*(bg|background|fill|text|cor)?\b/i,
  /\b(bg|fill|stroke|border|shadow|opacity|radius)\b/i,
  /\b(align|center|left|right|top|bottom)\b/i,
  /\b(resize|scale|rotate|flip|crop)\b/i,
  /\b(hide|show|lock|unlock|group|ungroup)\b/i,
  /\b(copy|paste|duplicate|delete|remove)\b/i,
  /\b(undo|redo|reset)\b/i,
];

/**
 * Quick check if prompt is just chat (no design intent)
 */
export function isChatOnly(prompt: string): boolean {
  const normalized = prompt.toLowerCase().trim();

  // Very short messages are usually chat — unless they match known design actions
  if (normalized.length < 10) {
    if (SHORT_ACTION_PATTERNS.some(p => p.test(normalized))) return false;
    return true;
  }

  // Greetings
  if (/^(oi|ola|olá|hey|hello|hi|bom dia|boa tarde|boa noite|e ai|eai)/i.test(normalized)) {
    return true;
  }

  // Questions without design context
  if (/^(como|what|how|can you|voce pode|você pode|me explica|explica)/i.test(normalized)) {
    // Unless it's "how do I create..."
    if (!/\b(cria|criar|faz|fazer|design)/i.test(normalized)) {
      return true;
    }
  }

  return false;
}
