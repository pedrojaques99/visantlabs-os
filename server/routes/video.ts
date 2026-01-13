import express from 'express';
import crypto from 'crypto';
import { getDb, connectToMongoDB } from '../db/mongodb.js';
import { ObjectId } from 'mongodb';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { checkSubscription, SubscriptionRequest } from '../middleware/subscription.js';
import { generateVideo } from '../services/videoService.js';
import { getVideoCreditsRequired } from '@/utils/usageTracking.js';
import { uploadCanvasVideo, isR2Configured } from '../services/r2Service.js';
import { calculateVideoCost } from '../src/utils/pricing.js';

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

    // Build update based on source using $inc
    const updateFields: any = {};

    // Add back earned credits
    if (fromEarned > 0) {
      updateFields.totalCreditsEarned = fromEarned;
    }

    // Reduce creditsUsed (only if monthly credits were used)
    if (fromMonthly > 0) {
      updateFields.creditsUsed = -fromMonthly;
    }

    if (Object.keys(updateFields).length > 0) {
      await db.collection('users').updateOne(
        { _id: new ObjectId(userId) },
        { $inc: updateFields }
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
      totalCreditsEarned: creditsToAddToEarned
    };

    // Only reduce creditsUsed if it's positive and we're refunding some monthly credits
    if (creditsToReduceFromUsed > 0) {
      updateFields.creditsUsed = -creditsToReduceFromUsed;
    }

    await db.collection('users').updateOne(
      { _id: new ObjectId(userId) },
      { $inc: updateFields }
    );

    console.log(`${logPrefix} [refundCredits] ✅ Refunded credits (fallback method)`, {
      userId,
      creditsToRefund,
      creditsToAddToEarned,
      creditsToReduceFromUsed,
    });
  }
}

const router = express.Router();

// Test route to verify video routes are working
router.get('/test', (req, res) => {
  res.json({ message: 'Video routes are working', timestamp: new Date().toISOString() });
});

// Helper function to atomically deduct credits BEFORE generation
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

  // Check if user has enough credits
  if (totalCreditsBefore < creditsToDeduct) {
    console.error(`${logPrefix} [deductCreditsAtomically] ❌ Insufficient credits`, {
      userId,
      totalCredits: totalCreditsBefore,
      creditsToDeduct,
    });
    throw new Error(`Insufficient credits. Required: ${creditsToDeduct}, Available: ${totalCreditsBefore}`);
  }

  // Calculate deduction strategy: use earned credits first, then monthly
  const fromEarned = Math.min(totalCreditsEarnedBefore, creditsToDeduct);
  const fromMonthly = creditsToDeduct - fromEarned;

  // Use simple $inc operation which is atomic and reliable
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

  // If update failed, verify current state
  if (!result) {
    const currentUser = await db.collection('users').findOne({ _id: new ObjectId(userId) });
    if (!currentUser) {
      throw new Error('User not found');
    }

    const currentTotalEarned = currentUser.totalCreditsEarned || 0;
    const currentMonthlyCredits = currentUser.monthlyCredits || 20;
    const currentCreditsUsed = currentUser.creditsUsed || 0;
    const currentMonthlyRemaining = Math.max(0, currentMonthlyCredits - currentCreditsUsed);
    const currentTotal = currentTotalEarned + currentMonthlyRemaining;

    if (currentTotal < creditsToDeduct) {
      throw new Error(`Insufficient credits. Required: ${creditsToDeduct}, Available: ${currentTotal}`);
    } else {
      throw new Error(`System error: Failed to deduct credits. Please try again. Available: ${currentTotal}`);
    }
  }

  console.log(`${logPrefix} [deductCreditsAtomically] ✅ Success`, {
    userId,
    creditsToDeduct,
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

// Generate video (validates and deducts credits BEFORE generation)
router.post('/generate', authenticate, checkSubscription, async (req: SubscriptionRequest, res, next) => {
  const logPrefix = '[VIDEO GENERATE]';
  console.log(`${logPrefix} Route called - Method: ${req.method}, URL: ${req.url}, Path: ${req.path}`);

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
      prompt,
      imageBase64,
      imageMimeType = 'image/png',
      model = 'veo-3.1-generate-preview',
      canvasId,
      nodeId,
      // New params
      referenceImages: referenceImagesRaw,
      inputVideo: inputVideoRaw,
      startFrame: startFrameRaw,
      endFrame: endFrameRaw,
    } = req.body;

    // Helper to normalize media inputs (handle objects from client)
    const normalizeMediaInput = (input: any): string | undefined => {
      if (!input) return undefined;
      if (typeof input === 'string') return input;
      if (typeof input === 'object' && input !== null) {
        return input.base64 || input.url || undefined;
      }
      return undefined;
    };

    // Normalize all media inputs - handle objects from client
    const startFrame = normalizeMediaInput(startFrameRaw);
    const endFrame = normalizeMediaInput(endFrameRaw);
    const inputVideo = normalizeMediaInput(inputVideoRaw);

    // Normalize referenceImages array
    let referenceImages: string[] | undefined = undefined;
    if (referenceImagesRaw && Array.isArray(referenceImagesRaw)) {
      referenceImages = referenceImagesRaw
        .map(normalizeMediaInput)
        .filter((img): img is string => !!img);
      if (referenceImages.length === 0) referenceImages = undefined;
    }

    console.log(`${logPrefix} [REQUEST] Received video generation request`, {
      userId: req.userId,
      requestId,
      hasPrompt: !!prompt,
      hasImage: !!imageBase64,
      hasReferenceImages: referenceImages?.length || 0,
      hasInputVideo: !!inputVideo,
      model,
      canvasId: canvasId || 'not provided',
      nodeId: nodeId || 'not provided',
    });

    // CRITICAL: Check for duplicate recent requests to prevent multiple credit deductions
    const db = getDb();

    // Ensure TTL index exists on credit_locks collection
    try {
      await db.collection('credit_locks').createIndex(
        { expiresAt: 1 },
        {
          expireAfterSeconds: 0,
          background: true,
          name: 'expiresAt_ttl_index'
        }
      );
    } catch (indexError: any) {
      if (indexError.code !== 85 && !indexError.message?.includes('already exists')) {
        console.warn(`${logPrefix} [LOCK] Warning: Could not create TTL index:`, indexError.message);
      }
    }

    // Create a lock key to prevent duplicate credit deductions
    // Use SHA-256 hash of the FULL prompt to prevent collisions on long prompts
    const promptHash = prompt ? crypto.createHash('sha256').update(prompt).digest('hex') : 'no-prompt';

    // Include nodeId in lock key to allow same prompt on different nodes
    const nodeIdKey = nodeId ? `-node-${nodeId}` : '';
    lockKey = `credit-deduction-video-${req.userId}-${model}-${promptHash}${nodeIdKey}`;
    const lockExpiry = new Date(Date.now() + 1200000); // 20 minutes lock (video generation can take long)

    // Clean up expired locks
    await db.collection('credit_locks').deleteMany({
      expiresAt: { $lt: new Date() }
    });

    // Check for existing lock
    const existingLock = await db.collection('credit_locks').findOne({
      lockKey,
      expiresAt: { $gt: new Date() }
    });

    if (existingLock) {
      console.warn(`${logPrefix} [DUPLICATE DETECTION] ⚠️ Active lock found, REJECTING duplicate request`, {
        userId: req.userId,
        requestId,
        existingLockRequestId: existingLock.requestId,
        lockKey,
      });

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
      createdAt: new Date(),
      expiresAt: lockExpiry,
    });

    console.log(`${logPrefix} [LOCK] ✅ Acquired lock for credit deduction`, {
      userId: req.userId,
      requestId,
      lockKey,
      lockId: lockInsertResult.insertedId,
    });

    // Validate prompt
    if (!prompt || prompt.trim().length === 0) {
      if (lockKey) {
        await db.collection('credit_locks').deleteOne({ lockKey, requestId });
      }
      return res.status(400).json({ error: 'Prompt is required' });
    }

    // Calculate credits required (20 credits per video)
    creditsToDeduct = getVideoCreditsRequired();

    console.log(`${logPrefix} [Credit Calculation] Before deduction`, {
      userId: req.userId,
      requestId,
      model,
      creditsToDeduct,
      timestamp: new Date().toISOString(),
    });

    // Check if user is admin before deducting credits
    const userBeforeDeduction = await db.collection('users').findOne({ _id: new ObjectId(req.userId!) });
    const isAdmin = userBeforeDeduction?.isAdmin === true;

    let updatedUser: any;
    let actualCreditsDeducted = 0;

    if (isAdmin) {
      // Admin users - skip credit deduction
      console.log(`${logPrefix} [CREDIT DEDUCTION] Admin user - skipping credit deduction`, {
        userId: req.userId,
        requestId,
        creditsToDeduct,
      });
      updatedUser = userBeforeDeduction;
      creditsDeducted = false;
      actualCreditsDeducted = 0;
      deductionSource = { fromEarned: 0, fromMonthly: 0 };
    } else {
      // CRITICAL: Deduct credits BEFORE generation (atomic operation)
      console.log(`${logPrefix} [CREDIT DEDUCTION] About to deduct credits (lock is held)`, {
        userId: req.userId,
        requestId,
        creditsToDeduct,
      });

      const deductionResult = await deductCreditsAtomically(req.userId!, creditsToDeduct, requestId);
      updatedUser = deductionResult.updatedUser;
      deductionSource = deductionResult.deductionSource;
      creditsDeducted = true;
      actualCreditsDeducted = creditsToDeduct;

      console.log(`${logPrefix} [CREDIT DEDUCTION] ✅ Credits deducted successfully`, {
        userId: req.userId,
        requestId,
        creditsToDeduct,
        fromEarned: deductionSource.fromEarned,
        fromMonthly: deductionSource.fromMonthly,
        totalCreditsEarned: updatedUser.totalCreditsEarned,
        creditsUsed: updatedUser.creditsUsed,
      });
    }

    // Normalize model name
    let normalizedModel = model;
    if (model === 'veo-3' || model === 'veo-2') {
      // Map old model names to current valid model
      normalizedModel = 'veo-3.1-generate-preview';
      console.log(`${logPrefix} [Model Normalization] ${model} -> ${normalizedModel}`);
    }

    // Validate model is supported
    const supportedModels = ['veo-3.1-generate-preview'];
    if (!supportedModels.includes(normalizedModel)) {
      if (lockKey) {
        await db.collection('credit_locks').deleteOne({ lockKey, requestId });
      }
      return res.status(400).json({
        error: 'Unsupported model',
        message: `Model "${model}" is not supported. Please use one of: ${supportedModels.join(', ')}`,
        supportedModels
      });
    }

    // Generate video using Google Veo
    let videoBase64: string;
    try {
      console.log(`${logPrefix} [GENERATION] Starting video generation`, {
        userId: req.userId,
        requestId,
        model: normalizedModel,
        promptLength: prompt?.length || 0,
        hasReferenceImages: referenceImages?.length || 0,
      });

      videoBase64 = await generateVideo({
        prompt,
        imageBase64,
        imageMimeType,
        model: normalizedModel,
        // Pass new params
        referenceImages,
        inputVideo,
        startFrame,
        endFrame,
      });

      console.log(`${logPrefix} [GENERATION] ✅ Video generated successfully`, {
        userId: req.userId,
        requestId,
        videoBase64Length: videoBase64?.length || 0,
        videoSizeKB: videoBase64 ? Math.round((videoBase64.length * 3) / 4 / 1024) : 0,
      });
    } catch (error: any) {
      // Release lock on error
      if (lockKey) {
        await db.collection('credit_locks').deleteOne({ lockKey, requestId });
      }

      // Refund credits if generation failed and credits were deducted
      if (creditsDeducted && !isAdmin) {
        console.log(`${logPrefix} [REFUND] Attempting to refund credits due to generation failure`, {
          userId: req.userId,
          creditsToRefund: actualCreditsDeducted,
          error: error.message,
        });

        try {
          await refundCredits(req.userId!, actualCreditsDeducted, deductionSource);
          console.log(`${logPrefix} [REFUND] ✅ Credits refunded successfully`, {
            userId: req.userId,
            creditsRefunded: actualCreditsDeducted,
          });
        } catch (refundError: any) {
          console.error(`${logPrefix} [REFUND] ❌ Failed to refund credits:`, {
            userId: req.userId,
            creditsToRefund: actualCreditsDeducted,
            refundError: refundError.message,
          });
          // Continue to throw original error even if refund fails
        }
      }

      throw error;
    }

    // Release lock after successful generation
    if (lockKey) {
      await db.collection('credit_locks').deleteOne({ lockKey, requestId });
    }

    // Upload video to R2 if canvasId is provided and video is in data URL format
    let videoUrl: string | undefined;
    const isDataUrl = videoBase64 && videoBase64.startsWith('data:video/');
    const isUri = videoBase64 && (videoBase64.startsWith('http://') || videoBase64.startsWith('https://'));

    if (canvasId && isR2Configured() && isDataUrl) {
      try {
        console.log(`${logPrefix} [R2 UPLOAD] Starting upload to R2`, {
          userId: req.userId,
          requestId,
          canvasId,
          nodeId: nodeId || 'not provided',
          videoSizeKB: videoBase64 ? Math.round((videoBase64.length * 3) / 4 / 1024) : 0,
          format: 'data URL',
        });

        // Video is already in data URL format, upload directly
        videoUrl = await uploadCanvasVideo(videoBase64, req.userId!, canvasId, nodeId);

        console.log(`${logPrefix} [R2 UPLOAD] ✅ Video uploaded to R2 successfully`, {
          userId: req.userId,
          requestId,
          canvasId,
          nodeId: nodeId || 'not provided',
          videoUrl,
        });
      } catch (r2Error: any) {
        console.error(`${logPrefix} [R2 UPLOAD] ❌ Failed to upload video to R2:`, {
          userId: req.userId,
          requestId,
          canvasId,
          nodeId: nodeId || 'not provided',
          error: r2Error.message,
          stack: r2Error.stack,
        });
        // Continue with base64/URI fallback if R2 upload fails
        console.warn(`${logPrefix} [R2 UPLOAD] Continuing with original format fallback due to R2 upload failure`);
      }
    } else {
      if (!canvasId) {
        console.log(`${logPrefix} [R2 UPLOAD] Skipping R2 upload - canvasId not provided`, {
          userId: req.userId,
          requestId,
          format: isUri ? 'URI' : isDataUrl ? 'data URL' : 'unknown',
        });
      } else if (!isR2Configured()) {
        console.log(`${logPrefix} [R2 UPLOAD] Skipping R2 upload - R2 not configured`, {
          userId: req.userId,
          requestId,
          format: isUri ? 'URI' : isDataUrl ? 'data URL' : 'unknown',
        });
      } else if (isUri) {
        console.log(`${logPrefix} [R2 UPLOAD] Skipping R2 upload - video is URI, returning as-is`, {
          userId: req.userId,
          requestId,
          uri: videoBase64.substring(0, 100) + '...',
        });
        // For URIs, return as videoUrl instead
        videoUrl = videoBase64;
      }
    }

    // Calculate remaining credits
    const totalCreditsEarned = updatedUser.totalCreditsEarned || 0;
    const monthlyCredits = updatedUser.monthlyCredits || 20;
    const creditsUsed = updatedUser.creditsUsed || 0;
    const monthlyCreditsRemaining = Math.max(0, monthlyCredits - creditsUsed);
    const creditsRemaining = totalCreditsEarned + monthlyCreditsRemaining;

    // Return video URL (prefer R2 URL) and credit information
    // Include base64 as fallback if R2 upload failed or wasn't attempted (and it's not a URI)
    const response: any = {
      videoUrl: videoUrl || (isUri ? videoBase64 : undefined), // R2 URL or URI
      videoBase64: (videoUrl || isUri) ? undefined : videoBase64, // Only send base64 if R2 URL/URI is not available
      creditsDeducted: actualCreditsDeducted,
      creditsRemaining,
      isAdmin,
    };

    console.log(`${logPrefix} [RESPONSE] Sending response`, {
      userId: req.userId,
      requestId,
      hasVideoUrl: !!videoUrl,
      hasVideoBase64: !!response.videoBase64,
      creditsDeducted: actualCreditsDeducted,
      creditsRemaining,
    });

    // Create usage record for video generation
    try {
      const videoUsageRecord = {
        userId: req.userId,
        type: 'video',
        videosGenerated: 1,
        model: normalizedModel,
        promptLength: prompt?.length || 0,
        hasInputImage: !!imageBase64,
        timestamp: new Date(),
        cost: calculateVideoCost(1),
        creditsDeducted: actualCreditsDeducted,
        subscriptionStatus: updatedUser.subscriptionStatus || 'free',
        hasActiveSubscription: updatedUser.subscriptionStatus === 'active',
        isAdmin,
        requestId,
        feature: canvasId ? 'canvas' as const : undefined,
        createdAt: new Date(),
      };

      await db.collection('usage_records').insertOne(videoUsageRecord);

      console.log(`${logPrefix} [USAGE TRACKING] Recorded video generation usage`, {
        userId: req.userId,
        requestId,
        model: normalizedModel,
        creditsDeducted: actualCreditsDeducted,
      });
    } catch (usageError: any) {
      // Log error but don't throw - usage tracking failure shouldn't break video generation
      console.error(`${logPrefix} [USAGE TRACKING] Failed to create usage record:`, {
        error: usageError.message,
        userId: req.userId,
        requestId,
      });
    }

    res.json(response);

  } catch (error: any) {
    // Release lock on error
    if (lockKey) {
      try {
        await getDb().collection('credit_locks').deleteOne({ lockKey, requestId });
      } catch (lockError) {
        console.error(`${logPrefix} [ERROR] Failed to release lock:`, lockError);
      }
    }

    // Refund credits if generation failed and credits were deducted
    if (creditsDeducted && !error.message?.includes('Insufficient credits')) {
      console.log(`${logPrefix} [REFUND] Attempting to refund credits due to error`, {
        userId: req.userId,
        creditsToRefund: creditsToDeduct,
        error: error.message,
      });

      try {
        await refundCredits(req.userId!, creditsToDeduct, deductionSource);
        console.log(`${logPrefix} [REFUND] ✅ Credits refunded successfully`, {
          userId: req.userId,
          creditsRefunded: creditsToDeduct,
        });
      } catch (refundError: any) {
        console.error(`${logPrefix} [REFUND] ❌ Failed to refund credits:`, {
          userId: req.userId,
          creditsToRefund: creditsToDeduct,
          refundError: refundError.message,
        });
        // Continue to throw original error even if refund fails
      }
    }

    console.error(`${logPrefix} [ERROR] Video generation failed:`, {
      userId: req.userId,
      requestId,
      error: error.message,
      stack: error.stack,
    });

    next(error);
  }
});

export default router;

