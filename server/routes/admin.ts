import express from 'express';
import { prisma } from '../db/prisma.js';
import { connectToMongoDB, getDb } from '../db/mongodb.js';
import { ObjectId } from 'mongodb';
import { validateAdmin } from '../middleware/adminAuth.js';
import { AuthRequest } from '../middleware/auth.js';
import { rateLimit } from 'express-rate-limit';
import { calculateImageCost, calculateVideoCost, getImagePricing } from '../../utils/pricing.js';

const router = express.Router();

// Rate limiter for admin routes to prevent abuse
const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // Limit each IP to 300 requests per windowMs
  message: { error: 'Too many requests to admin endpoints, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Targeted rate limiter for expensive admin user queries
const adminUsersLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // Limit each IP to 10 requests per minute
  message: { error: 'Too many requests for user data, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiting to all admin routes
router.use(adminLimiter);

// Helper function to normalize tags
function normalizeTags(tags: any): string[] | undefined {
  if (tags === undefined || tags === null) return undefined;
  if (!Array.isArray(tags)) return undefined;
  const normalized = tags
    .filter(tag => typeof tag === 'string' && tag.trim().length > 0)
    .map(tag => tag.trim());
  return normalized.length > 0 ? normalized : undefined;
}

// Helper function to get resolution value from string (normalizes to 1K, 2K, 4K)
function normalizeResolution(resolution: string | undefined | null): string | undefined {
  if (!resolution) return undefined;
  const resLower = resolution.toLowerCase();
  if (resLower.includes('1k') || resLower === '1k') return '1K';
  if (resLower.includes('2k') || resLower === '2k') return '2K';
  if (resLower.includes('4k') || resLower === '4k' || resLower.includes('8k')) return '4K';
  return undefined;
}

// Helper function to determine if a resolution is high-res (>= 2048px in either dimension)
// Kept for backward compatibility, but prefer using normalizeResolution with getImagePricing
function isHighResolution(resolution: string | undefined | null): boolean {
  if (!resolution) return false;
  
  // Direct check for common high-res indicators
  const resLower = resolution.toLowerCase();
  if (resLower.includes('4k') || resLower.includes('8k')) return true;
  
  // Parse dimensions like "3840x2160", "2048x1024", etc.
  const dimensions = resolution.match(/(\d+)\s*[x*×,]\s*(\d+)/i);
  if (dimensions) {
    const width = parseInt(dimensions[1], 10);
    const height = parseInt(dimensions[2], 10);
    if (!isNaN(width) && !isNaN(height)) {
      return width >= 2048 || height >= 2048;
    }
  }
  
  // Fallback to numeric-only check for strings like "4096"
  const singleNumber = parseInt(resolution.replace(/\D/g, ''), 10);
  if (!isNaN(singleNumber) && singleNumber >= 2048) return true;
  
  return false;
}

// Admin status endpoint - checks auth and database connection
router.get('/status', validateAdmin, async (req: AuthRequest, res) => {
  try {
    // Auth status is already verified by validateAdmin middleware
    const authStatus = {
      authenticated: true,
      isAdmin: true,
      userId: req.userId,
      userEmail: req.userEmail,
    };

    // Check database connection
    let databaseStatus: {
      status: 'connected' | 'error';
      database?: string;
      error?: string;
    };

    try {
      await connectToMongoDB();
      const db = getDb();
      
      // Test connection with ping
      await db.admin().ping();
      
      databaseStatus = {
        status: 'connected',
        database: db.databaseName,
      };
    } catch (dbError: any) {
      databaseStatus = {
        status: 'error',
        error: dbError.message || 'Database connection failed',
      };
    }

    return res.json({
      auth: authStatus,
      database: databaseStatus,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Admin status check error:', error);
    return res.status(500).json({
      error: 'Failed to check admin status',
      message: error.message,
    });
  }
});

router.get('/users', adminUsersLimiter, validateAdmin, async (_req, res) => {
  try {
    // Connect to MongoDB for direct collection queries
    await connectToMongoDB();
    const db = getDb();

    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        name: true,
        picture: true,
        subscriptionStatus: true,
        subscriptionTier: true,
        monthlyCredits: true,
        creditsUsed: true,
        totalCreditsEarned: true,
        referralCode: true,
        referralCount: true,
        referredBy: true,
        storageUsedBytes: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Get counts for all users efficiently using Promise.all
    // Use MongoDB driver directly for mockups since they're saved directly to MongoDB
    const formattedUsers = await Promise.all(
      users.map(async (user) => {
        const monthlyCredits = user.monthlyCredits ?? 0;
        const creditsUsed = user.creditsUsed ?? 0;
        const totalCreditsEarned = user.totalCreditsEarned ?? 0;
        const creditsRemaining = Math.max(0, monthlyCredits - creditsUsed);

        // Count mockups using MongoDB driver directly (mockups are saved as strings, not ObjectIds)
        // Try both string userId and ObjectId userId to handle both cases
        const userIdString = user.id;
        const userIdObjectId = new ObjectId(userIdString);
        
        const [mockupCount, transactionCount, spendingByUser, userUsageAgg] = await Promise.all([
          db.collection('mockups').countDocuments({
            $or: [
              { userId: userIdString },
              { userId: userIdObjectId },
            ],
          }),
          prisma.transaction.count({
            where: { userId: user.id },
          }),
          prisma.transaction.groupBy({
            by: ['currency'],
            where: { 
              userId: user.id, 
              status: 'completed' 
            },
            _sum: { amount: true }
          }),
          // Aggregate usage by model/resolution for correct cost calculation
          db.collection('usage_records').aggregate([
            { $match: { userId: userIdString } },
            { $group: {
              _id: { model: '$model', resolution: '$resolution', type: '$type' },
              totalImages: { $sum: { $ifNull: ['$imagesGenerated', 0] } },
              totalVideos: { $sum: { $ifNull: ['$videosGenerated', 0] } }
            }}
          ]).toArray(),
        ]);

        const totalSpentBRL = spendingByUser.find(s => s.currency === 'BRL')?._sum.amount || 0;
        const totalSpentUSD = spendingByUser.find(s => s.currency === 'USD')?._sum.amount || 0;
        
        // Calculate API cost using centralized pricing
        let apiCostUSD = 0;
        for (const item of userUsageAgg) {
          const model = item._id.model || '';
          const resolution = item._id.resolution || '';
          const type = item._id.type || '';
          const imageCount = item.totalImages || 0;
          const videoCount = item.totalVideos || 0;
          
          // Video cost
          if (type === 'video' || videoCount > 0) {
            apiCostUSD += calculateVideoCost(videoCount || 1);
          }
          
          // Image cost based on model and resolution
          if (imageCount > 0) {
            const normalizedRes = normalizeResolution(resolution);
            apiCostUSD += calculateImageCost(imageCount, model, normalizedRes);
          }
        }

        return {
          ...user,
          creditsRemaining,
          manualCredits: totalCreditsEarned,
          mockupCount,
          transactionCount,
          totalSpentBRL,
          totalSpentUSD,
          apiCostUSD,
        };
      })
    );

    // Calculate total statistics
    const totalCreditsUsed = formattedUsers.reduce((sum, user) => sum + (user.creditsUsed || 0), 0);
    const totalStorageUsed = formattedUsers.reduce((sum, user) => sum + (user.storageUsedBytes || 0), 0);
    const totalReferralCount = formattedUsers.reduce((sum, user) => sum + (user.referralCount || 0), 0);
    const totalReferredUsers = formattedUsers.filter((user) => Boolean(user.referredBy)).length;
    const usersWithReferralCode = formattedUsers.filter((user) => Boolean(user.referralCode)).length;
    const totalMockupsSaved = await db.collection('mockups').countDocuments({});
    
    // Calculate total mockups generated
    // Use usage_records collection (most accurate), with fallback to creditsUsed if needed
    let totalMockupsGenerated = 0;
    let localDevelopmentImages = 0;
    try {
      // Use MongoDB aggregation for efficient calculation
      // Sum imagesGenerated field from all usage_records
      const aggregationResult = await db.collection('usage_records').aggregate([
        {
          $group: {
            _id: null,
            totalImages: {
              $sum: {
                $ifNull: ['$imagesGenerated', 0] // Use imagesGenerated (correct field name from UsageRecord interface)
              }
            },
            localDevImages: {
              $sum: {
                $cond: [
                  { $ifNull: ['$isLocalDevelopment', false] },
                  { $ifNull: ['$imagesGenerated', 0] },
                  0
                ]
              }
            },
            recordCount: { $sum: 1 }
          }
        }
      ]).toArray();
      
      if (aggregationResult.length > 0 && aggregationResult[0].totalImages > 0) {
        totalMockupsGenerated = aggregationResult[0].totalImages;
        localDevelopmentImages = aggregationResult[0].localDevImages || 0;
        console.log(`[Admin] Total mockups from usage_records: ${totalMockupsGenerated} (from ${aggregationResult[0].recordCount} records)`);
        if (localDevelopmentImages > 0) {
          console.log(`[Admin] Local development images: ${localDevelopmentImages} (included in total)`);
        }
      } else {
        // Collection exists but is empty or has no data, use creditsUsed as estimate
        // Most common: gemini-2.5-flash-image uses 1 credit per image
        // Conservative estimate: divide by 1.2 to account for some higher credit usage
        totalMockupsGenerated = totalCreditsUsed > 0 ? Math.round(totalCreditsUsed / 1.2) : 0;
        console.log(`[Admin] usage_records empty or no data, using creditsUsed estimate: ${totalMockupsGenerated} (from ${totalCreditsUsed} credits)`);
      }
    } catch (error: any) {
      // If usage_records doesn't exist or fails, use creditsUsed as fallback estimate
      console.log(`[Admin] usage_records error, using creditsUsed fallback: ${error.message}`);
      // Most common: gemini-2.5-flash-image uses 1 credit per image
      // Conservative estimate: divide by 1.2 to account for some higher credit usage
      totalMockupsGenerated = totalCreditsUsed > 0 ? Math.round(totalCreditsUsed / 1.2) : 0;
      console.log(`[Admin] Fallback calculation: ${totalMockupsGenerated} mockups from ${totalCreditsUsed} credits`);
    }
    
    // Ensure we have at least 0 (not negative or NaN)
    if (isNaN(totalMockupsGenerated) || totalMockupsGenerated < 0) {
      console.warn(`[Admin] Invalid totalMockupsGenerated value: ${totalMockupsGenerated}, setting to 0`);
      totalMockupsGenerated = 0;
    }
    
    console.log(`[Admin] Final stats - Users: ${formattedUsers.length}, Mockups Generated: ${totalMockupsGenerated}${localDevelopmentImages > 0 ? ` (${localDevelopmentImages} from local dev)` : ''}, Mockups Saved: ${totalMockupsSaved}, Credits Used: ${totalCreditsUsed}`);

    // Calculate detailed generation statistics
    const generationStats = await db.collection('usage_records').aggregate([
      {
        $facet: {
          // Images by model
          imagesByModel: [
            { $match: { imagesGenerated: { $exists: true, $gt: 0 } } },
            {
              $group: {
                _id: '$model',
                total: { $sum: '$imagesGenerated' },
                byResolution: {
                  $push: {
                    resolution: { $ifNull: ['$resolution', 'unknown'] },
                    count: '$imagesGenerated'
                  }
                }
              }
            }
          ],
          // Videos
          videos: [
            { $match: { type: 'video' } },
            {
              $group: {
                _id: null,
                total: { $sum: { $ifNull: ['$videosGenerated', 1] } },
                byModel: {
                  $push: {
                    model: { $ifNull: ['$model', 'unknown'] },
                    count: { $ifNull: ['$videosGenerated', 1] }
                  }
                }
              }
            }
          ],
          // Text tokens (branding)
          textTokens: [
            { $match: { type: 'branding' } },
            {
              $group: {
                _id: null,
                totalSteps: { $sum: 1 },
                totalPromptLength: { $sum: { $ifNull: ['$promptLength', 0] } },
                estimatedTokens: { $sum: { $ceil: { $divide: [{ $ifNull: ['$promptLength', 0] }, 4] } } },
                inputTokens: { $sum: { $ifNull: ['$inputTokens', 0] } },
                outputTokens: { $sum: { $ifNull: ['$outputTokens', 0] } }
              }
            }
          ],
          // Prompt generations
          promptGenerations: [
            { $match: { type: 'prompt-generation' } },
            {
              $group: {
                _id: null,
                total: { $sum: 1 },
                inputTokens: { $sum: { $ifNull: ['$inputTokens', 0] } },
                outputTokens: { $sum: { $ifNull: ['$outputTokens', 0] } }
              }
            }
          ],
          // By feature
          byFeature: [
            {
              $group: {
                _id: '$feature',
                images: { $sum: { $ifNull: ['$imagesGenerated', 0] } },
                videos: { $sum: { $cond: [{ $eq: ['$type', 'video'] }, { $ifNull: ['$videosGenerated', 1] }, 0] } },
                textSteps: { $sum: { $cond: [{ $eq: ['$type', 'branding'] }, 1, 0] } },
                promptGenerations: { $sum: { $cond: [{ $eq: ['$type', 'prompt-generation'] }, 1, 0] } }
              }
            }
          ]
        }
      }
    ]).toArray();

    // Process aggregation results
    const stats = generationStats[0] || {};
    
    // Process images by model
    const imagesByModel: any = {};
    for (const item of stats.imagesByModel || []) {
      const model = item._id || 'unknown';
      const byResolution: { [key: string]: number } = {};
      for (const res of item.byResolution || []) {
        const resolution = res.resolution || 'unknown';
        byResolution[resolution] = (byResolution[resolution] || 0) + (res.count || 0);
      }
      imagesByModel[model] = {
        total: item.total || 0,
        byResolution
      };
    }

    // Process videos
    const videos = stats.videos?.[0] || { total: 0, byModel: {} };
    const videosByModel: { [key: string]: number } = {};
    for (const item of videos.byModel || []) {
      const model = item.model || 'unknown';
      videosByModel[model] = (videosByModel[model] || 0) + (item.count || 0);
    }

    // Process text tokens
    const textTokens = stats.textTokens?.[0] || {
      totalSteps: 0,
      estimatedTokens: 0,
      totalPromptLength: 0,
      inputTokens: 0,
      outputTokens: 0
    };

    // Process prompt generations
    const promptGenerations = stats.promptGenerations?.[0] || {
      total: 0,
      inputTokens: 0,
      outputTokens: 0
    };

    // Process by feature
    const byFeature: any = {
      mockupmachine: { images: 0, videos: 0, textSteps: 0, promptGenerations: 0 },
      canvas: { images: 0, videos: 0, textSteps: 0, promptGenerations: 0 },
      brandingmachine: { images: 0, videos: 0, textSteps: 0, promptGenerations: 0 },
      'prompt-generation': { total: 0, inputTokens: 0, outputTokens: 0 }
    };
    for (const item of stats.byFeature || []) {
      const feature = item._id || 'unknown';
      if (feature === 'prompt-generation') {
        byFeature['prompt-generation'] = {
          total: item.promptGenerations || 0,
          inputTokens: 0,
          outputTokens: 0
        };
      } else if (byFeature[feature]) {
        byFeature[feature] = {
          images: item.images || 0,
          videos: item.videos || 0,
          textSteps: item.textSteps || 0,
          promptGenerations: item.promptGenerations || 0
        };
      }
    }

    // Add prompt generation tokens to the feature
    byFeature['prompt-generation'].inputTokens = promptGenerations.inputTokens || 0;
    byFeature['prompt-generation'].outputTokens = promptGenerations.outputTokens || 0;

    // Aggregate global revenue by currency
    const globalRevenue = await prisma.transaction.groupBy({
      by: ['currency'],
      where: { status: 'completed' },
      _sum: { amount: true }
    });

    const totalRevenueBRL = globalRevenue.find(r => r.currency === 'BRL')?._sum.amount || 0;
    const totalRevenueUSD = globalRevenue.find(r => r.currency === 'USD')?._sum.amount || 0;

    // Aggregate revenue time series (transactions by date)
    const revenueByDate = await prisma.transaction.groupBy({
      by: ['createdAt', 'currency'],
      where: { status: 'completed' },
      _sum: { amount: true },
      orderBy: { createdAt: 'asc' }
    });

    // Process revenue time series - group by date and sum BRL + USD (converted to cents)
    const revenueByDateMap: Record<string, { brl: number; usd: number }> = {};
    for (const item of revenueByDate) {
      const date = new Date(item.createdAt).toLocaleDateString('en-CA'); // YYYY-MM-DD
      if (!revenueByDateMap[date]) {
        revenueByDateMap[date] = { brl: 0, usd: 0 };
      }
      if (item.currency === 'BRL') {
        revenueByDateMap[date].brl += item._sum.amount || 0;
      } else if (item.currency === 'USD') {
        revenueByDateMap[date].usd += item._sum.amount || 0;
      }
    }

    // Convert to cumulative array
    const sortedRevenueDates = Object.keys(revenueByDateMap).sort();
    let cumulativeBRL = 0;
    let cumulativeUSD = 0;
    const revenueTimeSeries = sortedRevenueDates.map(date => {
      cumulativeBRL += revenueByDateMap[date].brl;
      cumulativeUSD += revenueByDateMap[date].usd;
      return {
        date,
        revenueBRL: revenueByDateMap[date].brl,
        revenueUSD: revenueByDateMap[date].usd,
        cumulativeBRL,
        cumulativeUSD
      };
    });

    // Aggregate global API cost with correct Gemini pricing
    const globalUsageAgg = await db.collection('usage_records').aggregate([
      { $group: {
        _id: { model: '$model', resolution: '$resolution', type: '$type' },
        totalImages: { $sum: { $ifNull: ['$imagesGenerated', 0] } },
        totalVideos: { $sum: { $ifNull: ['$videosGenerated', 0] } }
      }}
    ]).toArray();

    // Calculate total API cost using centralized pricing
    let totalApiCostUSD = 0;
    for (const item of globalUsageAgg) {
      const model = item._id.model || '';
      const resolution = item._id.resolution || '';
      const type = item._id.type || '';
      const imageCount = item.totalImages || 0;
      const videoCount = item.totalVideos || 0;
      
      // Video cost
      if (type === 'video' || videoCount > 0) {
        totalApiCostUSD += calculateVideoCost(videoCount || 1);
      }
      
      // Image cost based on model and resolution
      if (imageCount > 0) {
        const normalizedRes = normalizeResolution(resolution);
        totalApiCostUSD += calculateImageCost(imageCount, model, normalizedRes);
      }
    }

    // Aggregate cost time series (usage_records by date with cost calculation)
    const costByDateAgg = await db.collection('usage_records').aggregate([
      {
        $group: {
          _id: {
            date: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
            model: '$model',
            resolution: '$resolution',
            type: '$type'
          },
          totalImages: { $sum: { $ifNull: ['$imagesGenerated', 0] } },
          totalVideos: { $sum: { $ifNull: ['$videosGenerated', 0] } }
        }
      },
      { $sort: { '_id.date': 1 } }
    ]).toArray();

    // Calculate cost per date
    const costByDateMap: Record<string, number> = {};
    for (const item of costByDateAgg) {
      const date = item._id.date;
      const model = item._id.model || '';
      const resolution = item._id.resolution || '';
      const type = item._id.type || '';
      const imageCount = item.totalImages || 0;
      const videoCount = item.totalVideos || 0;

      if (!costByDateMap[date]) {
        costByDateMap[date] = 0;
      }

      // Video cost
      if (type === 'video' || videoCount > 0) {
        costByDateMap[date] += calculateVideoCost(videoCount || 1);
      }

      // Image cost based on model and resolution
      if (imageCount > 0) {
        const normalizedRes = normalizeResolution(resolution);
        costByDateMap[date] += calculateImageCost(imageCount, model, normalizedRes);
      }
    }

    // Convert to cumulative array
    const sortedCostDates = Object.keys(costByDateMap).sort();
    let cumulativeCost = 0;
    const costTimeSeries = sortedCostDates.map(date => {
      cumulativeCost += costByDateMap[date];
      return {
        date,
        cost: costByDateMap[date],
        cumulative: cumulativeCost
      };
    });

    return res.json({
      totalUsers: formattedUsers.length,
      totalMockupsGenerated,
      totalMockupsSaved,
      totalCreditsUsed,
      totalStorageUsed,
      totalRevenueBRL,
      totalRevenueUSD,
      totalApiCostUSD,
      referralStats: {
        totalReferralCount,
        totalReferredUsers,
        usersWithReferralCode,
      },
      users: formattedUsers,
      generationStats: {
        imagesByModel,
        videos: {
          total: videos.total || 0,
          byModel: videosByModel
        },
        textTokens: {
          totalSteps: textTokens.totalSteps || 0,
          estimatedTokens: textTokens.estimatedTokens || 0,
          totalPromptLength: textTokens.totalPromptLength || 0,
          inputTokens: textTokens.inputTokens || 0,
          outputTokens: textTokens.outputTokens || 0
        },
        byFeature
      },
      revenueTimeSeries,
      costTimeSeries
    });
  } catch (error) {
    console.error('Failed to load admin users:', error);
    return res.status(500).json({ error: 'Failed to load users' });
  }
});

// Public endpoint to get presets (for frontend services)
router.get('/presets/public', async (_req, res) => {
  try {
    await connectToMongoDB();
    const db = getDb();

    const [mockupPresets, anglePresets, texturePresets, ambiencePresets, luminancePresets] = await Promise.all([
      db.collection('mockup_presets').find({}).toArray(),
      db.collection('angle_presets').find({}).toArray(),
      db.collection('texture_presets').find({}).toArray(),
      db.collection('ambience_presets').find({}).toArray(),
      db.collection('luminance_presets').find({}).toArray(),
    ]);

    return res.json({
      mockupPresets,
      anglePresets,
      texturePresets,
      ambiencePresets,
      luminancePresets,
    });
  } catch (error) {
    console.error('Failed to load presets:', error);
    // Return empty arrays on error, services will use TypeScript fallback
    return res.json({
      mockupPresets: [],
      anglePresets: [],
      texturePresets: [],
      ambiencePresets: [],
      luminancePresets: [],
    });
  }
});

// Presets CRUD endpoints (admin only)
router.get('/presets', validateAdmin, async (_req, res) => {
  try {
    await connectToMongoDB();
    const db = getDb();

    const [mockupPresets, anglePresets, texturePresets, ambiencePresets, luminancePresets] = await Promise.all([
      db.collection('mockup_presets').find({}).toArray(),
      db.collection('angle_presets').find({}).toArray(),
      db.collection('texture_presets').find({}).toArray(),
      db.collection('ambience_presets').find({}).toArray(),
      db.collection('luminance_presets').find({}).toArray(),
    ]);

    return res.json({
      mockupPresets,
      anglePresets,
      texturePresets,
      ambiencePresets,
      luminancePresets,
    });
  } catch (error) {
    console.error('Failed to load presets:', error);
    return res.status(500).json({ error: 'Failed to load presets' });
  }
});

// Mockup Presets
router.get('/presets/mockup/:id', validateAdmin, async (req, res) => {
  try {
    await connectToMongoDB();
    const db = getDb();
    const preset = await db.collection('mockup_presets').findOne({ id: req.params.id });
    
    if (!preset) {
      return res.status(404).json({ error: 'Preset not found' });
    }
    
    return res.json(preset);
  } catch (error) {
    console.error('Failed to load mockup preset:', error);
    return res.status(500).json({ error: 'Failed to load preset' });
  }
});

router.post('/presets/mockup', validateAdmin, async (req, res) => {
  try {
    await connectToMongoDB();
    const db = getDb();
    
    const { id, name, description, prompt, referenceImageUrl, aspectRatio, model, tags } = req.body;
    
    // Validation
    if (!id || !name || !description || !prompt || !aspectRatio) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Check if ID already exists
    const existing = await db.collection('mockup_presets').findOne({ id });
    if (existing) {
      return res.status(409).json({ error: 'Preset with this ID already exists' });
    }
    
    const preset = {
      id,
      name,
      description,
      prompt,
      referenceImageUrl: referenceImageUrl || '',
      aspectRatio,
      model: model || undefined,
      tags: normalizeTags(tags),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    await db.collection('mockup_presets').insertOne(preset);
    
    // Create unique index on id if it doesn't exist
    try {
      await db.collection('mockup_presets').createIndex({ id: 1 }, { unique: true });
    } catch (e) {
      // Index might already exist, ignore
    }
    
    return res.status(201).json(preset);
  } catch (error: any) {
    console.error('Failed to create mockup preset:', error);
    if (error.code === 11000) {
      return res.status(409).json({ error: 'Preset with this ID already exists' });
    }
    return res.status(500).json({ error: 'Failed to create preset' });
  }
});

router.post('/presets/mockup/batch', validateAdmin, async (req, res) => {
  try {
    await connectToMongoDB();
    const db = getDb();
    
    const { presets } = req.body;
    
    // Validation: must be an array
    if (!Array.isArray(presets)) {
      return res.status(400).json({ error: 'presets must be an array' });
    }
    
    if (presets.length === 0) {
      return res.status(400).json({ error: 'presets array cannot be empty' });
    }
    
    const validAspectRatios = ['9:16', '21:9', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '16:9', '1:1'];
    const validModels = ['gemini-2.5-flash-image', 'gemini-3-pro-image-preview'];
    
    const errors: Array<{ index: number; id?: string; error: string }> = [];
    const validPresets: any[] = [];
    const seenIds = new Set<string>();
    
    // Validate each preset
    for (let i = 0; i < presets.length; i++) {
      const preset = presets[i];
      const index = i + 1; // 1-based index for user-friendly error messages
      
      // Check required fields
      if (!preset.id || typeof preset.id !== 'string') {
        errors.push({ index, error: 'Missing or invalid id field' });
        continue;
      }
      
      if (!preset.name || typeof preset.name !== 'string') {
        errors.push({ index, id: preset.id, error: 'Missing or invalid name field' });
        continue;
      }
      
      if (!preset.description || typeof preset.description !== 'string') {
        errors.push({ index, id: preset.id, error: 'Missing or invalid description field' });
        continue;
      }
      
      if (!preset.prompt || typeof preset.prompt !== 'string') {
        errors.push({ index, id: preset.id, error: 'Missing or invalid prompt field' });
        continue;
      }
      
      if (!preset.aspectRatio || typeof preset.aspectRatio !== 'string') {
        errors.push({ index, id: preset.id, error: 'Missing or invalid aspectRatio field' });
        continue;
      }
      
      // Check for duplicate IDs within the batch
      if (seenIds.has(preset.id)) {
        errors.push({ index, id: preset.id, error: 'Duplicate ID within batch' });
        continue;
      }
      seenIds.add(preset.id);
      
      // Validate aspect ratio
      if (!validAspectRatios.includes(preset.aspectRatio)) {
        errors.push({ index, id: preset.id, error: `Invalid aspectRatio. Must be one of: ${validAspectRatios.join(', ')}` });
        continue;
      }
      
      // Validate model if provided
      if (preset.model && !validModels.includes(preset.model)) {
        errors.push({ index, id: preset.id, error: `Invalid model. Must be one of: ${validModels.join(', ')}` });
        continue;
      }
      
      // Build valid preset object
      validPresets.push({
        id: preset.id,
        name: preset.name,
        description: preset.description,
        prompt: preset.prompt,
        referenceImageUrl: preset.referenceImageUrl || '',
        aspectRatio: preset.aspectRatio,
        model: preset.model || undefined,
        tags: normalizeTags(preset.tags),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
    
    // Check for existing IDs in database
    if (validPresets.length > 0) {
      const idsToCheck = validPresets.map(p => p.id);
      const existingPresets = await db.collection('mockup_presets').find({
        id: { $in: idsToCheck }
      }).toArray();
      
      const existingIds = new Set(existingPresets.map(p => p.id));
      
      // Remove presets with existing IDs from validPresets and add to errors
      const validPresetsFiltered: any[] = [];
      for (let i = 0; i < validPresets.length; i++) {
        const preset = validPresets[i];
        const originalIndex = presets.findIndex((p: any) => p.id === preset.id) + 1;
        
        if (existingIds.has(preset.id)) {
          errors.push({ index: originalIndex, id: preset.id, error: 'ID already exists in database' });
        } else {
          validPresetsFiltered.push(preset);
        }
      }
      
      // Insert valid presets
      let created = 0;
      if (validPresetsFiltered.length > 0) {
        try {
          // Create unique index on id if it doesn't exist
          try {
            await db.collection('mockup_presets').createIndex({ id: 1 }, { unique: true });
          } catch (e) {
            // Index might already exist, ignore
          }
          
          const result = await db.collection('mockup_presets').insertMany(validPresetsFiltered, { ordered: false });
          created = result.insertedCount;
        } catch (error: any) {
          // Handle partial insertions
          if (error.code === 11000 || error.writeErrors) {
            // Some documents were inserted, count them
            created = error.insertedCount || 0;
            // Add errors for duplicates that weren't caught earlier
            if (error.writeErrors) {
              for (const writeError of error.writeErrors) {
                const failedId = validPresetsFiltered[writeError.index]?.id;
                const originalIndex = presets.findIndex((p: any) => p.id === failedId) + 1;
                errors.push({ index: originalIndex, id: failedId, error: 'ID already exists in database' });
              }
            }
          } else {
            throw error;
          }
        }
      }
      
      return res.json({
        success: true,
        created,
        failed: errors.length,
        errors,
      });
    } else {
      return res.status(400).json({
        success: false,
        created: 0,
        failed: errors.length,
        errors,
      });
    }
  } catch (error: any) {
    console.error('Failed to create mockup presets batch:', error);
    return res.status(500).json({ error: 'Failed to create presets batch', details: error.message });
  }
});

router.put('/presets/mockup/:id', validateAdmin, async (req, res) => {
  try {
    await connectToMongoDB();
    const db = getDb();
    
    const { name, description, prompt, referenceImageUrl, aspectRatio, model, tags } = req.body;
    
    // Validation
    if (!name || !description || !prompt || !aspectRatio) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const update: any = {
      name,
      description,
      prompt,
      referenceImageUrl: referenceImageUrl || '',
      aspectRatio,
      model: model || undefined,
      updatedAt: new Date().toISOString(),
    };
    
    if (tags !== undefined) {
      update.tags = normalizeTags(tags);
    }
    
    const result = await db.collection('mockup_presets').findOneAndUpdate(
      { id: req.params.id },
      { $set: update },
      { returnDocument: 'after' }
    );
    
    if (!result) {
      return res.status(404).json({ error: 'Preset not found' });
    }
    
    return res.json(result);
  } catch (error) {
    console.error('Failed to update mockup preset:', error);
    return res.status(500).json({ error: 'Failed to update preset' });
  }
});

router.delete('/presets/mockup/:id', validateAdmin, async (req, res) => {
  try {
    await connectToMongoDB();
    const db = getDb();
    
    const result = await db.collection('mockup_presets').deleteOne({ id: req.params.id });
    
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Preset not found' });
    }
    
    return res.json({ success: true });
  } catch (error) {
    console.error('Failed to delete mockup preset:', error);
    return res.status(500).json({ error: 'Failed to delete preset' });
  }
});

// Upload preset reference image to R2
router.post('/presets/mockup/:id/upload-image', validateAdmin, async (req, res) => {
  try {
    const { base64Image } = req.body;
    const presetId = req.params.id;
    
    if (!base64Image) {
      return res.status(400).json({ error: 'base64Image is required' });
    }
    
    if (!presetId) {
      return res.status(400).json({ error: 'Preset ID is required' });
    }
    
    const r2Service = await import('../../services/r2Service.js');
    
    if (!r2Service.isR2Configured()) {
      return res.status(500).json({ 
        error: 'R2 storage is not configured',
        details: 'R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, and R2_PUBLIC_URL must be set.'
      });
    }
    
    const imageUrl = await r2Service.uploadMockupPresetReference(base64Image, presetId);
    
    return res.json({ url: imageUrl });
  } catch (error: any) {
    console.error('Failed to upload preset reference image:', error);
    return res.status(500).json({ 
      error: 'Failed to upload image',
      details: error.message || 'Unknown error'
    });
  }
});

// Angle Presets
router.get('/presets/angle/:id', validateAdmin, async (req, res) => {
  try {
    await connectToMongoDB();
    const db = getDb();
    const preset = await db.collection('angle_presets').findOne({ id: req.params.id });
    
    if (!preset) {
      return res.status(404).json({ error: 'Preset not found' });
    }
    
    return res.json(preset);
  } catch (error) {
    console.error('Failed to load angle preset:', error);
    return res.status(500).json({ error: 'Failed to load preset' });
  }
});

router.post('/presets/angle', validateAdmin, async (req, res) => {
  try {
    await connectToMongoDB();
    const db = getDb();
    
    const { id, name, description, prompt, aspectRatio, model, tags } = req.body;
    
    // Validation
    if (!id || !name || !description || !prompt || !aspectRatio) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Check if ID already exists
    const existing = await db.collection('angle_presets').findOne({ id });
    if (existing) {
      return res.status(409).json({ error: 'Preset with this ID already exists' });
    }
    
    const preset = {
      id,
      name,
      description,
      prompt,
      aspectRatio,
      model: model || undefined,
      tags: normalizeTags(tags),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    await db.collection('angle_presets').insertOne(preset);
    
    // Create unique index on id if it doesn't exist
    try {
      await db.collection('angle_presets').createIndex({ id: 1 }, { unique: true });
    } catch (e) {
      // Index might already exist, ignore
    }
    
    return res.status(201).json(preset);
  } catch (error: any) {
    console.error('Failed to create angle preset:', error);
    if (error.code === 11000) {
      return res.status(409).json({ error: 'Preset with this ID already exists' });
    }
    return res.status(500).json({ error: 'Failed to create preset' });
  }
});

router.put('/presets/angle/:id', validateAdmin, async (req, res) => {
  try {
    await connectToMongoDB();
    const db = getDb();
    
    const { name, description, prompt, aspectRatio, model, tags } = req.body;
    
    // Validation
    if (!name || !description || !prompt || !aspectRatio) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const update: any = {
      name,
      description,
      prompt,
      aspectRatio,
      model: model || undefined,
      updatedAt: new Date().toISOString(),
    };
    
    if (tags !== undefined) {
      update.tags = normalizeTags(tags);
    }
    
    const result = await db.collection('angle_presets').findOneAndUpdate(
      { id: req.params.id },
      { $set: update },
      { returnDocument: 'after' }
    );
    
    if (!result) {
      return res.status(404).json({ error: 'Preset not found' });
    }
    
    return res.json(result);
  } catch (error) {
    console.error('Failed to update angle preset:', error);
    return res.status(500).json({ error: 'Failed to update preset' });
  }
});

router.delete('/presets/angle/:id', validateAdmin, async (req, res) => {
  try {
    await connectToMongoDB();
    const db = getDb();
    
    const result = await db.collection('angle_presets').deleteOne({ id: req.params.id });
    
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Preset not found' });
    }
    
    return res.json({ success: true });
  } catch (error) {
    console.error('Failed to delete angle preset:', error);
    return res.status(500).json({ error: 'Failed to delete preset' });
  }
});

// Texture Presets
router.get('/presets/texture/:id', validateAdmin, async (req, res) => {
  try {
    await connectToMongoDB();
    const db = getDb();
    const preset = await db.collection('texture_presets').findOne({ id: req.params.id });
    
    if (!preset) {
      return res.status(404).json({ error: 'Preset not found' });
    }
    
    return res.json(preset);
  } catch (error) {
    console.error('Failed to load texture preset:', error);
    return res.status(500).json({ error: 'Failed to load preset' });
  }
});

router.post('/presets/texture', validateAdmin, async (req, res) => {
  try {
    await connectToMongoDB();
    const db = getDb();
    
    const { id, name, description, prompt, aspectRatio, model, tags } = req.body;
    
    if (!id || !name || !description || !prompt || !aspectRatio) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const existing = await db.collection('texture_presets').findOne({ id });
    if (existing) {
      return res.status(409).json({ error: 'Preset with this ID already exists' });
    }
    
    const preset = {
      id,
      name,
      description,
      prompt,
      aspectRatio,
      model: model || undefined,
      tags: normalizeTags(tags),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    await db.collection('texture_presets').insertOne(preset);
    
    try {
      await db.collection('texture_presets').createIndex({ id: 1 }, { unique: true });
    } catch (e) {
      // Index might already exist, ignore
    }
    
    return res.status(201).json(preset);
  } catch (error: any) {
    console.error('Failed to create texture preset:', error);
    if (error.code === 11000) {
      return res.status(409).json({ error: 'Preset with this ID already exists' });
    }
    return res.status(500).json({ error: 'Failed to create preset' });
  }
});

router.put('/presets/texture/:id', validateAdmin, async (req, res) => {
  try {
    await connectToMongoDB();
    const db = getDb();
    
    const { name, description, prompt, aspectRatio, model, tags } = req.body;
    
    if (!name || !description || !prompt || !aspectRatio) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const update: any = {
      name,
      description,
      prompt,
      aspectRatio,
      model: model || undefined,
      updatedAt: new Date().toISOString(),
    };
    
    if (tags !== undefined) {
      update.tags = normalizeTags(tags);
    }
    
    const result = await db.collection('texture_presets').findOneAndUpdate(
      { id: req.params.id },
      { $set: update },
      { returnDocument: 'after' }
    );
    
    if (!result) {
      return res.status(404).json({ error: 'Preset not found' });
    }
    
    return res.json(result);
  } catch (error) {
    console.error('Failed to update texture preset:', error);
    return res.status(500).json({ error: 'Failed to update preset' });
  }
});

router.delete('/presets/texture/:id', validateAdmin, async (req, res) => {
  try {
    await connectToMongoDB();
    const db = getDb();
    
    const result = await db.collection('texture_presets').deleteOne({ id: req.params.id });
    
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Preset not found' });
    }
    
    return res.json({ success: true });
  } catch (error) {
    console.error('Failed to delete texture preset:', error);
    return res.status(500).json({ error: 'Failed to delete preset' });
  }
});

// Ambience Presets
router.get('/presets/ambience/:id', validateAdmin, async (req, res) => {
  try {
    await connectToMongoDB();
    const db = getDb();
    const preset = await db.collection('ambience_presets').findOne({ id: req.params.id });
    
    if (!preset) {
      return res.status(404).json({ error: 'Preset not found' });
    }
    
    return res.json(preset);
  } catch (error) {
    console.error('Failed to load ambience preset:', error);
    return res.status(500).json({ error: 'Failed to load preset' });
  }
});

router.post('/presets/ambience', validateAdmin, async (req, res) => {
  try {
    await connectToMongoDB();
    const db = getDb();
    
    const { id, name, description, prompt, aspectRatio, model, tags } = req.body;
    
    if (!id || !name || !description || !prompt || !aspectRatio) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const existing = await db.collection('ambience_presets').findOne({ id });
    if (existing) {
      return res.status(409).json({ error: 'Preset with this ID already exists' });
    }
    
    const preset = {
      id,
      name,
      description,
      prompt,
      aspectRatio,
      model: model || undefined,
      tags: normalizeTags(tags),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    await db.collection('ambience_presets').insertOne(preset);
    
    try {
      await db.collection('ambience_presets').createIndex({ id: 1 }, { unique: true });
    } catch (e) {
      // Index might already exist, ignore
    }
    
    return res.status(201).json(preset);
  } catch (error: any) {
    console.error('Failed to create ambience preset:', error);
    if (error.code === 11000) {
      return res.status(409).json({ error: 'Preset with this ID already exists' });
    }
    return res.status(500).json({ error: 'Failed to create preset' });
  }
});

router.put('/presets/ambience/:id', validateAdmin, async (req, res) => {
  try {
    await connectToMongoDB();
    const db = getDb();
    
    const { name, description, prompt, aspectRatio, model, tags } = req.body;
    
    if (!name || !description || !prompt || !aspectRatio) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const update: any = {
      name,
      description,
      prompt,
      aspectRatio,
      model: model || undefined,
      updatedAt: new Date().toISOString(),
    };
    
    if (tags !== undefined) {
      update.tags = normalizeTags(tags);
    }
    
    const result = await db.collection('ambience_presets').findOneAndUpdate(
      { id: req.params.id },
      { $set: update },
      { returnDocument: 'after' }
    );
    
    if (!result) {
      return res.status(404).json({ error: 'Preset not found' });
    }
    
    return res.json(result);
  } catch (error) {
    console.error('Failed to update ambience preset:', error);
    return res.status(500).json({ error: 'Failed to update preset' });
  }
});

router.delete('/presets/ambience/:id', validateAdmin, async (req, res) => {
  try {
    await connectToMongoDB();
    const db = getDb();
    
    const result = await db.collection('ambience_presets').deleteOne({ id: req.params.id });
    
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Preset not found' });
    }
    
    return res.json({ success: true });
  } catch (error) {
    console.error('Failed to delete ambience preset:', error);
    return res.status(500).json({ error: 'Failed to delete preset' });
  }
});

// Luminance Presets
router.get('/presets/luminance/:id', validateAdmin, async (req, res) => {
  try {
    await connectToMongoDB();
    const db = getDb();
    const preset = await db.collection('luminance_presets').findOne({ id: req.params.id });
    
    if (!preset) {
      return res.status(404).json({ error: 'Preset not found' });
    }
    
    return res.json(preset);
  } catch (error) {
    console.error('Failed to load luminance preset:', error);
    return res.status(500).json({ error: 'Failed to load preset' });
  }
});

router.post('/presets/luminance', validateAdmin, async (req, res) => {
  try {
    await connectToMongoDB();
    const db = getDb();
    
    const { id, name, description, prompt, aspectRatio, model, tags } = req.body;
    
    if (!id || !name || !description || !prompt || !aspectRatio) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const existing = await db.collection('luminance_presets').findOne({ id });
    if (existing) {
      return res.status(409).json({ error: 'Preset with this ID already exists' });
    }
    
    const preset = {
      id,
      name,
      description,
      prompt,
      aspectRatio,
      model: model || undefined,
      tags: normalizeTags(tags),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    await db.collection('luminance_presets').insertOne(preset);
    
    try {
      await db.collection('luminance_presets').createIndex({ id: 1 }, { unique: true });
    } catch (e) {
      // Index might already exist, ignore
    }
    
    return res.status(201).json(preset);
  } catch (error: any) {
    console.error('Failed to create luminance preset:', error);
    if (error.code === 11000) {
      return res.status(409).json({ error: 'Preset with this ID already exists' });
    }
    return res.status(500).json({ error: 'Failed to create preset' });
  }
});

router.put('/presets/luminance/:id', validateAdmin, async (req, res) => {
  try {
    await connectToMongoDB();
    const db = getDb();
    
    const { name, description, prompt, aspectRatio, model, tags } = req.body;
    
    if (!name || !description || !prompt || !aspectRatio) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const update: any = {
      name,
      description,
      prompt,
      aspectRatio,
      model: model || undefined,
      updatedAt: new Date().toISOString(),
    };
    
    if (tags !== undefined) {
      update.tags = normalizeTags(tags);
    }
    
    const result = await db.collection('luminance_presets').findOneAndUpdate(
      { id: req.params.id },
      { $set: update },
      { returnDocument: 'after' }
    );
    
    if (!result) {
      return res.status(404).json({ error: 'Preset not found' });
    }
    
    return res.json(result);
  } catch (error) {
    console.error('Failed to update luminance preset:', error);
    return res.status(500).json({ error: 'Failed to update preset' });
  }
});

router.delete('/presets/luminance/:id', validateAdmin, async (req, res) => {
  try {
    await connectToMongoDB();
    const db = getDb();
    
    const result = await db.collection('luminance_presets').deleteOne({ id: req.params.id });
    
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Preset not found' });
    }
    
    return res.json({ success: true });
  } catch (error) {
    console.error('Failed to delete luminance preset:', error);
    return res.status(500).json({ error: 'Failed to delete preset' });
  }
});

// Community Presets Moderation
router.delete('/community-presets/:id', validateAdmin, async (req, res) => {
  try {
    await connectToMongoDB();
    const db = getDb();
    
    const result = await db.collection('community_presets').deleteOne({ id: req.params.id });
    
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Community preset not found' });
    }
    
    return res.json({ success: true });
  } catch (error) {
    console.error('Failed to delete community preset:', error);
    return res.status(500).json({ error: 'Failed to delete community preset' });
  }
});

router.put('/community-presets/:id/approve', validateAdmin, async (req, res) => {
  try {
    await connectToMongoDB();
    const db = getDb();
    
    const { isApproved } = req.body;
    
    const result = await db.collection('community_presets').updateOne(
      { id: req.params.id },
      { $set: { isApproved: isApproved !== false, updatedAt: new Date().toISOString() } }
    );
    
    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Community preset not found' });
    }
    
    const updated = await db.collection('community_presets').findOne({ id: req.params.id });
    
    return res.json(updated);
  } catch (error) {
    console.error('Failed to update community preset approval:', error);
    return res.status(500).json({ error: 'Failed to update community preset approval' });
  }
});

export default router;

