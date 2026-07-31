// Brand Token Engine — Layer 1 (brand identity) → Layer 2 (product craft).
//
// The engine derives ONLY the color-coupled craft (neutral ramp, shadow hue,
// brand-ink, on-color foregrounds, type roles) from a brand's few identity
// values, and plugs it into a FIXED craft skeleton (craft.json). Contrast is
// guaranteed by construction: Adobe Leonardo generates every color at a target
// WCAG ratio against the resolved background, so no derived pair fails AA.
//
// What it NEVER does: derive radius/density/elevation/motion per brand — those
// encode throughput/hierarchy/a11y and are constant across brands.

import { Theme, Color, BackgroundColor } from "@adobe/leonardo-contrast-colors";
import { converter, wcagContrast } from "culori";
import craft from "../craft.json" with { type: "json" };

const toOklch = converter("oklch");
const toRgb = converter("rgb");

const CS = "CAM02"; // Leonardo interpolation space (perceptual, silences deprec.)

// --- Ratio maps: the semantic target contrasts (vs the theme background) ------
// Position in the array is the semantic slot; Leonardo returns values in order.
const NEUTRAL = {
  // slot        light   dark   → target contrast vs bg
  card: { light: 1.06, dark: 1.15 },
  muted: { light: 1.14, dark: 1.4 },
  border: { light: 1.35, dark: 1.9 },
  input: { light: 1.5, dark: 2.3 },
  "muted-foreground": { light: 4.7, dark: 4.7 },
  foreground: { light: 15, dark: 16 },
};
const INK_RATIO = 4.7; // brand-colored text on bg (AA + margin)

// --- Role resolution ---------------------------------------------------------
// Brands do NOT share a role vocabulary. Sampled from the live API on
// 2026-07-30:
//
//   Visant®        colors: background primary secondary accent text
//                  type:   primary secondary
//   Campo Neon  colors: background surface secondary accent
//                          accent-secondary text-on-dark muted text
//                  type:   display body label feature
//   Turno & Turno   colors: text accent          type: heading
//
// An exact-match lookup with a hardcoded default silently paints one brand in
// another brand's identity. That is worse than crashing: it ships, and nobody
// sees it until a human opens the site. So every slot is a fallback CHAIN, and
// when nothing in the chain matches we throw with the roles we actually saw.

const COLOR_CHAINS = {
  background: ["background", "bg", "canvas", "surface", "base"],
  accent: ["accent", "primary", "brand", "accent-secondary", "secondary"],
  secondary: ["secondary", "accent-secondary", "surface", "primary", "accent"],
};

const TYPE_CHAINS = {
  // The face that carries headings.
  display: ["display", "heading", "headline", "title", "primary"],
  // The face that carries running text.
  sans: ["body", "text", "paragraph", "secondary", "primary"],
};

function pickColor(brand, slot, { required = false } = {}) {
  for (const r of COLOR_CHAINS[slot]) {
    const c = brand.colors?.find((x) => x.role === r);
    if (c?.hex) return c.hex.toLowerCase();
  }
  // Nothing matched. If the brand published ANY colour, the most-used one beats
  // a hardcoded default from another brand.
  const byUsage = [...(brand.colors ?? [])].sort(
    (a, b) => (a.usageRank ?? 99) - (b.usageRank ?? 99),
  )[0];
  if (byUsage?.hex) return byUsage.hex.toLowerCase();

  if (required) {
    throw new BrandTokenError(
      `no colour resolves the "${slot}" slot`,
      { slot, tried: COLOR_CHAINS[slot], saw: (brand.colors ?? []).map((c) => c.role) },
    );
  }
  return null;
}

/**
 * Which family carries headings and which carries body.
 *
 * Role names alone are not enough: Visant® labels its 96px Manrope as `primary`
 * and its 16px Oswald as `secondary`, so a naive primary→body / secondary→display
 * mapping puts the display face in body text and a 16px body face in the
 * headlines — inverted. `size` is the honest tiebreaker, because a type spec
 * that carries a size is telling you what it is for.
 */
function pickType(brand) {
  const list = brand.typography ?? [];
  if (!list.length) {
    throw new BrandTokenError("brand publishes no typography", { saw: [] });
  }

  const byChain = (slot) => {
    for (const r of TYPE_CHAINS[slot]) {
      const t = list.find((x) => x.role === r);
      if (t?.family) return t;
    }
    return null;
  };

  let display = byChain("display");
  let sans = byChain("sans");

  // Both landed on the same entry, or one is missing: split by size instead.
  if (!display || !sans || display === sans) {
    const sized = [...list].filter((t) => Number.isFinite(t.size));
    if (sized.length >= 2) {
      const sorted = [...sized].sort((a, b) => b.size - a.size);
      display = display ?? sorted[0];
      sans = sans && sans !== display ? sans : sorted[sorted.length - 1];
    } else {
      // Single-face brand: the same family does both jobs. That is a legitimate
      // brand decision, not a gap — do not invent a second family.
      display = display ?? list[0];
      sans = sans ?? display;
    }
  }

  return { display: display.family, sans: sans.family };
}

export class BrandTokenError extends Error {
  constructor(message, detail) {
    super(`@visant/brand-tokens: ${message}`);
    this.name = "BrandTokenError";
    this.detail = detail;
  }
}

function hex(oklchObj) {
  // culori → #rrggbb, clamped to sRGB gamut.
  const { r, g, b } = toRgb(oklchObj);
  const h = (v) => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

function bestForeground(bg) {
  return wcagContrast("#ffffff", bg) >= wcagContrast("#0a0a0a", bg) ? "#ffffff" : "#0a0a0a";
}

// Build one theme (light or dark) via Leonardo, returning hex tokens.
function buildTheme({ bgHex, neutralKeys, brandKeys, mode }) {
  const ratiosNeutral = Object.values(NEUTRAL).map((r) => r[mode]);
  const bg = new BackgroundColor({ name: "bg", colorKeys: [bgHex], ratios: [2], colorSpace: CS });
  const neutral = new Color({ name: "neutral", colorKeys: neutralKeys, ratios: ratiosNeutral, colorSpace: CS });
  const brandInk = new Color({ name: "ink", colorKeys: brandKeys, ratios: [INK_RATIO], colorSpace: CS });
  const bgLightness = Math.round(toOklch(bgHex).l * 100);
  const theme = new Theme({ colors: [neutral, brandInk], backgroundColor: bg, lightness: bgLightness });

  const out = theme.contrastColors;
  const background = out[0].background;
  const neutralVals = out.find((c) => c.name === "neutral").values.map((v) => v.value);
  const inkVal = out.find((c) => c.name === "ink").values[0].value;

  const keys = Object.keys(NEUTRAL);
  const n = {};
  keys.forEach((k, i) => (n[k] = neutralVals[i]));

  return { background, ink: inkVal, neutral: n };
}

export function compileBrandTokens(brand) {
  // Required: without a ground and an identity colour there is no brand to
  // compile. Failing here is the point — a default would be another brand's.
  const bg = pickColor(brand, "background", { required: true });
  const accent = pickColor(brand, "accent", { required: true });
  const secondary = pickColor(brand, "secondary") ?? accent; // dark key → ink hits AA
  const bgO = toOklch(bg);
  const accentO = toOklch(accent);
  const bgHue = Number.isFinite(bgO.h) ? bgO.h : 30; // warm default

  // --- LIGHT: neutral ramp anchored on the warm brand background --------------
  const lightNeutralDark = hex({ mode: "oklch", l: 0.16, c: Math.min((bgO.c || 0.006) * 2, 0.02), h: bgHue });
  const light = buildTheme({
    bgHex: bg,
    neutralKeys: [bg, lightNeutralDark],
    brandKeys: [accent, secondary], // teal end lets brand-ink hit 4.7 on light
    mode: "light",
  });

  // --- DARK: warm near-black ground, synthesized (auto; hand-refine later) -----
  const darkBg = hex({ mode: "oklch", l: 0.12, c: Math.min(bgO.c || 0.006, 0.012), h: bgHue });
  const darkNeutralLight = hex({ mode: "oklch", l: 0.95, c: Math.min((bgO.c || 0.006) * 1.5, 0.014), h: bgHue });
  const darkInkLight = hex({ mode: "oklch", l: 0.92, c: Math.min(accentO.c || 0.1, 0.11), h: accentO.h ?? 195 });
  const dark = buildTheme({
    bgHex: darkBg,
    neutralKeys: [darkBg, darkNeutralLight],
    brandKeys: [accent, darkInkLight], // light end lets brand-ink read on dark
    mode: "dark",
  });

  const pack = (t) => ({
    background: t.background,
    foreground: t.neutral.foreground,
    card: t.neutral.card,
    "card-foreground": t.neutral.foreground,
    popover: t.neutral.card,
    "popover-foreground": t.neutral.foreground,
    muted: t.neutral.muted,
    "muted-foreground": t.neutral["muted-foreground"],
    secondary: t.neutral.muted,
    "secondary-foreground": t.neutral.foreground,
    accent: t.neutral.muted, // shadcn convention: --accent = neutral hover surface
    "accent-foreground": t.neutral.foreground,
    border: t.neutral.border,
    input: t.neutral.input,
    brand: accent, // identity fill — un-forced
    "brand-foreground": bestForeground(accent),
    "accent-ink": t.ink, // brand-COLORED text, contrast-forced
    ring: accent,
  });

  const hslHue = Math.round(((bgHue % 360) + 360) % 360);
  return {
    themes: { light: pack(light), dark: pack(dark) },
    shadow: { light: `${hslHue} 30% 12%`, dark: "0 0% 0%" },
    type: pickType(brand),
    // Carimbo de proveniência: quando alguém perguntar de onde veio a cor, a
    // resposta viaja junto com o token, não na memória de quem gerou.
    meta: {
      name: brand.name ?? brand.identity?.name ?? null,
      brandId: brand.id ?? null,
      completeness: brand.extraction?.completeness ?? null,
      version: brand.currentVersion ?? null,
      source: brand._source ?? null,
      bgHue: hslHue,
    },
  };
}

export function loadCraft() {
  return craft;
}

// hex → "oklch(l c h)" with stable rounding (determinism + readability).
// Exported so consumers (e.g. the registry theme-item builder) emit the exact
// same string this file writes into CSS — one converter, one source of truth.
export function oklchStr(value) {
  const o = toOklch(value);
  const r = (x, d) => {
    const n = Number(x.toFixed(d));
    return Number.isFinite(n) ? n : 0;
  };
  return `oklch(${r(o.l, 4)} ${r(o.c || 0, 4)} ${r(o.h || 0, 2)})`;
}

export function emitCss(compiled, craft) {
  const { themes, shadow, type, meta = {} } = compiled;
  const colorBlock = (t) =>
    Object.entries(t)
      .map(([k, v]) => `  --${k}: ${oklchStr(v)};`)
      .join("\n");

  const motion = Object.entries(craft.motion)
    .map(([k, v]) => `  --${k}: ${v};`)
    .join("\n");

  const density = (d) =>
    Object.entries(d)
      .map(([k, v]) => `  --${k}: ${v};`)
      .join("\n");

  const provenance = [
    meta.name && `brand: ${meta.name}`,
    meta.brandId && `id: ${meta.brandId}`,
    meta.version != null && `version: ${meta.version}`,
    meta.completeness != null && `completeness: ${meta.completeness}%`,
  ]
    .filter(Boolean)
    .join(" · ");

  return `/* Generated by @visant/brand-tokens. DO NOT EDIT BY HAND. */
/* Layer 1 (identity) derived per-brand + Layer 2 (craft) skeleton. */${
    provenance ? `\n/* ${provenance} */` : ""
  }

:root {
${colorBlock(themes.light)}
  --shadow: ${shadow.light};

  /* Layer 2 — craft invariants (brand-agnostic) */
  --r-control: ${craft.radius.control};
  --r-surface: ${craft.radius.surface};
  --r-pill: ${craft.radius.pill};
  --e-flat: ${craft.elevation.flat};
  --e-raised: ${craft.elevation.raised};
  --e-overlay: ${craft.elevation.overlay};
  --e-modal: ${craft.elevation.modal};
  --focus: ${craft.focus};
${motion}

  /* density — comfortable (acquisition / default) */
${density(craft.density.comfortable)}

  /* type roles */
  --font-sans: '${type.sans}', ui-sans-serif, system-ui, sans-serif;
  --font-display: '${type.display}', ui-sans-serif, system-ui, sans-serif;
}

.dark, [data-theme="dark"] {
${colorBlock(themes.dark)}
  --shadow: ${shadow.dark};
}

/* work surfaces (board, admin, queues) run denser — throughput */
[data-density="compact"] {
${density(craft.density.compact)}
}
`;
}
