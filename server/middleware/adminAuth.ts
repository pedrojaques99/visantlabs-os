import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../db/prisma.js';
import { connectToMongoDB, getDb } from '../db/mongodb.js';
import { AuthRequest } from './auth.js';
import { ObjectId } from 'mongodb';
import { JWT_SECRET } from '@/utils/jwtSecret.js';

/**
 * Middleware to validate admin access
 * Requires:
 * 1. Valid JWT token (user must be authenticated)
 * 2. User must have isAdmin = true in database
 * 
 * This middleware uses MongoDB driver directly to check isAdmin field,
 * ensuring it works even before Prisma client is regenerated after schema changes.
 */
export const validateAdmin = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    // First, verify authentication
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; email: string };

    // Get user from database using Prisma (for basic user info)
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
    });

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Check if user is admin using MongoDB driver directly
    // This ensures it works even if Prisma client hasn't been regenerated yet
    let isAdmin = false;
    try {
      await connectToMongoDB();
      const db = getDb();

      // Convert user ID to ObjectId and query MongoDB directly
      const userIdObjectId = new ObjectId(user.id);
      const userDoc = await db.collection('users').findOne(
        { _id: userIdObjectId },
        { projection: { isAdmin: 1 } }
      );

      // Check isAdmin field - default to false if undefined, null, or false
      isAdmin = userDoc?.isAdmin === true;
    } catch (mongoError) {
      console.error('Error checking admin status from MongoDB:', mongoError);
      // Fallback: try to get from Prisma user object (if field exists and Prisma client was regenerated)
      const userWithAdmin = user as typeof user & { isAdmin?: boolean };
      isAdmin = userWithAdmin.isAdmin === true;
    }

    if (!isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    // Set user info in request
    req.userId = user.id;
    req.userEmail = user.email;
    next();
  } catch (error: any) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    console.error('Admin validation error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
