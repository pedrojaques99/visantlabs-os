import { create } from 'zustand';
import { hexToRgb, rgbToHex, hexToCmyk, cmykToHex } from '@/utils/colorUtils';

export interface ConvertedColor {
  input: string;
  hex: string;
  rgb: [number, number, number];
  cmyk: { c: number; m: number; y: number; k: number };
  hsl: { h: number; s: number; l: number };
}

type InputFormat = 'hex' | 'rgb' | 'cmyk' | 'hsl';

export interface ColorConverterState {
  inputColor: string;
  inputFormat: InputFormat;
  colors: ConvertedColor[];
  setInputColor: (v: string) => void;
  addColor: (input: string) => void;
  removeColor: (index: number) => void;
  reset: () => void;
}

/* ── HSL helpers ──────────────────────────────────────────── */

function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const [r, g, b] = hexToRgb(hex).map((v) => v / 255);
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l: Math.round(l * 100) };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function hslToHex(h: number, s: number, l: number): string {
  const sn = s / 100,
    ln = l / 100;
  const a = sn * Math.min(ln, 1 - ln);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = ln - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color);
  };
  return rgbToHex(f(0), f(8), f(4));
}

/* ── Parsing ──────────────────────────────────────────────── */

function detectAndParse(raw: string): { format: InputFormat; hex: string } | null {
  const s = raw.trim();

  // HEX
  const hexMatch = s.match(/^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);
  if (hexMatch) {
    let h = hexMatch[1];
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    return { format: 'hex', hex: `#${h.toUpperCase()}` };
  }

  // RGB
  const rgbMatch = s.match(/^(?:rgb\s*\(\s*)?(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)?$/i);
  if (rgbMatch) {
    const [r, g, b] = [+rgbMatch[1], +rgbMatch[2], +rgbMatch[3]];
    if (r <= 255 && g <= 255 && b <= 255) {
      return { format: 'rgb', hex: rgbToHex(r, g, b) };
    }
  }

  // CMYK
  const cmykMatch = s.match(
    /^(?:cmyk\s*\(\s*)?(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)?$/i
  );
  if (cmykMatch) {
    const [c, m, y, k] = [+cmykMatch[1], +cmykMatch[2], +cmykMatch[3], +cmykMatch[4]];
    if (c <= 100 && m <= 100 && y <= 100 && k <= 100) {
      return { format: 'cmyk', hex: cmykToHex(c, m, y, k) };
    }
  }

  // HSL
  const hslMatch = s.match(/^(?:hsl\s*\(\s*)?(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)?$/i);
  if (hslMatch) {
    const [h, sat, l] = [+hslMatch[1], +hslMatch[2], +hslMatch[3]];
    if (h <= 360 && sat <= 100 && l <= 100) {
      return { format: 'hsl', hex: hslToHex(h, sat, l) };
    }
  }

  return null;
}

function buildConverted(input: string, hex: string): ConvertedColor {
  return {
    input,
    hex: hex.toUpperCase(),
    rgb: hexToRgb(hex),
    cmyk: hexToCmyk(hex),
    hsl: hexToHsl(hex),
  };
}

/* ── Store ────────────────────────────────────────────────── */

export const useColorConverterStore = create<ColorConverterState>()((set) => ({
  inputColor: '',
  inputFormat: 'hex',
  colors: [],

  setInputColor: (v) => {
    const parsed = detectAndParse(v);
    set({ inputColor: v, inputFormat: parsed?.format ?? 'hex' });
  },

  addColor: (input) => {
    const parsed = detectAndParse(input);
    if (!parsed) return;
    set((s) => ({
      colors: [...s.colors, buildConverted(input.trim(), parsed.hex)],
      inputColor: '',
    }));
  },

  removeColor: (index) => set((s) => ({ colors: s.colors.filter((_, i) => i !== index) })),

  reset: () => set({ inputColor: '', inputFormat: 'hex', colors: [] }),
}));
