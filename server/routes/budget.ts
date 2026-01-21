import express from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { prisma, verifyPrismaConnectionWithDetails } from '../db/prisma.js';
import { uploadBrandLogo, uploadBudgetPdf, uploadCustomPdfPreset, uploadGiftImage } from '../../src/services/r2Service.js';
import crypto from 'crypto';
import { apiRateLimiter, uploadImageRateLimiter } from '../middleware/rateLimit.js';

const router = express.Router();

// Generate unique share ID
const generateShareId = (): string => {
  return crypto.randomBytes(16).toString('hex');
};

// Helper function to check if a string is base64 PDF data
const isBase64Pdf = (str: string): boolean => {
  if (!str || typeof str !== 'string') return false;
  // Check if it starts with data URL prefix
  if (str.startsWith('data:application/pdf;base64,')) return true;
  // Check if it's a very long string (likely base64) and not a URL
  if (str.length > 1000 && !str.startsWith('http://') && !str.startsWith('https://')) {
    return true;
  }
  return false;
};

// Create new budget
router.post('/', apiRateLimiter, authenticate, async (req: AuthRequest, res) => {
  try {
    const { template, name, clientName, projectName, projectDescription, startDate, endDate, deliverables, observations, links, faq, brandColors, brandName, brandLogo, brandBackgroundColor, brandAccentColor, timeline, paymentInfo, signatures, giftOptions, customContent, finalCTAText, year, data, customPdfUrl } = req.body;

    if (!template) {
      return res.status(400).json({ error: 'Template is required' });
    }

    // Skip required fields validation for custom templates
    if (template !== 'custom') {
      if (!clientName || !projectName || !projectDescription || !startDate || !endDate || !deliverables || !links || !faq || !brandColors || !brandName) {
        return res.status(400).json({ error: 'Missing required fields' });
      }
    }

    if (!req.userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Always validate dates if they are provided
    if (startDate && endDate && new Date(endDate) < new Date(startDate)) {
      return res.status(400).json({ error: 'End date must be after start date' });
    }

    const shareId = generateShareId();

    // Migrate customPdfUrl from base64 to R2 if needed
    let finalCustomPdfUrl = customPdfUrl;
    const budgetData = data || {};
    const pdfUrlFromData = budgetData.customPdfUrl || customPdfUrl;

    if (pdfUrlFromData && isBase64Pdf(pdfUrlFromData)) {
      try {
        finalCustomPdfUrl = await uploadBudgetPdf(pdfUrlFromData, req.userId);
        budgetData.customPdfUrl = finalCustomPdfUrl;
      } catch (error: any) {
        console.error('Error migrating PDF to R2:', error);
        // Continue with base64 if upload fails
      }
    }

    const budget = await prisma.budgetProject.create({
      data: {
        userId: req.userId,
        template,
        name: name || projectName || null,
        clientName,
        projectDescription,
        startDate,
        endDate,
        deliverables: deliverables as any,
        observations: observations || null,
        links: links as any,
        faq: faq as any,
        brandColors,
        brandName,
        brandLogo: brandLogo || null,
        brandBackgroundColor: brandBackgroundColor || null,
        brandAccentColor: brandAccentColor || null,
        timeline: timeline ? (timeline as any) : null,
        paymentInfo: paymentInfo ? (paymentInfo as any) : null,
        signatures: signatures ? (signatures as any) : null,
        giftOptions: giftOptions ? (giftOptions as any) : null,
        customContent: customContent ? (customContent as any) : null,
        finalCTAText: finalCTAText || null,
        year: year || null,
        shareId,
        data: budgetData,
      },
    });

    res.json({
      budget: {
        ...budget,
        _id: budget.id,
      },
    });
  } catch (error: any) {
    console.error('Error creating budget:', error);
    res.status(500).json({
      error: 'Failed to create budget',
      message: error.message || 'An error occurred',
    });
  }
});

// Get all budgets for user
router.get('/', apiRateLimiter, authenticate, async (req: AuthRequest, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Ensure Prisma is connected
    await prisma.$connect();

    const budgets = await prisma.budgetProject.findMany({
      where: {
        userId: req.userId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    res.json({
      budgets: budgets.map(budget => ({
        ...budget,
        _id: budget.id,
      })),
    });
  } catch (error: any) {
    // Check Prisma connection if error might be connection-related
    const isConnectionError = error.code === 'P1001' ||
      error.message?.includes('connect') ||
      error.message?.includes('connection');

    let connectionStatus = null;
    if (isConnectionError) {
      connectionStatus = await verifyPrismaConnectionWithDetails();
    }

    // Enhanced error logging
    console.error('Error fetching budgets:', {
      error: error.message || error,
      stack: error.stack,
      name: error.name,
      code: error.code,
      userId: req.userId,
      prismaError: error.meta || error.cause,
      connectionStatus,
      timestamp: new Date().toISOString(),
    });

    const isDevelopment = process.env.NODE_ENV === 'development';
    const errorMessage = isDevelopment
      ? error.message || 'An error occurred'
      : 'Failed to fetch budgets';

    res.status(500).json({
      error: 'Failed to fetch budgets',
      message: errorMessage,
      ...(isDevelopment && {
        details: {
          name: error.name,
          code: error.code,
          meta: error.meta,
          connectionIssue: isConnectionError ? connectionStatus : undefined,
        }
      })
    });
  }
});

// Get shared budget (no auth required) - must be before /:id route
router.get('/shared/:shareId', apiRateLimiter, async (req, res) => {
  try {
    const { shareId } = req.params;

    const budget = await prisma.budgetProject.findFirst({
      where: {
        shareId,
      },
    });

    if (!budget) {
      return res.status(404).json({ error: 'Budget not found' });
    }

    res.json({
      budget: {
        ...budget,
        _id: budget.id,
      },
    });
  } catch (error: any) {
    console.error('Error fetching shared budget:', error);
    res.status(500).json({
      error: 'Failed to fetch shared budget',
      message: error.message || 'An error occurred',
    });
  }
});

// Get all PDF presets for user - must be before /:id route
router.get('/pdf-presets', authenticate, async (req: AuthRequest, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Ensure Prisma is connected
    await prisma.$connect();

    const presets = await prisma.customPdfPreset.findMany({
      where: {
        userId: req.userId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    res.json({
      presets: presets.map(preset => ({
        ...preset,
        _id: preset.id,
      })),
    });
  } catch (error: any) {
    // Check Prisma connection if error might be connection-related
    const isConnectionError = error.code === 'P1001' ||
      error.message?.includes('connect') ||
      error.message?.includes('connection');

    let connectionStatus = null;
    if (isConnectionError) {
      connectionStatus = await verifyPrismaConnectionWithDetails();
    }

    // Enhanced error logging with full details
    console.error('Error fetching PDF presets:', {
      error: error.message || error,
      stack: error.stack,
      name: error.name,
      code: error.code,
      userId: req.userId,
      prismaError: error.meta || error.cause,
      connectionStatus,
      timestamp: new Date().toISOString(),
    });

    // Return detailed error in development, sanitized in production
    const isDevelopment = process.env.NODE_ENV === 'development';
    const errorMessage = isDevelopment
      ? error.message || 'An error occurred'
      : 'Failed to fetch PDF presets';

    res.status(500).json({
      error: 'Failed to fetch PDF presets',
      message: errorMessage,
      ...(isDevelopment && {
        details: {
          name: error.name,
          code: error.code,
          meta: error.meta,
          connectionIssue: isConnectionError ? connectionStatus : undefined,
        }
      })
    });
  }
});

// Create PDF preset - must be before /:id route
router.post('/pdf-presets', apiRateLimiter, authenticate, async (req: AuthRequest, res) => {
  try {
    const { pdfBase64, name } = req.body;

    if (!req.userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    if (!pdfBase64) {
      return res.status(400).json({ error: 'Missing pdfBase64' });
    }

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Missing preset name' });
    }

    // Upload to R2
    const pdfUrl = await uploadCustomPdfPreset(pdfBase64, req.userId);

    // Create preset in database
    const preset = await prisma.customPdfPreset.create({
      data: {
        userId: req.userId,
        name: name.trim(),
        pdfUrl,
      },
    });

    res.json({
      preset: {
        ...preset,
        _id: preset.id,
      },
    });
  } catch (error: any) {
    console.error('Error creating PDF preset:', error);
    res.status(500).json({
      error: 'Failed to create PDF preset',
      message: error.message || 'An error occurred',
    });
  }
});

// Delete PDF preset - must be before /:id route
router.delete('/pdf-presets/:id', apiRateLimiter, authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    if (!req.userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Verify preset exists and belongs to user
    const existingPreset = await prisma.customPdfPreset.findFirst({
      where: {
        id,
        userId: req.userId,
      },
    });

    if (!existingPreset) {
      return res.status(404).json({ error: 'Preset not found' });
    }

    // Delete preset
    await prisma.customPdfPreset.delete({
      where: { id },
    });

    res.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting PDF preset:', error);
    res.status(500).json({
      error: 'Failed to delete PDF preset',
      message: error.message || 'An error occurred',
    });
  }
});

// Get budget by ID
router.get('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    if (!req.userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const budget = await prisma.budgetProject.findFirst({
      where: {
        id,
        userId: req.userId,
      },
    });

    if (!budget) {
      return res.status(404).json({ error: 'Budget not found' });
    }

    res.json({
      budget: {
        ...budget,
        _id: budget.id,
      },
    });
  } catch (error: any) {
    console.error('Error fetching budget:', error);
    res.status(500).json({
      error: 'Failed to fetch budget',
      message: error.message || 'An error occurred',
    });
  }
});

// Update budget
router.put('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { template, name, clientName, projectName, projectDescription, startDate, endDate, deliverables, observations, links, faq, brandColors, brandName, brandLogo, brandBackgroundColor, brandAccentColor, timeline, paymentInfo, signatures, giftOptions, customContent, finalCTAText, year, data, customPdfUrl } = req.body;

    if (!req.userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Verify budget exists and belongs to user
    const existingBudget = await prisma.budgetProject.findFirst({
      where: {
        id,
        userId: req.userId,
      },
    });

    if (!existingBudget) {
      return res.status(404).json({ error: 'Budget not found' });
    }

    // Validate dates if provided
    if (startDate && endDate && new Date(endDate) < new Date(startDate)) {
      return res.status(400).json({ error: 'End date must be after start date' });
    }

    // Migrate customPdfUrl from base64 to R2 if needed
    const budgetData = data || (existingBudget.data as any || {});
    const pdfUrlFromData = budgetData.customPdfUrl || customPdfUrl;

    if (pdfUrlFromData && isBase64Pdf(pdfUrlFromData)) {
      try {
        const migratedUrl = await uploadBudgetPdf(pdfUrlFromData, req.userId, id);
        budgetData.customPdfUrl = migratedUrl;
        if (data) {
          data.customPdfUrl = migratedUrl;
        }
      } catch (error: any) {
        console.error('Error migrating PDF to R2:', error);
        // Continue with base64 if upload fails
      }
    }

    const updateData: any = {
      updatedAt: new Date(),
    };

    if (template !== undefined) updateData.template = template;
    if (name !== undefined) updateData.name = name;
    if (clientName !== undefined) updateData.clientName = clientName;
    if (projectDescription !== undefined) updateData.projectDescription = projectDescription;
    if (startDate !== undefined) updateData.startDate = startDate;
    if (endDate !== undefined) updateData.endDate = endDate;
    if (deliverables !== undefined) updateData.deliverables = deliverables;
    if (observations !== undefined) updateData.observations = observations;
    if (links !== undefined) updateData.links = links;
    if (faq !== undefined) updateData.faq = faq;
    if (brandColors !== undefined) updateData.brandColors = brandColors;
    if (brandName !== undefined) updateData.brandName = brandName;
    if (brandLogo !== undefined) updateData.brandLogo = brandLogo;
    if (brandBackgroundColor !== undefined) updateData.brandBackgroundColor = brandBackgroundColor;
    if (brandAccentColor !== undefined) updateData.brandAccentColor = brandAccentColor;
    if (timeline !== undefined) updateData.timeline = timeline;
    if (paymentInfo !== undefined) updateData.paymentInfo = paymentInfo;
    if (signatures !== undefined) updateData.signatures = signatures;
    if (giftOptions !== undefined) updateData.giftOptions = giftOptions;
    if (customContent !== undefined) updateData.customContent = customContent;
    if (finalCTAText !== undefined) updateData.finalCTAText = finalCTAText;
    if (year !== undefined) updateData.year = year;
    if (data !== undefined) updateData.data = budgetData;

    const budget = await prisma.budgetProject.update({
      where: { id },
      data: updateData,
    });

    res.json({
      budget: {
        ...budget,
        _id: budget.id,
      },
    });
  } catch (error: any) {
    console.error('Error updating budget:', error);
    res.status(500).json({
      error: 'Failed to update budget',
      message: error.message || 'An error occurred',
    });
  }
});

// Delete budget
router.delete('/:id', apiRateLimiter, authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    if (!req.userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Verify budget exists and belongs to user
    const existingBudget = await prisma.budgetProject.findFirst({
      where: {
        id,
        userId: req.userId,
      },
    });

    if (!existingBudget) {
      return res.status(404).json({ error: 'Budget not found' });
    }

    await prisma.budgetProject.delete({
      where: { id },
    });

    res.json({ success: true, message: 'Budget deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting budget:', error);
    res.status(500).json({
      error: 'Failed to delete budget',
      message: error.message || 'An error occurred',
    });
  }
});

// Generate share link (creates/updates shareId if needed)
router.post('/:id/share', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    if (!req.userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const budget = await prisma.budgetProject.findFirst({
      where: {
        id,
        userId: req.userId,
      },
    });

    if (!budget) {
      return res.status(404).json({ error: 'Budget not found' });
    }

    // Generate new shareId if doesn't exist
    let shareId = budget.shareId;
    if (!shareId) {
      shareId = generateShareId();
      await prisma.budgetProject.update({
        where: { id },
        data: { shareId },
      });
    }

    res.json({
      shareId,
      shareUrl: `/budget/shared/${shareId}`,
    });
  } catch (error: any) {
    console.error('Error generating share link:', error);
    res.status(500).json({
      error: 'Failed to generate share link',
      message: error.message || 'An error occurred',
    });
  }
});

// Duplicate budget
router.post('/:id/duplicate', apiRateLimiter, authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    if (!req.userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Get existing budget
    const existingBudget = await prisma.budgetProject.findFirst({
      where: {
        id,
        userId: req.userId,
      },
    });

    if (!existingBudget) {
      return res.status(404).json({ error: 'Budget not found' });
    }

    // Create new budget with copied data
    // Set shareId to null for the duplicate
    const newName = existingBudget.name
      ? `Copy of ${existingBudget.name}`
      : `Copy of Budget`;

    const duplicatedBudget = await prisma.budgetProject.create({
      data: {
        userId: req.userId,
        template: existingBudget.template,
        name: newName,
        clientName: existingBudget.clientName,
        projectDescription: existingBudget.projectDescription,
        startDate: existingBudget.startDate,
        endDate: existingBudget.endDate,
        deliverables: existingBudget.deliverables as any,
        observations: existingBudget.observations,
        links: existingBudget.links as any,
        faq: existingBudget.faq as any,
        brandColors: existingBudget.brandColors as any,
        brandName: existingBudget.brandName,
        brandLogo: existingBudget.brandLogo,
        brandBackgroundColor: existingBudget.brandBackgroundColor,
        brandAccentColor: existingBudget.brandAccentColor,
        timeline: existingBudget.timeline as any,
        paymentInfo: existingBudget.paymentInfo as any,
        signatures: existingBudget.signatures as any,
        giftOptions: existingBudget.giftOptions as any,
        customContent: existingBudget.customContent as any,
        finalCTAText: existingBudget.finalCTAText,
        year: existingBudget.year,
        shareId: null, // New shareId will be generated when shared
        data: (existingBudget.data ?? {}) as any,
      },
    });

    res.json({
      budget: {
        ...duplicatedBudget,
        _id: duplicatedBudget.id,
      },
    });
  } catch (error: any) {
    console.error('Error duplicating budget:', error);
    res.status(500).json({
      error: 'Failed to duplicate budget',
      message: error.message || 'An error occurred',
    });
  }
});

// Upload brand logo
router.post('/:id/logo', uploadImageRateLimiter, authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { imageBase64 } = req.body;

    if (!req.userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    if (!imageBase64) {
      return res.status(400).json({ error: 'Missing imageBase64' });
    }

    // Verify budget exists and belongs to user
    const existingBudget = await prisma.budgetProject.findFirst({
      where: {
        id,
        userId: req.userId,
      },
    });

    if (!existingBudget) {
      return res.status(404).json({ error: 'Budget not found' });
    }

    // Upload to R2
    const imageUrl = await uploadBrandLogo(imageBase64, req.userId, id);

    // Update budget with new logo URL
    const budget = await prisma.budgetProject.update({
      where: { id },
      data: {
        brandLogo: imageUrl,
        updatedAt: new Date(),
      },
    });

    res.json({
      budget: {
        ...budget,
        _id: budget.id,
      },
      imageUrl,
    });
  } catch (error: any) {
    console.error('Error uploading brand logo:', error);
    res.status(500).json({
      error: 'Failed to upload brand logo',
      message: error.message || 'An error occurred',
    });
  }
});

// Upload gift image
router.post('/:id/gift-image', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { imageBase64, giftIndex } = req.body;

    if (!req.userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    if (!imageBase64) {
      return res.status(400).json({ error: 'Missing imageBase64' });
    }

    // Verify budget exists and belongs to user
    const existingBudget = await prisma.budgetProject.findFirst({
      where: {
        id,
        userId: req.userId,
      },
    });

    if (!existingBudget) {
      return res.status(404).json({ error: 'Budget not found' });
    }

    // Upload to R2
    const imageUrl = await uploadGiftImage(imageBase64, req.userId, id, giftIndex);

    res.json({
      imageUrl,
    });
  } catch (error: any) {
    console.error('Error uploading gift image:', error);
    res.status(500).json({
      error: 'Failed to upload gift image',
      message: error.message || 'An error occurred',
    });
  }
});

// Upload custom PDF
router.post('/:id/pdf', uploadImageRateLimiter, authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { pdfBase64 } = req.body;

    if (!req.userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    if (!pdfBase64) {
      return res.status(400).json({ error: 'Missing pdfBase64' });
    }

    // Verify budget exists and belongs to user
    const existingBudget = await prisma.budgetProject.findFirst({
      where: {
        id,
        userId: req.userId,
      },
    });

    if (!existingBudget) {
      return res.status(404).json({ error: 'Budget not found' });
    }

    // Upload to R2
    const pdfUrl = await uploadBudgetPdf(pdfBase64, req.userId, id);

    // Update budget with new PDF URL
    const budget = await prisma.budgetProject.update({
      where: { id },
      data: {
        data: {
          ...(existingBudget.data as any || {}),
          customPdfUrl: pdfUrl,
        },
        updatedAt: new Date(),
      },
    });

    res.json({
      budget: {
        ...budget,
        _id: budget.id,
      },
      pdfUrl,
    });
  } catch (error: any) {
    console.error('Error uploading PDF:', error);
    res.status(500).json({
      error: 'Failed to upload PDF',
      message: error.message || 'An error occurred',
    });
  }
});

export default router;

