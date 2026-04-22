import { Type } from '@google/genai';
import { prisma } from '../db/prisma.js';
import { GEMINI_MODELS } from '../../src/constants/geminiModels.js';
import { randomUUID } from 'crypto';
import { pluginBridge } from '../lib/pluginBridge.js';
import { pluginQueue } from '../lib/pluginQueue.js';

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
          },
          textMode: {
            type: Type.STRING,
            description: 'How text appears in the output. "layers" (default): no text in the Gemini image, text comes via editable canvas layers. "image": text baked into Gemini image, no canvas text layers. "both": text in image AND canvas layers (may visually conflict — avoid unless user explicitly wants it).',
            enum: ['image', 'layers', 'both']
          }
        },
        required: ['prompt']
      }
    },
    {
      name: 'update_session_memory',
      description: 'Atualiza a memória persistente da sessão com novas informações detectadas na conversa (marcas mencionadas, clientes, decisões estratégicas, referências). Chame em paralelo com outras ferramentas sempre que identificar informações novas relevantes.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          brands: { type: Type.STRING, description: 'Nome(s) de marca mencionados (separados por vírgula)' },
          clients: { type: Type.STRING, description: 'Nome(s) de cliente mencionados (separados por vírgula)' },
          decisions: { type: Type.STRING, description: 'Decisão estratégica tomada (1 frase)' },
          references: { type: Type.STRING, description: 'Referência visual/cultural mencionada (separados por vírgula)' },
        },
      },
    },
    {
      name: 'generate_in_figma',
      description: 'Cria um criativo completo (frame + textos + logo + overlay) diretamente no Figma do usuário, usando a brand guideline da sessão. Use quando o usuário pedir explicitamente para criar no Figma. Se o plugin estiver offline, as operações são enfileiradas e aplicadas automaticamente quando o plugin abrir.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          prompt: {
            type: Type.STRING,
            description: 'Briefing do criativo a criar no Figma',
          },
          format: {
            type: Type.STRING,
            enum: ['1:1', '9:16', '16:9', '4:5'],
            description: 'Formato/aspect ratio do frame. Default: 1:1',
          },
        },
        required: ['prompt'],
      },
    },
    {
      name: 'propose_creative_plan',
      description: 'Use BEFORE generating mockups when the creative request is open-ended or ambiguous. Propose a set of mockup variations and ask clarifying questions — do NOT generate images yet. Await user approval.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          summary: {
            type: Type.STRING,
            description: 'One sentence: what the agent understood from the request',
          },
          proposals: {
            type: Type.ARRAY,
            description: 'Proposed mockup variations',
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING, description: 'Short variation title (e.g. "Basquete — lifestyle clean")' },
                prompt: { type: Type.STRING, description: 'Draft generation prompt for this variation' },
                aspectRatio: { type: Type.STRING, description: 'Suggested aspect ratio: 1:1, 16:9 or 3:2' },
              },
              required: ['title', 'prompt'],
            },
          },
          questions: {
            type: Type.ARRAY,
            description: 'Clarifying questions before generating (e.g. "Usar a logo da marca?", "Formato preferido?")',
            items: { type: Type.STRING },
          },
        },
        required: ['summary', 'proposals'],
      },
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
    },
    {
      name: 'brand_guideline_create',
      description: 'Create a new brand guideline for the user. Use when the user asks to create, start, or set up a new brand. Provide at minimum a name.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING, description: 'Brand name' },
          tagline: { type: Type.STRING, description: 'Brand tagline or slogan' },
          website: { type: Type.STRING, description: 'Brand website URL' },
          description: { type: Type.STRING, description: 'Short brand description' },
        },
        required: ['name'],
      },
    },
    {
      name: 'brand_guideline_update',
      description: 'Update sections of the current session\'s brand guideline. Use when user wants to add/change colors, typography, voice, strategy, personas, archetypes, positioning, or design tokens. Only provide the sections you want to update.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          brand_guideline_id: { type: Type.STRING, description: 'Brand guideline ID. Use the session brand if not provided.' },
          identity: {
            type: Type.OBJECT,
            description: 'Brand identity fields to update (partial)',
            properties: {
              name: { type: Type.STRING },
              tagline: { type: Type.STRING },
              website: { type: Type.STRING },
              description: { type: Type.STRING },
            },
          },
          colors: {
            type: Type.ARRAY,
            description: 'Full replacement of color palette. Each color needs hex, name, and optional role (primary/secondary/background/text/accent/cta).',
            items: {
              type: Type.OBJECT,
              properties: {
                hex: { type: Type.STRING },
                name: { type: Type.STRING },
                role: { type: Type.STRING },
              },
              required: ['hex', 'name'],
            },
          },
          typography: {
            type: Type.ARRAY,
            description: 'Full replacement of typography. Each entry needs family, role, and optional style/size.',
            items: {
              type: Type.OBJECT,
              properties: {
                family: { type: Type.STRING },
                role: { type: Type.STRING, description: 'e.g. heading, body, accent, mono' },
                style: { type: Type.STRING, description: 'e.g. Bold, Regular, SemiBold' },
                size: { type: Type.NUMBER },
              },
              required: ['family', 'role'],
            },
          },
          guidelines: {
            type: Type.OBJECT,
            description: 'Brand voice and content guidelines',
            properties: {
              voice: { type: Type.STRING },
              dos: { type: Type.ARRAY, items: { type: Type.STRING } },
              donts: { type: Type.ARRAY, items: { type: Type.STRING } },
              imagery: { type: Type.STRING },
              accessibility: { type: Type.STRING },
            },
          },
          strategy: {
            type: Type.OBJECT,
            description: 'Brand strategy — manifesto, positioning, archetypes, personas, voice values',
            properties: {
              manifesto: { type: Type.STRING },
              positioning: { type: Type.ARRAY, items: { type: Type.STRING } },
              archetypes: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    role: { type: Type.STRING, description: 'primary or secondary' },
                    description: { type: Type.STRING },
                    examples: { type: Type.ARRAY, items: { type: Type.STRING } },
                  },
                  required: ['name', 'description'],
                },
              },
              personas: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    age: { type: Type.NUMBER },
                    occupation: { type: Type.STRING },
                    traits: { type: Type.ARRAY, items: { type: Type.STRING } },
                    bio: { type: Type.STRING },
                    desires: { type: Type.ARRAY, items: { type: Type.STRING } },
                    painPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
                  },
                  required: ['name'],
                },
              },
              voiceValues: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    description: { type: Type.STRING },
                    example: { type: Type.STRING },
                  },
                  required: ['title', 'description', 'example'],
                },
              },
            },
          },
        },
        required: [],
      },
    },
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
interface BrandContext {
  name: string;
  logoUrl: string | null;
  colors: string[];
  fonts: string[];
  voice?: string;
  keywords: string[];
  hasLogos: boolean;
}

async function resolveBrandContext(brandGuidelineId: string): Promise<BrandContext | null> {
  try {
    const brand = await prisma.brandGuideline.findUnique({
      where: { id: brandGuidelineId },
      select: { identity: true, logos: true, colors: true, typography: true, guidelines: true, tags: true },
    });
    if (!brand) return null;

    const name = ((brand.identity as any)?.name || '').trim() || 'a marca';
    const logos = Array.isArray(brand.logos) ? (brand.logos as any[]) : [];
    const ranked =
      logos.find((l: any) => l?.variant === 'primary') ||
      logos.find((l: any) => l?.variant === 'dark') ||
      logos.find((l: any) => l?.variant === 'light') ||
      logos[0];
    const logoUrl = ranked?.url && typeof ranked.url === 'string' ? ranked.url : null;

    const colors = Array.isArray(brand.colors)
      ? (brand.colors as any[]).map((c: any) => c?.hex).filter(Boolean)
      : [];
    const fonts = Array.isArray(brand.typography)
      ? (brand.typography as any[]).map((t: any) => t?.family).filter(Boolean)
      : [];
    const voice = (brand.guidelines as any)?.voice;
    const tags = brand.tags as any;
    const keywords = tags ? Object.values(tags).flat().filter((v): v is string => typeof v === 'string') : [];

    return { name, logoUrl, colors, fonts, voice, keywords, hasLogos: logos.length > 0 };
  } catch (err: any) {
    console.warn('[AdminChatTools] Failed to resolve brand context:', err.message);
    return null;
  }
}

/** Map raw plan layers (from /api/creative/plan) into the full CreativeLayer shape the editor expects. */
function buildCreativeLayers(planLayers: any[], logoUrl: string | null): any[] {
  return planLayers
    .map((l: any, i: number) => {
      if (l.type === 'logo') {
        if (!logoUrl) return null; // no logo available — skip
        return {
          id: randomUUID(),
          visible: true,
          zIndex: i + 1,
          data: { type: 'logo', url: logoUrl, position: l.position, size: l.size },
        };
      }
      return {
        id: randomUUID(),
        visible: true,
        zIndex: i + 1,
        data: l,
      };
    })
    .filter((l): l is NonNullable<typeof l> => l !== null);
}

export async function executeAdminChatTool(
  toolName: string,
  args: any,
  userId: string,
  sessionId: string,
  authHeader: string = '',
  sessionBrandGuidelineId?: string
): Promise<any> {
  if (toolName === 'propose_creative_plan') {
    // Passthrough — the route broadcasts CREATIVE_PLAN_PROPOSED via WS
    return { success: true, plan: args };
  }

  if (toolName === 'update_session_memory') {
    // Returns the parsed fields — the route applies them to session.memory
    const split = (v?: string) => v ? v.split(',').map(s => s.trim()).filter(Boolean) : [];
    return {
      success: true,
      memoryPatch: {
        brands: split(args.brands),
        clients: split(args.clients),
        decisions: split(args.decisions),
        references: split(args.references),
      },
    };
  }

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

  if (toolName === 'generate_in_figma') {
    const resolvedBrandId = args.brandGuidelineId || sessionBrandGuidelineId;

    // 1. Brand must have a Figma file linked
    const guideline = resolvedBrandId
      ? await prisma.brandGuideline.findUnique({
          where: { id: resolvedBrandId },
          select: { figmaFileKey: true },
        })
      : null;

    if (!guideline?.figmaFileKey) {
      return {
        success: false,
        queued: false,
        error: 'Nenhum arquivo Figma vinculado a esta marca. Abra o plugin Visant no Figma e vincule a marca primeiro.',
      };
    }

    const fileId = guideline.figmaFileKey;
    const brandCtx = resolvedBrandId ? await resolveBrandContext(resolvedBrandId) : null;
    const format = args.format || '1:1';

    // 2. Generate Figma operations via existing endpoint
    const baseUrl = getInternalApiBaseUrl();
    const genResp = await fetch(`${baseUrl}/api/figma/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
      body: JSON.stringify({
        command: args.prompt,
        format,
        brandContext: brandCtx,
        brandGuidelineId: resolvedBrandId,
      }),
    });

    if (!genResp.ok) {
      const errText = await genResp.text().catch(() => '');
      throw new Error(`Figma generate failed (${genResp.status}): ${errText.slice(0, 200)}`);
    }

    const { operations } = await genResp.json();
    if (!operations?.length) {
      throw new Error('Nenhuma operação gerada para o Figma.');
    }

    // 3. Apply now if plugin is connected, else enqueue for later
    if (pluginBridge.isConnected(fileId)) {
      const result = await pluginBridge.push(fileId, operations);
      return {
        success: result.success,
        queued: false,
        appliedCount: result.appliedCount,
        figmaUrl: `https://www.figma.com/file/${fileId}`,
      };
    }

    // Plugin offline — persist to Redis queue
    await pluginQueue.enqueue(fileId, {
      id: randomUUID(),
      operations,
      enqueuedAt: new Date().toISOString(),
      userId,
      chatSessionId: sessionId,
      meta: { prompt: args.prompt, brandId: resolvedBrandId, format },
    });

    const queueSize = await pluginQueue.size(fileId);
    return {
      success: true,
      queued: true,
      queueSize,
      figmaUrl: `https://www.figma.com/file/${fileId}`,
    };
  }

  if (toolName === 'brand_guideline_create') {
    if (!args?.name) throw new Error('brand_guideline_create requires name');
    const guideline = await prisma.brandGuideline.create({
      data: {
        userId,
        identity: {
          name: args.name,
          tagline: args.tagline,
          website: args.website,
          description: args.description,
        } as any,
        extraction: { sources: [{ type: 'manual', date: new Date().toISOString() }], completeness: 0 } as any,
      },
    });
    return { success: true, id: guideline.id, name: args.name };
  }

  if (toolName === 'brand_guideline_update') {
    const targetId = args.brand_guideline_id || sessionBrandGuidelineId;
    if (!targetId) throw new Error('brand_guideline_update requires brand_guideline_id or an active session brand');

    const existing = await prisma.brandGuideline.findFirst({ where: { id: targetId, userId } });
    if (!existing) throw new Error('Brand guideline not found');

    const updateData: Record<string, any> = {};

    if (args.identity) {
      updateData.identity = { ...((existing.identity as any) || {}), ...args.identity };
    }
    if (args.colors) updateData.colors = args.colors;
    if (args.typography) updateData.typography = args.typography;
    if (args.guidelines) {
      updateData.guidelines = { ...((existing.guidelines as any) || {}), ...args.guidelines };
    }
    if (args.strategy) {
      updateData.strategy = { ...((existing.strategy as any) || {}), ...args.strategy };
    }

    if (!Object.keys(updateData).length) {
      return { success: false, error: 'No fields to update' };
    }

    const updated = await prisma.brandGuideline.update({ where: { id: existing.id }, data: updateData });
    return { success: true, id: updated.id, updated: Object.keys(updateData) };
  }

  if (toolName !== 'generate_or_update_mockup') {
    throw new Error(`Unknown tool: ${toolName}`);
  }

  args = args as GenerateMockupArgs;

  // Resolve brand context: LLM-provided arg > session default.
  const resolvedBrandId = args.brandGuidelineId || sessionBrandGuidelineId;

  let finalPrompt = args.prompt;
  const referenceImages: Array<{ url: string }> = [];
  let brandCtx: BrandContext | null = null;

  if (resolvedBrandId) {
    brandCtx = await resolveBrandContext(resolvedBrandId);
    if (brandCtx) {
      if (brandCtx.logoUrl) {
        referenceImages.push({ url: brandCtx.logoUrl });
        finalPrompt =
          `${args.prompt}\n\n` +
          `CRITICAL LOGO INSTRUCTION: The reference image provided IS the official "${brandCtx.name}" logo. ` +
          `Apply it to the mockup exactly as shown — same shape, same proportions, same letterforms. ` +
          `Do NOT redesign, redraw, re-letter, or invent any alternative mark. ` +
          `Only adapt color/placement to fit the composition when necessary.`;
      } else {
        finalPrompt =
          `${args.prompt}\n\n` +
          `CRITICAL BRAND INSTRUCTION: "${brandCtx.name}" has no visual logo symbol available. ` +
          `Display only the wordmark "${brandCtx.name}" in clean, neutral sans-serif type. ` +
          `Do NOT invent a symbol, icon, emblem or monogram. No ornamentation.`;
      }
    }
  }

  const textMode = (args.textMode as string) || 'layers';

  if (textMode === 'layers') {
    finalPrompt +=
      '\n\nTEXT RULE: Do NOT include any typography, text, words, labels, slogans, or overlay text rendered into the image. Keep the visual clean and text-free — all copy will be added as editable canvas layers separately.';
  }

  const format = (args.aspectRatio || '1:1') as string;

  try {
    console.log('[AdminChatTools] Generating mockup:', {
      prompt: finalPrompt.substring(0, 100),
      creativeProjectId: args.creativeProjectId,
      sessionId,
      brandGuidelineId: resolvedBrandId,
      logoReferenced: referenceImages.length > 0,
    });

    const baseUrl = getInternalApiBaseUrl();

    // 1. Run image generation + creative plan in parallel
    const [genResponse, planResponse] = await Promise.all([
      fetch(`${baseUrl}/api/mockups/generate`, {
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
          aspectRatio: format,
          feature: 'canvas',
          provider: 'gemini',
        }),
      }),
      fetch(`${baseUrl}/api/creative/plan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authHeader ? { Authorization: authHeader } : {}),
        },
        body: JSON.stringify({
          prompt: args.prompt,
          format,
          brandId: resolvedBrandId,
          brandContext: brandCtx
            ? {
                name: brandCtx.name,
                colors: brandCtx.colors,
                fonts: brandCtx.fonts,
                voice: brandCtx.voice,
                keywords: brandCtx.keywords,
                hasLogos: brandCtx.hasLogos,
              }
            : undefined,
        }),
      }),
    ]);

    if (!genResponse.ok) {
      const errText = await genResponse.text().catch(() => '');
      throw new Error(`Mockup generation failed (${genResponse.status}): ${errText.slice(0, 300)}`);
    }

    const imageResult = await genResponse.json();
    const imageUrl = imageResult.imageUrl || `data:image/png;base64,${imageResult.imageBase64}`;

    // 2. Parse creative plan + build full layer array
    let layers: any[] = [];
    let overlay: any = null;
    if (planResponse.ok) {
      try {
        const plan = await planResponse.json();
        overlay = plan.overlay ?? null;
        layers = buildCreativeLayers(plan.layers ?? [], brandCtx?.logoUrl ?? null);
        // When text is already baked into the Gemini image, remove canvas text layers to avoid conflict
        if (textMode === 'image') {
          layers = layers.filter((l: any) => l.type !== 'text');
        }
        console.log(`[AdminChatTools] Plan OK — ${layers.length} layers built (textMode=${textMode})`);
      } catch (e: any) {
        console.warn('[AdminChatTools] Creative plan parse failed, proceeding without layers:', e.message);
      }
    } else {
      console.warn('[AdminChatTools] Creative plan request failed:', planResponse.status);
    }

    console.log('[AdminChatTools] Image generated, saving Creative Project');

    // 3. Either create new or update existing Creative Project
    let creativeProjectId = args.creativeProjectId;

    if (creativeProjectId) {
      await prisma.creativeProject.update({
        where: { id: creativeProjectId },
        data: {
          backgroundUrl: imageUrl,
          prompt: args.prompt,
          overlay: overlay as any,
          layers: layers as any,
          updatedAt: new Date(),
        },
      });
      console.log('[AdminChatTools] Updated existing Creative Project:', creativeProjectId);
    } else {
      const created = await prisma.creativeProject.create({
        data: {
          userId,
          name: `Admin Chat Mockup - ${new Date().toLocaleDateString('pt-BR')}`,
          prompt: args.prompt,
          backgroundUrl: imageUrl,
          format,
          brandId: resolvedBrandId ?? undefined,
          overlay: overlay as any,
          layers: layers as any,
          adminChatSessionId: sessionId,
        },
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
