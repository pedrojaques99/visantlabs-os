import type { GeminiModel, Resolution } from '../types';

/**
 * Get credits required for image generation based on model and resolution
 * This function matches the backend implementation in server/utils/usageTracking.ts
 */
export function getCreditsRequired(
  model: GeminiModel,
  resolution?: Resolution
): number {
  if (model === 'gemini-2.5-flash-image') {
    return 1;
  }
  
  if (model === 'gemini-3-pro-image-preview') {
    switch (resolution) {
      case '1K':
        return 3;
      case '2K':
        return 5;
      case '4K':
        return 10;
      default:
        // Default to 1K if resolution not specified
        return 3;
    }
  }
  
  // Fallback to 1 credit for unknown models
  return 1;
}

/**
 * Get credits required for branding step generation
 * Each step uses gemini-2.5-flash for text generation
 */
export function getBrandingStepCredits(stepNumber: number): number {
  // Each branding step costs 1 credit (using gemini-2.5-flash)
  return 1;
}

/**
 * Get total credits required for complete branding analysis
 */
export function getTotalBrandingCredits(): number {
  // 10 steps total (1-9 analysis steps + moodboard)
  return 10;
}

/**
 * Get credits required for video generation
 * Video generation costs 15 credits per video
 */
export function getVideoCreditsRequired(): number {
  return 15;
}

/**
 * Get credits required for chat message
 * Rule: 1 credit every 4 messages sent by the user
 * 
 * @param userMessageCount - Total number of messages sent by the user (before adding the new one)
 * @returns Number of credits to deduct (0 or 1)
 * 
 * @example
 * getChatMessageCreditsRequired(1) // 0 - first message
 * getChatMessageCreditsRequired(2) // 0 - second message
 * getChatMessageCreditsRequired(3) // 0 - third message
 * getChatMessageCreditsRequired(4) // 1 - fourth message (charge 1 credit)
 */
export function getChatMessageCreditsRequired(userMessageCount: number): number {
  if (userMessageCount < 0) {
    console.warn('userMessageCount cannot be negative, using 0');
    return 0;
  }
  
  // Every 4 messages, charge 1 credit
  // If messageCount is a multiple of 4, charge 1 credit
  return userMessageCount % 4 === 0 && userMessageCount > 0 ? 1 : 0;
}

/**
 * Get remaining messages until next credit charge
 * Useful for showing visual indicator in UI
 */
export function getMessagesUntilNextCredit(userMessageCount: number): number {
  const remainder = userMessageCount % 4;
  return remainder === 0 ? 4 : 4 - remainder;
}