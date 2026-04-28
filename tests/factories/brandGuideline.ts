import { prisma } from '../../server/db/prisma.js';

export interface BrandGuidelineSeed {
  userId: string;
  name?: string;
  colors?: any[];
  typography?: any[];
  logos?: any[];
  isPublic?: boolean;
  publicSlug?: string;
  canEdit?: string[];
  canView?: string[];
}

export async function createBrandGuideline(seed: BrandGuidelineSeed) {
  const guideline = await prisma.brandGuideline.create({
    data: {
      userId: seed.userId,
      identity: { name: seed.name ?? 'Test Brand', tagline: 'Testing' } as any,
      colors: seed.colors ?? [
        { name: 'Primary', hex: '#FF0000', role: 'primary' },
        { name: 'Secondary', hex: '#00FF00', role: 'secondary' },
      ] as any,
      typography: seed.typography ?? [
        { family: 'Inter', style: 'Regular', role: 'heading', size: 32 },
      ] as any,
      logos: seed.logos ?? [] as any,
      isPublic: seed.isPublic ?? false,
      publicSlug: seed.publicSlug ?? null,
      canEdit: seed.canEdit ?? [],
      canView: seed.canView ?? [],
      extraction: { sources: [], completeness: 50 } as any,
    },
  });

  return { guideline: { ...guideline, _id: guideline.id } };
}
