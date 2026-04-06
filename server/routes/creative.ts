import { Router } from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { GEMINI_MODELS } from '../../src/constants/geminiModels.js';
import {
  appendEvents,
  readEvents,
  computeBrandInsights,
  computeMetrics,
  type CreativeEvent,
} from '../lib/creative-events-store.js';

const router = Router();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const model = genAI.getGenerativeModel({
  model: GEMINI_MODELS.TEXT,
  generationConfig: {
    responseMimeType: 'application/json',
  },
});

const SYSTEM_PROMPT = `You are a creative director generating layered marketing creatives.
Given a user prompt and brand context, return STRICT JSON matching this schema:

{
  "background": { "prompt": "<detailed photo prompt for the AI image generator>" },
  "overlay": { "type": "gradient", "direction": "bottom", "opacity": 0.5, "color": "#000000" } | null,
  "layers": [
    { "type": "text", "content": "HEADLINE WITH <accent>WORD</accent>", "role": "headline", "position": {"x":0.08,"y":0.6}, "size": {"w":0.84,"h":0.18}, "align": "left", "fontSize": 96, "color": "#ffffff", "bold": true },
    { "type": "text", "content": "Subheadline copy", "role": "subheadline", "position": {"x":0.08,"y":0.8}, "size": {"w":0.6,"h":0.06}, "align": "left", "fontSize": 36, "color": "#ffffff", "bold": false },
    { "type": "shape", "shape": "rect", "color": "<ACCENT_HEX>", "position": {"x":0.0,"y":0.85}, "size": {"w":0.12,"h":0.15} },
    { "type": "logo", "position": {"x":0.8,"y":0.05}, "size": {"w":0.15,"h":0.08} }
  ]
}

RULES:
- Coordinates are 0-1 normalized (top-left origin).
- Use <accent>WORD</accent> on 1-2 important words in the headline.
- fontSize is in px assuming a 1080px tall canvas — scale proportionally for other formats.
- Replace <ACCENT_HEX> with the brand accent color when provided.
- Use brand colors for text. Default to white on dark overlay.
- Only include a "logo" layer if the brand has logos available (hasLogos: true).
- If hasLogos is false, do NOT return any layer of type "logo".
- Output ONLY the JSON object, no markdown, no commentary.`;

interface CreativePlanRequest {
  prompt: string;
  format: '1:1' | '9:16' | '16:9' | '4:5';
  brandId?: string;
  brandContext?: {
    name?: string;
    colors?: string[];
    fonts?: string[];
    voice?: string;
    keywords?: string[];
    hasLogos?: boolean;
  };
}

const FORMAT_RULES: Record<string, string> = {
  '1:1': 'Square layout. Balance elements centrally.',
  '9:16':
    'Vertical/portrait layout. Stack elements top-to-bottom. Keep headline above 0.5y. CTA near bottom (y > 0.75). Avoid overcrowding the sides.',
  '16:9':
    'Horizontal/landscape layout. Use left half for text (x < 0.5), right half for visual breathing room and background focus.',
  '4:5':
    'Slightly vertical. Headline in upper third, subheadline mid, CTA/logo in lower third.',
};

router.post('/plan', async (req, res) => {
  try {
    const { prompt, format, brandContext, brandId } = req.body as CreativePlanRequest;

    if (!prompt || !format) {
      return res.status(400).json({ error: 'prompt and format are required' });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });
    }

    const formatRule = FORMAT_RULES[format] || '';

    // Brand Learning (#5): inject past-correction insights as a bias hint.
    // The model adapts to this brand's historical edits without any fine-tune.
    let learnedBiasLine = '';
    if (brandId) {
      try {
        const insights = await computeBrandInsights(brandId);
        if (insights.sampleSize >= 3 && insights.commonPatches.length > 0) {
          learnedBiasLine = `Brand-learned preferences (from ${insights.sampleSize} past edits across ${insights.creatives} creatives): ${insights.commonPatches.join('; ')}. Apply these proactively.`;
        }
      } catch (e) {
        console.warn('[creative/plan] insights unavailable:', (e as Error).message);
      }
    }

    const userMessage = [
      `User prompt: ${prompt}`,
      `Format: ${format}`,
      `Layout Strategy: ${formatRule}`,
      brandContext ? `Brand: ${JSON.stringify(brandContext)}` : '',
      `Available Brand Logos: ${brandContext?.hasLogos ? 'YES' : 'NO'}`,
      learnedBiasLine,
    ]
      .filter(Boolean)
      .join('\n');

    const result = await model.generateContent([
      { text: SYSTEM_PROMPT },
      { text: userMessage },
    ]);

    const raw = result.response.text();
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return res.status(502).json({ error: 'Gemini returned invalid JSON', raw });
    }

    return res.json(parsed);
  } catch (err: any) {
    console.error('[creative/plan] error:', err);
    return res.status(500).json({ error: err?.message ?? 'unknown error' });
  }
});

// ---------- Creative Events (Brand Learning #5 + Observability #6) ----------

// Ingest a batch of edit events from the client
router.post('/events', async (req, res) => {
  try {
    const body = req.body as { events?: CreativeEvent[] };
    if (!body?.events || !Array.isArray(body.events)) {
      return res.status(400).json({ error: 'events array required' });
    }
    // Basic sanity cap to prevent abuse (client debounces to <=20)
    if (body.events.length > 200) {
      return res.status(413).json({ error: 'too many events in one batch' });
    }
    // Trust-but-verify: stamp server time if client omits
    const now = Date.now();
    const events = body.events.map((e) => ({
      ...e,
      ts: e.ts || now,
      id: e.id || `${now}_${Math.random().toString(36).slice(2, 8)}`,
    }));
    await appendEvents(events);
    return res.json({ ok: true, count: events.length });
  } catch (err: any) {
    console.error('[creative/events POST] error:', err);
    return res.status(500).json({ error: err?.message ?? 'unknown error' });
  }
});

// Query events (observability timeline)
router.get('/events', async (req, res) => {
  try {
    const brandId = (req.query.brandId as string) || undefined;
    const creativeId = (req.query.creativeId as string) || undefined;
    const limit = Math.min(Number(req.query.limit) || 100, 500);
    const events = await readEvents({ brandId, creativeId, limit });
    return res.json({ events });
  } catch (err: any) {
    console.error('[creative/events GET] error:', err);
    return res.status(500).json({ error: err?.message ?? 'unknown error' });
  }
});

// Global / per-brand metrics (observability header card)
router.get('/events/metrics', async (req, res) => {
  try {
    const brandId = (req.query.brandId as string) || undefined;
    const metrics = await computeMetrics(brandId);
    return res.json(metrics);
  } catch (err: any) {
    console.error('[creative/events/metrics] error:', err);
    return res.status(500).json({ error: err?.message ?? 'unknown error' });
  }
});

// Brand learning insights (feeds /plan and future MCP tool)
router.get('/brand/:brandId/insights', async (req, res) => {
  try {
    const insights = await computeBrandInsights(req.params.brandId);
    return res.json(insights);
  } catch (err: any) {
    console.error('[creative/brand/:id/insights] error:', err);
    return res.status(500).json({ error: err?.message ?? 'unknown error' });
  }
});

export default router;
