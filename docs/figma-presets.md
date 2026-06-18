# Figma Presets — the naming convention IS the API

A **preset** is a reusable Figma design (post, card, banner, slide) that Visant fills
with a brand's content + theme **deterministically** — no AI inventing layout. This
one page is the whole contract. A human authors a preset by _naming layers_; any AI
reads the auto-derived **manifest** and fills it. Same rules for both.

> Golden rule: **the AI only supplies slot CONTENT + brand TOKEN VALUES. It never
> touches geometry.** Layout = the template. Theme = variable modes. Content = slots.

---

## 1. Make a preset (for a human — 3 steps, no code)

1. **Name the frame** `[Template] <Name>` — e.g. `[Template] Launch Post`.
2. **Mark fillable layers** by prefixing the layer name with `#`:
   - `#h1`, `#h2`, `#cta` — a **TEXT** layer → a text slot.
   - `#photo1`, `#logo` — a **rectangle/frame/shape with a fill** → an image slot.
   - Suffix `?` = **optional** (`#h2?`): hidden when not provided.
   - Suffix `[]` = **list / multi-line** (`#infos[]`): joined line-by-line.
3. **Theme with variables.** Create a variable collection named `Brand`, add variables
   named after the token roles below, and **bind** your fills/text to them. Swapping the
   brand re-themes the whole preset.

That's it. No config files — the layer names self-describe the preset.

## 2. The token vocabulary (variable names in the `Brand` collection)

| Kind           | Variable names                                                                         |
| -------------- | -------------------------------------------------------------------------------------- |
| Color          | `accent`, `accent-text`, `primary`, `secondary`, `bg`, `surface`, `text`, `text-muted` |
| Font (STRING)  | `heading-font`, `body-font`                                                            |
| Number (FLOAT) | `radius-sm`, `radius-md`, `radius-lg`                                                  |

Bind a heading's fill to `accent`, body text to `text`, the card bg to `bg`, etc. Only
use names from this list — they map 1:1 to what a brand provides. (SSoT: `BRAND_TOKEN_VARS`
in `src/lib/figma-slots.ts`.)

## 3. The manifest (what an AI sees)

Scanning a `[Template]` frame yields a `TemplateManifest`:

```jsonc
{
  "id": "123:45", "name": "Launch Post", "width": 1080, "height": 1350, "aspect": "4:5",
  "slots": [
    { "id": "h1", "type": "text", "optional": false, "list": false, "nodeId": "…", "sample": "Big news" },
    { "id": "infos", "type": "text", "optional": true, "list": true, "nodeId": "…" },
    { "id": "photo1", "type": "image", "optional": false, "list": false, "nodeId": "…" },
    { "id": "logo", "type": "image", "optional": true, "list": false, "nodeId": "…" }
  ],
  "variables": [ { "name": "accent", "type": "COLOR", "collectionName": "Brand" }, … ]
}
```

The AI's job is purely: pick the template whose slots fit the request, then produce a
**flat fill** keyed by slot id. Each template owns its own slot set — there is **no fixed
global schema**; the library spans varied manifests and the AI adapts per request.

## 4. Fill a preset (for an AI — one deterministic op)

Get the brand's token values: `GET /api/brand-guidelines/:id/figma-variables` →

```json
{
  "collectionName": "Brand",
  "modeName": "Lola",
  "values": [
    { "name": "accent", "type": "COLOR", "value": { "r": 0.48, "g": 0.22, "b": 0.93, "a": 1 } },
    { "name": "heading-font", "type": "STRING", "value": "Fraunces" }
  ]
}
```

Then emit ONE `FILL_TEMPLATE` operation (validated against the manifest before it runs):

```jsonc
{
  "type": "FILL_TEMPLATE",
  "templateName": "Launch Post", // or templateNodeId
  "clone": true, // fill a copy; master stays pristine
  "slots": {
    "h1": "Volta às aulas",
    "infos": ["12/06", "R$99", "link na bio"], // list → joined lines
    "photo1": { "imageUrl": "https://…/hero.jpg" },
    "logo": { "imageHash": "…" },
    "h2": null, // optional + null → layer hidden
  },
  "brandMode": {
    // straight from /figma-variables
    "collectionName": "Brand",
    "modeName": "Lola",
    "values": [
      { "name": "accent", "type": "COLOR", "value": { "r": 0.48, "g": 0.22, "b": 0.93, "a": 1 } },
    ],
  },
}
```

The plugin then: clones the template → fills each `#slot` (text via `loadFont`+`characters`,
image via `createImageAsync`) → hides omitted optional slots → adds a `Lola` **mode** to the
`Brand` collection, writes the values, and switches the frame to it (`setExplicitVariableModeForCollection`).
Figma's resolver does the retheme — reproducible, zero hallucination.

## 5. Two libraries

- **Generic** — `[Template]` frames with semantic `Brand` variables (default mode). Reusable across brands.
- **Per-brand** — when it's a Visant-managed brand, persist that brand's **mode** (its token values).
  Switching a template to the brand's mode re-themes any preset instantly.

## Validation

`validateSlotFills(manifest, fills)` (in `src/lib/figma-slots.ts`) checks required slots are
present and typed correctly **before** touching Figma — so a wrong fill fails fast, never
silently. Author presets so every required slot has a sensible default sample.
