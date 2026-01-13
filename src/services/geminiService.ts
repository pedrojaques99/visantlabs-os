import { GoogleGenAI, Modality, Type } from "@google/genai";
import type { UploadedImage, AspectRatio, DesignType, GeminiModel, Resolution } from '../types/types.js';
import { buildGeminiPromptInstructionsTemplate } from '@/utils/mockupPromptFormat.js';
import {
  AVAILABLE_TAGS,
  AVAILABLE_BRANDING_TAGS,
  AVAILABLE_LOCATION_TAGS,
  AVAILABLE_ANGLE_TAGS,
  AVAILABLE_LIGHTING_TAGS,
  AVAILABLE_EFFECT_TAGS,
  AVAILABLE_MATERIAL_TAGS
} from '@/utils/mockupConstants.js';

// Lazy initialization to avoid breaking app startup if API key is not configured
let ai: GoogleGenAI | null = null;
let currentApiKey: string | null = null;
let withRetryCallCount = 0;

const getAI = (apiKey?: string): GoogleGenAI => {
  // If a specific API key is provided, use it (for user's own API key)
  if (apiKey && apiKey.trim().length > 0) {
    // Return a new instance with the provided key
    return new GoogleGenAI({ apiKey: apiKey.trim() });
  }

  // Helper to safely get env vars in both Node.js and Vite environments
  const getEnvVar = (key: string): string | undefined => {
    // Try process.env (Node.js/Server)
    if (typeof process !== 'undefined' && process.env && process.env[key]) {
      return process.env[key];
    }
    // Try import.meta.env (Vite/Client)
    try {
      // @ts-ignore - import.meta.env is Vite specific
      if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
        // @ts-ignore
        return import.meta.env[key];
      }
    } catch (e) {
      // Ignore errors accessing import.meta
    }
    return undefined;
  };

  const storedKey = getEnvVar('VITE_GEMINI_API_KEY') || getEnvVar('VITE_API_KEY') || getEnvVar('GEMINI_API_KEY') || '';
  const currentKey = storedKey.trim();

  // Otherwise use cached instance or create from environment
  if (!ai || currentApiKey !== currentKey) {

    // Debug apenas no navegador (sem expor partes da chave)
    if (typeof window !== 'undefined') {
      const hasKey = currentKey && currentKey !== 'undefined' && currentKey.length > 0;
      if (hasKey) {
        // Verificar se é um placeholder
        const isPlaceholder = currentKey.toLowerCase().includes('placeholder') ||
          currentKey.toLowerCase().includes('example') ||
          currentKey.toLowerCase().includes('your-');

        if (isPlaceholder) {
          console.error('❌ API Key é um PLACEHOLDER!');
          console.error('⚠️  Você precisa substituir por uma chave real do Google Gemini');
          console.error('   Acesse: https://aistudio.google.com/app/apikey');
        }
        // SECURITY: Don't log any part of the API key
      } else {
        console.warn('⚠️  GEMINI_API_KEY não encontrada. Funcionalidades de IA estarão desabilitadas.');
        console.warn('   Configure GEMINI_API_KEY no .env para habilitar geração de imagens com IA.');
      }
    }

    if (!currentKey || currentKey === 'undefined' || currentKey.length === 0) {
      throw new Error(
        "GEMINI_API_KEY não encontrada. " +
        "Configure GEMINI_API_KEY no arquivo .env para usar funcionalidades de IA. " +
        "Veja docs/SETUP_LLM.md para mais informações."
      );
    }

    currentApiKey = currentKey;
    ai = new GoogleGenAI({ apiKey: currentKey });
  }
  return ai;
};

export class RateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RateLimitError';
  }
}

export class ModelOverloadedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ModelOverloadedError';
  }
}

interface RetryOptions {
  maxRetries?: number;
  timeout?: number;
  onRetry?: (attempt: number, maxRetries: number, delay: number) => void;
  model?: GeminiModel | string;
}

const DEFAULT_TIMEOUTS = {
  'gemini-3-pro-image-preview': 300000, // 5 minutes for Gemini 3 Pro
  'gemini-2.5-flash-image': 120000, // 2 minutes for other models
  'gemini-2.5-flash': 120000, // 2 minutes for text models
};

const DEFAULT_RETRIES = {
  'gemini-3-pro-image-preview': 10, // More retries for Gemini 3 Pro
  'gemini-2.5-flash-image': 5, // Fewer retries for other models
  'gemini-2.5-flash': 5, // Fewer retries for text models
};

const withRetry = async <T>(
  apiCall: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> => {
  const {
    maxRetries,
    timeout,
    onRetry,
    model = 'gemini-2.5-flash-image'
  } = options;

  const effectiveMaxRetries = maxRetries ?? DEFAULT_RETRIES[model] ?? 5;
  const effectiveTimeout = timeout ?? DEFAULT_TIMEOUTS[model] ?? 120000;

  let attempt = 0;
  const startTime = Date.now();

  withRetryCallCount++;
  const currentRetryCallCount = withRetryCallCount;

  const createTimeoutPromise = (): Promise<never> => {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Request timeout after ${effectiveTimeout}ms`));
      }, effectiveTimeout);
    });
  };

  while (attempt < effectiveMaxRetries) {
    try {
      // Race between API call and timeout
      const result = await Promise.race([
        apiCall(),
        createTimeoutPromise()
      ]);
      return result;
    } catch (error: any) {
      // Check if timeout occurred
      if (error?.message?.includes('timeout')) {
        throw new Error(`Request timed out after ${Math.round((Date.now() - startTime) / 1000)}s. The model may be experiencing high load. Please try again later.`);
      }

      // Check for rate limit errors (429) - don't retry these
      const statusCode = error?.status ||
        error?.statusCode ||
        error?.response?.status ||
        error?.response?.statusCode ||
        error?.code;

      const errorMessage = error?.message || error?.toString() || '';
      const errorDetails = error?.error?.message || '';
      const errorResponse = error?.response?.data || error?.response || {};
      const errorString = JSON.stringify(errorResponse).toLowerCase();

      // Check for 429 in multiple places
      const isRateLimit = statusCode === 429 ||
        errorMessage.includes('429') ||
        errorMessage.toLowerCase().includes('too many requests') ||
        errorDetails.includes('429') ||
        errorDetails.toLowerCase().includes('too many requests') ||
        errorString.includes('429') ||
        errorString.includes('too many requests');

      if (isRateLimit) {
        throw new RateLimitError("Rate limit exceeded. Please wait before making more requests.");
      }

      // Check for 503 (Service Unavailable) or "model overloaded" errors
      const is503 = statusCode === 503 ||
        errorMessage.includes('503') ||
        errorMessage.toLowerCase().includes('service unavailable') ||
        errorMessage.toLowerCase().includes('model is overloaded') ||
        errorDetails.toLowerCase().includes('model is overloaded') ||
        errorString.includes('503') ||
        errorString.includes('model is overloaded');

      if (is503) {
        attempt++;


        if (attempt >= effectiveMaxRetries) {
          // After all retries failed, throw ModelOverloadedError with helpful message
          throw new ModelOverloadedError(
            `The model is currently overloaded and unable to process your request after ${effectiveMaxRetries} attempts. ` +
            `This is a temporary issue with the AI service. Please try again in a few minutes. ` +
            `Your credits have not been deducted.`
          );
        }

        // Exponential backoff with jitter: max 120s, min based on attempt
        const baseDelay = Math.min(Math.pow(2, attempt) * 1000, 120000); // Cap at 120s
        const jitter = Math.random() * 0.3 * baseDelay; // Add up to 30% jitter
        const delay = Math.floor(baseDelay + jitter);

        const timeElapsed = Math.round((Date.now() - startTime) / 1000);
        console.warn(
          `API call failed with 503 (Model overloaded), retrying... ` +
          `(Attempt ${attempt}/${effectiveMaxRetries}, waited ${timeElapsed}s so far, next retry in ${Math.round(delay / 1000)}s)`
        );

        // Notify callback if provided (for UI feedback)
        if (onRetry) {
          onRetry(attempt, effectiveMaxRetries, delay);
        }

        await new Promise(res => setTimeout(res, delay));
        continue;
      }

      // For all other errors, throw immediately
      throw error;
    }
  }
  throw new Error("API call failed after multiple retries.");
};


export const generateMockup = async (
  promptText: string,
  baseImage?: UploadedImage,
  model: GeminiModel = 'gemini-2.5-flash-image',
  resolution?: Resolution,
  aspectRatio?: AspectRatio,
  referenceImages?: UploadedImage[],
  onRetry?: (attempt: number, maxRetries: number, delay: number) => void,
  apiKey?: string
): Promise<string> => {
  return withRetry(async () => {
    const parts: any[] = [];

    // Add main base image if provided
    if (baseImage) {
      // Validate base64 is not empty
      if (!baseImage.base64 || baseImage.base64.trim().length === 0) {
        throw new Error('Base image data is empty');
      }
      // Validate mimeType
      if (!baseImage.mimeType || baseImage.mimeType.trim().length === 0) {
        throw new Error('Base image MIME type is missing');
      }
      parts.push({
        inlineData: {
          data: baseImage.base64,
          mimeType: baseImage.mimeType,
        },
      });
    }

    // Add reference images
    // Flash model: up to 1 reference image (total 2 images)
    // Pro model: up to 3 reference images (total 4 images)
    if (referenceImages && referenceImages.length > 0) {
      const maxReferenceImages = model === 'gemini-3-pro-image-preview' ? 3 : 1;
      const imagesToAdd = referenceImages.slice(0, maxReferenceImages);

      imagesToAdd.forEach((img) => {
        parts.push({
          inlineData: {
            data: img.base64,
            mimeType: img.mimeType,
          },
        });
      });
    }

    // Validate prompt is not empty
    if (!promptText || promptText.trim().length === 0) {
      throw new Error('Prompt text is required');
    }

    parts.push({ text: promptText });

    const config: any = {
      responseModalities: [Modality.IMAGE],
    };

    // Configure resolution for Gemini 3 Pro
    if (model === 'gemini-3-pro-image-preview' && resolution) {
      // Map resolution to output dimensions
      // According to docs: 1K=1210px, 2K=1210px, 4K=2000px max dimension
      let maxDimension = 1210; // 1K and 2K default
      if (resolution === '4K') {
        maxDimension = 2000;
      }

      // If aspectRatio is provided, calculate dimensions
      if (aspectRatio) {
        const [widthRatio, heightRatio] = aspectRatio.split(':').map(Number);
        const ratio = widthRatio / heightRatio;

        let width: number, height: number;
        if (ratio >= 1) {
          // Landscape or square
          width = maxDimension;
          height = Math.round(maxDimension / ratio);
        } else {
          // Portrait
          height = maxDimension;
          width = Math.round(maxDimension * ratio);
        }

        config.outputImageDimensions = {
          width,
          height,
        };
      } else {
        // Default to square if no aspect ratio
        config.outputImageDimensions = {
          width: maxDimension,
          height: maxDimension,
        };
      }
    }

    const response = await getAI(apiKey).models.generateContent({
      model: model,
      contents: {
        parts: parts,
      },
      config: config,
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return part.inlineData.data;
      }
    }

    throw new Error("No image was generated in the response.");
  }, {
    model,
    onRetry
  });
};


export interface SuggestedCategoriesResult {
  categories: string[];
  inputTokens?: number;
  outputTokens?: number;
}

export const suggestCategories = async (
  baseImage: UploadedImage,
  brandingTags: string[],
  apiKey?: string
): Promise<SuggestedCategoriesResult> => {
  return withRetry(async () => {
    const prompt = `Analyze the provided image and the branding style: ${brandingTags.join(', ')}. 
    Based on this, suggest a list of 5 to 10 highly relevant professional mockup categories where this design would look best.
    Return ONLY a comma-separated list of suggested categories (e.g., T-Shirt, Mug, Poster, Business Card). Do not include any other text or explanation.`;

    const response = await getAI(apiKey).models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          {
            inlineData: {
              data: baseImage.base64,
              mimeType: baseImage.mimeType,
            },
          },
          {
            text: prompt,
          },
        ],
      },
    });

    const suggestionsText = response.text.trim();

    // Extract usage metadata
    const usageMetadata = (response as any).usageMetadata;
    const inputTokens = usageMetadata?.promptTokenCount;
    const outputTokens = usageMetadata?.candidatesTokenCount;

    if (!suggestionsText) {
      return { categories: [], inputTokens, outputTokens };
    }

    // Clean up response: remove potential markdown/quotes and split
    const categories = suggestionsText
      .replace(/['"`]/g, '')
      .split(',')
      .map(tag => tag.trim())
      .filter(tag => tag.length > 0);

    return { categories, inputTokens, outputTokens };
  }, {
    model: 'gemini-2.5-flash'
  });
};

export interface MockupSetupAnalysis {
  branding: string[];
  categories: string[];
  locations: string[];
  angles: string[];
  lighting: string[];
  effects: string[];
  materials: string[];
  designType: 'logo' | 'layout';
  inputTokens?: number;
  outputTokens?: number;
}

export const analyzeMockupSetup = async (
  baseImage: UploadedImage,
  apiKey?: string
): Promise<MockupSetupAnalysis> => {
  return withRetry(async () => {
    const prompt = `Analyze the provided design image. Based on its visual elements, style, colors, and concept, suggest the most professional and aesthetically pleasing mockup settings.
    
    Choose suggestions from these available options if they fit, or suggest similar professional terms:
    - Branding Styles: ${AVAILABLE_BRANDING_TAGS.join(', ')}
    - Mockup Categories: ${AVAILABLE_TAGS.join(', ')}
    - Locations/Environments: ${AVAILABLE_LOCATION_TAGS.join(', ')}
    - Camera Angles: ${AVAILABLE_ANGLE_TAGS.join(', ')}
    - Lighting Styles: ${AVAILABLE_LIGHTING_TAGS.join(', ')}
    - Special Effects: ${AVAILABLE_EFFECT_TAGS.join(', ')}
    - Materials/Textures: ${AVAILABLE_MATERIAL_TAGS.join(', ')}

    Analyze the "vibe" and "concept" of the uploaded design to provide these suggestions.
    Return the response as a JSON object with the following structure:
    {
      "branding": ["tag1", "tag2", "tag3"], // 2-3 tags
      "categories": ["cat1", "cat2", "cat3"], // 5-10 categories
      "locations": ["loc1", "loc2"], // 1-2 locations
      "angles": ["angle1", "angle2"], // 1-2 angles
      "lighting": ["light1", "light2"], // 1-2 lighting styles
      "effects": ["effect1", "effect2"], // 1-2 effects
      "materials": ["mat1", "mat2"], // 1-2 materials
      "designType": "logo" // or "layout" - decide based on whether it's a standalone icon/logo or a full layout/composition
    }`;

    const response = await getAI(apiKey).models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          {
            inlineData: {
              data: baseImage.base64,
              mimeType: baseImage.mimeType,
            },
          },
          {
            text: prompt,
          },
        ],
      },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            branding: { type: Type.ARRAY, items: { type: Type.STRING } },
            categories: { type: Type.ARRAY, items: { type: Type.STRING } },
            locations: { type: Type.ARRAY, items: { type: Type.STRING } },
            angles: { type: Type.ARRAY, items: { type: Type.STRING } },
            lighting: { type: Type.ARRAY, items: { type: Type.STRING } },
            effects: { type: Type.ARRAY, items: { type: Type.STRING } },
            materials: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
          required: ["branding", "categories", "locations", "angles", "lighting", "effects", "materials"],
        },
      },
    });

    const jsonString = response.text.trim();

    // Extract usage metadata
    const usageMetadata = (response as any).usageMetadata;
    const inputTokens = usageMetadata?.promptTokenCount;
    const outputTokens = usageMetadata?.candidatesTokenCount;

    if (!jsonString) {
      return {
        branding: [],
        categories: [],
        locations: [],
        angles: [],
        lighting: [],
        effects: [],
        materials: [],
        designType: 'logo',
        inputTokens,
        outputTokens
      };
    }

    try {
      const result = JSON.parse(jsonString);
      return {
        ...result,
        inputTokens,
        outputTokens
      };
    } catch (e) {
      console.error("Failed to parse mockup setup analysis JSON:", e);
      return {
        branding: [],
        categories: [],
        locations: [],
        angles: [],
        lighting: [],
        effects: [],
        materials: [],
        designType: 'logo',
        inputTokens,
        outputTokens
      };
    }
  }, {
    model: 'gemini-2.5-flash'
  });
};

interface SmartPromptParams {
  baseImage: UploadedImage | null;
  designType: DesignType;
  brandingTags: string[];
  categoryTags: string[];
  locationTags: string[];
  angleTags: string[];
  lightingTags: string[];
  effectTags: string[];
  selectedColors: string[];
  aspectRatio: AspectRatio;
  generateText: boolean;
  withHuman: boolean;
  enhanceTexture: boolean;
  negativePrompt: string;
  additionalPrompt: string;
}

interface SmartPromptResult {
  prompt: string;
  inputTokens?: number;
  outputTokens?: number;
}

export const generateSmartPrompt = async (params: SmartPromptParams, apiKey?: string): Promise<SmartPromptResult> => {
  return withRetry(async () => {
    const isBlankMockup = params.designType === 'blank';

    // Use shared function to build instructions template
    const instructionsTemplate = buildGeminiPromptInstructionsTemplate({
      designType: params.designType,
      isBlankMockup,
      withHuman: params.withHuman,
      enhanceTexture: params.enhanceTexture,
      locationTags: params.locationTags,
    });

    // Replace placeholders with actual values
    const promptToGemini = instructionsTemplate
      .replace('[BRANDING_TAGS]', params.brandingTags.join(', ') || 'Not specified')
      .replace('[CATEGORY_TAGS]', params.categoryTags.join(', '))
      .replace('[COLORS]', params.selectedColors.join(', ') || 'Not specified')
      .replace('[LOCATION_TAGS]', params.locationTags.join(', ') || 'Not specified')
      .replace('[ANGLE_TAGS]', params.angleTags.join(', ') || 'Not specified')
      .replace('[LIGHTING_TAGS]', params.lightingTags.join(', ') || 'Not specified')
      .replace('[EFFECT_TAGS]', params.effectTags.join(', ') || 'Not specified')
      .replace('[GENERATE_TEXT]', isBlankMockup ? 'No (Blank Mockup)' : (params.generateText ? 'Yes' : 'No'))
      .replace('[WITH_HUMAN]', params.withHuman ? 'Yes' : 'No')
      .replace('[ADDITIONAL_PROMPT]', params.additionalPrompt || 'Not specified')
      .replace('[ASPECT_RATIO]', params.aspectRatio)
      .replace('[NEGATIVE_PROMPT]', params.negativePrompt || 'Not specified');

    const parts = [];
    if (!isBlankMockup && params.baseImage) {
      parts.push({
        inlineData: {
          data: params.baseImage.base64,
          mimeType: params.baseImage.mimeType,
        },
      });
    }
    parts.push({ text: promptToGemini });

    const response = await getAI(apiKey).models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { parts },
    });

    // Extract usage metadata if available
    const usageMetadata = (response as any).usageMetadata;
    const inputTokens = usageMetadata?.promptTokenCount;
    const outputTokens = usageMetadata?.candidatesTokenCount;

    const prompt = response.text.trim();

    // Return object with prompt and tokens for tracking
    return {
      prompt,
      inputTokens,
      outputTokens,
    };
  }, {
    model: 'gemini-2.5-flash'
  });
};

export const generateMergePrompt = async (images: UploadedImage[]): Promise<string> => {
  return withRetry(async () => {
    if (images.length < 2) {
      throw new Error('At least 2 images are required to generate a merge prompt');
    }

    const promptToGemini = `You are an expert AI prompt engineer. Your task is to analyze the provided images and generate a clear, effective prompt for merging/combining them into a single cohesive image.

**INSTRUCTIONS:**
1. Analyze each image provided (there are ${images.length} images total).
2. Identify the key subjects, elements, colors, styles, and themes in each image.
3. Generate a concise, descriptive prompt that explains how to combine these images into one cohesive composition.
4. The prompt should describe:
   - What elements from each image should be included
   - How they should be arranged or combined
   - The overall style, mood, or atmosphere of the merged result
   - Any important details about the composition
5. Keep the prompt clear, direct, and focused on the visual combination.
6. Write in a way that would guide an AI image generator to create the merged result.

**Your output must be ONLY the generated prompt text, without any additional explanation or formatting.**`;

    const parts: any[] = [];

    // Add all images
    images.forEach((img) => {
      parts.push({
        inlineData: {
          data: img.base64,
          mimeType: img.mimeType,
        },
      });
    });

    parts.push({ text: promptToGemini });

    const response = await getAI().models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { parts },
    });

    return response.text.trim();
  }, {
    model: 'gemini-2.5-flash'
  });
};

export const improvePrompt = async (basePrompt: string, apiKey?: string): Promise<string> => {
  return withRetry(async () => {
    if (!basePrompt || basePrompt.trim().length === 0) {
      throw new Error('O prompt não pode estar vazio');
    }

    const promptToGemini = `Melhore este prompt de texto de forma objetiva e concisa. Enriqueça apenas onde necessário, sem redundância ou decoração desnecessária. Mantenha o tom e estilo original.

Original: "${basePrompt}"

Regras:
- Adicione apenas detalhes essenciais que clarifiquem ou melhorem o significado
- Remova redundância e palavras desnecessárias
- Mantenha a voz e intenção originais
- Seja direto e preciso
- Sem linguagem decorativa ou firula

Retorne APENAS o texto melhorado, sem explicações.`;

    const response = await getAI(apiKey).models.generateContent({
      model: 'gemini-2.5-flash',
      contents: promptToGemini,
    });

    const improvedPrompt = response.text.trim();
    if (!improvedPrompt) {
      throw new Error('Nenhum prompt melhorado foi gerado na resposta.');
    }

    return improvedPrompt;
  }, {
    model: 'gemini-2.5-flash'
  });
};

export const suggestPromptVariations = async (basePrompt: string, apiKey?: string): Promise<string[]> => {
  return withRetry(async () => {
    const promptToGemini = `Você é um engenheiro de prompts especializado. Sua tarefa é criar três variações diversas, criativas e eficazes de um prompt para gerador de imagens IA.

    **Prompt Base:**
    "${basePrompt}"

    **Instruções:**
    1. Analise o assunto principal e a intenção do prompt base.
    2. Gere três variações distintas. Cada uma deve explorar uma direção criativa diferente (ex: mudar o humor, cenário, ângulo da câmera, estilo, ou adicionar detalhes evocativos específicos).
    3. Mantenha o assunto principal intacto.
    4. As variações devem ser concisas e prontas para uso direto como prompts.
    5. Retorne as variações como um objeto JSON com uma única chave "suggestions" que é um array de strings. Exemplo: {"suggestions": ["variação 1", "variação 2", "variação 3"]}.

    Sua saída deve ser APENAS o objeto JSON.`;

    const response = await getAI(apiKey).models.generateContent({
      model: 'gemini-2.5-flash',
      contents: promptToGemini,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            suggestions: {
              type: Type.ARRAY,
              items: {
                type: Type.STRING,
              },
            },
          },
        },
      },
    });

    const jsonString = response.text.trim();
    if (!jsonString) return [];

    try {
      const result = JSON.parse(jsonString);
      return result.suggestions || [];
    } catch (e) {
      console.error("Failed to parse prompt suggestions JSON:", e);
      return [];
    }
  }, {
    model: 'gemini-2.5-flash'
  });
};

export const changeObjectInMockup = async (
  baseImage: UploadedImage,
  newObject: string,
  model: GeminiModel = 'gemini-2.5-flash-image',
  resolution?: Resolution,
  onRetry?: (attempt: number, maxRetries: number, delay: number) => void,
  apiKey?: string
): Promise<string> => {
  return withRetry(async () => {
    const prompt = `Keep the same background, environment, lighting, and camera angle, but replace the main object in the image with ${newObject}. The new object should be placed in the same position and orientation as the original object, maintaining the same perspective and composition. The environment, background, and all other elements should remain exactly the same.`;

    const parts: any[] = [
      {
        inlineData: {
          data: baseImage.base64,
          mimeType: baseImage.mimeType,
        },
      },
      { text: prompt },
    ];

    const config: any = {
      responseModalities: [Modality.IMAGE],
    };

    // Configure resolution for Gemini 3 Pro
    if (model === 'gemini-3-pro-image-preview' && resolution) {
      const maxDimension = resolution === '4K' ? 2000 : 1210;
      config.outputImageDimensions = {
        width: maxDimension,
        height: maxDimension,
      };
    }

    const response = await getAI().models.generateContent({
      model: model,
      contents: {
        parts: parts,
      },
      config: config,
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return part.inlineData.data;
      }
    }

    throw new Error("No image was generated in the response.");
  }, {
    model,
    onRetry
  });
};

export const applyThemeToMockup = async (
  baseImage: UploadedImage,
  themes: string[],
  model: GeminiModel = 'gemini-2.5-flash-image',
  resolution?: Resolution,
  onRetry?: (attempt: number, maxRetries: number, delay: number) => void,
  apiKey?: string
): Promise<string> => {
  return withRetry(async () => {
    const themesText = themes.join(', ');
    const prompt = `Apply ${themesText} theme to the scene while keeping the same composition, camera angle, and main object. Transform the background, lighting, colors, and environmental elements to reflect the ${themesText} theme, but maintain the exact same perspective, object placement, and overall structure of the original image.`;

    const parts: any[] = [
      {
        inlineData: {
          data: baseImage.base64,
          mimeType: baseImage.mimeType,
        },
      },
      { text: prompt },
    ];

    const config: any = {
      responseModalities: [Modality.IMAGE],
    };

    // Configure resolution for Gemini 3 Pro
    if (model === 'gemini-3-pro-image-preview' && resolution) {
      const maxDimension = resolution === '4K' ? 2000 : 1210;
      config.outputImageDimensions = {
        width: maxDimension,
        height: maxDimension,
      };
    }

    const response = await getAI().models.generateContent({
      model: model,
      contents: {
        parts: parts,
      },
      config: config,
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return part.inlineData.data;
      }
    }

    throw new Error("No image was generated in the response.");
  }, {
    model,
    onRetry
  });
};

export const describeImage = async (
  image: UploadedImage | string,
  apiKey?: string
): Promise<string> => {
  return withRetry(async () => {
    // Normalize image input
    let imageBase64: string;
    let mimeType: string;

    if (typeof image === 'string') {
      // If it's a base64 string, try to extract mimeType from data URL or default to png
      if (image.startsWith('data:')) {
        const match = image.match(/data:([^;]+);base64,(.+)/);
        if (match) {
          mimeType = match[1];
          imageBase64 = match[2];
        } else {
          imageBase64 = image;
          mimeType = 'image/png';
        }
      } else {
        imageBase64 = image;
        mimeType = 'image/png';
      }
    } else {
      imageBase64 = image.base64;
      mimeType = image.mimeType;
    }

    const prompt = `Analyze this image and provide a clear, objective visual description suitable for use in AI image generation prompts. 

Focus on:
- Composition and layout
- Main subjects and objects
- Colors and color palette
- Style and aesthetic
- Lighting conditions
- Key visual elements and details
- Overall mood or atmosphere

Be concise, objective, and descriptive. The description should be ready to use as a prompt for generating similar images.`;

    const parts: any[] = [
      {
        inlineData: {
          data: imageBase64,
          mimeType: mimeType,
        },
      },
      { text: prompt },
    ];

    const response = await getAI(apiKey).models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { parts },
    });

    const description = response.text.trim();
    if (!description) {
      throw new Error('No description was generated in the response.');
    }

    return description;
  }, {
    model: 'gemini-2.5-flash'
  });
};