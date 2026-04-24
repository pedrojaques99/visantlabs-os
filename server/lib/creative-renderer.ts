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
}

interface ShapeLayerPlan {
  type: 'shape';
  shape: 'rect';
  color: string;
  position: { x: number; y: number };
  size: { w: number; h: number };
}

interface LogoLayerPlan {
  type: 'logo';
  url: string;
  position: { x: number; y: number };
  size: { w: number; h: number };
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
}

// ─── Format dimensions ─────────────────────────────────────────────────────────

const FORMAT_DIMS: Record<string, { w: number; h: number }> = {
  '1:1':  { w: 1080, h: 1080 },
  '16:9': { w: 1920, h: 1080 },
  '9:16': { w: 1080, h: 1920 },
  '4:5':  { w: 1080, h: 1350 },
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

let fontsRegistered = false;

async function ensureFonts() {
  if (fontsRegistered) return;
  fontsRegistered = true;

  const { GlobalFonts } = await getCanvas();
  const candidates = [
    '/usr/share/fonts/truetype/inter/Inter-Regular.ttf',
    '/usr/share/fonts/inter/Inter-Regular.ttf',
    path.join(process.cwd(), 'assets/fonts/Inter-Regular.ttf'),
  ];

  for (const p of candidates) {
    if (fs.existsSync(p)) {
      try {
        GlobalFonts.registerFromPath(p, 'Inter');
      } catch {}
      break;
    }
  }
}

// ─── Main render function ──────────────────────────────────────────────────────

export async function renderCreativePlan(
  plan: CreativePlan,
  options: RenderOptions = {}
): Promise<Buffer> {
  const { createCanvas, loadImage } = await getCanvas();
  await ensureFonts();

  const { format = '1:1', accentColor = '#ffffff', quality = 92 } = options;
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
      let sx = 0, sy = 0, sw = bgImg.width, sh = bgImg.height;

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
        top:    [0, 0, 0, h],
        left:   [0, 0, w, 0],
        right:  [w, 0, 0, 0],
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
  for (const layer of plan.layers) {
    const px = layer.position.x * w;
    const py = layer.position.y * h;
    const pw = layer.size.w * w;
    const ph = layer.size.h * h;

    if (layer.type === 'shape') {
      ctx.fillStyle = layer.color;
      ctx.fillRect(px, py, pw, ph);

    } else if (layer.type === 'logo') {
      try {
        const img = await loadImage(layer.url);
        // Fit within bounds preserving aspect ratio
        const ar = img.width / img.height;
        const bAr = pw / ph;
        let dw = pw, dh = ph, dx = px, dy = py;
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
      const fontFamily = layer.fontFamily ?? 'Inter, sans-serif';
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
  }

  // @napi-rs/canvas toBuffer signature: (mime, quality?) — no options object
  void quality; // quality param reserved for future jpeg support
  return canvas.toBuffer('image/png');
}
