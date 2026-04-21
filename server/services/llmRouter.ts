import { chatWithAIContext } from './geminiService.js';
import { env } from '../config/env.js';

export type LLMProvider = 'gemini' | 'ollama' | 'openai' | 'anthropic';

export interface LLMOptions {
  provider?: LLMProvider;
  ollamaUrl?: string;
  ollamaModel?: string;
  apiKey?: string;
  model?: string;
  systemInstruction?: string;
  tools?: any;
}

export interface LLMResult {
  text: string;
  toolCalls?: Array<{ name: string; args: any }>;
  inputTokens?: number;
  outputTokens?: number;
}

export async function chatWithLLM(
  query: string,
  context: string,
  history: any[] = [],
  options: LLMOptions = {}
): Promise<LLMResult> {
  const provider = options.provider || env.DEFAULT_LLM_PROVIDER || 'gemini';

  if (provider === 'ollama') {
    try {
      return await chatWithOllama(query, history, options);
    } catch (err) {
      console.warn('[LLMRouter] Ollama failed, falling back to Gemini:', (err as Error).message);
      return chatWithAIContext(query, context, history, options);
    }
  }

  return chatWithAIContext(query, context, history, options);
}

async function chatWithOllama(
  query: string,
  history: any[],
  options: LLMOptions
): Promise<LLMResult> {
  const url = (options.ollamaUrl || env.OLLAMA_BASE_URL || '').replace(/\/+$/, '');
  if (!url) throw new Error('Ollama URL not configured');

  const model = options.ollamaModel || env.OLLAMA_MODEL || 'llama3.1';

  const messages: any[] = [];
  if (options.systemInstruction) {
    messages.push({ role: 'system', content: options.systemInstruction });
  }
  for (const h of history.slice(-20)) {
    const role = h.role === 'model' ? 'assistant' : h.role;
    const content = h.parts?.map((p: any) => p.text).filter(Boolean).join('\n') || '';
    if (content) messages.push({ role, content });
  }
  messages.push({ role: 'user', content: query.substring(0, 4000) });

  const body: any = { model, messages, stream: false };
  if (options.tools) {
    body.tools = normalizeToolsForOllama(options.tools);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120_000);

  let res: Response;
  try {
    res = await fetch(`${url}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Ollama ${res.status}: ${text}`);
  }

  const data: any = await res.json();
  const toolCalls = (data.message?.tool_calls || []).map((tc: any) => ({
    name: tc.function?.name,
    args: tc.function?.arguments || {},
  }));

  return {
    text: data.message?.content || '',
    toolCalls: toolCalls.length ? toolCalls : undefined,
    inputTokens: data.prompt_eval_count,
    outputTokens: data.eval_count,
  };
}

function normalizeToolsForOllama(tools: any): any[] {
  const defs = Array.isArray(tools) ? tools : tools?.functionDeclarations || [];
  return defs.map((t: any) => ({
    type: 'function',
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters || t.parametersJsonSchema || { type: 'object', properties: {} },
    },
  }));
}
