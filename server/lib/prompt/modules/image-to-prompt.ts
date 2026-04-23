/**
 * Module: Image to Prompt Generator
 *
 * Analyzes any UI screenshot and generates Figma plugin prompts.
 * Modular, scalable, with feedback integration.
 */

import { CHART_RULES } from './charts.js';
import { CREATE_RULES } from './create.js';

// Component type detection patterns
export const COMPONENT_TYPES = {
  chart: ['chart', 'graph', 'gráfico', 'grafico', 'bar', 'line', 'pie', 'dashboard', 'metrics', 'data'],
  card: ['card', 'cartão', 'cartao', 'tile', 'box', 'container'],
  form: ['form', 'formulário', 'formulario', 'input', 'field', 'login', 'signup', 'cadastro'],
  navigation: ['nav', 'menu', 'sidebar', 'header', 'footer', 'toolbar', 'tab'],
  list: ['list', 'lista', 'table', 'tabela', 'grid', 'gallery', 'galeria'],
  modal: ['modal', 'dialog', 'popup', 'toast', 'alert', 'notification'],
  hero: ['hero', 'banner', 'cta', 'splash', 'landing'],
} as const;

export type ComponentType = keyof typeof COMPONENT_TYPES;

// Base rules that apply to all components
const BASE_RULES = `
REGRAS UNIVERSAIS FIGMA:
- Frame filho SEM auto-layout: DEVE ter width E height explícitos
- Frame filho COM auto-layout: DEVE ter layoutSizingHorizontal + layoutSizingVertical
- Cores em hex (#RRGGBB) → converta para RGB 0-1 no JSON
- Nomes semânticos: "Section/Header", "Card/Body", "Input/Field"
- Auto-layout: HORIZONTAL ou VERTICAL, nunca NONE para containers
- counterAxisAlignItems: CENTER (centralizar), MIN (início), MAX (fim)
- primaryAxisAlignItems: MIN, CENTER, MAX, SPACE_BETWEEN

${CREATE_RULES}
`;

// Specific rules per component type
const COMPONENT_RULES: Record<ComponentType, string> = {
  chart: CHART_RULES,
  card: `CARDS:
- Container: cornerRadius 8-16, padding 16-24, fill branco ou cinza claro
- Header: HORIZONTAL, título + ações
- Body: VERTICAL, conteúdo principal
- Footer: HORIZONTAL, botões/links`,
  form: `FORMS:
- Container: VERTICAL, itemSpacing 16-24
- Label + Input: VERTICAL, itemSpacing 4-8
- Input: height 40-48, cornerRadius 8, stroke #E5E7EB
- Botão: height 40-48, cornerRadius 8, fill cor primária
- Validação: texto vermelho #EF4444 fontSize 12`,
  navigation: `NAVIGATION:
- Container: HORIZONTAL para topbar, VERTICAL para sidebar
- Items: HORIZONTAL, itemSpacing 8, padding 8-12
- Active state: fill ou underline diferenciado
- Logo: primeiro item, seguido de nav items
- Actions: último item (perfil, settings)`,
  list: `LISTS/TABLES:
- Container: VERTICAL, itemSpacing 0 ou 1 (dividers)
- Row: HORIZONTAL, layoutSizingHorizontal FILL
- Cell: largura proporcional ou fixa
- Header row: fontStyle Bold, fill #F9FAFB
- Alternating rows: fills alternados para zebra`,
  modal: `MODALS:
- Overlay: fill preto opacity 0.5
- Container: cornerRadius 12-16, padding 24, fill branco
- Header: HORIZONTAL, título + close button
- Body: VERTICAL, conteúdo
- Footer: HORIZONTAL, justify MAX (botões à direita)
- Tamanho: width 400-600, height auto`,
  hero: `HERO/BANNERS:
- Container: width 100% (1440), height 400-600
- Background: imagem ou gradient
- Content: VERTICAL, centralizado
- Título: fontSize 48-72, fontStyle Bold
- Subtitle: fontSize 18-24, opacity 0.8
- CTA: botão destacado`,
};

/**
 * Build system prompt based on detected component type
 */
export function buildImageToPromptSystem(
  detectedType?: ComponentType,
  learnings?: string[]
): string {
  const specificRules = detectedType ? COMPONENT_RULES[detectedType] : '';

  // Learnings from MongoDB feedback - these are prioritized
  const learningContext = learnings?.length
    ? `\n${learnings.join('\n')}\n\nAPLIQUE estes aprendizados ao gerar o prompt.\n`
    : '';

  return `Você é um especialista em converter screenshots de UI em prompts estruturados para o Figma plugin.

TAREFA: Analise a imagem e gere um prompt DETALHADO e PRECISO que o plugin possa executar.
${learningContext}
${BASE_RULES}

${specificRules}

FORMATO DO PROMPT DE SAÍDA:
1. Linha 1: "Crie um [tipo de componente] com..."
2. ESTRUTURA: hierarquia numerada de frames com propriedades
3. DADOS: todos os textos, valores, labels visíveis
4. CORES: extraia TODAS as cores em hex (#RRGGBB)
5. ESPECIFICAÇÕES: dimensões, padding, itemSpacing, cornerRadius, fontSize

REGRAS CRÍTICAS:
- SEMPRE especifique layoutMode (HORIZONTAL ou VERTICAL)
- SEMPRE especifique layoutSizingHorizontal/Vertical para frames filhos
- SEMPRE inclua width/height explícitos em retângulos e frames raiz
- Para gráficos: use counterAxisAlignItems:"MAX" para alinhar barras pela base
- Extraia valores aproximados de dados visuais

RESPONDA APENAS COM O PROMPT PRONTO PARA USO.`;
}

export const IMAGE_ANALYSIS_USER_PROMPT = `Analise esta imagem e gere um prompt completo para recriar este design no Figma plugin.

Extraia:
- Estrutura hierárquica (o que está dentro do quê)
- Todos os textos e valores visíveis
- Cores (estime os hex codes)
- Dimensões aproximadas
- Espaçamentos e alinhamentos`;

/**
 * Detect component type from image description or previous analysis
 */
export function detectComponentType(description: string): ComponentType | undefined {
  const lower = description.toLowerCase();

  for (const [type, keywords] of Object.entries(COMPONENT_TYPES)) {
    if (keywords.some(kw => lower.includes(kw))) {
      return type as ComponentType;
    }
  }

  return undefined;
}
