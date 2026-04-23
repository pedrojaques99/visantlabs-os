import { connectToMongoDB, getCollection } from '../server/db/mongodb.js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

async function main() {
    try {
        console.log('Connecting to MongoDB...');
        await connectToMongoDB();
        const collection = getCollection('app_configs');
        
        console.log('Finding documents with missing createdAt...');
        const missing = await collection.find({ createdAt: { $exists: false } }).toArray();
        console.log(`Found ${missing.length} documents missing createdAt`);
        
        if (missing.length > 0) {
            console.log('Updating documents...');
            const now = new Date();
            const result = await collection.updateMany(
                { createdAt: { $exists: false } },
                { $set: { createdAt: now, updatedAt: now } }
            );
            console.log(`Updated ${result.modifiedCount} documents`);
        }

        console.log('Finding documents with null createdAt...');
        const nulled = await collection.find({ createdAt: null }).toArray();
        console.log(`Found ${nulled.length} documents with null createdAt`);

        if (nulled.length > 0) {
            console.log('Updating documents with null createdAt...');
            const now = new Date();
             const result = await collection.updateMany(
                { createdAt: null },
                { $set: { createdAt: now, updatedAt: now } }
            );
            console.log(`Updated ${result.modifiedCount} documents`);
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        process.exit(0);
    }
}

main();
