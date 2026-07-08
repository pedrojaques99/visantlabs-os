import { Response, NextFunction } from 'express';
import { connectToMongoDB, getDb } from '../db/mongodb.js';
import { authenticate, AuthRequest } from './auth.js';
import { ObjectId } from 'mongodb';

/**
 * Middleware to validate admin access.
 * Composes over `authenticate` — first authenticates the user via JWT,
 * then checks if user has isAdmin = true in the database.
 *
 * Uses MongoDB driver directly to check isAdmin field,
 * ensuring it works even before Prisma client is regenerated after schema changes.
 */
export const validateAdmin = [
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // Check if user is admin using MongoDB driver directly
      let isAdmin = false;
      try {
        await connectToMongoDB();
        const db = getDb();
        const userIdObjectId = new ObjectId(userId);
        const userDoc = await db
          .collection('users')
          .findOne({ _id: userIdObjectId }, { projection: { isAdmin: 1 } });
        isAdmin = userDoc?.isAdmin === true;
      } catch (mongoError) {
        console.error('Error checking admin status from MongoDB:', mongoError);
        // Fallback: try to get from Prisma
        const { prisma } = await import('../db/prisma.js');
        const user = await prisma.user.findUnique({ where: { id: userId } });
        const userWithAdmin = user as typeof user & { isAdmin?: boolean };
        isAdmin = userWithAdmin?.isAdmin === true;
      }

      if (!isAdmin) {
        return res.status(403).json({ error: 'Admin access required' });
      }

      next();
    } catch (error: any) {
      console.error('Admin validation error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  },
];

/** AuthRequest enriched with the tier flags resolved by validateSubscriber. */
export interface SubscriberRequest extends AuthRequest {
  isAdmin?: boolean;
  isSubscriber?: boolean;
}

/**
 * Core check reused by validateSubscriber (HTTP) and the copilot WebSocket
 * upgrade handler (server/services/chat/chatSessionHandlers.ts): is this user
 * an active subscriber, or admin? Falls back to Prisma if the Mongo read
 * fails, same resilience pattern as validateAdmin above.
 */
export async function isActiveSubscriberOrAdmin(
  userId: string
): Promise<{ isAdmin: boolean; isSubscriber: boolean }> {
  let isAdmin = false;
  let subscriptionStatus = 'free';
  try {
    await connectToMongoDB();
    const db = getDb();
    const userDoc = await db
      .collection('users')
      .findOne(
        { _id: new ObjectId(userId) },
        { projection: { isAdmin: 1, subscriptionStatus: 1 } }
      );
    isAdmin = userDoc?.isAdmin === true;
    subscriptionStatus = userDoc?.subscriptionStatus || 'free';
  } catch (mongoError) {
    console.error('Error checking subscriber status from MongoDB:', mongoError);
    // Fallback: try to get from Prisma
    const { prisma } = await import('../db/prisma.js');
    const user = (await prisma.user.findUnique({ where: { id: userId } })) as any;
    isAdmin = user?.isAdmin === true;
    subscriptionStatus = user?.subscriptionStatus || 'free';
  }

  return { isAdmin, isSubscriber: isAdmin || subscriptionStatus === 'active' };
}

/**
 * Middleware to validate active-subscriber access (Brand Copilot tier gate).
 * Composes over `authenticate`, then allows through when the user has an
 * active subscription OR is admin. The gate lives here, in the backend —
 * the frontend only mirrors it (same pattern as validateAdmin).
 *
 * On failure returns 403 with a structured payload the frontend can turn
 * into an upsell instead of a dead 403.
 */
export const validateSubscriber = [
  authenticate,
  async (req: SubscriberRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { isAdmin, isSubscriber } = await isActiveSubscriberOrAdmin(userId);

      if (!isSubscriber) {
        return res.status(403).json({
          error: 'subscription_required',
          reason: 'subscription_required',
          upgradeUrl: '/pricing',
        });
      }

      req.isAdmin = isAdmin;
      req.isSubscriber = true;

      next();
    } catch (error: any) {
      console.error('Subscriber validation error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  },
];
