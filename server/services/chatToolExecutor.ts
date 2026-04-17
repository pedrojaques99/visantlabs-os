import { searchWeb } from './webSearch.js';

// Tool definitions in Gemini FunctionDeclaration format
export const CHAT_TOOLS = {
  functionDeclarations: [
    {
      name: 'web_search',
      description:
        'Search the web for current information, news, trends, brand references, and data. Use this tool when you need up-to-date information or to verify current facts.',
      parameters: {
        type: 'OBJECT',
        properties: {
          query: {
            type: 'STRING',
            description: 'The search query to execute',
          },
        },
        required: ['query'],
      },
    },
  ],
};

export async function executeToolCall(name: string, args: any): Promise<string> {
  try {
    switch (name) {
      case 'web_search': {
        const results = await searchWeb(args.query, 5);
        if (results.length === 0) {
          return JSON.stringify({ error: 'No results found' });
        }
        return JSON.stringify(results);
      }
      default:
        return JSON.stringify({ error: `Unknown tool: ${name}` });
    }
  } catch (error: any) {
    console.error(`[ChatToolExecutor] Error executing ${name}:`, error);
    return JSON.stringify({ error: error.message });
  }
}
