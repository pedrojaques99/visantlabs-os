/**
 * Utility to check if a generation should be unlimited (free) based on user's subscription plan
 *
 * Plan metadata structure:
 * {
 *   tier: 'starter' | 'creator' | 'agency' | 'studio',
 *   unlimitedResolutions: ['512px', '1K', '2K', '4K'],
 *   unlimitedModels: ['gemini-3.1-flash-image-preview', ...],
 *   storageLimitGB: 20,
 *   interval: 'month' | 'year'
 * }
 */

import type { Resolution } from '../types/types';

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
  resolution?: Resolution | string;
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

  // If model is unlimited AND resolution is unlimited (or no resolution needed)
  if (isModelUnlimited) {
    // For image models, check resolution
    if (resolution && unlimitedResolutions.length > 0) {
      return unlimitedResolutions.includes(resolution);
    }
    // If no resolution restrictions, model unlimited = all unlimited
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
 * Get a human-readable description of what's unlimited in a plan
 */
export function getUnlimitedDescription(planMetadata?: PlanMetadata | null): string | null {
  if (!planMetadata) return null;

  const { unlimitedModels = [], unlimitedResolutions = [] } = planMetadata;

  if (unlimitedModels.length === 0) return null;

  const modelNames: Record<string, string> = {
    'gemini-3.1-flash-image-preview': 'NB2',
    'gemini-3-pro-image-preview': '4K Pro',
    'veo-3.1-fast-generate-preview': 'Veo Fast',
    'veo-3.1-generate-preview': 'Veo Standard',
  };

  const models = unlimitedModels
    .map(m => modelNames[m] || m)
    .join(', ');

  if (unlimitedResolutions.length > 0) {
    const maxRes = unlimitedResolutions[unlimitedResolutions.length - 1];
    return `${models} unlimited até ${maxRes}`;
  }

  return `${models} unlimited`;
}
