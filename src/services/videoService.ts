import { GoogleGenAI } from "@google/genai";

// Lazy initialization to avoid breaking app startup if API key is not configured
let ai: GoogleGenAI | null = null;

const getAI = (): GoogleGenAI => {
  if (!ai) {
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

    const apiKey = (getEnvVar('VITE_GEMINI_API_KEY') || getEnvVar('VITE_API_KEY') || getEnvVar('GEMINI_API_KEY') || '').trim();


    if (!apiKey || apiKey === 'undefined' || apiKey.length === 0) {
      if (typeof window !== 'undefined') {
        console.warn('⚠️  GEMINI_API_KEY não encontrada. Funcionalidades de geração de vídeo estarão desabilitadas.');
      }
      throw new Error(
        "GEMINI_API_KEY não encontrada. " +
        "Configure GEMINI_API_KEY no arquivo .env para usar geração de vídeos. " +
        "Veja docs/SETUP_LLM.md para mais informações."
      );
    }

    ai = new GoogleGenAI({ apiKey });
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
  model?: string;
}

const DEFAULT_TIMEOUTS = {
  'veo-3.1-generate-preview': 300000, // 5 minutes for video generation (includes polling)
  'veo-3': 300000,
  'veo-2': 300000,
};

const DEFAULT_RETRIES = {
  'veo-3.1-generate-preview': 3,
  'veo-3': 3,
  'veo-2': 3,
};

const withRetry = async <T>(
  apiCall: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> => {
  const {
    maxRetries,
    timeout,
    onRetry,
    model = 'veo-3.1-generate-preview'
  } = options;

  const effectiveMaxRetries = maxRetries ?? DEFAULT_RETRIES[model] ?? 3;
  const effectiveTimeout = timeout ?? DEFAULT_TIMEOUTS[model] ?? 300000;

  let attempt = 0;
  const startTime = Date.now();

  const createTimeoutPromise = (): Promise<never> => {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Request timeout after ${effectiveTimeout}ms`));
      }, effectiveTimeout);
    });
  };

  while (attempt < effectiveMaxRetries) {
    try {
      const result = await Promise.race([
        apiCall(),
        createTimeoutPromise()
      ]);
      return result;
    } catch (error: any) {
      if (error?.message?.includes('timeout')) {
        throw new Error(`Request timed out after ${Math.round((Date.now() - startTime) / 1000)}s. The model may be experiencing high load. Please try again later.`);
      }

      const statusCode = error?.status ||
        error?.statusCode ||
        error?.response?.status ||
        error?.response?.statusCode ||
        error?.code;

      const errorMessage = error?.message || error?.toString() || '';
      const errorDetails = error?.error?.message || '';
      const errorResponse = error?.response?.data || error?.response || {};
      const errorString = JSON.stringify(errorResponse).toLowerCase();

      // Don't retry on 404 (model not found) - these are permanent errors
      const is404 = statusCode === 404 ||
        errorMessage.includes('404') ||
        errorMessage.toLowerCase().includes('not found') ||
        errorDetails.includes('404') ||
        errorDetails.toLowerCase().includes('not found') ||
        errorString.includes('404') ||
        errorString.includes('not found');

      if (is404) {
        throw new Error(`Model not found (404). Please check the model name and ensure it's available in your region.`);
      }

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
          throw new ModelOverloadedError("Model is currently overloaded. Please try again later.");
        }

        const delay = Math.min(1000 * Math.pow(2, attempt), 30000);
        if (onRetry) {
          onRetry(attempt, effectiveMaxRetries, delay);
        }

        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      attempt++;

      if (attempt >= effectiveMaxRetries) {
        throw error;
      }

      const delay = Math.min(1000 * Math.pow(2, attempt), 30000);
      if (onRetry) {
        onRetry(attempt, effectiveMaxRetries, delay);
      }

      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw new Error("Max retries exceeded");
};

export interface GenerateVideoParams {
  prompt: string;
  imageBase64?: string; // Legacy support
  imageMimeType?: string;
  model?: string;
  onRetry?: (attempt: number, maxRetries: number, delay: number) => void;
  // New props
  referenceImages?: string[];
  inputVideo?: string;
  startFrame?: string;
  endFrame?: string;
}

/**
 * Generate video using Google Veo
 * @param params - Parameters for video generation
 * @returns Base64 string of the generated video
 */
export const generateVideo = async (
  params: GenerateVideoParams
): Promise<string> => {
  const {
    prompt,
    imageBase64,
    imageMimeType = 'image/png',
    model = 'veo-3.1-generate-preview',
    onRetry,
    referenceImages,
    inputVideo,
    startFrame,
    endFrame,
  } = params;

  // Normalize model name - map old model names to new valid model
  let normalizedModel = model;
  if (model === 'veo-3' || model === 'veo-2') {
    normalizedModel = 'veo-3.1-generate-preview';
    console.warn(`Model "${model}" is not available, using "veo-3.1-generate-preview" instead`);
  }

  return withRetry(async () => {
    try {
      // Prepare the request parameters
      const requestParams: any = {
        model: normalizedModel,
        prompt: prompt,
      };

      // Helper to process base64 string
      const processBase64 = (b64: string) => {
        if (b64.startsWith('data:')) {
          const match = b64.match(/^data:([^;]+);base64,(.+)$/);
          if (match) {
            return { mimeType: match[1], data: match[2] };
          }
        }
        return { mimeType: imageMimeType, data: b64 };
      };

      // Handle Inputs (Veo 3.1)
      // The Veo API has specific prioritization for inputs:
      // 1. video (for video-to-video editing or extension)
      // 2. image (for image-to-video, often the start frame)
      
      // Process video input if provided
      if (inputVideo) {
        const processed = processBase64(inputVideo);
        requestParams.video = {
          videoBytes: processed.data,
          mimeType: processed.mimeType
        };
      }

      // Determine the primary image input. We prioritize:
      // 1. startFrame (explicit starting point)
      // 2. first reference image (style or content reference)
      // 3. imageBase64 (legacy support)
      
      let primaryImage: string | undefined = startFrame || (referenceImages && referenceImages.length > 0 ? referenceImages[0] : undefined) || imageBase64;
      
      if (primaryImage) {
        const processed = processBase64(primaryImage);
        requestParams.image = {
          imageBytes: processed.data,
          mimeType: processed.mimeType
        };
      }

      // NOTE: Current SDK constraints often limit us to a single primary image input.
      // If the SDK is updated to support multiple reference images or separate style/content
      // inputs (e.g., 'reference_images' or 'style_image' fields), this logic should be expanded.
      // For now, we prioritize the most relevant single input to ensure reliable generation.
      
      if (endFrame) {
        // Some experimental versions of Veo support an end frame
        const processed = processBase64(endFrame);
        requestParams.end_image = {
          imageBytes: processed.data,
          mimeType: processed.mimeType
        };
      }

      // Start video generation - returns an operation
      let operation = await getAI().models.generateVideos(requestParams);

      // Poll the operation status until the video is ready
      const pollInterval = 10000; // 10 seconds
      const maxPollTime = 300000; // 5 minutes max
      const startPollTime = Date.now();
      let pollCount = 0;

      while (!operation.done) {
        // Check timeout
        if (Date.now() - startPollTime > maxPollTime) {
          throw new Error("Video generation timed out after 5 minutes.");
        }

        // Wait before polling again
        await new Promise((resolve) => setTimeout(resolve, pollInterval));
        pollCount++;

        // Get operation status
        operation = await getAI().operations.getVideosOperation({
          operation: operation,
        });
      }

      // Check if operation completed with error
      if (operation.error) {
        throw new Error(`Video generation failed: ${operation.error.message || JSON.stringify(operation.error)}`);
      }

      // Check if we have a video in the response
      if (!operation.response?.generatedVideos || operation.response.generatedVideos.length === 0) {
        throw new Error("No video was generated in the response.");
      }

      const videoFile = operation.response.generatedVideos[0].video;
      if (!videoFile) {
        throw new Error("Video file not found in response.");
      }


      // Download the video file and convert to base64
      // Google Cloud Storage URIs require authentication via API key
      let videoData: ArrayBuffer | Blob | string | Uint8Array;

      try {
        // Check if videoFile has URI - try to download with proper authentication
        if (videoFile.uri) {
          try {
            // Check if URI is from Google (requires authentication)
            // Whitelist of allowed Google Cloud Storage hostnames
            const allowedGoogleHosts = [
              'storage.googleapis.com',
              'googleapis.com',
            ];
            
            let isGoogleUri = false;
            try {
              const parsedUri = new URL(videoFile.uri);
              isGoogleUri = allowedGoogleHosts.includes(parsedUri.hostname);
            } catch {
              // Invalid URL format - not a Google URI
              isGoogleUri = false;
            }

            // For Google URIs, use server proxy endpoint to handle authentication
            if (isGoogleUri) {
              try {
                const proxyUrl = `/api/images/video-proxy?url=${encodeURIComponent(videoFile.uri)}`;
                const proxyResponse = await fetch(proxyUrl);

                if (proxyResponse.ok) {
                  const proxyData = await proxyResponse.json();
                  if (proxyData.base64) {
                    // Return as data URL
                    return `data:${proxyData.mimeType || 'video/mp4'};base64,${proxyData.base64}`;
                  }
                } else {
                  console.warn(`Proxy failed (${proxyResponse.status}), falling back to direct fetch`);
                }
              } catch (proxyError) {
                console.warn('Proxy error, falling back to direct fetch:', proxyError);
              }
            }

            // Try direct fetch with API key for Google URIs, or without for others
            const headers: Record<string, string> = {};
            if (isGoogleUri) {
              // Helper to safely get env vars
              const getEnvVar = (key: string): string | undefined => {
                if (typeof process !== 'undefined' && process.env && process.env[key]) return process.env[key];
                try {
                  // @ts-ignore
                  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) return import.meta.env[key];
                } catch (e) { }
                return undefined;
              };

              const apiKey = (getEnvVar('VITE_GEMINI_API_KEY') || getEnvVar('VITE_API_KEY') || getEnvVar('GEMINI_API_KEY') || '').trim();
              if (apiKey) {
                headers['x-goog-api-key'] = apiKey;
              }
            }

            const response = await fetch(videoFile.uri, {
              headers,
            });

            if (response.ok) {
              videoData = await response.arrayBuffer();
            } else if (response.status === 403) {
              // 403 means authentication failed - use server proxy or return URI
              if (isGoogleUri) {
                // Already tried proxy, return URI for video element to try
                console.warn('403 error: Video URI requires authentication. Returning URI.');
              }
              return videoFile.uri;
            } else {
              // Other error - try without auth (might be public)
              const retryResponse = await fetch(videoFile.uri);
              if (retryResponse.ok) {
                videoData = await retryResponse.arrayBuffer();
              } else {
                // If both fail, return URI - OutputNode video element can try to load it
                console.warn(`Failed to fetch video (${retryResponse.status}). Returning URI for video element.`);
                return videoFile.uri;
              }
            }
          } catch (fetchError: any) {
            // Network or other errors - return URI so video element can try
            console.warn('Error fetching video, returning URI:', fetchError?.message);
            return videoFile.uri;
          }
        } else if ((videoFile as any).imageBytes || (videoFile as any).data) {
          // If video data is directly available in the response
          videoData = (videoFile as any).imageBytes || (videoFile as any).data;
        } else {
          throw new Error("Video file format not supported - missing URI or direct data access");
        }
      } catch (downloadError: any) {
        // If we have a URI, return it instead of throwing
        if (videoFile.uri) {
          console.warn('Video download error, returning URI:', downloadError?.message);
          return videoFile.uri;
        }
        throw new Error(`Failed to download video: ${downloadError?.message || downloadError}`);
      }

      // Helper function to convert various formats to base64 (browser compatible)
      const toBase64 = async (data: any): Promise<string> => {
        if (typeof data === 'string') {
          // If it's already a string, check if it's base64 or a URL
          if (data.startsWith('data:') || data.startsWith('http')) {
            return data;
          }
          // Assume it's base64
          return data;
        }

        // Handle Blob
        if (data instanceof Blob) {
          return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              const base64 = (reader.result as string).split(',')[1];
              resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(data);
          });
        }

        // Handle ArrayBuffer or Uint8Array
        if (data instanceof ArrayBuffer || data instanceof Uint8Array) {
          const bytes = data instanceof ArrayBuffer ? new Uint8Array(data) : data;
          // Convert to base64 using browser-compatible method
          const binary = Array.from(bytes, byte => String.fromCharCode(byte)).join('');
          return btoa(binary);
        }

        throw new Error("Unsupported video file format from API.");
      };

      // Convert to base64
      const base64Result = await toBase64(videoData);

      // If result is already a data URL or HTTP URL, return as-is
      if (base64Result.startsWith('data:') || base64Result.startsWith('http://') || base64Result.startsWith('https://')) {
        return base64Result;
      }

      // Otherwise, return as data URL format
      // Note: Handler expects either URL (starts with http) or base64 string (without data: prefix)
      // So we'll return just the base64 string, and handler will add data: prefix
      const mimeType = videoFile.mimeType || 'video/mp4';
      // Return full data URL - handler will detect it correctly
      const result = `data:${mimeType};base64,${base64Result}`;
      return result;
    } catch (error: any) {
      // If image parameter is not supported, try without it
      if (imageBase64) {
        const errorMessage = error?.message?.toLowerCase() || '';
        const errorString = JSON.stringify(error?.response || {}).toLowerCase();

        const isImageError = errorMessage.includes('image') ||
          errorMessage.includes('parameter') ||
          errorMessage.includes('invalid') ||
          errorString.includes('image') ||
          errorString.includes('parameter');

        if (isImageError) {
          console.warn('Image input may not be supported for this model, retrying without image...');
          // Retry without image - but don't use withRetry wrapper to avoid double retries
          const { imageBase64: _, ...paramsWithoutImage } = params;
          return generateVideo({
            ...paramsWithoutImage,
            imageBase64: undefined,
          });
        }
      }

      throw error;
    }
  }, {
    model: normalizedModel,
    onRetry
  });
};

