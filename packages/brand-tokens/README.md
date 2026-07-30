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
node scripts/build.js                          # the Visant fixture
node scripts/build.js src/fixtures/hockey-direct.json
node scripts/build.js --brand <brandId>        # live, needs VISANT_API_TOKEN
# → prints the AA report, writes dist/<brand-slug>.tokens.css (OKLCH, Tailwind v4)
npm test                                       # 39 tests; AA verified independently via culori
```

Brand seed: `{ id, name, colors: [{hex, role, usageRank}], typography: [{family, role, size}] }`.
Fixtures for three real brands live in `src/fixtures/`. A build that emits a
failing contrast pair exits non-zero — it must not look like a success.

## Role resolution — a chain, not a lookup

**Brands do not share a role vocabulary.** Sampled from the live API, 2026-07-30:

| Brand | colour roles | type roles |
|---|---|---|
| Visant® | background · primary · secondary · accent · text | primary · secondary |
| Hockey Direct | background · surface · secondary · accent · accent-secondary · text-on-dark · muted · text | display · body · label · feature |
| Days n' Days | text · accent | heading |

Every slot resolves through a **fallback chain**, then by `usageRank`, and
**throws** when nothing matches. Two silent bugs this fixed:

1. **Cross-brand font leak.** The old lookup read only `typography[role=primary|secondary]`
   and defaulted to `Manrope`/`Oswald`. Hockey Direct — roles `display/body/label` —
   compiled with **Visant's fonts**, no error. A whole site would have shipped
   off-brand, and only a human eye would have caught it.
2. **Inverted type mapping.** Visant labels its 96px Manrope `primary` and its
   16px Oswald `secondary`; the old map sent `primary`→`--font-sans` and
   `secondary`→`--font-display`, putting a body face in the headlines. `size` is
   now the tiebreaker when role names are ambiguous.

A single-face brand (Days n' Days) correctly gets the same family in both roles —
a brand decision, not a gap, so the engine does not invent a second face.

## Provenance

Every compile carries `meta { name, brandId, version, completeness }` and states
it in the emitted CSS. When someone asks where a colour came from, the answer
travels with the file:

```css
/* brand: Hockey Direct · id: 6a35570c13ded9555a7435d7 · version: 10 · completeness: 36% */
```

**`completeness` is not a token-readiness score.** Hockey Direct sits at 36% with
the richest colour and type data of the three; Days n' Days sits at 64% with three
colours and one face. Gate on whether the slots resolve, not on the number.

## Output tokens

Semantic (shadcn names): `background, foreground, card, popover, muted,
muted-foreground, secondary, accent, border, input` + `brand` (identity fill),
`accent-ink` (brand-colored text, contrast-forced), `ring`, `shadow`. Craft:
`--r-control/-surface/-pill`, `--e-flat/-raised/-overlay/-modal`, `--focus`,
`--pad-card`/`--control-h` (+ `[data-density="compact"]`), motion, `--font-sans/-display`.

## Status

**v0.1 — fit to use.** Seeds from a fixture *or* live by brand id
(`src/fetch-brand.js`). Role resolution is chain-based and fails loud. Output is
named per brand. 39 tests, AA verified independently across all three brands.

Next: expose as the dynamic `registry:theme` route at `ui.visantlabs.com/r/theme-{brandId}.json`,
so `npx shadcn add @brand/<brandId>` installs a client's tokens in one command.
See `Z:\Cursor\Vintageuiuxlibrary\VISANT-REGISTRY-PLANO.md`.

Consumed by the `visant-new-site` skill's token step.
