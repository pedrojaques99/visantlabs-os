/**
 * AI-First Prompt System - Main Assembler
 *
 * Dynamically assembles minimal prompts based on intent.
 * Reduces tokens by ~70% compared to static monolithic prompt.
 */

import type { AssembledPrompt, ClassifiedIntent, PromptModule } from './types.js';
import { classifyIntent, isChatOnly } from './classifier.js';
import { getCorePrompt } from './core.js';
import { buildPresetContext, getFormatDimensions, buildFullPresetsReference } from './presets.js';
import { CREATE_RULES, CREATE_EXAMPLE, MULTIPLE_FRAMES_RULES } from './modules/create.js';
import { EDIT_RULES, EDIT_EXAMPLE, TEXT_EDIT_WARNING } from './modules/edit.js';
import { TEMPLATE_RULES, TEMPLATE_EXAMPLE } from './modules/template.js';
import { BRAND_PRIORITY_RULE, buildCompactBrandContext } from './modules/brand.js';
import { buildSelectionContext, buildContainersHint } from './modules/context.js';

// Re-export for external use
export * from './types.js';
export * from './presets.js';
export * from './classifier.js';

export interface PromptAssemblerInput {
  command: string;
  selectedElements?: any[];
  brandColors?: Array<{ name: string; value: string; role?: string }>;
  brandFonts?: { primary?: { name: string }; secondary?: { name: string } };
  brandLogos?: { light?: { name: string; key?: string }; dark?: { name: string; key?: string } };
  availableComponents?: any[];
  colorVariables?: Array<{ id: string; name: string; value?: string }>;
  chatHistory?: string;
  thinkMode?: boolean;
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

  // Build modules based on intent
  const modules: PromptModule[] = [];

  // 1. Core prompt (always)
  modules.push({ id: 'core', content: getCorePrompt(false), priority: 100 });

  // 2. Format preset (if detected)
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

  // 3. Intent-specific rules
  if (intent.intent === 'create') {
    modules.push({ id: 'create_rules', content: CREATE_RULES, priority: 80 });

    if (intent.complexity !== 'simple') {
      modules.push({ id: 'create_example', content: CREATE_EXAMPLE, priority: 70 });
    }

    // Multiple frames hint for complex creations
    if (intent.complexity === 'complex') {
      modules.push({ id: 'multi_frames', content: MULTIPLE_FRAMES_RULES, priority: 60 });
    }
  }

  if (intent.intent === 'edit' || intent.hasSelection) {
    modules.push({ id: 'edit_rules', content: EDIT_RULES, priority: 80 });

    // Add text warning if selection has text nodes
    const hasTextNodes = selectedElements.some(
      (n: any) => n.type === 'TEXT' || n.children?.some((c: any) => c.type === 'TEXT')
    );
    if (hasTextNodes) {
      modules.push({ id: 'text_warning', content: TEXT_EDIT_WARNING, priority: 75 });
    }
  }

  if (intent.intent === 'clone' || intent.isTemplate) {
    modules.push({ id: 'template_rules', content: TEMPLATE_RULES, priority: 85 });
    modules.push({ id: 'template_example', content: TEMPLATE_EXAMPLE, priority: 70 });
  }

  // 4. Brand context (if available)
  const brandContext = buildCompactBrandContext(
    input.brandColors,
    input.brandFonts,
    input.brandLogos,
  );
  if (brandContext) {
    modules.push({ id: 'brand', content: BRAND_PRIORITY_RULE + '\n' + brandContext, priority: 85 });
  }

  // 5. Selection context (if has selection)
  if (selectedElements.length > 0) {
    modules.push({
      id: 'selection',
      content: buildSelectionContext(selectedElements),
      priority: 95,
    });
    modules.push({
      id: 'containers',
      content: buildContainersHint(selectedElements),
      priority: 94,
    });
  }

  // 6. Components (if available and creating)
  if (input.availableComponents?.length && intent.intent === 'create') {
    const compList = input.availableComponents
      .slice(0, 10)
      .map((c: any) => `"${c.name}" (key:"${c.key}")`)
      .join(', ');
    modules.push({
      id: 'components',
      content: `COMPONENTES DISPONIVEIS: ${compList}`,
      priority: 50,
    });
  }

  // 7. Color variables (if available)
  if (input.colorVariables?.length) {
    const varList = input.colorVariables
      .slice(0, 8)
      .map(v => `${v.name}:${v.value}`)
      .join(', ');
    modules.push({
      id: 'color_vars',
      content: `VARIAVEIS DE COR (prefira APPLY_VARIABLE): ${varList}`,
      priority: 45,
    });
  }

  // 8. Chat history (if exists)
  if (chatHistory) {
    modules.push({
      id: 'history',
      content: `HISTORICO:\n${chatHistory}`,
      priority: 92,
    });
  }

  // 9. Think mode (if enabled)
  if (input.thinkMode) {
    modules.push({
      id: 'think_mode',
      content: `MODO THINK: Analise o contexto e use MESSAGE para listar TODAS as perguntas antes de criar.`,
      priority: 99,
    });
  }

  // Sort by priority (higher first) and assemble
  modules.sort((a, b) => b.priority - a.priority);
  const systemPrompt = modules.map(m => m.content).join('\n\n');

  // Estimate tokens (~4 chars per token for Portuguese)
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
