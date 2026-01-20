import { Request, Response, NextFunction } from 'express';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// In-memory storage for rate limiting
// Key: IP address, Value: rate limit entry
const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup interval to remove expired entries
const CLEANUP_INTERVAL_MS = 60000; // 1 minute
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetAt < now) {
      rateLimitStore.delete(key);
    }
  }
}, CLEANUP_INTERVAL_MS);

// Helper function to get client IP
export function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  const ip = forwarded
    ? (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : forwarded[0])
    : req.socket.remoteAddress || 'unknown';
  return ip || 'unknown';
}

interface RateLimitOptions {
  windowMs: number;
  max: number;
  message?: string;
  skipSuccessfulRequests?: boolean;
}

export function createRateLimiter(options: RateLimitOptions) {
  const {
    windowMs,
    max,
    message = 'Too many requests, please try again later.',
    skipSuccessfulRequests = false,
  } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    // Skip rate limiting if disabled
    if (process.env.RATE_LIMIT_ENABLED === 'false') {
      return next();
    }

    const ip = getClientIp(req);
    const now = Date.now();
    const key = ip;

    // Get or create entry
    let entry = rateLimitStore.get(key);

    // Check if entry exists and is still valid
    if (entry && entry.resetAt > now) {
      // Entry exists and is within window
      if (entry.count >= max) {
        // Rate limit exceeded
        const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
        return res.status(429).json({
          error: 'Rate limit exceeded',
          message,
          retryAfter,
        });
      }
      // Increment count
      entry.count++;
    } else {
      // Create new entry or reset expired one
      entry = {
        count: 1,
        resetAt: now + windowMs,
      };
      rateLimitStore.set(key, entry);
    }

    // Store entry in request for tracking
    (req as any).rateLimit = {
      limit: max,
      remaining: Math.max(0, max - entry.count),
      reset: new Date(entry.resetAt),
    };

    // Handle successful requests
    if (skipSuccessfulRequests) {
      const originalSend = res.json;
      res.json = function (body: any) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          // Success response, don't count this request
          if (entry) {
            entry.count = Math.max(0, entry.count - 1);
          }
        }
        return originalSend.call(this, body);
      };
    }

    next();
  };
}

// Pre-configured rate limiters
export const signupRateLimiter = createRateLimiter({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '3600000', 10), // 1 hour default
  max: parseInt(process.env.RATE_LIMIT_MAX_SIGNUP || '3', 10), // 3 signups per hour
  message: 'Too many signup attempts. Please try again later.',
});

export const signinRateLimiter = createRateLimiter({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '3600000', 10), // 1 hour default
  max: parseInt(process.env.RATE_LIMIT_MAX_SIGNIN || '10', 10), // 10 signin attempts per hour
  message: 'Too many signin attempts. Please try again later.',
  skipSuccessfulRequests: true, // Don't count successful logins
});

export const uploadImageRateLimiter = createRateLimiter({
  windowMs: parseInt(process.env.RATE_LIMIT_UPLOAD_WINDOW_MS || '900000', 10), // 15 minutes default
  max: parseInt(process.env.RATE_LIMIT_MAX_UPLOAD || '10', 10), // 10 uploads per 15 minutes
  message: 'Too many upload attempts. Please try again later.',
});

// Payment endpoints rate limiter - strict limits for financial operations
export const paymentRateLimiter = createRateLimiter({
  windowMs: parseInt(process.env.RATE_LIMIT_PAYMENT_WINDOW_MS || '60000', 10), // 1 minute default
  max: parseInt(process.env.RATE_LIMIT_MAX_PAYMENT || '10', 10), // 10 payment requests per minute
  message: 'Too many payment requests. Please try again later.',
});

// Mockup generation rate limiter - moderate limits
export const mockupRateLimiter = createRateLimiter({
  windowMs: parseInt(process.env.RATE_LIMIT_MOCKUP_WINDOW_MS || '60000', 10), // 1 minute default
  max: parseInt(process.env.RATE_LIMIT_MAX_MOCKUP || '30', 10), // 30 mockup requests per minute
  message: 'Too many mockup requests. Please try again later.',
});

// General API rate limiter - for general authenticated endpoints
export const apiRateLimiter = createRateLimiter({
  windowMs: parseInt(process.env.RATE_LIMIT_API_WINDOW_MS || '60000', 10), // 1 minute default
  max: parseInt(process.env.RATE_LIMIT_MAX_API || '60', 10), // 60 requests per minute
  message: 'Too many requests. Please try again later.',
});

// OAuth rate limiter - prevent brute force on OAuth endpoints
export const oauthRateLimiter = createRateLimiter({
  windowMs: parseInt(process.env.RATE_LIMIT_OAUTH_WINDOW_MS || '300000', 10), // 5 minutes default
  max: parseInt(process.env.RATE_LIMIT_MAX_OAUTH || '20', 10), // 20 OAuth requests per 5 minutes
  message: 'Too many OAuth requests. Please try again later.',
});

// Webhook rate limiter - for incoming webhooks
export const webhookRateLimiter = createRateLimiter({
  windowMs: parseInt(process.env.RATE_LIMIT_WEBHOOK_WINDOW_MS || '60000', 10), // 1 minute default
  max: parseInt(process.env.RATE_LIMIT_MAX_WEBHOOK || '100', 10), // 100 webhooks per minute
  message: 'Too many webhook requests.',
});

// Password reset rate limiter - strict to prevent enumeration
export const passwordResetRateLimiter = createRateLimiter({
  windowMs: parseInt(process.env.RATE_LIMIT_PASSWORD_RESET_WINDOW_MS || '3600000', 10), // 1 hour default
  max: parseInt(process.env.RATE_LIMIT_MAX_PASSWORD_RESET || '5', 10), // 5 password reset attempts per hour
  message: 'Too many password reset attempts. Please try again later.',
});

