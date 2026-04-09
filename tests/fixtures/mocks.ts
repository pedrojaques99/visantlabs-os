/**
 * Mock utilities and factories
 * Reusable mocks for common dependencies
 */

import { vi } from 'vitest';

/**
 * Mock Gemini API response
 */
export function mockGeminiResponse(text: string) {
  return {
    candidates: [
      {
        content: {
          parts: [{ text }],
        },
        finishReason: 'STOP',
      },
    ],
    usageMetadata: {
      promptTokenCount: 100,
      candidatesTokenCount: 50,
      totalTokenCount: 150,
    },
  };
}

/**
 * Mock circuit breaker success
 */
export function mockCircuitBreakerSuccess<T>(result: T) {
  return Promise.resolve(result);
}

/**
 * Mock circuit breaker failure (circuit open)
 */
export function mockCircuitBreakerOpen() {
  return Promise.reject(new Error('Circuit breaker is OPEN'));
}

/**
 * Mock circuit breaker timeout
 */
export function mockCircuitBreakerTimeout() {
  return Promise.reject(new Error('Request timeout'));
}

/**
 * Mock Prisma BrandGuideline model
 */
export function mockPrismaBrand() {
  return {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };
}

/**
 * Mock logger instance
 */
export function mockLogger() {
  return {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  };
}

/**
 * Mock request context
 */
export function mockRequestContext() {
  return {
    getRequestId: vi.fn().mockReturnValue('req-123'),
    getUserId: vi.fn().mockReturnValue('user-123'),
    addContextMetadata: vi.fn(),
  };
}
