/**
 * Visant Labs — MCP Shared Tool Definitions
 *
 * Shared between the stdio server (mcp-server/index.ts) and the HTTP server (api/index.ts).
 * Contains: visantFetch, toolResult, TOOLS array, handleTool dispatcher.
 */

const API_BASE = process.env.VISANT_API_URL || 'http://localhost:3000/api';
const API_TOKEN = process.env.VISANT_API_TOKEN;

export async function visantFetch(path: string, init: RequestInit = {}) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((init.headers as Record<string, string>) || {}),
  };
  if (API_TOKEN) headers.Authorization = `Bearer ${API_TOKEN}`;

  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Visant API ${res.status} ${path}: ${text.slice(0, 300)}`);
  }
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export function toolResult(data: unknown) {
  return {
    content: [
      {
        type: 'text' as const,
        text: typeof data === 'string' ? data : JSON.stringify(data, null, 2),
      },
    ],
  };
}

// ---------- Tool definitions ----------

export const TOOLS = [
  {
    name: 'create_creative_plan',
    description:
      'Generate a structured creative layout (background prompt, overlay, layers) for a marketing asset. ' +
      'If brandId is provided, the plan is automatically biased by that brand\'s learned edit history.',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: 'Creative brief / user intent' },
        format: {
          type: 'string',
          enum: ['1:1', '9:16', '16:9', '4:5'],
          description: 'Aspect ratio of the creative',
        },
        brandId: {
          type: 'string',
          description: 'Optional brand guideline id for brand-aware generation',
        },
        brandContext: {
          type: 'object',
          description: 'Inline brand context if brandId is not available',
          properties: {
            name: { type: 'string' },
            colors: { type: 'array', items: { type: 'string' } },
            fonts: { type: 'array', items: { type: 'string' } },
            voice: { type: 'string' },
            keywords: { type: 'array', items: { type: 'string' } },
            hasLogos: { type: 'boolean' },
          },
        },
      },
      required: ['prompt', 'format'],
    },
  },
  {
    name: 'get_brand_insights',
    description:
      'Get learned brand preferences aggregated from user edit history. Returns font-size bias, ' +
      'color overrides, logo position bias, commonly removed roles, and human-readable patches. ' +
      'Use this to understand how a brand\'s actual usage diverges from AI defaults.',
    inputSchema: {
      type: 'object',
      properties: {
        brandId: { type: 'string', description: 'Brand guideline id' },
      },
      required: ['brandId'],
    },
  },
  {
    name: 'list_creative_events',
    description:
      'Query the raw creative edit event stream (observability). Newest first. ' +
      'Filter by brandId or creativeId.',
    inputSchema: {
      type: 'object',
      properties: {
        brandId: { type: 'string' },
        creativeId: { type: 'string' },
        limit: { type: 'number', default: 100, maximum: 500 },
      },
    },
  },
  {
    name: 'get_creative_metrics',
    description:
      'Get aggregate creative metrics (creatives count, avg edits per creative, first-try acceptance rate). ' +
      'Optionally scoped to a brand.',
    inputSchema: {
      type: 'object',
      properties: {
        brandId: { type: 'string', description: 'Optional brand filter' },
      },
    },
  },
  {
    name: 'list_brand_guidelines',
    description: 'List all available brand guidelines with ids and names.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'get_brand_guideline',
    description:
      'Fetch the full brand guideline for a given id. Includes identity, colors, typography, logos, voice, ' +
      'gradients, shadows, motion tokens, borders, strategy, editorial guidelines, and validation state. ' +
      'Use this to get LLM-ready brand context before generating any brand-aware content.',
    inputSchema: {
      type: 'object',
      properties: {
        brandId: { type: 'string' },
      },
      required: ['brandId'],
    },
  },
  {
    name: 'update_brand_guideline',
    description:
      'Patch a brand guideline with new data. Accepts any subset of fields: identity, colors, typography, ' +
      'gradients, shadows, motion, borders, strategy, guidelines, tokens, validation. ' +
      'All fields are optional — only provided fields are updated.',
    inputSchema: {
      type: 'object',
      properties: {
        brandId: { type: 'string', description: 'Brand guideline id to update' },
        data: {
          type: 'object',
          description: 'Partial brand guideline data to merge',
          properties: {
            identity: { type: 'object' },
            colors: { type: 'array' },
            typography: { type: 'array' },
            gradients: { type: 'array' },
            shadows: { type: 'array' },
            motion: { type: 'object' },
            borders: { type: 'array' },
            strategy: { type: 'object' },
            guidelines: { type: 'object' },
            tokens: { type: 'object' },
            validation: { type: 'object' },
            tags: { type: 'object' },
          },
        },
      },
      required: ['brandId', 'data'],
    },
  },
  {
    name: 'validate_brand_section',
    description:
      'Mark a brand guideline section as approved or needs_work. ' +
      'Section names: colors, typography, logos, identity, strategy, editorial, gradients, shadows, motion, borders, tokens.',
    inputSchema: {
      type: 'object',
      properties: {
        brandId: { type: 'string' },
        section: { type: 'string', description: 'Section name to validate' },
        state: {
          type: 'string',
          enum: ['approved', 'needs_work', 'pending'],
          description: 'Validation state to set',
        },
      },
      required: ['brandId', 'section', 'state'],
    },
  },
  // ---- Prompt tools ----
  {
    name: 'improve_prompt',
    description: 'Improve and refine an existing image generation prompt to make it more detailed and effective.',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: 'The prompt to improve' },
      },
      required: ['prompt'],
    },
  },
  {
    name: 'generate_smart_prompt',
    description:
      'Generate an optimized image generation prompt from structured inputs (design type, tags, colors, aspect ratio). ' +
      'Optionally biased by a base image or brand guideline.',
    inputSchema: {
      type: 'object',
      properties: {
        designType: { type: 'string', description: 'Type of design (e.g. product mockup, social media post, banner)' },
        additionalPrompt: { type: 'string', description: 'Free-text creative direction to include' },
        aspectRatio: { type: 'string', enum: ['1:1', '9:16', '16:9', '4:5'], default: '1:1' },
        brandingTags: { type: 'array', items: { type: 'string' }, description: 'Brand style tags' },
        categoryTags: { type: 'array', items: { type: 'string' } },
        locationTags: { type: 'array', items: { type: 'string' } },
        angleTags: { type: 'array', items: { type: 'string' } },
        lightingTags: { type: 'array', items: { type: 'string' } },
        effectTags: { type: 'array', items: { type: 'string' } },
        materialTags: { type: 'array', items: { type: 'string' } },
        baseImageUrl: { type: 'string', description: 'URL of a reference image' },
        brandGuidelineId: { type: 'string', description: 'Brand guideline id for brand-aware prompt' },
        negativePrompt: { type: 'string', description: 'Things to exclude from the image' },
      },
      required: ['designType'],
    },
  },
  {
    name: 'suggest_prompt_variations',
    description: 'Generate multiple creative variations of an existing prompt.',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: 'Base prompt to vary' },
      },
      required: ['prompt'],
    },
  },
  {
    name: 'extract_prompt_from_image',
    description: 'Reverse-engineer a descriptive prompt from an image (URL or base64). Useful for replicating a visual style.',
    inputSchema: {
      type: 'object',
      properties: {
        imageUrl: { type: 'string', description: 'URL of the image to analyze' },
        mimeType: { type: 'string', description: 'MIME type of the image (default: image/png)', default: 'image/png' },
      },
      required: ['imageUrl'],
    },
  },
  {
    name: 'extract_colors',
    description:
      'Extract a dominant color palette from an image (URL or base64). ' +
      'Returns hex codes, color names, semantic roles (primary/accent/etc.) and frequency.',
    inputSchema: {
      type: 'object',
      properties: {
        imageUrl: { type: 'string', description: 'URL of the image to analyze' },
        mimeType: { type: 'string', description: 'MIME type (default: image/png)', default: 'image/png' },
      },
      required: ['imageUrl'],
    },
  },
  // ---- Brand creative tools ----
  {
    name: 'generate_naming',
    description:
      'Generate creative brand or product name suggestions from a brief. ' +
      'Optionally biased by a brand guideline. Returns names with rationale.',
    inputSchema: {
      type: 'object',
      properties: {
        brief: { type: 'string', description: 'Description of the brand, product, or concept to name' },
        count: { type: 'number', description: 'Number of name suggestions (default: 10)', default: 10 },
        style: { type: 'string', description: 'Naming style preference (e.g. invented word, metaphor, compound, real word)' },
        brandGuidelineId: { type: 'string', description: 'Brand guideline id for brand-aware naming' },
      },
      required: ['brief'],
    },
  },
  {
    name: 'generate_persona',
    description: 'Generate a detailed audience persona (demographics, psychographics, pain points, motivations) from a brand brief.',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: 'Brand or product brief' },
        marketResearch: { type: 'string', description: 'Optional prior market research context' },
      },
      required: ['prompt'],
    },
  },
  {
    name: 'generate_archetype',
    description: 'Generate brand archetype analysis (Hero, Sage, Lover, Caregiver, etc.) from a brand brief.',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: 'Brand or product brief' },
        marketResearch: { type: 'string', description: 'Optional prior market research context' },
      },
      required: ['prompt'],
    },
  },
  {
    name: 'generate_concept_ideas',
    description: 'Generate creative mockup/usage scenario ideas for a product or brand.',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: 'Brand or product brief' },
        previousData: { type: 'object', description: 'Optional prior branding data (persona, colors, archetype) for richer ideas' },
      },
      required: ['prompt'],
    },
  },
  {
    name: 'generate_color_palettes',
    description: 'Generate AI-recommended color palettes for a brand from a brief and optional SWOT/references context.',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: 'Brand or product brief' },
        previousData: { type: 'object', description: 'Optional prior branding data (swot, references)' },
      },
      required: ['prompt'],
    },
  },
  {
    name: 'generate_market_research',
    description: 'Generate a market benchmarking paragraph for a brand or product brief.',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: 'Brand or product brief' },
      },
      required: ['prompt'],
    },
  },
  {
    name: 'generate_swot',
    description: 'Generate a SWOT analysis (strengths, weaknesses, opportunities, threats) for a brand brief.',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: 'Brand or product brief' },
        previousData: { type: 'object', description: 'Optional prior market research and competitors data' },
      },
      required: ['prompt'],
    },
  },
  {
    name: 'generate_moodboard',
    description: 'Generate a moodboard direction (aesthetic, vibe, visual mood) for a brand brief.',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: 'Brand or product brief' },
        previousData: { type: 'object', description: 'Optional prior branding data for richer moodboard' },
      },
      required: ['prompt'],
    },
  },
  // ---- Mockup tools ----
  {
    name: 'generate_mockup',
    description:
      'Generate a single mockup image using AI (text-to-image or image-to-image). ' +
      'Supports gpt-image-1, gpt-image-2 (OpenAI), seedream, and gemini models. ' +
      'Returns the generated mockup object with imageUrl. For multiple mockups use batch_generate_mockups.',
    inputSchema: {
      type: 'object',
      properties: {
        promptText: { type: 'string', description: 'Prompt describing the image to generate' },
        provider: {
          type: 'string',
          enum: ['gemini', 'openai', 'seedream'],
          description: 'Image generation provider. Default: openai',
          default: 'openai',
        },
        model: {
          type: 'string',
          description: 'Model name. For openai: gpt-image-1 or gpt-image-2. For gemini: gemini-2.0-flash-exp-image-generation. For seedream: seedream-3-0.',
          default: 'gpt-image-2',
        },
        aspectRatio: {
          type: 'string',
          enum: ['1:1', '9:16', '16:9', '4:5'],
          description: 'Aspect ratio. Default: 1:1',
          default: '1:1',
        },
        resolution: {
          type: 'string',
          enum: ['1K', '2K', '4K'],
          description: 'Output resolution. Default: 1K',
          default: '1K',
        },
        baseImageUrl: {
          type: 'string',
          description: 'URL of a base image for image-to-image generation',
        },
        brandGuidelineId: {
          type: 'string',
          description: 'Brand guideline id to inject brand context into the prompt automatically',
        },
      },
      required: ['promptText'],
    },
  },
  {
    name: 'batch_generate_mockups',
    description:
      'Generate multiple mockup images in parallel. ' +
      'prompts can be an array of strings OR an array of objects { promptText, referenceImages?, baseImage? } ' +
      'to pass per-item reference images (e.g. brand logos). ' +
      'All items share the same model, provider, and output settings. Max 20 per call.',
    inputSchema: {
      type: 'object',
      properties: {
        prompts: {
          type: 'array',
          items: {
            oneOf: [
              { type: 'string' },
              {
                type: 'object',
                properties: {
                  promptText: { type: 'string' },
                  referenceImages: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        url: { type: 'string' },
                        base64: { type: 'string' },
                        mimeType: { type: 'string' },
                      },
                    },
                    description: 'Per-prompt reference images (e.g. brand logo URLs)',
                  },
                  baseImage: { type: 'object', description: 'Per-prompt base image for img2img' },
                },
                required: ['promptText'],
              },
            ],
          },
          description: 'Array of prompts (string) or prompt objects with per-item referenceImages (max 20)',
        },
        provider: {
          type: 'string',
          enum: ['gemini', 'openai', 'seedream'],
          description: 'Image generation provider. Default: openai',
          default: 'openai',
        },
        model: {
          type: 'string',
          description: 'Model name. For openai: gpt-image-1 or gpt-image-2. For gemini: gemini-2.0-flash-exp-image-generation.',
          default: 'gpt-image-2',
        },
        aspectRatio: {
          type: 'string',
          enum: ['1:1', '9:16', '16:9', '4:5'],
          description: 'Aspect ratio for all images. Default: 1:1',
          default: '1:1',
        },
        resolution: {
          type: 'string',
          enum: ['1K', '2K', '4K'],
          description: 'Output resolution for all images. Default: 1K',
          default: '1K',
        },
        brandGuidelineId: {
          type: 'string',
          description: 'Brand guideline id to inject brand context into all prompts automatically',
        },
        baseImageUrl: {
          type: 'string',
          description: 'Optional base image URL applied to all generations (image-to-image)',
        },
      },
      required: ['prompts'],
    },
  },
  {
    name: 'list_public_mockups',
    description: 'List all public/blank mockup templates available in the platform (no auth required).',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'list_mockups',
    description: 'List all mockups for the authenticated user.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'get_mockup',
    description: 'Get a single mockup by ID.',
    inputSchema: {
      type: 'object',
      properties: {
        mockupId: { type: 'string', description: 'Mockup ID' },
      },
      required: ['mockupId'],
    },
  },
  {
    name: 'delete_mockup',
    description: 'Delete a mockup by ID.',
    inputSchema: {
      type: 'object',
      properties: {
        mockupId: { type: 'string', description: 'Mockup ID' },
      },
      required: ['mockupId'],
    },
  },
  {
    name: 'get_mockup_usage_stats',
    description: 'Get mockup generation usage statistics for the current billing period.',
    inputSchema: { type: 'object', properties: {} },
  },
  // ---- Canvas tools ----
  {
    name: 'list_canvas_projects',
    description: 'List all canvas projects for the authenticated user.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'get_canvas_project',
    description: 'Get a canvas project by ID.',
    inputSchema: {
      type: 'object',
      properties: {
        canvasId: { type: 'string', description: 'Canvas project ID' },
      },
      required: ['canvasId'],
    },
  },
  {
    name: 'create_canvas_project',
    description: 'Create a new canvas project.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Project name' },
        data: { type: 'object', description: 'Initial canvas data (nodes, edges, etc.)' },
      },
      required: ['name'],
    },
  },
  {
    name: 'update_canvas_project',
    description: 'Update an existing canvas project.',
    inputSchema: {
      type: 'object',
      properties: {
        canvasId: { type: 'string', description: 'Canvas project ID' },
        data: { type: 'object', description: 'Canvas data to update' },
      },
      required: ['canvasId', 'data'],
    },
  },
  {
    name: 'delete_canvas_project',
    description: 'Delete a canvas project by ID.',
    inputSchema: {
      type: 'object',
      properties: {
        canvasId: { type: 'string', description: 'Canvas project ID' },
      },
      required: ['canvasId'],
    },
  },
  {
    name: 'create_ad_campaign',
    description:
      'Generate a full ad campaign from a product image and brand guidelines. ' +
      'An LLM (GPT-4o) plans N distinct prompts across creative angles (benefit, social proof, urgency, lifestyle, fear, transformation, etc.) ' +
      'then generates all images in parallel using GPT-image-1 or Gemini. ' +
      'Returns a jobId for polling. Use get_campaign_results to check progress.',
    inputSchema: {
      type: 'object',
      properties: {
        productImageUrl: { type: 'string', description: 'URL of the product photo to use as base image' },
        brandGuidelineId: { type: 'string', description: 'Brand guideline id for brand-aware generation' },
        brief: { type: 'string', description: 'Creative brief describing the campaign goal' },
        count: { type: 'number', description: 'Number of ads to generate (1-20)', default: 10 },
        formats: {
          type: 'array',
          items: { type: 'string', enum: ['square', 'story', 'banner', 'portrait'] },
          description: 'Ad formats to generate. Cycles through formats if count > formats.length',
          default: ['square', 'story'],
        },
        model: {
          type: 'string',
          enum: ['gpt-image-1', 'gpt-image-2', 'gemini'],
          description: 'Image generation model',
          default: 'gpt-image-1',
        },
      },
      required: ['productImageUrl'],
    },
  },
  {
    name: 'get_campaign_results',
    description:
      'Poll the status and results of an ad campaign generation job started by create_ad_campaign. ' +
      'Returns status (planning|generating|done|error), progress count, and per-ad results with imageUrl, prompt, adAngle, and format.',
    inputSchema: {
      type: 'object',
      properties: {
        jobId: { type: 'string', description: 'Job id returned by create_ad_campaign' },
      },
      required: ['jobId'],
    },
  },
  {
    name: 'get_brand_design_system',
    description:
      'Get a structured LLM-ready design system context for a brand. Returns colors with semantic roles, ' +
      'typography with intent, spacing/radius tokens, shadows, gradients, motion tokens, and borders — ' +
      'formatted as a concise JSON optimized for AI code generation and design decisions.',
    inputSchema: {
      type: 'object',
      properties: {
        brandId: { type: 'string' },
      },
      required: ['brandId'],
    },
  },
];

// ---------- Tool handlers ----------

type ToolArgs = Record<string, unknown>;

export async function handleTool(name: string, args: ToolArgs) {
  switch (name) {
    case 'create_creative_plan': {
      const body = {
        prompt: args.prompt,
        format: args.format,
        brandId: args.brandId,
        brandContext: args.brandContext,
      };
      const data = await visantFetch('/creative/plan', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      return toolResult(data);
    }
    case 'get_brand_insights': {
      const data = await visantFetch(`/creative/brand/${args.brandId}/insights`);
      return toolResult(data);
    }
    case 'list_creative_events': {
      const params = new URLSearchParams();
      if (args.brandId) params.set('brandId', String(args.brandId));
      if (args.creativeId) params.set('creativeId', String(args.creativeId));
      if (args.limit) params.set('limit', String(args.limit));
      const data = await visantFetch(`/creative/events?${params.toString()}`);
      return toolResult(data);
    }
    case 'get_creative_metrics': {
      const qs = args.brandId ? `?brandId=${args.brandId}` : '';
      const data = await visantFetch(`/creative/events/metrics${qs}`);
      return toolResult(data);
    }
    case 'list_brand_guidelines': {
      const data = await visantFetch('/brand-guidelines');
      return toolResult(data);
    }
    case 'get_brand_guideline': {
      const data = await visantFetch(`/brand-guidelines/${args.brandId}`);
      return toolResult(data);
    }
    case 'update_brand_guideline': {
      const data = await visantFetch(`/brand-guidelines/${args.brandId}`, {
        method: 'PUT',
        body: JSON.stringify(args.data),
      });
      return toolResult(data);
    }
    case 'validate_brand_section': {
      const current = await visantFetch(`/brand-guidelines/${args.brandId}`);
      const guideline = current.guideline || current;
      const validation = { ...(guideline.validation || {}), [args.section as string]: args.state };
      const data = await visantFetch(`/brand-guidelines/${args.brandId}`, {
        method: 'PUT',
        body: JSON.stringify({ validation }),
      });
      return toolResult(data);
    }
    case 'get_brand_design_system': {
      const raw = await visantFetch(`/brand-guidelines/${args.brandId}`);
      const g = raw.guideline || raw;
      const ds = {
        brand: g.identity?.name,
        colors: (g.colors || []).map((c: any) => ({ hex: c.hex, name: c.name, role: c.role })),
        typography: (g.typography || []).map((t: any) => ({
          family: t.family, role: t.role, size: t.size,
          lineHeight: t.lineHeight, letterSpacing: t.letterSpacing, weights: t.weights,
        })),
        tokens: {
          radius: g.tokens?.radius,
          spacing: g.tokens?.spacing,
        },
        gradients: (g.gradients || []).map((gr: any) => ({ name: gr.name, css: gr.css, usage: gr.usage })),
        shadows: (g.shadows || []).map((s: any) => ({ name: s.name, css: s.css, type: s.type })),
        motion: g.motion,
        borders: (g.borders || []).map((b: any) => ({ name: b.name, css: b.css, role: b.role })),
        voice: g.guidelines?.voice,
        philosophy: g.guidelines?.person,
        strategy: g.strategy?.manifesto ? { manifesto: g.strategy.manifesto } : undefined,
        completeness: g.extraction?.completeness,
        validation: g.validation,
      };
      return toolResult(ds);
    }
    // ---- Prompt handlers ----
    case 'improve_prompt': {
      const data = await visantFetch('/ai/improve-prompt', {
        method: 'POST',
        body: JSON.stringify({ prompt: args.prompt }),
      });
      return toolResult(data);
    }
    case 'generate_smart_prompt': {
      const body: Record<string, unknown> = { designType: args.designType };
      if (args.additionalPrompt) body.additionalPrompt = args.additionalPrompt;
      if (args.aspectRatio) body.aspectRatio = args.aspectRatio;
      if (args.brandingTags) body.brandingTags = args.brandingTags;
      if (args.categoryTags) body.categoryTags = args.categoryTags;
      if (args.locationTags) body.locationTags = args.locationTags;
      if (args.angleTags) body.angleTags = args.angleTags;
      if (args.lightingTags) body.lightingTags = args.lightingTags;
      if (args.effectTags) body.effectTags = args.effectTags;
      if (args.materialTags) body.materialTags = args.materialTags;
      if (args.baseImageUrl) body.baseImage = { url: args.baseImageUrl };
      if (args.brandGuidelineId) body.brandGuidelineId = args.brandGuidelineId;
      if (args.negativePrompt) body.negativePrompt = args.negativePrompt;
      const data = await visantFetch('/ai/generate-smart-prompt', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      return toolResult(data);
    }
    case 'suggest_prompt_variations': {
      const data = await visantFetch('/ai/suggest-prompt-variations', {
        method: 'POST',
        body: JSON.stringify({ prompt: args.prompt }),
      });
      return toolResult(data);
    }
    case 'extract_prompt_from_image': {
      const data = await visantFetch('/ai/describe-image', {
        method: 'POST',
        body: JSON.stringify({ image: { url: args.imageUrl, mimeType: args.mimeType ?? 'image/png' } }),
      });
      return toolResult(data);
    }
    case 'extract_colors': {
      const data = await visantFetch('/ai/extract-colors', {
        method: 'POST',
        body: JSON.stringify({ image: { url: args.imageUrl, mimeType: args.mimeType ?? 'image/png' } }),
      });
      return toolResult(data);
    }
    // ---- Brand creative handlers ----
    case 'generate_naming': {
      const data = await visantFetch('/ai/generate-naming', {
        method: 'POST',
        body: JSON.stringify({
          brief: args.brief,
          count: args.count ?? 10,
          style: args.style,
          brandGuidelineId: args.brandGuidelineId,
        }),
      });
      return toolResult(data);
    }
    case 'generate_persona': {
      const data = await visantFetch('/branding/generate-step', {
        method: 'POST',
        body: JSON.stringify({
          step: 10,
          prompt: args.prompt,
          previousData: args.marketResearch ? { marketResearch: args.marketResearch } : undefined,
        }),
      });
      return toolResult(data);
    }
    case 'generate_archetype': {
      const data = await visantFetch('/branding/generate-step', {
        method: 'POST',
        body: JSON.stringify({
          step: 13,
          prompt: args.prompt,
          previousData: args.marketResearch ? { marketResearch: args.marketResearch } : undefined,
        }),
      });
      return toolResult(data);
    }
    case 'generate_concept_ideas': {
      const data = await visantFetch('/branding/generate-step', {
        method: 'POST',
        body: JSON.stringify({ step: 11, prompt: args.prompt, previousData: args.previousData }),
      });
      return toolResult(data);
    }
    case 'generate_color_palettes': {
      const data = await visantFetch('/branding/generate-step', {
        method: 'POST',
        body: JSON.stringify({ step: 8, prompt: args.prompt, previousData: args.previousData }),
      });
      return toolResult(data);
    }
    case 'generate_market_research': {
      const data = await visantFetch('/branding/generate-step', {
        method: 'POST',
        body: JSON.stringify({ step: 1, prompt: args.prompt }),
      });
      return toolResult(data);
    }
    case 'generate_swot': {
      const data = await visantFetch('/branding/generate-step', {
        method: 'POST',
        body: JSON.stringify({ step: 7, prompt: args.prompt, previousData: args.previousData }),
      });
      return toolResult(data);
    }
    case 'generate_moodboard': {
      const data = await visantFetch('/branding/generate-step', {
        method: 'POST',
        body: JSON.stringify({ step: 12, prompt: args.prompt, previousData: args.previousData }),
      });
      return toolResult(data);
    }
    // ---- Mockup handlers ----
    case 'generate_mockup': {
      const body: Record<string, unknown> = {
        promptText: args.promptText,
        provider: args.provider ?? 'openai',
        model: args.model ?? 'gpt-image-2',
        aspectRatio: args.aspectRatio ?? '1:1',
        resolution: args.resolution ?? '1K',
      };
      if (args.baseImageUrl) body.baseImage = { url: args.baseImageUrl };
      if (args.brandGuidelineId) body.brandGuidelineId = args.brandGuidelineId;
      const data = await visantFetch('/mockups/generate', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      return toolResult(data);
    }
    case 'batch_generate_mockups': {
      const body: Record<string, unknown> = {
        prompts: args.prompts,
        provider: args.provider ?? 'openai',
        model: args.model ?? 'gpt-image-2',
        aspectRatio: args.aspectRatio ?? '1:1',
        resolution: args.resolution ?? '1K',
      };
      if (args.brandGuidelineId) body.brandGuidelineId = args.brandGuidelineId;
      if (args.baseImageUrl) body.baseImage = { url: args.baseImageUrl };
      const data = await visantFetch('/mockups/batch-generate', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      return toolResult(data);
    }
    case 'list_public_mockups': {
      const data = await visantFetch('/mockups/public');
      return toolResult(data);
    }
    case 'list_mockups': {
      const data = await visantFetch('/mockups');
      return toolResult(data);
    }
    case 'get_mockup': {
      const data = await visantFetch(`/mockups/${args.mockupId}`);
      return toolResult(data);
    }
    case 'delete_mockup': {
      const data = await visantFetch(`/mockups/${args.mockupId}`, { method: 'DELETE' });
      return toolResult(data);
    }
    case 'get_mockup_usage_stats': {
      const data = await visantFetch('/mockups/usage/stats');
      return toolResult(data);
    }
    // ---- Canvas handlers ----
    case 'list_canvas_projects': {
      const data = await visantFetch('/canvas');
      return toolResult(data);
    }
    case 'get_canvas_project': {
      const data = await visantFetch(`/canvas/${args.canvasId}`);
      return toolResult(data);
    }
    case 'create_canvas_project': {
      const data = await visantFetch('/canvas', {
        method: 'POST',
        body: JSON.stringify({ name: args.name, data: args.data }),
      });
      return toolResult(data);
    }
    case 'update_canvas_project': {
      const data = await visantFetch(`/canvas/${args.canvasId}`, {
        method: 'PUT',
        body: JSON.stringify(args.data),
      });
      return toolResult(data);
    }
    case 'delete_canvas_project': {
      const data = await visantFetch(`/canvas/${args.canvasId}`, { method: 'DELETE' });
      return toolResult(data);
    }
    case 'create_ad_campaign': {
      const body = {
        productImageUrl: args.productImageUrl,
        brandGuidelineId: args.brandGuidelineId,
        brief: args.brief,
        count: args.count ?? 10,
        formats: args.formats ?? ['square', 'story'],
        model: args.model ?? 'gpt-image-1',
      };
      const data = await visantFetch('/canvas/generate-campaign', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      return toolResult(data);
    }
    case 'get_campaign_results': {
      const data = await visantFetch(`/canvas/generate-campaign/${args.jobId}`);
      return toolResult(data);
    }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
