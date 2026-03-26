/**
 * AI System Prompt Generator from Tool Registry
 */

import { FIGMA_TOOLS, FigmaTool } from './registry.js';

/**
 * Generates a formatted string for the system prompt
 */
export function generateSystemPrompt(tools: FigmaTool[] = FIGMA_TOOLS): string {
  let prompt = '\n═══ OPERAÇÕES DISPONÍVEIS (AUTO-GENERATED) ═══\n\n';

  // Categorize tools
  const creation = tools.filter(t => t.category === 'CREATION');
  const edits = tools.filter(t => t.category === 'EDIT');
  const advanced = tools.filter(t => t.category === 'ADVANCED');
  const structure = tools.filter(t => t.category === 'STRUCTURE');

  const formatTool = (t: FigmaTool, index: number) => {
    const props = t.schema.properties.props?.properties;
    const requiredProps = t.schema.properties.props?.required || [];

    const jsonFormat = JSON.stringify(t.example, null, 2);
    
    return `${index}. ${t.name} — ${t.description}\n${jsonFormat}\n`;
  };

  let globalIndex = 0;

  if (creation.length > 0) {
    prompt += '── CRIAÇÃO ──\n';
    creation.forEach(t => { prompt += formatTool(t, ++globalIndex); });
    prompt += '\n';
  }

  if (edits.length > 0) {
    prompt += '── EDIÇÃO ──\n';
    edits.forEach(t => { prompt += formatTool(t, ++globalIndex); });
    prompt += '\n';
  }

  if (advanced.length > 0) {
    prompt += '── AVANÇADAS & VETORES ──\n';
    advanced.forEach(t => { prompt += formatTool(t, ++globalIndex); });
    prompt += '\n';
  }

  if (structure.length > 0) {
    prompt += '── ESTRUTURA ──\n';
    structure.forEach(t => { prompt += formatTool(t, ++globalIndex); });
    prompt += '\n';
  }

  return prompt;
}
