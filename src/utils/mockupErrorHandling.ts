import { RateLimitError, ModelOverloadedError } from '@/services/geminiService';

export type TFunction = (key: string, params?: Record<string, string | number>) => string;

export type MockupErrorType =
  | 'rateLimit'
  | 'modelOverloaded'
  | 'payloadTooLarge'
  | 'serviceUnavailable'
  | 'timeout'
  | 'unableToProcessImage'
  | 'invalidImageFormat'
  | 'networkError'
  | 'apiError'
  | 'serverError'
  | 'unknown';

export interface MockupErrorInfo {
  message: string;
  suggestion?: string;
}

/**
 * Parse error to identify its type
 */
export function parseMockupErrorType(err: any): MockupErrorType {
  // Check for known error classes first
  if (err instanceof RateLimitError) {
    return 'rateLimit';
  }

  if (err instanceof ModelOverloadedError) {
    return 'modelOverloaded';
  }

  const errorStr = err?.message || err?.toString() || '';
  const status = err?.status;

  // Check for payload too large errors (413)
  if (
    status === 413 ||
    errorStr.includes('413') ||
    errorStr.includes('Payload Too Large') ||
    errorStr.includes('Request Entity Too Large') ||
    errorStr.includes('FUNCTION_PAYLOAD_TOO_LARGE')
  ) {
    return 'payloadTooLarge';
  }

  // Check for model overloaded messages
  if (
    errorStr.includes('model is overloaded') ||
    errorStr.includes('model overloaded') ||
    errorStr.includes('overloaded')
  ) {
    return 'modelOverloaded';
  }

  if (errorStr.includes('503') || errorStr.includes('Service Unavailable')) {
    return 'serviceUnavailable';
  }

  if (errorStr.includes('timeout')) {
    return 'timeout';
  }

  if (errorStr.includes('Unable to process input image')) {
    return 'unableToProcessImage';
  }

  if (errorStr.includes('INVALID_ARGUMENT')) {
    return 'invalidImageFormat';
  }

  if (errorStr.includes('429') || errorStr.includes('rate limit')) {
    return 'rateLimit';
  }

  if (errorStr.includes('network') || errorStr.includes('fetch')) {
    return 'networkError';
  }

  if (status === 500 || errorStr.includes('500') || errorStr.includes('Internal server error') || errorStr.includes('ANALYZE_SETUP_FAILED')) {
    return 'serverError';
  }

  // Check for JSON error objects
  if (errorStr.includes('{"error"')) {
    const jsonMatch = errorStr.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const errorObj = JSON.parse(jsonMatch[0]);
        if (errorObj?.error?.message) {
          return 'apiError';
        }
      } catch {
        // Ignore parse errors
      }
    }
  }

  if (err?.error?.message) {
    return 'apiError';
  }

  return 'unknown';
}

/**
 * Get error message and suggestion for a specific error type
 */
export function getErrorMessageForType(
  type: MockupErrorType,
  err: any,
  t: TFunction
): MockupErrorInfo {
  switch (type) {
    case 'rateLimit':
      return {
        message: t('messages.rateLimit'),
        suggestion: t('messages.tryAgainIn10Minutes'),
      };

    case 'modelOverloaded':
      return {
        message: err?.message || t('messages.modelOverloaded'),
        suggestion: t('messages.modelOverloadedSuggestion'),
      };

    case 'payloadTooLarge':
      return {
        message: 'Arquivo muito grande para processar',
        suggestion:
          'O tamanho do arquivo excede o limite permitido. Tente reduzir a resolução da imagem, usar um formato mais compacto (como JPEG) ou remover imagens de referência desnecessárias. As imagens são comprimidas automaticamente, mas algumas podem ainda ser muito grandes.',
      };

    case 'serviceUnavailable':
      return {
        message: t('messages.serviceUnavailable'),
        suggestion: t('messages.serviceUnavailableSuggestion'),
      };

    case 'timeout':
      return {
        message: t('messages.requestTimeout'),
        suggestion: t('messages.requestTimeoutSuggestion'),
      };

    case 'unableToProcessImage':
      return {
        message: t('messages.unableToProcessImage'),
        suggestion: t('messages.unableToProcessImageSuggestion'),
      };

    case 'invalidImageFormat':
      return {
        message: t('messages.invalidImageFormat'),
        suggestion: t('messages.invalidImageFormatSuggestion'),
      };

    case 'networkError':
      return {
        message: t('messages.networkError'),
        suggestion: t('messages.networkErrorSuggestion'),
      };

    case 'apiError': {
      // Try to extract API error message
      const errorStr = err?.message || err?.toString() || '';
      let apiMessage = '';

      // Try to parse JSON error
      if (errorStr.includes('{"error"')) {
        const jsonMatch = errorStr.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            const errorObj = JSON.parse(jsonMatch[0]);
            apiMessage = errorObj?.error?.message || '';
          } catch {
            // Ignore parse errors
          }
        }
      }

      // Fallback to err.error.message
      if (!apiMessage && err?.error?.message) {
        apiMessage = err.error.message;
      }

      // Handle specific API error messages
      if (apiMessage.includes('Unable to process input image')) {
        return {
          message: t('messages.unableToProcessImage'),
          suggestion: t('messages.unableToProcessImageSuggestion'),
        };
      }

      if (apiMessage.includes('Payload Too Large') || apiMessage.includes('413')) {
        return {
          message: 'Arquivo muito grande para processar',
          suggestion:
            'O tamanho do arquivo excede o limite permitido. Tente reduzir a resolução da imagem, usar um formato mais compacto (como JPEG) ou remover imagens de referência desnecessárias. As imagens são comprimidas automaticamente, mas algumas podem ainda ser muito grandes.',
        };
      }

      return { message: apiMessage || t('messages.generationError') };
    }

    case 'serverError':
      return {
        message: err?.message || t('messages.serverError'),
        suggestion: t('messages.serverErrorSuggestion'),
      };

    case 'unknown':
    default:
      return {
        message: err?.message || t('messages.generationError'),
        suggestion: t('messages.generationErrorSuggestion'),
      };
  }
}

/**
 * Format mockup generation error into user-friendly message
 * Main function that combines parsing and formatting
 * 
 * @param err - Error object to format
 * @param t - Translation function
 * @returns Object with message and optional suggestion
 * 
 * @example
 * const errorInfo = formatMockupError(error, t);
 * toast.error(errorInfo.message, { description: errorInfo.suggestion });
 */
export function formatMockupError(err: any, t: TFunction): MockupErrorInfo {
  const errorType = parseMockupErrorType(err);
  return getErrorMessageForType(errorType, err, t);
}
