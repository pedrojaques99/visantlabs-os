import express from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { prisma } from '../db/prisma.js';
import { getUserStorageLimit, syncUserStorage, calculateUserStorage } from '../../services/r2Service.js';

const router = express.Router();

/**
 * Format bytes to human readable format
 */
function formatBytes(bytes: number): { value: number; unit: string; formatted: string } {
  if (bytes === 0) {
    return { value: 0, unit: 'B', formatted: '0 B' };
  }
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
  const value = parseFloat((bytes / Math.pow(k, i)).toFixed(2));
  
  return {
    value,
    unit: sizes[i],
    formatted: `${value} ${sizes[i]}`,
  };
}

/**
 * Get storage usage for the authenticated user
 * GET /api/storage/usage?sync=true (optional: sync with R2 before returning)
 */
router.get('/usage', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.userId!;
    const shouldSync = req.query.sync === 'true';
    
    // Get user information to determine tier and storage
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        subscriptionTier: true,
        isAdmin: true,
        storageLimitBytes: true,
        storageUsedBytes: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const subscriptionTier = user.subscriptionTier || 'free';
    const isAdmin = user.isAdmin || false;
    const customLimitBytes = user.storageLimitBytes;

    let used = user.storageUsedBytes || 0;
    
    // If sync is requested, calculate actual storage from R2 and update counter
    if (shouldSync) {
      try {
        used = await syncUserStorage(userId);
      } catch (syncError: any) {
        console.error('Failed to sync storage from R2, using database counter:', syncError);
        // Continue with database counter if sync fails
      }
    } else {
      // Auto-sync if counter is 0 but user might have files (heuristic check)
      // This helps catch cases where counter wasn't updated properly
      if (used === 0) {
        try {
          // Quick check: try to calculate actual storage (this is expensive, but only if counter is 0)
          const actualStorage = await calculateUserStorage(userId);
          if (actualStorage > 0) {
            // Counter is wrong, sync it
            used = await syncUserStorage(userId);
            console.log(`[Storage Auto-Sync] Fixed storage counter for user ${userId}: ${used} bytes`);
          }
        } catch (autoSyncError: any) {
          // If auto-sync fails, just use the counter (0)
          console.warn('Auto-sync failed, using database counter:', autoSyncError.message);
        }
      }
    }
    
    // Get storage limit (respects custom limit if set)
    const limit = getUserStorageLimit(subscriptionTier, isAdmin, customLimitBytes);
    
    // Calculate remaining
    const remaining = Math.max(0, limit - used);
    const percentage = limit > 0 ? (used / limit) * 100 : 0;

    // Format values
    const usedFormatted = formatBytes(used);
    const limitFormatted = formatBytes(limit);
    const remainingFormatted = formatBytes(remaining);

    res.json({
      used,
      limit,
      remaining,
      percentage: parseFloat(percentage.toFixed(2)),
      formatted: {
        used: usedFormatted.formatted,
        limit: limitFormatted.formatted,
        remaining: remainingFormatted.formatted,
      },
      tier: subscriptionTier,
      isAdmin,
      synced: shouldSync || (used > 0 && user.storageUsedBytes === 0), // Indicate if sync was performed
    });
  } catch (error: any) {
    console.error('Failed to get storage usage:', error);
    next(error);
  }
});

/**
 * Sync storage counter with actual R2 usage
 * POST /api/storage/sync
 * This endpoint calculates the actual storage used in R2 and updates the database counter
 */
router.post('/sync', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.userId!;
    
    // Calculate actual storage from R2 and update counter
    const actualStorage = await syncUserStorage(userId);
    
    // Get user information for limit calculation
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        subscriptionTier: true,
        isAdmin: true,
        storageLimitBytes: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const subscriptionTier = user.subscriptionTier || 'free';
    const isAdmin = user.isAdmin || false;
    const customLimitBytes = user.storageLimitBytes;
    const limit = getUserStorageLimit(subscriptionTier, isAdmin, customLimitBytes);
    const remaining = Math.max(0, limit - actualStorage);
    const percentage = limit > 0 ? (actualStorage / limit) * 100 : 0;

    // Format values
    const usedFormatted = formatBytes(actualStorage);
    const limitFormatted = formatBytes(limit);
    const remainingFormatted = formatBytes(remaining);

    res.json({
      success: true,
      used: actualStorage,
      limit,
      remaining,
      percentage: parseFloat(percentage.toFixed(2)),
      formatted: {
        used: usedFormatted.formatted,
        limit: limitFormatted.formatted,
        remaining: remainingFormatted.formatted,
      },
      tier: subscriptionTier,
      isAdmin,
      message: 'Storage counter synchronized with R2',
    });
  } catch (error: any) {
    console.error('Failed to sync storage:', error);
    next(error);
  }
});

export default router;

