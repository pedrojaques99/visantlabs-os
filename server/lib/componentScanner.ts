/**
 * Component Scanner
 * Scans Figma file for [Component] nodes with @agent: metadata
 *
 * Extends templateScanner pattern for component discovery
 */

import { pluginBridge } from './pluginBridge.js';
import type { AgentComponent, AgentComponentMetadata } from '../../src/lib/figma-types.js';

/**
 * Parse @agent: metadata from component description
 * Format: @agent:intent promotional, sale | @agent:slots title, cta
 */
export function parseAgentMetadata(description: string): AgentComponentMetadata {
  const metadata: AgentComponentMetadata = {
    intents: [],
    slots: [],
    formats: [],
    requires: [],
  };

  if (!description) return metadata;

  const lines = description.split('\n');
  for (const line of lines) {
    const match = line.match(/@agent:(\w+)\s+(.+)/);
    if (match) {
      const [, key, values] = match;
      const parsed = values.split(/[,|]/).map(v => v.trim().toLowerCase()).filter(Boolean);

      switch (key) {
        case 'intent':
        case 'intents':
          metadata.intents.push(...parsed);
          break;
        case 'slot':
        case 'slots':
          metadata.slots.push(...parsed);
          break;
        case 'format':
        case 'formats':
          metadata.formats.push(...parsed);
          break;
        case 'require':
        case 'requires':
          metadata.requires.push(...parsed);
          break;
      }
    }
  }

  return metadata;
}

/**
 * Parse component name into category/type
 * "Post/Promotional" → { category: "Posts", type: "Promotional" }
 */
export function parseComponentName(name: string): { category: string; type: string } {
  const clean = name.replace(/^\[Component\]\s*/i, '').trim();
  const parts = clean.split('/');
  if (parts.length >= 2) {
    return {
      category: parts[0].trim(),
      type: parts.slice(1).join('/').trim(),
    };
  }
  return { category: 'Uncategorized', type: clean };
}

/**
 * Scan Figma file for agent components
 */
export async function scanAgentComponents(fileId: string): Promise<AgentComponent[]> {
  const raw = await pluginBridge.request<any[]>(fileId, {
    type: 'GET_AGENT_COMPONENTS',
  });

  if (!raw || !Array.isArray(raw)) return [];

  return raw.map(comp => {
    const { category, type } = parseComponentName(comp.name);
    const metadata = parseAgentMetadata(comp.description || '');

    return {
      id: comp.id,
      key: comp.key,
      name: comp.name.replace(/^\[Component\]\s*/i, '').trim(),
      category,
      type,
      metadata,
      width: comp.width || 0,
      height: comp.height || 0,
      thumbnail: comp.thumbnail,
    };
  });
}

/**
 * Find best component match for an intent
 */
export function matchComponentToIntent(
  components: AgentComponent[],
  intent: string,
  format?: string
): AgentComponent | null {
  const normalizedIntent = intent.toLowerCase();

  const scored = components.map(comp => {
    let score = 0;

    if (comp.metadata.intents.some(i => normalizedIntent.includes(i) || i.includes(normalizedIntent))) {
      score += 10;
    }

    if (comp.type.toLowerCase().includes(normalizedIntent) || normalizedIntent.includes(comp.type.toLowerCase())) {
      score += 5;
    }

    if (format && comp.metadata.formats.includes(format.toLowerCase())) {
      score += 3;
    }

    return { component: comp, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.score > 0 ? scored[0].component : null;
}

/**
 * Build context string for LLM prompt
 */
export function buildComponentsContext(components: AgentComponent[]): string {
  if (components.length === 0) return '';

  const lines = [
    '## AGENT COMPONENTS',
    'Reusable components available. Use CREATE_COMPONENT_INSTANCE with the key.',
    '',
  ];

  const byCategory = new Map<string, AgentComponent[]>();
  for (const comp of components) {
    const list = byCategory.get(comp.category) || [];
    list.push(comp);
    byCategory.set(comp.category, list);
  }

  for (const [category, comps] of byCategory) {
    lines.push(`### ${category}`);
    for (const comp of comps) {
      const intents = comp.metadata.intents.length ? ` [${comp.metadata.intents.join(', ')}]` : '';
      const slots = comp.metadata.slots.length ? ` slots: ${comp.metadata.slots.join(', ')}` : '';
      lines.push(`- **${comp.name}** (key: \`${comp.key}\`)${intents}${slots}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}
