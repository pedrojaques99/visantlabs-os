import express, { Response } from 'express';
import { prisma } from '../db/prisma.js';
import { validateAdmin } from '../middleware/adminAuth.js';
import { AuthRequest } from '../middleware/auth.js';
import { uploadAppThumbnail } from '../services/r2Service.js';

const router = express.Router();

// GET /api/apps - Public endpoint to fetch all apps
router.get('/', async (_req, res: Response) => {
  try {
    const apps = await (prisma as any).appConfig.findMany({
      orderBy: { displayOrder: 'asc' },
    });
    return res.json({ apps });
  } catch (error: any) {
    console.error('Failed to fetch apps:', error);
    return res.status(500).json({ error: 'Failed to fetch apps' });
  }
});

// POST /api/apps/seed - Admin only endpoint to seed initial data
router.post('/seed', validateAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { apps } = req.body;
    if (!Array.isArray(apps)) {
      return res.status(400).json({ error: 'Apps must be an array' });
    }

    const results = [];
    for (const app of apps) {
      const result = await (prisma as any).appConfig.upsert({
        where: { appId: app.id || app.appId },
        update: {
          name: app.name,
          description: app.desc || app.description,
          link: app.link,
          thumbnail: app.thumbnail,
          badge: app.badge,
          badgeVariant: app.badgeVariant || 'free',
          category: app.category || 'design',
          isExternal: app.isExternal || false,
          free: app.free ?? true,
          span: app.span,
        },
        create: {
          appId: app.id || app.appId,
          name: app.name,
          description: app.desc || app.description,
          link: app.link,
          thumbnail: app.thumbnail,
          badge: app.badge,
          badgeVariant: app.badgeVariant || 'free',
          category: app.category || 'design',
          isExternal: app.isExternal || false,
          free: app.free ?? true,
          span: app.span,
        },
      });
      results.push(result);
    }

    return res.json({ message: 'Seeding completed', count: results.length });
  } catch (error: any) {
    console.error('Failed to seed apps:', error);
    return res.status(500).json({ error: 'Failed to seed apps', message: error.message });
  }
});

// POST /api/apps - Admin only endpoint to create a new app
router.post('/', validateAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const appData = req.body;
    
    // Handle base64 thumbnail upload to R2
    if (appData.thumbnail && appData.thumbnail.startsWith('data:image')) {
      try {
        const r2Url = await uploadAppThumbnail(
          appData.thumbnail, 
          req.userId || 'admin', 
          appData.appId,
          undefined,
          true
        );
        appData.thumbnail = r2Url;
      } catch (err) {
        console.error('Failed to upload thumbnail to R2 during creation:', err);
      }
    }

    const newApp = await (prisma as any).appConfig.create({
      data: {
        appId: appData.appId,
        name: appData.name,
        description: appData.description,
        link: appData.link,
        thumbnail: appData.thumbnail,
        badge: appData.badge,
        badgeVariant: appData.badgeVariant,
        category: appData.category,
        isExternal: appData.isExternal || false,
        free: appData.free ?? true,
        span: appData.span,
        databaseInfo: appData.databaseInfo,
        displayOrder: appData.displayOrder || 0,
      },
    });
    return res.json({ app: newApp });
  } catch (error: any) {
    console.error('Failed to create app:', error);
    return res.status(500).json({ error: 'Failed to create app' });
  }
});

// PUT /api/apps/:id - Admin only endpoint to update an app
router.put('/:id', validateAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Handle base64 thumbnail upload to R2
    if (updates.thumbnail && updates.thumbnail.startsWith('data:image')) {
      try {
        const r2Url = await uploadAppThumbnail(
          updates.thumbnail, 
          req.userId || 'admin', 
          updates.appId || id,
          undefined,
          true
        );
        updates.thumbnail = r2Url;
      } catch (err) {
        console.error('Failed to upload thumbnail to R2 during update:', err);
      }
    }

    // Support both ObjectID and appId as ID
    const filter = id.match(/^[0-9a-fA-F]{24}$/) ? { id } : { appId: id };

    const updatedApp = await (prisma as any).appConfig.update({
      where: filter,
      data: {
        appId: updates.appId,
        name: updates.name,
        description: updates.description,
        link: updates.link,
        thumbnail: updates.thumbnail,
        badge: updates.badge,
        badgeVariant: updates.badgeVariant,
        category: updates.category,
        isExternal: updates.isExternal,
        free: updates.free,
        span: updates.span,
        databaseInfo: updates.databaseInfo,
        displayOrder: updates.displayOrder,
      },
    });

    return res.json({ app: updatedApp });
  } catch (error: any) {
    console.error('Failed to update app:', error);
    return res.status(500).json({ error: 'Failed to update app' });
  }
});

// DELETE /api/apps/:id - Admin only endpoint to delete an app
router.delete('/:id', validateAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const filter = id.match(/^[0-9a-fA-F]{24}$/) ? { id } : { appId: id };
    await (prisma as any).appConfig.delete({
      where: filter,
    });
    return res.json({ message: 'App deleted successfully' });
  } catch (error: any) {
    console.error('Failed to delete app:', error);
    return res.status(500).json({ error: 'Failed to delete app' });
  }
});

export default router;
