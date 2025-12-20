import { PrismaClient } from '@prisma/client';

// Prisma Client singleton pattern for serverless environments
// This prevents multiple instances in serverless functions (Vercel, etc.)
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Create Prisma Client with optimized settings
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
    // MongoDB connection pooling is handled automatically by Prisma
    // No need for explicit connection options like with native MongoDB driver
  });

// Store in global to reuse across serverless function invocations
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// Verify Prisma connection
export const verifyPrismaConnection = async (): Promise<boolean> => {
  try {
    await prisma.$connect();
    // Test with a simple MongoDB query
    await prisma.$runCommandRaw({ ping: 1 });
    return true;
  } catch (error) {
    console.error('Prisma connection verification failed:', error);
    return false;
  }
};

// Enhanced connection verification with detailed error information
export const verifyPrismaConnectionWithDetails = async (): Promise<{
  connected: boolean;
  error?: {
    message: string;
    name: string;
    code?: string;
    meta?: any;
  };
}> => {
  try {
    await prisma.$connect();
    // Test with a simple MongoDB query
    await prisma.$runCommandRaw({ ping: 1 });
    return { connected: true };
  } catch (error: any) {
    const errorDetails = {
      message: error.message || 'Unknown connection error',
      name: error.name || 'PrismaConnectionError',
      code: error.code,
      meta: error.meta || error.cause,
    };
    
    console.error('Prisma connection verification failed:', {
      ...errorDetails,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    });
    
    return {
      connected: false,
      error: errorDetails,
    };
  }
};

// Graceful shutdown handler
export const disconnectPrisma = async (): Promise<void> => {
  await prisma.$disconnect();
};

// Handle process termination
if (typeof process !== 'undefined') {
  process.on('beforeExit', async () => {
    await disconnectPrisma();
  });

  process.on('SIGINT', async () => {
    await disconnectPrisma();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    await disconnectPrisma();
    process.exit(0);
  });
}

