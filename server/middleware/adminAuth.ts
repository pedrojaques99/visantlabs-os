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
        const userDoc = await db.collection('users').findOne(
          { _id: userIdObjectId },
          { projection: { isAdmin: 1 } }
        );
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
