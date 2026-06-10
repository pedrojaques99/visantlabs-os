import { Router } from 'express';
import { GoogleGenAI } from '@google/genai';
import { authenticate, type AuthRequest } from '../middleware/auth.js';
import { prisma } from '../db/prisma.js';
import type { Prisma } from '@prisma/client';
import { GEMINI_MODELS } from '../../src/constants/geminiModels.js';
import { sanitizeForPrompt } from '../utils/promptSanitize.js';
import { chargeCredits, refundCreditsWithRetry as refundCredits } from '../lib/credits.js';
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
  title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '') +
  '-' +
  crypto.randomBytes(3).toString('hex');

// ─── Catalog prompt (generated from component descriptions) ─────────────
// This is a simplified version; in production, use catalog.prompt() from json-render
const CATALOG_PROMPT = `
## Available Components

### Layout
- PageShell: Page wrapper. Props: { title?: string }
- GlassPanel: Glass container with backdrop blur. Props: { className?: string, style?: object }. Use style with $state for dynamic backgroundColor.
- Stack: Flex layout. Props: { direction?: "horizontal"|"vertical", gap?: number, align?: "start"|"center"|"end"|"stretch" }
- Grid: CSS grid. Props: { cols?: 1-6, gap?: number }
- Separator: Divider. Props: { orientation?: "horizontal"|"vertical" }

### Tool Panel Family (sidebar controls)
- ToolPanel → ToolPanelHeader + ToolPanelContent
- ToolPanelSection: Titled section. Props: { title: string }
- ToolPanelDisclosure: Collapsible. Props: { label: string, defaultOpen?: boolean }
- ToolPanelGrid: Chip grid. Props: { cols?: 2-5 }
- ToolPanelChip: Toggle pill. Props: { active: $bindState, label: string }. MUST use $bindState on active.
- ToolPanelRow: Label+value row. Props: { label: string }

### Inputs (ALL MUST use $bindState)
- NodeSlider: Props: { label, value: $bindState, min, max, step?, hint? }
- ScrubInput: Props: { label, value: $bindState, min, max, suffix? }
- InlineColorPicker: Props: { label, value: $bindState }. Output must be read via $state on style.color or style.backgroundColor.
- Switch: Props: { checked: $bindState, label? }. Use to toggle visibility of sections.
- Input: Props: { placeholder?, type?, value: $bindState }. MUST use $bindState on value for text input.
- Textarea: Props: { placeholder?, rows?, value: $bindState }. MUST use $bindState on value for text input.

### Buttons (MUST have "on" handler)
- Button: Props: { variant?: "default"|"brand"|"surface"|"subtle"|"danger"|"outline"|"ghost", size?, disabled? }
  Always add: "on": { "press": { "action": "...", "params": { ... } } }

### Image
- ImageUploader: Drag-drop upload area
- ImageThumbnail: Preview image. Props: { src: string, index?: number }

### Data Display
- Card: Container. Props: { title?, description? }
- Badge: Label. Props: { variant?: "default"|"secondary"|"destructive"|"outline", label: string }
- Tabs: Navigation. Props: { tabs: [{value, label}], defaultValue? }
- Metric: KPI. Props: { label, value, change?, trend?: "up"|"down"|"neutral" }

### Charts
- BarChart: Props: { data: object[], dataKey, xAxisKey, color?, height? }
- LineChart: Props: { data: object[], dataKey, xAxisKey, color?, height? }
- PieChart: Props: { data: [{name, value}], height? }

### Text (accept style prop for dynamic CSS)
- Heading: Props: { level?: 1-6, text: string, style?: object }. style supports: fontSize, fontFamily, fontWeight, color, letterSpacing via $state.
- Text: Props: { variant?, color?, text: string, style?: object }. Same style support.
- MicroTitle: Props: { text: string }

### Feedback
- GlitchLoader: Loading spinner. Props: { size?: "sm"|"md"|"lg" }
- SkeletonLoader: Placeholder. Props: { variant?, width?, height? }
- EmptyState: Empty state. Props: { title, description?, icon? }

### Power Components (Visual Engines)
- ShaderPreview: WebGL shader effect on image. Props: { imageUrl, shaderType: $bindState, params?: $bindState, width?, height? }
  shaderType options: "halftone"|"vhs"|"ascii"|"matrixDither"|"dither"|"duotone"|"filmGrain"|"pixelate"|"posterize"|"chromaticAberration"|"crtScanlines"|"edgeDetect"|"glitch"
  params object keys depend on shaderType (e.g. halftone: dotSize, angle, contrast, spacing)
- Scene3D: Interactive 3D scene. Props: { mode?: "text"|"shape", input?: string, shape?: "coin"|"badge"|"stamp"|"shield"|"hexagon"|"pendant", material?: $bindState, color?: $bindState, animation?: $bindState ("none"|"spin"|"float"|"pulse"|"wobble"), depth?, width?, height? }
  Material presets: default, plastic, metal, glass, rubber, chrome, gold, clay, emissive, holographic, brushedSteel, copper, marble, wood, concrete, ceramic, crystal, neon, etc.
- VideoPlayer: Video playback. Props: { src: $bindState, autoPlay?, loop?, controls?, muted?, poster?, width?, height? }
- ImageCanvas: 2D canvas compositing. Props: { width?, height?, layers?: $bindState }
  Layer object: { type: "image"|"text"|"rect"|"circle", x?, y?, width?, height?, src?, text?, fontSize?, fontFamily?, fill?, stroke?, strokeWidth?, rotation?, opacity?, radius? }
- HalftonePreview: Dedicated halftone renderer. Props: { imageUrl, variant?: "ellipse"|"square"|"lines", dotSize?: $bindState, angle?: $bindState, contrast?: $bindState, spacing?, threshold?, invert?, width?, height? }
- RisoPreview: Riso 2-color print simulator. Props: { imageUrl, color1?: $bindState, color2?: $bindState, halftoneAngle1?, halftoneAngle2?, dotSize?, paperColor?, blendMode?, width?, height? }
- MoodboardGrid: Image collection layout. Props: { images: [{src, alt?, span?}], layout?: "bento"|"masonry"|"grid", columns?, gap?, aspectRatio? }

## Available Actions (Visant API)
- generateMockup: { prompt, brandGuidelineId?, referenceImages? } — Generate product mockup
- generateImage: { prompt, aspectRatio? } — Generate image from text
- extractColors: { imageUrl } — Extract palette from image
- generateNaming: { context, style?, count? } — Generate brand names
- describeImage: { imageUrl } — AI description of image
- complianceCheck: { brandGuidelineId, imageUrl } — Check brand compliance
- uploadImage: { base64 } — Upload image, get URL
- getBrand: { brandGuidelineId } — Fetch brand data
- copyToClipboard: { text } — Copy to clipboard
- downloadFile: { url, filename? } — Download file
- generateVideo: { prompt, startFrame?, aspectRatio?, duration?, model? } — Generate video from prompt/image. Returns { videoUrl }
- applyShader: { imageUrl, shaderType, params? } — Apply shader effect client-side. Returns { resultBase64 }
- detectGrid: { imageBase64 } — Detect grid layout in image. Returns { boxes }
- upscaleImage: { imageBase64, size?: "1K"|"2K"|"4K" } — Upscale image resolution. Returns { upscaledBase64 }

Action params can use $state: { "context": { "$state": "/userInput" } }

## FULL WORKING EXAMPLE — Standard Tool-style App
This is the EXACT structure every app should follow. Copy this pattern.

\`\`\`json
{
  "stateDefaults": { "bgColor": "#1a1a2e", "textColor": "#e0e0e0", "fontSize": 24 },
  "root": "page",
  "elements": {
    "page": { "type": "PageShell", "props": { "title": "Color Tester" }, "children": ["layout"] },
    "layout": { "type": "Stack", "props": { "direction": "horizontal", "gap": 6 }, "children": ["preview", "panel"] },

    "preview": { "type": "GlassPanel", "props": { "className": "flex-1 p-6 min-h-[300px]" }, "children": ["sample"] },
    "sample": { "type": "Heading", "props": { "text": "Sample Text", "style": { "fontSize": { "$state": "/fontSize" }, "color": { "$state": "/textColor" } } } },

    "panel": { "type": "ToolPanel", "props": {}, "children": ["panel-header", "panel-content"] },
    "panel-header": { "type": "ToolPanelHeader", "props": {}, "children": ["panel-title"] },
    "panel-title": { "type": "Heading", "props": { "level": 4, "text": "Controls" } },
    "panel-content": { "type": "ToolPanelContent", "props": {}, "children": ["sec-color", "sec-size", "sec-export"] },

    "sec-color": { "type": "ToolPanelSection", "props": { "title": "COLORS" }, "children": ["pick-bg", "pick-text"] },
    "pick-bg": { "type": "InlineColorPicker", "props": { "label": "Background", "value": { "$bindState": "/bgColor" } } },
    "pick-text": { "type": "InlineColorPicker", "props": { "label": "Text", "value": { "$bindState": "/textColor" } } },

    "sec-size": { "type": "ToolPanelSection", "props": { "title": "SIZE" }, "children": ["slider-font"] },
    "slider-font": { "type": "NodeSlider", "props": { "label": "Font Size", "value": { "$bindState": "/fontSize" }, "min": 12, "max": 72, "step": 1, "hint": "px" } },

    "sec-export": { "type": "ToolPanelSection", "props": { "title": "EXPORT" }, "children": ["btn-copy"] },
    "btn-copy": { "type": "Button", "props": { "variant": "brand", "size": "default" }, "children": ["btn-label"], "on": { "press": { "action": "copyToClipboard", "params": { "text": "color values copied" } } } },
    "btn-label": { "type": "Text", "props": { "text": "Copy CSS", "variant": "body" } }
  },
  "meta": { "title": "Color Tester", "description": "Test colors and font size live", "tags": ["color", "typography"], "category": "utility", "actionsUsed": ["copyToClipboard"] }
}
\`\`\`

KEY POINTS in this example:
1. PageShell → horizontal Stack → [GlassPanel preview (flex-1), ToolPanel sidebar]
2. Every InlineColorPicker/NodeSlider uses $bindState, preview reads via $state in style
3. Export section at the BOTTOM of ToolPanelContent with a brand Button
4. stateDefaults has ALL $bindState paths as numbers/strings (correct types)
5. Nothing is mocked — the app WORKS on first load
`;

// ─── Spec validation — catches broken/mocked specs before sending to client ──
function validateSpec(parsed: Record<string, unknown>): { valid: boolean; issues: string[] } {
  const issues: string[] = [];
  const elements = parsed.elements as Record<string, any> | undefined;
  const stateDefaults = parsed.stateDefaults as Record<string, unknown> | undefined;

  if (!elements || !parsed.root) {
    return { valid: false, issues: ['Missing root or elements'] };
  }

  const POWER_COMPONENTS = [
    'ShaderPreview',
    'Scene3D',
    'VideoPlayer',
    'ImageCanvas',
    'HalftonePreview',
    'RisoPreview',
    'MoodboardGrid',
  ];
  const allKeys = new Set(Object.keys(elements));
  const bindPaths = new Set<string>();
  const statePaths = new Set<string>();
  let hasButton = false;
  let hasButtonAction = false;

  for (const [key, el] of Object.entries(elements)) {
    // Check orphan children
    if (el.children) {
      for (const childKey of el.children) {
        if (!allKeys.has(childKey)) {
          issues.push(`Element "${key}" references missing child "${childKey}"`);
        }
      }
    }

    // Collect $bindState and $state paths
    const propsStr = JSON.stringify(el.props || {});
    const bindMatches = propsStr.matchAll(/\"\$bindState\"\s*:\s*\"([^\"]+)\"/g);
    for (const m of bindMatches) bindPaths.add(m[1]);
    const stateMatches = propsStr.matchAll(/\"\$state\"\s*:\s*\"([^\"]+)\"/g);
    for (const m of stateMatches) statePaths.add(m[1]);

    // Check buttons
    if (el.type === 'Button') {
      hasButton = true;
      if (el.on?.press?.action) hasButtonAction = true;
    }
  }

  // Validate stateDefaults coverage
  for (const path of bindPaths) {
    const key = path.replace(/^\//, '');
    if (!stateDefaults || !(key in stateDefaults)) {
      issues.push(`$bindState "${path}" has no stateDefaults entry`);
    }
  }

  // Check for dead controls (bindState with no $state reader)
  // Power components read state internally via bindings, so skip paths bound to them
  const powerBoundPaths = new Set<string>();
  for (const el of Object.values(elements) as any[]) {
    if (POWER_COMPONENTS.includes(el.type)) {
      const s = JSON.stringify(el.props || {});
      for (const m of s.matchAll(/\"\$bindState\"\s*:\s*\"([^\"]+)\"/g)) {
        powerBoundPaths.add(m[1]);
      }
    }
  }
  for (const path of bindPaths) {
    if (!statePaths.has(path) && !powerBoundPaths.has(path)) {
      issues.push(`$bindState "${path}" is never read by $state — control is dead`);
    }
  }

  // Check buttons have actions
  if (hasButton && !hasButtonAction) {
    issues.push('Button(s) found without "on.press" action');
  }

  // Check for standard shell (ToolPanel + preview area)
  const types = new Set(Object.values(elements).map((el: any) => el.type));
  const hasPowerComponent = POWER_COMPONENTS.some((c) => types.has(c));
  if (!types.has('ToolPanel') && !types.has('Tabs') && !types.has('Metric') && !hasPowerComponent) {
    issues.push(
      'Missing ToolPanel sidebar — use the standard Tool-style layout with ToolPanel + ToolPanelHeader + ToolPanelContent'
    );
  }

  // Check for export section
  const hasExportSection = Object.values(elements).some(
    (el: any) => el.type === 'ToolPanelSection' && el.props?.title?.toUpperCase() === 'EXPORT'
  );
  if (!hasExportSection && types.has('ToolPanel')) {
    issues.push(
      'Missing EXPORT section at bottom of ToolPanelContent — add a ToolPanelSection with title "EXPORT" containing a Button with an action'
    );
  }

  return { valid: issues.length === 0, issues };
}

// ─── POST /generate — SSE streaming spec generation ─────────────────────
router.post('/generate', playgroundRateLimit, authenticate, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: 'Unauthorized' });

  const { prompt, brandContext, model, images } = req.body as {
    prompt: string;
    brandContext?: string;
    model?: string;
    images?: string[];
  };

  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'prompt required' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const send = (event: string, data: unknown) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  let credited = false;
  try {
    send('status', { message: 'Composing your app...' });

    await chargeCredits(req.userId!, 1);
    credited = true;

    const systemInstruction =
      PLAYGROUND_SYSTEM_PROMPT +
      CATALOG_PROMPT +
      (brandContext ? `\n\n## User Brand Context\n${sanitizeForPrompt(brandContext)}` : '');

    const selectedModel =
      model && Object.values(GEMINI_MODELS).includes(model as any) ? model : GEMINI_MODELS.PRO_3_1;

    const MAX_ATTEMPTS = 2;
    let spec: Record<string, unknown> | null = null;
    let meta: Record<string, unknown> = {};
    let stateDefaults: Record<string, unknown> | undefined;

    // Build user message parts (text + optional images)
    const userParts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> =
      [{ text: sanitizeForPrompt(prompt) }];
    if (images?.length) {
      for (const b64 of images.slice(0, 4)) {
        const mimeType = b64.startsWith('/9j/') ? 'image/jpeg' : 'image/png';
        userParts.push({ inlineData: { mimeType, data: b64 } });
      }
    }

    const messages: Array<{ role: string; parts: typeof userParts }> = [
      { role: 'user', parts: userParts },
    ];

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      if (attempt > 1) send('status', { message: `Fixing issues (attempt ${attempt})...` });
      else send('status', { message: 'Thinking...' });

      const genStream = await getAI().models.generateContentStream({
        model: selectedModel,
        config: {
          systemInstruction,
          temperature: 0.3,
          thinkingConfig: { thinkingBudget: 2048 },
        },
        contents: messages,
      });

      let raw = '';
      let chunkCount = 0;
      try {
        for await (const chunk of genStream) {
          const text = chunk.text ?? '';
          raw += text;
          chunkCount++;
          if (chunkCount === 1) send('status', { message: 'Building spec...' });
          if (chunkCount % 5 === 0)
            send('status', { message: `Generating... (${raw.length} chars)` });
        }
      } catch (streamErr: any) {
        console.error('[playground/generate] stream error:', streamErr?.message);
        if (!raw.trim()) throw streamErr;
      }
      raw = raw.trim();
      const cleaned = raw
        .replace(/^```json\s*/m, '')
        .replace(/^```\s*/m, '')
        .replace(/\s*```$/m, '')
        .trim();

      send('status', { message: 'Validating spec...' });

      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(cleaned);
      } catch {
        if (attempt === MAX_ATTEMPTS) {
          await refundCredits(req.userId!, 1).catch(() => {});
          send('error', { message: 'Failed to parse response. Try a simpler prompt.' });
          return res.end();
        }
        messages.push(
          { role: 'model', parts: [{ text: raw }] },
          {
            role: 'user',
            parts: [{ text: 'Your output was not valid JSON. Return ONLY a valid JSON object.' }],
          }
        );
        continue;
      }

      if (parsed.clarification) {
        await refundCredits(req.userId!, 1).catch(() => {});
        send('clarification', {
          questions: (parsed as any).questions || [],
          suggestion: (parsed as any).suggestion || '',
        });
        send('complete', { message: 'Needs clarification' });
        return res.end();
      }

      if (!parsed.root || !parsed.elements) {
        if (attempt === MAX_ATTEMPTS) {
          await refundCredits(req.userId!, 1).catch(() => {});
          send('error', { message: 'Invalid spec generated. Try rephrasing your prompt.' });
          return res.end();
        }
        messages.push(
          { role: 'model', parts: [{ text: cleaned }] },
          {
            role: 'user',
            parts: [
              {
                text: 'Missing "root" or "elements" in spec. Return the full spec with root, elements, stateDefaults, and meta.',
              },
            ],
          }
        );
        continue;
      }

      const validation = validateSpec(parsed);
      if (!validation.valid && attempt < MAX_ATTEMPTS) {
        send('status', { message: `Found ${validation.issues.length} issue(s), auto-fixing...` });
        messages.push(
          { role: 'model', parts: [{ text: cleaned }] },
          {
            role: 'user',
            parts: [
              {
                text: `Your spec has these issues — fix ALL of them and return the corrected FULL spec:\n${validation.issues
                  .map((i, idx) => `${idx + 1}. ${i}`)
                  .join('\n')}`,
              },
            ],
          }
        );
        continue;
      }

      meta = (parsed as any).meta || {};
      stateDefaults = (parsed as any).stateDefaults || undefined;
      spec = { root: parsed.root, elements: parsed.elements };
      if (stateDefaults) (spec as any).stateDefaults = stateDefaults;
      break;
    }

    if (!spec) {
      await refundCredits(req.userId!, 1).catch(() => {});
      send('error', { message: 'Could not generate a valid app. Try a more specific prompt.' });
      return res.end();
    }

    send('spec', { spec, meta, stateDefaults });
    send('complete', { message: 'Done!' });
  } catch (err: any) {
    console.error('[playground/generate]', err);
    if (credited && !err?.message?.includes('Insufficient credits')) {
      await refundCredits(req.userId!, 1).catch(() => {});
    }
    send('error', {
      message: err?.message?.includes('Insufficient credits')
        ? 'Insufficient credits'
        : 'Generation failed. Please try again.',
    });
  } finally {
    res.end();
  }
});

// ─── POST /iterate — Refine existing spec ───────────────────────────────
router.post('/iterate', playgroundRateLimit, authenticate, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: 'Unauthorized' });

  const { prompt, currentSpec, brandContext, model, images } = req.body as {
    prompt: string;
    currentSpec: Record<string, unknown>;
    brandContext?: string;
    model?: string;
    images?: string[];
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
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const send = (event: string, data: unknown) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  let credited = false;
  try {
    send('status', { message: 'Updating your app...' });

    await chargeCredits(req.userId!, 1);
    credited = true;

    const systemInstruction =
      PLAYGROUND_ITERATE_PROMPT +
      JSON.stringify(currentSpec, null, 2) +
      '\n\n' +
      CATALOG_PROMPT +
      (brandContext ? `\n\n## User Brand Context\n${sanitizeForPrompt(brandContext)}` : '');

    const selectedModel =
      model && Object.values(GEMINI_MODELS).includes(model as any) ? model : GEMINI_MODELS.PRO_3_1;

    // Build user message parts (text + optional images)
    const iterParts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> =
      [{ text: sanitizeForPrompt(prompt) }];
    if (images?.length) {
      for (const b64 of images.slice(0, 4)) {
        const mimeType = b64.startsWith('/9j/') ? 'image/jpeg' : 'image/png';
        iterParts.push({ inlineData: { mimeType, data: b64 } });
      }
    }

    send('status', { message: 'Thinking...' });

    const iterStream = await getAI().models.generateContentStream({
      model: selectedModel,
      config: {
        systemInstruction,
        temperature: 0.3,
        thinkingConfig: { thinkingBudget: 2048 },
      },
      contents: [{ role: 'user', parts: iterParts }],
    });

    let raw = '';
    let iterChunkCount = 0;
    try {
      for await (const chunk of iterStream) {
        const text = chunk.text ?? '';
        raw += text;
        iterChunkCount++;
        if (iterChunkCount === 1) send('status', { message: 'Updating spec...' });
        if (iterChunkCount % 5 === 0)
          send('status', { message: `Generating... (${raw.length} chars)` });
      }
    } catch (streamErr: any) {
      console.error('[playground/iterate] stream error:', streamErr?.message);
      if (!raw.trim()) throw streamErr;
    }
    raw = raw.trim();
    const cleaned = raw
      .replace(/^```json\s*/m, '')
      .replace(/^```\s*/m, '')
      .replace(/\s*```$/m, '')
      .trim();

    send('status', { message: 'Validating...' });

    try {
      const parsed = JSON.parse(cleaned);
      if (parsed.root && parsed.elements) {
        const validation = validateSpec(parsed);
        if (!validation.valid) {
          send('status', { message: `Found ${validation.issues.length} issue(s) in update` });
        }
        const meta = parsed.meta || {};
        const spec: Record<string, unknown> = { root: parsed.root, elements: parsed.elements };
        if (parsed.stateDefaults) spec.stateDefaults = parsed.stateDefaults;
        send('spec', { spec, meta, stateDefaults: parsed.stateDefaults });
        send('complete', {
          message: validation.valid
            ? 'Updated!'
            : `Updated with ${validation.issues.length} warning(s)`,
        });
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

    const systemInstruction =
      PLAYGROUND_SYSTEM_PROMPT +
      CATALOG_PROMPT +
      (brandContext ? `\n\n## User Brand Context\n${brandContext}` : '');

    const result = await getAI().models.generateContent({
      model: GEMINI_MODELS.PRO_3_1,
      config: {
        systemInstruction,
        temperature: 0.3,
        thinkingConfig: { thinkingBudget: 2048 },
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

  const { title, description, tags, category, spec, stateDefaults, actionsUsed, thumbnail } =
    req.body;

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
        id: true,
        slug: true,
        title: true,
        description: true,
        tags: true,
        category: true,
        thumbnail: true,
        likesCount: true,
        forksCount: true,
        viewsCount: true,
        isPublished: true,
        createdAt: true,
        updatedAt: true,
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
  const {
    category,
    sort = 'newest',
    search,
    skip = '0',
    take = '20',
  } = req.query as Record<string, string>;

  try {
    const where: Record<string, unknown> = { isPublished: true };
    if (category) where.category = category;
    if (search) where.title = { contains: search, mode: 'insensitive' };

    const orderBy =
      sort === 'likes'
        ? { likesCount: 'desc' as const }
        : sort === 'popular'
        ? { viewsCount: 'desc' as const }
        : { createdAt: 'desc' as const };

    const [miniApps, total] = await Promise.all([
      prisma.miniApp.findMany({
        where,
        orderBy,
        skip: parseInt(skip),
        take: Math.min(parseInt(take), 50),
        select: {
          id: true,
          slug: true,
          title: true,
          description: true,
          tags: true,
          category: true,
          thumbnail: true,
          likesCount: true,
          forksCount: true,
          viewsCount: true,
          userId: true,
          createdAt: true,
        },
      }),
      prisma.miniApp.count({ where }),
    ]);

    const userIds = [...new Set(miniApps.map((a) => a.userId))];
    const users =
      userIds.length > 0
        ? await prisma.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, name: true, picture: true, username: true },
          })
        : [];
    const userMap = new Map(users.map((u) => [u.id, u]));

    const enriched = miniApps.map((a) => {
      const author = userMap.get(a.userId);
      return {
        ...a,
        author: author
          ? { name: author.name, picture: author.picture, username: author.username }
          : null,
      };
    });

    res.json({ miniApps: enriched, total });
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
          stateDefaults: (original.stateDefaults as any) ?? undefined,
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
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.miniAppLike.findUnique({
        where: { miniAppId_userId: { miniAppId, userId: req.userId! } },
      });

      if (existing) {
        await tx.miniAppLike.delete({ where: { id: existing.id } });
        await tx.miniApp.update({
          where: { id: miniAppId },
          data: { likesCount: { decrement: 1 } },
        });
        return { liked: false };
      } else {
        await tx.miniAppLike.create({ data: { miniAppId, userId: req.userId! } });
        await tx.miniApp.update({
          where: { id: miniAppId },
          data: { likesCount: { increment: 1 } },
        });
        return { liked: true };
      }
    });

    res.json(result);
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
  // Video
  '/video/generate',
  // Moodboard
  '/moodboard/detect-grid',
  '/moodboard/upscale',
  '/moodboard/suggest',
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
      Authorization: req.headers.authorization || '',
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
    const internalUrl = `${req.protocol}://${req.get('host')}/api/brand-guidelines/${
      req.params.guidelineId
    }`;
    const brandRes = await fetch(internalUrl, {
      headers: { Authorization: req.headers.authorization || '' },
    });

    if (!brandRes.ok) return res.status(404).json({ error: 'Brand not found' });

    const brand = await brandRes.json();

    const b = brand;
    const brandName = b.identity?.name || b.brandName || '';
    const parts: string[] = [];

    if (brandName) parts.push(`Brand: ${brandName}`);
    if (b.identity?.tagline || b.tagline)
      parts.push(`Tagline: ${b.identity?.tagline || b.tagline}`);
    if (b.identity?.description) parts.push(`Description: ${b.identity.description}`);

    if (b.colors?.length) {
      parts.push(
        `Colors: ${b.colors.map((c: any) => `${c.hex} (${c.name || c.role || ''})`).join(', ')}`
      );
    }

    if (b.typography?.length) {
      const fonts = b.typography.filter((t: any) => t.fontFamily || t.family);
      if (fonts.length)
        parts.push(
          `Typography: ${fonts
            .map((t: any) => `${t.fontFamily || t.family} ${t.fontStyle || t.style || ''}`)
            .join(', ')}`
        );
    }

    const logo = b.logos?.find((l: any) => l.url);
    if (logo?.url) parts.push(`Logo URL: ${logo.url}`);
    if (b.logoUrl) parts.push(`Logo URL: ${b.logoUrl}`);

    if (b.guidelines?.voice) parts.push(`Voice: ${b.guidelines.voice}`);
    if (b.guidelines?.imagery) parts.push(`Imagery style: ${b.guidelines.imagery}`);
    if (b.tags?.brand_values?.length) parts.push(`Brand values: ${b.tags.brand_values.join(', ')}`);
    if (b.tags?.aesthetic?.length) parts.push(`Aesthetic: ${b.tags.aesthetic.join(', ')}`);
    if (b.tags?.tone?.length) parts.push(`Tone: ${b.tags.tone.join(', ')}`);

    if (b.strategy?.positioning?.length)
      parts.push(`Positioning: ${b.strategy.positioning.join(' | ')}`);

    const context = parts.join('\n');
    res.json({ context, brandName });
  } catch (err) {
    console.error('[playground/brand-context]', err);
    res.status(500).json({ error: 'Failed to fetch brand context' });
  }
});

export default router;
