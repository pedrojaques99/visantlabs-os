import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../db/prisma.js';
import { JWT_SECRET } from '../utils/jwtSecret.js';
import { authenticateApiKey } from './apiKeyAuth.js';
import { MCP_ENDPOINT } from '../lib/mcp-constants.js';

const isDev = process.env.NODE_ENV !== 'production';

export type AuthMethod = 'apikey' | 'oauth' | 'jwt' | 'mcp';

export interface AuthRequest extends Request {
  userId?: string;
  userEmail?: string;
  isAdmin?: boolean;
  /** How this request was authenticated. */
  authMethod?: AuthMethod;
  /** Scopes carried by a scoped credential (API key / OAuth token). */
  authScopes?: string[];
}

export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // Internal MCP calls: trust x-mcp-user-id header from localhost or internal network
    const mcpUserId = req.headers['x-mcp-user-id'] as string | undefined;
    if (mcpUserId) {
      const ip = req.ip || '';
      const host = req.hostname || '';
      const isLocal =
        host === 'localhost' ||
        host === '127.0.0.1' ||
        ip === '127.0.0.1' ||
        ip === '::1' ||
        ip === '::ffff:127.0.0.1' ||
        ip.startsWith('10.') ||
        ip.startsWith('172.') ||
        ip.startsWith('192.168.') ||
        process.env.TRUST_INTERNAL_CALLS === 'true';
      if (isLocal) {
        req.userId = mcpUserId;
        req.authMethod = 'mcp';
        return next();
      }
    }

    // Try API key auth first
    const isApiKey = await authenticateApiKey(req);
    if (isApiKey) return next();

    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const decoded = jwt.verify(token, JWT_SECRET) as {
      userId?: string;
      email?: string;
      sub?: string;
      aud?: string | string[];
      scope?: string;
    };

    // OAuth 2.1 access token path — has `sub` + `aud` (MCP resource)
    const mcpResource = MCP_ENDPOINT;
    const aud = decoded.aud;
    const isOAuthToken =
      decoded.sub && (aud === mcpResource || (Array.isArray(aud) && aud.includes(mcpResource)));

    if (isOAuthToken && decoded.sub) {
      req.userId = decoded.sub;
      req.authMethod = 'oauth';
      req.authScopes = decoded.scope ? decoded.scope.split(/\s+/).filter(Boolean) : [];
      return next();
    }

    // Legacy JWT path — has `userId`
    const userId = decoded.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Invalid token payload' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      if (isDev) {
        console.error('[authenticate] ❌ User not found in Prisma', {
          userId,
          path: req.path,
        });
      }
      return res.status(401).json({ error: 'User not found' });
    }

    req.userId = userId;
    req.userEmail = decoded.email;
    req.isAdmin = !!user.isAdmin;
    req.authMethod = 'jwt';

    next();
  } catch (error: any) {
    if (isDev) {
      console.error('[authenticate] ❌ Authentication error', {
        error: error?.message,
        name: error?.name,
        path: req.path,
        method: req.method,
      });
    }
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};

/**
 * Middleware to require admin access
 * Must be used after authenticate middleware
 */
export const requireAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.isAdmin) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

/**
 * Require a specific scope on the credential. Must run after `authenticate`.
 *
 * Full interactive sessions (legacy JWT) and trusted internal MCP calls are
 * full-access by design and bypass the check. Scoped credentials — API keys and
 * OAuth access tokens — must carry the required scope explicitly. This mirrors
 * the per-tool scope enforcement in the MCP server (read | write | generate).
 */
export const requireScope =
  (required: 'read' | 'write' | 'generate') =>
  (req: AuthRequest, res: Response, next: NextFunction) => {
    if (req.authMethod === 'jwt' || req.authMethod === 'mcp') return next();
    if (req.authScopes?.includes(required)) return next();
    return res.status(403).json({
      error: `Insufficient scope: this credential requires the "${required}" scope`,
    });
  };
