/**
 * CMYK Halftone — SVG generator.
 *
 * Pure JS (no DOM, no GL). Takes raw RGBA pixel data and produces a CMYK
 * halftone as an SVG string: per-channel rotated dot grids (cyan/magenta/yellow/
 * black) sized by the channel's CMYK intensity, over an optional paper rect, with
 * an optional multiply/screen blend group. Rasterize the SVG with any canvas to
 * get a PNG/JPEG (see the node adapter / host pipeline).
 *
 * This is the server-authoritative halftone path. The browser ImageLab uses a
 * separate WebGL fragment-shader implementation (rotating-grid GPU dots) that is
 * a different render path, not a pixel-equivalent of this one — they are two
 * surfaces of the same effect, kept distinct on purpose.
 */
import type { HalftoneSettings } from '../types.js';

interface DotData {
  cx: number;
  cy: number;
  r: number;
  color: string;
  opacity: number;
}

function hexToRgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16) / 255,
    parseInt(hex.slice(3, 5), 16) / 255,
    parseInt(hex.slice(5, 7), 16) / 255,
  ];
}

function rgbToCmyk(r: number, g: number, b: number): [number, number, number, number] {
  const k = 1 - Math.max(r, g, b);
  if (k >= 1) return [0, 0, 0, 1];
  const inv = 1 / (1 - k);
  return [(1 - r - k) * inv, (1 - g - k) * inv, (1 - b - k) * inv, k];
}

function hash(x: number, y: number): number {
  let px = 50 * ((x * 0.3183099 + 0.71) % 1);
  let py = 50 * ((y * 0.3183099 + 0.113) % 1);
  if (px < 0) px += 50;
  if (py < 0) py += 50;
  return (px * py * (px + py)) % 1;
}

function samplePixel(
  pixels: Uint8ClampedArray | Uint8Array,
  w: number,
  h: number,
  u: number,
  v: number,
  settings: HalftoneSettings
): [number, number, number] {
  const x = Math.min(Math.max(Math.round(u * (w - 1)), 0), w - 1);
  const y = Math.min(Math.max(Math.round(v * (h - 1)), 0), h - 1);
  const i = (y * w + x) * 4;
  let r = pixels[i] / 255;
  let g = pixels[i + 1] / 255;
  let b = pixels[i + 2] / 255;
  r = Math.min(Math.max((r - 0.5) * settings.contrast + 0.5 + settings.lightness, 0), 1);
  g = Math.min(Math.max((g - 0.5) * settings.contrast + 0.5 + settings.lightness, 0), 1);
  b = Math.min(Math.max((b - 0.5) * settings.contrast + 0.5 + settings.lightness, 0), 1);
  return [r, g, b];
}

interface ChannelConfig {
  cmykIndex: number;
  angle: number;
  ink: string;
  alpha: number;
  show: boolean;
}

export function generateHalftoneSvg(
  pixels: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number,
  settings: HalftoneSettings
): string {
  const w = width,
    h = height;
  const freq = settings.frequency;
  const cellSize = Math.max(w, h) / freq;

  const channels: ChannelConfig[] = [
    {
      cmykIndex: 0,
      angle: settings.cyanAngle,
      ink: settings.cyanInk,
      alpha: settings.cyanAlpha,
      show: settings.showCyan,
    },
    {
      cmykIndex: 1,
      angle: settings.magentaAngle,
      ink: settings.magentaInk,
      alpha: settings.magentaAlpha,
      show: settings.showMagenta,
    },
    {
      cmykIndex: 2,
      angle: settings.yellowAngle,
      ink: settings.yellowInk,
      alpha: settings.yellowAlpha,
      show: settings.showYellow,
    },
    {
      cmykIndex: 3,
      angle: settings.blackAngle,
      ink: settings.blackInk,
      alpha: settings.blackAlpha,
      show: settings.showBlack,
    },
  ];

  const dots: DotData[] = [];

  for (const ch of channels) {
    if (!ch.show) continue;
    const rad = (ch.angle * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const diag = Math.sqrt(w * w + h * h);
    const gridSize = Math.ceil(diag / cellSize) + 2;
    const offsetX = w / 2;
    const offsetY = h / 2;

    for (let row = -gridSize; row <= gridSize; row++) {
      for (let col = -gridSize; col <= gridSize; col++) {
        let gx = col * cellSize;
        let gy = row * cellSize;
        if (settings.randomness > 0) {
          gx += (hash(col, row) - 0.5) * settings.randomness * cellSize * 0.8;
          gy += (hash(col + 17, row + 31) - 0.5) * settings.randomness * cellSize * 0.8;
        }
        const px = cos * gx - sin * gy + offsetX;
        const py = sin * gx + cos * gy + offsetY;
        if (px < -cellSize || px > w + cellSize || py < -cellSize || py > h + cellSize) continue;
        const u = px / w,
          v = py / h;
        if (u < 0 || u > 1 || v < 0 || v > 1) continue;

        const [r, g, b] = samplePixel(pixels, w, h, u, v, settings);
        const cmyk = rgbToCmyk(r, g, b);
        const value = cmyk[ch.cmykIndex];
        if (value < settings.threshold) continue;
        const intensity = Math.min(Math.max(value, 0), 1);
        const radius = intensity * intensity * settings.dotSize * cellSize * 0.5;
        if (radius < 0.5) continue;

        dots.push({
          cx: Math.round(px * 100) / 100,
          cy: Math.round(py * 100) / 100,
          r: Math.round(radius * 100) / 100,
          color: ch.ink,
          opacity: ch.alpha,
        });
      }
    }
  }

  const blendMode =
    settings.blendMode === 0 ? 'multiply' : settings.blendMode === 1 ? 'screen' : 'normal';
  const parts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">`,
  ];
  if (settings.paperAlpha > 0) {
    const pa = settings.paperAlpha < 1 ? ` opacity="${settings.paperAlpha}"` : '';
    parts.push(`<rect width="${w}" height="${h}" fill="${settings.paperColor}"${pa}/>`);
  }
  if (blendMode !== 'normal') parts.push(`<g style="mix-blend-mode:${blendMode}">`);
  for (const d of dots) {
    const op = d.opacity < 1 ? ` opacity="${d.opacity}"` : '';
    parts.push(`<circle cx="${d.cx}" cy="${d.cy}" r="${d.r}" fill="${d.color}"${op}/>`);
  }
  if (blendMode !== 'normal') parts.push('</g>');
  parts.push('</svg>');
  return parts.join('\n');
}

// Internal helpers exported for tests / advanced callers.
export { hexToRgb, rgbToCmyk, hash, samplePixel };
