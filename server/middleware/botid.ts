import { Request, Response, NextFunction } from 'express';
import { checkBotId } from 'botid/server';

export interface BotIdRequest extends Request {
  botIdVerified?: boolean;
}

/**
 * BotID middleware to protect routes from bots
 * This middleware verifies that requests are from legitimate users, not bots
 */
export const verifyBotId = async (
  req: BotIdRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    // Skip bot verification for webhook endpoints (they come from external services)
    if (req.path.includes('/webhook')) {
      return next();
    }

    // Skip BotID verification in localhost/development environment
    // This allows login to work smoothly during development
    const isLocalhost = 
      req.hostname === 'localhost' ||
      req.hostname === '127.0.0.1' ||
      req.hostname === '0.0.0.0' ||
      req.hostname?.startsWith('192.168.') ||
      req.hostname?.startsWith('10.') ||
      process.env.NODE_ENV === 'development' ||
      !process.env.NODE_ENV;

    if (isLocalhost) {
      console.debug('[botid] ⚠️ Skipping BotID verification on localhost/development');
      req.botIdVerified = true; // Mark as verified to allow request
      return next();
    }

    // Verify the request using BotID
    const verification = await checkBotId();

    if (verification.isBot) {
      console.warn('[botid] ❌ Bot detected and blocked', {
        path: req.path,
        method: req.method,
        ip: req.ip,
      });
      return res.status(403).json({ 
        error: 'Access denied',
        code: 'BOT_DETECTED'
      });
    }

    // Mark request as verified
    req.botIdVerified = true;
    
    console.log('[botid] ✅ Request verified as legitimate', {
      path: req.path,
      method: req.method,
    });

    next();
  } catch (error: any) {
    // If BotID check fails, log but don't block (fail open in case of service issues)
    console.error('[botid] ⚠️ BotID verification error (allowing request)', {
      error: error?.message,
      path: req.path,
      method: req.method,
    });
    
    // In production, you might want to fail closed instead
    // For now, we'll allow the request to proceed
    req.botIdVerified = true; // Mark as verified to allow request
    next();
  }
};


