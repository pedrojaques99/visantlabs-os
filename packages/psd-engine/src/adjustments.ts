// Aplica adjustment layers do PSD (Levels / Curves / Brightness-Contrast) como
// LUT de 256 entradas por canal. O Canvas 2D não tem equivalente a adjustment
// layers, então o compositor antes as DESCARTAVA — o ganho de contraste/tom do
// Photoshop sumia e o render saía "chapado/cinza". Shapes: ag-psd (psd.d.ts).
//
// Tipos não suportados ainda (exposure/vibrance/hue-sat/color-balance/etc.)
// retornam null → no-op (mesmo comportamento de antes, sem regressão).

export interface RgbLut {
  r: Uint8Array; // 256
  g: Uint8Array;
  b: Uint8Array;
}

const clamp = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : v);

function identity(): Uint8Array {
  const l = new Uint8Array(256);
  for (let i = 0; i < 256; i++) l[i] = i;
  return l;
}

/** Encadeia: aplica o LUT do canal e depois o LUT master (rgb), como o PS. */
function chain(master: Uint8Array, channel: Uint8Array): Uint8Array {
  const out = new Uint8Array(256);
  for (let i = 0; i < 256; i++) out[i] = master[channel[i]];
  return out;
}

interface LevelsChannel {
  shadowInput?: number;
  highlightInput?: number;
  midtoneInput?: number; // gamma (1 = neutro)
  shadowOutput?: number;
  highlightOutput?: number;
}

function levelsLut(c?: LevelsChannel): Uint8Array {
  if (!c) return identity();
  const sIn = c.shadowInput ?? 0;
  const hIn = c.highlightInput ?? 255;
  const sOut = c.shadowOutput ?? 0;
  const hOut = c.highlightOutput ?? 255;
  const gamma = c.midtoneInput && c.midtoneInput > 0 ? c.midtoneInput : 1;
  const range = Math.max(1, hIn - sIn);
  const lut = new Uint8Array(256);
  for (let v = 0; v < 256; v++) {
    let t = (v - sIn) / range;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    t = Math.pow(t, 1 / gamma); // gamma>1 clareia os midtones (igual ao PS)
    lut[v] = clamp(Math.round(sOut + t * (hOut - sOut)));
  }
  return lut;
}

function curvesLut(points?: Array<{ input: number; output: number }>): Uint8Array {
  if (!points || points.length < 2) return identity();
  const pts = [...points].sort((a, b) => a.input - b.input);
  const lut = new Uint8Array(256);
  for (let v = 0; v < 256; v++) {
    if (v <= pts[0].input) {
      lut[v] = clamp(pts[0].output);
      continue;
    }
    const last = pts[pts.length - 1];
    if (v >= last.input) {
      lut[v] = clamp(last.output);
      continue;
    }
    for (let k = 0; k < pts.length - 1; k++) {
      const a = pts[k];
      const b = pts[k + 1];
      if (v >= a.input && v <= b.input) {
        const f = (v - a.input) / Math.max(1, b.input - a.input);
        lut[v] = clamp(Math.round(a.output + f * (b.output - a.output)));
        break;
      }
    }
  }
  return lut;
}

/** Brightness/Contrast — algoritmo legacy (aprox. estável p/ FX leve de mockup). */
function brightnessContrastLut(adj: { brightness?: number; contrast?: number }): Uint8Array {
  const b = adj.brightness ?? 0;
  const c = adj.contrast ?? 0;
  const factor = 1 + c / 100; // contraste -100..100 → fator em torno de 127
  const lut = new Uint8Array(256);
  for (let v = 0; v < 256; v++) {
    lut[v] = clamp(Math.round((v + b - 127) * factor + 127));
  }
  return lut;
}

/**
 * Constrói o LUT RGB de um adjustment do ag-psd. Retorna null se o tipo ainda
 * não é suportado (chamador faz no-op).
 */
export function buildAdjustmentLut(adjustment: any): RgbLut | null {
  if (!adjustment || !adjustment.type) return null;
  switch (adjustment.type) {
    case 'levels': {
      const master = levelsLut(adjustment.rgb);
      return {
        r: chain(master, levelsLut(adjustment.red)),
        g: chain(master, levelsLut(adjustment.green)),
        b: chain(master, levelsLut(adjustment.blue)),
      };
    }
    case 'curves': {
      const master = curvesLut(adjustment.rgb);
      return {
        r: chain(master, curvesLut(adjustment.red)),
        g: chain(master, curvesLut(adjustment.green)),
        b: chain(master, curvesLut(adjustment.blue)),
      };
    }
    case 'brightness/contrast': {
      const l = brightnessContrastLut(adjustment);
      return { r: l, g: l, b: l };
    }
    default:
      return null;
  }
}
