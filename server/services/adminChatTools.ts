import { Type } from '@google/genai';
import { prisma } from '../db/prisma.js';
import { GEMINI_MODELS } from '../../src/constants/geminiModels.js';

// Server-side loopback: adminChatTools runs on Node, so we call our own /api/mockups/generate
// endpoint with an absolute URL (relative URLs don't work with Node fetch).
function getInternalApiBaseUrl(): string {
  const explicit = process.env.INTERNAL_API_URL || process.env.SERVER_URL;
  if (explicit) return explicit.replace(/\/$/, '');
  const port = process.env.PORT || '3001';
  return `http://127.0.0.1:${port}`;
}

export const ADMIN_CHAT_TOOLS = [{
  functionDeclarations: [
    {
      name: 'generate_or_update_mockup',
      description: 'Generate or regenerate a mockup image and save as editable Creative Project',
      parameters: {
        type: Type.OBJECT,
        properties: {
          prompt: {
            type: Type.STRING,
            description: 'Design brief describing the mockup to generate'
          },
          creativeProjectId: {
            type: Type.STRING,
            description: 'Existing Creative Project ID to update (optional, leave empty to create new)'
          },
          brandGuidelineId: {
            type: Type.STRING,
            description: 'Brand guideline ID for context injection (optional)'
          },
          model: {
            type: Type.STRING,
            description: 'Gemini image-gen model to use. Default: gemini-2.5-flash-image.',
            enum: [
              GEMINI_MODELS.IMAGE_FLASH,
              GEMINI_MODELS.IMAGE_NB2,
              GEMINI_MODELS.IMAGE_PRO,
            ]
          },
          resolution: {
            type: Type.STRING,
            description: 'Image resolution (only applies to advanced models IMAGE_NB2/IMAGE_PRO)',
            enum: ['1K', '2K', '4K']
          },
          aspectRatio: {
            type: Type.STRING,
            description: 'Aspect ratio of the generated image',
            enum: ['1:1', '16:9', '3:2']
          }
        },
        required: ['prompt']
      }
    },
    {
      name: 'save_to_brand_knowledge',
      description: 'Save a piece of information (strategic insight, positioning note, reference, decision) into the brand\'s long-term memory (RAG). Requires explicit user approval before persisting. Only call when the session is linked to a brand.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          title: {
            type: Type.STRING,
            description: 'Short title describing what this knowledge entry is about'
          },
          content: {
            type: Type.STRING,
            description: 'The text content to save to the brand memory (markdown supported)'
          },
          reason: {
            type: Type.STRING,
            description: 'Why this should be saved to brand memory (1 sentence)'
          }
        },
        required: ['title', 'content']
      }
    }
  ]
}];

interface GenerateMockupArgs {
  prompt: string;
  creativeProjectId?: string;
  brandGuidelineId?: string;
  model?: string;
  resolution?: string;
  aspectRatio?: string;
}

interface SaveToBrandKnowledgeArgs {
  title: string;
  content: string;
  reason?: string;
}

/**
 * Fetch the brand's primary logo (or first available) + name, so we can pass
 * the actual pixels to Gemini instead of hoping it infers from a text prompt.
 * Returns null if no brand, or { name, logoUrl: null } if brand has no logo.
 */
async function resolveBrandLogoContext(brandGuidelineId: string): Promise<{ name: string; logoUrl: string | null } | null> {
  try {
    const brand = await prisma.brandGuideline.findUnique({
      where: { id: brandGuidelineId },
      select: { identity: true, logos: true },
    });
    if (!brand) return null;

    const name = ((brand.identity as any)?.name || '').trim() || 'a marca';
    const logos = Array.isArray(brand.logos) ? (brand.logos as any[]) : [];

    // Prefer primary → dark → light → first available
    const ranked =
      logos.find(l => l?.variant === 'primary') ||
      logos.find(l => l?.variant === 'dark') ||
      logos.find(l => l?.variant === 'light') ||
      logos[0];

    const logoUrl = ranked?.url && typeof ranked.url === 'string' ? ranked.url : null;
    return { name, logoUrl };
  } catch (err: any) {
    console.warn('[AdminChatTools] Failed to resolve brand logo:', err.message);
    return null;
  }
}

export async function executeAdminChatTool(
  toolName: string,
  args: any,
  userId: string,
  sessionId: string,
  authHeader: string = '',
  sessionBrandGuidelineId?: string
): Promise<any> {
  if (toolName === 'save_to_brand_knowledge') {
    const saveArgs = args as SaveToBrandKnowledgeArgs;
    if (!saveArgs?.title || !saveArgs?.content) {
      throw new Error('save_to_brand_knowledge requires title and content');
    }
    // Don't persist here — the caller (adminChat route) creates the pending approval
    // and broadcasts APPROVAL_REQUIRED. Returning this shape signals "awaiting approval".
    return {
      success: true,
      pendingApproval: {
        title: saveArgs.title.slice(0, 200),
        content: saveArgs.content,
        reason: saveArgs.reason?.slice(0, 400),
      },
    };
  }

  if (toolName !== 'generate_or_update_mockup') {
    throw new Error(`Unknown tool: ${toolName}`);
  }

  args = args as GenerateMockupArgs;

  // Resolve brand context: LLM-provided arg > session default. Prevents the
  // LLM from "forgetting" to pass brandGuidelineId and generating an unbranded
  // mockup in a brand-linked session.
  const resolvedBrandId = args.brandGuidelineId || sessionBrandGuidelineId;

  // Fetch the actual logo pixels so Gemini doesn't hallucinate the mark from
  // a text description. If no logo exists, constrain the prompt to wordmark-only.
  let finalPrompt = args.prompt;
  const referenceImages: Array<{ url: string }> = [];

  if (resolvedBrandId) {
    const ctx = await resolveBrandLogoContext(resolvedBrandId);
    if (ctx) {
      if (ctx.logoUrl) {
        referenceImages.push({ url: ctx.logoUrl });
        finalPrompt =
          `${args.prompt}\n\n` +
          `CRITICAL LOGO INSTRUCTION: The reference image provided IS the official "${ctx.name}" logo. ` +
          `Apply it to the mockup exactly as shown — same shape, same proportions, same letterforms. ` +
          `Do NOT redesign, redraw, re-letter, or invent any alternative mark. ` +
          `Only adapt color/placement to fit the composition when necessary.`;
      } else {
        finalPrompt =
          `${args.prompt}\n\n` +
          `CRITICAL BRAND INSTRUCTION: "${ctx.name}" has no visual logo symbol available. ` +
          `Display only the wordmark "${ctx.name}" in clean, neutral sans-serif type. ` +
          `Do NOT invent a symbol, icon, emblem or monogram. No ornamentation.`;
      }
    }
  }

  try {
    console.log('[AdminChatTools] Generating mockup:', {
      prompt: finalPrompt.substring(0, 100),
      creativeProjectId: args.creativeProjectId,
      sessionId,
      brandGuidelineId: resolvedBrandId,
      logoReferenced: referenceImages.length > 0,
    });

    // 1. Generate image via internal loopback HTTP (absolute URL required for Node fetch)
    const baseUrl = getInternalApiBaseUrl();
    const genResponse = await fetch(`${baseUrl}/api/mockups/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
      body: JSON.stringify({
        promptText: finalPrompt,
        brandGuidelineId: resolvedBrandId,
        referenceImages: referenceImages.length > 0 ? referenceImages : undefined,
        model: args.model || GEMINI_MODELS.IMAGE_FLASH,
        resolution: args.resolution,
        aspectRatio: args.aspectRatio || '1:1',
        feature: 'canvas',
        provider: 'gemini',
      }),
    });

    if (!genResponse.ok) {
      const errText = await genResponse.text().catch(() => '');
      throw new Error(`Mockup generation failed (${genResponse.status}): ${errText.slice(0, 300)}`);
    }

    const imageResult = await genResponse.json();

    const imageUrl = imageResult.imageUrl || `data:image/png;base64,${imageResult.imageBase64}`;

    console.log('[AdminChatTools] Image generated, now saving Creative Project');

    // 2. Either create new or update existing Creative Project
    let creativeProjectId = args.creativeProjectId;

    if (creativeProjectId) {
      // Update existing
      await prisma.creativeProject.update({
        where: { id: creativeProjectId },
        data: {
          backgroundUrl: imageUrl,
          prompt: args.prompt,
          updatedAt: new Date()
        }
      });

      console.log('[AdminChatTools] Updated existing Creative Project:', creativeProjectId);
    } else {
      // Create new
      const created = await prisma.creativeProject.create({
        data: {
          userId,
          name: `Admin Chat Mockup - ${new Date().toLocaleDateString('pt-BR')}`,
          prompt: args.prompt,
          backgroundUrl: imageUrl,
          format: args.aspectRatio || '1:1',
          brandId: args.brandGuidelineId,
          layers: [],
          adminChatSessionId: sessionId
        }
      });

      creativeProjectId = created.id;

      console.log('[AdminChatTools] Created new Creative Project:', creativeProjectId);
    }

    const result = {
      success: true,
      creativeProjectId,
      imageUrl,
      editUrl: `/create?project=${creativeProjectId}`,
      prompt: args.prompt,
      creditsDeducted: imageResult.creditsDeducted,
      creditsRemaining: imageResult.creditsRemaining
    };

    console.log('[AdminChatTools] Tool execution complete:', result);

    return result;
  } catch (error: any) {
    console.error('[AdminChatTools] Error executing tool:', error);
    throw error;
  }
}
