/**
 * Validation constants
 */
export const MAX_MESSAGE_LENGTH = 5000;
export const MAX_CONTEXT_TEXT_LENGTH = 10000;
export const MAX_CONTEXT_IMAGES = 4;

/**
 * Blocked patterns for security
 */
export const BLOCKED_PATTERNS = [
  /ignore.*previous/gi,
  /forget.*context/gi,
  /system.*prompt/gi,
  /reveal.*(?:api|key|secret|password)/gi,
];

/**
 * Patterns that indicate image generation requests (blocked in chat)
 */
export const IMAGE_GENERATION_PATTERNS = [
  /generate.*image/gi,
  /create.*image/gi,
  /draw.*picture/gi,
  /make.*photo/gi,
];

/**
 * Custom error classes for better error handling
 */
export class ChatValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ChatValidationError';
  }
}

export class MessageValidationError extends ChatValidationError {
  constructor(message: string) {
    super(message);
    this.name = 'MessageValidationError';
  }
}

export class ContextValidationError extends ChatValidationError {
  constructor(message: string) {
    super(message);
    this.name = 'ContextValidationError';
  }
}

/**
 * Validate message content
 * @throws {MessageValidationError} if validation fails
 */
export function validateMessage(message: string): void {
  if (!message || message.trim().length === 0) {
    throw new MessageValidationError('Message cannot be empty');
  }

  if (message.length > MAX_MESSAGE_LENGTH) {
    throw new MessageValidationError(
      `Message too long. Maximum ${MAX_MESSAGE_LENGTH} characters allowed.`
    );
  }

  // Check for blocked patterns
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(message)) {
      throw new MessageValidationError('Message contains blocked content. Please rephrase.');
    }
  }

  // Check for image generation requests
  for (const pattern of IMAGE_GENERATION_PATTERNS) {
    if (pattern.test(message)) {
      throw new MessageValidationError(
        'Image generation is not available in chat. Please use image generation nodes for creating images.'
      );
    }
  }
}

/**
 * Validate context
 * @throws {ContextValidationError} if validation fails
 */
export function validateContext(context: {
  text?: string;
  images?: string[];
}): void {
  if (context.text && context.text.length > MAX_CONTEXT_TEXT_LENGTH) {
    throw new ContextValidationError(
      `Context text too long. Maximum ${MAX_CONTEXT_TEXT_LENGTH} characters allowed.`
    );
  }

  if (context.images && context.images.length > MAX_CONTEXT_IMAGES) {
    throw new ContextValidationError(
      `Too many context images. Maximum ${MAX_CONTEXT_IMAGES} images allowed.`
    );
  }
}


