import { GoogleGenAI } from '@google/genai';
import type { ImagenModelId } from '../../src/constants/imagenModels.js';

let ai: GoogleGenAI | null = null;
let currentApiKey: string | null = null;

function getAI(apiKey?: string): GoogleGenAI {
  if (apiKey && apiKey.trim().length > 0) {
    return new GoogleGenAI({ apiKey: apiKey.trim() });
  }

  const key = (
    process.env.VITE_GEMINI_API_KEY ||
    process.env.VITE_API_KEY ||
    process.env.GEMINI_API_KEY ||
    ''
  ).trim();

  if (!ai || currentApiKey !== key) {
    if (!key || key === 'undefined' || key.length === 0) {
      throw new Error('GEMINI_API_KEY not configured for Imagen generation');
    }
    currentApiKey = key;
    ai = new GoogleGenAI({ apiKey: key });
  }
  return ai;
}

export interface ImagenGenerateOptions {
  prompt: string;
  model: ImagenModelId;
  aspectRatio?: string;
  apiKey?: string;
}

export interface ImagenResult {
  base64: string;
  mimeType: string;
}

export async function generateImagenImage(opts: ImagenGenerateOptions): Promise<ImagenResult> {
  const { prompt, model, aspectRatio = '1:1', apiKey } = opts;

  const client = getAI(apiKey);

  const response = await client.models.generateImages({
    model,
    prompt,
    config: {
      numberOfImages: 1,
      aspectRatio: aspectRatio as any,
    },
  });

  if (!response.generatedImages?.length) {
    throw new Error('Imagen returned no images');
  }

  const img = response.generatedImages[0];
  const base64 = img.image?.imageBytes;
  if (!base64) {
    throw new Error('Imagen returned empty image data');
  }

  return {
    base64: typeof base64 === 'string' ? base64 : Buffer.from(base64).toString('base64'),
    mimeType: 'image/png',
  };
}
