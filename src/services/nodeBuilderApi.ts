import type { NodeBuilderLLMResponse, CustomNodeDefinition } from '@/types/customNode';

const post = async <T>(path: string, body: unknown): Promise<T> => {
  const res = await fetch(`/api/node-builder${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    credentials: 'include',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).error ?? `node-builder ${res.status}`);
  }
  return res.json();
};

export const nodeBuilderApi = {
  generate(
    messages: Array<{ role: 'user' | 'assistant'; content: string }>,
    canvasContext?: string
  ): Promise<NodeBuilderLLMResponse> {
    return post('/generate', { messages, canvasContext });
  },

  getShaderParams(
    description: string
  ): Promise<{ shaderType: string; params: Record<string, unknown> }> {
    return post('/shader-params', { description });
  },

  save(definition: CustomNodeDefinition, isPublic = false): Promise<{ success: boolean }> {
    return post('/save', { definition, isPublic });
  },
};
