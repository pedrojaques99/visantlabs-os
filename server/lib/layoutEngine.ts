// server/lib/layoutEngine.ts
// Decides HOW to create a layout:
//   1. Matching component → CREATE_COMPONENT_INSTANCE
//   2. Matching template  → CLONE_NODE
//   3. Otherwise          → layout preset from scratch

import type { FigmaOperation, LayoutIntent, LayoutResult, AgentComponent } from '../../src/lib/figma-types.js';
import type { TemplateSpec } from './templateScanner.js';
import type { TokenRegistry } from './tokenRegistry.js';
import { matchComponentToIntent } from './componentScanner.js';
import { findPresetForIntent, getFormatDimensions, LAYOUT_PRESETS } from './layoutPresets.js';

// ── Context ──

export interface LayoutContext {
  components: AgentComponent[];
  templates: TemplateSpec[];
  tokens: TokenRegistry;
}

// ── Template matching ──

/**
 * Find the best template match for a given LayoutIntent.
 * Matches by template name against intent type + subtype keywords.
 */
export function matchTemplateToIntent(
  templates: TemplateSpec[],
  intent: LayoutIntent
): TemplateSpec | null {
  if (templates.length === 0) return null;

  const keywords = [intent.type, intent.subtype]
    .filter((v): v is string => Boolean(v))
    .map(v => v.toLowerCase());

  if (keywords.length === 0) return null;

  const scored = templates.map(t => {
    const nameLower = t.name.toLowerCase();
    let score = 0;
    for (const kw of keywords) {
      if (nameLower.includes(kw)) score += 5;
    }
    return { template: t, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.score > 0 ? scored[0].template : null;
}

// ── Text override builder ──

/**
 * Build textOverrides from intent content fields matched to template text layer names.
 * Only includes overrides where a content value is available.
 */
function buildTextOverrides(
  template: TemplateSpec & { textLayers?: Array<{ id: string; name: string; characters: string }> },
  content: LayoutIntent['content']
): Array<{ name: string; content: string }> {
  const overrides: Array<{ name: string; content: string }> = [];

  if (!template.textLayers || template.textLayers.length === 0) return overrides;

  // Map common layer name patterns to content fields
  const fieldMap: Record<string, string | undefined> = {
    title:    content.title,
    headline: content.title,
    heading:  content.title,
    subtitle: content.subtitle,
    subhead:  content.subtitle,
    body:     content.body,
    text:     content.body,
    cta:      content.cta,
    button:   content.cta,
    action:   content.cta,
    discount: content.discount,
    offer:    content.discount,
    badge:    content.discount,
  };

  for (const layer of template.textLayers) {
    const nameLower = layer.name.toLowerCase();
    // Find first matching field key whose value is defined
    const matched = Object.entries(fieldMap).find(([key, val]) =>
      val !== undefined && nameLower.includes(key)
    );
    if (matched) {
      overrides.push({ name: layer.name, content: matched[1] as string });
    }
  }

  return overrides;
}

// ── Main resolver ──

/**
 * Resolve a LayoutIntent into Figma operations using the best available strategy:
 *   1. reuse_component   — CREATE_COMPONENT_INSTANCE from a scanned agent component
 *   2. clone_template    — CLONE_NODE from a scanned [Template] frame
 *   3. create_from_scratch — generate via layout preset
 */
export function resolveLayout(
  intent: LayoutIntent,
  context: LayoutContext,
  parentNodeId?: string
): LayoutResult {
  const intentString = [intent.type, intent.subtype].filter(Boolean).join(' ');

  // 1. Try component match
  const component = matchComponentToIntent(context.components, intentString, intent.format);
  if (component) {
    const op: FigmaOperation = {
      type: 'CREATE_COMPONENT_INSTANCE',
      ref: 'instance',
      componentKey: component.key,
      name: intent.content.title || component.name,
      ...(parentNodeId && { parentNodeId }),
    };

    return {
      operations: [op],
      strategy: 'reuse_component',
      usedAsset: { type: 'component', id: component.id, name: component.name },
    };
  }

  // 2. Try template match
  const template = matchTemplateToIntent(context.templates, intent);
  if (template) {
    const textOverrides = buildTextOverrides(
      template as TemplateSpec & { textLayers?: Array<{ id: string; name: string; characters: string }> },
      intent.content
    );

    const op: FigmaOperation = {
      type: 'CLONE_NODE',
      ref: 'cloned',
      sourceNodeId: template.id,
      ...(parentNodeId && { parentNodeId }),
      overrides: { name: intent.content.title || template.name },
      ...(textOverrides.length > 0 && { textOverrides }),
    };

    return {
      operations: [op],
      strategy: 'clone_template',
      usedAsset: { type: 'template', id: template.id, name: template.name },
    };
  }

  // 3. Fall back to preset (generate from scratch)
  const preset = findPresetForIntent(intentString);
  const format = getFormatDimensions(intent.format);
  const ops = preset.generate(intent.content, intent.format, context.tokens);

  // Attach parentNodeId to the root frame if provided
  if (parentNodeId && ops[0]?.type === 'CREATE_FRAME') {
    (ops[0] as Extract<FigmaOperation, { type: 'CREATE_FRAME' }>).parentNodeId = parentNodeId;
  }

  return { operations: ops, strategy: 'create_from_scratch' };
}

// ── LLM capabilities context ──

/**
 * Build a plain-text context string describing available layout presets.
 * Injected into the LLM system prompt so the agent knows what it can generate.
 */
export function buildLayoutCapabilitiesContext(): string {
  const lines: string[] = [
    '## LAYOUT PRESETS (generate from scratch)',
    'When no component or template matches, use these built-in presets:',
    '',
  ];

  for (const preset of LAYOUT_PRESETS) {
    lines.push(`### ${preset.name}`);
    lines.push(`${preset.description}`);
    lines.push(`Intents: ${preset.intents.join(', ')}`);
    lines.push('');
  }

  lines.push(
    '**Strategy priority:**',
    '1. `reuse_component` — use CREATE_COMPONENT_INSTANCE when an agent component matches',
    '2. `clone_template`  — use CLONE_NODE when a [Template] frame matches',
    '3. `create_from_scratch` — use a preset if no component or template exists',
  );

  return lines.join('\n');
}
