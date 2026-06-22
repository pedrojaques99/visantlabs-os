/**
 * Server-side creative renderer.
 * Converts a creative plan JSON (background + overlay + layers) into a PNG buffer
 * using @napi-rs/canvas — no browser required.
 *
 * Coordinate system: all positions/sizes are 0-1 normalized against canvas W/H.
 * fontSize is stored at 1080px reference height and scaled proportionally.
 */

// @napi-rs/canvas is lazy-imported inside functions to avoid crashing
// Vercel Lambda at cold-start (native binary not available in sandbox).
import * as path from 'path';
import * as fs from 'fs';
import { fontSlug } from './brand-fonts.js';

async function getCanvas() {
  return import('@napi-rs/canvas');
}

// ─── Types (mirror of client-side schema) ─────────────────────────────────────

interface BackgroundPlan {
  prompt?: string;
  url?: string; // pre-generated image URL
}

interface OverlayPlan {
  type: 'gradient' | 'solid';
  direction?: 'bottom' | 'top' | 'left' | 'right';
  opacity: number;
  color?: string;
}

interface TextLayerPlan {
  type: 'text';
  content: string;
  role?: string;
  position: { x: number; y: number };
  size: { w: number; h: number };
  align?: 'left' | 'center' | 'right';
  fontSize: number;
  color?: string;
  bold?: boolean;
  fontFamily?: string;
  opacity?: number;
  shadowColor?: string;
  shadowBlur?: number;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
}

interface ShapeLayerPlan {
  type: 'shape';
  shape: 'rect';
  color: string;
  position: { x: number; y: number };
  size: { w: number; h: number };
  opacity?: number;
  shadowColor?: string;
  shadowBlur?: number;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
}

interface LogoLayerPlan {
  type: 'logo';
  url: string;
  position: { x: number; y: number };
  size: { w: number; h: number };
  opacity?: number;
  shadowColor?: string;
  shadowBlur?: number;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
}

type LayerPlan = TextLayerPlan | ShapeLayerPlan | LogoLayerPlan;

export interface CreativePlan {
  background: BackgroundPlan;
  overlay?: OverlayPlan | null;
  layers: LayerPlan[];
  backgroundImageUrl?: string; // pre-resolved URL to skip prompt
}

export interface RenderOptions {
  format?: '1:1' | '16:9' | '9:16' | '4:5';
  accentColor?: string;
  quality?: number; // 0-100, default 92
  /**
   * Brand fonts to register before rendering (SSoT: derived from
   * BrandGuideline.typography). Each `url` (WOFF2/TTF/OTF) is fetched and
   * registered under `family` so `layer.fontFamily`/`defaultFontFamily` resolve
   * to the real brand grotesque instead of the canvas serif fallback.
   */
  fonts?: { family: string; url?: string }[];
  /** Fallback family applied when a text layer has no fontFamily. */
  defaultFontFamily?: string;
}

// ─── Format dimensions ─────────────────────────────────────────────────────────

const FORMAT_DIMS: Record<string, { w: number; h: number }> = {
  '1:1': { w: 1080, h: 1080 },
  '16:9': { w: 1920, h: 1080 },
  '9:16': { w: 1080, h: 1920 },
  '4:5': { w: 1080, h: 1350 },
};

// ─── Accent text parser ────────────────────────────────────────────────────────

interface TextSegment {
  text: string;
  accent: boolean;
}

function parseAccentSegments(content: string): TextSegment[] {
  const segments: TextSegment[] = [];
  const regex = /<accent>(.*?)<\/accent>/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ text: content.slice(lastIndex, match.index), accent: false });
    }
    segments.push({ text: match[1], accent: true });
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < content.length) {
    segments.push({ text: content.slice(lastIndex), accent: false });
  }

  return segments.length > 0 ? segments : [{ text: content, accent: false }];
}

// ─── Font registration ─────────────────────────────────────────────────────────
// Try to register system fonts once. Failures are non-fatal — canvas falls back
// to the default sans-serif.

// Fonts are pulled from the @fontsource CDN on jsDelivr (covers all Google Fonts,
// 1500+ families) — same source `brand-fonts.ts` uses for the Puppeteer path. No
// font files are bundled; @napi-rs/canvas registers the fetched woff2 buffers.
const FONTSOURCE_VER = '5';

// Common non-Google families → metric-compatible Google substitute (so brands whose
// typography names a licensed font, e.g. "Helvetica Neue LT", still render on-brand).
const METRIC_SUB: Record<string, string> = {
  helvetica: 'arimo',
  'helvetica neue': 'arimo',
  'helvetica neue lt': 'arimo',
  arial: 'arimo',
  times: 'tinos',
  'times new roman': 'tinos',
  georgia: 'gelasio',
  courier: 'cousine',
  'courier new': 'cousine',
};

let baseFontsRegistered = false;
const registeredFamilies = new Set<string>(); // family names available to ctx.font
const attemptedFamilies = new Set<string>();

// SSRF guard: font URLs may come from brand data (woff2Url), so only https + a
// fixed host allowlist is fetched (the @fontsource CDN + Visant/R2 asset hosts).
const FONT_HOST_ALLOWLIST = ['cdn.jsdelivr.net', 'assets.visantlabs.com', 'r2.dev'];

async function fetchBuf(url: string): Promise<Buffer | null> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const host = parsed.hostname.toLowerCase();
  const allowed =
    parsed.protocol === 'https:' &&
    FONT_HOST_ALLOWLIST.some((d) => host === d || host.endsWith('.' + d));
  if (!allowed) return null;
  try {
    const r = await fetch(parsed.href);
    if (!r.ok) return null;
    return Buffer.from(await r.arrayBuffer());
  } catch {
    return null;
  }
}

const fontsourceUrl = (slug: string, weight: number) =>
  `https://cdn.jsdelivr.net/npm/@fontsource/${slug}@${FONTSOURCE_VER}/files/${slug}-latin-${weight}-normal.woff2`;

/** Register a @fontsource family (400 + 700) under `alias`. True if any face registered. */
async function registerFontsource(GlobalFonts: any, slug: string, alias: string): Promise<boolean> {
  let ok = false;
  for (const w of [400, 700]) {
    const buf = await fetchBuf(fontsourceUrl(slug, w));
    if (buf) {
      try {
        GlobalFonts.register(buf, alias);
        ok = true;
      } catch {}
    }
  }
  return ok;
}

async function ensureFonts(fonts?: { family: string; url?: string }[]) {
  const { GlobalFonts } = await getCanvas();

  // Base (once): guarantee a grotesque ("Inter") so any fallback is sans, never serif.
  if (!baseFontsRegistered) {
    baseFontsRegistered = true;
    const local = [
      '/usr/share/fonts/truetype/inter/Inter-Regular.ttf',
      path.join(process.cwd(), 'assets/fonts/Inter-Regular.ttf'),
    ].find((p) => {
      try {
        return fs.existsSync(p);
      } catch {
        return false;
      }
    });
    if (local) {
      try {
        GlobalFonts.registerFromPath(local, 'Inter');
        registeredFamilies.add('Inter');
      } catch {}
    }
    if (
      !registeredFamilies.has('Inter') &&
      (await registerFontsource(GlobalFonts, 'inter', 'Inter'))
    ) {
      registeredFamilies.add('Inter');
    }
  }

  // Brand fonts (SSoT: BrandGuideline.typography). Per family, in order:
  //   1) uploaded woff2 url → register as-is (true fidelity);
  //   2) @fontsource slug → covers any Google Font;
  //   3) metric-compatible substitute for common non-Google families.
  for (const f of fonts ?? []) {
    const family = f?.family?.trim();
    if (!family || registeredFamilies.has(family) || attemptedFamilies.has(family)) continue;
    attemptedFamilies.add(family);
    try {
      if (f.url) {
        const buf = await fetchBuf(f.url);
        if (buf) {
          GlobalFonts.register(buf, family);
          registeredFamilies.add(family);
          continue;
        }
      }
      if (await registerFontsource(GlobalFonts, fontSlug(family), family)) {
        registeredFamilies.add(family);
        continue;
      }
      const sub = METRIC_SUB[family.toLowerCase()];
      if (sub && (await registerFontsource(GlobalFonts, sub, family))) {
        registeredFamilies.add(family);
      }
    } catch {}
  }
}

/** Resolve a usable, registered family for ctx.font — never falls through to serif. */
function pickFamily(GlobalFonts: any, requested?: string, fallback?: string): string {
  // Bound the input before the regex (font family names are short) to avoid
  // polynomial-ReDoS on attacker-controlled fontFamily values.
  const stripped = requested
    ?.slice(0, 64)
    .replace(
      /\s+(thin|extra ?light|light|regular|book|medium|semi ?bold|bold|extra ?bold|black|heavy|italic|oblique)\b/gi,
      ''
    )
    .trim();
  for (const cand of [requested, stripped, fallback]) {
    if (cand && GlobalFonts.has(cand)) return cand;
  }
  return 'Inter';
}

// ─── Main render function ──────────────────────────────────────────────────────

export async function renderCreativePlan(
  plan: CreativePlan,
  options: RenderOptions = {}
): Promise<Buffer> {
  const { createCanvas, loadImage, GlobalFonts } = await getCanvas();
  await ensureFonts(options.fonts);

  const { format = '1:1', accentColor = '#ffffff', quality = 92, defaultFontFamily } = options;
  const dims = FORMAT_DIMS[format] ?? FORMAT_DIMS['1:1'];
  const { w, h } = dims;

  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext('2d');

  // ── 1. Background ──────────────────────────────────────────────────────────
  const bgUrl = plan.backgroundImageUrl ?? plan.background?.url;

  if (bgUrl) {
    try {
      const bgImg = await loadImage(bgUrl);
      // Cover-fit: fill canvas maintaining aspect ratio
      const imgAspect = bgImg.width / bgImg.height;
      const canvasAspect = w / h;
      let sx = 0,
        sy = 0,
        sw = bgImg.width,
        sh = bgImg.height;

      if (imgAspect > canvasAspect) {
        sw = bgImg.height * canvasAspect;
        sx = (bgImg.width - sw) / 2;
      } else {
        sh = bgImg.width / canvasAspect;
        sy = (bgImg.height - sh) / 2;
      }

      ctx.drawImage(bgImg, sx, sy, sw, sh, 0, 0, w, h);
    } catch {
      ctx.fillStyle = '#111111';
      ctx.fillRect(0, 0, w, h);
    }
  } else {
    ctx.fillStyle = '#111111';
    ctx.fillRect(0, 0, w, h);
  }

  // ── 2. Overlay ─────────────────────────────────────────────────────────────
  if (plan.overlay) {
    const ov = plan.overlay;
    const color = ov.color ?? '#000000';
    const alpha = ov.opacity ?? 0.5;

    if (ov.type === 'solid') {
      ctx.globalAlpha = alpha;
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;
    } else {
      // gradient
      const dirs: Record<string, [number, number, number, number]> = {
        bottom: [0, h, 0, 0],
        top: [0, 0, 0, h],
        left: [0, 0, w, 0],
        right: [w, 0, 0, 0],
      };
      const [x0, y0, x1, y1] = dirs[ov.direction ?? 'bottom'];
      const grad = ctx.createLinearGradient(x0, y0, x1, y1);
      // Convert hex to rgba
      const r = parseInt(color.slice(1, 3), 16);
      const g = parseInt(color.slice(3, 5), 16);
      const b = parseInt(color.slice(5, 7), 16);
      grad.addColorStop(0, `rgba(${r},${g},${b},${alpha})`);
      grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    }
  }

  // ── 3. Layers ──────────────────────────────────────────────────────────────

  function applyShadowAndOpacity(ctx: ReturnType<typeof canvas.getContext>, layer: LayerPlan) {
    ctx.globalAlpha = (layer as any).opacity ?? 1;
    if ((layer as any).shadowColor) {
      ctx.shadowColor = (layer as any).shadowColor;
      ctx.shadowBlur = (layer as any).shadowBlur ?? 0;
      ctx.shadowOffsetX = (layer as any).shadowOffsetX ?? 0;
      ctx.shadowOffsetY = (layer as any).shadowOffsetY ?? 0;
    }
  }

  function resetShadowAndOpacity(ctx: ReturnType<typeof canvas.getContext>) {
    ctx.globalAlpha = 1;
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
  }

  for (const layer of plan.layers) {
    const px = layer.position.x * w;
    const py = layer.position.y * h;
    const pw = layer.size.w * w;
    const ph = layer.size.h * h;

    applyShadowAndOpacity(ctx, layer);

    if (layer.type === 'shape') {
      ctx.fillStyle = layer.color;
      ctx.fillRect(px, py, pw, ph);
    } else if (layer.type === 'logo') {
      try {
        const img = await loadImage(layer.url);
        // Fit within bounds preserving aspect ratio
        const ar = img.width / img.height;
        const bAr = pw / ph;
        let dw = pw,
          dh = ph,
          dx = px,
          dy = py;
        if (ar > bAr) {
          dh = pw / ar;
          dy = py + (ph - dh) / 2;
        } else {
          dw = ph * ar;
          dx = px + (pw - dw) / 2;
        }
        ctx.drawImage(img, dx, dy, dw, dh);
      } catch {}
    } else if (layer.type === 'text') {
      const scaledSize = (layer.fontSize / 1080) * h;
      const fontFamily = pickFamily(GlobalFonts, layer.fontFamily, defaultFontFamily);
      const weight = layer.bold ? 'bold' : 'normal';
      ctx.font = `${weight} ${scaledSize}px ${fontFamily}`;
      ctx.textBaseline = 'top';

      const segments = parseAccentSegments(layer.content);
      const align = layer.align ?? 'left';

      // Compute total line width for alignment
      let totalWidth = 0;
      for (const seg of segments) {
        ctx.fillStyle = seg.accent ? accentColor : (layer.color ?? '#ffffff');
        totalWidth += ctx.measureText(seg.text).width;
      }

      let startX = px;
      if (align === 'center') startX = px + (pw - totalWidth) / 2;
      else if (align === 'right') startX = px + pw - totalWidth;

      // Line-wrap is not implemented for server render — single line per layer
      // (matches the simple banner use-case; multi-line would need a wrap pass)
      let cursorX = startX;
      for (const seg of segments) {
        ctx.fillStyle = seg.accent ? accentColor : (layer.color ?? '#ffffff');
        ctx.fillText(seg.text, cursorX, py);
        cursorX += ctx.measureText(seg.text).width;
      }
    }

    resetShadowAndOpacity(ctx);
  }

  // @napi-rs/canvas toBuffer signature: (mime, quality?) — no options object
  void quality; // quality param reserved for future jpeg support
  return canvas.toBuffer('image/png');
}
