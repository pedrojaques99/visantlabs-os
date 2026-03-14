import jwt from 'jsonwebtoken';
import { Request } from 'express';
import { JWT_SECRET } from './jwtSecret.js';

/**
 * Get the client IP address from a request.
 * Handles X-Forwarded-For header for proxied requests.
 */
export function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  const ip = forwarded
    ? (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : forwarded[0])
    : req.socket.remoteAddress || 'unknown';
  return ip || 'unknown';
}

/**
 * Extracts the user ID from a JWT token string.
 * Returns null if the token is invalid or missing.
 * @param token The JWT token string (can be with or without 'Bearer ' prefix)
 */
export const getUserIdFromToken = (token: string | undefined | null): string | null => {
    if (!token) return null;

    try {
        const cleanToken = token.replace('Bearer ', '');
        const decoded = jwt.verify(cleanToken, JWT_SECRET) as { userId: string };
        return decoded.userId;
    } catch (err) {
        return null;
    }
};
