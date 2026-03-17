import { useMemo, useCallback } from 'react';
import { useReactFlow } from '@xyflow/react';
import { useCanvasHeader } from '@/components/canvas/CanvasHeaderContext';
import { getConnectedBrandIdentity } from '@/utils/canvas/canvasNodeUtils';
import { useBrandGuidelines } from '@/hooks/queries/useBrandGuidelines';
import type { BrandIdentity } from '@/types/reactFlow';
import type { BrandGuideline } from '@/lib/figma-types';
import type { Node, Edge } from '@xyflow/react';
import type { FlowNodeData } from '@/types/reactFlow';

// Unified token format that normalizes both BrandIdentity and BrandGuideline
export interface BrandTokens {
  colors: string[];    // hex codes
  fonts: string[];     // font families
  keywords: string[];  // style keywords
  tone: string | null;
  voice: string | null;
  dos: string[];
  donts: string[];
}

// Source of brand data
export type BrandContextSource = 'edge' | 'guideline' | 'none';

// Return type for useBrandContext
export interface BrandContextResult {
  source: BrandContextSource;
  tokens: BrandTokens | null;
  buildPromptEnhancement: (prompt: string) => string;
}

// ── Extractors ────────────────────────────────────────────────────────────────

export function tokensFromBrandIdentity(brand: BrandIdentity): BrandTokens {
  const colors = [
    ...brand.colors.primary,
    ...brand.colors.secondary,
    ...brand.colors.accent,
  ].filter(Boolean);

  const fonts = [
    brand.typography.primary,
    brand.typography.secondary,
  ].filter((f): f is string => Boolean(f));

  const keywords = brand.visualElements ?? [];

  return {
    colors,
    fonts,
    keywords,
    tone: brand.personality.tone ?? null,
    voice: brand.personality.feeling ?? null,
    dos: [],
    donts: [],
  };
}

export function tokensFromGuideline(g: BrandGuideline): BrandTokens {
  const colors = (g.colors ?? []).map((c) => c.hex).filter(Boolean);

  const fonts = (g.typography ?? []).map((t) => t.family).filter(Boolean);

  // Flatten all tag arrays into a single keywords list
  const keywords = Object.values(g.tags ?? {}).flat();

  return {
    colors,
    fonts,
    keywords,
    tone: null,
    voice: g.guidelines?.voice ?? null,
    dos: g.guidelines?.dos ?? [],
    donts: g.guidelines?.donts ?? [],
  };
}

// ── Prompt builder ────────────────────────────────────────────────────────────

const TEXT_KEYWORDS = /\b(text|copy|headline|title|caption|tagline|slogan|body|paragraph)\b/i;

export function buildEnhancement(prompt: string, tokens: BrandTokens): string {
  const parts: string[] = [];

  if (tokens.colors.length > 0) {
    parts.push(`Brand colors: ${tokens.colors.join(', ')}.`);
  }

  if (tokens.fonts.length > 0) {
    parts.push(`Typography: ${tokens.fonts.join(', ')}.`);
  }

  if (tokens.keywords.length > 0) {
    parts.push(`Style: ${tokens.keywords.join(', ')}.`);
  }

  if (TEXT_KEYWORDS.test(prompt)) {
    if (tokens.voice) {
      parts.push(`Voice: ${tokens.voice}.`);
    }
    if (tokens.tone) {
      parts.push(`Tone: ${tokens.tone}.`);
    }
  }

  if (tokens.dos.length > 0) {
    parts.push(`Do: ${tokens.dos.join('; ')}.`);
  }

  if (tokens.donts.length > 0) {
    parts.push(`Avoid: ${tokens.donts.join('; ')}.`);
  }

  if (parts.length === 0) return prompt;

  return `${prompt}\n\n[Brand context]\n${parts.join('\n')}`;
}

// ── Non-hook version (safe for use inside callbacks) ─────────────────────────

export function getBrandContextForNode(
  nodeId: string,
  nodes: Node<FlowNodeData>[],
  edges: Edge[],
  linkedGuideline: BrandGuideline | null | undefined,
): { source: BrandContextSource; tokens: BrandTokens | null } {
  // Priority: edge-connected BrandNode wins
  const brandIdentity = getConnectedBrandIdentity(nodeId, nodes, edges);
  if (brandIdentity) {
    return { source: 'edge', tokens: tokensFromBrandIdentity(brandIdentity) };
  }

  // Fallback to header-linked guideline
  if (linkedGuideline) {
    return { source: 'guideline', tokens: tokensFromGuideline(linkedGuideline) };
  }

  return { source: 'none', tokens: null };
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useBrandContext(nodeId: string): BrandContextResult {
  const { linkedGuidelineId } = useCanvasHeader();
  const { getNodes, getEdges } = useReactFlow();

  // Fetch all guidelines; only enabled when there is a linked ID
  const { data: guidelines = [] } = useBrandGuidelines(Boolean(linkedGuidelineId));

  const linkedGuideline = useMemo(() => {
    if (!linkedGuidelineId) return null;
    return guidelines.find((g) => g.id === linkedGuidelineId) ?? null;
  }, [guidelines, linkedGuidelineId]);

  const { source, tokens } = useMemo(() => {
    const nodes = getNodes() as Node<FlowNodeData>[];
    const edges = getEdges();
    return getBrandContextForNode(nodeId, nodes, edges, linkedGuideline);
  }, [nodeId, getNodes, getEdges, linkedGuideline]);

  const buildPromptEnhancement = useCallback(
    (prompt: string) => {
      if (!tokens) return prompt;
      return buildEnhancement(prompt, tokens);
    },
    [tokens],
  );

  return { source, tokens, buildPromptEnhancement };
}
