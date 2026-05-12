/**
 * Figma Agent Prompt — Bridge Module
 *
 * Maps PluginRequest to the modular prompt assembler.
 * Single pipeline, no V1/V2 split.
 */

import {
  assemblePrompt,
  buildRetryFeedback,
  refineIntentWithLLM,
  type AssembledPrompt,
  type ClassifiedIntent,
  type EnrichedIntent,
} from './prompt/index.js';

export { assemblePrompt, buildRetryFeedback, refineIntentWithLLM, type AssembledPrompt, type ClassifiedIntent, type EnrichedIntent };

// ============ Interfaces ============

export interface PluginRequest {
  command: string;
  sessionId?: string;
  selectedElements: any[];
  scanPage?: boolean;
  selectedLogo?: { id: string; name: string; key?: string };
  brandLogos?: {
    light?: { id: string; name: string; key?: string } | null;
    dark?: { id: string; name: string; key?: string } | null;
    accent?: { id: string; name: string; key?: string } | null;
  };
  selectedBrandFont?: { id: string; name: string };
  brandFonts?: {
    primary?: { id: string; name: string; family?: string; style?: string; availableStyles?: string[] } | null;
    secondary?: { id: string; name: string; family?: string; style?: string; availableStyles?: string[] } | null;
  };
  selectedBrandColors?: Array<{ name: string; value: string; role?: string }>;
  availableComponents?: any[];
  availableColorVariables?: Array<{ id: string; name: string; value?: string }>;
  availableFontVariables?: any[];
  availableLayers?: Array<{ id: string; name: string; type: string }>;
  fileId?: string;
  apiKey?: string;
  anthropicApiKey?: string;
  attachments?: Array<{ name: string; mimeType: string; data: string }>;
  mentions?: Array<{ name: string; type: string; id: string }>;
  designSystem?: DesignSystemJSON | null;
  brandGuideline?: any;
  brandGuidelineId?: string;
  thinkMode?: boolean;
  designTokens?: {
    spacing?: Record<string, number>;
    radius?: Record<string, number>;
    shadows?: Record<string, any>;
  };
  selectedUIComponents?: Record<string, { key: string; name: string }>;
  useBrand?: boolean;
  generateImage?: boolean;
}

export interface DesignSystemJSON {
  name?: string;
  version?: string;
  colors?: Record<string, string | { hex?: string; value?: string; usage?: string }>;
  typography?: Record<string, { family: string; style?: string; size?: number; lineHeight?: number }>;
  spacing?: Record<string, number>;
  radius?: Record<string, number>;
  shadows?: Record<string, { x?: number; y?: number; blur?: number; spread?: number; color?: string; opacity?: number }>;
  components?: Record<string, any>;
  guidelines?: { voice?: string; dos?: string[]; donts?: string[]; imagery?: string };
}

/**
 * Build system prompt from PluginRequest.
 * Maps the plugin's data shape to the modular assembler.
 */
export interface RouteContexts {
  chatHistory?: string;
  previousErrors?: string[];
  templateContext?: string;
  agentComponentsContext?: string;
  enforcedTokens?: string;
  brandChoiceContext?: string;
  brandKnowledgeContext?: string;
}

export function buildSystemPrompt(
  req: PluginRequest,
  chatHistoryOrCtx?: string | RouteContexts,
  previousErrors?: string[],
): AssembledPrompt {
  const useBrand = req.useBrand !== false;

  // Support both old (string, string[]) and new (RouteContexts) signatures
  const ctx: RouteContexts = typeof chatHistoryOrCtx === 'object' && chatHistoryOrCtx !== null
    ? chatHistoryOrCtx
    : { chatHistory: chatHistoryOrCtx as string | undefined, previousErrors };

  return assemblePrompt({
    command: req.command,
    selectedElements: req.selectedElements,
    scanPage: req.scanPage,
    brandColors: useBrand ? req.selectedBrandColors : undefined,
    brandFonts: (useBrand && req.brandFonts) ? {
      primary: req.brandFonts.primary ? {
        family: req.brandFonts.primary.family,
        style: req.brandFonts.primary.style,
        availableStyles: req.brandFonts.primary.availableStyles,
      } : undefined,
      secondary: req.brandFonts.secondary ? {
        family: req.brandFonts.secondary.family,
        style: req.brandFonts.secondary.style,
        availableStyles: req.brandFonts.secondary.availableStyles,
      } : undefined,
    } : undefined,
    brandLogos: (useBrand && req.brandLogos) ? {
      light: req.brandLogos.light ?? undefined,
      dark: req.brandLogos.dark ?? undefined,
    } : undefined,
    brandTokens: useBrand ? (req.designTokens || req.brandGuideline?.tokens) : undefined,
    brandVoice: useBrand ? req.brandGuideline?.guidelines?.voice : undefined,
    brandDos: useBrand ? req.brandGuideline?.guidelines?.dos : undefined,
    brandDonts: useBrand ? req.brandGuideline?.guidelines?.donts : undefined,
    availableComponents: req.availableComponents,
    colorVariables: req.availableColorVariables,
    fontVariables: req.availableFontVariables,
    designSystem: req.designSystem ?? undefined,
    attachments: req.attachments?.map(a => ({ name: a.name, mimeType: a.mimeType })),
    chatHistory: ctx.chatHistory,
    thinkMode: req.thinkMode,
    useBrand: req.useBrand,
    previousErrors: ctx.previousErrors,
    templateContext: ctx.templateContext,
    agentComponentsContext: ctx.agentComponentsContext,
    enforcedTokens: ctx.enforcedTokens,
    brandChoiceContext: ctx.brandChoiceContext,
    brandKnowledgeContext: ctx.brandKnowledgeContext,
  });
}

// Backward compat alias
export const buildSystemPromptV2 = buildSystemPrompt;
