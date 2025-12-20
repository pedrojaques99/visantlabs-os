import { prisma } from '../db/prisma.js';
import { decryptApiKey } from './encryption.js';

/**
 * Get the appropriate Gemini API key for a user
 * Checks user's encrypted API key first, falls back to system key
 * @param userId - Optional user ID to check for user's API key
 * @param options - Optional configuration
 * @param options.skipFallback - If true, returns undefined instead of system key if user key is not found
 * @returns The API key to use (user's key if available, otherwise system key or undefined)
 */
export async function getGeminiApiKey(
  userId?: string,
  options: { skipFallback?: boolean } = {}
): Promise<string | undefined> {
  // First, try to get user's API key if userId is provided
  if (userId) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          encryptedGeminiApiKey: true,
        },
      });

      if (user?.encryptedGeminiApiKey) {
        try {
          const decryptedKey = decryptApiKey(user.encryptedGeminiApiKey);
          if (decryptedKey && decryptedKey.trim().length > 0) {
            return decryptedKey.trim();
          }
        } catch (decryptError: any) {
          console.error('Failed to decrypt user API key:', decryptError);
          // Fall through to system key
        }
      }
    } catch (error: any) {
      console.error('Failed to fetch user API key:', error);
      // Fall through to system key
    }
  }

  // If skipFallback is enabled, don't use system key
  if (options.skipFallback) {
    return undefined;
  }

  // Fallback to system API key
  const systemKey = (process.env.GEMINI_API_KEY || process.env.API_KEY || '').trim();
  if (!systemKey || systemKey === 'undefined' || systemKey.length === 0) {
    throw new Error(
      'GEMINI_API_KEY not found. ' +
      'Configure GEMINI_API_KEY in .env file to use AI features. ' +
      'Users can also provide their own API key in settings.'
    );
  }

  return systemKey;
}











