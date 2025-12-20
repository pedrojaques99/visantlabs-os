import { Response, NextFunction } from 'express';
import { connectToMongoDB, getDb } from '../db/mongodb.js';
import { AuthRequest } from './auth.js';
import { ObjectId } from 'mongodb';

/**
 * Middleware to validate that user is admin, premium, or tester
 * Requires:
 * 1. User must be authenticated (via authenticate middleware)
 * 2. User must have isAdmin = true OR subscriptionStatus = 'active' OR userCategory = 'tester'
 */
export const validateAdminOrPremium = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    await connectToMongoDB();
    const db = getDb();

    const userIdObjectId = new ObjectId(req.userId);
    const userDoc = await db.collection('users').findOne(
      { _id: userIdObjectId },
      { projection: { isAdmin: 1, subscriptionStatus: 1, userCategory: 1 } }
    );

    let isAdmin = false;
    let hasActiveSubscription = false;
    let isTester = false;

    if (userDoc) {
      isAdmin = userDoc.isAdmin === true;
      hasActiveSubscription = userDoc.subscriptionStatus === 'active';
      isTester = userDoc.userCategory === 'tester';
    }

    // Fallback to Prisma user when Mongo document is missing or doesn't have flags yet.
    if (!userDoc || (!isAdmin && !hasActiveSubscription && !isTester)) {
      const { prisma } = await import('../db/prisma.js');
      const prismaUser = await prisma.user.findUnique({
        where: { id: req.userId },
      });

      if (!prismaUser && !userDoc) {
        return res.status(404).json({ error: 'User not found' });
      }

      const withFlags = prismaUser as typeof prismaUser & {
        isAdmin?: boolean;
        subscriptionStatus?: string;
        userCategory?: string;
      };

      if (!isAdmin && withFlags?.isAdmin === true) {
        isAdmin = true;
      }
      if (!hasActiveSubscription && withFlags?.subscriptionStatus === 'active') {
        hasActiveSubscription = true;
      }
      if (!isTester && withFlags?.userCategory === 'tester') {
        isTester = true;
      }
    }

    if (!isAdmin && !hasActiveSubscription && !isTester) {
      return res.status(403).json({ 
        error: 'Access required',
        message: 'This feature is only available for admin users, users with an active premium subscription, or testers'
      });
    }

    next();
  } catch (error: any) {
    console.error('Admin/Premium validation error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Middleware to validate project access permissions
 * Checks if user can edit or view the project based on permissions
 * Requires projectId in req.params
 */
export const validateProjectAccess = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
  requiredPermission: 'edit' | 'view'
) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ error: 'Project ID is required' });
    }

    const { prisma } = await import('../db/prisma.js');
    const project = await prisma.canvasProject.findUnique({
      where: { id },
      select: {
        userId: true,
        isCollaborative: true,
        canEdit: true,
        canView: true,
      },
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Owner always has full access
    if (project.userId === req.userId) {
      return next();
    }

    // If not collaborative, only owner can access
    if (!project.isCollaborative) {
      return res.status(403).json({ error: 'Project is not shared' });
    }

    // Check permissions
    const canEdit = Array.isArray(project.canEdit) && project.canEdit.includes(req.userId);
    const canView = Array.isArray(project.canView) && project.canView.includes(req.userId);

    if (requiredPermission === 'edit' && !canEdit) {
      return res.status(403).json({ 
        error: 'Edit permission required',
        message: 'You do not have permission to edit this project'
      });
    }

    if (requiredPermission === 'view' && !canView && !canEdit) {
      return res.status(403).json({ 
        error: 'View permission required',
        message: 'You do not have permission to view this project'
      });
    }

    next();
  } catch (error: any) {
    console.error('Project access validation error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Helper function to create middleware with specific permission
 */
export const requireEditAccess = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => validateProjectAccess(req, res, next, 'edit');

export const requireViewAccess = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => validateProjectAccess(req, res, next, 'view');
