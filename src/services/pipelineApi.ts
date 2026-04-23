import { authService } from './authService';

const getApiBaseUrl = () => (import.meta as any).env?.VITE_API_URL || '/api';

const getHeaders = () => {
  const token = authService.getToken();
  return {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
  };
};

export type AssetSource = 'canvas' | 'mockupmachine' | 'extractor' | 'creative';

export interface PipelineAsset {
  id: string;
  userId: string;
  source: AssetSource;
  imageUrl?: string;
  imageBase64?: string;
  mimeType?: string;
  label?: string;
  enqueuedAt: string;
}

export interface SendAssetParams {
  source: AssetSource;
  imageUrl?: string;
  imageBase64?: string;
  mimeType?: string;
  label?: string;
}

export const pipelineApi = {
  async send(params: SendAssetParams): Promise<PipelineAsset> {
    const res = await fetch(`${getApiBaseUrl()}/pipeline/send`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(params),
    });
    if (!res.ok) throw new Error('Pipeline send failed');
    const data = await res.json();
    return data.asset;
  },

  async pending(): Promise<PipelineAsset[]> {
    const res = await fetch(`${getApiBaseUrl()}/pipeline/pending`, {
      headers: getHeaders(),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.assets ?? [];
  },

  async remove(id: string): Promise<void> {
    await fetch(`${getApiBaseUrl()}/pipeline/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
  },

  async clear(): Promise<void> {
    await fetch(`${getApiBaseUrl()}/pipeline`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
  },
};
