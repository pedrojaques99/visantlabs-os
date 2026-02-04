import express from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { getDb, connectToMongoDB } from '../db/mongodb.js';
import { ObjectId } from 'mongodb';
import { prisma, verifyPrismaConnectionWithDetails } from '../db/prisma.js';
import * as brandingService from '../services/brandingService.js';
import type { BrandingData } from '../../src/types/branding.js';
import { checkSubscription, SubscriptionRequest } from '../middleware/subscription.js';
import { incrementUserGenerations } from '../utils/usageTrackingUtils.js';
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

// Mockup generation rate limiter
// Using express-rate-limit for CodeQL recognition
const mockupRateLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_MOCKUP_WINDOW_MS || '60000', 10),
  max: parseInt(process.env.RATE_LIMIT_MAX_MOCKUP || '30', 10),
  message: { error: 'Too many mockup requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const router = express.Router();

// Helper function to atomically deduct credits BEFORE generation
// Returns { success: true, updatedUser } if credits were deducted, or throws error
// IMPORTANT: Admins skip credit deduction entirely
async function deductCreditsAtomically(userId: string, creditsToDeduct: number): Promise<{ success: true; updatedUser: any }> {
  await connectToMongoDB();
  const db = getDb();

  // Each branding step costs 1 credit
  if (creditsToDeduct !== 1) {
    throw new Error(`Invalid credits to deduct: ${creditsToDeduct}. Branding steps require exactly 1 credit.`);
  }

  // Check if user is admin - admins don't have credits deducted
  const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });
  if (!user) {
    throw new Error('User not found');
  }

  if (user.isAdmin === true) {
    // Admin users - return user without deducting credits
    return { success: true, updatedUser: user };
  }

  // STANDARDIZED: Use totalCreditsEarned FIRST, then monthlyCredits
  // This matches the order used in mockups.ts for consistency
  const monthlyCredits = user.monthlyCredits || 20;
  const creditsUsed = user.creditsUsed || 0;
  const monthlyCreditsRemaining = Math.max(0, monthlyCredits - creditsUsed);
  const totalCreditsEarned = user.totalCreditsEarned || 0;
  const totalCredits = totalCreditsEarned + monthlyCreditsRemaining;

  // Check if user has enough credits
  if (totalCredits < creditsToDeduct) {
    throw new Error(`Insufficient credits. Required: ${creditsToDeduct}, Available: ${totalCredits}`);
  }

  // First, try to deduct from totalCreditsEarned if available
  if (totalCreditsEarned >= creditsToDeduct) {
    const result = await db.collection('users').findOneAndUpdate(
      {
        _id: new ObjectId(userId),
        $expr: { $gte: ['$totalCreditsEarned', creditsToDeduct] }
      },
      [
        {
          $set: {
            totalCreditsEarned: { $subtract: ['$totalCreditsEarned', creditsToDeduct] }
            // Don't increment creditsUsed when using earned credits only
          }
        }
      ] as any[],
      { returnDocument: 'after' }
    );

    if (result) {
      return { success: true, updatedUser: result };
    }
  }

  // If totalCreditsEarned is not sufficient, use both earned and monthly credits
  // Calculate how much to use from each source
  const fromEarned = Math.min(totalCreditsEarned, creditsToDeduct);
  const fromMonthly = creditsToDeduct - fromEarned;

  const result2 = await db.collection('users').findOneAndUpdate(
    {
      _id: new ObjectId(userId),
      $expr: {
        $gte: [
          {
            $add: [
              { $ifNull: ['$totalCreditsEarned', 0] },
              {
                $max: [
                  0,
                  {
                    $subtract: [
                      { $ifNull: ['$monthlyCredits', 20] },
                      { $ifNull: ['$creditsUsed', 0] }
                    ]
                  }
                ]
              }
            ]
          },
          creditsToDeduct
        ]
      }
    },
    [
      {
        $set: {
          // Subtract from earned credits if needed
          totalCreditsEarned: fromEarned > 0
            ? { $max: [0, { $subtract: [{ $ifNull: ['$totalCreditsEarned', 0] }, fromEarned] }] }
            : { $ifNull: ['$totalCreditsEarned', 0] },
          // Increment creditsUsed by the amount used from monthly credits
          creditsUsed: fromMonthly > 0
            ? { $add: [{ $ifNull: ['$creditsUsed', 0] }, fromMonthly] }
            : { $ifNull: ['$creditsUsed', 0] }
        }
      }
    ] as any[],
    { returnDocument: 'after' }
  );

  if (result2?.value) {
    return { success: true, updatedUser: result2.value };
  }

  // Insufficient credits (this should never be reached due to atomic check above)
  throw new Error(`Insufficient credits. Required: ${creditsToDeduct}, Available: ${totalCredits}`);
}

// Helper function to refund credits if generation fails
async function refundCredits(userId: string, creditsToRefund: number): Promise<void> {
  await connectToMongoDB();
  const db = getDb();

  // Simple refund: add back to totalCreditsEarned and reduce creditsUsed
  // This is safe because we know these credits were just deducted
  await db.collection('users').updateOne(
    { _id: new ObjectId(userId) },
    {
      $inc: {
        totalCreditsEarned: creditsToRefund,
        creditsUsed: -creditsToRefund
      }
    }
  );
}

// Generate content for a specific step
// CRITICAL: Validate and deduct credits BEFORE generation to prevent abuse
router.post('/generate-step', mockupRateLimiter, authenticate, checkSubscription, async (req: SubscriptionRequest, res) => {
  let creditsDeducted = false;
  const creditsToDeduct = 1; // Each branding step costs 1 credit
  const { step, prompt, previousData } = req.body;

  try {

    if (!step || !prompt) {
      return res.status(400).json({ error: 'Step and prompt are required' });
    }

    // CRITICAL: Deduct credits BEFORE generation (atomic operation)
    // Note: Admins skip credit deduction
    const { updatedUser } = await deductCreditsAtomically(req.userId!, creditsToDeduct);
    const isAdmin = updatedUser.isAdmin === true;
    creditsDeducted = !isAdmin; // Only mark as deducted if not admin

    if (isAdmin) {
      console.log(`[Credit Deduction] Admin user - skipping credit deduction for branding step ${step}`, {
        userId: req.userId,
        step,
        timestamp: new Date().toISOString(),
      });
    } else {
      console.log(`[Credit Deduction] Deducted ${creditsToDeduct} credit(s) for branding step ${step} before generation`, {
        userId: req.userId,
        step,
        totalCreditsEarned: updatedUser.totalCreditsEarned,
        creditsUsed: updatedUser.creditsUsed,
        timestamp: new Date().toISOString(),
      });
    }

    // Fetch examples for RAG (Retrieval-Augmented Generation)
    let examples: any[] = [];
    try {
      // Use type assertion to work around TypeScript cache issue after Prisma regeneration
      examples = await (prisma as any).brandingExample.findMany({
        where: {
          step: parseInt(step.toString()),
          rating: 1, // Only positive examples
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 5, // Limit to 5 most recent examples
      });
    } catch (e) {
      console.error("Failed to fetch examples", e);
      // Continue without examples if fetch fails
    }

    const formattedExamples = examples.map(e =>
      `Example for "${e.prompt}":\n${JSON.stringify(e.output, null, 2)}`
    );

    // Helper function to extract result and tokens from branding service responses
    const extractResultAndTokens = (response: any): { result: any; inputTokens?: number; outputTokens?: number } => {
      if (response && typeof response === 'object' && 'result' in response) {
        return {
          result: response.result,
          inputTokens: response.inputTokens,
          outputTokens: response.outputTokens,
        };
      }
      return { result: response }; // Backward compatibility
    };

    let result: any;
    let inputTokens: number | undefined;
    let outputTokens: number | undefined;

    switch (step) {
      case 1: // Market Research - generates benchmarking as a single string
        const marketResearchResponse = extractResultAndTokens(
          await brandingService.generateMarketResearch(prompt, formattedExamples)
        );
        result = marketResearchResponse.result;
        inputTokens = marketResearchResponse.inputTokens;
        outputTokens = marketResearchResponse.outputTokens;
        break;
      case 2: // Público Alvo (deprecated - now part of step 1)
      case 3: // Posicionamento (deprecated - now part of step 1)
      case 4: // Insights (deprecated - now part of step 1)
        // These steps are deprecated. Market research is now a single benchmarking paragraph.
        // For backward compatibility, regenerate the full market research
        const deprecatedResponse = extractResultAndTokens(
          await brandingService.generateMarketResearch(prompt, formattedExamples)
        );
        result = deprecatedResponse.result;
        inputTokens = deprecatedResponse.inputTokens;
        outputTokens = deprecatedResponse.outputTokens;
        break;
      case 5: // Competitors
        if (!previousData?.marketResearch && !previousData?.mercadoNicho) {
          return res.status(400).json({ error: 'Market research is required for step 5' });
        }
        const competitorsResponse = extractResultAndTokens(
          await brandingService.generateCompetitors(prompt, previousData, formattedExamples)
        );
        result = competitorsResponse.result;
        inputTokens = competitorsResponse.inputTokens;
        outputTokens = competitorsResponse.outputTokens;
        break;
      case 6: // References
        if ((!previousData?.marketResearch && !previousData?.mercadoNicho) || !previousData?.competitors) {
          return res.status(400).json({ error: 'Market research and competitors are required for step 6' });
        }
        const referencesResponse = extractResultAndTokens(
          await brandingService.generateReferences(
            prompt,
            previousData,
            previousData.competitors
          )
        );
        result = referencesResponse.result;
        inputTokens = referencesResponse.inputTokens;
        outputTokens = referencesResponse.outputTokens;
        break;
      case 7: // SWOT
        if ((!previousData?.marketResearch && !previousData?.mercadoNicho) || !previousData?.competitors) {
          return res.status(400).json({ error: 'Market research and competitors are required for step 7' });
        }
        const swotResponse = extractResultAndTokens(
          await brandingService.generateSWOT(
            prompt,
            previousData,
            previousData.competitors
          )
        );
        result = swotResponse.result;
        inputTokens = swotResponse.inputTokens;
        outputTokens = swotResponse.outputTokens;
        break;
      case 8: // Color Palettes
        if (!previousData?.swot || !previousData?.references) {
          return res.status(400).json({ error: 'SWOT and references are required for step 5' });
        }
        const colorPalettesResponse = extractResultAndTokens(
          await brandingService.generateColorPalettes(
            prompt,
            previousData.swot,
            previousData.references
          )
        );
        result = colorPalettesResponse.result;
        inputTokens = colorPalettesResponse.inputTokens;
        outputTokens = colorPalettesResponse.outputTokens;
        break;
      case 9: // Visual Elements
        if (!previousData?.colorPalettes) {
          return res.status(400).json({ error: 'Color palettes are required for step 9' });
        }
        const visualElementsResponse = extractResultAndTokens(
          await brandingService.generateVisualElements(
            prompt,
            previousData.colorPalettes
          )
        );
        result = visualElementsResponse.result;
        inputTokens = visualElementsResponse.inputTokens;
        outputTokens = visualElementsResponse.outputTokens;
        break;
      case 10: // Persona
        if (!previousData?.marketResearch && !previousData?.mercadoNicho) {
          return res.status(400).json({ error: 'Market research is required for step 7' });
        }
        const personaResponse = extractResultAndTokens(
          await brandingService.generatePersona(
            prompt,
            previousData
          )
        );
        result = personaResponse.result;
        inputTokens = personaResponse.inputTokens;
        outputTokens = personaResponse.outputTokens;
        break;
      case 11: // Mockup Ideas
        const mockupIdeasResponse = extractResultAndTokens(
          await brandingService.generateMockupIdeas(prompt, previousData || { prompt }, formattedExamples)
        );
        result = mockupIdeasResponse.result;
        inputTokens = mockupIdeasResponse.inputTokens;
        outputTokens = mockupIdeasResponse.outputTokens;
        break;
      case 12: // Moodboard
        const moodboardResponse = extractResultAndTokens(
          await brandingService.generateMoodboard(prompt, previousData || { prompt })
        );
        result = moodboardResponse.result;
        inputTokens = moodboardResponse.inputTokens;
        outputTokens = moodboardResponse.outputTokens;
        break;
      case 13: // Archetypes
        if (!previousData?.marketResearch && !previousData?.mercadoNicho) {
          return res.status(400).json({ error: 'Market research is required for step 13' });
        }
        const archetypesResponse = extractResultAndTokens(
          await brandingService.generateArchetypes(prompt, previousData, formattedExamples)
        );
        result = archetypesResponse.result;
        inputTokens = archetypesResponse.inputTokens;
        outputTokens = archetypesResponse.outputTokens;
        break;
      default:
        return res.status(400).json({ error: 'Invalid step number' });
    }

    // Generation successful - create usage record for audit/logging
    // Credits were already deducted before generation
    // Use brandingService function to create usage record with tokens if available
    try {
      await brandingService.createBrandingUsageRecord(
        req.userId!,
        step,
        prompt.length,
        creditsToDeduct,
        updatedUser.subscriptionStatus || 'free',
        updatedUser.subscriptionStatus === 'active',
        isAdmin,
        inputTokens,
        outputTokens
      );

      // Track total tokens for user stats (regardless of credits)
      // This runs in the background
      (async () => {
        try {
          const totalTokens = (inputTokens || 0) + (outputTokens || 0);
          if (totalTokens > 0) {
            await incrementUserGenerations(req.userId!, 0, totalTokens);
          }
        } catch (err) {
          console.error('[Stats Tracking] Error incrementing total tokens for branding:', err);
        }
      })();
    } catch (usageError: any) {
      // WARNING: Failed to create usage record - this is an audit issue but generation succeeded
      console.error('[AUDIT WARNING] [Usage Tracking] Failed to create usage record after successful generation:', {
        severity: 'WARNING',
        type: 'usage_record_creation_failure',
        error: usageError.message,
        errorStack: usageError.stack,
        userId: req.userId,
        stepNumber: step,
        creditsDeducted: creditsToDeduct,
        timestamp: new Date().toISOString(),
        // Note: Credits were already deducted, but audit record is missing
      });

      // [ENHANCEMENT] Optional: Implement retry logic or queue for usage record creation
      // Contributions welcome - see CONTRIBUTING.md
    }

    // Calculate credits remaining for response
    const actualCreditsDeducted = isAdmin ? 0 : creditsToDeduct;
    const monthlyCreditsRemaining = Math.max(0, (updatedUser.monthlyCredits ?? 20) - (updatedUser.creditsUsed ?? 0));
    const totalCreditsRemaining = (updatedUser.totalCreditsEarned ?? 0) + monthlyCreditsRemaining;

    res.json({
      data: result,
      creditsDeducted: actualCreditsDeducted,
      creditsRemaining: totalCreditsRemaining,
      isAdmin,
    });
  } catch (error: any) {
    console.error('Error generating branding step:', error);

    // CRITICAL: Refund credits if generation failed and credits were deducted
    if (creditsDeducted) {
      try {
        await refundCredits(req.userId!, creditsToDeduct);
        console.log(`[Credit Refund] Refunded ${creditsToDeduct} credit(s) after failed generation`, {
          userId: req.userId,
          step,
          error: error.message,
          timestamp: new Date().toISOString(),
        });
      } catch (refundError: any) {
        // CRITICAL ALERT: Failed to refund credits - this is a critical audit issue
        // Log with high severity for monitoring/alerting systems
        console.error('[CRITICAL AUDIT] [Credit Refund] Failed to refund credits after generation failure:', {
          severity: 'CRITICAL',
          type: 'credit_refund_failure',
          error: refundError.message,
          errorStack: refundError.stack,
          userId: req.userId,
          step,
          creditsToRefund: creditsToDeduct,
          originalError: error.message,
          originalErrorStack: error.stack,
          timestamp: new Date().toISOString(),
          requiresManualIntervention: true, // Flag for monitoring systems
        });

        // [ENHANCEMENT] Optional: Integrate with monitoring/alerting system (Sentry, DataDog, etc.)
        // Contributions welcome - see CONTRIBUTING.md
      }
    }

    res.status(500).json({
      error: 'Failed to generate branding step',
      message: error.message || 'An error occurred while generating content'
    });
  }
});

// Track branding step generation usage (called after successful generation)
// Note: checkSubscription is NOT used here because generation already succeeded.
// We're just recording usage, not generating, so credits check should not block this.
router.post('/track-usage', authenticate, async (req: AuthRequest, res, next) => {
  try {
    await connectToMongoDB();
    const db = getDb();
    const userId = req.userId!;
    const {
      success,
      stepNumber,
      promptLength
    } = req.body;

    if (!stepNumber) {
      return res.status(400).json({ error: 'Step number is required' });
    }

    const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Admins don't have credits deducted
    const isAdmin = user.isAdmin === true;

    const subscriptionStatus = user.subscriptionStatus || 'free';
    const hasActiveSubscription = subscriptionStatus === 'active';
    const freeGenerationsUsed = user.freeGenerationsUsed || 0;
    const creditsUsed = user.creditsUsed || 0;
    const monthlyCredits = user.monthlyCredits || 20;
    const totalCreditsEarned = user.totalCreditsEarned || 0;
    const monthlyCreditsRemaining = Math.max(0, monthlyCredits - creditsUsed);

    if (success) {
      // Each branding step costs 1 credit (using gemini-2.5-flash)
      const creditsToDeduct = isAdmin ? 0 : 1; // Admins don't pay credits

      // Calculate cost for text generation
      const { calculateTextGenerationCost } = await import('../utils/usageTracking.js');
      // Use real tokens if available, otherwise estimate
      const inputTokens = req.body.inputTokens;
      const outputTokens = req.body.outputTokens;
      const estimatedInputTokens = inputTokens ?? (promptLength ? Math.ceil(promptLength / 4) : 500);
      const estimatedOutputTokens = outputTokens ?? 1000; // Average response size
      const cost = calculateTextGenerationCost(estimatedInputTokens, estimatedOutputTokens, 'gemini-2.5-flash');

      // Create usage record for billing (even for admins, for tracking purposes)
      const usageRecord: any = {
        userId,
        type: 'branding',
        feature: 'brandingmachine' as const,
        stepNumber,
        timestamp: new Date(),
        promptLength,
        model: 'gemini-2.5-flash',
        cost,
        creditsDeducted: creditsToDeduct,
        subscriptionStatus,
        hasActiveSubscription,
        isAdmin, // Track admin status in usage record
        createdAt: new Date(),
      };

      // Add real tokens if available
      if (inputTokens !== undefined) {
        usageRecord.inputTokens = inputTokens;
      }
      if (outputTokens !== undefined) {
        usageRecord.outputTokens = outputTokens;
      }

      await db.collection('usage_records').insertOne(usageRecord);

      if (isAdmin) {
        console.log(`[Usage Tracking] Recorded branding usage for admin user ${userId} (no credits deducted):`, {
          stepNumber,
          timestamp: usageRecord.timestamp,
        });
      } else {
        console.log(`[Usage Tracking] Recorded branding usage for user ${userId}:`, {
          stepNumber,
          creditsDeducted: creditsToDeduct,
          timestamp: usageRecord.timestamp,
        });
      }

      // Only update credits if not admin
      if (!isAdmin) {
        // Use monthly credits FIRST, then totalCreditsEarned
        // This is the correct order: monthly credits should be used before manual credits
        let newTotalCreditsEarned = totalCreditsEarned;
        let newCreditsUsed = creditsUsed + creditsToDeduct;

        // First, use from monthly credits if available
        if (monthlyCreditsRemaining >= creditsToDeduct) {
          // Use monthly credits
          newCreditsUsed = creditsUsed + creditsToDeduct;
        } else {
          // Use remaining monthly credits first, then totalCreditsEarned
          const remainingFromMonthly = monthlyCreditsRemaining;
          const neededFromEarned = creditsToDeduct - remainingFromMonthly;

          if (neededFromEarned > 0) {
            newTotalCreditsEarned = Math.max(0, totalCreditsEarned - neededFromEarned);
          }
          newCreditsUsed = creditsUsed + creditsToDeduct;
        }

        const updateData: any = {
          $set: {
            totalCreditsEarned: newTotalCreditsEarned,
            creditsUsed: newCreditsUsed,
          },
        };

        // Also increment freeGenerationsUsed for free users (backward compatibility)
        if (!hasActiveSubscription) {
          updateData.$inc = { freeGenerationsUsed: 1 };
        }

        await db.collection('users').updateOne(
          { _id: new ObjectId(userId) },
          updateData
        );
      }

      // Calculate remaining credits for response
      // For admins, use original values (no credits deducted)
      // For non-admins, use updated values from database
      let responseCreditsUsed = creditsUsed;
      let responseTotalCreditsEarned = totalCreditsEarned;
      let responseMonthlyCreditsRemaining = monthlyCreditsRemaining;

      if (!isAdmin) {
        // Reload user to get updated values after credit deduction
        const updatedUser = await db.collection('users').findOne({ _id: new ObjectId(userId) });
        if (updatedUser) {
          responseCreditsUsed = updatedUser.creditsUsed || creditsUsed;
          responseTotalCreditsEarned = updatedUser.totalCreditsEarned || totalCreditsEarned;
          responseMonthlyCreditsRemaining = Math.max(0, (updatedUser.monthlyCredits || monthlyCredits) - responseCreditsUsed);
        }
      }

      const responseTotalCredits = responseTotalCreditsEarned + responseMonthlyCreditsRemaining;

      res.json({
        message: 'Usage tracked',
        stepNumber,
        creditsDeducted: creditsToDeduct,
        cost,
        freeGenerationsUsed: hasActiveSubscription ? freeGenerationsUsed : (isAdmin ? freeGenerationsUsed : freeGenerationsUsed + 1),
        creditsUsed: responseCreditsUsed,
        creditsRemaining: responseMonthlyCreditsRemaining,
        totalCreditsEarned: responseTotalCreditsEarned,
        totalCredits: responseTotalCredits,
        isAdmin, // Include admin status in response
      });
    } else {
      // Generation failed - credits are not deducted
      // Credits are only deducted when success: true
      res.json({
        message: 'Generation failed - credits not deducted',
        creditsDeducted: 0
      });
    }
  } catch (error: any) {
    console.error('[Usage Tracking] Error in branding track-usage endpoint:', {
      error: error.message,
      stack: error.stack,
      userId: req.userId,
      body: req.body,
    });
    next(error);
  }
});

// Save branding project (create or update)
router.post('/save', apiRateLimiter, authenticate, async (req: AuthRequest, res) => {
  try {
    const { prompt, data, projectId, name } = req.body;

    if (!prompt || !data) {
      return res.status(400).json({ error: 'Prompt and data are required' });
    }

    if (!req.userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Extract name from data if not provided directly, for backward compatibility
    const projectName = name || (data as BrandingData)?.name || null;

    let project;

    // If projectId is provided, try to update existing project
    if (projectId && projectId.trim() !== '' && projectId !== 'undefined') {
      // Verify that the project exists and belongs to the user
      const existingProject = await prisma.brandingProject.findFirst({
        where: {
          id: projectId,
          userId: req.userId,
        },
      });

      if (existingProject) {
        // Update existing project
        project = await prisma.brandingProject.update({
          where: {
            id: projectId,
          },
          data: {
            name: projectName,
            prompt,
            data: data as any,
            updatedAt: new Date(),
          },
        });
      } else {
        // Project ID provided but doesn't exist or doesn't belong to user - create new
        project = await prisma.brandingProject.create({
          data: {
            userId: req.userId,
            name: projectName,
            prompt,
            data: data as any,
          },
        });
      }
    } else {
      // No projectId provided - create new project
      project = await prisma.brandingProject.create({
        data: {
          userId: req.userId,
          name: projectName,
          prompt,
          data: data as any,
        },
      });
    }

    // Map Prisma's 'id' to '_id' for consistency with frontend
    res.json({
      project: {
        ...project,
        _id: project.id,
      }
    });
  } catch (error: any) {
    console.error('Error saving branding project:', error);
    res.status(500).json({
      error: 'Failed to save branding project',
      message: error.message || 'An error occurred while saving'
    });
  }
});

// Get branding project by ID
router.get('/:id', apiRateLimiter, authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    if (!req.userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const project = await prisma.brandingProject.findFirst({
      where: {
        id,
        userId: req.userId,
      },
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Map Prisma's 'id' to '_id' for consistency with frontend
    res.json({
      project: {
        ...project,
        _id: project.id,
      }
    });
  } catch (error: any) {
    console.error('Error fetching branding project:', error);
    res.status(500).json({
      error: 'Failed to fetch branding project',
      message: error.message || 'An error occurred'
    });
  }
});

// List user's branding projects
router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Ensure Prisma is connected
    await prisma.$connect();

    const projects = await prisma.brandingProject.findMany({
      where: {
        userId: req.userId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Map Prisma's 'id' to '_id' for consistency with frontend
    res.json({
      projects: projects.map(project => ({
        ...project,
        _id: project.id,
      }))
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
    console.error('Error fetching branding projects:', {
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
      : 'Failed to fetch branding projects';

    res.status(500).json({
      error: 'Failed to fetch branding projects',
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

// Delete branding project
router.delete('/:id', apiRateLimiter, authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    if (!req.userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const project = await prisma.brandingProject.findFirst({
      where: {
        id,
        userId: req.userId,
      },
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    await prisma.brandingProject.delete({
      where: { id },
    });

    res.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting branding project:', error);
    res.status(500).json({
      error: 'Failed to delete branding project',
      message: error.message || 'An error occurred'
    });
  }
});

export default router;

