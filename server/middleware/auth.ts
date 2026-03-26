import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../db/prisma.js';
import { JWT_SECRET } from '../utils/jwtSecret.js';
import { authenticateApiKey } from './apiKeyAuth.js';

const isDev = process.env.NODE_ENV !== 'production';

export interface AuthRequest extends Request {
  userId?: string;
  userEmail?: string;
  isAdmin?: boolean;
}

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    // Internal MCP calls: trust x-mcp-user-id header from localhost only
    const mcpUserId = req.headers['x-mcp-user-id'] as string | undefined;
    if (mcpUserId) {
      const isLocal = req.hostname === 'localhost' || req.hostname === '127.0.0.1' || req.ip === '127.0.0.1' || req.ip === '::1';
      if (isLocal) {
        req.userId = mcpUserId;
        return next();
      }
    }

    // Try API key auth first
    const isApiKey = await authenticateApiKey(req);
    if (isApiKey) return next();

    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      if (isDev) {
        console.log('[authenticate] ❌ No token provided', {
          path: req.path,
          method: req.method,
        });
      }
      return res.status(401).json({ error: 'Authentication required' });
    }

    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; email: string };

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
    });

    if (!user) {
      if (isDev) {
        console.error('[authenticate] ❌ User not found in Prisma', {
          userId: decoded.userId,
          path: req.path,
        });
      }
      return res.status(401).json({ error: 'User not found' });
    }

    req.userId = decoded.userId;
    req.userEmail = decoded.email;
    req.isAdmin = !!user.isAdmin;

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

