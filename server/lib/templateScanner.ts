/**
 * Template Scanner
 * Scans Figma file for frames with [Template] prefix
 */

import { pluginBridge } from './pluginBridge.js';

export interface TemplateSpec {
  id: string;
  name: string;
  width: number;
  height: number;
  childCount: number;
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
    '## AVAILABLE TEMPLATES',
    'The following templates are available in this Figma file (frames named [Template] ...):',
    '',
  ];

  for (const t of templates) {
    lines.push(`- **${t.name}** (${t.width}x${t.height}, ${t.childCount} layers)`);
  }

  lines.push('');
  lines.push('When a template matches the request, reference its structure and style.');
  lines.push('Otherwise, create from scratch using brand guidelines.');

  return lines.join('\n');
}
