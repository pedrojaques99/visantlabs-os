# Populate the layout database — Figma `[Template]` frames → live webapp preview

You design a layout **once** in Figma. A "Sync" reads that frame into a normalized
**schema** (geometry + which brand variable each color is + which content each text is)
and stores it on the brand (`syncedTemplates`). The webapp's **Preview** tab then renders
it as live DOM — recolored to any brand, editable, exportable — with **zero hand-written
React per layout**. Edit the frame, re-sync, the preview reflects.

```
[Template] frame ──sync──▶ TemplateSchema[] ──▶ brand.syncedTemplates (DB)
                                                      │
                                              webapp Preview tab
                                        <TemplateRenderer> (live DOM, per brand)
```

> This reuses the exact naming convention in **[figma-presets.md](./figma-presets.md)**
> (`[Template]`, `#slots`, the `Brand` variable collection). Read that first — this page
> only adds the **sync → preview** half. SSoT: `src/lib/figma-slots.ts` +
> `src/lib/figma-template-schema.ts`.

---

## 1. Author a layout (no code)

1. **Name the frame** `[Template] <Name>` (e.g. `[Template] Editorial Hero`). Its
   width×height becomes the artboard; anything can go inside.
2. **Bind every color to a `Brand` variable** — never a raw hex. Create a variable
   collection named `Brand` with the token-role names below and bind fills/strokes/text
   to them. This is what makes the layout **brand-agnostic**: swap the brand → the whole
   thing recolors.

   | Kind  | Variable names |
   |-------|----------------|
   | Color | `accent`, `accent-text`, `primary`, `secondary`, `bg`, `surface`, `text`, `text-muted` |
   | Font  | `heading-font`, `body-font` (STRING) |

3. **Mark editable text with a `#slot` name** (see the map in §2). `?` = optional
   (hidden when empty), `[]` = list.
4. **Mark image areas** `#photo1` / `#logo` (a rectangle/frame with a fill).

That's the whole contract. The layer names self-describe the layout — no config files.

---

## 2. Slot → content map (what each `#slot` becomes in the preview)

The renderer fills text slots from the brand's own content. Name your text layers with
these ids to bind them:

| `#slot`         | Renders as (from the brand) |
|-----------------|-----------------------------|
| `#h1`           | headline — first sentence of the manifesto (or tagline / name) |
| `#brand`        | brand name (e.g. the big wordmark) |
| `#tagline`      | tagline |
| `#tagL` / `#tagR` | tagline split into two halves (for split lockups) |
| `#body`         | body copy — first sentence of the description |
| `#caption`      | short caption (tagline) |
| `#kw1` … `#kwN` | brand keywords (from values/aesthetic tags), 1-based |
| `#photo1`, `#logo` | brand photo / logo (image slot) |

Anything **not** named `#…` is treated as literal design (kept exactly as drawn). The
mapping lives in `src/components/brand/guidelines/preview/templateResolve.ts::resolveSlot`
— add a case there to support a new slot id.

> **Text overrides**: in the preview, each card has an "Editar" panel — Marca / Tagline /
> Headline / Corpo — that overrides `#brand` / `#tagline` / `#h1` / `#body` per design.

---

## 3. Sync — populate the database

From the **Visant Copilot plugin** (with the brand's Figma file open):

1. Make sure the current page holds your `[Template]` frames.
2. Hit **Sincronizar templates**. Under the hood the plugin runs
   `templates.extractSchema` → parses each frame → `POST /api/brand-guidelines/:id/synced-templates`.
3. The schemas are stored on `brand.syncedTemplates` and `figmaSyncedAt` is stamped.

Now open the brand's **Preview** tab in the webapp → a **"Sincronizado do Figma"** section
renders every synced layout, live and on-brand. Re-sync after any edit to update.

_Programmatic path (agents/scripts): call the `templates.extractSchema` op, then POST the
`{ templates }` result to the same endpoint with a bearer token._

---

## 4. What gets captured

| Captured ✅ | Not captured ⚠️ |
|---|---|
| Position + size + **rotation** (as a transform matrix) | Drop shadows / blur / other effects |
| Corner radius, opacity, clip | Gradients, image fills baked in the frame |
| Solid fills → **bound variable name** (or literal hex) | Strokes (add if needed) |
| Text: content, font family/style/size, align, case, letter-spacing, line-height | Auto-layout is **baked to absolute** positions at sync time |
| `#slot` bindings + font-variable bindings (`heading-font`/`body-font`) | |

Auto-layout is fine to design with — it's flattened to fixed positions when synced. If you
change content lengths later, re-sync.

---

## 5. Gotchas

- **Fonts.** Use `Unbounded` (→ heading) / `Kumbh Sans` (→ body), or bind the text's font
  to the `heading-font` / `body-font` variable. Other literal families won't load in the
  webapp and fall back to a system font.
- **Fit-to-box.** Slot text auto-shrinks to fit the layer's box (never overflows/crops).
  So **size the text layer's box to the space you want the copy to occupy** — a tall/wide
  box lets long copy stay big; a tight box shrinks it.
- **Images fill at runtime.** `#photo1` / `#logo` show a placeholder in the synced schema;
  the real brand photo/logo is resolved when rendered (the sandbox can't fetch images).
- **Rotation works**, but keep rotated text on its own layer/box for predictable fit.
- **Recolor for free.** Because fills are variables, each preview card can cycle color
  **combinations** and the layout recolors — no re-sync needed.

---

## 6. Verify / troubleshoot

- **Nothing shows in "Sincronizado do Figma"?** The GET returns `[]` until a sync runs and
  until `npx prisma generate` has been run after the `syncedTemplates` field was added
  (stop the dev server first on Windows). Confirm the POST returned `{ ok: true, count }`.
- **A color didn't recolor?** That fill wasn't bound to a `Brand` variable — it was
  captured as a literal hex. Bind it and re-sync.
- **Text shows the wrong content?** Check the `#slot` id against the map in §2 (e.g. a
  wordmark should be `#brand`, not `#h1`).

---

## 7. Architecture (for maintainers)

| Piece | File |
|---|---|
| Schema + pure parser | `src/lib/figma-template-schema.ts` (`frameToSchema`) |
| Naming/variable SSoT | `src/lib/figma-slots.ts` (`parseSlotName`, `BRAND_TOKEN_VARS`) |
| Plugin producer | `plugin/src/handlers/templates.ts` (`extractTemplateSchemas`, op `templates.extractSchema`) |
| Server store | `server/routes/brand-guidelines.ts` (`GET/POST /:id/synced-templates`), `prisma` `syncedTemplates` |
| Webapp fetch | `src/services/brandGuidelineApi.ts` + `src/hooks/queries/useBrandGuidelines.ts` (`useSyncedTemplates`) |
| Renderer | `src/components/brand/guidelines/preview/TemplateRenderer.tsx` + `templateResolve.ts` |

Adding a template = design it in Figma + sync. No React. That's the point.
