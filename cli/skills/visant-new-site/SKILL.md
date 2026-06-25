---
name: visant-new-site
description: |
  Create a new client website from the Visant site template. Clones the template repo, pulls
  branding from Visant MCP, derives a unique visual concept FROM the brand's own Figma layouts,
  hydrates tokens/copy, and uses the real brand assets (logos, pattern system, mockup photos as
  WebP) in every fold. Guides deployment.
  USE FOR:
  - Creating a new client website ("novo site", "new site", "criar site pro cliente")
  - Starting a project from the visant-site-template
  - Hydrating a blank site template with a brand's identity
  - When user mentions a client name + "site" or "website" together
  - When user wants to translate a branding into a functional website
  Trigger even if the user doesn't say "Visant" — any new client site request should use this workflow.
---

# Visant New Site

Create a client website by cloning the Visant site template and hydrating it with brand identity.
The template provides the full stack — what changes per client is the **brand layer**: colors,
typography, copy, the **visual concept**, and the **real brand assets** (logo, pattern, photos).

## The Core Insight

Every brand has a strategic narrative AND, usually, an existing visual system (Figma layouts,
mockups, a graphic kit). **Do not invent a generic look.** The job is to translate the brand's
own design language into a working site. Two non-negotiables learned the hard way:

1. **Derive the concept from the brand's existing layouts**, not from your imagination. If the
   brand has web/social mockups in Figma, pull them (`get_design_context` / `get_screenshot`) and
   match them: hero treatment, type scale, color field, graphic devices.
2. **Use the real assets in every fold.** Brands ship logos, a pattern/graphic system (vectors),
   and mockup photography. Wire the actual files in — hero, about, portfolio, etc. Placeholders
   are a fallback, never the deliverable. Generic stock-feel + invented patterns = AI slop.

> Example (Comunicart®, exhibition architecture): the brand's Figma had a desktop mockup —
> full **orange field**, white Funnel Display headline, photo collage, the brand **tessellation**
> faint in the corner. The site matched that 1:1, used the brand's real pattern SVG and 11 stand
> mockup photos (converted to WebP), and read as *that* brand instead of a template.

## Stack (Fixed)

- Next.js App Router + Tailwind v4 + TypeScript
- next-intl (i18n) + next-themes (dark/light)
- Sanity CMS (portfolio) + Resend (contact form) + Cal.com (scheduling)
- Framer Motion (animations) + Vercel (deploy)

## Template Repo

`pedrojaques99/visant-site-template` (private GitHub repo)

### Files the skill modifies

| File | What changes |
|------|-------------|
| `app/globals.css` | Color tokens in `@theme {}` and `.dark {}`; add `--font-display` |
| `app/[locale]/layout.tsx` | Font loading (next/font/google), metadata, locale guard |
| `components/layout/ThemeProvider.tsx` | `defaultTheme` to match the brand's primary mode |
| `components/layout/Navbar.tsx` | Transparent-over-hero + scroll-solidify state; logo color |
| `components/layout/MobileMenu.tsx` | Drop locale switcher if single-locale |
| `messages/<locale>.json` | All copy, in the brand voice |
| `components/icons/Logo.tsx` | Brand logo (CSS mask of the real SVG, aspect locked) |
| `components/pattern/GenerativePattern.tsx` | Brand graphic device (real pattern, not invented) |
| `components/sections/*` | Real imagery in every fold; brand type/spacing |
| `components/seo/JsonLd.tsx`, `package.json` | Business data, project name |
| `public/brand/**` | Logo SVG, pattern vectors, mockup photos as WebP |
| `lib/i18n/routing.ts`, `lib/i18n/request.ts` | Locale list |

---

## Workflow

### Step 1: Intake

Ask only what you can't derive: client name, Visant branding ID (or help find it via
`brand-guidelines-list` / `branding-list`), target domain, locales, local path
(suggest `Z:\Cursor\@Clients - Web\<name>`).

### Step 2: Clone & Setup

```bash
git clone https://github.com/pedrojaques99/visant-site-template.git "<target-path>"
cd "<target-path>" && git remote remove origin && npm install
# create the client repo only when the user asks (gh repo create ... --private --source=. --push)
```

### Step 3: Pull Brand Context (SSoT)

`mcp__visant__brand-guidelines-get <id>` — colors, typography, voice, strategy, manifesto,
archetypes, logos. Extract colors+roles, fonts+roles, archetypes, positioning, voice, the
**manifesto** (use it as real copy), and logo asset URLs.

### Step 4: Visual Concept — derive it from the brand, don't invent

1. **Look at the brand's existing layouts first.** If there's a Figma file, open the relevant
   nodes: `get_metadata` to find a "Layouts" section / desktop mockup / hero frames, then
   `get_screenshot` them. Match what's there.
2. Identify the **core metaphor** and the **signature graphic device** (a pattern, a shape system,
   a photo treatment). Reuse the brand's actual device.
3. Present 2-3 concept directions **with ASCII/preview** and wait for confirmation. Offer the one
   that matches the brand's own mockups as the recommended path.

### Step 5: Hydrate Tokens

- **Colors** → `app/globals.css` `@theme {}` and `.dark {}`. Keep the semantic token names
  (background, foreground, primary, accent, muted, surface); map brand colors onto them. Pick a
  warm/brand-true dark background (don't default to grey).
- **Type** → `next/font/google` (e.g. `Funnel_Sans`/`Funnel_Display`) or `next/font/local`. Add a
  `--font-display` variable and apply it to `h1..h4` in `@layer base`.
- **ThemeProvider** → set `defaultTheme` to the brand's primary mode (e.g. `light` for a warm
  brand), `enableSystem={false}` so the brand look is the default.
- **Logo** → download the real SVG to `public/`, render via CSS mask so it inherits a brand color
  and **locks aspect ratio** (`aspectRatio: 'W / H'`); never set width & height independently
  (distortion) and never flatten. See [[visant-figma-plugin]] no-flatten rule.
- **Copy** → `messages/<locale>.json`, in the brand voice; lift the manifesto verbatim where it
  fits. Use placeholders `« … »` for client-only data (team names, contacts, domain).
- **SEO/package** → JsonLd LocalBusiness + metadata; `package.json` name/description.

### Step 5b: Single-locale (when the client wants one language)

`routing.ts` → `locales: ['pt-BR']`, `localePrefix: 'as-needed'` (clean URLs). Update the
`as 'pt-BR'` casts in `routing`/`request.ts`, delete the other `messages/*.json`, remove the
locale switcher from `Navbar.tsx` + `MobileMenu.tsx` (and their unused `useLocale/useRouter`
imports), drop the EN `alternates.languages` in layout metadata.

### Step 6: Real Brand Assets — the highest-impact step

Brands keep an asset/elements folder (logos, **pattern/graphic system** as SVG, **mockup
photos**). Wire the real files in:

1. **Find them.** Ask for / locate the brand asset folder. Inventory vectors vs raster vs photos.
2. **Convert raster to WebP** (huge originals → ~25-300 KB) with ImageMagick:
   ```bash
   magick "in.png" -resize '1500x1500>' -strip -quality 80 "public/brand/mockups/out.webp"
   ```
   Keep SVGs as SVG (already light). Build a labelled contact sheet to pick the best shots:
   `magick montage *.png -label '%f' -tile 6x -geometry 220x150 sheet.png`.
3. **Use them in every fold** via `next/image` (fill + sized container + `sizes`):
   - **Hero** → collage of 2-3 real photos (overlapping, slight rotation), brand pattern faint
     behind.
   - **Manifesto/About** → one strong environment photo anchoring the text.
   - **Portfolio** → if Sanity is empty, replace the "coming soon" empty state with a **curated
     gallery** of real mockups (don't ship an empty section).
   - **Education/Services/Contact** → detail shots / pattern backgrounds as fitting.
4. **Graphic system** → copy the brand's pattern/shape **vectors** to `public/brand/graphic/`
   (grab colored variants). Render the tessellation via CSS mask + `currentColor` so it tints
   tone-on-tone. Prefer the brand's real pattern over anything generated.

### Step 7: Polish — kill the AI slop

- **No em-dashes (—) anywhere**, including code comments — it's the #1 AI tell. Use commas,
  colons, or the brand's own separator (e.g. `·`). Sweep:
  `grep -rl $'—' components app messages | xargs sed -i 's/ — / · /g; s/—/·/g'`.
- No generic marketing filler ("solutions", "elevate", "journey", "unique experiences"). Copy
  comes from the brand manifesto/voice.
- Generous breathing room (`py-32 lg:py-40`), brand display font on headings, brand-color eyebrows,
  rounded cards (`rounded-2xl/3xl`) if the brand is warm/rounded.
- Navbar: transparent over a full-bleed hero (white content), solidify + switch to brand colors on
  scroll (`window.scrollY > 40`); remove the layout's `pt-16` so the hero goes full-bleed.

### Step 8: Test, self-review, deploy

- `npx tsc --noEmit` (0 errors) + `npm run dev`; verify `GET /` 200 and asset 200s
  (`curl -s -o /dev/null -w "%{http_code}" http://localhost:<port>/brand/mockups/x.webp`).
- **Self-screenshot** the hero with headless Edge/Chrome:
  `msedge --headless --disable-gpu --hide-scrollbars --virtual-time-budget=5000
  --window-size=1440,900 --screenshot=out.png http://localhost:<port>/` then Read the PNG.
  **Caveat:** sections wrapped in `ScrollReveal`/IntersectionObserver render blank in headless and
  anchor (`/#section`) scrolling is unreliable — verify below-fold folds by curling the rendered
  HTML for their text + checking asset 200s instead of trusting a blank capture.
- Deploy: `npx vercel`, set env (Sanity, Resend), custom domain, verify prod build.

---

## Decision Log

Keep a short log: visual concept chosen + why, deviations from template, client-specific
requirements, branding ID. Offer to save key decisions to the project's CLAUDE.md or memory.
