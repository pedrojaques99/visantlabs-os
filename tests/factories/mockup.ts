import { faker } from '@faker-js/faker';
// Prisma imported dynamically inside functions

/**
 * Mockup factory for integration tests.
 */
export const mockupSeed = (overrides: Record<string, any> = {}): Record<string, any> => ({
  prompt: faker.lorem.sentence(),
  designType: 'blank',
  aspectRatio: '16:9',
  imageUrl: faker.image.url(),
  tags: [faker.word.sample()],
  brandingTags: [faker.word.sample()],
  isLiked: false,
  ...overrides,
});

export const createMockup = async (overrides: any = {}) => {
  const seed = mockupSeed(overrides);
  
  if (!seed.userId) {
    const { createUser } = await import('./user.js');
    const { user } = await createUser();
    seed.userId = user.id;
  }

  const { prisma } = await import('../../server/db/prisma.js');
  const mockup = await prisma.mockup.create({
    data: {
      userId: seed.userId,
      prompt: seed.prompt,
      designType: seed.designType,
      imageUrl: seed.imageUrl,
      tags: seed.tags,
      brandingTags: seed.brandingTags,
      aspectRatio: seed.aspectRatio,
      isLiked: seed.isLiked,
    },
  });

  return { mockup, seed };
};

/**
 * MockupExample factory.
 */
export const createMockupExample = async (overrides = {}) => {
  const { prisma } = await import('../../server/db/prisma.js');
  const example = await prisma.mockupExample.create({
    data: {
      prompt: faker.lorem.sentence(),
      imageUrl: faker.image.url(),
      designType: 'blank',
      tags: [faker.word.sample()],
      brandingTags: [faker.word.sample()],
      aspectRatio: '16:9',
      rating: 1,
      ...overrides,
    },
  });

  return example;
};
