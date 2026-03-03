// Claude provider for complex reasoning and advanced generation tasks
import Anthropic from '@anthropic-ai/sdk';
import type { FigmaOperation } from '../../../src/lib/figma-types';
import type { AIProvider, AIGenerationOptions } from './types';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const claudeProvider: AIProvider = {
  name: 'claude',

  async generateOperations(
    systemPrompt: string,
    userPrompt: string,
    options?: AIGenerationOptions
  ): Promise<FigmaOperation[]> {
    try {
      const response = await client.messages.create({
        model: 'claude-opus-4-6',
        max_tokens: options?.maxTokens ?? 8192,
        temperature: options?.temperature ?? 0.2,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: userPrompt,
          },
        ],
        // Use tool use for structured JSON output
        tools: [
          {
            name: 'apply_figma_operations',
            description: 'Applies design operations to Figma',
            input_schema: {
              type: 'object' as const,
              properties: {
                operations: {
                  type: 'array',
                  description: 'Array of Figma operations',
                  items: {
                    type: 'object',
                  },
                },
              },
              required: ['operations'],
            },
          },
        ],
        tool_choice: { type: 'tool', name: 'apply_figma_operations' },
      });

      // Extract tool use response
      const toolUseBlock = response.content.find(
        (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
      );

      if (!toolUseBlock || !toolUseBlock.input) {
        console.log('[Claude] No tool use found in response');
        return [];
      }

      const input = toolUseBlock.input as any;
      if (Array.isArray(input.operations)) {
        return input.operations;
      }

      return [];
    } catch (error) {
      console.error('[Claude Provider] Error:', error);
      throw error;
    }
  },
};

export default claudeProvider;
