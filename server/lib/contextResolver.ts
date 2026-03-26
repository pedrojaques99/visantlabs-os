/**
 * Context Resolver
 * Orchestrates gathering all context needed for intelligent layout generation.
 * Combines components, templates, brand guidelines, and design tokens.
 */

import type { AgentComponent, BrandGuideline } from '../../src/lib/figma-types.js';
import type { TemplateSpec } from './templateScanner.js';
import type { TokenRegistry } from './tokenRegistry.js';
import { scanAgentComponents, buildComponentsContext } from './componentScanner.js';
import { scanTemplates, buildTemplateContext } from './templateScanner.js';
import { resolveBrandGuideline } from './brandResolver.js';
import { buildTokenRegistry } from './tokenRegistry.js';
import { buildLayoutCapabilitiesContext } from './layoutEngine.js';

export interface ResolvedContext {
  components: AgentComponent[];
  templates: TemplateSpec[];
  brand: BrandGuideline | null;
  tokens: TokenRegistry;
  strategy: 'has_components' | 'has_templates' | 'create_only';
}

/**
 * Determine the generation strategy based on available assets.
 */
function determineStrategy(
  components: AgentComponent[],
  templates: TemplateSpec[]
): ResolvedContext['strategy'] {
  if (components.length > 0) return 'has_components';
  if (templates.length > 0) return 'has_templates';
  return 'create_only';
}

/**
 * Fetch components, templates, and brand guideline in parallel.
 * Uses Promise.allSettled for graceful failures — a broken bridge
 * or missing brand should not prevent the agent from running.
 */
export async function resolveContext(
  fileId: string,
  userId: string,
  explicitBrandId?: string
): Promise<ResolvedContext> {
  const [componentsResult, templatesResult, brandResult] = await Promise.allSettled([
    scanAgentComponents(fileId),
    scanTemplates(fileId),
    resolveBrandGuideline(fileId, userId, explicitBrandId),
  ]);

  const components =
    componentsResult.status === 'fulfilled' ? componentsResult.value : [];

  const templates =
    templatesResult.status === 'fulfilled' ? templatesResult.value : [];

  const brand =
    brandResult.status === 'fulfilled' ? brandResult.value.guideline : null;

  const tokens = buildTokenRegistry(brand);
  const strategy = determineStrategy(components, templates);

  return { components, templates, brand, tokens, strategy };
}

/**
 * Return a strategy hint string for the LLM based on the resolved context.
 */
function getStrategyHint(context: ResolvedContext): string {
  switch (context.strategy) {
    case 'has_components':
      return (
        '**Preferred strategy:** Use `CREATE_COMPONENT_INSTANCE` with agent components. ' +
        'Only fall back to CLONE_NODE or scratch if no component matches the intent.'
      );
    case 'has_templates':
      return (
        '**Preferred strategy:** Clone existing [Template] frames with `CLONE_NODE` + `textOverrides`. ' +
        'Never edit the original template. Fall back to scratch only if no template matches.'
      );
    case 'create_only':
      return (
        '**Preferred strategy:** No components or templates are available. ' +
        'Generate all layouts from scratch using the layout presets below.'
      );
  }
}

/**
 * Build a full system-prompt string from the resolved context.
 * Injects components, templates, layout capabilities, and strategy hint.
 */
export function buildAgentContextPrompt(context: ResolvedContext): string {
  const sections: string[] = [];

  const componentsCtx = buildComponentsContext(context.components);
  if (componentsCtx) sections.push(componentsCtx);

  const templatesCtx = buildTemplateContext(context.templates);
  if (templatesCtx) sections.push(templatesCtx);

  const capabilitiesCtx = buildLayoutCapabilitiesContext();
  if (capabilitiesCtx) sections.push(capabilitiesCtx);

  sections.push('## GENERATION STRATEGY\n' + getStrategyHint(context));

  return sections.join('\n\n');
}
