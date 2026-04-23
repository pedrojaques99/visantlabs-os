import { prisma } from '../../db/prisma.js';

export interface ChatSessionLike {
  _id: string;
  brandGuidelineId?: string;
}

export interface RagScope {
  /** Pinecone userId — brand owner when brand-linked, else fallback user. */
  ragUserId: string;
  /** Pinecone projectId — brand id when brand-linked, else session id (silo). */
  ragProjectId: string;
  /** The resolved BrandGuideline row, or null when not brand-linked. */
  guideline: any | null;
}

/**
 * Resolve the RAG universe for a chat session.
 *
 * When the session is linked to a brand, the RAG scope is keyed by the brand's
 * owner + brand id so every team member querying the same brand hits the same
 * Pinecone namespace. Otherwise the session is siloed to its own id.
 *
 * Pass `enforceOwnerId` for user-facing routes that should only see brands
 * owned by the requesting user.
 */
export async function resolveRagScope(
  session: ChatSessionLike,
  fallbackUserId: string,
  opts?: { enforceOwnerId?: string }
): Promise<RagScope> {
  let ragUserId = fallbackUserId;
  let ragProjectId = session._id;
  let guideline: any = null;

  if (session.brandGuidelineId) {
    const where: any = { id: session.brandGuidelineId };
    if (opts?.enforceOwnerId) where.userId = opts.enforceOwnerId;

    guideline = await prisma.brandGuideline.findFirst({ where });
    if (guideline) {
      ragUserId = guideline.userId;
      ragProjectId = guideline.id;
    }
  }

  return { ragUserId, ragProjectId, guideline };
}
