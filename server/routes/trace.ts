import { Router, type Request, type Response as ExpressResponse, type NextFunction } from 'express';
import { rateLimit } from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../utils/jwtSecret.js';
import type { AuthRequest } from '../middleware/auth.js';

let _purify: any = null;
async function getPurify() {
  if (_purify) return _purify;
  const { JSDOM } = await import('jsdom');
  const createDOMPurify = (await import('dompurify')).default;
  _purify = createDOMPurify(new JSDOM('').window as any);
  return _purify;
}

const router = Router();

const traceLimiter = rateLimit({
  windowMs: 60_000,
  max: 30,
  message: { error: 'Too many trace requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

function optionalAuth(req: AuthRequest, _res: ExpressResponse, next: NextFunction) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { userId?: string };
      if (decoded.userId) req.userId = decoded.userId;
    } catch { /* ignore invalid tokens */ }
  }
  next();
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TracePreset = 'logo' | 'lettering' | 'lineArt' | 'stamp' | 'custom';

export interface TraceOptions {
  turdSize?: number;
  optTolerance?: number;
  threshold?: number | 'auto';
  alphaMax?: number;
  color?: string;
  preset?: TracePreset;
}

const TRACE_PRESETS: Record<Exclude<TracePreset, 'custom'>, Required<Omit<TraceOptions, 'color' | 'preset'>>> = {
  logo:      { turdSize: 3,  optTolerance: 0.3,  threshold: 'auto', alphaMax: 0.8 },
  lettering: { turdSize: 1,  optTolerance: 0.15, threshold: 'auto', alphaMax: 0.5 },
  lineArt:   { turdSize: 0,  optTolerance: 0.1,  threshold: 128,    alphaMax: 1.0 },
  stamp:     { turdSize: 5,  optTolerance: 0.5,  threshold: 'auto', alphaMax: 0.8 },
};

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

function escapeRegexSpecial(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ---------------------------------------------------------------------------
// SVG Sanitization via DOMPurify (safe against nested bypass / edge cases)
// ---------------------------------------------------------------------------

async function sanitizeSvg(svg: string): Promise<string> {
  const purify = await getPurify();
  return purify.sanitize(svg, {
    USE_PROFILES: { svg: true, svgFilters: true },
    ADD_TAGS: ['use'],
  });
}

// ---------------------------------------------------------------------------
// SVG Optimization (server-side single source of truth)
// ---------------------------------------------------------------------------

const EDITOR_XMLNS = [
  'xmlns:inkscape', 'xmlns:sodipodi', 'xmlns:sketch',
  'xmlns:dc', 'xmlns:cc', 'xmlns:rdf',
];

const EDITOR_ATTR_PREFIXES = ['inkscape:', 'sodipodi:', 'sketch:', 'data-name'];

async function optimizeSvg(svgString: string, options?: Partial<SvgOptimizeOptions>): Promise<string> {
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
    let prev = '';
    while (prev !== svg) {
      prev = svg;
      svg = svg.replace(/<!--[\s\S]*?-->/g, '');
    }
  }

  if (opts.removeMetadata) {
    svg = svg.replace(/<metadata[\s\S]*?<\/metadata>\s*/gi, '');
  }

  if (opts.removeEditorData) {
    for (const ns of EDITOR_XMLNS) {
      const escaped = escapeRegexSpecial(ns);
      svg = svg.replace(new RegExp(`\\s+${escaped}="[^"]*"`, 'gi'), '');
    }
    for (const prefix of EDITOR_ATTR_PREFIXES) {
      const escaped = escapeRegexSpecial(prefix);
      svg = svg.replace(new RegExp(`\\s+${escaped}[a-z-]*="[^"]*"`, 'gi'), '');
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
    const { JSDOM } = await import('jsdom');
    const dom = new JSDOM(svg, { contentType: 'image/svg+xml' });
    const doc = dom.window.document;
    doc.querySelectorAll('[display="none"], [visibility="hidden"]').forEach(el => el.remove());
    svg = doc.documentElement.outerHTML;
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

// ---------------------------------------------------------------------------
// Otsu auto-threshold
// ---------------------------------------------------------------------------

function computeOtsuFromGrayscale(pixels: Buffer): number {
  const histogram = new Array<number>(256).fill(0);
  let totalPixels = 0;

  for (let i = 0; i < pixels.length; i++) {
    histogram[pixels[i]]++;
    totalPixels++;
  }

  if (totalPixels === 0) return 128;

  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * histogram[i];

  let sumB = 0;
  let wB = 0;
  let maxVariance = 0;
  let bestThreshold = 128;

  for (let t = 0; t < 256; t++) {
    wB += histogram[t];
    if (wB === 0) continue;
    const wF = totalPixels - wB;
    if (wF === 0) break;

    sumB += t * histogram[t];
    const meanB = sumB / wB;
    const meanF = (sum - sumB) / wF;
    const variance = wB * wF * (meanB - meanF) * (meanB - meanF);

    if (variance > maxVariance) {
      maxVariance = variance;
      bestThreshold = t;
    }
  }

  return bestThreshold;
}

async function computeOtsuFromImage(buffer: Buffer): Promise<{ threshold: number; needsInvert: boolean }> {
  try {
    const sharp = (await import('sharp')).default;
    const grayscale = await sharp(buffer).grayscale().raw().toBuffer();
    const threshold = computeOtsuFromGrayscale(grayscale);

    // If threshold > 230, the image is light-on-light (e.g. gray logo on white).
    // A designer would invert it first — we do the same automatically.
    return { threshold, needsInvert: threshold > 230 };
  } catch {
    return { threshold: 128, needsInvert: false };
  }
}

async function invertImage(buffer: Buffer): Promise<Buffer> {
  const sharp = (await import('sharp')).default;
  return sharp(buffer).negate({ alpha: false }).toBuffer();
}

function svgHasContent(svg: string): boolean {
  const match = svg.match(/\bd="([^"]*)"/);
  return !!match && match[1].trim().length > 5;
}

// ---------------------------------------------------------------------------
// Resolve preset + merge options
// ---------------------------------------------------------------------------

function resolveTraceOptions(opts: TraceOptions): TraceOptions {
  if (opts.preset && opts.preset !== 'custom' && TRACE_PRESETS[opts.preset]) {
    const base = TRACE_PRESETS[opts.preset];
    return {
      turdSize: opts.turdSize ?? base.turdSize,
      optTolerance: opts.optTolerance ?? base.optTolerance,
      threshold: opts.threshold ?? base.threshold,
      alphaMax: opts.alphaMax ?? base.alphaMax,
      color: opts.color,
      preset: opts.preset,
    };
  }
  return opts;
}

// ---------------------------------------------------------------------------
// Potrace vectorization
// ---------------------------------------------------------------------------

function potraceTrace(buffer: Buffer, potraceOpts: Record<string, any>): Promise<string> {
  return new Promise(async (resolve, reject) => {
    const potrace = await import('potrace');
    potrace.trace(buffer, potraceOpts, (err: Error | null, svg: string) => {
      if (err) reject(err);
      else resolve(svg);
    });
  });
}

async function traceImage(buffer: Buffer, opts: TraceOptions = {}): Promise<string> {
  const resolved = resolveTraceOptions(opts);

  let threshold: number;
  let imageBuffer = buffer;

  if (resolved.threshold === 'auto') {
    const otsu = await computeOtsuFromImage(buffer);
    if (otsu.needsInvert) {
      // Light-on-light image (like gray logo on white bg) — invert first
      imageBuffer = await invertImage(buffer);
      // After inversion, re-compute Otsu on the inverted image
      const otsu2 = await computeOtsuFromImage(imageBuffer);
      threshold = otsu2.threshold;
    } else {
      threshold = otsu.threshold;
    }
  } else {
    threshold = clamp(Number(resolved.threshold) || 128, 0, 255, 128);
  }

  const potraceOpts = {
    turdSize: clamp(resolved.turdSize!, 0, 20, 2),
    alphaMax: clamp(resolved.alphaMax!, 0, 1.334, 1),
    optCurve: true,
    optTolerance: clamp(resolved.optTolerance!, 0, 2, 0.2),
    color: resolved.color || '#000000',
    threshold,
  };

  const svg = await potraceTrace(imageBuffer, potraceOpts);

  // Fallback: if trace produced empty paths and we didn't already invert, try inverting
  if (!svgHasContent(svg) && imageBuffer === buffer) {
    try {
      const inverted = await invertImage(buffer);
      const otsu = await computeOtsuFromImage(inverted);
      const retrySvg = await potraceTrace(inverted, { ...potraceOpts, threshold: otsu.threshold });
      if (svgHasContent(retrySvg)) return retrySvg;
    } catch { /* fall through to original empty result */ }
  }

  return svg;
}

// ---------------------------------------------------------------------------
// Full pipeline: trace → sanitize → optimize
// ---------------------------------------------------------------------------

async function tracePipeline(buffer: Buffer, opts: TraceOptions = {}): Promise<string> {
  const raw = await traceImage(buffer, opts);
  const sanitized = await sanitizeSvg(raw);
  return optimizeSvg(sanitized);
}

async function cleanSvgPipeline(raw: string): Promise<string> {
  const sanitized = await sanitizeSvg(raw);
  return optimizeSvg(sanitized);
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

/**
 * POST /api/trace/png-to-svg
 * Full pipeline: PNG → potrace → sanitize → optimize → clean SVG.
 */
router.post('/png-to-svg', traceLimiter, optionalAuth, async (req: AuthRequest, res: ExpressResponse) => {
  try {
    const { image, turdSize, optTolerance, threshold, alphaMax, color, preset } = req.body;

    if (!image || typeof image !== 'string') {
      return res.status(400).json({ error: 'Missing image (base64 data URL)' });
    }

    const buffer = parseBase64Image(image);
    if (!buffer) {
      return res.status(400).json({ error: 'Invalid base64 image format' });
    }

    const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
    if (buffer.length > MAX_IMAGE_SIZE) {
      return res.status(413).json({ error: 'Image too large (max 10MB)' });
    }

    const svg = await tracePipeline(buffer, { turdSize, optTolerance, threshold, alphaMax, color, preset });

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
router.post('/optimize', traceLimiter, optionalAuth, async (req: AuthRequest, res: ExpressResponse) => {
  try {
    const { svg: rawSvg } = req.body;

    if (!rawSvg || typeof rawSvg !== 'string') {
      return res.status(400).json({ error: 'Missing svg string' });
    }

    if (!rawSvg.includes('<svg')) {
      return res.status(400).json({ error: 'Invalid SVG: missing <svg> element' });
    }

    const svg = await cleanSvgPipeline(rawSvg);

    res.json({ svg });
  } catch (error: unknown) {
    console.error('SVG optimize error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

router.get('/presets', (_req, res: ExpressResponse) => {
  res.json({ presets: TRACE_PRESETS });
});

export { traceImage, tracePipeline, cleanSvgPipeline, optimizeSvg, sanitizeSvg, parseBase64Image, TRACE_PRESETS };
export default router;
