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

