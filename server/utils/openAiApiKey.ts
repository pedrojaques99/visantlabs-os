import { prisma } from '../db/prisma.js';
import { decryptApiKey } from './encryption.js';

/**
 * Resolve the OpenAI API key for a request:
 *   1. User's own encrypted key (BYOK) — highest priority
 *   2. System OPENAI_API_KEY env var — fallback
 *
 * The key is NEVER logged or returned to the client.
 *
 * @param userId  - Optional; when provided, checks for user BYOK key first.
 * @param options.skipFallback - When true, returns undefined instead of the
 *                               system key if the user has no BYOK key saved.
 *                               Use this to check "is BYOK active?" without
 *                               accidentally consuming the system quota.
 */
export async function getOpenAiApiKey(
  userId?: string,
  options: { skipFallback?: boolean } = {}
): Promise<string | undefined> {
  // ── 1. Try user BYOK key ────────────────────────────────────────────────
  if (userId) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { encryptedOpenAiApiKey: true },
      });

      if (user?.encryptedOpenAiApiKey) {
        try {
          const decrypted = decryptApiKey(user.encryptedOpenAiApiKey);
          if (decrypted && decrypted.trim().length > 0) {
            return decrypted.trim();
          }
        } catch {
          // Decryption failure — fall through to system key, never crash a request
        }
      }
    } catch {
      // DB failure — fall through to system key
    }
  }

  // ── 2. System fallback ──────────────────────────────────────────────────
  if (options.skipFallback) return undefined;

  const systemKey = (
    process.env.OPENAI_API_KEY ||
    process.env.OPENAI_KEY ||
    ''
  ).trim();

  if (!systemKey || systemKey === 'undefined') {
    throw new Error(
      'OpenAI API key is not configured. ' +
      'Set OPENAI_API_KEY in environment variables, or add your own key in Settings → API Keys.'
    );
  }

  return systemKey;
}
