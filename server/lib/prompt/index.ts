/**
 * AI-First Prompt System - Main Assembler
 *
 * Dynamically assembles minimal prompts based on intent.
 * Single prompt pipeline — no V1/V2 split.
 */

import type { AssembledPrompt, ClassifiedIntent, PromptModule } from './types.js';
import { classifyIntent, isChatOnly, refineIntentWithLLM } from './classifier.js';
import { getCorePrompt } from './core.js';
import { buildPresetContext, getFormatDimensions } from './presets.js';
import { CREATE_RULES, CREATE_EXAMPLE, MULTIPLE_FRAMES_RULES } from './modules/create.js';
import { EDIT_RULES, EDIT_EXAMPLE, TEXT_EDIT_WARNING } from './modules/edit.js';
import { TEMPLATE_RULES, TEMPLATE_EXAMPLE } from './modules/template.js';
import { CHART_RULES, CHART_EXAMPLE } from './modules/charts.js';
import { BRAND_PRIORITY_RULE, buildCompactBrandContext, buildBrandStrategyContext, type BrandStrategyInput } from './modules/brand.js';
import { DESIGN_EXCELLENCE_RULES } from './modules/design-excellence.js';
import { COLOR_SPEC_RULES } from './modules/color-spec.js';
import { buildSelectionContext, buildContainersHint } from './modules/context.js';
import { buildToolsReference } from './modules/tools-reference.js';
import { GOLDEN_RULES, THINK_MODE_RULES } from './modules/golden-rules.js';

// Re-export for external use
export * from './types.js';
export * from './presets.js';
export { classifyIntent, isChatOnly, refineIntentWithLLM, type EnrichedIntent } from './classifier.js';

export interface PromptAssemblerInput {
  command: string;
  selectedElements?: any[];
  scanPage?: boolean;
  brandColors?: Array<{ name: string; value: string; role?: string }>;
  brandFonts?: { primary?: { family?: string; style?: string; size?: number; availableStyles?: string[] }; secondary?: { family?: string; style?: string; size?: number; availableStyles?: string[] } };
  brandLogos?: { light?: { name: string; key?: string }; dark?: { name: string; key?: string } };
  brandTokens?: { spacing?: Record<string, number>; radius?: Record<string, number>; shadows?: Record<string, any> };
  brandVoice?: string;
  brandDos?: string[];
  brandDonts?: string[];
  brandStrategy?: BrandStrategyInput;
  availableComponents?: any[];
  colorVariables?: Array<{ id: string; name: string; value?: string }>;
  fontVariables?: any[];
  designSystem?: any;
  attachments?: Array<{ name: string; mimeType?: string }>;
  chatHistory?: string;
  thinkMode?: boolean;
  useBrand?: boolean;
  brandKnowledgeContext?: string;
  previousErrors?: string[];
  // Pre-built context strings from route-level scanning
  templateContext?: string;
  agentComponentsContext?: string;
  enforcedTokens?: string;
  brandChoiceContext?: string;
}

/**
 * Assemble a minimal, intent-optimized prompt
 */
export function assemblePrompt(input: PromptAssemblerInput): AssembledPrompt {
  const { command, selectedElements = [], chatHistory } = input;

  // Classify intent
  const intent = classifyIntent(command, selectedElements.length > 0);

  // Check if pure chat
  if (isChatOnly(command)) {
    return {
      system: getCorePrompt(true),
      tokenEstimate: 100,
      modules: ['chat_only'],
      intent: { ...intent, intent: 'chat' },
    };
  }

  const modules: PromptModule[] = [];

  // ── 1. Core identity (always) ──
  modules.push({ id: 'core', content: getCorePrompt(false), priority: 100 });

  // ── 2. Tools reference (dynamic from registry) ──
  const toolIntent = intent.intent === 'chat' ? 'full' : intent.intent;
  modules.push({
    id: 'tools',
    content: buildToolsReference(toolIntent),
    priority: 97,
  });

  // ── 3. Golden rules (anti-hallucination, critical behaviors) ──
  modules.push({ id: 'golden_rules', content: GOLDEN_RULES, priority: 96 });

  // ── 4. Format preset (if detected) ──
  if (intent.format !== 'unknown') {
    modules.push({
      id: 'preset',
      content: buildPresetContext(intent.format),
      priority: 90,
    });
  } else if (intent.needsDimensions) {
    modules.push({
      id: 'ask_dimensions',
      content: 'DIMENSOES: Formato desconhecido. Use MESSAGE para PERGUNTAR antes de criar.',
      priority: 90,
    });
  }

  // ── 5. Intent-specific rules (primary + secondary) ──
  const activeIntents = new Set([intent.intent]);
  if (intent.secondaryIntent) activeIntents.add(intent.secondaryIntent);

  if (activeIntents.has('create')) {
    modules.push({ id: 'create_rules', content: CREATE_RULES, priority: 80 });

    if (intent.complexity !== 'simple') {
      modules.push({ id: 'create_example', content: CREATE_EXAMPLE, priority: 70 });
      modules.push({ id: 'sexy_design', content: DESIGN_EXCELLENCE_RULES, priority: 82 });
    }

    if (intent.complexity === 'complex') {
      modules.push({ id: 'multi_frames', content: MULTIPLE_FRAMES_RULES, priority: 60 });
    }
  }

  if (activeIntents.has('edit') || intent.hasSelection) {
    modules.push({ id: 'edit_rules', content: EDIT_RULES, priority: 80 });

    const hasTextNodes = selectedElements.some(
      (n: any) => n.type === 'TEXT' || n.children?.some((c: any) => c.type === 'TEXT')
    );
    if (hasTextNodes) {
      modules.push({ id: 'text_warning', content: TEXT_EDIT_WARNING, priority: 75 });
    }
  }

  if (activeIntents.has('clone') || intent.isTemplate || !!input.templateContext) {
    modules.push({ id: 'template_rules', content: TEMPLATE_RULES, priority: 85 });
    modules.push({ id: 'template_example', content: TEMPLATE_EXAMPLE, priority: 70 });
  }

  if (activeIntents.has('delete')) {
    modules.push({
      id: 'delete_rules',
      content: 'DELETE: Use DELETE_NODE com nodeId. NUNCA delete nodes dentro de [Template].',
      priority: 80,
    });
  }

  if (activeIntents.has('arrange')) {
    modules.push({
      id: 'arrange_rules',
      content: 'ARRANGE: Use MOVE (nodeId/ref, x, y), SET_AUTO_LAYOUT, RESIZE. Para alinhar, calcule posições a partir do contexto.',
      priority: 80,
    });
  }

  // ── 5.5. Chart / Color spec rules ──
  if (intent.isChart) {
    modules.push({ id: 'chart_rules', content: CHART_RULES, priority: 82 });
    modules.push({ id: 'chart_example', content: CHART_EXAMPLE, priority: 72 });
  }

  if (intent.isColorSpec) {
    modules.push({ id: 'color_spec', content: COLOR_SPEC_RULES, priority: 85 });
  }

  // ── 6. Brand context ──
  if (input.useBrand !== false) {
    const brandContext = buildCompactBrandContext(
      input.brandColors,
      input.brandFonts,
      input.brandLogos,
      input.brandTokens,
      input.brandVoice,
      input.brandDos,
      input.brandDonts,
    );
    if (brandContext) {
      modules.push({ id: 'brand', content: BRAND_PRIORITY_RULE + '\n' + brandContext, priority: 85 });
    }
    const strategyContext = buildBrandStrategyContext(input.brandStrategy);
    if (strategyContext) {
      modules.push({ id: 'brand_strategy', content: strategyContext, priority: 84 });
    }
    if (input.brandKnowledgeContext) {
      modules.push({ id: 'brand_knowledge', content: `<brand_knowledge>\n${input.brandKnowledgeContext}\n</brand_knowledge>`, priority: 84 });
    }
  } else {
    modules.push({
      id: 'brand_disabled',
      content: 'BRANDING: O usuário desativou o uso de marca. Use estilos genéricos e modernos (ex: Inter para fontes, cores neutras ou cores vibrantes genéricas se não especificado).',
      priority: 85
    });
  }

  // ── 7. Design system (imported JSON tokens, separate from brand) ──
  if (input.designSystem) {
    const ds = input.designSystem;
    const dsParts: string[] = ['DESIGN SYSTEM IMPORTADO:'];
    if (ds.name) dsParts.push(`Nome: ${ds.name} v${ds.version || '1.0'}`);
    if (ds.colors?.length) {
      const colorList = ds.colors.slice(0, 10).map((c: any) => `${c.name}:${c.value}`).join(', ');
      dsParts.push(`Cores: ${colorList}`);
    }
    if (ds.typography?.length) {
      const typoList = ds.typography.slice(0, 6).map((t: any) => `${t.name}:${t.fontFamily}/${t.fontSize}px`).join(', ');
      dsParts.push(`Tipografia: ${typoList}`);
    }
    if (ds.spacing) {
      const spacingList = Object.entries(ds.spacing).slice(0, 6).map(([k, v]) => `${k}:${v}px`).join(', ');
      dsParts.push(`Spacing: ${spacingList}`);
    }
    if (ds.radius) {
      const radiusList = Object.entries(ds.radius).slice(0, 6).map(([k, v]) => `${k}:${v}px`).join(', ');
      dsParts.push(`Radius: ${radiusList}`);
    }
    modules.push({ id: 'design_system', content: dsParts.join('\n'), priority: 84 });
  }

  // ── 8. Selection context ──
  if (selectedElements.length > 0) {
    const label = input.scanPage
      ? 'TODOS OS ELEMENTOS DA PÁGINA (scan completo — use os ids para edição)'
      : undefined;
    modules.push({
      id: 'selection',
      content: buildSelectionContext(selectedElements, 20, label),
      priority: 95,
    });
    modules.push({
      id: 'containers',
      content: buildContainersHint(selectedElements),
      priority: 94,
    });
  } else if (input.scanPage) {
    modules.push({
      id: 'selection',
      content: 'SELECAO: Página vazia (scan ativo mas sem elementos). Crie na raiz.',
      priority: 95,
    });
  }

  // ── 9. Components ──
  if (input.availableComponents?.length) {
    const compList = input.availableComponents
      .slice(0, 20)
      .map((c: any) => `- "${c.name}" (key:"${c.key}")`)
      .join('\n');
    modules.push({
      id: 'components',
      content: `⭐ COMPONENTES DISPONÍVEIS — PRIORIZE CREATE_COMPONENT_INSTANCE com "componentKey":\n${compList}\n→ Só crie do zero se NENHUM componente acima atender.`,
      priority: 83,
    });
  }

  // ── 10. Color variables ──
  if (input.colorVariables?.length) {
    const varList = input.colorVariables
      .slice(0, 20)
      .map(v => `${v.name}:${v.value} (id:"${v.id}")`)
      .join(', ');
    modules.push({
      id: 'color_vars',
      content: `VARIÁVEIS DE COR (prefira APPLY_VARIABLE para paints sólidos): ${varList}`,
      priority: 45,
    });
  }

  // ── 11. Font variables ──
  if (input.fontVariables?.length) {
    const fontVarList = input.fontVariables
      .slice(0, 10)
      .map((f: any) => `"${f.name}" (id:"${f.id}")`)
      .join(', ');
    modules.push({
      id: 'font_vars',
      content: `VARIÁVEIS DE FONTE: ${fontVarList}`,
      priority: 44,
    });
  }

  // ── 12. Attachments ──
  if (input.attachments?.length) {
    const attList = input.attachments.map(a => `- ${a.name}${a.mimeType ? ` (${a.mimeType})` : ''}`).join('\n');
    modules.push({
      id: 'attachments',
      content: `ARQUIVOS ANEXADOS:\n${attList}`,
      priority: 91,
    });
  }

  // ── 13. Chat history ──
  if (chatHistory) {
    modules.push({
      id: 'history',
      content: `═══ HISTÓRICO DE CONVERSA ═══\n${chatHistory}`,
      priority: 92,
    });
  }

  // ── 14. Think mode ──
  if (input.thinkMode) {
    modules.push({
      id: 'think_mode',
      content: THINK_MODE_RULES,
      priority: 99,
    });
  }

  // ── 15. Previous errors feedback (retry loop) ──
  if (input.previousErrors?.length) {
    modules.push({
      id: 'feedback',
      content: `PREVIOUS ERRORS (avoid repeating):\n${input.previousErrors.slice(0, 5).map(e => `- ${e}`).join('\n')}`,
      priority: 98,
    });
  }

  // ── 16. Route-level scanned contexts (pre-built strings) ──
  if (input.templateContext) {
    modules.push({ id: 'scanned_templates', content: input.templateContext, priority: 86 });
  }
  if (input.agentComponentsContext) {
    modules.push({ id: 'scanned_agent_components', content: input.agentComponentsContext, priority: 84 });
  }
  if (input.brandChoiceContext) {
    modules.push({ id: 'brand_choice', content: input.brandChoiceContext, priority: 88 });
  }
  if (input.enforcedTokens) {
    modules.push({ id: 'enforced_tokens', content: input.enforcedTokens, priority: 93 });
  }

  // Sort by priority (higher first) and assemble
  modules.sort((a, b) => b.priority - a.priority);
  const systemPrompt = modules.map(m => m.content).join('\n\n');

  const tokenEstimate = Math.ceil(systemPrompt.length / 4);

  return {
    system: systemPrompt,
    tokenEstimate,
    modules: modules.map(m => m.id),
    intent,
  };
}

/**
 * Build feedback prompt for retry loop
 */
export function buildRetryFeedback(errors: string[]): string {
  return `ERROS NA GERACAO ANTERIOR:\n${errors.join('\n')}\n\nCorrija e tente novamente.`;
}

/**
 * Get minimal prompt for simple operations
 */
export function getMinimalPrompt(): string {
  return getCorePrompt(false);
}
