/**
 * Brand Resolver
 * Resolves brand guideline for a Figma file automatically
 */

import { prisma } from '../db/prisma.js';
import type { BrandGuideline } from '../../src/lib/figma-types.js';

export interface BrandResolverResult {
  guideline: BrandGuideline | null;
  availableGuidelines: { id: string; name: string }[];
  needsUserChoice: boolean;
}

/**
 * Convert Prisma BrandGuideline to BrandGuideline type
 */
function toBrandGuideline(prismaGuideline: any): BrandGuideline {
  return {
    id: prismaGuideline.id,
    identity: prismaGuideline.identity as any,
    logos: prismaGuideline.logos as any,
    colors: prismaGuideline.colors as any,
    typography: prismaGuideline.typography as any,
    tags: prismaGuideline.tags as any,
    media: prismaGuideline.media as any,
    tokens: prismaGuideline.tokens as any,
    guidelines: prismaGuideline.guidelines as any,
    strategy: prismaGuideline.strategy as any,
  };
}

/**
 * Resolve brand guideline for a user
 *
 * Priority:
 * 1. Explicit guidelineId passed in request
 * 2. List available guidelines for user to choose
 *
 * Note: Auto-detection from Figma fileId is not currently supported
 * as CanvasProject doesn't have a figmaFileId field.
 */
export async function resolveBrandGuideline(
  _fileId: string, // Reserved for future use
  userId: string,
  explicitGuidelineId?: string
): Promise<BrandResolverResult> {
  // 1. If explicit ID provided, use it directly
  if (explicitGuidelineId) {
    const guideline = await prisma.brandGuideline.findUnique({
      where: { id: explicitGuidelineId },
    });

    if (guideline) {
      return {
        guideline: toBrandGuideline(guideline),
        availableGuidelines: [],
        needsUserChoice: false,
      };
    }
  }

  // 2. No explicit guideline - get available ones for user choice
  const userGuidelines = await prisma.brandGuideline.findMany({
    where: { userId },
    select: {
      id: true,
      identity: true,
    },
    orderBy: { updatedAt: 'desc' },
    take: 10,
  });

  const availableGuidelines = userGuidelines.map(g => ({
    id: g.id,
    name: (g.identity as any)?.name || 'Unnamed Brand',
  }));

  return {
    guideline: null,
    availableGuidelines,
    needsUserChoice: availableGuidelines.length > 0,
  };
}

/**
 * Build context for LLM when user needs to choose a guideline
 */
export function buildGuidelineChoiceContext(
  availableGuidelines: { id: string; name: string }[]
): string {
  if (availableGuidelines.length === 0) {
    return '';
  }

  const lines = [
    '## BRAND SELECTION REQUIRED',
    'No brand guideline is linked to this project. Available brands:',
    '',
  ];

  for (const g of availableGuidelines) {
    lines.push(`- ${g.name}`);
  }

  lines.push('');
  lines.push('Ask the user which brand to use before generating content.');
  lines.push("Once they choose, use that brand's colors, fonts, and guidelines.");

  return lines.join('\n');
}
