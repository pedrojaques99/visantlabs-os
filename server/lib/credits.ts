/**
 * Credits — single source of truth for credit deduction, refund, and validation.
 *
 * All route handlers (video, mockups, branding, etc.) MUST use these functions
 * instead of implementing their own credit logic.
 */

import { getDb, connectToMongoDB } from '../db/mongodb.js';
import { ObjectId } from 'mongodb';
import { Sentry } from './sentry.js';

/**
 * Free-tier generation cap, enforced by checkSubscription middleware and
 * reported by status endpoints. Keep ONE value — UI paywall copy depends on it.
 */
export const FREE_GENERATIONS_LIMIT = 10;

/** Monthly credits granted to free accounts on signup and on monthly reset. */
export const FREE_MONTHLY_CREDITS = 20;

export interface DeductionSource {
  fromEarned: number;
  fromMonthly: number;
}

export interface DeductionResult {
  success: true;
  updatedUser: any;
  deductionSource: DeductionSource;
}

const LOG_PREFIX = '[CREDIT]';

/**
 * Atomically deduct credits from a user account.
 * Strategy: earned credits first, then monthly credits.
 * Uses MongoDB findOneAndUpdate with $inc for atomicity.
 */
export async function deductCreditsAtomically(
  userId: string,
  creditsToDeduct: number,
  requestId?: string
): Promise<DeductionResult> {
  console.log(`${LOG_PREFIX} [deductCreditsAtomically] Starting`, {
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

  const userBefore = await db.collection('users').findOne({ _id: new ObjectId(userId) });
  if (!userBefore) {
    throw new Error('User not found');
  }

  const totalCreditsEarnedBefore = userBefore.totalCreditsEarned ?? 0;
  const monthlyCreditsBefore = userBefore.monthlyCredits ?? 20;
  const creditsUsedBefore = userBefore.creditsUsed ?? 0;
  const monthlyCreditsRemainingBefore = Math.max(0, monthlyCreditsBefore - creditsUsedBefore);
  const totalCreditsBefore = totalCreditsEarnedBefore + monthlyCreditsRemainingBefore;

  if (totalCreditsBefore < creditsToDeduct) {
    console.error(`${LOG_PREFIX} [deductCreditsAtomically] Insufficient credits`, {
      userId,
      totalCredits: totalCreditsBefore,
      creditsToDeduct,
    });
    throw new Error(
      `Insufficient credits. Required: ${creditsToDeduct}, Available: ${totalCreditsBefore}`
    );
  }

  const fromEarned = Math.min(totalCreditsEarnedBefore, creditsToDeduct);
  const fromMonthly = creditsToDeduct - fromEarned;

  const updateOperation: any = {};
  if (fromEarned > 0) {
    updateOperation.totalCreditsEarned = -fromEarned;
  }
  if (fromMonthly > 0) {
    updateOperation.creditsUsed = fromMonthly;
  }

  if (Object.keys(updateOperation).length === 0) {
    throw new Error('No credits to deduct - calculation error');
  }

  const result = await db.collection('users').findOneAndUpdate(
    {
      _id: new ObjectId(userId),
      ...(fromEarned > 0 ? { totalCreditsEarned: { $gte: fromEarned } } : {}),
      ...(fromMonthly > 0
        ? {
            $expr: {
              $gte: [
                {
                  $subtract: [
                    { $ifNull: ['$monthlyCredits', 20] },
                    { $ifNull: ['$creditsUsed', 0] },
                  ],
                },
                fromMonthly,
              ],
            },
          }
        : {}),
    },
    { $inc: updateOperation },
    { returnDocument: 'after' }
  );

  if (!result) {
    const currentUser = await db.collection('users').findOne({ _id: new ObjectId(userId) });
    if (!currentUser) {
      throw new Error('User not found');
    }

    const currentTotalEarned = currentUser.totalCreditsEarned ?? 0;
    const currentMonthlyCredits = currentUser.monthlyCredits ?? 20;
    const currentCreditsUsed = currentUser.creditsUsed ?? 0;
    const currentMonthlyRemaining = Math.max(0, currentMonthlyCredits - currentCreditsUsed);
    const currentTotal = currentTotalEarned + currentMonthlyRemaining;

    if (currentTotal < creditsToDeduct) {
      throw new Error(
        `Insufficient credits. Required: ${creditsToDeduct}, Available: ${currentTotal}`
      );
    } else {
      throw new Error(
        `System error: Failed to deduct credits. Please try again. Available: ${currentTotal}`
      );
    }
  }

  console.log(`${LOG_PREFIX} [deductCreditsAtomically] Success`, {
    userId,
    creditsToDeduct,
    fromEarned,
    fromMonthly,
  });

  return {
    success: true,
    updatedUser: result,
    deductionSource: { fromEarned, fromMonthly },
  };
}

/**
 * Refund credits to a user account.
 * When deductionSource is provided, refunds to the exact buckets that were charged.
 * Otherwise falls back to adding to totalCreditsEarned.
 */
export async function refundCredits(
  userId: string,
  creditsToRefund: number,
  deductionSource?: DeductionSource
): Promise<void> {
  await connectToMongoDB();
  const db = getDb();

  if (deductionSource) {
    const { fromEarned, fromMonthly } = deductionSource;

    console.log(`${LOG_PREFIX} [refundCredits] Refunding with source tracking`, {
      userId,
      creditsToRefund,
      fromEarned,
      fromMonthly,
    });

    const updateFields: any = {};
    if (fromEarned > 0) {
      updateFields.totalCreditsEarned = fromEarned;
    }
    if (fromMonthly > 0) {
      updateFields.creditsUsed = -fromMonthly;
    }

    if (Object.keys(updateFields).length > 0) {
      await db.collection('users').updateOne({ _id: new ObjectId(userId) }, { $inc: updateFields });
    }

    console.log(`${LOG_PREFIX} [refundCredits] Refunded with source tracking`, {
      userId,
      fromEarned,
      fromMonthly,
      totalRefunded: creditsToRefund,
    });
  } else {
    console.warn(`${LOG_PREFIX} [refundCredits] No deduction source provided, using fallback`, {
      userId,
      creditsToRefund,
    });

    const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });
    if (!user) {
      throw new Error('User not found for refund');
    }

    const currentCreditsUsed = user.creditsUsed || 0;
    const creditsToReduceFromUsed = Math.min(creditsToRefund, currentCreditsUsed);

    const updateFields: any = {
      totalCreditsEarned: creditsToRefund,
    };
    if (creditsToReduceFromUsed > 0) {
      updateFields.creditsUsed = -creditsToReduceFromUsed;
    }

    await db.collection('users').updateOne({ _id: new ObjectId(userId) }, { $inc: updateFields });

    console.log(`${LOG_PREFIX} [refundCredits] Refunded (fallback)`, {
      userId,
      creditsToRefund,
      creditsToReduceFromUsed,
    });
  }
}

/**
 * Refund credits with exponential backoff retry.
 */
export async function refundCreditsWithRetry(
  userId: string,
  creditsToRefund: number,
  deductionSource?: DeductionSource,
  maxRetries: number = 3
): Promise<void> {
  let lastError: any = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await refundCredits(userId, creditsToRefund, deductionSource);
      if (attempt > 1) {
        console.log(`${LOG_PREFIX} [refundCreditsWithRetry] Succeeded on attempt ${attempt}`, {
          userId,
          creditsToRefund,
        });
      }
      return;
    } catch (error: any) {
      lastError = error;
      if (attempt === maxRetries) {
        console.error(`${LOG_PREFIX} [refundCreditsWithRetry] All ${maxRetries} attempts failed`, {
          userId,
          creditsToRefund,
          error: error.message,
        });
        await recordFailedRefund(userId, creditsToRefund, deductionSource, error);
      } else {
        const delayMs = Math.pow(2, attempt - 1) * 1000;
        console.warn(
          `${LOG_PREFIX} [refundCreditsWithRetry] Attempt ${attempt} failed, retrying in ${delayMs}ms`,
          {
            userId,
            creditsToRefund,
            error: error.message,
          }
        );
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  throw lastError;
}

/**
 * Last line of defense when every refund attempt fails: alert Sentry and
 * persist a failed_refunds record so the credit can be restored manually
 * (or by a reconciliation job) instead of vanishing into logs.
 */
async function recordFailedRefund(
  userId: string,
  creditsToRefund: number,
  deductionSource: DeductionSource | undefined,
  error: any
): Promise<void> {
  Sentry.captureMessage('CRITICAL: credit refund failed after all retries', {
    level: 'fatal',
    extra: { userId, creditsToRefund, deductionSource, error: error?.message },
  });

  try {
    await connectToMongoDB();
    const db = getDb();
    await db.collection('failed_refunds').insertOne({
      userId,
      creditsToRefund,
      deductionSource: deductionSource ?? null,
      error: error?.message ?? String(error),
      resolved: false,
      createdAt: new Date(),
    });
  } catch (persistError: any) {
    console.error(`${LOG_PREFIX} [recordFailedRefund] Could not persist failed refund`, {
      userId,
      creditsToRefund,
      error: persistError?.message,
    });
  }
}

/**
 * Check if a user is admin (exempt from credit charges).
 */
export async function isUserAdmin(userId: string): Promise<{ isAdmin: boolean; user: any }> {
  await connectToMongoDB();
  const db = getDb();
  const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });
  if (!user) {
    throw new Error('User not found');
  }
  return { isAdmin: user.isAdmin === true, user };
}

/**
 * Full credit flow: check admin/unlimited status, then deduct if needed.
 * Returns a standardized result that all routes can use.
 */
export interface CreditChargeResult {
  charged: boolean;
  creditsDeducted: number;
  deductionSource: DeductionSource;
  user: any;
  reason: 'admin' | 'unlimited' | 'user-key' | 'charged';
}

export async function chargeCredits(
  userId: string,
  creditsToDeduct: number,
  opts?: {
    requestId?: string;
    isUnlimited?: boolean;
    isUserApiKey?: boolean;
  }
): Promise<CreditChargeResult> {
  const { requestId, isUnlimited, isUserApiKey } = opts || {};
  const noDeductionSource: DeductionSource = { fromEarned: 0, fromMonthly: 0 };

  const { isAdmin, user } = await isUserAdmin(userId);

  if (isAdmin) {
    console.log(`${LOG_PREFIX} Admin user — skipping deduction`, { userId });
    return {
      charged: false,
      creditsDeducted: 0,
      deductionSource: noDeductionSource,
      user,
      reason: 'admin',
    };
  }

  if (isUserApiKey) {
    console.log(`${LOG_PREFIX} User API key — skipping deduction`, { userId });
    return {
      charged: false,
      creditsDeducted: 0,
      deductionSource: noDeductionSource,
      user,
      reason: 'user-key',
    };
  }

  if (isUnlimited || creditsToDeduct === 0) {
    console.log(`${LOG_PREFIX} Unlimited generation — skipping deduction`, { userId });
    return {
      charged: false,
      creditsDeducted: 0,
      deductionSource: noDeductionSource,
      user,
      reason: 'unlimited',
    };
  }

  const result = await deductCreditsAtomically(userId, creditsToDeduct, requestId);
  return {
    charged: true,
    creditsDeducted: creditsToDeduct,
    deductionSource: result.deductionSource,
    user: result.updatedUser,
    reason: 'charged',
  };
}
