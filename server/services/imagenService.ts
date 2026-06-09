import { GoogleGenAI, SubjectReferenceImage, SubjectReferenceType } from '@google/genai';
import type { ImagenModelId } from '../../src/constants/imagenModels.js';

const IMAGEN_EDIT_MODEL = 'imagen-3.0-capability-001';

let ai: GoogleGenAI | null = null;
let currentApiKey: string | null = null;
let editImageSupported: boolean | null = null;

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

export interface ImagenReferenceImage {
  base64: string;
  mimeType: string;
}

export interface ImagenGenerateOptions {
  prompt: string;
  model: ImagenModelId;
  aspectRatio?: string;
  apiKey?: string;
  referenceImages?: ImagenReferenceImage[];
  subjectDescription?: string;
}

export interface ImagenResult {
  base64: string;
  mimeType: string;
}

function extractImageResult(response: any): ImagenResult {
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

export async function generateImagenImage(opts: ImagenGenerateOptions): Promise<ImagenResult> {
  const { prompt, model, aspectRatio = '1:1', apiKey, referenceImages, subjectDescription } = opts;

  const client = getAI(apiKey);

  const hasReferenceImages = referenceImages && referenceImages.length > 0;

  // Try editImage with SubjectReferenceImage if we have reference images
  // editImage requires Vertex AI — falls back to generateImages on Gemini API
  if (hasReferenceImages && editImageSupported !== false) {
    try {
      const subjectRef = new SubjectReferenceImage();
      subjectRef.referenceImage = {
        imageBytes: referenceImages[0].base64,
        mimeType: referenceImages[0].mimeType,
      };
      subjectRef.referenceId = 1;
      subjectRef.config = {
        subjectType: SubjectReferenceType.SUBJECT_TYPE_PRODUCT,
        subjectDescription: subjectDescription || 'brand logo',
      };

      const editPrompt = prompt.includes('[1]')
        ? prompt
        : `Generate an image with the product logo [1] visible. ${prompt}`;

      console.log('[ImagenService] Trying editImage with SubjectReferenceImage', {
        model: IMAGEN_EDIT_MODEL,
        aspectRatio,
        subjectDescription: subjectRef.config.subjectDescription,
      });

      const response = await client.models.editImage({
        model: IMAGEN_EDIT_MODEL,
        prompt: editPrompt,
        referenceImages: [subjectRef],
        config: {
          numberOfImages: 1,
        },
      });

      editImageSupported = true;
      return extractImageResult(response);
    } catch (err: any) {
      const isUnsupported =
        err.message?.includes('Vertex AI') ||
        err.message?.includes('Enterprise Agent Platform') ||
        err.message?.includes('not supported');
      if (isUnsupported) {
        editImageSupported = false;
        console.warn(
          '[ImagenService] editImage not available (requires Vertex AI) — falling back to generateImages'
        );
      } else {
        throw err;
      }
    }
  }

  // Text-to-image generation (reference images embedded in prompt context only)
  if (hasReferenceImages && editImageSupported === false) {
    console.log(
      '[ImagenService] Reference images available but editImage not supported — using prompt-only context'
    );
  }

  const response = await client.models.generateImages({
    model,
    prompt,
    config: {
      numberOfImages: 1,
      aspectRatio: aspectRatio as any,
    },
  });

  return extractImageResult(response);
}
