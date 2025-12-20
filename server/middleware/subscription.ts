import { Response, NextFunction } from 'express';
import { ObjectId } from 'mongodb';
import { connectToMongoDB, getDb } from '../db/mongodb.js';
import { AuthRequest } from './auth.js';

const FREE_GENERATIONS_LIMIT = 10;
const FREE_MONTHLY_CREDITS = 20;

// Helper function to renew credits if reset date has passed
const renewCreditsIfNeeded = async (user: any, db: any) => {
  const creditsResetDate = user.creditsResetDate ? new Date(user.creditsResetDate) : null;
  const now = new Date();

  if (creditsResetDate && now >= creditsResetDate) {
    const monthlyCredits = user.monthlyCredits || FREE_MONTHLY_CREDITS;
    const creditsUsed = user?.creditsUsed || 0;
    
    // creditsUsed now tracks ALL credits used (both earned and monthly)
    // When resetting, we only reset creditsUsed to 0
    // totalCreditsEarned is not affected (it was already deducted when used)
    
    // Calculate next reset date (30 days from now for free users, or use subscriptionEndDate)
    const nextResetDate = user.subscriptionEndDate 
      ? new Date(user.subscriptionEndDate)
      : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    await db.collection('users').updateOne(
      { _id: user._id },
      {
        $set: {
          creditsUsed: 0,
          creditsResetDate: nextResetDate,
          // Don't modify totalCreditsEarned - it's already been deducted when credits were used
        },
      }
    );

    return {
      creditsUsed: 0,
      monthlyCredits: monthlyCredits,
      creditsResetDate: nextResetDate,
    };
  }

  return null;
};

// Helper function to migrate freeGenerationsUsed to credits system
const migrateToCreditsSystem = async (user: any, db: any) => {
  // Check if user needs migration (has freeGenerationsUsed but no creditsResetDate set)
  if (user.freeGenerationsUsed && user.freeGenerationsUsed > 0 && !user.creditsResetDate) {
    const monthlyCredits = user.monthlyCredits || FREE_MONTHLY_CREDITS;
    const creditsUsed = Math.min(user.freeGenerationsUsed, monthlyCredits);
    
    // Set initial credits reset date (30 days from now for free users)
    const creditsResetDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await db.collection('users').updateOne(
      { _id: user._id },
      {
        $set: {
          monthlyCredits: monthlyCredits,
          creditsUsed: creditsUsed,
          creditsResetDate: creditsResetDate,
        },
      }
    );

    return {
      monthlyCredits: monthlyCredits,
      creditsUsed: creditsUsed,
      creditsResetDate: creditsResetDate,
    };
  }

  return null;
};

export interface SubscriptionRequest extends AuthRequest {
  subscriptionStatus?: string;
  hasActiveSubscription?: boolean;
  freeGenerationsUsed?: number;
  freeGenerationsRemaining?: number;
  monthlyCredits?: number;
  creditsUsed?: number;
  creditsRemaining?: number;
  creditsResetDate?: Date;
}

export const checkSubscription = async (
  req: SubscriptionRequest,
  res: Response,
  next: NextFunction
) => {
  const startTime = Date.now();
  const userId = req.userId!;
  
  console.log('[checkSubscription] Starting subscription check', {
    userId,
    timestamp: new Date().toISOString(),
    path: req.path,
    method: req.method,
  });

  try {
    await connectToMongoDB();
    const db = getDb();

    let user = await db.collection('users').findOne({ _id: new ObjectId(userId) });
    
    if (!user) {
      console.error('[checkSubscription] User not found', { userId });
      return res.status(404).json({ error: 'User not found' });
    }

    // Log raw user data from MongoDB to see all fields
    console.log('[checkSubscription] User found - RAW DATA', {
      userId,
      _id: user._id?.toString(),
      allFields: Object.keys(user),
      subscriptionStatus: user.subscriptionStatus,
      totalCreditsEarned: user.totalCreditsEarned,
      totalCreditsEarnedType: typeof user.totalCreditsEarned,
      monthlyCredits: user.monthlyCredits,
      creditsUsed: user.creditsUsed,
      freeGenerationsUsed: user.freeGenerationsUsed,
      creditsResetDate: user.creditsResetDate,
      // Check for alternative field names
      creditsEarned: user.creditsEarned,
      earnedCredits: user.earnedCredits,
    });

    // Migrate to credits system if needed
    const migrationResult = await migrateToCreditsSystem(user, db);
    if (migrationResult) {
      // Reload user after migration
      user = await db.collection('users').findOne({ _id: new ObjectId(userId) });
    }

    const subscriptionStatus = user?.subscriptionStatus || 'free';
    const hasActiveSubscription = subscriptionStatus === 'active';
    
    // Get credits information
    const monthlyCredits = user?.monthlyCredits || FREE_MONTHLY_CREDITS;
    let creditsUsed = user?.creditsUsed || 0;
    let creditsResetDate: Date | undefined = user?.creditsResetDate ? new Date(user.creditsResetDate) : undefined;

    // Renew credits if reset date has passed
    const renewalResult = await renewCreditsIfNeeded(user, db);
    if (renewalResult) {
      creditsUsed = renewalResult.creditsUsed;
      creditsResetDate = renewalResult.creditsResetDate;
      // Reload user after renewal to get updated totalCreditsEarned
      user = await db.collection('users').findOne({ _id: new ObjectId(userId) });
    }

    const creditsRemaining = Math.max(0, monthlyCredits - creditsUsed);
    const freeGenerationsUsed = user?.freeGenerationsUsed || 0;
    // Use ?? to handle null/undefined, but keep 0 as valid value
    const totalCreditsEarned = (user?.totalCreditsEarned !== null && user?.totalCreditsEarned !== undefined) 
      ? user?.totalCreditsEarned 
      : 0;
    const totalCredits = totalCreditsEarned + creditsRemaining;

    // Check if user can generate
    // User can generate if they have ANY credits available:
    // - Manual credits (totalCreditsEarned) OR
    // - Monthly credits remaining (creditsRemaining)
    // For free users, also check old system (freeGenerationsUsed)
    const hasManualCredits = totalCreditsEarned > 0;
    const hasMonthlyCredits = creditsRemaining > 0;
    const hasAnyCredits = hasManualCredits || hasMonthlyCredits;
    
    // Free users with earned credits can always generate (regardless of freeGenerationsUsed)
    // Otherwise, free users need free generations remaining AND any credits
    const canGenerate = hasActiveSubscription 
      ? hasAnyCredits
      : (hasManualCredits || (freeGenerationsUsed < FREE_GENERATIONS_LIMIT && hasAnyCredits));

    const decisionDetails = {
      userId,
      subscriptionStatus,
      hasActiveSubscription,
      totalCreditsEarned,
      monthlyCredits,
      creditsUsed,
      creditsRemaining,
      freeGenerationsUsed,
      freeGenerationsRemaining: Math.max(0, FREE_GENERATIONS_LIMIT - freeGenerationsUsed),
      hasManualCredits,
      hasMonthlyCredits,
      hasAnyCredits,
      canGenerate,
      totalCredits,
      creditsResetDate: creditsResetDate?.toISOString(),
    };

    console.log('[checkSubscription] Credit calculation and decision', decisionDetails);

    // Only return error if user has NO credits at all (neither manual nor monthly)
    if (!canGenerate) {
      console.error('[checkSubscription] ❌ BLOCKED - User cannot generate', {
        ...decisionDetails,
        reason: hasActiveSubscription 
          ? 'No credits available (active subscription)'
          : hasManualCredits 
            ? 'Should not happen - hasManualCredits is true but canGenerate is false'
            : freeGenerationsUsed >= FREE_GENERATIONS_LIMIT
              ? 'Free generations limit reached and no manual credits'
              : !hasAnyCredits
                ? 'No credits available (neither manual nor monthly)'
                : 'Unknown reason',
      });
      
      return res.status(403).json({
        error: 'Subscription required',
        message: hasActiveSubscription 
          ? 'You have used all your credits. Credits will renew on your next billing cycle.'
          : 'You have used all free generations. Please subscribe to continue.',
        freeGenerationsUsed,
        freeGenerationsRemaining: Math.max(0, FREE_GENERATIONS_LIMIT - freeGenerationsUsed),
        monthlyCredits,
        creditsUsed,
        creditsRemaining,
        totalCreditsEarned,
        totalCredits,
        creditsResetDate,
        requiresSubscription: true,
        debug: decisionDetails, // Include debug info in response
      });
    }

    console.log('[checkSubscription] ✅ ALLOWED - User can generate', {
      ...decisionDetails,
      duration: `${Date.now() - startTime}ms`,
    });

    // Attach subscription info to request
    req.subscriptionStatus = subscriptionStatus;
    req.hasActiveSubscription = hasActiveSubscription;
    req.freeGenerationsUsed = freeGenerationsUsed;
    req.freeGenerationsRemaining = Math.max(0, FREE_GENERATIONS_LIMIT - freeGenerationsUsed);
    req.monthlyCredits = monthlyCredits;
    req.creditsUsed = creditsUsed;
    req.creditsRemaining = creditsRemaining;
    req.creditsResetDate = creditsResetDate;

    next();
  } catch (error: any) {
    console.error('[checkSubscription] ❌ ERROR - Exception caught', {
      userId,
      error: error?.message,
      stack: error?.stack,
      name: error?.name,
      duration: `${Date.now() - startTime}ms`,
    });
    res.status(500).json({ 
      error: 'Failed to check subscription status',
      details: process.env.NODE_ENV === 'development' ? error?.message : undefined,
    });
  }
};

