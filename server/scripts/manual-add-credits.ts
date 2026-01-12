
import { MongoClient, ObjectId } from 'mongodb';
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
    const credits = parseInt(args[1], 10);
    const amount = parseInt(args[2] || '0', 10); // Amount in cents

    if (!email || isNaN(credits)) {
        console.error('Usage: npx tsx server/scripts/manual-add-credits.ts <email> <credits> [amount_in_cents]');
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
        console.log(`Checking credits: Current Total Earned: ${user.totalCreditsEarned || 0}`);

        // Add credits
        const result = await db.collection('users').updateOne(
            { _id: user._id },
            { $inc: { totalCreditsEarned: credits } }
        );

        if (result.modifiedCount > 0) {
            console.log(`✅ Successfully added ${credits} credits to user.`);

            // Record transaction
            const transactionId = new ObjectId();
            await db.collection('transactions').insertOne({
                _id: transactionId,
                userId: user._id,
                type: 'purchase',
                status: 'succeeded', // Matching stripe status
                credits: credits,
                amount: amount,
                currency: 'BRL',
                description: 'Manual credit recovery (System Fix)',
                paymentMethod: 'credit_card', // Based on 'card' in JSON
                createdAt: new Date(),
                updatedAt: new Date(),
                // Add metadata to trace back to original loss
                metadata: {
                    reason: 'Recovery from failed webhook processing',
                    originalAmount: 2201
                }
            });

            console.log('✅ Recovery transaction recorded.');

            // Verify new balance
            const updatedUser = await db.collection('users').findOne({ _id: user._id });
            console.log(`📊 New Total Credits Earned: ${updatedUser?.totalCreditsEarned}`);

        } else {
            console.error('❌ Failed to update user credits.');
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await client.close();
    }
}

main();
