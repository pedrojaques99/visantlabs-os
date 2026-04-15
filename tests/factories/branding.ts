import { prisma } from '../../server/db/prisma.js';

interface BrandingProjectOverrides {
  userId: string;
  name?: string;
  prompt?: string;
  data?: any;
}

export const createBrandingProject = async (overrides: BrandingProjectOverrides) => {
  const { prisma: db } = await import('../../server/db/prisma.js');
  const project = await db.brandingProject.create({
    data: {
      userId: overrides.userId,
      name: overrides.name || 'Test Brand',
      prompt: overrides.prompt || 'A futuristic tech company',
      data: overrides.data || {
        marketResearch: "Test market research",
      },
    },
  });

  return { project };
};
