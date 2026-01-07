import jwt from 'jsonwebtoken';
import { JWT_SECRET } from './jwtSecret.js';

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
