import express from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { getDb, connectToMongoDB } from '../db/mongodb.js';
import { ObjectId } from 'mongodb';

const router = express.Router();

// Get usage history for authenticated user
router.get('/history', authenticate, async (req: AuthRequest, res) => {
  try {
    await connectToMongoDB();
    const db = getDb();
    const userId = req.userId!;

    // Parse query parameters
    const feature = req.query.feature as string | undefined; // Optional filter by feature
    const limit = parseInt(req.query.limit as string) || 50; // Default 50 records
    const offset = parseInt(req.query.offset as string) || 0; // Default offset 0

    // Build query filter
    const filter: any = { userId };
    if (feature && ['brandingmachine', 'mockupmachine', 'canvas'].includes(feature)) {
      filter.feature = feature;
    }

    // Fetch usage records with pagination
    const usageRecords = await db.collection('usage_records')
      .find(filter)
      .sort({ timestamp: -1 }) // Most recent first
      .skip(offset)
      .limit(limit)
      .toArray();

    // Get total count for pagination
    const totalCount = await db.collection('usage_records').countDocuments(filter);

    // Format response
    const formattedRecords = usageRecords.map((record: any) => ({
      id: record._id?.toString(),
      timestamp: record.timestamp,
      feature: record.feature || 'mockupmachine', // Default for backward compatibility
      creditsDeducted: record.creditsDeducted || 0,
      model: record.model,
      resolution: record.resolution,
      stepNumber: record.stepNumber, // Only for branding
      imagesGenerated: record.imagesGenerated || 1,
      type: record.type, // 'branding' or undefined
    }));

    res.json({
      records: formattedRecords,
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + limit < totalCount,
      },
    });
  } catch (error: any) {
    console.error('Error fetching usage history:', error);
    res.status(500).json({ error: 'Failed to fetch usage history' });
  }
});

export default router;







