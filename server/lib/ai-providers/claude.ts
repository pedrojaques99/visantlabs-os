// Claude provider — agent loop with native web_search_20250305 + apply_figma_operations
import Anthropic from '@anthropic-ai/sdk';
import type { FigmaOperation } from '../../../src/lib/figma-types.js';
import type { AIProvider, AIGenerationOptions, AIGenerationResult } from './types.js';

const MAX_AGENT_ITERATIONS = 5;

function getClient(apiKey?: string) {
  return new Anthropic({ apiKey: apiKey || process.env.ANTHROPIC_API_KEY });
}

/** Build multimodal message content from prompt + attachments */
function buildMessageContent(
  userPrompt: string,
  attachments?: AIGenerationOptions['attachments']
): Anthropic.ContentBlockParam[] {
  const content: Anthropic.ContentBlockParam[] = [{ type: 'text', text: userPrompt }];

  if (!attachments?.length) return content;

  for (const att of attachments) {
    if (att.mimeType.startsWith('image/')) {
      content.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: att.mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
          data: att.data,
        },
      });
    } else if (att.mimeType === 'application/pdf') {
      content.push({
        type: 'document',
        source: { type: 'base64', media_type: 'application/pdf', data: att.data },
      });
    } else if (att.mimeType === 'text/csv') {
      try {
        const csv = Buffer.from(att.data, 'base64').toString('utf-8');
        content.push({ type: 'text', text: `\n\n📊 Arquivo CSV: ${att.name}\n\`\`\`csv\n${csv}\n\`\`\`` });
      } catch {
        console.warn(`[Claude] Failed to decode CSV ${att.name}`);
      }
    }
  }

  return content;
}

const FIGMA_TOOL: Anthropic.Tool = {
  name: 'apply_figma_operations',
  description: 'Applies design operations to the Figma canvas. Call this once you have all the information needed to create or modify the design.',
  input_schema: {
    type: 'object' as const,
    properties: {
      operations: {
        type: 'array',
        description: 'Array of Figma operations to apply',
        items: { type: 'object' },
      },
    },
    required: ['operations'],
  },
};

// web_search_20250305 is a built-in Anthropic server tool — executed on Anthropic's infrastructure,
// no external API key required. Results are returned as web_search_tool_result blocks in the response.
const WEB_SEARCH_TOOL = {
  type: 'web_search_20250305',
  name: 'web_search',
  max_uses: 3,
} as unknown as Anthropic.Tool;

const claudeProvider: AIProvider = {
  name: 'claude',

  async generateOperations(
    systemPrompt: string,
    userPrompt: string,
    options?: AIGenerationOptions
  ): Promise<AIGenerationResult> {
    try {
      const client = getClient(options?.apiKey);
      const messageContent = buildMessageContent(userPrompt, options?.attachments);

      const messages: Anthropic.MessageParam[] = [
        { role: 'user', content: messageContent },
      ];

      const tools: Anthropic.Tool[] = [WEB_SEARCH_TOOL, FIGMA_TOOL];

      let lastUsage: Anthropic.Usage | undefined;

      for (let iter = 0; iter < MAX_AGENT_ITERATIONS; iter++) {
        const response = await client.messages.create({
          model: 'claude-opus-4-5',
          max_tokens: options?.maxTokens ?? 8192,
          temperature: options?.temperature ?? 0.2,
          system: systemPrompt,
          messages,
          tools,
          tool_choice: { type: 'auto' },
        });

        lastUsage = response.usage;

        // Check for apply_figma_operations — this is the final structured output
        const figmaBlock = response.content.find(
          (b): b is Anthropic.ToolUseBlock =>
            b.type === 'tool_use' && (b as Anthropic.ToolUseBlock).name === 'apply_figma_operations'
        );

        if (figmaBlock) {
          const ops = Array.isArray((figmaBlock.input as any).operations)
            ? (figmaBlock.input as any).operations
            : [];
          return {
            operations: ops as FigmaOperation[],
            usage: lastUsage
              ? {
                  inputTokens: lastUsage.input_tokens ?? 0,
                  outputTokens: lastUsage.output_tokens ?? 0,
                  totalTokens: (lastUsage.input_tokens ?? 0) + (lastUsage.output_tokens ?? 0),
                }
              : undefined,
          };
        }

        // No more tool calls — text-only response
        if (response.stop_reason === 'end_turn') break;

        // Claude called web_search (server_tool_use) — results are already in the response content.
        // Notify UI and append the full assistant turn so Claude can continue with search results.
        if (response.stop_reason === 'tool_use') {
          const searchBlock = response.content.find((b: any) => b.type === 'server_tool_use') as any;
          if (searchBlock && options?.onStatus) {
            const query: string = searchBlock.input?.query ?? '';
            options.onStatus(query ? `Pesquisando: "${query}"` : 'Pesquisando referências...');
          }

          // Append assistant message (contains server_tool_use + web_search_tool_result blocks)
          messages.push({ role: 'assistant', content: response.content });

          // Continue loop — Claude's next response will use the search results
          continue;
        }

        break;
      }

      return {
        operations: [],
        usage: lastUsage
          ? {
              inputTokens: lastUsage.input_tokens ?? 0,
              outputTokens: lastUsage.output_tokens ?? 0,
              totalTokens: (lastUsage.input_tokens ?? 0) + (lastUsage.output_tokens ?? 0),
            }
          : undefined,
      };
    } catch (error) {
      console.error('[Claude Provider] Error:', error);
      throw error;
    }
  },
};

export default claudeProvider;
