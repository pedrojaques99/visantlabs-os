/**
 * Template Scanner
 * Scans Figma file for frames with [Template] prefix
 */

import { pluginBridge } from './pluginBridge.js';

export interface TemplateTextLayer {
  id: string;
  name: string;
  characters: string;
  fontFamily?: string;
  fontStyle?: string;
  fontSize?: number;
}

export interface TemplateSpec {
  id: string;
  name: string;
  width: number;
  height: number;
  childCount: number;
  textLayers?: TemplateTextLayer[];
  hasImages?: boolean;
}

/**
 * Scan Figma file for frames with [Template] prefix
 * Returns specs that LLM can use to replicate or reference templates
 */
export async function scanTemplates(fileId: string): Promise<TemplateSpec[]> {
  const templates = await pluginBridge.request<TemplateSpec[]>(fileId, {
    type: 'GET_TEMPLATES',
  });

  return templates || [];
}

/**
 * Build context string for LLM system prompt
 */
export function buildTemplateContext(templates: TemplateSpec[]): string {
  if (templates.length === 0) {
    return [
      '## AVAILABLE TEMPLATES',
      'No templates found in this file. Create designs from scratch.',
      '',
    ].join('\n');
  }

  const lines = [
    '## ⚠️ TEMPLATES — REGRA CRÍTICA',
    '',
    '**Templates são INTOCÁVEIS. NUNCA use SET_TEXT_CONTENT, SET_FILL ou qualquer edição no template original!**',
    '',
    '### Como usar:',
    '```json',
    '{ "type": "CLONE_NODE", "sourceNodeId": "<template-id>",',
    '  "textOverrides": [{ "name": "<nome-do-texto>", "content": "Novo texto" }] }',
    '```',
    '',
    '- `textOverrides` troca textos PELO NOME do layer durante o clone',
    '- Uma única operação: clona + troca texto, sem tocar no original',
    '',
    '### Templates disponíveis:',
    '',
  ];

  for (const t of templates) {
    lines.push(`#### ${t.name}`);
    lines.push(`- ID: \`${t.id}\` | Dimensões: ${t.width}x${t.height}${t.hasImages ? ' | Contém imagens' : ''}`);

    if (t.textLayers && t.textLayers.length > 0) {
      lines.push('- Textos editáveis:');
      for (const text of t.textLayers) {
        const fontInfo = text.fontFamily ? ` (${text.fontFamily} ${text.fontStyle}, ${text.fontSize}px)` : '';
        const preview = text.characters.length > 40 ? text.characters.slice(0, 40) + '...' : text.characters;
        lines.push(`  - \`${text.id}\` "${text.name}": "${preview}"${fontInfo}`);
      }
    }
    lines.push('');
  }

  // Add example with first template if available
  const t = templates[0];
  if (t?.textLayers && t.textLayers.length > 0) {
    const txt = t.textLayers[0];
    lines.push('### Exemplo com este arquivo:');
    lines.push('```json');
    lines.push(`{ "type": "CLONE_NODE", "sourceNodeId": "${t.id}",`);
    lines.push(`  "textOverrides": [{ "name": "${txt.name}", "content": "Seu novo texto aqui" }] }`);
    lines.push('```');
  }

  return lines.join('\n');
}
