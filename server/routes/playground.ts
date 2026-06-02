import { Router } from 'express';
import { GoogleGenAI } from '@google/genai';
import { authenticate, type AuthRequest } from '../middleware/auth.js';
import { prisma } from '../db/prisma.js';
import type { Prisma } from '@prisma/client';
import { GEMINI_MODELS } from '../../src/constants/geminiModels.js';
import { sanitizeForPrompt } from '../utils/promptSanitize.js';
import { chargeCredits, refundCredits } from '../lib/credits.js';
import { PLAYGROUND_SYSTEM_PROMPT, PLAYGROUND_ITERATE_PROMPT } from '../lib/playground-prompts.js';
import { rateLimit } from 'express-rate-limit';
import { isValidObjectId } from '../utils/validation.js';
import crypto from 'crypto';

const router = Router();

function validateId(id: string): boolean {
  return isValidObjectId(id);
}

const getAI = () => new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

const playgroundRateLimit = rateLimit({
  windowMs: 60_000,
  max: 30,
  message: { error: 'Too many requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const generateSlug = (title: string) =>
  title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '')
  + '-' + crypto.randomBytes(3).toString('hex');

// ─── Catalog prompt (generated from component descriptions) ─────────────
// This is a simplified version; in production, use catalog.prompt() from json-render
const CATALOG_PROMPT = `
## Available Components

### Layout
- PageShell: Page wrapper with padding and optional title. Props: { title?: string }
- GlassPanel: Glassmorphism container with backdrop blur. Props: {}
- Stack: Flex stack layout. Props: { direction?: "horizontal"|"vertical", gap?: number, align?: "start"|"center"|"end"|"stretch" }
- Grid: CSS grid layout. Props: { cols?: 1-6, gap?: number }
- Separator: Visual divider. Props: { orientation?: "horizontal"|"vertical" }

### Tool Panel Family (for tool-style apps with sidebar controls)
- ToolPanel: Glass panel container (wrap children in ToolPanelHeader + ToolPanelContent)
- ToolPanelHeader: Header with bottom border
- ToolPanelContent: Scrollable content area
- ToolPanelSection: Titled section (10px mono uppercase label). Props: { title: string }
- ToolPanelDisclosure: Collapsible section. Props: { label: string, defaultOpen?: boolean }
- ToolPanelGrid: Grid for chips (2-5 cols). Props: { cols?: number }
- ToolPanelChip: Pill toggle button. Props: { active?: boolean, label: string }
- ToolPanelRow: Label + value row. Props: { label: string }

### Inputs & Controls
- NodeSlider: Slider with scrub label. Props: { label: string, value: number, min: number, max: number, step?: number, hint?: string }
- ScrubInput: Compact numeric input. Props: { label: string, value: number, min: number, max: number, suffix?: string }
- InlineColorPicker: Color input + hex. Props: { label: string, value: string }
- Button: 7 variants. Props: { variant?: "default"|"brand"|"surface"|"subtle"|"danger"|"outline"|"ghost", size?: "default"|"sm"|"xs"|"lg"|"icon", disabled?: boolean }
- Switch: Toggle. Props: { checked?: boolean, label?: string }
- Input: Text input. Props: { placeholder?: string, type?: "text"|"number"|"email"|"url" }
- Textarea: Multi-line input. Props: { placeholder?: string, rows?: number }

### Image
- ImageUploader: Full-area drag-drop uploader
- ImageThumbnail: Thumbnail with badge. Props: { src: string, index?: number }

### Data Display
- Card: Card container. Props: { title?: string, description?: string }
- Badge: Status label. Props: { variant?: "default"|"secondary"|"destructive"|"outline", label: string }
- Tabs: Tab navigation. Props: { tabs: [{value, label}], defaultValue?: string }
- Metric: KPI card. Props: { label: string, value: string, change?: string, trend?: "up"|"down"|"neutral" }

### Charts (Recharts)
- BarChart: Props: { data: object[], dataKey: string, xAxisKey: string, color?: string, height?: number }
- LineChart: Props: { data: object[], dataKey: string, xAxisKey: string, color?: string, height?: number }
- PieChart: Props: { data: [{name, value}], height?: number }

### Text
- Heading: Props: { level?: 1-6, text: string }
- Text: Props: { variant?: "body"|"label"|"caption"|"mono", color?: "default"|"muted"|"brand"|"danger", text: string }
- MicroTitle: Small uppercase title. Props: { text: string }

### Feedback
- GlitchLoader: Animated loader. Props: { size?: "sm"|"md"|"lg" }
- SkeletonLoader: Shimmer placeholder. Props: { variant?: "text"|"circular"|"rectangular", width?: string, height?: string }
- EmptyState: Empty state. Props: { title: string, description?: string, icon?: string }

## Available Actions (Visant API)
- generateMockup: { prompt: string, brandGuidelineId?: string, referenceImages?: string[] }
- generateImage: { prompt: string, aspectRatio?: string }
- extractColors: { imageUrl: string }
- generateNaming: { context: string, style?: string, count?: number }
- describeImage: { imageUrl: string }
- complianceCheck: { brandGuidelineId: string, imageUrl: string }
- uploadImage: { base64: string }
- getBrand: { brandGuidelineId: string }
- copyToClipboard: { text: string }
- downloadFile: { url: string, filename?: string }
`;

// ─── POST /generate — SSE streaming spec generation ─────────────────────
router.post('/generate', playgroundRateLimit, authenticate, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: 'Unauthorized' });

  const { prompt, brandContext, model } = req.body as {
    prompt: string;
    brandContext?: string;
    model?: string;
  };

  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'prompt required' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = (event: string, data: unknown) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  let credited = false;
  try {
    send('status', { message: 'Composing your app...' });

    await chargeCredits(req.userId!, 1);
    credited = true;

    const systemInstruction = PLAYGROUND_SYSTEM_PROMPT + CATALOG_PROMPT +
      (brandContext ? `\n\n## User Brand Context\n${sanitizeForPrompt(brandContext)}` : '');

    const selectedModel = model && Object.values(GEMINI_MODELS).includes(model as any)
      ? model
      : GEMINI_MODELS.TEXT;

    const result = await getAI().models.generateContent({
      model: selectedModel,
      config: {
        systemInstruction,
        temperature: 0.3,
      },
      contents: [{ role: 'user', parts: [{ text: sanitizeForPrompt(prompt) }] }],
    });

    const raw = (result.text ?? '').trim();
    const cleaned = raw
      .replace(/^```json\s*/m, '')
      .replace(/^```\s*/m, '')
      .replace(/\s*```$/m, '')
      .trim();

    let spec: Record<string, unknown>;
    let meta: Record<string, unknown> = {};

    try {
      const parsed = JSON.parse(cleaned);
      if (parsed.root && parsed.elements) {
        meta = parsed.meta || {};
        spec = { root: parsed.root, elements: parsed.elements };
      } else {
        await refundCredits(req.userId!, 1).catch(() => {});
        send('error', { message: 'Invalid spec generated. Try rephrasing your prompt.' });
        return res.end();
      }
    } catch {
      await refundCredits(req.userId!, 1).catch(() => {});
      send('error', { message: 'Failed to parse response. Try a simpler prompt.' });
      return res.end();
    }

    send('spec', { spec, meta });
    send('complete', { message: 'Done!' });
  } catch (err: any) {
    console.error('[playground/generate]', err);
    if (credited && !err?.message?.includes('Insufficient credits')) {
      await refundCredits(req.userId!, 1).catch(() => {});
    }
    send('error', { message: err?.message?.includes('Insufficient credits')
      ? 'Insufficient credits'
      : 'Generation failed. Please try again.' });
  } finally {
    res.end();
  }
});

// ─── POST /iterate — Refine existing spec ───────────────────────────────
router.post('/iterate', playgroundRateLimit, authenticate, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: 'Unauthorized' });

  const { prompt, currentSpec, model } = req.body as {
    prompt: string;
    currentSpec: Record<string, unknown>;
    model?: string;
  };

  if (!prompt || !currentSpec) {
    return res.status(400).json({ error: 'prompt and currentSpec required' });
  }

  if (JSON.stringify(currentSpec).length > 50_000) {
    return res.status(413).json({ error: 'Spec too large (max 50KB)' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = (event: string, data: unknown) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  let credited = false;
  try {
    send('status', { message: 'Updating your app...' });

    await chargeCredits(req.userId!, 1);
    credited = true;

    const systemInstruction = PLAYGROUND_ITERATE_PROMPT +
      JSON.stringify(currentSpec, null, 2) +
      '\n\n' + CATALOG_PROMPT;

    const selectedModel = model && Object.values(GEMINI_MODELS).includes(model as any)
      ? model
      : GEMINI_MODELS.TEXT;

    const result = await getAI().models.generateContent({
      model: selectedModel,
      config: { systemInstruction, temperature: 0.3 },
      contents: [{ role: 'user', parts: [{ text: sanitizeForPrompt(prompt) }] }],
    });

    const raw = (result.text ?? '').trim();
    const cleaned = raw.replace(/^```json\s*/m, '').replace(/^```\s*/m, '').replace(/\s*```$/m, '').trim();

    try {
      const parsed = JSON.parse(cleaned);
      if (parsed.root && parsed.elements) {
        const meta = parsed.meta || {};
        send('spec', { spec: { root: parsed.root, elements: parsed.elements }, meta });
        send('complete', { message: 'Updated!' });
      } else {
        await refundCredits(req.userId!, 1).catch(() => {});
        send('error', { message: 'Invalid spec. Try again.' });
      }
    } catch {
      await refundCredits(req.userId!, 1).catch(() => {});
      send('error', { message: 'Failed to parse. Try a simpler request.' });
    }
  } catch (err: any) {
    console.error('[playground/iterate]', err);
    if (credited) await refundCredits(req.userId!, 1).catch(() => {});
    send('error', { message: 'Update failed.' });
  } finally {
    res.end();
  }
});

// ─── POST /quickstart — Generate + Save + Share in one call ────────────
router.post('/quickstart', playgroundRateLimit, authenticate, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: 'Unauthorized' });

  const { prompt, title, description, tags, category, brandGuidelineId } = req.body as {
    prompt: string;
    title?: string;
    description?: string;
    tags?: string[];
    category?: string;
    brandGuidelineId?: string;
  };

  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'prompt required' });
  }

  let credited = false;
  try {
    await chargeCredits(req.userId!, 1);
    credited = true;

    let brandContext = '';
    if (brandGuidelineId) {
      const brand = await prisma.brandGuideline.findFirst({
        where: { id: brandGuidelineId, userId: req.userId },
      });
      if (brand) {
        const parts: string[] = [];
        const b = brand as any;
        if (b.name) parts.push(`Brand: ${b.name}`);
        if (b.data?.colors) parts.push(`Colors: ${JSON.stringify(b.data.colors)}`);
        if (b.data?.fonts) parts.push(`Fonts: ${JSON.stringify(b.data.fonts)}`);
        brandContext = parts.join('\n');
      }
    }

    const systemInstruction = PLAYGROUND_SYSTEM_PROMPT + CATALOG_PROMPT +
      (brandContext ? `\n\n## User Brand Context\n${brandContext}` : '');

    const result = await getAI().models.generateContent({
      model: GEMINI_MODELS.TEXT,
      config: { systemInstruction, temperature: 0.3 },
      contents: [{ role: 'user', parts: [{ text: sanitizeForPrompt(prompt) }] }],
    });

    const raw = (result.text ?? '').trim();
    const cleaned = raw.replace(/^```json\s*/m, '').replace(/^```\s*/m, '').replace(/\s*```$/m, '').trim();

    let spec: Record<string, unknown>;
    let meta: Record<string, unknown> = {};

    try {
      const parsed = JSON.parse(cleaned);
      if (!parsed.root || !parsed.elements) {
        await refundCredits(req.userId!, 1).catch(() => {});
        return res.status(422).json({ error: 'Invalid spec generated. Try rephrasing.' });
      }
      meta = parsed.meta || {};
      spec = { root: parsed.root, elements: parsed.elements };
    } catch {
      await refundCredits(req.userId!, 1).catch(() => {});
      return res.status(422).json({ error: 'Failed to parse generated spec.' });
    }

    const appTitle = title || (meta as any).title || 'Untitled MiniApp';
    const shareId = crypto.randomBytes(16).toString('hex');

    const miniApp = await prisma.miniApp.create({
      data: {
        userId: req.userId,
        slug: generateSlug(appTitle),
        title: appTitle,
        description: description || (meta as any).description || '',
        tags: tags || (meta as any).tags || [],
        category: category || 'utility',
        spec: spec as Prisma.InputJsonValue,
        actionsUsed: (meta as any).actionsUsed || [],
        shareId,
      },
    });

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || '';
    res.json({
      miniApp,
      spec,
      meta,
      shareUrl: `${baseUrl}/playground/shared/${shareId}`,
      editUrl: `${baseUrl}/playground/${miniApp.slug}`,
    });
  } catch (err: any) {
    console.error('[playground/quickstart]', err);
    if (credited && !err?.message?.includes('Insufficient credits')) {
      await refundCredits(req.userId!, 1).catch(() => {});
    }
    res.status(500).json({
      error: err?.message?.includes('Insufficient credits')
        ? 'Insufficient credits'
        : 'Quickstart failed',
    });
  }
});

// ─── POST / — Save miniapp (draft) ─────────────────────────────────────
router.post('/', authenticate, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: 'Unauthorized' });

  const { title, description, tags, category, spec, stateDefaults, actionsUsed, thumbnail } = req.body;

  if (!title || !spec) {
    return res.status(400).json({ error: 'title and spec required' });
  }

  if (!spec.root || !spec.elements) {
    return res.status(400).json({ error: 'spec must have root and elements fields' });
  }

  if (JSON.stringify(spec).length > 500_000) {
    return res.status(413).json({ error: 'Spec too large (max 500KB)' });
  }

  try {
    const miniApp = await prisma.miniApp.create({
      data: {
        userId: req.userId,
        slug: generateSlug(title),
        title,
        description: description || '',
        tags: tags || [],
        category: category || 'utility',
        spec,
        stateDefaults: stateDefaults || undefined,
        actionsUsed: actionsUsed || [],
        thumbnail: thumbnail || undefined,
      },
    });

    res.json({ miniApp });
  } catch (err) {
    console.error('[playground/save]', err);
    res.status(500).json({ error: 'Failed to save' });
  }
});

// ─── PUT /:id — Update miniapp ──────────────────────────────────────────
router.put('/:id', authenticate, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: 'Unauthorized' });

  const { id } = req.params;
  if (!validateId(id)) return res.status(400).json({ error: 'Invalid id' });
  const updates = req.body;

  try {
    const existing = await prisma.miniApp.findUnique({ where: { id } });
    if (!existing || existing.userId !== req.userId) {
      return res.status(404).json({ error: 'Not found' });
    }

    const miniApp = await prisma.miniApp.update({
      where: { id },
      data: {
        title: updates.title,
        description: updates.description,
        tags: updates.tags,
        category: updates.category,
        spec: updates.spec,
        stateDefaults: updates.stateDefaults,
        actionsUsed: updates.actionsUsed,
        thumbnail: updates.thumbnail,
      },
    });

    res.json({ miniApp });
  } catch (err) {
    console.error('[playground/update]', err);
    res.status(500).json({ error: 'Failed to update' });
  }
});

// ─── DELETE /:id ─────────────────────────────────────────────────────────
router.delete('/:id', authenticate, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: 'Unauthorized' });

  const { id } = req.params;
  if (!validateId(id)) return res.status(400).json({ error: 'Invalid id' });

  try {
    const existing = await prisma.miniApp.findUnique({ where: { id } });
    if (!existing || existing.userId !== req.userId) {
      return res.status(404).json({ error: 'Not found' });
    }

    await prisma.miniApp.delete({ where: { id } });
    res.json({ success: true });
  } catch (err) {
    console.error('[playground/delete]', err);
    res.status(500).json({ error: 'Failed to delete' });
  }
});

// ─── GET /my — User's miniapps ──────────────────────────────────────────
router.get('/my', authenticate, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const miniApps = await prisma.miniApp.findMany({
      where: { userId: req.userId },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true, slug: true, title: true, description: true,
        tags: true, category: true, thumbnail: true,
        likesCount: true, forksCount: true, viewsCount: true,
        isPublished: true, createdAt: true, updatedAt: true,
      },
    });

    res.json({ miniApps });
  } catch (err) {
    console.error('[playground/my]', err);
    res.status(500).json({ error: 'Failed to fetch' });
  }
});

// ─── GET /feed — Community feed ─────────────────────────────────────────
router.get('/feed', async (req, res) => {
  const { category, sort = 'newest', search, skip = '0', take = '20' } = req.query as Record<string, string>;

  try {
    const where: Record<string, unknown> = { isPublished: true };
    if (category) where.category = category;
    if (search) where.title = { contains: search, mode: 'insensitive' };

    const orderBy = sort === 'likes' ? { likesCount: 'desc' as const }
      : sort === 'popular' ? { viewsCount: 'desc' as const }
      : { createdAt: 'desc' as const };

    const [miniApps, total] = await Promise.all([
      prisma.miniApp.findMany({
        where,
        orderBy,
        skip: parseInt(skip),
        take: Math.min(parseInt(take), 50),
        select: {
          id: true, slug: true, title: true, description: true,
          tags: true, category: true, thumbnail: true,
          likesCount: true, forksCount: true, viewsCount: true,
          userId: true, createdAt: true,
        },
      }),
      prisma.miniApp.count({ where }),
    ]);

    res.json({ miniApps, total });
  } catch (err) {
    console.error('[playground/feed]', err);
    res.status(500).json({ error: 'Failed to fetch feed' });
  }
});

// ─── GET /shared/:shareId — Public access (MUST be before /:slug) ──────
router.get('/shared/:shareId', async (req, res) => {
  try {
    const miniApp = await prisma.miniApp.findFirst({
      where: { shareId: req.params.shareId },
    });
    if (!miniApp) return res.status(404).json({ error: 'Not found' });

    res.json({ miniApp });
  } catch (err) {
    console.error('[playground/shared]', err);
    res.status(500).json({ error: 'Failed to fetch' });
  }
});

// ─── GET /:slug — Get miniapp by slug ───────────────────────────────────
router.get('/:slug', async (req, res) => {
  const { slug } = req.params;

  try {
    const miniApp = await prisma.miniApp.findUnique({ where: { slug } });
    if (!miniApp) return res.status(404).json({ error: 'Not found' });

    await prisma.miniApp.update({
      where: { id: miniApp.id },
      data: { viewsCount: { increment: 1 } },
    });

    res.json({ miniApp });
  } catch (err) {
    console.error('[playground/get]', err);
    res.status(500).json({ error: 'Failed to fetch' });
  }
});

// ─── POST /:id/publish — Publish to community ──────────────────────────
router.post('/:id/publish', authenticate, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: 'Unauthorized' });
  if (!validateId(req.params.id)) return res.status(400).json({ error: 'Invalid id' });

  try {
    const existing = await prisma.miniApp.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.userId !== req.userId) {
      return res.status(404).json({ error: 'Not found' });
    }

    const miniApp = await prisma.miniApp.update({
      where: { id: req.params.id },
      data: { isPublished: true },
    });

    res.json({ miniApp });
  } catch (err) {
    console.error('[playground/publish]', err);
    res.status(500).json({ error: 'Failed to publish' });
  }
});

// ─── POST /:id/fork — Fork a miniapp ───────────────────────────────────
router.post('/:id/fork', authenticate, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: 'Unauthorized' });
  if (!validateId(req.params.id)) return res.status(400).json({ error: 'Invalid id' });

  try {
    const original = await prisma.miniApp.findUnique({ where: { id: req.params.id } });
    if (!original) return res.status(404).json({ error: 'Not found' });

    const [fork] = await Promise.all([
      prisma.miniApp.create({
        data: {
          userId: req.userId,
          slug: generateSlug(original.title + ' fork'),
          title: original.title,
          description: original.description,
          tags: original.tags,
          category: original.category,
          spec: original.spec as any,
          stateDefaults: original.stateDefaults as any ?? undefined,
          actionsUsed: original.actionsUsed,
          forkedFromId: original.id,
        },
      }),
      prisma.miniApp.update({
        where: { id: original.id },
        data: { forksCount: { increment: 1 } },
      }),
    ]);

    res.json({ miniApp: fork });
  } catch (err) {
    console.error('[playground/fork]', err);
    res.status(500).json({ error: 'Failed to fork' });
  }
});

// ─── POST /:id/like — Toggle like ──────────────────────────────────────
router.post('/:id/like', authenticate, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: 'Unauthorized' });
  if (!validateId(req.params.id)) return res.status(400).json({ error: 'Invalid id' });

  const miniAppId = req.params.id;

  try {
    const existing = await prisma.miniAppLike.findUnique({
      where: { miniAppId_userId: { miniAppId, userId: req.userId } },
    });

    if (existing) {
      await Promise.all([
        prisma.miniAppLike.delete({ where: { id: existing.id } }),
        prisma.miniApp.update({ where: { id: miniAppId }, data: { likesCount: { decrement: 1 } } }),
      ]);
      res.json({ liked: false });
    } else {
      await Promise.all([
        prisma.miniAppLike.create({ data: { miniAppId, userId: req.userId } }),
        prisma.miniApp.update({ where: { id: miniAppId }, data: { likesCount: { increment: 1 } } }),
      ]);
      res.json({ liked: true });
    }
  } catch (err) {
    console.error('[playground/like]', err);
    res.status(500).json({ error: 'Failed to toggle like' });
  }
});

// ─── POST /:id/share — Generate share link ─────────────────────────────
router.post('/:id/share', authenticate, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: 'Unauthorized' });
  if (!validateId(req.params.id)) return res.status(400).json({ error: 'Invalid id' });

  try {
    const existing = await prisma.miniApp.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.userId !== req.userId) {
      return res.status(404).json({ error: 'Not found' });
    }

    const shareId = existing.shareId || crypto.randomBytes(16).toString('hex');

    const miniApp = await prisma.miniApp.update({
      where: { id: req.params.id },
      data: { shareId },
    });

    res.json({ shareId: miniApp.shareId, shareUrl: `/playground/shared/${miniApp.shareId}` });
  } catch (err) {
    console.error('[playground/share]', err);
    res.status(500).json({ error: 'Failed to generate share link' });
  }
});

// ─── API Proxy — Secure gateway for miniapp actions ─────────────────────

const ALLOWED_PROXY_ENDPOINTS = new Set([
  // Image & Generation
  '/mockup/generate',
  '/ai/generate-image',
  '/ai/extract-colors',
  '/ai/generate-naming',
  '/ai/describe-image',
  '/ai/suggest-prompt-variations',
  '/ai/improve-prompt',
  // Brand (read-only)
  '/brand-guidelines/compliance-check',
  // Upload
  '/community/upload-image',
]);

const proxyRateLimit = rateLimit({
  windowMs: 60_000,
  max: 30,
  message: { error: 'Too many API calls. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.all('/proxy/*', proxyRateLimit, authenticate, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: 'Unauthorized' });

  const proxyPath = '/' + (req.params as any)[0];

  if (!ALLOWED_PROXY_ENDPOINTS.has(proxyPath)) {
    return res.status(403).json({ error: `Endpoint ${proxyPath} not allowed for playground` });
  }

  try {
    const internalUrl = `${req.protocol}://${req.get('host')}/api${proxyPath}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': req.headers.authorization || '',
    };

    const proxyRes = await fetch(internalUrl, {
      method: req.method,
      headers,
      body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined,
    });

    const data = await proxyRes.json();
    res.status(proxyRes.status).json(data);
  } catch (err) {
    console.error('[playground/proxy]', proxyPath, err);
    res.status(500).json({ error: 'Proxy request failed' });
  }
});

// ─── Brand context helper for generation ────────────────────────────────
router.get('/brand-context/:guidelineId', authenticate, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const internalUrl = `${req.protocol}://${req.get('host')}/api/brand-guidelines/${req.params.guidelineId}`;
    const brandRes = await fetch(internalUrl, {
      headers: { 'Authorization': req.headers.authorization || '' },
    });

    if (!brandRes.ok) return res.status(404).json({ error: 'Brand not found' });

    const brand = await brandRes.json();

    const context = [
      brand.brandName && `Brand: ${brand.brandName}`,
      brand.colors?.length && `Colors: ${brand.colors.map((c: any) => c.hex || c.value).join(', ')}`,
      brand.typography?.primary && `Primary font: ${brand.typography.primary}`,
      brand.logoUrl && `Logo URL: ${brand.logoUrl}`,
      brand.tagline && `Tagline: ${brand.tagline}`,
    ].filter(Boolean).join('\n');

    res.json({ context, brandName: brand.brandName });
  } catch (err) {
    console.error('[playground/brand-context]', err);
    res.status(500).json({ error: 'Failed to fetch brand context' });
  }
});

export default router;
