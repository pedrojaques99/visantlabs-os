// AI Provider abstraction for multi-model support (Claude + Gemini)

import type { FigmaOperation } from '../../../src/lib/figma-types';

export interface AIGenerationOptions {
  temperature?: number;
  maxTokens?: number;
  apiKey?: string; // Per-request BYOK key override
  attachments?: Array<{ name: string; mimeType: string; data: string }>; // Base64 data
  onStatus?: (message: string) => void; // Agent status callback (e.g. "Pesquisando...")
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface AIGenerationResult {
  operations: FigmaOperation[];
  usage?: TokenUsage;
}

export interface AIProvider {
  name: 'claude' | 'gemini';
  generateOperations(
    systemPrompt: string,
    userPrompt: string,
    options?: AIGenerationOptions
  ): Promise<AIGenerationResult>;
}

