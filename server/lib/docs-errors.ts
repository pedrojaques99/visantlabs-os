/**
 * Documentation Service Error Classes
 */

/**
 * Base error class for documentation service
 */
export class DocumentationError extends Error {
  constructor(
    public code: string,
    public statusCode: number,
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = 'DocumentationError';
    Object.setPrototypeOf(this, DocumentationError.prototype);
  }

  toJSON() {
    return {
      error: this.message,
      code: this.code,
      statusCode: this.statusCode,
      ...(this.details && { details: this.details }),
    };
  }
}

/**
 * Error when spec generation fails
 */
export class SpecGenerationError extends DocumentationError {
  constructor(message: string, details?: any) {
    super('SPEC_GENERATION_ERROR', 500, message, details);
    this.name = 'SpecGenerationError';
    Object.setPrototypeOf(this, SpecGenerationError.prototype);
  }
}

/**
 * Error for invalid input parameters
 */
export class ValidationError extends DocumentationError {
  constructor(message: string, details?: any) {
    super('VALIDATION_ERROR', 400, message, details);
    this.name = 'ValidationError';
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

/**
 * Error for resource not found
 */
export class NotFoundError extends DocumentationError {
  constructor(resource: string) {
    super(
      'NOT_FOUND',
      404,
      `${resource} not found`,
      { resource }
    );
    this.name = 'NotFoundError';
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}

/**
 * Error for invalid configuration
 */
export class ConfigurationError extends DocumentationError {
  constructor(message: string, details?: any) {
    super('CONFIGURATION_ERROR', 500, message, details);
    this.name = 'ConfigurationError';
    Object.setPrototypeOf(this, ConfigurationError.prototype);
  }
}

/**
 * Check if error is a DocumentationError
 */
export function isDocumentationError(err: any): err is DocumentationError {
  return err instanceof DocumentationError;
}
