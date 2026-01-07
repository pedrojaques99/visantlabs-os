import { authService } from './authService';
import { RateLimitError } from './geminiService';
import { toast } from 'sonner';
import { hasGeminiApiKey } from './userSettingsService';

// Get API URL from environment or use current origin for production
const getApiBaseUrl = () => {
  const viteApiUrl = (import.meta as any).env?.VITE_API_URL;
  if (viteApiUrl) {
    return viteApiUrl;
  }
  // Use relative URL - works in both local (with proxy) and production
  // In production on Vercel: /api redirects to serverless function
  // In local dev: vite.config.ts proxy redirects /api to http://localhost:3001
  return '/api';
};

const API_BASE_URL = getApiBaseUrl();

// Track in-flight requests to prevent duplicate simultaneous calls
// Key: request signature (userId + params hash), Value: Promise
const inFlightRequests = new Map<string, Promise<any>>();

// Track request timestamps to detect very recent duplicates (within 100ms)
const recentRequestTimestamps = new Map<string, number>();

// Track call count for debugging
let generateCallCount = 0;

const getAuthHeaders = () => {
  const token = authService.getToken();
  return {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
  };
};

// Create a simple hash of request parameters to detect duplicates
// uniqueId can be provided to differentiate parallel batch requests (e.g., slot index)
const createRequestKey = (params: any, uniqueId?: string | number): string => {
  // Create a unique key based on the request parameters
  // This helps prevent duplicate simultaneous requests with the same parameters
  // If uniqueId is provided, include it to allow parallel requests with same parameters
  const keyParts = [
    params.promptText?.substring(0, 50) || '',
    params.model || '',
    params.resolution || '',
    params.aspectRatio || '',
    params.imagesCount || 1,
    params.feature || '',
    params.baseImage ? 'hasBaseImage' : 'noBaseImage',
    params.referenceImages?.length || 0,
    uniqueId !== undefined ? `unique:${uniqueId}` : '', // Include uniqueId if provided
  ];
  return keyParts.join('|');
};

export interface Mockup {
  _id?: string;
  imageBase64?: string; // Made optional for backward compatibility
  imageUrl?: string; // New field for R2 storage URLs
  mimeType?: string; // MIME type of the image (e.g., 'image/png', 'image/jpeg')
  prompt: string;
  designType: string;
  tags: string[];
  brandingTags: string[];
  aspectRatio: string;
  isLiked?: boolean; // User's like status for this mockup
  likesCount?: number; // Total number of likes
  createdAt?: string;
  updatedAt?: string;
}

export const mockupApi = {
  async getAllPublic(): Promise<Mockup[]> {
    const response = await fetch(`${API_BASE_URL}/mockups/public`, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `Failed to fetch mockups: ${response.status} ${response.statusText}`;

      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData.error || errorData.message || errorMessage;
      } catch {
        if (errorText) {
          errorMessage = errorText;
        }
      }

      const error = new Error(errorMessage);
      (error as any).status = response.status;
      throw error;
    }

    const data = await response.json();
    return Array.isArray(data) ? data : [];
  },

  async getAll(): Promise<Mockup[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/mockups`, {
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `Failed to fetch mockups: ${response.status} ${response.statusText}`;

        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.error || errorData.message || errorMessage;
        } catch {
          // If response is not JSON, use the text or default message
          if (errorText) {
            errorMessage = errorText;
          }
        }

        const error = new Error(errorMessage);
        (error as any).status = response.status;
        throw error;
      }

      const data = await response.json();
      return Array.isArray(data) ? data : [];
    } catch (error: any) {
      // Handle network errors, timeouts, and connection failures gracefully
      if (error?.message?.includes('Failed to fetch') ||
        error?.message?.includes('NetworkError') ||
        error?.name === 'TypeError') {
        console.error('Network error fetching mockups:', error);
        // Return empty array to allow UI to load gracefully
        return [];
      }
      throw error;
    }
  },

  async getUploadUrl(contentType: string): Promise<{ presignedUrl: string; finalUrl: string; key: string }> {
    const response = await fetch(`${API_BASE_URL}/mockups/upload-url`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ contentType }),
    });
    if (!response.ok) throw new Error('Failed to get upload URL');
    return response.json();
  },

  async getById(id: string): Promise<Mockup> {
    const response = await fetch(`${API_BASE_URL}/mockups/${id}`, {
      headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error('Failed to fetch mockup');
    return response.json();
  },

  async save(mockup: Omit<Mockup, '_id' | 'createdAt' | 'updatedAt'>): Promise<Mockup> {
    try {
      const response = await fetch(`${API_BASE_URL}/mockups`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(mockup),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `Failed to save mockup: ${response.status} ${response.statusText}`;
        let errorDetails: string | undefined;

        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.error || errorData.message || errorMessage;
          errorDetails = errorData.details;
        } catch {
          if (errorText) {
            errorMessage = errorText || errorMessage;
          }
        }

        console.error('Save mockup failed:', {
          status: response.status,
          statusText: response.statusText,
          error: errorMessage,
          details: errorDetails,
          responseText: errorText,
        });

        const error = new Error(errorMessage);
        (error as any).status = response.status;
        (error as any).details = errorDetails;
        throw error;
      }

      return response.json();
    } catch (error: any) {
      // Handle network errors
      if (error?.message?.includes('Failed to fetch') ||
        error?.message?.includes('NetworkError') ||
        error?.name === 'TypeError') {
        console.error('Network error saving mockup:', error);
        throw new Error('Network error: Unable to connect to server. Please check your connection and try again.');
      }
      throw error;
    }
  },

  async update(id: string, mockup: Partial<Mockup>): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/mockups/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(mockup),
    });
    if (!response.ok) throw new Error('Failed to update mockup');
  },

  async delete(id: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/mockups/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error('Failed to delete mockup');
  },

  // Generate mockup image via backend (validates and deducts credits BEFORE generation)
  async generate(params: {
    promptText: string;
    baseImage?: { base64: string; mimeType: string };
    model: string;
    resolution?: string;
    aspectRatio?: string;
    referenceImages?: Array<{ base64: string; mimeType: string }>;
    imagesCount?: number;
    feature?: 'mockupmachine' | 'canvas';
    uniqueId?: string | number; // Optional unique identifier for parallel batch requests (e.g., slot index)
  }): Promise<{ imageBase64?: string; imageUrl?: string; creditsDeducted: number; creditsRemaining: number; isAdmin: boolean }> {
    // Generate unique request ID for tracking
    const requestId = `req-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    generateCallCount++;
    const currentCallCount = generateCallCount;

    console.log('[CREDIT] [mockupApi.generate] Starting request', {
      requestId,
      model: params.model,
      hasBaseImage: !!params.baseImage,
      referenceImagesCount: params.referenceImages?.length || 0,
      imagesCount: params.imagesCount,
      promptLength: params.promptText?.length || 0,
    });

    // CRITICAL: Check for duplicate in-flight requests to prevent multiple simultaneous calls
    // This helps prevent race conditions when the same request is triggered multiple times
    // NOTE: This only prevents duplicate calls from the SAME client instance
    // The backend lock mechanism is the final safeguard
    // uniqueId allows parallel batch requests to have distinct keys
    const requestKey = createRequestKey(params, params.uniqueId);
    const now = Date.now();

    // Check for existing in-flight request
    const existingRequest = inFlightRequests.get(requestKey);
    if (existingRequest) {
      console.warn('[CREDIT] [mockupApi.generate] ⚠️ Duplicate request detected on CLIENT, reusing existing request', {
        requestId,
        model: params.model,
        requestKey: requestKey.substring(0, 100),
        note: 'This prevents duplicate HTTP calls, but backend lock is the final safeguard',
      });
      return existingRequest;
    }

    // Check for very recent duplicate (within 100ms) - prevents race conditions from rapid clicks
    const lastRequestTime = recentRequestTimestamps.get(requestKey);
    if (lastRequestTime && (now - lastRequestTime) < 100) {
      console.warn('[CREDIT] [mockupApi.generate] ⚠️ Very recent duplicate request detected (within 100ms), blocking to prevent race condition', {
        requestId,
        model: params.model,
        requestKey: requestKey.substring(0, 100),
        timeSinceLastRequest: now - lastRequestTime,
        note: 'This prevents race conditions from rapid clicks or double-triggers',
      });
      // Wait a bit and check again for the existing request
      await new Promise(resolve => setTimeout(resolve, 50));
      const retryExistingRequest = inFlightRequests.get(requestKey);
      if (retryExistingRequest) {
        return retryExistingRequest;
      }
    }

    // Record this request timestamp
    recentRequestTimestamps.set(requestKey, now);

    // Clean up old timestamps (older than 1 second) to prevent memory leak
    if (recentRequestTimestamps.size > 100) {
      for (const [key, timestamp] of recentRequestTimestamps.entries()) {
        if (now - timestamp > 1000) {
          recentRequestTimestamps.delete(key);
        }
      }
    }

    console.log('[CREDIT] [mockupApi.generate] No duplicate found on client, proceeding with HTTP request', {
      requestId,
      requestKey: requestKey.substring(0, 100),
    });

    // Check if user has their own API key and notify them
    try {
      const userHasApiKey = await hasGeminiApiKey();
      if (userHasApiKey) {
        toast.info('API do usuário está sendo usada', {
          duration: 3000,
        });
      }
    } catch (error) {
      // Silently fail - don't block generation if key check fails
      console.warn('[mockupApi.generate] Failed to check user API key:', error);
    }

    // Helper to upload image if it's too large for the payload
    const uploadIfNecessary = async (img: { base64: string; mimeType: string }) => {
      // Threshold: 1MB (base64 is ~1.33x original size)
      // Vercel limit is 4.5MB. Let's use 1.5MB as threshold for base64 size
      const SIZE_THRESHOLD = 1.5 * 1024 * 1024;

      if (img.base64.length > SIZE_THRESHOLD) {
        try {
          console.log('[CREDIT] [mockupApi.generate] Image is large, uploading to R2 first');
          const { presignedUrl, finalUrl } = await this.getUploadUrl(img.mimeType);

          // Convert base64 to blob, removing data URL prefix if present
          const base64Data = img.base64.replace(/^data:image\/\w+;base64,/, '');
          const byteCharacters = atob(base64Data);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], { type: img.mimeType });

          // Upload to R2
          const uploadRes = await fetch(presignedUrl, {
            method: 'PUT',
            body: blob,
            headers: {
              'Content-Type': img.mimeType,
            },
          });

          if (!uploadRes.ok) throw new Error('Failed to upload image to R2');

          console.log('[CREDIT] [mockupApi.generate] Image uploaded successfully:', finalUrl);
          return { url: finalUrl, mimeType: img.mimeType };
        } catch (error) {
          console.error('[CREDIT] [mockupApi.generate] Error uploading image to R2, falling back to base64:', error);
          return img; // Fallback to base64 if upload fails
        }
      }
      return img;
    };

    // Prepare parameters, uploading images if necessary
    const processedParams = { ...params };
    if (params.baseImage) {
      processedParams.baseImage = await uploadIfNecessary(params.baseImage) as any;
    }
    if (params.referenceImages && params.referenceImages.length > 0) {
      processedParams.referenceImages = await Promise.all(
        params.referenceImages.map(img => uploadIfNecessary(img))
      ) as any;
    }



    // Create the request promise
    const requestPromise = (async () => {
      try {
        const headers = {
          ...getAuthHeaders(),
          'x-request-id': requestId, // Add request ID to headers for backend tracking
        };

        const response = await fetch(`${API_BASE_URL}/mockups/generate`, {
          method: 'POST',
          headers,
          body: JSON.stringify(processedParams),
        });

        if (!response.ok) {
          const errorText = await response.text();
          let errorMessage = `Failed to generate mockup: ${response.status} ${response.statusText}`;
          let errorData: any = null;

          try {
            errorData = JSON.parse(errorText);
            // Extract error message from multiple possible fields
            errorMessage = errorData.message || errorData.error || errorMessage;
          } catch {
            if (errorText) {
              errorMessage = errorText;
            }
          }

          // Handle 413 Payload Too Large errors specifically
          if (response.status === 413 || errorMessage.includes('413') || errorMessage.includes('Payload Too Large') || errorMessage.includes('Request Entity Too Large') || errorMessage.includes('FUNCTION_PAYLOAD_TOO_LARGE')) {
            errorMessage = 'Arquivo muito grande para processar. O tamanho do arquivo excede o limite permitido. Tente reduzir a resolução da imagem, usar um formato mais compacto (como JPEG) ou remover imagens de referência desnecessárias.';
          }

          console.error('[CREDIT] [mockupApi.generate] ❌ Request failed', {
            requestId,
            status: response.status,
            statusText: response.statusText,
            errorMessage,
            errorData,
            errorText: errorText.substring(0, 500), // Limit log size
          });

          // Check for rate limit errors (429 status or rate limit message in any field)
          const errorMessageLower = errorMessage.toLowerCase();
          const errorDataMessageLower = errorData?.message?.toLowerCase() || '';
          const errorDataErrorLower = errorData?.error?.toLowerCase() || '';
          const errorTextLower = errorText.toLowerCase();

          const isRateLimit = response.status === 429 ||
            errorMessageLower.includes('rate limit exceeded') ||
            errorMessageLower.includes('rate limit') ||
            errorDataMessageLower.includes('rate limit exceeded') ||
            errorDataMessageLower.includes('rate limit') ||
            errorDataErrorLower.includes('rate limit exceeded') ||
            errorDataErrorLower.includes('rate limit') ||
            errorTextLower.includes('rate limit exceeded') ||
            errorTextLower.includes('rate limit');

          if (isRateLimit) {
            // Use the most descriptive error message available
            const rateLimitMessage = errorData?.message || errorMessage || 'Rate limit exceeded. Please wait before making more requests.';
            throw new RateLimitError(rateLimitMessage);
          }

          const error = new Error(errorMessage);
          (error as any).status = response.status;
          (error as any).errorData = errorData; // Attach full error data

          // Handle specific error types
          if (response.status === 403 || errorMessage.includes('Insufficient credits') || errorMessage.includes('Subscription required')) {
            (error as any).requiresSubscription = true;
          }

          throw error;
        }

        const result = await response.json();
        console.log('[CREDIT] [mockupApi.generate] ✅ Request successful', {
          requestId,
          hasImageBase64: !!result.imageBase64,
          hasImageUrl: !!result.imageUrl,
          imageBase64Length: result.imageBase64?.length || 0,
          creditsDeducted: result.creditsDeducted,
          creditsRemaining: result.creditsRemaining,
          model: params.model,
          resolution: params.resolution,
        });

        return result;
      } finally {
        // Remove from in-flight requests when done (success or error)
        inFlightRequests.delete(requestKey);
        // Keep timestamp for a bit longer to catch late duplicates
        setTimeout(() => {
          recentRequestTimestamps.delete(requestKey);
        }, 500);
      }
    })();

    // Store the promise to prevent duplicate requests
    inFlightRequests.set(requestKey, requestPromise);

    return requestPromise;
  },
};

