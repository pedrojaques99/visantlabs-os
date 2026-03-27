import { prisma } from '../db/prisma.js';
import { decryptApiKey } from './encryption.js';

/**
 * Get the Figma Personal Access Token for a user
 * @param userId - User ID to get token for
 * @returns The decrypted Figma token or undefined
 */
export async function getFigmaToken(userId: string): Promise<string | undefined> {
  if (!userId) return undefined;

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { encryptedFigmaToken: true },
    });

    if (user?.encryptedFigmaToken) {
      try {
        const decrypted = decryptApiKey(user.encryptedFigmaToken);
        if (decrypted && decrypted.trim().length > 0) {
          return decrypted.trim();
        }
      } catch (err) {
        console.error('[FigmaToken] Failed to decrypt:', err);
      }
    }
  } catch (err) {
    console.error('[FigmaToken] Failed to fetch:', err);
  }

  return undefined;
}
