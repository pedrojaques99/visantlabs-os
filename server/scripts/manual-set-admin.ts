import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';
import path from 'path';

// Load env vars from root
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI is not defined in .env');
  process.exit(1);
}

async function main() {
  const args = process.argv.slice(2);
  const email = args[0];
  const flagArg = args[1] ?? 'true';
  const value = flagArg !== 'false';

  if (!email) {
    console.error('Usage: npx tsx server/scripts/manual-set-admin.ts <email> [true|false]');
    process.exit(1);
  }

  const client = new MongoClient(MONGODB_URI!);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');

    const db = client.db();
    const user = await db.collection('users').findOne({ email });

    if (!user) {
      console.error(`❌ User not found with email: ${email}`);
      process.exit(1);
    }

    console.log(`👤 Found user: ${user.name || 'No Name'} (${user._id})`);
    console.log(`Current isAdmin: ${user.isAdmin === true}`);

    const result = await db
      .collection('users')
      .updateOne({ _id: user._id }, { $set: { isAdmin: value } });

    if (result.modifiedCount > 0) {
      console.log(`✅ isAdmin set to ${value} for ${email}.`);
    } else {
      console.log(`ℹ️ Nothing changed — isAdmin já era ${value}.`);
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

main();
