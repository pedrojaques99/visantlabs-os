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
        
        const apps = await collection.find({}).toArray();
        console.log(`Found ${apps.length} apps.`);
        
        apps.forEach((app, index) => {
            console.log(`App ${index + 1}: ${app.appId}`);
            const missing = [];
            if (!app.name) missing.push('name');
            if (!app.description) missing.push('description');
            if (!app.link) missing.push('link');
            if (missing.length > 0) {
                console.log(`  MISSING FIELDS: ${missing.join(', ')}`);
            }
        });

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await client.close();
    }
}

main();
