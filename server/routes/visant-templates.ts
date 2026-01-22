import express from 'express';
import { prisma } from '../db/prisma.js';
import { rateLimit } from 'express-rate-limit';

// API rate limiter - general authenticated endpoints
// Using express-rate-limit for CodeQL recognition
const apiRateLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_API_WINDOW_MS || '60000', 10),
  max: parseInt(process.env.RATE_LIMIT_MAX_API || '60', 10),
  message: { error: 'Too many requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});
import { ensureOptionalBoolean, ensureString, isValidObjectId } from '../utils/validation.js';

const router = express.Router();

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Vsn567349';

const validateAdminPassword = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  // Security: Prefer header-based authentication over query params
  // Query params are logged in server logs, browser history, and referrer headers
  const headerPassword = req.header('x-admin-password');
  const queryPassword = typeof req.query.password === 'string' ? req.query.password : undefined;
  
  // Use header password first (preferred), then fall back to query (deprecated)
  const providedPassword = headerPassword || queryPassword;
  
  // Log deprecation warning if query param is used
  if (!headerPassword && queryPassword) {
    console.warn('[SECURITY] Password provided via query param is deprecated. Use x-admin-password header instead.');
  }

  if (!providedPassword || providedPassword !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  next();
};

// GET /api/admin/visant-templates - Listar todos os templates
router.get('/', apiRateLimiter, validateAdminPassword, async (_req, res) => {
  try {
    const templates = await prisma.visantTemplate.findMany({
      orderBy: [
        { isDefault: 'desc' },
        { isActive: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    res.json({
      templates: templates.map(t => ({
        ...t,
        _id: t.id,
      })),
    });
  } catch (error: any) {
    console.error('Error fetching visant templates:', error);
    res.status(500).json({
      error: 'Failed to fetch templates',
      message: error.message || 'An error occurred',
    });
  }
});

// GET /api/visant-templates/active - Obter template ativo (público)
router.get('/active', apiRateLimiter, async (_req, res) => {
  try {
    const activeTemplate = await prisma.visantTemplate.findFirst({
      where: { isActive: true },
    });

    if (!activeTemplate) {
      return res.status(404).json({ error: 'No active template found' });
    }

    res.json({
      template: {
        ...activeTemplate,
        _id: activeTemplate.id,
      },
    });
  } catch (error: any) {
    console.error('Error fetching active template:', error);
    res.status(500).json({
      error: 'Failed to fetch active template',
      message: error.message || 'An error occurred',
    });
  }
});

// POST /api/admin/visant-templates - Criar novo template
router.post('/', apiRateLimiter, validateAdminPassword, async (req, res) => {
  try {
    const { name, layout, isDefault = false } = req.body;

    const nameVal = ensureString(name, 200);
    if (!nameVal || !layout) {
      return res.status(400).json({ error: 'Name and layout are required' });
    }
    if (!layout || typeof layout !== 'object' || !layout.pages || typeof layout.pages !== 'object') {
      return res.status(400).json({ error: 'Invalid layout structure' });
    }

    // If this is set as default, unset other defaults
    if (isDefault) {
      await prisma.visantTemplate.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      });
    }

    const template = await prisma.visantTemplate.create({
      data: {
        name: nameVal,
        layout: layout as any,
        isDefault: ensureOptionalBoolean(isDefault) ?? false,
        isActive: false,
      },
    });

    res.json({
      template: {
        ...template,
        _id: template.id,
      },
    });
  } catch (error: any) {
    console.error('Error creating visant template:', error);
    res.status(500).json({
      error: 'Failed to create template',
      message: error.message || 'An error occurred',
    });
  }
});

// PUT /api/admin/visant-templates/:id - Atualizar template
router.put('/:id', apiRateLimiter, validateAdminPassword, async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ error: 'Invalid template ID format' });
    }
    const { name, layout, isDefault } = req.body;

    const existingTemplate = await prisma.visantTemplate.findUnique({
      where: { id },
    });

    if (!existingTemplate) {
      return res.status(404).json({ error: 'Template not found' });
    }

    // Prevent editing default template's isDefault flag
    if (existingTemplate.isDefault && isDefault === false) {
      return res.status(400).json({ error: 'Cannot unset default template' });
    }

    // If setting as default, unset other defaults
    if (isDefault && !existingTemplate.isDefault) {
      await prisma.visantTemplate.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      });
    }

    const updateData: any = {
      updatedAt: new Date(),
    };

    const n = name !== undefined ? ensureString(name, 200) : null;
    if (n != null) updateData.name = n;
    if (layout !== undefined) {
      if (!layout || typeof layout !== 'object' || !layout.pages || typeof layout.pages !== 'object') {
        return res.status(400).json({ error: 'Invalid layout structure' });
      }
      updateData.layout = layout;
    }
    const idDefault = ensureOptionalBoolean(isDefault);
    if (idDefault !== undefined) updateData.isDefault = idDefault;

    const template = await prisma.visantTemplate.update({
      where: { id },
      data: updateData,
    });

    res.json({
      template: {
        ...template,
        _id: template.id,
      },
    });
  } catch (error: any) {
    console.error('Error updating visant template:', error);
    res.status(500).json({
      error: 'Failed to update template',
      message: error.message || 'An error occurred',
    });
  }
});

// DELETE /api/admin/visant-templates/:id - Deletar template
router.delete('/:id', validateAdminPassword, async (req, res) => {
  try {
    const { id } = req.params;

    const existingTemplate = await prisma.visantTemplate.findUnique({
      where: { id },
    });

    if (!existingTemplate) {
      return res.status(404).json({ error: 'Template not found' });
    }

    // Prevent deleting default template
    if (existingTemplate.isDefault) {
      return res.status(400).json({ error: 'Cannot delete default template' });
    }

    // If deleting active template, deactivate it first
    if (existingTemplate.isActive) {
      await prisma.visantTemplate.updateMany({
        where: { isActive: true },
        data: { isActive: false },
      });
    }

    await prisma.visantTemplate.delete({
      where: { id },
    });

    res.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting visant template:', error);
    res.status(500).json({
      error: 'Failed to delete template',
      message: error.message || 'An error occurred',
    });
  }
});

// POST /api/admin/visant-templates/:id/activate - Ativar template
router.post('/:id/activate', apiRateLimiter, validateAdminPassword, async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ error: 'Invalid template ID format' });
    }

    const template = await prisma.visantTemplate.findUnique({
      where: { id },
    });

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    // Deactivate all other templates
    await prisma.visantTemplate.updateMany({
      where: { isActive: true },
      data: { isActive: false },
    });

    // Activate this template
    const activatedTemplate = await prisma.visantTemplate.update({
      where: { id },
      data: { isActive: true },
    });

    res.json({
      template: {
        ...activatedTemplate,
        _id: activatedTemplate.id,
      },
    });
  } catch (error: any) {
    console.error('Error activating visant template:', error);
    res.status(500).json({
      error: 'Failed to activate template',
      message: error.message || 'An error occurred',
    });
  }
});

export default router;

































