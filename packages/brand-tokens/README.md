# @visant/brand-tokens

Brand Token Engine — turns a brand's few identity values (colors + type) into a
full, two-theme design-token system with **WCAG AA guaranteed by construction**.

## The 2-layer model

- **Layer 1 — Identity** (per-brand, derived): color ramp, brand fill, brand-ink,
  on-color foregrounds, shadow hue, type roles. Comes from the brand.
- **Layer 2 — Craft** (invariant, `craft.json`): radius roles, elevation, focus,
  density, motion. These encode throughput/hierarchy/a11y and **never vary per
  brand** — the engine plugs Layer 1 into this fixed skeleton, it does not derive it.

Deriving the invariant layer per brand would reintroduce genericness-by-randomness.
The engine's job is to derive only what the brand data honestly justifies (color +
type) and guarantee contrast.

## How it works

`compileBrandTokens(brand)` uses [Adobe Leonardo](https://github.com/adobe/leonardo)
to generate every color at a **target contrast ratio** against the resolved
background, so no derived text/background pair fails AA. Neutrals inherit the brand
background's hue (warm-true, not pure grey). Dark mode is synthesized automatically
(hand-refine later via overrides). The brand's own secondary seeds the accent-ink.

## Usage

```bash
node scripts/build.js [path/to/brand.json]   # defaults to the Visant fixture
# → prints the AA report, writes dist/visant.tokens.css (OKLCH, Tailwind v4)
npm test                                      # 17 tests; AA verified independently via culori
```

Brand seed shape: `{ colors: [{hex, role}], typography: [{family, role}] }`, roles
= background/text/accent/secondary/primary and primary/secondary. See
`src/fixtures/visant.json`.

## Output tokens

Semantic (shadcn names): `background, foreground, card, popover, muted,
muted-foreground, secondary, accent, border, input` + `brand` (identity fill),
`accent-ink` (brand-colored text, contrast-forced), `ring`, `shadow`. Craft:
`--r-control/-surface/-pill`, `--e-flat/-raised/-overlay/-modal`, `--focus`,
`--pad-card`/`--control-h` (+ `[data-density="compact"]`), motion, `--font-sans/-display`.

## Status

v0: seeds from a JSON fixture; emits `dist/` for inspection. Roadmap: live API
fetch by brand id, Style Dictionary emit, plug into consuming apps. Consumed by the
`visant-new-site` skill's token step.
