// Claude provider for complex reasoning and advanced generation tasks
import Anthropic from '@anthropic-ai/sdk';
import type { FigmaOperation } from '../../../src/lib/figma-types.js';
import type { AIProvider, AIGenerationOptions } from './types.js';

function getClient(apiKey?: string) {
  return new Anthropic({ apiKey: apiKey || process.env.ANTHROPIC_API_KEY });
}

const claudeProvider: AIProvider = {
  name: 'claude',

  async generateOperations(
    systemPrompt: string,
    userPrompt: string,
    options?: AIGenerationOptions
  ): Promise<FigmaOperation[]> {
    try {
      const client = getClient(options?.apiKey);

      // Build multimodal content if attachments exist
      const messageContent: Anthropic.ContentBlockParam[] = [
        { type: 'text', text: userPrompt },
      ];

      if (options?.attachments && options.attachments.length > 0) {
        for (const att of options.attachments) {
          if (att.mimeType.startsWith('image/')) {
            messageContent.push({
              type: 'image',
              source: {
                type: 'base64',
                media_type: att.mimeType as
                  | 'image/jpeg'
                  | 'image/png'
                  | 'image/gif'
                  | 'image/webp',
                data: att.data,
              },
            });
          } else if (att.mimeType === 'application/pdf') {
            messageContent.push({
              type: 'document',
              source: {
                type: 'base64',
                media_type: 'application/pdf',
                data: att.data,
              },
            });
          } else if (att.mimeType === 'text/csv') {
            // For CSV, read as text and include in prompt
            try {
              const csvContent = Buffer.from(att.data, 'base64').toString('utf-8');
              messageContent.push({
                type: 'text',
                text: `\n\n📊 Arquivo CSV: ${att.name}\n\`\`\`csv\n${csvContent}\n\`\`\``,
              });
            } catch (_e) {
              console.warn(`[Claude] Failed to decode CSV ${att.name}`);
            }
          }
        }
      }

      const response = await client.messages.create({
        model: 'claude-opus-4-5',
        max_tokens: options?.maxTokens ?? 8192,
        temperature: options?.temperature ?? 0.2,
        system: systemPrompt,
        messages: [{ role: 'user', content: messageContent }],
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
                  items: { type: 'object' },
                },
              },
              required: ['operations'],
            },
          },
        ],
        tool_choice: { type: 'tool', name: 'apply_figma_operations' },
      });

      const toolUseBlock = response.content.find(
        (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
      );

      if (!toolUseBlock || !toolUseBlock.input) {
        console.log('[Claude] No tool use found in response');
        return [];
      }

      const input = toolUseBlock.input as any;
      return Array.isArray(input.operations) ? input.operations : [];
    } catch (error) {
      console.error('[Claude Provider] Error:', error);
      throw error;
    }
  },
};

export default claudeProvider;
