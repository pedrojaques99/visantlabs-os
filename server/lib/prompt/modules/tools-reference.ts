/**
 * Module: Tools Reference
 *
 * Compact operation reference auto-generated from the tool registry.
 * Injected for all non-chat intents so the LLM knows parameter shapes.
 */

import { FIGMA_TOOLS, type FigmaTool } from '../../tools/registry.js';

function formatToolCompact(t: FigmaTool): string {
  return `- ${t.operationType}: ${JSON.stringify(t.example)}`;
}

/**
 * Build compact tools reference grouped by category.
 * Only includes operations relevant to the given intent.
 */
export function buildToolsReference(
  intent: 'create' | 'edit' | 'clone' | 'delete' | 'arrange' | 'full'
): string {
  const sections: string[] = ['═══ OPERAÇÕES DISPONÍVEIS ═══'];

  const creation = FIGMA_TOOLS.filter((t) => t.category === 'CREATION');
  const edits = FIGMA_TOOLS.filter((t) => t.category === 'EDIT');
  const structure = FIGMA_TOOLS.filter((t) => t.category === 'STRUCTURE');
  const advanced = FIGMA_TOOLS.filter((t) => t.category === 'ADVANCED');

  const needsCreate = intent === 'create' || intent === 'clone' || intent === 'full';
  const needsEdit = intent === 'edit' || intent === 'arrange' || intent === 'full';
  const needsStructure = intent === 'delete' || intent === 'arrange' || intent === 'full';

  if (needsCreate && creation.length) {
    sections.push('CRIAÇÃO:\n' + creation.map(formatToolCompact).join('\n'));
  }

  if (needsEdit && edits.length) {
    sections.push('EDIÇÃO:\n' + edits.map(formatToolCompact).join('\n'));
  }

  if (needsStructure && structure.length) {
    sections.push('ESTRUTURA:\n' + structure.map(formatToolCompact).join('\n'));
  }

  // Advanced always included (they're used across intents)
  if (advanced.length) {
    sections.push('AVANÇADAS:\n' + advanced.map(formatToolCompact).join('\n'));
  }

  return sections.join('\n\n');
}
