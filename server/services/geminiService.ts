import { GoogleGenAI, Modality, Type, Schema } from "@google/genai";
import dotenv from 'dotenv';
 
// Load environment variables
dotenv.config();
dotenv.config({ path: '.env.local' });
 
import type { UploadedImage, AspectRatio, DesignType, GeminiModel, Resolution } from '../../src/types/types.js';
import { GEMINI_MODELS, isAdvancedModel, getMaxRefImages } from '../../src/constants/geminiModels.js';
import type { FigmaOperation, SerializedContext, EnrichedContext } from '../../src/lib/figma-types.js';
import { preprocessPrompt, type LinearIssue } from '../utils/linearParser.js';
import { safeFetch } from '../utils/securityValidation.js';
import { buildGeminiPromptInstructionsTemplate } from '../../src/utils/mockupPromptFormat.js';
import type { AvailableTags } from './tagService.js';
import { distillBrandGuideline, type BrandBrief } from '../lib/mockup/brandDistiller.js';
import { harmonizeTags } from '../lib/mockup/tagHarmonizer.js';
import { exampleRetriever } from '../lib/mockup/exampleRetriever.js';
import type { BrandGuideline } from '../types/brandGuideline.js';
import { randomUUID } from 'crypto';

export const GENERIC_SYSTEM_PROMPT = `Você é um Assistente de IA de alta performance, inteligente, versátil e profissional.
Sua missão é fornecer respostas precisas, criativas e tecnicamente sólidas, adaptando-se instantaneamente ao contexto e à tarefa solicitada.

DIRETRIZES:
1. Analise o contexto profundamente e forneça insights que facilitem a execução e a tomada de decisão.
2. Seja direto, minimalista e focado na solução. Remova qualquer redundância ou ruído.
3. Se houver diretrizes ou contexto fornecido, siga-os com rigor técnico e sensibilidade criativa.
4. Mantenha um tom profissional, assertivo e equilibrado.
5. JAMAIS utilize emojis. Use linguagem clara, objetiva e bem estruturada.
6. Identifique e adapte-se ao idioma do usuário automaticamente, mantendo a consistência linguística em toda a resposta.`;

// Lazy initialization to avoid breaking app startup if API key is not configured
let ai: GoogleGenAI | null = null;
let currentApiKey: string | null = null;
let withRetryCallCount = 0;

const getAI = (apiKey?: string): GoogleGenAI => {
  if (apiKey && apiKey.trim().length > 0) {
    return new GoogleGenAI({ apiKey: apiKey.trim() });
  }

  const currentKey = (process.env.VITE_GEMINI_API_KEY || process.env.VITE_API_KEY || process.env.GEMINI_API_KEY || '').trim();

  if (!ai || currentApiKey !== currentKey) {
    if (!currentKey || currentKey === 'undefined' || currentKey.length === 0) {
      throw new Error(
        "GEMINI_API_KEY não encontrada. " +
        "Configure GEMINI_API_KEY no arquivo .env para usar funcionalidades de IA."
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

const DEFAULT_TIMEOUTS: Record<string, number> = {
  [GEMINI_MODELS.IMAGE_NB2]: 180000,
  [GEMINI_MODELS.IMAGE_PRO]: 300000,
  [GEMINI_MODELS.IMAGE_FLASH]: 120000,
  [GEMINI_MODELS.FLASH_2_5]: 120000,
  [GEMINI_MODELS.PRO_2_0]: 300000,
};

const DEFAULT_RETRIES: Record<string, number> = {
  [GEMINI_MODELS.IMAGE_NB2]: 7,
  [GEMINI_MODELS.IMAGE_PRO]: 10,
  [GEMINI_MODELS.IMAGE_FLASH]: 5,
  [GEMINI_MODELS.FLASH_2_5]: 5,
  [GEMINI_MODELS.PRO_2_0]: 10,
};

// Resolves to base64 only for this request (URL→base64 when needed); no persistent cache.
const resolveImageBase64 = async (image: UploadedImage): Promise<string> => {
  if (image.base64 && image.base64.length > 0) {
    if (process.env.NODE_ENV === 'development') console.log('[dev] resolveImageBase64: using base64, len=', image.base64.length);
    return image.base64;
  }

  if (image.url) {
    if (typeof image.url !== 'string' || !image.url.trim()) throw new Error('Invalid image URL');
    try {
      const t0 = Date.now();
      if (process.env.NODE_ENV === 'development') console.log('[dev] resolveImageBase64: fetch start', image.url);
      const response = await safeFetch(image.url);
      if (!response.ok) throw new Error(`Failed to fetch image: ${response.statusText}`);
      const arrayBuffer = await response.arrayBuffer();
      const b64 = Buffer.from(arrayBuffer).toString('base64');
      if (process.env.NODE_ENV === 'development') console.log('[dev] resolveImageBase64: fetch done', ((Date.now() - t0) / 1000).toFixed(2) + 's');
      return b64;
    } catch (error) {
      console.error('Error resolving image from URL:', error);
      throw new Error('Failed to download image content for AI processing');
    }
  }

  throw new Error('Image has no base64 data or URL');
};

const withRetry = async <T>(
  apiCall: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> => {
  const {
    maxRetries,
    timeout,
    onRetry,
    model = GEMINI_MODELS.IMAGE_FLASH
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
  model: GeminiModel = GEMINI_MODELS.IMAGE_FLASH,
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
      // Validate mimeType
      if (!baseImage.mimeType || baseImage.mimeType.trim().length === 0) {
        throw new Error('Base image MIME type is missing');
      }

      const base64Data = await resolveImageBase64(baseImage);

      parts.push({
        inlineData: {
          data: base64Data,
          mimeType: baseImage.mimeType,
        },
      });
    }

    // Add reference images
    // Nano Banana (Flash): up to 1 reference image (total 2 images)
    // Nano Banana 2 (3.1 Flash): up to 10 object images + 4 character images (total 14)
    // Nano Banana Pro (3 Pro): up to 6 object images + 5 character images (total 11)
    if (referenceImages && referenceImages.length > 0) {
      const maxReferenceImages = getMaxRefImages(model);
      const imagesToAdd = referenceImages.slice(0, maxReferenceImages);

      for (const img of imagesToAdd) {
        const refBase64 = await resolveImageBase64(img);
        parts.push({
          inlineData: {
            data: refBase64,
            mimeType: img.mimeType,
          },
        });
      }
    }

    // Validate prompt is not empty
    if (!promptText || promptText.trim().length === 0) {
      throw new Error('Prompt text is required');
    }

    parts.push({ text: promptText });

    const config: any = {
      responseModalities: [Modality.TEXT, Modality.IMAGE],
    };

    // Configure resolution / aspect ratio for image models
    // - Nano Banana 2 (3.1 Flash): uses imageConfig with aspectRatio + imageSize
    // - Nano Banana Pro (3 Pro): uses imageConfig with aspectRatio + imageSize
    // - Nano Banana (2.5 Flash): uses outputImageDimensions (legacy)
    if (isAdvancedModel(model)) {
      // Nano Banana 2 / Pro: use imageConfig API
      config.imageConfig = {} as any;
      if (aspectRatio) {
        config.imageConfig.aspectRatio = aspectRatio;
      }
      if (resolution) {
        config.imageConfig.imageSize = resolution;
      }
    } else if (model === GEMINI_MODELS.IMAGE_FLASH && aspectRatio) {
      // Nano Banana (legacy): uses outputImageDimensions
      const maxDimension = 1210;
      const [widthRatio, heightRatio] = aspectRatio.split(':').map(Number);
      const ratio = widthRatio / heightRatio;

      let width: number, height: number;
      if (ratio >= 1) {
        width = maxDimension;
        height = Math.round(maxDimension / ratio);
      } else {
        height = maxDimension;
        width = Math.round(maxDimension * ratio);
      }

      config.outputImageDimensions = {
        width,
        height,
      };
    }

    const response = await getAI(apiKey).models.generateContent({
      model: model,
      contents: [{
        parts: parts,
      }],
      config: config,
    });

    let textResponse = '';
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return part.inlineData.data as string;
      }
      if (part.text) {
        textResponse += part.text + ' ';
      }
    }

    // Check if the model refused due to safety ratings
    const safetyRatings = response.candidates?.[0]?.safetyRatings;
    const blockedRating = safetyRatings?.find(r => r.probability === 'HIGH' || r.probability === 'MEDIUM');

    if (blockedRating) {
      throw new Error(`Generation blocked by safety filters (${blockedRating.category}: ${blockedRating.probability}). Text: ${textResponse.trim()}`);
    }

    throw new Error(`No image was generated in the response. Model response: ${textResponse.trim() || 'Empty response'}`);
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

    const base64Data = await resolveImageBase64(baseImage);

    const response = await getAI(apiKey).models.generateContent({
      model: GEMINI_MODELS.TEXT,
      contents: [{
        parts: [
          {
            inlineData: {
              data: base64Data,
              mimeType: baseImage.mimeType,
            },
          },
          {
            text: prompt,
          },
        ],
      }],
    });

    const suggestionsText = response.text || '';

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
    model: GEMINI_MODELS.TEXT
  });
};

export interface AnalyzeMockupSetupResult {
  branding: string[];
  categories: string[];
  locations: string[];
  angles: string[];
  lighting: string[];
  effects: string[];
  materials: string[];
  detectedLanguage?: string | null;
  detectedText?: string | null;
  inputTokens?: number;
  outputTokens?: number;
}

export const analyzeMockupSetup = async (
  baseImage: UploadedImage,
  userApiKey?: string,
  availableTags?: {
    branding: string[];
    categories: string[];
    locations: string[];
    angles: string[];
    lighting: string[];
    effects: string[];
    materials: string[];
  },
  instructions?: string,
  userContext?: {
    selectedBrandingTags?: string[];
  }
): Promise<AnalyzeMockupSetupResult> => {
  return withRetry(async () => {
    const t0 = Date.now();
    if (process.env.NODE_ENV === 'development') console.log('[dev] analyzeMockupSetup: start');
    // Import prompt builder and tag service
    const { buildAnalysisPrompt } = await import('../utils/analysisPromptBuilder.js');
    const { validateTags } = await import('../services/tagService.js');

    // Build prompt using reusable template
    const promptToGemini = buildAnalysisPrompt({
      availableTags: availableTags as AvailableTags | undefined,
      instructions,
      userContext,
    });
    if (process.env.NODE_ENV === 'development') console.log('[dev] analyzeMockupSetup: buildAnalysisPrompt done', ((Date.now() - t0) / 1000).toFixed(2) + 's');

    const base64Data = await resolveImageBase64(baseImage);
    if (process.env.NODE_ENV === 'development') console.log('[dev] analyzeMockupSetup: resolveImageBase64 done', ((Date.now() - t0) / 1000).toFixed(2) + 's');

    if (process.env.NODE_ENV === 'development') console.log('[dev] analyzeMockupSetup: Gemini generateContent start');
    const response = await getAI(userApiKey).models.generateContent({
      model: GEMINI_MODELS.TEXT,
      contents: [{
        parts: [
          {
            inlineData: {
              data: base64Data,
              mimeType: baseImage.mimeType,
            },
          },
          { text: promptToGemini },
        ],
      }],
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
            detectedLanguage: { type: Type.STRING },
            detectedText: { type: Type.STRING },
          },
        },
      },
    });
    if (process.env.NODE_ENV === 'development') console.log('[dev] analyzeMockupSetup: Gemini generateContent done', ((Date.now() - t0) / 1000).toFixed(2) + 's');

    // Extract usage metadata
    const usageMetadata = (response as any).usageMetadata;
    const inputTokens = usageMetadata?.promptTokenCount;
    const outputTokens = usageMetadata?.candidatesTokenCount;

    const jsonString = (response.text || '').trim();
    if (!jsonString) {
      return {
        branding: [],
        categories: [],
        locations: [],
        angles: [],
        lighting: [],
        effects: [],
        materials: [],
        inputTokens,
        outputTokens,
      };
    }

    try {
      const result = JSON.parse(jsonString);
      const suggestedTags: Partial<AvailableTags> = {
        branding: result.branding || [],
        categories: result.categories || [],
        locations: result.locations || [],
        angles: result.angles || [],
        lighting: result.lighting || [],
        effects: result.effects || [],
        materials: result.materials || [],
      };

      // Validate tags against available tags (if provided)
      const validatedTags = availableTags
        ? validateTags(suggestedTags, availableTags as AvailableTags, {
            fuzzyMatching: true,
            logInvalid: true,
          })
        : suggestedTags;
      if (process.env.NODE_ENV === 'development') console.log('[dev] analyzeMockupSetup: validate/parse done', ((Date.now() - t0) / 1000).toFixed(2) + 's');

      return {
        branding: validatedTags.branding || [],
        categories: validatedTags.categories || [],
        locations: validatedTags.locations || [],
        angles: validatedTags.angles || [],
        lighting: validatedTags.lighting || [],
        effects: validatedTags.effects || [],
        materials: validatedTags.materials || [],
        detectedLanguage: result.detectedLanguage || null,
        detectedText: result.detectedText || null,
        inputTokens,
        outputTokens,
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
        inputTokens,
        outputTokens,
      };
    }
  }, {
    model: GEMINI_MODELS.TEXT
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
  materialTags?: string[];
  selectedColors: string[];
  aspectRatio: AspectRatio;
  generateText: boolean;
  withHuman: boolean;
  enhanceTexture: boolean;
  removeText: boolean;
  negativePrompt: string;
  additionalPrompt: string;
  instructions: string;
  /** Brand guideline completo (opcional) — se presente, vira o contexto de mais alta prioridade. */
  brandGuideline?: BrandGuideline | null;
  /** User id — necessário pra filtrar exemplos personalizados no RAG. */
  userId?: string;
  /** Vibe preset selecionada (id) — informativo, mantém coesão. */
  vibeId?: string;
  /** Se true, consulta Pinecone por exemplos similares e injeta como few-shot. Default: true. */
  learnFromHistory?: boolean;
  /** Idioma detectado na análise da imagem (opcional). */
  detectedLanguage?: string | null;
}

export interface SmartPromptResult {
  prompt: string;
  inputTokens?: number;
  outputTokens?: number;
  /** Decisões do harmonizer de tags — exposto pra debug/telemetria. */
  rationale?: string[];
  /** Brief de marca usado, se houver — útil pro front mostrar "usando brand X". */
  brandBrief?: BrandBrief | null;
  /** ID único dessa geração — front usa pra atrelar feedback 👍/👎 depois. */
  generationId: string;
  /** Quantos exemplos o RAG injetou (0 se Pinecone vazio/offline). */
  learnedExamplesCount: number;
  /** Metadados do Reflection Loop (se ativado). */
  reflection?: {
    originalPrompt: string;
    critique: string;
    isRefined: boolean;
  };
}

export const generateSmartPrompt = async (params: SmartPromptParams, apiKey?: string): Promise<SmartPromptResult> => {
  return withRetry(async () => {
    const isBlankMockup = params.designType === 'blank';

    // 1. Destila brand guideline → brief curto e acionável
    const brandBrief = distillBrandGuideline(params.brandGuideline ?? null);

    // 2. Harmoniza tags: dedup, normaliza, resolve conflitos, preenche gaps por arquétipo
    const harmonized = harmonizeTags({
      brandingTags: params.brandingTags || [],
      locationTags: params.locationTags || [],
      angleTags: params.angleTags || [],
      lightingTags: params.lightingTags || [],
      effectTags: params.effectTags || [],
      materialTags: params.materialTags || [],
    });

    if (harmonized.rationale.length > 0 && process.env.NODE_ENV !== 'production') {
      console.log('[generateSmartPrompt] tag harmonization:', harmonized.rationale);
    }

    // 3. Mescla cores do brand brief com selectedColors do usuário (user wins, brand complementa)
    const mergedColors = [
      ...params.selectedColors,
      ...(brandBrief?.palette ?? []).filter(c => !params.selectedColors.includes(c)),
    ];

    // 4. RAG loop: consulta Pinecone por exemplos similares aprovados antes
    let learnedExamplesBlock: string | null = null;
    let learnedExamplesCount = 0;
    if (params.learnFromHistory !== false) {
      const queryText = [
        brandBrief?.promptText ?? '',
        `TYPE: ${params.designType}`,
        `VIBE: ${params.vibeId ?? 'none'}`,
        `TAGS: branding=[${harmonized.brandingTags.join(', ')}] location=[${harmonized.locationTags.join(', ')}] lighting=[${harmonized.lightingTags.join(', ')}]`,
      ].filter(Boolean).join('\n');

      const filter: Record<string, any> = {};
      if (params.userId) filter.userId = params.userId;
      if (params.brandGuideline?.id) filter.brandGuidelineId = params.brandGuideline.id;

      const similar = await exampleRetriever.findSimilar({
        feature: 'mockup',
        queryText,
        filter: Object.keys(filter).length > 0 ? filter : undefined,
        topK: 3,
      });
      learnedExamplesCount = similar.length;
      if (similar.length > 0) {
        learnedExamplesBlock = exampleRetriever.formatAsFewShot(similar);
        if (process.env.NODE_ENV !== 'production') {
          console.log(`[generateSmartPrompt] RAG injected ${similar.length} learned examples`);
        }
      }
    }

    // 5. Monta o template com brand context + design analysis + few-shot
    const instructionsTemplate = buildGeminiPromptInstructionsTemplate({
      designType: params.designType,
      isBlankMockup,
      withHuman: params.withHuman,
      enhanceTexture: params.enhanceTexture,
      removeText: params.removeText,
      locationTags: harmonized.locationTags,
      brandBrief: brandBrief?.promptText ?? null,
      analyzeDesignImage: !isBlankMockup && !!params.baseImage,
      learnedExamples: learnedExamplesBlock,
      vibeId: params.vibeId ?? null,
    });

    // 5. Substitui placeholders usando as tags JÁ HARMONIZADAS
    const promptToGemini = instructionsTemplate
      .replace('[BRANDING_TAGS]', harmonized.brandingTags.join(', ') || 'Not specified')
      .replace('[CATEGORY_TAGS]', params.categoryTags.join(', '))
      .replace('[COLORS]', mergedColors.join(', ') || 'Not specified')
      .replace('[LOCATION_TAGS]', harmonized.locationTags.join(', ') || 'Not specified')
      .replace('[ANGLE_TAGS]', harmonized.angleTags.join(', ') || 'Not specified')
      .replace('[LIGHTING_TAGS]', harmonized.lightingTags.join(', ') || 'Not specified')
      .replace('[EFFECT_TAGS]', harmonized.effectTags.join(', ') || 'Not specified')
      .replace('[GENERATE_TEXT]', isBlankMockup ? 'No (Blank Mockup)' : (params.generateText ? 'Yes' : 'No'))
      .replace('[REMOVE_TEXT]', isBlankMockup ? 'No' : (params.removeText ? 'Yes' : 'No'))
      .replace('[WITH_HUMAN]', params.withHuman ? 'Yes' : 'No')
      .replace('[ADDITIONAL_PROMPT]', params.additionalPrompt || 'Not specified')
      .replace('[INSTRUCTIONS]', (params.instructions || '') + (params.detectedLanguage?.toLowerCase().includes('pt') ? ' CRITICAL: The text in the design is in Portuguese (Brazil). Ensure the environment, background elements, and overall composition feel authentic to a Brazilian context and culture. Avoid generic global styles.' : ''))
      .replace('[ASPECT_RATIO]', params.aspectRatio)
      .replace('[NEGATIVE_PROMPT]', params.negativePrompt || 'Not specified');

    const parts = [];
    if (!isBlankMockup && params.baseImage) {
      const base64Data = await resolveImageBase64(params.baseImage);
      parts.push({
        inlineData: {
          data: base64Data,
          mimeType: params.baseImage.mimeType,
        },
      });
    }
    parts.push({ text: promptToGemini });

    const response = await getAI(apiKey).models.generateContent({
      model: GEMINI_MODELS.TEXT,
      contents: [{ parts }],
    });

    // Extract usage metadata if available
    const usageMetadata = (response as any).usageMetadata;
    const inputTokens = usageMetadata?.promptTokenCount;
    const outputTokens = usageMetadata?.candidatesTokenCount;

    let prompt = response.text || '';
    const generationId = randomUUID();
    let reflectionData: SmartPromptResult['reflection'] = undefined;

    // 6. Reflection Loop (opcional via feature flag)
    // Só faz sentido se houver um brandBrief pra comparar contra.
    if (process.env.FEATURE_REFLECTION_LOOP === 'true' && brandBrief && prompt.length > 0) {
      try {
        if (process.env.NODE_ENV !== 'production') console.log('[generateSmartPrompt] Launching Reflection Loop...');
        
        const reflection = await reflectAndRefinePrompt(
          prompt,
          brandBrief,
          params,
          apiKey
        );

        if (reflection.refinedPrompt !== prompt) {
          reflectionData = {
            originalPrompt: prompt,
            critique: reflection.rationale,
            isRefined: true
          };
          prompt = reflection.refinedPrompt;
        } else {
          reflectionData = {
            originalPrompt: prompt,
            critique: reflection.rationale || 'Prompt already looks optimal.',
            isRefined: false
          };
        }
      } catch (reflectErr) {
        console.warn('[generateSmartPrompt] Reflection Loop failed (graceful skip):', reflectErr);
      }
    }

    // Return object with prompt, tokens, harmonization metadata + generation id
    return {
      prompt,
      inputTokens,
      outputTokens,
      rationale: harmonized.rationale,
      brandBrief,
      generationId,
      learnedExamplesCount,
      reflection: reflectionData,
    };
  }, {
    model: GEMINI_MODELS.TEXT
  });
};

/**
 * Reflection Loop: Uma segunda chamada ao Gemini que atua como um "Brand Critic".
 * Compara o prompt gerado contra a Brand Guideline e refina para máxima fidelidade.
 */
export const reflectAndRefinePrompt = async (
  candidatePrompt: string,
  brandBrief: BrandBrief,
  params: SmartPromptParams,
  apiKey?: string
): Promise<{ refinedPrompt: string; rationale: string }> => {
  return withRetry(async () => {
    const critiquePrompt = `Você é um Crítico de Design e Especialista em Branding da Visant Labs.
Sua missão é auditar rigorosamente um PROMPT DE GERAÇÃO DE IMAGEM contra os valores e estética desta Marca.

**CONTEXTO DA MARCA:**
${brandBrief.promptText}

**INTENÇÃO ORIGINAL DO USUÁRIO:**
Design Type: ${params.designType}
Mood/Vibe: ${params.vibeId || 'Normal'}
Additional Instructions: ${params.instructions || 'Nenhuma'}

**PROMPT CANDIDATO (Para Audrey/Midjourney/Gemini):**
"${candidatePrompt}"

**TAREFA:**
1. Verifique se o prompt candidato captura os tons específicos, a iluminação, os materiais e a "vibe" da marca descritos no contexto.
2. Se o prompt estiver genérico demais (ex: não citando as cores da paleta ou materiais da marca), refine-o.
3. Garanta que o prompt seja focado na IMAGEM, mantendo fidelidade absoluta ao branding.
4. Se o prompt atual já for excelente e fiel, não mude nada.

**REGRAS DE RESPOSTA:**
- Retorne apenas um objeto JSON com duas chaves: "refinedPrompt" e "rationale" (breve explicação da mudança ou porque não mudou).
- Se não houver mudanças necessárias, "refinedPrompt" deve ser idêntico ao original.
- Não use emojis.`;

    const response = await getAI(apiKey).models.generateContent({
      model: GEMINI_MODELS.TEXT,
      contents: [{ parts: [{ text: critiquePrompt }] }],
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            refinedPrompt: { type: Type.STRING },
            rationale: { type: Type.STRING },
          },
          required: ['refinedPrompt', 'rationale'],
        },
      },
    });

    try {
      const result = JSON.parse(response.text || '{}');
      return {
        refinedPrompt: result.refinedPrompt || candidatePrompt,
        rationale: result.rationale || 'No changes suggested.',
      };
    } catch (e) {
      return { refinedPrompt: candidatePrompt, rationale: 'Critique failed to parse.' };
    }
  }, { model: GEMINI_MODELS.TEXT });
};

export interface GenerateMergePromptResult {
  prompt: string;
  inputTokens?: number;
  outputTokens?: number;
}

export const generateMergePrompt = async (images: UploadedImage[]): Promise<GenerateMergePromptResult> => {
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
    for (const img of images) {
      const base64Data = await resolveImageBase64(img);
      parts.push({
        inlineData: {
          data: base64Data,
          mimeType: img.mimeType,
        },
      });
    }

    parts.push({ text: promptToGemini });

    const response = await getAI().models.generateContent({
      model: GEMINI_MODELS.TEXT,
      contents: [{ parts }],
    });

    // Extract usage metadata
    const usageMetadata = (response as any).usageMetadata;
    const inputTokens = usageMetadata?.promptTokenCount;
    const outputTokens = usageMetadata?.candidatesTokenCount;

    return {
      prompt: response.text || '',
      inputTokens,
      outputTokens,
    };
  }, {
    model: GEMINI_MODELS.TEXT
  });
};

export interface ImprovedPromptResult {
  improvedPrompt: string;
  inputTokens?: number;
  outputTokens?: number;
}

export const improvePrompt = async (basePrompt: string, apiKey?: string): Promise<ImprovedPromptResult> => {
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
      model: GEMINI_MODELS.TEXT,
      contents: [{ parts: [{ text: promptToGemini }] }],
    });

    // Extract usage metadata
    const usageMetadata = (response as any).usageMetadata;
    const inputTokens = usageMetadata?.promptTokenCount;
    const outputTokens = usageMetadata?.candidatesTokenCount;

    const improvedPrompt = response.text || '';
    if (!improvedPrompt) {
      throw new Error('Nenhum prompt melhorado foi gerado na resposta.');
    }

    return {
      improvedPrompt,
      inputTokens,
      outputTokens,
    };
  }, {
    model: GEMINI_MODELS.TEXT
  });
};

export interface PromptVariationsResult {
  variations: string[];
  inputTokens?: number;
  outputTokens?: number;
}

export const suggestPromptVariations = async (basePrompt: string, apiKey?: string): Promise<PromptVariationsResult> => {
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
      model: GEMINI_MODELS.TEXT,
      contents: [{ parts: [{ text: promptToGemini }] }],
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

    // Extract usage metadata
    const usageMetadata = (response as any).usageMetadata;
    const inputTokens = usageMetadata?.promptTokenCount;
    const outputTokens = usageMetadata?.candidatesTokenCount;

    const jsonString = (response.text || '').trim();
    if (!jsonString) return { variations: [], inputTokens, outputTokens };

    try {
      const result = JSON.parse(jsonString);
      return {
        variations: result.suggestions || [],
        inputTokens,
        outputTokens,
      };
    } catch (e) {
      console.error("Failed to parse prompt suggestions JSON:", e);
      return { variations: [], inputTokens, outputTokens };
    }
  }, {
    model: GEMINI_MODELS.TEXT
  });
};

export const changeObjectInMockup = async (
  baseImage: UploadedImage,
  newObject: string,
  model: GeminiModel = GEMINI_MODELS.IMAGE_FLASH,
  resolution?: Resolution,
  onRetry?: (attempt: number, maxRetries: number, delay: number) => void,
  apiKey?: string
): Promise<string> => {
  return withRetry(async () => {
    const prompt = `Keep the same background, environment, lighting, and camera angle, but replace the main object in the image with ${newObject}. The new object should be placed in the same position and orientation as the original object, maintaining the same perspective and composition. The environment, background, and all other elements should remain exactly the same.`;

    const base64Data = await resolveImageBase64(baseImage);

    const parts: any[] = [
      {
        inlineData: {
          data: base64Data,
          mimeType: baseImage.mimeType,
        },
      },
      { text: prompt },
    ];

    const config: any = {
      responseModalities: [Modality.TEXT, Modality.IMAGE],
    };

    // Configure resolution for advanced models
    if (isAdvancedModel(model) && resolution) {
      config.imageConfig = { imageSize: resolution };
    }

    const response = await getAI().models.generateContent({
      model: model,
      contents: [{
        parts: parts,
      }],
      config: config,
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return part.inlineData.data as string;
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
  model: GeminiModel = GEMINI_MODELS.IMAGE_FLASH,
  resolution?: Resolution,
  onRetry?: (attempt: number, maxRetries: number, delay: number) => void,
  apiKey?: string
): Promise<string> => {
  return withRetry(async () => {
    const themesText = themes.join(', ');
    const prompt = `Apply ${themesText} theme to the scene while keeping the same composition, camera angle, and main object. Transform the background, lighting, colors, and environmental elements to reflect the ${themesText} theme, but maintain the exact same perspective, object placement, and overall structure of the original image.`;

    const base64Data = await resolveImageBase64(baseImage);

    const parts: any[] = [
      {
        inlineData: {
          data: base64Data,
          mimeType: baseImage.mimeType,
        },
      },
      { text: prompt },
    ];

    const config: any = {
      responseModalities: [Modality.TEXT, Modality.IMAGE],
    };

    // Configure resolution for advanced models
    if (isAdvancedModel(model) && resolution) {
      config.imageConfig = { imageSize: resolution };
    }

    const response = await getAI().models.generateContent({
      model: model,
      contents: [{
        parts: parts,
      }],
      config: config,
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return part.inlineData.data as string;
      }
    }

    throw new Error("No image was generated in the response.");
  }, {
    model,
    onRetry
  });
};

export interface DescribeImageResult {
  description: string;
  title?: string;
  inputTokens?: number;
  outputTokens?: number;
}

export const describeImage = async (
  image: UploadedImage | string,
  apiKey?: string
): Promise<DescribeImageResult> => {
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
      imageBase64 = await resolveImageBase64(image);
      mimeType = image.mimeType;
    }

    const prompt = `Analise esta imagem em detalhes.
Forneça:
1. Uma descrição visual clara e objetiva adequada para uso em prompts de geração de imagens IA (em inglês).
2. Um título curto e descritivo para a imagem (em português).

Retorne em formato JSON:
{
  "description": "A detailed visual description...",
  "title": "Um título descritivo"
}`;

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
      model: GEMINI_MODELS.TEXT,
      contents: [{ parts }],
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            description: { type: Type.STRING },
            title: { type: Type.STRING },
          },
        },
      },
    });

    // Extract usage metadata
    const usageMetadata = (response as any).usageMetadata;
    const inputTokens = usageMetadata?.promptTokenCount;
    const outputTokens = usageMetadata?.candidatesTokenCount;

    const jsonString = (response.text || '').trim();
    if (!jsonString) {
      throw new Error('No description was generated in the response.');
    }

    try {
      const result = JSON.parse(jsonString);
      return {
        description: result.description || '',
        title: result.title || '',
        inputTokens,
        outputTokens,
      };
    } catch (e) {
      console.error("Failed to parse image description JSON:", e);
      return {
        description: (response.text || '').trim(),
        inputTokens,
        outputTokens,
      };
    }
  }, {
    model: GEMINI_MODELS.TEXT
  });
};

export interface FigmaOperationsResult {
  operations: FigmaOperation[];
  inputTokens?: number;
  outputTokens?: number;
}

export const generateFigmaOperations = async (
  prompt: string,
  context: SerializedContext | EnrichedContext,
  userApiKey?: string
): Promise<FigmaOperationsResult> => {
  return withRetry(async () => {
    // Preprocess prompt (detect and parse Linear issues)
    const { processedPrompt, linearIssue, isLinearIssue } = preprocessPrompt(prompt);

    // Build context sections
    const enriched = context as EnrichedContext;
    const nodesStr = JSON.stringify(context.nodes?.slice(0, 10) || [], null, 2);

    // Build available assets section
    let assetsSection = '';
    if (enriched.reusableAssets?.length) {
      assetsSection = `\n## AVAILABLE ASSETS (clone by name with sourceName)
${enriched.reusableAssets.map(a => `- "${a.name}" (${a.type}, ${a.width}x${a.height})`).join('\n')}`;
    }

    // Build templates section
    let templatesSection = '';
    if (enriched.templates?.length) {
      templatesSection = `\n## AVAILABLE TEMPLATES (clone with textOverrides)
${enriched.templates.map(t => `- "${t.name}" (${t.width}x${t.height}) - slots: ${t.textSlots?.join(', ') || 'none'}`).join('\n')}`;
    }

    // Build pages section
    let pagesSection = '';
    if (enriched.pages?.length) {
      pagesSection = `\n## EXISTING PAGES
${enriched.pages.map(p => `- "${p.name}" (${p.frameCount} frames)`).join('\n')}`;
    }

    // Build Linear issue section if detected
    let linearSection = '';
    if (isLinearIssue && linearIssue) {
      const dims = linearIssue.formato?.dimensoes?.map(d => `${d.width}x${d.height}`).join(', ') || 'não especificado';
      const textos = Object.entries(linearIssue.textos || {}).map(([k, v]) => `  - ${k}: "${v.slice(0, 50)}..."`).join('\n');

      linearSection = `
## LINEAR ISSUE DETECTED
- ID: ${linearIssue.identifier}
- Title: ${linearIssue.title}
- Cliente: ${linearIssue.cliente || 'não especificado'}
- Formatos: ${dims}
${textos ? `- Textos:\n${textos}` : ''}
- Estilo: ${linearIssue.observacoes?.join(', ') || 'não especificado'}

INSTRUÇÕES PARA ESTA ISSUE:
1. Criar página com nome "[${linearIssue.identifier}] ${linearIssue.title.slice(0, 50)}"
2. Criar frames para cada formato - NOME DEVE INCLUIR DIMENSÕES (ex: "Stories 1080x1920", "Feed 1080x1080")
3. Usar autoPosition: "right" para organizar frames lado a lado
4. Se houver assets de background disponíveis, clonar com sourceName
5. Incluir todos os textos especificados na hierarquia correta`;
    }

    const systemPrompt = `You are a Figma plugin assistant specialized in generating organized design layouts.

Return ONLY valid JSON: { "operations": [ ... ] }

## ORGANIZATION RULES
1. For multiple demands/sections: CREATE a separate PAGE for each demand FIRST
2. Use "ref" to name pages/frames, then "parentRef" to nest frames inside pages
3. Use autoPosition: "right" to automatically position frames side-by-side (no manual x/y needed)
4. FRAME NAMING: Always include dimensions in frame name (e.g., "Stories 1080x1920", "Banner 300x250", "A4 21x29.7cm", "Outdoor 3x2m")
5. CRITICAL - TOP-LEVEL FRAMES: Canvas frames (Feed, Stories, Banners) must have FIXED width/height. NEVER use layoutMode on top-level frames - it causes "Hug" sizing which breaks the design. Auto-layout is ONLY for content containers INSIDE frames.

## OPERATION TYPES

### PAGE CREATION
- CREATE_PAGE: { type: "CREATE_PAGE", ref: "page_id", props: { name: "Page Name" } }

### FRAME CREATION (with auto-positioning)
- CREATE_FRAME: { type: "CREATE_FRAME", ref?, parentRef?, props: {
    name, width, height,
    autoPosition?: "right"|"below"|"grid",  // Auto-calculates x/y
    positionGap?: 100,  // Gap between frames (default: 100)
    fills?: [{ type: "SOLID", color: { r, g, b } }],
    cornerRadius?
  } }

IMPORTANT - FRAME vs AUTO-LAYOUT:
- TOP-LEVEL FRAMES (canvas artboards like Feed, Stories, Banners): ALWAYS use FIXED width/height, NO layoutMode
- AUTO-LAYOUT (layoutMode): ONLY for internal content containers INSIDE frames (e.g., text groups, button containers)
- WRONG: Creating a 1080x1080 frame with layoutMode (results in "Hug" sizing)
- CORRECT: Create frame with fixed dimensions, then create auto-layout containers inside for content

### AUTO-LAYOUT CONTAINER (for content organization inside frames)
- CREATE_FRAME with layoutMode: { type: "CREATE_FRAME", parentRef: "mainFrame", props: {
    name: "Content Container",
    layoutMode: "VERTICAL",  // Only use inside another frame!
    itemSpacing: 16,
    paddingTop/Right/Bottom/Left: 24,
    primaryAxisSizingMode: "AUTO",  // Hug content
    counterAxisSizingMode: "AUTO"
  } }

### TEXT CREATION
- CREATE_TEXT: { type: "CREATE_TEXT", ref?, parentRef?, props: { name?, content, fontSize?, fontFamily?, fills?, textAlignHorizontal?: "LEFT"|"CENTER"|"RIGHT", layoutSizingHorizontal?: "FIXED"|"HUG"|"FILL" } }

### CLONE BY NAME (PREFERRED - more robust than ID)
- CLONE_NODE: { type: "CLONE_NODE", ref?, sourceName: "Asset Name", parentRef?, textOverrides?: [{ name: "TextLayerName", content: "New text" }] }
- Use sourceName to clone existing assets by name (no fragile IDs!)
- Use textOverrides to replace text in cloned templates

### CLONE BY ID (fallback)
- CLONE_NODE: { type: "CLONE_NODE", ref?, sourceNodeId: "123:456", parentRef? }
${assetsSection}
${templatesSection}
${pagesSection}
${linearSection}

## COLOR VALUES
RGB: 0-1 floats. Example: red = { r: 1, g: 0, b: 0 }, orange = { r: 0.83, g: 0.29, b: 0.05 }

## EXAMPLE: Correct frame structure
\`\`\`json
{
  "operations": [
    { "type": "CREATE_PAGE", "ref": "p1", "props": { "name": "[VSN-511] Credenciamento" } },

    // TOP-LEVEL FRAME: Fixed dimensions, NO layoutMode
    { "type": "CREATE_FRAME", "ref": "feed", "parentRef": "p1", "props": {
      "name": "Feed 1080x1080", "width": 1080, "height": 1080, "autoPosition": "right",
      "fills": [{ "type": "SOLID", "color": { "r": 0.1, "g": 0.1, "b": 0.1 } }]
    }},

    // CONTENT CONTAINER: Auto-layout INSIDE the frame
    { "type": "CREATE_FRAME", "ref": "content", "parentRef": "feed", "props": {
      "name": "Content", "layoutMode": "VERTICAL", "itemSpacing": 24,
      "paddingTop": 40, "paddingBottom": 40, "paddingLeft": 40, "paddingRight": 40,
      "primaryAxisSizingMode": "AUTO", "counterAxisSizingMode": "FIXED", "width": 1000
    }},

    { "type": "CREATE_TEXT", "parentRef": "content", "props": { "content": "Título", "fontSize": 48 } }
  ]
}
\`\`\``;

    const userPrompt = `Canvas context (selection):
${nodesStr}

User prompt: ${isLinearIssue ? processedPrompt : prompt}
${isLinearIssue ? `\nOriginal Linear issue data available in system prompt above.` : ''}

Return JSON with "operations" array only.`;

    const response = await getAI(userApiKey).models.generateContent({
      model: GEMINI_MODELS.TEXT,
      contents: [{ parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            operations: {
              type: Type.ARRAY,
              items: { type: Type.OBJECT },
            },
          },
        },
      },
    });

    const usageMetadata = (response as any).usageMetadata;
    const inputTokens = usageMetadata?.promptTokenCount;
    const outputTokens = usageMetadata?.candidatesTokenCount;

    const jsonString = (response.text || '').trim();
    if (!jsonString) {
      throw new Error('No operations were generated in the response.');
    }

    try {
      const parsed = JSON.parse(jsonString);
      const operations = Array.isArray(parsed?.operations) ? parsed.operations : [];
      return { operations, inputTokens, outputTokens };
    } catch (e) {
      console.error('Failed to parse Figma operations JSON:', e);
      throw new Error('Invalid JSON in AI response.');
    }
  }, { model: GEMINI_MODELS.TEXT });
};

/**
 * Lightweight refinement of suggestions based on selected tags.
 * Uses text-only model (no image) for efficiency.
 */
export interface RefineSuggestionsParams {
  imageDescription?: string;
  selectedTags: {
    categories: string[];
    location: string[];
    angle: string[];
    lighting: string[];
    effects: string[];
    material: string[];
  };
  changedCategory: string;
  availableTags?: {
    categories: string[];
    locations: string[];
    angles: string[];
    lighting: string[];
    effects: string[];
    materials: string[];
  };
}


export interface RefineSuggestionsResult {
  categories?: string[];
  locations?: string[];
  angles?: string[];
  lighting?: string[];
  effects?: string[];
  materials?: string[];
  inputTokens?: number;
  outputTokens?: number;
}

export interface RefineSuggestionsParams {
  imageDescription?: string;
  selectedTags: {
    categories: string[];
    location: string[];
    angle: string[];
    lighting: string[];
    effects: string[];
    material: string[];
  };
  changedCategory: string;
  availableTags?: {
    categories: string[];
    locations: string[];
    angles: string[];
    lighting: string[];
    effects: string[];
    materials: string[];
  };
}

export const refineSuggestions = async (
  params: RefineSuggestionsParams,
  userApiKey?: string
): Promise<RefineSuggestionsResult> => {
  return withRetry(async () => {
    const { imageDescription, selectedTags, changedCategory, availableTags } = params;

    // Build context from selected tags
    const selectedContext = Object.entries(selectedTags)
      .filter(([_, tags]) => tags.length > 0)
      .map(([cat, tags]) => `${cat}: ${tags.join(', ')}`)
      .join('\n');

    // Determine which categories to suggest (exclude the one that changed)
    const categoriesToSuggest = ['categories', 'location', 'angle', 'lighting', 'effects', 'material']
      .filter(cat => cat !== changedCategory);

    const prompt = `You are a mockup photography expert. Based on the user's current tag selections, suggest complementary tags for a cohesive mockup scene.

${imageDescription ? `Image context: ${imageDescription}\n` : ''}
Current selections:
${selectedContext || 'None yet'}

${availableTags ? `Available tags to choose from:
- categories: ${availableTags.categories.slice(0, 20).join(', ')}...
- locations: ${availableTags.locations.slice(0, 15).join(', ')}...
- angles: ${availableTags.angles.join(', ')}
- lighting: ${availableTags.lighting.join(', ')}
- effects: ${availableTags.effects.slice(0, 15).join(', ')}...
- materials: ${availableTags.materials.slice(0, 15).join(', ')}...` : ''}

Suggest 2-3 complementary tags for each of these categories: ${categoriesToSuggest.join(', ')}.
Consider visual harmony, common photography/mockup patterns, and practical combinations.
Return ONLY tags that work well together with the current selections.`;

    // Build response schema dynamically based on categories to suggest
    const properties: Record<string, any> = {};
    const categoryMap: Record<string, string> = {
      'categories': 'categories',
      'location': 'locations',
      'angle': 'angles',
      'lighting': 'lighting',
      'effects': 'effects',
      'material': 'materials',
    };

    for (const cat of categoriesToSuggest) {
      properties[categoryMap[cat] || cat] = { type: Type.ARRAY, items: { type: Type.STRING } };
    }

    const response = await getAI(userApiKey).models.generateContent({
      model: GEMINI_MODELS.TEXT, // Faster model for text-only
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties,
        },
      },
    });

    const usageMetadata = (response as any).usageMetadata;
    const inputTokens = usageMetadata?.promptTokenCount;
    const outputTokens = usageMetadata?.candidatesTokenCount;

    const jsonString = (response.text || '').trim();
    if (!jsonString) {
      return { inputTokens, outputTokens };
    }

    try {
      const result = JSON.parse(jsonString);
      return {
        categories: result.categories,
        locations: result.locations,
        angles: result.angles,
        lighting: result.lighting,
        effects: result.effects,
        materials: result.materials,
        inputTokens,
        outputTokens,
      };
    } catch (e) {
      console.error('Failed to parse refineSuggestions JSON:', e);
      return { inputTokens, outputTokens };
    }
  }, { model: GEMINI_MODELS.TEXT });
};



export interface EmbeddingResult {
  embedding: number[];
  inputTokens?: number;
}

/**
 * Generate a multimodal embedding for a set of parts (text, image, video, pdf).
 * Uses the new gemini-embedding-2-preview model.
 */
export const getMultimodalEmbedding = async (
  parts: any[],
  userApiKey?: string,
  outputDimensionality: number = 3072
): Promise<EmbeddingResult> => {
  return withRetry(async () => {
    const ai = getAI(userApiKey);
    
    // The new @google/genai SDK uses a slightly different structure for embeddings
    const response = await ai.models.embedContent({
      model: 'models/gemini-embedding-2-preview',
      contents: [{
        parts: parts
      }],
      config: {
        outputDimensionality
      }
    });

    const embedding = response.embeddings?.[0]?.values;
    
    if (!embedding) {
      throw new Error('Failed to generate embedding');
    }

    // Extract usage metadata
    const usageMetadata = (response as any).usageMetadata;
    const inputTokens = usageMetadata?.promptTokenCount;

    return {
      embedding: Array.from(embedding),
      inputTokens
    };
  }, {
    model: 'models/gemini-embedding-2-preview'
  });
};

/**
 * Generic chat with context helper.
 * Can be used by any route with an optional system instruction and tools.
 */
export const chatWithAIContext = async (
  query: string,
  context: string,
  history: any[] = [],
  options: { apiKey?: string; model?: string; systemInstruction?: string; tools?: any } = {}
): Promise<any> => {
  const { apiKey, model: requestedModel, systemInstruction: requestedSystemInstruction, tools } = options;
  return withRetry(async () => {
    const ai = getAI(apiKey);

    // Use the provided niche instruction or fallback to the generic intelligent one
    const systemInstruction = requestedSystemInstruction || `${GENERIC_SYSTEM_PROMPT}\n\nUTILIZE O CONTEXTO ABAIXO:\n${context}`;

    // Basic input sanitization - strip angle brackets to prevent HTML/script injection
    const sanitizedQuery = query.substring(0, 4000).replace(/[<>]/g, '');

    const config: any = {
      systemInstruction,
    };

    // Add tools config if provided
    if (tools) {
      config.tools = tools;
      config.toolConfig = {
        functionCallingConfig: {
          mode: 'AUTO',
        },
      };
    }

    const response = await ai.models.generateContent({
      model: requestedModel || GEMINI_MODELS.TEXT,
      contents: [
        ...history,
        { parts: [{ text: sanitizedQuery }] }
      ],
      config,
    });

    // Check for function calls in the response
    const toolCalls: any[] = [];
    let responseText = response.text;

    const candidate = (response as any).candidates?.[0];
    if (candidate?.content?.parts) {
      for (const part of candidate.content.parts) {
        if (part.functionCall) {
          toolCalls.push({
            name: part.functionCall.name,
            args: part.functionCall.args,
          });
        }
      }
    }

    return {
      text: responseText,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      inputTokens: (response as any).usageMetadata?.promptTokenCount,
      outputTokens: (response as any).usageMetadata?.candidatesTokenCount
    };
  }, {
    model: GEMINI_MODELS.TEXT
  });
};

// ─── Moodboard Studio ───────────────────────────────────────────────────────

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface AnimationSuggestion {
  id: string;
  preset: string;
  prompt: string;
}

export const detectGridItems = async (base64Image: string): Promise<BoundingBox[]> => {
  const geminiAI = getAI();

  const response = await withRetry(async () => {
    return geminiAI.models.generateContent({
      model: 'gemini-2.0-flash-lite',
      contents: [{
        parts: [
          {
            text: `Identify all individual images within this grid or moodboard.
Return a JSON array of objects, each containing 'x', 'y', 'width', and 'height' as percentages (0-100) relative to the total image dimensions.
Be extremely precise with the coordinates to avoid including borders or adjacent images.
Only return the JSON array.`
          },
          { inlineData: { mimeType: 'image/jpeg', data: base64Image.replace(/^data:image\/\w+;base64,/, '') } }
        ]
      }],
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              x: { type: Type.NUMBER },
              y: { type: Type.NUMBER },
              width: { type: Type.NUMBER },
              height: { type: Type.NUMBER },
            },
            required: ['x', 'y', 'width', 'height'],
          },
        },
      },
    });
  }, { model: 'gemini-2.0-flash-lite' });

  try {
    return JSON.parse(response.text || '[]');
  } catch {
    return [];
  }
};

export const upscaleImageMoodboard = async (
  base64Image: string,
  size: '1K' | '2K' | '4K' = '4K'
): Promise<string> => {
  const geminiAI = getAI();

  const response = await withRetry(async () => {
    return geminiAI.models.generateContent({
      model: 'gemini-2.0-flash-preview-image-generation',
      contents: {
        parts: [
          { inlineData: { mimeType: 'image/jpeg', data: base64Image.replace(/^data:image\/\w+;base64,/, '') } },
          { text: `Upscale this image to ${size} resolution. Enhance clarity, details, and sharpness while preserving the original content perfectly. Output only the upscaled image.` },
        ],
      },
      config: {
        responseModalities: [Modality.IMAGE, Modality.TEXT],
      },
    } as any);
  }, { model: 'gemini-2.0-flash-preview-image-generation' });

  for (const part of (response as any).candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }

  throw new Error('No image returned from upscale');
};

export const suggestAnimationPresets = async (
  images: { id: string; base64: string }[]
): Promise<AnimationSuggestion[]> => {
  const geminiAI = getAI();

  const response = await withRetry(async () => {
    return geminiAI.models.generateContent({
      model: 'gemini-2.0-flash-lite',
      contents: [{
        parts: [
          {
            text: `Analyze these images and suggest the best animation preset and a cinematic video prompt for each.
Available presets: "zoom-in", "zoom-out", "pan-lr", "pan-rl", "fade-in".
Return a JSON array of objects, each with 'id', 'preset', and 'prompt'.
The 'id' must match the provided image IDs.
The 'prompt' should be a detailed cinematic description optimized for Veo 3 video generation.
Only return the JSON array.`
          },
          ...images.slice(0, 10).map(img => ({
            inlineData: { mimeType: 'image/jpeg', data: img.base64.replace(/^data:image\/\w+;base64,/, '') }
          })),
        ]
      }],
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              preset: { type: Type.STRING },
              prompt: { type: Type.STRING },
            },
            required: ['id', 'preset', 'prompt'],
          },
        },
      },
    });
  }, { model: 'gemini-2.0-flash-lite' });

  try {
    return JSON.parse(response.text || '[]');
  } catch {
    return [];
  }
};