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
  storageUsedBytes: number;
  storageLimitBytes: number | null;
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
    storageUsedBytes: 0,
    storageLimitBytes: null,
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
      storageUsedBytes: seed.storageUsedBytes,
      storageLimitBytes: seed.storageLimitBytes,
    },
  });

  // Also create in MongoDB if MONGODB_URI is provided (for credit tests)
  try {
    const { connectToMongoDB, getDb } = await import('../../server/db/mongodb.js');
    const { ObjectId } = await import('mongodb');
    await connectToMongoDB();
    const db = getDb();
    
    // Check if user already exists in Mongo (shouldn't happen with faker emails)
    const existing = await db.collection('users').findOne({ email: seed.email });
    if (!existing) {
      await db.collection('users').insertOne({
        _id: new ObjectId(user.id),
        email: seed.email,
        name: seed.name,
        isAdmin: seed.isAdmin,
        subscriptionTier: seed.subscriptionTier,
        monthlyCredits: seed.monthlyCredits,
        creditsUsed: seed.creditsUsed,
        storageUsedBytes: seed.storageUsedBytes,
        storageLimitBytes: seed.storageLimitBytes,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
  } catch (mongoError) {
    // Slient fail if Mongo is not available/needed for this specific test
    // But log it if DEBUG environment variable is set
    if (process.env.DEBUG) {
      console.warn('[createUser] MongoDB sync failed:', mongoError);
    }
  }

  return { user, password: seed.password };
}

export async function createAdmin(overrides: Partial<UserSeed> = {}) {
  return createUser({ ...overrides, isAdmin: true });
}
