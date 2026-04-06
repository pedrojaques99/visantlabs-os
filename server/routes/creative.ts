import { Router } from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { GEMINI_MODELS } from '../../src/constants/geminiModels.js';

const router = Router();

const SYSTEM_PROMPT = `You are a creative director generating layered marketing creatives.
Given a user prompt and brand context, return STRICT JSON matching this schema:

{
  "background": { "prompt": "<detailed photo prompt for the AI image generator>" },
  "overlay": { "type": "gradient", "direction": "bottom", "opacity": 0.5, "color": "#000000" } | null,
  "layers": [
    { "type": "text", "content": "HEADLINE WITH <accent>WORD</accent>", "role": "headline", "position": {"x":0.08,"y":0.6}, "size": {"w":0.84,"h":0.18}, "align": "left", "fontSize": 96, "color": "#ffffff", "bold": true },
    { "type": "text", "content": "Subheadline copy", "role": "subheadline", "position": {"x":0.08,"y":0.8}, "size": {"w":0.6,"h":0.06}, "align": "left", "fontSize": 36, "color": "#ffffff", "bold": false },
    { "type": "shape", "shape": "rect", "color": "<ACCENT_HEX>", "position": {"x":0.0,"y":0.85}, "size": {"w":0.12,"h":0.15} }
  ]
}

RULES:
- Coordinates are 0-1 normalized (top-left origin).
- Use <accent>WORD</accent> on 1-2 important words in the headline.
- fontSize is in px assuming a 1080px tall canvas — scale proportionally for other formats.
- Replace <ACCENT_HEX> with the brand accent color when provided.
- Use brand colors for text. Default to white on dark overlay.
- Output ONLY the JSON object, no markdown, no commentary.`;

interface CreativePlanRequest {
  prompt: string;
  format: '1:1' | '9:16' | '16:9' | '4:5';
  brandContext?: {
    name?: string;
    colors?: string[];
    fonts?: string[];
    voice?: string;
    keywords?: string[];
  };
}

router.post('/plan', async (req, res) => {
  try {
    const { prompt, format, brandContext } = req.body as CreativePlanRequest;

    if (!prompt || !format) {
      return res.status(400).json({ error: 'prompt and format are required' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: GEMINI_MODELS.TEXT,
      generationConfig: {
        responseMimeType: 'application/json',
      },
    });

    const userMessage = [
      `User prompt: ${prompt}`,
      `Format: ${format}`,
      brandContext ? `Brand: ${JSON.stringify(brandContext)}` : '',
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

export default router;
