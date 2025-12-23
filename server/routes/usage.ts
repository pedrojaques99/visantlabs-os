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

    // Parallel execution: fetch records, count total, and calculate aggregate stats
    const [usageRecords, totalCount, statsAggregation] = await Promise.all([
      // 1. Fetch usage records with pagination
      db.collection('usage_records')
        .find(filter)
        .sort({ timestamp: -1 }) // Most recent first
        .skip(offset)
        .limit(limit)
        .toArray(),

      // 2. Get total count for pagination
      db.collection('usage_records').countDocuments(filter),

      // 3. Calculate global stats (ignoring pagination, but respecting user)
      db.collection('usage_records').aggregate([
        { $match: { userId } }, // Global stats for the user
        {
          $group: {
            _id: null,
            totalRecords: { $sum: 1 },
            totalCredits: { $sum: "$creditsDeducted" },
            // Group by feature
            mockupmachineCount: {
              $sum: { $cond: [{ $eq: ["$feature", "mockupmachine"] }, 1, 0] }
            },
            mockupmachineCredits: {
              $sum: { $cond: [{ $eq: ["$feature", "mockupmachine"] }, { $ifNull: ["$creditsDeducted", 0] }, 0] }
            },
            brandingmachineCount: {
              $sum: { $cond: [{ $eq: ["$feature", "brandingmachine"] }, 1, 0] }
            },
            brandingmachineCredits: {
              $sum: { $cond: [{ $eq: ["$feature", "brandingmachine"] }, { $ifNull: ["$creditsDeducted", 0] }, 0] }
            },
            canvasCount: {
              $sum: { $cond: [{ $eq: ["$feature", "canvas"] }, 1, 0] }
            },
            canvasCredits: {
              $sum: { $cond: [{ $eq: ["$feature", "canvas"] }, { $ifNull: ["$creditsDeducted", 0] }, 0] }
            },
            // Last 7 days
            last7DaysCount: {
              $sum: {
                $cond: [
                  { $gte: ["$timestamp", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)] },
                  1,
                  0
                ]
              }
            },
            last7DaysCredits: {
              $sum: {
                $cond: [
                  { $gte: ["$timestamp", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)] },
                  { $ifNull: ["$creditsDeducted", 0] },
                  0
                ]
              }
            },
            // Last 30 days
            last30DaysCount: {
              $sum: {
                $cond: [
                  { $gte: ["$timestamp", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)] },
                  1,
                  0
                ]
              }
            },
            last30DaysCredits: {
              $sum: {
                $cond: [
                  { $gte: ["$timestamp", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)] },
                  { $ifNull: ["$creditsDeducted", 0] },
                  0
                ]
              }
            }
          }
        }
      ]).toArray()
    ]);

    // Process aggregation result
    const statsData = statsAggregation[0] || {
      totalRecords: 0,
      totalCredits: 0,
      mockupmachineCount: 0,
      mockupmachineCredits: 0,
      brandingmachineCount: 0,
      brandingmachineCredits: 0,
      canvasCount: 0,
      canvasCredits: 0,
      last7DaysCount: 0,
      last7DaysCredits: 0,
      last30DaysCount: 0,
      last30DaysCredits: 0
    };

    // Format stats for frontend
    const stats = {
      totalRecords: statsData.totalRecords,
      totalCredits: statsData.totalCredits,
      byFeature: {
        mockupmachine: { count: statsData.mockupmachineCount, credits: statsData.mockupmachineCredits },
        brandingmachine: { count: statsData.brandingmachineCount, credits: statsData.brandingmachineCredits },
        canvas: { count: statsData.canvasCount, credits: statsData.canvasCredits },
      },
      last7Days: { count: statsData.last7DaysCount, credits: statsData.last7DaysCredits },
      last30Days: { count: statsData.last30DaysCount, credits: statsData.last30DaysCredits },
      // Note: byModel would require a separate aggregation facet if needed, skipping for now to keep query simple
      byModel: {},
    };

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
      stats,
    });
  } catch (error: any) {
    console.error('Error fetching usage history:', error);
    res.status(500).json({ error: 'Failed to fetch usage history' });
  }
});

export default router;







