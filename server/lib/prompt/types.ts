/**
 * AI-First Prompt System - Types
 */

export type IntentType = 'create' | 'edit' | 'chat' | 'clone' | 'delete' | 'arrange';

export type FormatType =
  | 'instagram_feed' | 'instagram_stories' | 'instagram_highlight'
  | 'youtube_thumbnail' | 'linkedin_post' | 'facebook_post'
  | 'twitter_post' | 'tiktok' | 'pinterest'
  | 'slide_16_9' | 'slide_4_3'
  | 'unknown';

export type ComplexityLevel = 'simple' | 'medium' | 'complex';

export interface ClassifiedIntent {
  intent: IntentType;
  format: FormatType;
  complexity: ComplexityLevel;
  confidence: number;
  needsDimensions: boolean;
  hasSelection: boolean;
  isTemplate: boolean;
  isChart: boolean;
  keywords: string[];
}

export interface PromptModule {
  id: string;
  content: string;
  priority: number; // Higher = more important, placed earlier
}

export interface AssembledPrompt {
  system: string;
  tokenEstimate: number;
  modules: string[];
  intent: ClassifiedIntent;
}
