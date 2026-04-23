import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const uri = process.env.MONGODB_URI;

if (!uri) {
    console.error('MONGODB_URI not found');
    process.exit(1);
}

async function main() {
    const client = new MongoClient(uri);
    try {
        await client.connect();
        const db = client.db();
        const collection = db.collection('app_configs');
        
        const now = new Date();
        console.log('Fixing app_configs data...');
        
        const result = await collection.updateMany(
            { $or: [ { createdAt: null }, { createdAt: { $exists: false } } ] },
            { $set: { createdAt: now, updatedAt: now } }
        );
        
        console.log(`Matched ${result.matchedCount} documents, updated ${result.modifiedCount} documents.`);
        
        const result2 = await collection.updateMany(
            { updatedAt: null },
            { $set: { updatedAt: now } }
        );
        console.log(`Updated updatedAt for ${result2.modifiedCount} documents.`);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await client.close();
    }
}

main();
