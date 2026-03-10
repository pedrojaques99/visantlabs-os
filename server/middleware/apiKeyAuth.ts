import crypto from 'crypto';
import { prisma } from '../db/prisma.js';
import { AuthRequest } from './auth.js';

/**
 * Try to authenticate via API key (visant_sk_xxx).
 * Returns true if authenticated, false if not an API key request.
 */
export async function authenticateApiKey(req: AuthRequest): Promise<boolean> {
  const authHeader = req.headers.authorization;
  if (!authHeader) return false;

  const token = authHeader.replace('Bearer ', '');
  if (!token.startsWith('visant_sk_')) return false;

  const keyHash = crypto.createHash('sha256').update(token).digest('hex');

  const apiKey = await prisma.apiKey.findUnique({
    where: { keyHash },
  });

  if (!apiKey || !apiKey.active) return false;
  if (apiKey.expiresAt && apiKey.expiresAt < new Date()) return false;

  const user = await prisma.user.findUnique({
    where: { id: apiKey.userId },
  });

  if (!user) return false;

  // Update lastUsed (fire and forget)
  prisma.apiKey.update({
    where: { id: apiKey.id },
    data: { lastUsed: new Date() },
  }).catch(() => {});

  req.userId = user.id;
  req.userEmail = user.email;

  return true;
}
