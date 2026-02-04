
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Manually load .env files to ensure environment is set
const loadEnv = () => {
    const cwd = process.cwd();
    const envLocal = path.join(cwd, '.env.local');
    const env = path.join(cwd, '.env');

    if (fs.existsSync(envLocal)) {
        console.log('Loading .env.local');
        dotenv.config({ path: envLocal });
    } else if (fs.existsSync(env)) {
        console.log('Loading .env');
        dotenv.config({ path: env });
    } else {
        console.error('No .env file found!');
    }
};

loadEnv();

console.log('--- Environment Check ---');
console.log('MONGODB_URI:', process.env.MONGODB_URI ? 'Set (masked)' : 'NOT SET');
console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'Set (masked)' : 'NOT SET');

async function testNativeMongo() {
    console.log('\n--- Testing Native MongoDB Connection ---');
    try {
        // Dynamic import to avoid issues if module loading fails
        const { connectToMongoDB, closeConnection } = await import('../db/mongodb.js');
        await connectToMongoDB();
        console.log('✅ Native MongoDB Connected successfully!');
        await closeConnection();
    } catch (error: any) {
        console.error('❌ Native MongoDB Connection Failed:');
        console.error(error.message);
        if (error.cause) console.error('Cause:', error.cause);
    }
}

async function testPrisma() {
    console.log('\n--- Testing Prisma Connection ---');
    try {
        const { prisma } = await import('../db/prisma.js');
        await prisma.$connect();
        console.log('✅ Prisma Connected successfully!');

        // Try a simple query
        const count = await prisma.user.count();
        console.log(`✅ Prisma Query Success: Found ${count} users.`);

        await prisma.$disconnect();
    } catch (error: any) {
        console.error('❌ Prisma Connection Failed:');
        console.error(error.message);
        if (error.code) console.error('Error Code:', error.code);
    }
}

async function main() {
    await testNativeMongo();
    await testPrisma();
    process.exit(0);
}

main().catch(console.error);
