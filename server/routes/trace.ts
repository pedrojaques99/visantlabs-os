import { Router, type Response as ExpressResponse } from 'express';
import { rateLimit } from 'express-rate-limit';
import { authenticate, type AuthRequest } from '../middleware/auth.js';

const router = Router();

const traceLimiter = rateLimit({
  windowMs: 60_000,
  max: 30,
  message: { error: 'Too many trace requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TraceOptions {
  turdSize?: number;
  optTolerance?: number;
  threshold?: number;
  color?: string;
}

export interface SvgOptimizeOptions {
  removeComments?: boolean;
  removeMetadata?: boolean;
  removeEditorData?: boolean;
  removeEmptyGroups?: boolean;
  minifyPaths?: boolean;
  removeHiddenElements?: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clamp(value: number, min: number, max: number, fallback: number): number {
  const n = Number(value);
  if (isNaN(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function parseBase64Image(image: string): Buffer | null {
  const match = image.match(/^data:image\/\w+;base64,(.+)$/);
  if (!match) return null;
  return Buffer.from(match[1], 'base64');
}

// ---------------------------------------------------------------------------
// SVG Optimization (server-side single source of truth)
// ---------------------------------------------------------------------------

const EDITOR_XMLNS = [
  'xmlns:inkscape', 'xmlns:sodipodi', 'xmlns:sketch',
  'xmlns:dc', 'xmlns:cc', 'xmlns:rdf',
];

const EDITOR_ATTR_PREFIXES = ['inkscape:', 'sodipodi:', 'sketch:', 'data-name'];

function optimizeSvg(svgString: string, options?: Partial<SvgOptimizeOptions>): string {
  const opts: Required<SvgOptimizeOptions> = {
    removeComments: true,
    removeMetadata: true,
    removeEditorData: true,
    removeEmptyGroups: true,
    minifyPaths: true,
    removeHiddenElements: true,
    ...options,
  };

  let svg = svgString;

  svg = svg.replace(/<\?xml[^?]*\?>\s*/gi, '');
  svg = svg.replace(/<!DOCTYPE[^>]*>\s*/gi, '');

  if (opts.removeComments) {
    svg = svg.replace(/<!--[\s\S]*?-->/g, '');
  }

  if (opts.removeMetadata) {
    svg = svg.replace(/<metadata[\s\S]*?<\/metadata>\s*/gi, '');
  }

  if (opts.removeEditorData) {
    for (const ns of EDITOR_XMLNS) {
      svg = svg.replace(new RegExp(`\\s+${ns.replace(':', ':')}="[^"]*"`, 'gi'), '');
    }
    for (const prefix of EDITOR_ATTR_PREFIXES) {
      svg = svg.replace(new RegExp(`\\s+${prefix.replace(':', ':')}[a-z-]*="[^"]*"`, 'gi'), '');
    }
    const withoutXlinkDecl = svg.replace(/\s+xmlns:xlink="[^"]*"/gi, '');
    if (!/xlink:/i.test(withoutXlinkDecl)) {
      svg = withoutXlinkDecl;
    }
    svg = svg.replace(/<sodipodi:[^>]*\/>\s*/gi, '');
    svg = svg.replace(/<sodipodi:[^>]*>[\s\S]*?<\/sodipodi:[^>]*>\s*/gi, '');
    svg = svg.replace(/<inkscape:[^>]*\/>\s*/gi, '');
    svg = svg.replace(/<inkscape:[^>]*>[\s\S]*?<\/inkscape:[^>]*>\s*/gi, '');
  }

  if (opts.removeEmptyGroups) {
    let prev = '';
    while (prev !== svg) {
      prev = svg;
      svg = svg.replace(/<g[^>]*>\s*<\/g>\s*/gi, '');
    }
  }

  if (opts.removeHiddenElements) {
    svg = svg.replace(/<[^>]+\s+display\s*=\s*"none"[^>]*(?:\/>|>[\s\S]*?<\/[^>]+>)\s*/gi, '');
    svg = svg.replace(/<[^>]+\s+visibility\s*=\s*"hidden"[^>]*(?:\/>|>[\s\S]*?<\/[^>]+>)\s*/gi, '');
  }

  if (opts.minifyPaths) {
    svg = svg.replace(/\b(\d+)\.0+\b/g, '$1');
    svg = svg.replace(/\b0+(\.\d*[1-9])0+\b/g, '$1');
    svg = svg.replace(/\b0+(\.\d+)\b/g, '$1');
    svg = svg.replace(/(?<=[\s,(":]|^)0+(\.\d+)/g, '$1');
  }

  svg = svg.replace(/\s{2,}/g, ' ');
  svg = svg.replace(/>\s+</g, '><');
  svg = svg.trim();

  return svg;
}

function sanitizeSvg(svg: string): string {
  let s = svg;
  s = s.replace(/<script[\s\S]*?<\/script>/gi, '');
  s = s.replace(/<script[^>]*\/>/gi, '');
  s = s.replace(/\s+on\w+="[^"]*"/gi, '');
  s = s.replace(/\s+on\w+='[^']*'/gi, '');
  s = s.replace(/\s+on\w+=[^\s>]*/gi, '');
  return s;
}

// ---------------------------------------------------------------------------
// Potrace vectorization
// ---------------------------------------------------------------------------

async function traceImage(buffer: Buffer, opts: TraceOptions = {}): Promise<string> {
  const potrace = await import('potrace');
  return new Promise((resolve, reject) => {
    potrace.trace(buffer, {
      turdSize: clamp(opts.turdSize!, 0, 20, 2),
      alphaMax: 1,
      optCurve: true,
      optTolerance: clamp(opts.optTolerance!, 0, 2, 0.2),
      color: opts.color || '#000000',
      threshold: clamp(opts.threshold!, 0, 255, 128),
    }, (err: Error | null, svg: string) => {
      if (err) reject(err);
      else resolve(svg);
    });
  });
}

// ---------------------------------------------------------------------------
// Full pipeline: trace → sanitize → optimize
// ---------------------------------------------------------------------------

async function tracePipeline(buffer: Buffer, opts: TraceOptions = {}): Promise<string> {
  const raw = await traceImage(buffer, opts);
  return optimizeSvg(sanitizeSvg(raw));
}

function cleanSvgPipeline(raw: string): string {
  return optimizeSvg(sanitizeSvg(raw));
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

/**
 * POST /api/trace/png-to-svg
 * Full pipeline: PNG → potrace → sanitize → optimize → clean SVG.
 */
router.post('/png-to-svg', authenticate, traceLimiter, async (req: AuthRequest, res: ExpressResponse) => {
  try {
    const { image, turdSize, optTolerance, threshold, color } = req.body;

    if (!image || typeof image !== 'string') {
      return res.status(400).json({ error: 'Missing image (base64 data URL)' });
    }

    const buffer = parseBase64Image(image);
    if (!buffer) {
      return res.status(400).json({ error: 'Invalid base64 image format' });
    }

    const svg = await tracePipeline(buffer, { turdSize, optTolerance, threshold, color });

    res.json({ svg });
  } catch (error: unknown) {
    console.error('PNG→SVG trace error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/trace/optimize
 * Sanitize + optimize raw SVG (e.g. pasted from Figma, Illustrator, etc.)
 */
router.post('/optimize', authenticate, traceLimiter, async (req: AuthRequest, res: ExpressResponse) => {
  try {
    const { svg: rawSvg } = req.body;

    if (!rawSvg || typeof rawSvg !== 'string') {
      return res.status(400).json({ error: 'Missing svg string' });
    }

    if (!rawSvg.includes('<svg')) {
      return res.status(400).json({ error: 'Invalid SVG: missing <svg> element' });
    }

    const svg = cleanSvgPipeline(rawSvg);

    res.json({ svg });
  } catch (error: unknown) {
    console.error('SVG optimize error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

export { traceImage, tracePipeline, cleanSvgPipeline, optimizeSvg, sanitizeSvg, parseBase64Image };
export default router;
