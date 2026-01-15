import { ObjectId } from 'mongodb';
import { connectToMongoDB, getDb } from '../db/mongodb.js';

/**
 * Atomically increments a user's total generations and total tokens used.
 * This tracks every generation event regardless of credit usage.
 * 
 * @param userId The ID of the user to update
 * @param imageCount Number of images generated (optional)
 * @param tokenCount Number of tokens used (optional)
 */
export async function incrementUserGenerations(
    userId: string,
    imageCount: number = 0,
    tokenCount: number = 0
): Promise<void> {
    if (!userId || (imageCount === 0 && tokenCount === 0)) {
        return;
    }

    try {
        await connectToMongoDB();
        const db = getDb();

        const update: any = { $inc: {} };
        if (imageCount > 0) {
            update.$inc.totalGenerations = imageCount;
        }
        if (tokenCount > 0) {
            update.$inc.totalTokensUsed = tokenCount;
        }

        await db.collection('users').updateOne(
            { _id: new ObjectId(userId) },
            update
        );

        console.log(`[Stats Tracking] Incremented stats for user ${userId}: +${imageCount} images, +${tokenCount} tokens`);
    } catch (error) {
        console.error(`[Stats Tracking] Failed to increment stats for user ${userId}:`, error);
        // We don't throw here to avoid failing the main request if tracking fails
    }
}
