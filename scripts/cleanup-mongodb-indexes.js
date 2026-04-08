import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error('MONGODB_URI not found in environment variables');
  process.exit(1);
}

async function run() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    const db = client.db('mockup-machine'); // Nome do banco visto no log do Prisma
    const users = db.collection('users');
    
    const indexesToDrop = [
      'users_username_key',
      'users_referralCode_key',
      'username_1',
      'referralCode_1'
    ];

    for (const indexName of indexesToDrop) {
      try {
        console.log(`Checking for index: ${indexName}...`);
        await users.dropIndex(indexName);
        console.log(`Dropped index: ${indexName}`);
      } catch (e) {
        if (e.codeName === 'IndexNotFound') {
          console.log(`Index ${indexName} not found, skipping.`);
        } else {
          console.error(`Error dropping ${indexName}:`, e.message);
        }
      }
    }

    // Agora criamos os índices esparsos (Safe & Unique)
    console.log('\nCreating sparse unique indexes...');
    
    await users.createIndex({ username: 1 }, { unique: true, sparse: true, name: 'users_username_sparse' });
    console.log('Created sparse unique index for username');
    
    await users.createIndex({ referralCode: 1 }, { unique: true, sparse: true, name: 'users_referralCode_sparse' });
    console.log('Created sparse unique index for referralCode');

    // Branding Guidelines slug
    const brandGuidelines = db.collection('brand_guidelines');
    try {
      await brandGuidelines.dropIndex('brand_guidelines_publicSlug_key');
    } catch (e) {}
    await brandGuidelines.createIndex({ publicSlug: 1 }, { unique: true, sparse: true, name: 'brand_guidelines_publicSlug_sparse' });
    console.log('Created sparse unique index for publicSlug');

    console.log('\nCleanup and optimization complete!');
  } finally {
    await client.close();
  }
}

run().catch(console.dir);
