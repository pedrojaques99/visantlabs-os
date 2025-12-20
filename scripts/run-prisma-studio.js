import dotenv from 'dotenv';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '..');

// Load environment variables from .env.local first, then .env
dotenv.config({ path: resolve(rootDir, '.env.local') });
dotenv.config({ path: resolve(rootDir, '.env') });

// Check if MONGODB_URI is set
const mongoUri = process.env.MONGODB_URI;

if (!mongoUri || mongoUri === 'mongodb://localhost:27017') {
  console.warn('⚠️  WARNING: MONGODB_URI is not set or using default localhost:27017');
  console.warn('   Make sure you have:');
  console.warn('   1. Created a .env.local file in the root directory');
  console.warn('   2. Set MONGODB_URI to your MongoDB connection string');
  console.warn('   3. For MongoDB Atlas: mongodb+srv://username:password@cluster.mongodb.net/');
  console.warn('   4. For local MongoDB: Make sure MongoDB is running on localhost:27017');
  console.warn('');
  
  if (!mongoUri || mongoUri === 'mongodb://localhost:27017') {
    console.error('❌ Cannot start Prisma Studio without a valid MONGODB_URI');
    console.error('   Please set MONGODB_URI in your .env.local file');
    process.exit(1);
  }
}

// Mask password in URI for logging
const maskedUri = mongoUri ? mongoUri.replace(/:([^:@]+)@/, ':****@') : 'not set';
console.log('🔍 Starting Prisma Studio with:');
console.log(`   MONGODB_URI: ${maskedUri}`);
console.log('');

// Run Prisma Studio
try {
  execSync('npx prisma studio', {
    stdio: 'inherit',
    cwd: rootDir,
    env: process.env,
  });
} catch (error) {
  console.error('❌ Failed to start Prisma Studio');
  process.exit(1);
}

