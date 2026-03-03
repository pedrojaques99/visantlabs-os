// AI Provider abstraction for multi-model support (Claude + Gemini)

import type { FigmaOperation } from '../../../src/lib/figma-types';

export interface AIProvider {
  name: 'claude' | 'gemini';
  generateOperations(
    systemPrompt: string,
    userPrompt: string,
    options?: { temperature?: number; maxTokens?: number }
  ): Promise<FigmaOperation[]>;
}

export interface AIGenerationOptions {
  temperature?: number;
  maxTokens?: number;
}
