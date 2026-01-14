import express from 'express';
import { getDb, connectToMongoDB } from '../db/mongodb.js';
import { ObjectId } from 'mongodb';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { prisma } from '../db/prisma.js';
import { checkSubscription, SubscriptionRequest } from '../middleware/subscription.js';
import { generateMockup, RateLimitError } from '@/services/geminiService.js';
import { getCreditsRequired } from '../utils/usageTracking.js';
import type { UploadedImage, AspectRatio, GeminiModel, Resolution } from '@/types/types.js';

const router = express.Router();

// Helper function to format mockup for JSON response
function formatMockup(mockup: any) {
  return {
    ...mockup,
    _id: mockup._id.toString(),
    createdAt: mockup.createdAt?.toISOString(),
    updatedAt: mockup.updatedAt?.toISOString(),
    isLiked: mockup.isLiked === true, // Ensure isLiked is always a boolean
  };
}

// Helper function to create or update MockupExample when mockup is liked
async function createOrUpdateMockupExample(mockupData: {
  prompt: string;
  imageUrl: string;
  designType: string;
  tags: string[];
  brandingTags: string[];
  aspectRatio: string;
}, mockupId: string) {
  try {
    // Check if example already exists for this prompt + imageUrl combination
    const existing = await prisma.mockupExample.findFirst({
      where: {
        prompt: mockupData.prompt.trim(),
        imageUrl: mockupData.imageUrl,
      },
    });

    if (existing) {
      // Update existing example with higher rating
      await prisma.mockupExample.update({
        where: { id: existing.id },
        data: {
          rating: Math.max(existing.rating, 1),
          updatedAt: new Date(),
        },
      });
      console.log(`[MockupExample] Updated existing example for mockup ${mockupId}`);
    } else {
      // Create new example
      await prisma.mockupExample.create({
        data: {
          prompt: mockupData.prompt.trim(),
          imageUrl: mockupData.imageUrl,
          designType: mockupData.designType,
          tags: mockupData.tags,
          brandingTags: mockupData.brandingTags,
          aspectRatio: mockupData.aspectRatio,
          rating: 1,
        },
      });
      console.log(`[MockupExample] Created new example for mockup ${mockupId}`);
    }
  } catch (exampleError: any) {
    // Don't fail the main operation if example creation fails
    console.error('[MockupExample] Failed to create/update example:', {
      error: exampleError?.message,
      stack: exampleError?.stack,
      mockupId,
    });
  }
}

// Helper function to upload image to R2 storage
async function uploadImageToR2(
  imageBase64: string,
  userId: string,
  mockupId: string
): Promise<string> {
  const r2Service = await import('@/services/r2Service.js');

  // Check if R2 is configured - it's now required
  if (!r2Service.isR2Configured()) {
    console.error('R2 storage is required but not configured:', {
      hasAccountId: !!process.env.R2_ACCOUNT_ID,
      hasAccessKeyId: !!process.env.R2_ACCESS_KEY_ID,
      hasSecretAccessKey: !!process.env.R2_SECRET_ACCESS_KEY,
      hasBucketName: !!process.env.R2_BUCKET_NAME,
      hasPublicUrl: !!process.env.R2_PUBLIC_URL,
    });
    throw new Error('R2 storage is required but not configured. Please configure R2 environment variables.');
  }

  // Get user info for storage limit check
  await connectToMongoDB();
  const db = getDb();
  const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });
  const subscriptionTier = user?.subscriptionTier || 'free';
  const isAdmin = user?.isAdmin || false;

  console.log(`Uploading image to R2 for user ${userId}, mockupId: ${mockupId}`);
  const imageUrl = await r2Service.uploadImage(imageBase64, userId, mockupId, subscriptionTier, isAdmin);
  console.log(`Successfully uploaded image to R2 for user ${userId}: ${imageUrl}`);

  return imageUrl;
}

// Helper function to atomically deduct credits BEFORE generation
// FIXED: Uses simple $inc operation instead of aggregation pipeline to avoid duplicate deductions
// Returns information about credit deduction source for proper refund tracking
async function deductCreditsAtomically(
  userId: string,
  creditsToDeduct: number,
  requestId?: string
): Promise<{
  success: true;
  updatedUser: any;
  deductionSource: {
    fromEarned: number;
    fromMonthly: number;
  };
}> {
  const logPrefix = '[CREDIT]';
  console.log(`${logPrefix} [deductCreditsAtomically] Starting`, {
    userId,
    creditsToDeduct,
    requestId: requestId || 'no-request-id',
    timestamp: new Date().toISOString(),
  });

  await connectToMongoDB();
  const db = getDb();

  if (creditsToDeduct <= 0) {
    throw new Error(`Invalid credits to deduct: ${creditsToDeduct}. Must be greater than 0.`);
  }

  // Get user data first to calculate deduction strategy
  const userBefore = await db.collection('users').findOne({ _id: new ObjectId(userId) });
  if (!userBefore) {
    throw new Error('User not found');
  }

  const totalCreditsEarnedBefore = userBefore.totalCreditsEarned || 0;
  const monthlyCreditsBefore = userBefore.monthlyCredits || 20;
  const creditsUsedBefore = userBefore.creditsUsed || 0;
  const monthlyCreditsRemainingBefore = Math.max(0, monthlyCreditsBefore - creditsUsedBefore);
  const totalCreditsBefore = totalCreditsEarnedBefore + monthlyCreditsRemainingBefore;

  console.log(`${logPrefix} [deductCreditsAtomically] User credits before deduction`, {
    userId,
    requestId: requestId || 'no-request-id',
    totalCreditsEarned: totalCreditsEarnedBefore,
    monthlyCredits: monthlyCreditsBefore,
    creditsUsed: creditsUsedBefore,
    monthlyCreditsRemaining: monthlyCreditsRemainingBefore,
    totalCredits: totalCreditsBefore,
    creditsToDeduct,
  });

  // Check if user has enough credits
  if (totalCreditsBefore < creditsToDeduct) {
    console.error(`${logPrefix} [deductCreditsAtomically] ❌ Insufficient credits`, {
      userId,
      requestId: requestId || 'no-request-id',
      totalCredits: totalCreditsBefore,
      creditsToDeduct,
    });
    throw new Error(`Insufficient credits. Required: ${creditsToDeduct}, Available: ${totalCreditsBefore}`);
  }

  // Calculate deduction strategy: use earned credits first, then monthly
  const fromEarned = Math.min(totalCreditsEarnedBefore, creditsToDeduct);
  const fromMonthly = creditsToDeduct - fromEarned;

  console.log(`${logPrefix} [deductCreditsAtomically] Deduction strategy`, {
    userId,
    requestId: requestId || 'no-request-id',
    fromEarned,
    fromMonthly,
    creditsToDeduct,
  });

  // FIXED: Use simple $inc operation which is atomic and reliable
  // This avoids the issue where aggregation pipelines execute but return null
  const updateOperation: any = {};

  if (fromEarned > 0) {
    updateOperation.totalCreditsEarned = -fromEarned;
  }
  if (fromMonthly > 0) {
    updateOperation.creditsUsed = fromMonthly;
  }

  // Only proceed if we have something to update
  if (Object.keys(updateOperation).length === 0) {
    throw new Error('No credits to deduct - calculation error');
  }

  // Use findOneAndUpdate with $inc for atomic operation
  // The condition ensures we only update if user still has enough credits
  const result = await db.collection('users').findOneAndUpdate(
    {
      _id: new ObjectId(userId),
      // Atomic conditions to prevent over-deduction
      ...(fromEarned > 0 ? { totalCreditsEarned: { $gte: fromEarned } } : {}),
      ...(fromMonthly > 0 ? {
        $expr: {
          $gte: [
            { $subtract: [{ $ifNull: ['$monthlyCredits', 20] }, { $ifNull: ['$creditsUsed', 0] }] },
            fromMonthly
          ]
        }
      } : {})
    },
    { $inc: updateOperation },
    { returnDocument: 'after' }
  );

  console.log(`${logPrefix} [deductCreditsAtomically] Update result`, {
    userId,
    requestId: requestId || 'no-request-id',
    success: !!result,
    hasValue: !!result,
  });

  // If update failed (no matching document), verify current state
  if (!result) {
    // Re-fetch user to check current state
    const currentUser = await db.collection('users').findOne({ _id: new ObjectId(userId) });
    if (!currentUser) {
      throw new Error('User not found');
    }

    const currentTotalEarned = currentUser.totalCreditsEarned || 0;
    const currentMonthlyCredits = currentUser.monthlyCredits || 20;
    const currentCreditsUsed = currentUser.creditsUsed || 0;
    const currentMonthlyRemaining = Math.max(0, currentMonthlyCredits - currentCreditsUsed);
    const currentTotal = currentTotalEarned + currentMonthlyRemaining;

    console.error(`${logPrefix} [deductCreditsAtomically] ❌ Update failed - condition not met`, {
      userId,
      requestId: requestId || 'no-request-id',
      currentTotalEarned,
      currentMonthlyRemaining,
      currentTotal,
      creditsToDeduct,
      fromEarned,
      fromMonthly,
    });

    if (currentTotal < creditsToDeduct) {
      throw new Error(`Insufficient credits. Required: ${creditsToDeduct}, Available: ${currentTotal}`);
    } else {
      throw new Error(`System error: Failed to deduct credits. Please try again. Available: ${currentTotal}`);
    }
  }

  const totalCreditsEarnedAfter = result.totalCreditsEarned || 0;
  const creditsUsedAfter = result.creditsUsed || 0;
  const monthlyCreditsAfter = result.monthlyCredits || 20;
  const monthlyCreditsRemainingAfter = Math.max(0, monthlyCreditsAfter - creditsUsedAfter);
  const totalCreditsAfter = totalCreditsEarnedAfter + monthlyCreditsRemainingAfter;

  console.log(`${logPrefix} [deductCreditsAtomically] ✅ Success`, {
    userId,
    requestId: requestId || 'no-request-id',
    creditsToDeduct,
    totalCreditsEarnedBefore,
    totalCreditsEarnedAfter,
    creditsUsedBefore,
    creditsUsedAfter,
    monthlyCreditsBefore,
    monthlyCreditsAfter,
    monthlyCreditsRemainingBefore,
    monthlyCreditsRemainingAfter,
    totalCreditsBefore,
    totalCreditsAfter,
    creditsDeducted: totalCreditsBefore - totalCreditsAfter,
    fromEarned,
    fromMonthly,
  });

  return {
    success: true,
    updatedUser: result,
    deductionSource: {
      fromEarned,
      fromMonthly
    }
  };
}

// Helper function to refund credits with retry mechanism
// Uses deduction source information to properly refund credits to their original source
async function refundCreditsWithRetry(
  userId: string,
  creditsToRefund: number,
  deductionSource?: { fromEarned: number; fromMonthly: number },
  maxRetries: number = 3
): Promise<void> {
  const logPrefix = '[CREDIT]';
  let lastError: any = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await refundCredits(userId, creditsToRefund, deductionSource);
      if (attempt > 1) {
        console.log(`${logPrefix} [refundCreditsWithRetry] ✅ Refund succeeded on attempt ${attempt}`, {
          userId,
          creditsToRefund,
          attempt,
        });
      }
      return; // Success - exit retry loop
    } catch (error: any) {
      lastError = error;
      const isLastAttempt = attempt === maxRetries;

      if (isLastAttempt) {
        // Final attempt failed - will throw after loop
        console.error(`${logPrefix} [refundCreditsWithRetry] ❌ All ${maxRetries} refund attempts failed`, {
          userId,
          creditsToRefund,
          attempt,
          error: error.message,
        });
      } else {
        // Wait before retry (exponential backoff: 1s, 2s, 4s)
        const delayMs = Math.pow(2, attempt - 1) * 1000;
        console.warn(`${logPrefix} [refundCreditsWithRetry] ⚠️ Refund attempt ${attempt} failed, retrying in ${delayMs}ms...`, {
          userId,
          creditsToRefund,
          attempt,
          maxRetries,
          error: error.message,
        });
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }

  // All retries failed - throw the last error
  throw lastError;
}

// Helper function to refund credits if generation fails
// Uses deduction source information to properly refund credits to their original source
async function refundCredits(
  userId: string,
  creditsToRefund: number,
  deductionSource?: { fromEarned: number; fromMonthly: number }
): Promise<void> {
  await connectToMongoDB();
  const db = getDb();

  const logPrefix = '[CREDIT]';

  // If deduction source is provided, use it for accurate refund
  if (deductionSource) {
    const { fromEarned, fromMonthly } = deductionSource;

    console.log(`${logPrefix} [refundCredits] Refunding with source tracking`, {
      userId,
      creditsToRefund,
      fromEarned,
      fromMonthly,
    });

    // Build update based on source
    const updateFields: any = {};

    // Add back earned credits
    if (fromEarned > 0) {
      updateFields.totalCreditsEarned = { $add: [{ $ifNull: ['$totalCreditsEarned', 0] }, fromEarned] };
    }

    // Reduce creditsUsed (only if monthly credits were used)
    if (fromMonthly > 0) {
      updateFields.creditsUsed = {
        $max: [
          0, // Ensure creditsUsed never goes negative
          { $subtract: [{ $ifNull: ['$creditsUsed', 0] }, fromMonthly] }
        ]
      };
    }

    if (Object.keys(updateFields).length > 0) {
      await db.collection('users').updateOne(
        { _id: new ObjectId(userId) },
        [{ $set: updateFields }] as any
      );

      console.log(`${logPrefix} [refundCredits] ✅ Refunded credits with source tracking`, {
        userId,
        fromEarned,
        fromMonthly,
        totalRefunded: creditsToRefund,
      });
    }
  } else {
    // Fallback: if source not provided, add back to totalCreditsEarned
    // and reduce creditsUsed only if it's positive (to avoid negative values)
    console.warn(`${logPrefix} [refundCredits] ⚠️ No deduction source provided, using fallback refund`, {
      userId,
      creditsToRefund,
    });

    // Get current user state to determine safe refund
    const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });
    if (!user) {
      throw new Error('User not found for refund');
    }

    const currentCreditsUsed = user.creditsUsed || 0;
    const creditsToReduceFromUsed = Math.min(creditsToRefund, currentCreditsUsed);
    const creditsToAddToEarned = creditsToRefund;

    const updateFields: any = {
      totalCreditsEarned: { $add: [{ $ifNull: ['$totalCreditsEarned', 0] }, creditsToAddToEarned] }
    };

    // Only reduce creditsUsed if it's positive and we're refunding some monthly credits
    if (creditsToReduceFromUsed > 0) {
      updateFields.creditsUsed = {
        $max: [
          0,
          { $subtract: [{ $ifNull: ['$creditsUsed', 0] }, creditsToReduceFromUsed] }
        ]
      };
    }

    await db.collection('users').updateOne(
      { _id: new ObjectId(userId) },
      [{ $set: updateFields }] as any
    );

    console.log(`${logPrefix} [refundCredits] ✅ Refunded credits (fallback method)`, {
      userId,
      creditsToRefund,
      creditsToAddToEarned,
      creditsToReduceFromUsed,
    });
  }
}

interface MockupData {
  userId: string;
  imageBase64?: string; // Made optional for backward compatibility
  imageUrl?: string; // New field for R2 storage URLs
  prompt: string;
  designType: string;
  tags: string[];
  brandingTags: string[];
  aspectRatio: string;
  isLiked?: boolean; // User's like status for this mockup
  createdAt: Date;
  updatedAt: Date;
}

// Get all mockups publicly (no authentication required)
router.get('/public', async (req, res, next) => {
  try {
    // Set a timeout for the entire operation (connection + query)
    const operationTimeout = 15000; // 15 seconds total
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Operation timeout: MongoDB connection/query took too long')), operationTimeout);
    });

    const dbOperation = async () => {
      try {
        await connectToMongoDB();
        const db = getDb();

        // Ensure index exists for createdAt to optimize sort (with timeout)
        try {
          await Promise.race([
            db.collection('mockups').createIndex({ createdAt: -1 }, { background: true }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Index creation timeout')), 5000))
          ]);
        } catch (indexError: any) {
          // Index may already exist or timeout - ignore error
          if (!indexError.message?.includes('timeout')) {
            console.warn('Index creation warning:', indexError.message);
          }
        }

        // Use find() with sort instead of aggregation for better performance with index
        // Add timeout to the query itself
        // Only return blank mockups for public page
        const queryPromise = db.collection('mockups')
          .find({ designType: 'blank' })
          .sort({ createdAt: -1 })
          .limit(1000) // Limit results to prevent memory issues
          .maxTimeMS(10000) // 10 second timeout for the query
          .toArray();

        const mockups = await Promise.race([
          queryPromise,
          new Promise((_, reject) => setTimeout(() => reject(new Error('Query timeout')), 10000))
        ]) as any[];

        // Convert MongoDB _id to string for JSON serialization
        const formattedMockups = mockups.map(formatMockup);

        return formattedMockups;
      } catch (dbError: any) {
        // Re-throw to be caught by outer catch
        throw dbError;
      }
    };

    // Race between operation and timeout
    const mockups = await Promise.race([dbOperation(), timeoutPromise]) as any[];

    // Success - return mockups
    return res.status(200).json(mockups);
  } catch (error: any) {
    // Always return 200 with empty array for ANY error on public endpoint
    // This allows the page to load gracefully even if MongoDB is not available
    const errorMessage = error?.message || String(error);
    const isTimeout = errorMessage?.includes('timeout') || errorMessage?.includes('timed out');

    if (isTimeout) {
      console.error('⏱️  Timeout fetching public mockups:', errorMessage);
    } else {
      console.error('❌ Error fetching public mockups:', errorMessage);
    }

    // Always return 200 (not 500) with empty array to prevent frontend errors
    return res.status(200).json([]);
  }
});

// Get all mockups for authenticated user
router.get('/', authenticate, async (req: AuthRequest, res, next) => {
  try {
    // Ensure MongoDB connection is established
    await connectToMongoDB();
    const db = getDb();

    if (!req.userId) {
      return res.status(401).json({ error: 'User ID not found in request' });
    }

    // Ensure indexes exist for optimized queries
    try {
      await db.collection('mockups').createIndex({ userId: 1, createdAt: -1 }, { background: true });
      await db.collection('mockups').createIndex({ createdAt: -1 }, { background: true });
    } catch (indexError) {
      // Indexes may already exist, ignore error
    }

    // Use find() with sort instead of aggregation for better performance with indexes
    const mockups = await db.collection('mockups')
      .find({ userId: req.userId })
      .sort({ createdAt: -1 })
      .toArray();

    // Convert MongoDB _id to string for JSON serialization
    const formattedMockups = mockups.map(formatMockup);

    res.json(formattedMockups);
  } catch (error: any) {
    // Handle MongoDB connection errors (timeouts, connection refused, etc.)
    const errorMessage = error?.message || String(error);
    const isMongoError =
      errorMessage?.includes('Database not initialized') ||
      errorMessage?.includes('MongoDB') ||
      errorMessage?.includes('timed out') ||
      errorMessage?.includes('timeout') ||
      errorMessage?.includes('ECONNREFUSED') ||
      errorMessage?.includes('connection') ||
      error?.code === 'ECONNREFUSED';

    if (isMongoError) {
      console.error('❌ Error fetching user mockups:', errorMessage);
      // Return empty array on database errors to allow UI to load gracefully
      // Frontend already handles this gracefully
      return res.status(500).json({
        error: 'Database connection failed. Please try again later.',
        details: errorMessage.includes('timed out')
          ? 'Connection timeout - database may be temporarily unavailable'
          : errorMessage
      });
    }
    next(error);
  }
});

// Get a single mockup by ID
router.get('/:id', authenticate, async (req: AuthRequest, res, next) => {
  try {
    await connectToMongoDB();
    const db = getDb();
    const mockup = await db.collection('mockups').findOne({
      _id: new ObjectId(req.params.id),
      userId: req.userId
    });

    if (!mockup) {
      return res.status(404).json({ error: 'Mockup not found' });
    }

    // Format mockup
    const formattedMockup = formatMockup(mockup);

    res.json(formattedMockup);
  } catch (error) {
    next(error);
  }
});

// Get presigned URL for direct mockup image upload
router.post('/upload-url', authenticate, async (req: AuthRequest, res) => {
  try {
    const { contentType } = req.body;
    const { generateMockupImageUploadUrl } = await import('@/services/r2Service.js');

    if (!req.userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const result = await generateMockupImageUploadUrl(req.userId, contentType);
    res.json(result);
  } catch (error: any) {
    console.error('Error generating upload URL for mockup:', error);
    res.status(500).json({ error: 'Failed to generate upload URL' });
  }
});

// Generate mockup image (NEW: validates and deducts credits BEFORE generation)
// CRITICAL: This endpoint validates and deducts credits atomically before calling Gemini API
router.post('/generate', authenticate, checkSubscription, async (req: SubscriptionRequest, res, next) => {
  const logPrefix = '[CREDIT]';
  let creditsDeducted = false;
  let creditsToDeduct = 0;
  let lockKey: string | null = null;
  let requestId: string = 'no-request-id';
  let deductionSource: { fromEarned: number; fromMonthly: number } | undefined = undefined;

  try {
    await connectToMongoDB();

    // Get or generate request ID for tracking
    requestId = (req.headers['x-request-id'] as string) || `req-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    const {
      promptText,
      baseImage,
      model = 'gemini-2.5-flash-image',
      resolution,
      aspectRatio,
      referenceImages,
      feature, // Optional: 'mockupmachine' | 'canvas'
    } = req.body;

    // Helper to download image from URL if base64 is not provided
    const processImageInput = async (img: any) => {
      if (!img) return null;
      if (img.base64) return img;
      if (img.url) {
        try {
          console.log(`${logPrefix} [IMAGE PROCESSING] Downloading image from URL:`, img.url.substring(0, 100));
          const response = await fetch(img.url);
          if (!response.ok) throw new Error(`Failed to fetch image: ${response.statusText}`);
          const arrayBuffer = await response.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          return {
            base64: buffer.toString('base64'),
            mimeType: img.mimeType || response.headers.get('content-type') || 'image/png'
          };
        } catch (error: any) {
          console.error(`${logPrefix} [IMAGE PROCESSING] Error downloading image:`, error);
          throw new Error(`Failed to process image URL: ${error.message}`);
        }
      }
      return null;
    };

    // Process base image and reference images to ensure we have base64 for Gemini
    console.log(`${logPrefix} [IMAGE PROCESSING] Processing image inputs`, {
      hasBaseImage: !!baseImage,
      hasBaseImageUrl: !!baseImage?.url,
      referenceImagesCount: referenceImages?.length || 0
    });

    const processedBaseImage = await processImageInput(baseImage);
    const processedReferenceImages = referenceImages ?
      await Promise.all(referenceImages.map((img: any) => processImageInput(img))) :
      undefined;

    // Replace original images with processed ones (now containing base64)
    const finalBaseImage = processedBaseImage;
    const finalReferenceImages = processedReferenceImages?.filter(img => img !== null);

    // CRITICAL: Check for duplicate recent requests to prevent multiple credit deductions
    // Use a distributed lock mechanism to prevent concurrent requests from deducting credits
    const db = getDb();

    // Ensure TTL index exists on credit_locks collection for automatic cleanup
    try {
      await db.collection('credit_locks').createIndex(
        { expiresAt: 1 },
        {
          expireAfterSeconds: 0, // Delete documents when expiresAt time is reached
          background: true,
          name: 'expiresAt_ttl_index'
        }
      );
    } catch (indexError: any) {
      // Index may already exist, ignore error (MongoDB error code 85 = IndexOptionsConflict)
      if (indexError.code !== 85 && !indexError.message?.includes('already exists')) {
        console.warn(`${logPrefix} [LOCK] Warning: Could not create TTL index on credit_locks:`, indexError.message);
      }
    }

    // Create a lock key to prevent duplicate credit deductions
    // Use uniqueId from request body (slot index for batch requests) to differentiate parallel batch requests
    // DO NOT use requestId - it changes per call and would defeat the purpose of the lock
    const promptHash = promptText ? promptText.substring(0, 50).replace(/[^a-zA-Z0-9]/g, '') : 'no-prompt';
    // Use uniqueId if provided (for batch requests), otherwise use 'single' for single-image requests
    const batchId = req.body.uniqueId !== undefined ? String(req.body.uniqueId) : 'single';
    lockKey = `credit-deduction-${req.userId}-${model}-${resolution || 'default'}-${promptHash}-${batchId}`;
    const lockExpiry = new Date(Date.now() + 30000); // 30 seconds lock (increased from 10s to handle longer generation times)

    console.log(`${logPrefix} [LOCK] Checking for existing locks`, {
      userId: req.userId,
      requestId,
      lockKey,
      timestamp: new Date().toISOString(),
    });

    // Clean up expired locks first (prevent accumulation of stale locks)
    // Note: TTL index will also auto-cleanup, but manual cleanup ensures immediate removal
    const cleanupResult = await db.collection('credit_locks').deleteMany({
      expiresAt: { $lt: new Date() }
    });
    if (cleanupResult.deletedCount > 0) {
      console.log(`${logPrefix} [LOCK] Cleaned up ${cleanupResult.deletedCount} expired lock(s)`, {
        timestamp: new Date().toISOString(),
      });
    }

    // Check for existing lock with the same lock key (prevent duplicate processing of same request)
    // Since lock key includes request ID, parallel batch requests with different requestIds
    // will have different lock keys and won't conflict. Only exact same requestId will be blocked.
    const existingLock = await db.collection('credit_locks').findOne({
      lockKey,
      expiresAt: { $gt: new Date() }
    });

    if (existingLock) {
      console.warn(`${logPrefix} [DUPLICATE DETECTION] ⚠️ Active lock found, REJECTING duplicate request`, {
        userId: req.userId,
        requestId,
        existingLockRequestId: existingLock.requestId,
        existingLockCreatedAt: existingLock.createdAt,
        lockKey,
        expiresAt: existingLock.expiresAt,
        timeSinceLockCreated: Date.now() - new Date(existingLock.createdAt).getTime(),
        timestamp: new Date().toISOString(),
      });

      // Return error to prevent duplicate credit deduction
      return res.status(409).json({
        error: 'Duplicate request detected',
        message: 'A similar request is already being processed. Please wait a moment before trying again.',
        requestId,
      });
    }

    // Acquire lock before deducting credits
    const lockInsertResult = await db.collection('credit_locks').insertOne({
      lockKey,
      requestId,
      userId: req.userId!,
      model,
      resolution: resolution || null,
      createdAt: new Date(),
      expiresAt: lockExpiry,
    });

    console.log(`${logPrefix} [LOCK] ✅ Acquired lock for credit deduction`, {
      userId: req.userId,
      requestId,
      lockKey,
      lockId: lockInsertResult.insertedId,
      expiresAt: lockExpiry,
      timestamp: new Date().toISOString(),
    });

    // Validate prompt text
    if (!promptText || promptText.trim().length === 0) {
      // Release lock before returning
      if (lockKey) {
        await db.collection('credit_locks').deleteOne({ lockKey, requestId });
      }
      return res.status(400).json({ error: 'Prompt text is required' });
    }

    // Ensure imagesCount is always 1 for this endpoint (we only generate one image per request)
    // This prevents accidental multiple credit deductions
    const actualImagesCount = 1;

    // Calculate credits required
    // Always use 1 image per request to prevent multiple credit deductions
    const creditsPerImage = getCreditsRequired(model as GeminiModel, resolution);
    creditsToDeduct = actualImagesCount * creditsPerImage;

    console.log(`${logPrefix} [Credit Calculation] Before deduction`, {
      userId: req.userId,
      requestId,
      model,
      resolution,
      imagesCount: actualImagesCount,
      creditsPerImage,
      creditsToDeduct,
      timestamp: new Date().toISOString(),
    });

    // Check if user is admin before deducting credits
    const userBeforeDeduction = await db.collection('users').findOne({ _id: new ObjectId(req.userId!) });
    const isAdmin = userBeforeDeduction?.isAdmin === true;

    let updatedUser: any;
    let actualCreditsDeducted = 0;

    // Check for user API key FIRST
    let userApiKey: string | undefined;
    let usingUserKey = false;
    let apiKeySource: 'user' | 'system' = 'system';

    try {
      const { getGeminiApiKey } = await import('../utils/geminiApiKey.js');
      // Try to get ONLY user key first (skip fallback)
      userApiKey = await getGeminiApiKey(req.userId!, { skipFallback: true });

      if (userApiKey) {
        usingUserKey = true;
        apiKeySource = 'user';
        console.log(`${logPrefix} [API KEY] Using user API key, will skip credit deduction`, {
          userId: req.userId,
          requestLength: userApiKey.length
        });
      }
    } catch (apiKeyError: any) {
      console.warn(`${logPrefix} [API KEY] Error checking for user API key:`, apiKeyError);
    }

    if (isAdmin) {
      // Admin users - skip credit deduction
      console.log(`${logPrefix} [CREDIT DEDUCTION] Admin user - skipping credit deduction`, {
        userId: req.userId,
        requestId,
        lockKey,
        creditsToDeduct,
        timestamp: new Date().toISOString(),
      });
      updatedUser = userBeforeDeduction;
      creditsDeducted = false; // Mark as not deducted since admin skipped it
      actualCreditsDeducted = 0;
      deductionSource = { fromEarned: 0, fromMonthly: 0 };
    } else if (usingUserKey) {
      // User API key - skip credit deduction
      console.log(`${logPrefix} [CREDIT DEDUCTION] User API key present - skipping credit deduction`, {
        userId: req.userId,
        requestId,
        lockKey,
        creditsToDeduct,
        timestamp: new Date().toISOString(),
      });
      updatedUser = userBeforeDeduction;
      creditsDeducted = false;
      actualCreditsDeducted = 0;
      deductionSource = { fromEarned: 0, fromMonthly: 0 };
    } else {
      // CRITICAL: Deduct credits BEFORE generation (atomic operation)
      // This function uses atomic MongoDB operations to prevent duplicate deductions
      console.log(`${logPrefix} [CREDIT DEDUCTION] About to deduct credits (lock is held)`, {
        userId: req.userId,
        requestId,
        lockKey,
        creditsToDeduct,
        timestamp: new Date().toISOString(),
      });

      const deductionResult = await deductCreditsAtomically(req.userId!, creditsToDeduct, requestId);
      updatedUser = deductionResult.updatedUser;
      deductionSource = deductionResult.deductionSource;
      creditsDeducted = true;
      actualCreditsDeducted = creditsToDeduct;

      if (!isAdmin) {
        console.log(`${logPrefix} [CREDIT DEDUCTION] ✅ Credits deducted successfully`, {
          userId: req.userId,
          requestId,
          lockKey,
          creditsToDeduct,
          fromEarned: deductionSource.fromEarned,
          fromMonthly: deductionSource.fromMonthly,
          totalCreditsEarned: updatedUser.totalCreditsEarned,
          creditsUsed: updatedUser.creditsUsed,
          monthlyCredits: updatedUser.monthlyCredits,
          model,
          resolution,
          imagesCount: actualImagesCount,
          creditsPerImage,
          timestamp: new Date().toISOString(),
        });
      }
    }

    // Generate mockup image using Gemini API
    // Note: We only generate one image per request
    const imageBase64 = await generateMockup(
      promptText,
      finalBaseImage as any,
      model as any,
      resolution as any,
      aspectRatio as any,
      finalReferenceImages as any,
      undefined,
      userApiKey
    );

    // Try to upload to R2 if configured to avoid large payloads
    let imageUrl: string | undefined;

    try {
      const r2Service = await import('@/services/r2Service.js');
      if (r2Service.isR2Configured()) {
        console.log(`${logPrefix} [R2] Uploading generated image to R2...`);
        // Use a new ID for the file name, or reuse requestId if unique enough
        const fileId = new ObjectId().toString();
        imageUrl = await uploadImageToR2(imageBase64, req.userId!, fileId);
        console.log(`${logPrefix} [R2] Upload success: ${imageUrl}`);
      }
    } catch (r2Error: any) {
      // Log but continue with base64 only
      console.warn(`${logPrefix} [R2] Optional upload failed, falling back to base64 response:`, r2Error.message);
    }

    // Generation successful - create usage record for audit/logging
    // Credits were already deducted before generation
    // Use retry mechanism to ensure usage record is created for audit trail
    const createUsageRecordWithRetry = async (maxRetries: number = 3): Promise<void> => {
      const db = getDb();
      const { createUsageRecord, calculateImageGenerationCost } = await import('../utils/usageTracking.js');

      const usageRecord = createUsageRecord(
        req.userId!,
        actualImagesCount, // Always 1 for this endpoint
        model,
        !!baseImage,
        promptText.length,
        resolution as Resolution | undefined,
        (feature || 'mockupmachine') as 'mockupmachine' | 'canvas',
        apiKeySource
      );

      const recordToInsert = {
        ...usageRecord,
        subscriptionStatus: updatedUser.subscriptionStatus || 'free',
        hasActiveSubscription: updatedUser.subscriptionStatus === 'active',
        resolution: resolution as Resolution | undefined,
        creditsPerImage: creditsPerImage,
        creditsDeducted: actualCreditsDeducted,
        creditsDeductedBeforeGeneration: !isAdmin, // Flag to indicate credits were deducted before generation (false for admins)
        isLocalDevelopment: false, // Always false for backend-generated requests
        requestId, // Track request ID for duplicate detection
        createdAt: new Date(),
        imageUrl: imageUrl // Track R2 URL in usage record if available
      };

      let lastError: any = null;
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          await db.collection('usage_records').insertOne(recordToInsert);

          if (attempt > 1) {
            console.log(`${logPrefix} [Usage Tracking] ✅ Usage record created on attempt ${attempt}`, {
              userId: req.userId,
              requestId,
              attempt,
            });
          }

          console.log(`${logPrefix} [Usage Tracking] Recorded mockup usage for user ${req.userId}:`, {
            userId: req.userId,
            requestId,
            imagesGenerated: actualImagesCount,
            model,
            resolution,
            creditsPerImage,
            creditsDeducted: actualCreditsDeducted,
            creditsDeductedBeforeGeneration: !isAdmin,
            hasImageUrl: !!imageUrl,
            timestamp: recordToInsert.createdAt, // corrected property name
          });
          return; // Success - exit retry loop
        } catch (error: any) {
          lastError = error;
          const isLastAttempt = attempt === maxRetries;

          if (isLastAttempt) {
            // Final attempt failed - log critical warning
            console.error(`${logPrefix} [AUDIT WARNING] [Usage Tracking] ❌ All ${maxRetries} attempts failed to create usage record:`, {
              severity: 'WARNING',
              type: 'usage_record_creation_failure',
              error: error.message,
              errorStack: error.stack,
              userId: req.userId,
              requestId,
              model,
              resolution,
              imagesCount: actualImagesCount,
              creditsDeducted: creditsToDeduct,
              timestamp: new Date().toISOString(),
              // Note: Credits were already deducted, but audit record is missing
            });
          } else {
            // Wait before retry (exponential backoff: 0.5s, 1s, 2s)
            const delayMs = Math.pow(2, attempt - 2) * 500;
            console.warn(`${logPrefix} [Usage Tracking] ⚠️ Usage record creation attempt ${attempt} failed, retrying in ${delayMs}ms...`, {
              userId: req.userId,
              requestId,
              attempt,
              maxRetries,
              error: error.message,
            });
            await new Promise(resolve => setTimeout(resolve, delayMs));
          }
        }
      }

      // All retries failed - this is logged above but doesn't throw to avoid breaking the response
      // The generation succeeded, credits were deducted, but audit trail is incomplete
    };

    try {
      await createUsageRecordWithRetry(3);
    } catch (usageError: any) {
      // This should not happen as createUsageRecordWithRetry doesn't throw, but handle just in case
      console.error(`${logPrefix} [AUDIT WARNING] [Usage Tracking] Unexpected error in usage record creation:`, {
        severity: 'WARNING',
        type: 'usage_record_creation_failure',
        error: usageError.message,
        errorStack: usageError.stack,
        userId: req.userId,
        requestId,
      });
    }

    // Calculate total credits remaining after deduction
    // Use updatedUser from deduction result (no need to re-fetch - it already has the latest values)
    // For admins, calculate from userBeforeDeduction since no credits were deducted
    const userForCalculation = isAdmin ? userBeforeDeduction : updatedUser;
    const monthlyCreditsRemaining = Math.max(0, (userForCalculation.monthlyCredits ?? 20) - (userForCalculation.creditsUsed ?? 0));
    const totalCreditsRemaining = (userForCalculation.totalCreditsEarned ?? 0) + monthlyCreditsRemaining;

    console.log(`${logPrefix} [Credit Calculation] Final credits after deduction`, {
      userId: req.userId,
      requestId,
      creditsDeducted: actualCreditsDeducted,
      creditsPerImage,
      actualImagesCount,
      isAdmin,
      totalCreditsEarned: userForCalculation.totalCreditsEarned,
      monthlyCredits: userForCalculation.monthlyCredits,
      creditsUsed: userForCalculation.creditsUsed,
      monthlyCreditsRemaining,
      totalCreditsRemaining,
      calculation: `${userForCalculation.totalCreditsEarned} + ${monthlyCreditsRemaining} = ${totalCreditsRemaining}`,
    });

    // Release lock after successful generation
    if (lockKey) {
      await db.collection('credit_locks').deleteOne({ lockKey, requestId });
      console.log(`${logPrefix} [LOCK] Released lock after successful generation`, {
        userId: req.userId,
        requestId,
        lockKey,
      });
    }

    // Return generated image
    // Prefer imageUrl if available to save bandwidth
    res.json({
      imageBase64: imageUrl ? undefined : imageBase64, // Send undefined if imageUrl is present to save bandwidth
      imageUrl, // Include the R2 URL
      creditsDeducted: actualCreditsDeducted,
      creditsRemaining: totalCreditsRemaining,
      isAdmin,
    });
  } catch (error: any) {
    // Always release lock on error if it was acquired
    if (lockKey) {
      try {
        const db = getDb();
        await db.collection('credit_locks').deleteOne({ lockKey, requestId });
        console.log(`${logPrefix} [LOCK] Released lock after error`, {
          userId: req.userId,
          requestId,
          lockKey,
        });
      } catch (lockError: any) {
        console.error(`${logPrefix} [LOCK] Failed to release lock on error:`, lockError);
      }
    }

    console.error(`${logPrefix} [Error generating mockup]:`, {
      error: error.message,
      stack: error.stack,
      userId: req.userId,
      requestId,
      model: req.body.model,
      resolution: req.body.resolution,
    });

    // CRITICAL: Refund credits if generation failed and credits were deducted
    if (creditsDeducted && creditsToDeduct > 0) {
      try {
        // Use retry mechanism for refund to handle transient failures
        await refundCreditsWithRetry(req.userId!, creditsToDeduct, deductionSource, 3);
        console.log(`${logPrefix} [Credit Refund] ✅ Successfully refunded ${creditsToDeduct} credit(s) after failed mockup generation`, {
          userId: req.userId,
          requestId,
          model: req.body.model,
          resolution: req.body.resolution,
          error: error.message,
          timestamp: new Date().toISOString(),
        });
      } catch (refundError: any) {
        // CRITICAL ALERT: All refund attempts failed - this is a critical audit issue
        // Log with high severity for monitoring/alerting systems
        console.error(`${logPrefix} [CRITICAL AUDIT] [Credit Refund] ❌ All refund attempts failed after generation failure:`, {
          severity: 'CRITICAL',
          type: 'credit_refund_failure',
          error: refundError.message,
          errorStack: refundError.stack,
          userId: req.userId,
          requestId,
          model: req.body.model,
          resolution: req.body.resolution,
          creditsToRefund: creditsToDeduct,
          deductionSource: deductionSource ? {
            fromEarned: deductionSource.fromEarned,
            fromMonthly: deductionSource.fromMonthly,
          } : 'unknown',
          originalError: error.message,
          originalErrorStack: error.stack,
          timestamp: new Date().toISOString(),
          requiresManualIntervention: true, // Flag for monitoring systems
          actionRequired: `User ${req.userId} lost ${creditsToDeduct} credit(s) due to failed refund. Manual intervention required.`,
        });

        // [ENHANCEMENT] Optional: Integrate with monitoring/alerting system (Sentry, DataDog, etc.)
        // This could trigger an alert to administrators when credit refunds fail.
        // Contributions welcome - see CONTRIBUTING.md
      }
    }

    // Return appropriate error status code
    let statusCode = 500;
    if (error.message?.includes('Insufficient credits')) {
      statusCode = 403;
    } else if (error instanceof RateLimitError || error.name === 'RateLimitError' || error.message?.includes('Rate limit exceeded')) {
      statusCode = 429;
    }

    res.status(statusCode).json({
      error: 'Failed to generate mockup',
      message: error.message || 'An error occurred while generating the image'
    });
  }
});

// Track generation usage (called before/after generation)
// NOTE: This endpoint is deprecated in favor of /generate which handles credit deduction
// Keeping for backward compatibility with existing frontend code during migration
// Note: checkSubscription is NOT used here because generation already succeeded.
// We're just recording usage, not generating, so credits check should not block this.
// 
// CRITICAL: This endpoint should NOT be called if /generate was already used, as that would
// cause duplicate credit deduction. The /generate endpoint already handles credit deduction
// and usage record creation atomically.
// Track prompt generation usage
router.post('/track-prompt-generation', authenticate, async (req: AuthRequest, res, next) => {
  try {
    await connectToMongoDB();
    const db = getDb();
    const userId = req.userId!;

    const { inputTokens, outputTokens, feature } = req.body;

    if (typeof inputTokens !== 'number' || typeof outputTokens !== 'number') {
      return res.status(400).json({ error: 'inputTokens and outputTokens are required' });
    }

    if (!feature || !['mockupmachine', 'canvas'].includes(feature)) {
      return res.status(400).json({ error: 'feature must be "mockupmachine" or "canvas"' });
    }

    // Get user info
    const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const isAdmin = user.role === 'admin';
    const subscriptionStatus = user.subscriptionStatus || 'free';
    const hasActiveSubscription = subscriptionStatus === 'active';

    // Calculate cost
    const { calculateTextGenerationCost } = await import('../utils/usageTracking.js');
    const cost = calculateTextGenerationCost(inputTokens, outputTokens, 'gemini-2.5-flash-image');

    // Create usage record
    const usageRecord = {
      userId,
      type: 'prompt-generation',
      feature: feature as 'mockupmachine' | 'canvas',
      timestamp: new Date(),
      inputTokens,
      outputTokens,
      promptLength: inputTokens * 4, // Approximate
      model: 'gemini-2.5-flash-image',
      cost,
      creditsDeducted: 0, // Prompt generation doesn't deduct credits
      subscriptionStatus,
      hasActiveSubscription,
      isAdmin,
      createdAt: new Date(),
    };

    await db.collection('usage_records').insertOne(usageRecord);

    res.json({ success: true });
  } catch (error: any) {
    console.error('Error tracking prompt generation:', error);
    res.status(500).json({ error: 'Failed to track prompt generation' });
  }
});

router.post('/track-usage', authenticate, async (req: AuthRequest, res, next) => {
  try {
    await connectToMongoDB();
    const db = getDb();
    const userId = req.userId!;
    const {
      success,
      imagesCount = 1, // Number of images generated (default 1)
      model = 'gemini-2.5-flash-image',
      hasInputImage = false,
      promptLength,
      resolution,
      feature // Optional: 'mockupmachine' | 'canvas'
    } = req.body;

    // SECURITY: Credit bypass for local development only
    // This allows developers to test without consuming credits.
    // CRITICAL: Never set ALLOW_LOCAL_CREDIT_BYPASS=true in production!
    // It requires BOTH conditions: NODE_ENV=development AND ALLOW_LOCAL_CREDIT_BYPASS=true
    const isLocalDevelopment = process.env.NODE_ENV === 'development' &&
      process.env.ALLOW_LOCAL_CREDIT_BYPASS === 'true';

    // Extra safety: ensure we're not in production even if env vars are misconfigured
    if (isLocalDevelopment && process.env.VERCEL) {
      console.error('❌ SECURITY: ALLOW_LOCAL_CREDIT_BYPASS detected in Vercel environment. Ignoring.');
    }

    // CRITICAL: Check for recent usage records to prevent duplicate credit deduction
    // If a usage record was created in the last 10 seconds with the same parameters,
    // it's likely a duplicate call from /generate endpoint
    if (success) {
      const recentCutoff = new Date(Date.now() - 10000); // 10 seconds ago
      const recentRecord = await db.collection('usage_records').findOne({
        userId,
        model,
        resolution: resolution || null,
        createdAt: { $gte: recentCutoff },
        creditsDeductedBeforeGeneration: { $exists: true } // Only check records from /generate
      });

      if (recentRecord) {
        console.warn('[Usage Tracking] Duplicate track-usage call detected. Recent usage record found:', {
          userId,
          recentRecordId: recentRecord._id,
          recentRecordCreatedAt: recentRecord.createdAt,
          timestamp: new Date().toISOString(),
        });

        // Return success but don't deduct credits again
        return res.json({
          message: 'Usage already tracked by /generate endpoint',
          creditsDeducted: 0,
          duplicate: true
        });
      }
    }

    const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const subscriptionStatus = user.subscriptionStatus || 'free';
    const hasActiveSubscription = subscriptionStatus === 'active';
    const creditsUsed = user.creditsUsed || 0;
    const monthlyCredits = user.monthlyCredits || 20;
    const totalCreditsEarned = user.totalCreditsEarned || 0;
    const monthlyCreditsRemaining = Math.max(0, monthlyCredits - creditsUsed);

    if (success) {
      // Import usage tracking utilities
      const { createUsageRecord, calculateImageGenerationCost, getCreditsRequired } = await import('../utils/usageTracking.js');

      // Calculate credits required based on model and resolution
      const creditsPerImage = getCreditsRequired(model as 'gemini-2.5-flash-image' | 'gemini-3-pro-image-preview', resolution);
      // In local development, don't deduct credits but still track usage
      const creditsToDeduct = isLocalDevelopment ? 0 : imagesCount * creditsPerImage;

      // Create usage record for billing
      const usageRecord = createUsageRecord(
        userId,
        imagesCount,
        model,
        hasInputImage,
        promptLength,
        resolution,
        (feature || 'mockupmachine') as 'mockupmachine' | 'canvas'
      );

      // Store usage record in database
      // Ensure imagesGenerated is always set (from usageRecord) for consistency
      const recordToInsert = {
        ...usageRecord,
        subscriptionStatus,
        hasActiveSubscription,
        createdAt: new Date(),
        resolution,
        creditsPerImage,
        creditsDeducted: creditsToDeduct,
        isLocalDevelopment: isLocalDevelopment || false, // Flag to track local development usage
        // Ensure imagesGenerated is explicitly set (it's already in usageRecord, but make it explicit)
        imagesGenerated: usageRecord.imagesGenerated,
      };

      await db.collection('usage_records').insertOne(recordToInsert);

      console.log(`[Usage Tracking] Recorded usage for user ${userId}:`, {
        imagesGenerated: usageRecord.imagesGenerated,
        model: usageRecord.model,
        resolution,
        creditsDeducted: creditsToDeduct,
        isLocalDevelopment,
        timestamp: usageRecord.timestamp,
      });

      // CRITICAL: This endpoint is deprecated and should NOT deduct credits
      // Credits are already deducted by /generate endpoint before generation
      // This endpoint only records usage for audit/logging purposes
      // If credits need to be deducted, use /generate endpoint instead

      // Calculate total cost for this request (for reporting only)
      const cost = calculateImageGenerationCost(imagesCount, model, hasInputImage, resolution);

      // Return current user credits (not modified) for reference
      const monthlyCreditsRemaining = Math.max(0, monthlyCredits - creditsUsed);
      const totalCreditsRemaining = totalCreditsEarned + monthlyCreditsRemaining;

      res.json({
        message: 'Usage tracked (no credits deducted - use /generate endpoint for credit deduction)',
        imagesGenerated: imagesCount,
        cost,
        creditsDeducted: 0, // No credits deducted by this endpoint
        creditsUsed: creditsUsed, // Current value, not modified
        creditsRemaining: monthlyCreditsRemaining,
        totalCreditsEarned: totalCreditsEarned, // Current value, not modified
        totalCredits: totalCreditsRemaining,
        deprecated: true, // Flag to indicate this endpoint is deprecated
      });
    } else {
      // Generation failed - credits are not deducted
      // Credits are only deducted when success: true
      res.json({
        message: 'Generation failed - credits not deducted',
        creditsDeducted: 0
      });
    }
  } catch (error: any) {
    console.error('[Usage Tracking] Error in track-usage endpoint:', {
      error: error.message,
      stack: error.stack,
      userId: req.userId,
      body: req.body,
    });
    next(error);
  }
});

// Save a mockup
router.post('/', authenticate, async (req: AuthRequest, res, next) => {
  try {
    console.log('Save mockup request received:', {
      userId: req.userId,
      hasImageBase64: !!req.body.imageBase64,
      hasImageUrl: !!req.body.imageUrl,
      imageBase64Length: req.body.imageBase64?.length || 0,
      prompt: req.body.prompt?.substring(0, 50) || 'N/A',
      designType: req.body.designType,
    });

    await connectToMongoDB();
    const db = getDb();
    const userId = req.userId!;

    let imageUrl: string | undefined;

    // If imageBase64 is provided, upload to R2 (R2 is now required)
    if (req.body.imageBase64) {
      try {
        // Generate mockup ID before upload for consistent naming
        const tempId = new ObjectId().toString();
        imageUrl = await uploadImageToR2(req.body.imageBase64, userId, tempId);
      } catch (uploadError: any) {
        console.error('Failed to upload to R2:', {
          message: uploadError?.message,
          name: uploadError?.name,
          code: uploadError?.code,
          stack: uploadError?.stack,
          userId,
        });
        // R2 upload failed - return error instead of falling back to base64
        return res.status(500).json({
          error: 'Failed to upload image to R2',
          details: uploadError.message || 'R2 upload failed. Please try again or contact support.'
        });
      }
    }

    // If imageUrl is already provided (e.g., from external source), use it
    if (req.body.imageUrl && !imageUrl) {
      imageUrl = req.body.imageUrl;
      console.log(`Using provided imageUrl for user ${userId}: ${imageUrl}`);
    }

    // Validate that we have an imageUrl (either from R2 upload or provided directly)
    if (!imageUrl) {
      console.error('Image URL is required but not provided:', {
        userId,
        hasImageBase64: !!req.body.imageBase64,
        hasImageUrl: !!req.body.imageUrl,
      });
      return res.status(400).json({
        error: 'Image URL is required',
        details: 'Either imageBase64 or imageUrl must be provided.'
      });
    }

    // Ensure isLiked is always a boolean
    const isLiked = typeof req.body.isLiked === 'boolean' ? req.body.isLiked : false;

    // Save mockup with only imageUrl (no base64)
    const mockupData: MockupData = {
      userId,
      imageUrl,
      prompt: req.body.prompt,
      designType: req.body.designType || 'blank',
      tags: req.body.tags || [],
      brandingTags: req.body.brandingTags || [],
      aspectRatio: req.body.aspectRatio || '16:9',
      isLiked: isLiked, // Always boolean
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    console.log('Saving mockup to database:', {
      userId,
      imageUrl: imageUrl.substring(0, 50) + '...',
      prompt: mockupData.prompt?.substring(0, 50) || 'N/A',
      designType: mockupData.designType,
      tagsCount: mockupData.tags.length,
      brandingTagsCount: mockupData.brandingTags.length,
      isLiked: mockupData.isLiked,
    });

    const result = await db.collection('mockups').insertOne(mockupData);
    const formattedMockup = {
      ...mockupData,
      _id: result.insertedId.toString(),
      createdAt: mockupData.createdAt.toISOString(),
      updatedAt: mockupData.updatedAt.toISOString(),
    };

    console.log(`Successfully saved mockup ${result.insertedId} for user ${userId}`);

    // If mockup is liked, automatically create/update MockupExample
    if (isLiked && imageUrl) {
      await createOrUpdateMockupExample(
        {
          prompt: mockupData.prompt,
          imageUrl: imageUrl,
          designType: mockupData.designType,
          tags: mockupData.tags,
          brandingTags: mockupData.brandingTags,
          aspectRatio: mockupData.aspectRatio,
        },
        result.insertedId.toString()
      );
    }

    res.status(201).json(formattedMockup);
  } catch (error: any) {
    console.error('Error saving mockup:', {
      message: error?.message,
      name: error?.name,
      stack: error?.stack,
      userId: req.userId,
    });
    next(error);
  }
});

// Update a mockup
router.put('/:id', authenticate, async (req: AuthRequest, res, next) => {
  try {
    await connectToMongoDB();
    const db = getDb();
    const userId = req.userId!;

    let imageUrl: string | undefined;

    // If imageBase64 is provided in update, upload to R2 (R2 is now required)
    if (req.body.imageBase64) {
      try {
        // Use existing mockup ID for consistent naming
        const mockupId = req.params.id;
        imageUrl = await uploadImageToR2(req.body.imageBase64, userId, mockupId);
      } catch (uploadError: any) {
        console.error('Failed to upload to R2:', uploadError);
        // R2 upload failed - return error instead of falling back to base64
        return res.status(500).json({
          error: 'Failed to upload image to R2',
          details: uploadError.message || 'R2 upload failed. Please try again or contact support.'
        });
      }
    }

    // Prepare update data - remove imageBase64 and _id, add imageUrl if uploaded
    const updateData: any = {
      ...req.body,
      updatedAt: new Date(),
    };
    delete updateData._id;
    delete updateData.userId;
    delete updateData.imageBase64; // Never save base64 in updates

    // Ensure isLiked is always a boolean if provided
    // Convert truthy/falsy values to explicit boolean
    if ('isLiked' in updateData) {
      // Handle various truthy/falsy values and convert to boolean
      const isLikedValue = updateData.isLiked;
      if (isLikedValue === true || isLikedValue === 'true' || isLikedValue === 1) {
        updateData.isLiked = true;
      } else {
        updateData.isLiked = false;
      }
      console.log(`[Update] Updating like status for mockup ${req.params.id}: isLiked=${updateData.isLiked} (from ${typeof isLikedValue} value: ${isLikedValue})`);
    }

    // If we uploaded to R2, use the new imageUrl
    if (imageUrl) {
      updateData.imageUrl = imageUrl;
    }

    // Log what we're updating
    console.log(`[Update] Updating mockup ${req.params.id} with data:`, {
      userId,
      updateData,
      isLikedInUpdate: 'isLiked' in updateData,
      isLikedValue: updateData.isLiked,
    });

    const result = await db.collection('mockups').updateOne(
      { _id: new ObjectId(req.params.id), userId: req.userId },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Mockup not found' });
    }

    if (result.modifiedCount === 0) {
      console.warn(`[Update] Mockup ${req.params.id} was matched but not modified. This might indicate the data is the same.`);
    }

    // Verify the update by fetching the updated mockup (only once)
    const updatedMockup = await db.collection('mockups').findOne({
      _id: new ObjectId(req.params.id),
      userId: req.userId
    });

    console.log(`[Update] Successfully updated mockup ${req.params.id}`, {
      matchedCount: result.matchedCount,
      modifiedCount: result.modifiedCount,
      isLikedInUpdate: 'isLiked' in updateData,
      isLikedValue: updateData.isLiked,
      isLikedInDB: updatedMockup?.isLiked,
      isLikedType: typeof updatedMockup?.isLiked,
    });

    // If isLiked is being set to true, automatically create/update MockupExample
    if ('isLiked' in updateData && updateData.isLiked === true) {
      // Use the already fetched updatedMockup (no need to fetch again)
      if (updatedMockup && updatedMockup.imageUrl) {
        await createOrUpdateMockupExample(
          {
            prompt: updatedMockup.prompt || '',
            imageUrl: updatedMockup.imageUrl,
            designType: updatedMockup.designType || 'blank',
            tags: updatedMockup.tags || [],
            brandingTags: updatedMockup.brandingTags || [],
            aspectRatio: updatedMockup.aspectRatio || '16:9',
          },
          req.params.id
        );
      }
    }

    res.json({ message: 'Mockup updated successfully' });
  } catch (error) {
    next(error);
  }
});

// Delete a mockup
router.delete('/:id', authenticate, async (req: AuthRequest, res, next) => {
  try {
    await connectToMongoDB();
    const db = getDb();

    // Get mockup before deletion to check for R2 image
    const mockup = await db.collection('mockups').findOne({
      _id: new ObjectId(req.params.id),
      userId: req.userId
    });

    if (!mockup) {
      return res.status(404).json({ error: 'Mockup not found' });
    }

    // Delete image from R2 if it exists
    if (mockup.imageUrl) {
      try {
        const r2Service = await import('@/services/r2Service.js');
        if (r2Service.isR2Configured()) {
          await r2Service.deleteImage(mockup.imageUrl);
        }
      } catch (deleteError: any) {
        console.error('Failed to delete image from R2:', deleteError);
        // Continue with mockup deletion even if R2 deletion fails
      }
    }

    const result = await db.collection('mockups').deleteOne({
      _id: new ObjectId(req.params.id),
      userId: req.userId
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Mockup not found' });
    }

    res.json({ message: 'Mockup deleted successfully' });
  } catch (error) {
    next(error);
  }
});

// Get usage statistics for billing
router.get('/usage/stats', authenticate, async (req: AuthRequest, res, next) => {
  try {
    await connectToMongoDB();
    const db = getDb();
    const userId = req.userId!;
    const { startDate, endDate } = req.query;

    const query: any = { userId };

    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) {
        query.timestamp.$gte = new Date(startDate as string);
      }
      if (endDate) {
        query.timestamp.$lte = new Date(endDate as string);
      }
    }

    const usageRecords = await db.collection('usage_records')
      .find(query)
      .sort({ timestamp: -1 })
      .toArray();

    // Calculate totals
    const totalImages = usageRecords.reduce((sum, record) => sum + (record.imagesGenerated || 1), 0);
    const totalCost = usageRecords.reduce((sum, record) => sum + (record.cost || 0), 0);
    const totalRequests = usageRecords.length;

    // Group by date for time series data
    const dailyUsage = usageRecords.reduce((acc: any, record: any) => {
      const date = new Date(record.timestamp).toISOString().split('T')[0];
      if (!acc[date]) {
        acc[date] = { images: 0, cost: 0, requests: 0 };
      }
      acc[date].images += record.imagesGenerated || 1;
      acc[date].cost += record.cost || 0;
      acc[date].requests += 1;
      return acc;
    }, {});

    res.json({
      totalImages,
      totalCost,
      totalRequests,
      dailyUsage,
      records: usageRecords.slice(0, 100), // Last 100 records
    });
  } catch (error) {
    next(error);
  }
});

// Get current billing period usage
router.get('/usage/current', authenticate, async (req: AuthRequest, res, next) => {
  try {
    await connectToMongoDB();
    const db = getDb();
    const userId = req.userId!;

    // Get current month usage
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const usageRecords = await db.collection('usage_records')
      .find({
        userId,
        timestamp: { $gte: startOfMonth }
      })
      .toArray();

    const totalImages = usageRecords.reduce((sum, record) => sum + (record.imagesGenerated || 1), 0);
    const totalCost = usageRecords.reduce((sum, record) => sum + (record.cost || 0), 0);

    res.json({
      period: {
        start: startOfMonth,
        end: now,
      },
      totalImages,
      totalCost,
      requests: usageRecords.length,
    });
  } catch (error) {
    next(error);
  }
});

export default router;

