/**
 * Safe error response utility (MED-002 fix)
 * Returns generic error messages in production to avoid information disclosure
 */

const isDev = process.env.NODE_ENV !== 'production';

export interface SafeErrorResponse {
  error: string;
  message?: string;
  code?: string;
}

/**
 * Create a safe error response that hides implementation details in production
 */
export function safeError(
  publicMessage: string,
  internalError?: Error | string | unknown,
  code?: string
): SafeErrorResponse {
  const response: SafeErrorResponse = { error: publicMessage };

  if (code) {
    response.code = code;
  }

  // Only include detailed message in development
  if (isDev && internalError) {
    response.message = internalError instanceof Error
      ? internalError.message
      : String(internalError);
  }

  return response;
}

/**
 * Mask email address for logging (MED-001 fix)
 * user@example.com -> u***@example.com
 */
export function maskEmail(email: string): string {
  if (!email || !email.includes('@')) return '***';
  const [local, domain] = email.split('@');
  const maskedLocal = local.length > 1
    ? local[0] + '***'
    : '***';
  return `${maskedLocal}@${domain}`;
}

/**
 * Mask user ID for logging
 * 507f1f77bcf86cd799439011 -> 507f***9011
 */
export function maskUserId(userId: string): string {
  if (!userId || userId.length < 8) return '***';
  return `${userId.slice(0, 4)}***${userId.slice(-4)}`;
}

/**
 * Safe console log for user-related data
 */
export function safeLog(
  level: 'log' | 'warn' | 'error',
  message: string,
  data?: Record<string, unknown>
): void {
  const safeData: Record<string, unknown> = {};

  if (data) {
    for (const [key, value] of Object.entries(data)) {
      if (key.toLowerCase().includes('email') && typeof value === 'string') {
        safeData[key] = maskEmail(value);
      } else if (key.toLowerCase().includes('userid') && typeof value === 'string') {
        safeData[key] = maskUserId(value);
      } else if (
        key.toLowerCase().includes('password') ||
        key.toLowerCase().includes('secret') ||
        key.toLowerCase().includes('token') ||
        key.toLowerCase().includes('key')
      ) {
        safeData[key] = '[REDACTED]';
      } else {
        safeData[key] = value;
      }
    }
  }

  const logFn = console[level];
  if (Object.keys(safeData).length > 0) {
    logFn(message, safeData);
  } else {
    logFn(message);
  }
}
