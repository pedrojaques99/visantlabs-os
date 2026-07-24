import { describe, it, expect } from "vitest";
import { wcagContrast, converter } from "culori";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { compileBrandTokens, emitCss, loadCraft } from "../src/engine.js";

const here = dirname(fileURLToPath(import.meta.url));
const brand = JSON.parse(readFileSync(join(here, "../src/fixtures/visant.json"), "utf8"));
const toOklch = converter("oklch");

const compiled = compileBrandTokens(brand);
const craft = loadCraft();

// The trust anchor: derived semantic pairs must pass WCAG AA, verified with an
// INDEPENDENT engine (culori), not by trusting Leonardo's own claim.
describe("contrast gate (AA) — the whole point", () => {
  for (const mode of ["light", "dark"]) {
    const t = compiled.themes[mode];
    it(`${mode}: body text (muted-foreground) on background ≥ 4.5`, () => {
      expect(wcagContrast(t["muted-foreground"], t.background)).toBeGreaterThanOrEqual(4.5);
    });
    it(`${mode}: primary text (foreground) on background ≥ 7`, () => {
      expect(wcagContrast(t.foreground, t.background)).toBeGreaterThanOrEqual(7);
    });
    it(`${mode}: brand-colored text (accent-ink) on background ≥ 4.5`, () => {
      expect(wcagContrast(t["accent-ink"], t.background)).toBeGreaterThanOrEqual(4.5);
    });
    it(`${mode}: label on a brand fill (brand-foreground on brand) ≥ 4.5`, () => {
      expect(wcagContrast(t["brand-foreground"], t.brand)).toBeGreaterThanOrEqual(4.5);
    });
    it(`${mode}: foreground on card ≥ 4.5`, () => {
      expect(wcagContrast(t.foreground, t.card)).toBeGreaterThanOrEqual(4.5);
    });
  }
});

// The "chosen neutral" — derived neutrals must carry the brand background's
// warmth, not be pure grey (chroma 0). This is what escapes the shadcn default.
describe("neutral is chosen, not defaulted", () => {
  it("light neutrals carry chroma from the warm brand background", () => {
    const border = toOklch(compiled.themes.light.border);
    const muted = toOklch(compiled.themes.light.muted);
    expect(border.c).toBeGreaterThan(0.002);
    expect(muted.c).toBeGreaterThan(0.002);
  });
});

// Invariants come from craft.json verbatim — the engine must NEVER derive them.
describe("invariants are fixed, not per-brand", () => {
  const css = emitCss(compiled, craft);
  it("radius roles present and equal to craft.json", () => {
    expect(css).toContain(`--r-control: ${craft.radius.control}`);
    expect(css).toContain(`--r-surface: ${craft.radius.surface}`);
    expect(css).toContain(`--r-pill: ${craft.radius.pill}`);
  });
  it("elevation, focus, density-compact context present", () => {
    expect(css).toContain("--e-flat:");
    expect(css).toContain("--e-raised:");
    expect(css).toContain("--focus:");
    expect(css).toContain('[data-density="compact"]');
  });
  it("motion tokens carried by reference (not reinvented)", () => {
    expect(css).toContain("--ease-out:");
    expect(css).toContain("--dur-press:");
  });
});

// Same brand → same tokens. No randomness allowed in a token pipeline.
describe("deterministic", () => {
  it("compiling twice yields identical output", () => {
    const a = emitCss(compileBrandTokens(brand), craft);
    const b = emitCss(compileBrandTokens(brand), craft);
    expect(a).toBe(b);
  });
});

describe("shape sanity", () => {
  const css = emitCss(compiled, craft);
  it("emits a real stylesheet with both themes", () => {
    expect(css.length).toBeGreaterThan(600);
    expect(css).toContain(":root");
    expect(css).toMatch(/\.dark|data-theme="dark"/);
    expect(css).toContain("--brand:");
  });
  it("preserves the brand identity color as --brand (fill, un-forced)", () => {
    // --brand is the raw identity accent, not contrast-forced.
    expect(compiled.themes.light.brand.toLowerCase()).toBe("#52ddeb");
  });
});
