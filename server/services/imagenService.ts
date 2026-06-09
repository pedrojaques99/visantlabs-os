import { GoogleGenAI, SubjectReferenceImage, SubjectReferenceType } from '@google/genai';
import type { ImagenModelId } from '../../src/constants/imagenModels.js';

const IMAGEN_EDIT_MODEL = 'imagen-3.0-capability-001';

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

export async function generateImagenImage(opts: ImagenGenerateOptions): Promise<ImagenResult> {
  const { prompt, model, aspectRatio = '1:1', apiKey, referenceImages, subjectDescription } = opts;

  const client = getAI(apiKey);

  const hasReferenceImages = referenceImages && referenceImages.length > 0;

  if (hasReferenceImages) {
    // Use editImage with SubjectReferenceImage for brand logo injection
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

    // Ensure prompt references [1] for the subject image
    const editPrompt = prompt.includes('[1]')
      ? prompt
      : `Generate an image with the product logo [1] visible. ${prompt}`;

    console.log('[ImagenService] Using editImage with SubjectReferenceImage', {
      model: IMAGEN_EDIT_MODEL,
      aspectRatio,
      subjectDescription: subjectRef.config.subjectDescription,
      promptLength: editPrompt.length,
    });

    const response = await client.models.editImage({
      model: IMAGEN_EDIT_MODEL,
      prompt: editPrompt,
      referenceImages: [subjectRef],
      config: {
        numberOfImages: 1,
      },
    });

    if (!response.generatedImages?.length) {
      throw new Error('Imagen editImage returned no images');
    }

    const img = response.generatedImages[0];
    const base64 = img.image?.imageBytes;
    if (!base64) {
      throw new Error('Imagen editImage returned empty image data');
    }

    return {
      base64: typeof base64 === 'string' ? base64 : Buffer.from(base64).toString('base64'),
      mimeType: 'image/png',
    };
  }

  // Standard text-to-image generation (no reference images)
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
