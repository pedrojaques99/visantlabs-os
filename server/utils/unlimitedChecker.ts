/**
 * Server-side utility to check if a generation should be unlimited (free)
 * based on user's subscription plan metadata
 */

import { prisma } from '../db/prisma.js';
import { getDb } from '../db/mongodb.js';
import { ObjectId } from 'mongodb';

export interface PlanMetadata {
  tier?: string;
  unlimitedResolutions?: string[];
  unlimitedModels?: string[];
  storageLimitGB?: number;
  interval?: 'month' | 'year';
  features?: string[];
}

export interface UnlimitedCheckParams {
  model: string;
  resolution?: string;
  planMetadata?: PlanMetadata | null;
}

/**
 * Check if a specific generation is unlimited (doesn't consume credits)
 * based on the user's subscription plan configuration
 */
export function isGenerationUnlimited({
  model,
  resolution,
  planMetadata
}: UnlimitedCheckParams): boolean {
  // No plan or no metadata = not unlimited
  if (!planMetadata) return false;

  const { unlimitedModels = [], unlimitedResolutions = [] } = planMetadata;

  // Check if model is in unlimited list
  const isModelUnlimited = unlimitedModels.includes(model);

  if (isModelUnlimited) {
    // For image models with resolution, check resolution too
    if (resolution && unlimitedResolutions.length > 0) {
      return unlimitedResolutions.includes(resolution);
    }
    // If no resolution restrictions defined, model unlimited = all unlimited
    if (unlimitedResolutions.length === 0) {
      return true;
    }
  }

  return false;
}

/**
 * Get the effective credits for a generation, considering unlimited status
 */
export function getEffectiveCredits(
  baseCredits: number,
  params: UnlimitedCheckParams
): number {
  if (isGenerationUnlimited(params)) {
    return 0;
  }
  return baseCredits;
}

/**
 * Fetch plan metadata for a user based on their subscription tier
 */
export async function getUserPlanMetadata(userId: string): Promise<PlanMetadata | null> {
  try {
    const db = getDb();
    const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });

    if (!user || user.subscriptionStatus !== 'active' || user.subscriptionTier === 'free') {
      return null;
    }

    const subscriptionTier = user.subscriptionTier;

    const products = await prisma.product.findMany({
      where: {
        type: 'subscription_plan',
        isActive: true,
      },
    });

    // Match manually to avoid JSON filtering issues on MongoDB
    const product = products.find(p => 
      (p.metadata as any)?.tier === subscriptionTier || 
      p.productId.includes(subscriptionTier)
    );

    if (product && product.metadata) {
      return product.metadata as PlanMetadata;
    }

    return null;
  } catch (error) {
    console.error('Error fetching user plan metadata:', error);
    return null;
  }
}

/**
 * Check if a generation is unlimited for a specific user
 * Combines fetching plan metadata and checking unlimited status
 */
export async function isUserGenerationUnlimited(
  userId: string,
  model: string,
  resolution?: string
): Promise<boolean> {
  const planMetadata = await getUserPlanMetadata(userId);
  return isGenerationUnlimited({ model, resolution, planMetadata });
}
