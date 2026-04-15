import { faker } from '@faker-js/faker';
import bcrypt from 'bcryptjs';

export interface UserSeed {
  email: string;
  name: string;
  password: string;
  isAdmin: boolean;
  subscriptionTier: 'free' | 'pro' | 'team';
  monthlyCredits: number;
  creditsUsed: number;
}

export function userSeed(overrides: Partial<UserSeed> = {}): UserSeed {
  return {
    email: faker.internet.email().toLowerCase(),
    name: faker.person.fullName(),
    password: 'Passw0rd!',
    isAdmin: false,
    subscriptionTier: 'free',
    monthlyCredits: 20,
    creditsUsed: 0,
    ...overrides,
  };
}

/**
 * Create a user directly via Prisma. Returns the created record + the plaintext
 * password so tests can log in.
 */
export async function createUser(overrides: Partial<UserSeed> = {}) {
  const { prisma } = await import('../../server/db/prisma.js');
  const seed = userSeed(overrides);
  const hashed = await bcrypt.hash(seed.password, 4); // low cost = fast tests
  const user = await prisma.user.create({
    data: {
      email: seed.email,
      name: seed.name,
      password: hashed,
      isAdmin: seed.isAdmin,
      subscriptionTier: seed.subscriptionTier,
      monthlyCredits: seed.monthlyCredits,
      creditsUsed: seed.creditsUsed,
    },
  });
  return { user, password: seed.password };
}

export async function createAdmin(overrides: Partial<UserSeed> = {}) {
  return createUser({ ...overrides, isAdmin: true });
}
