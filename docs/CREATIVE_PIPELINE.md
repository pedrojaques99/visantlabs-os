# Creative Pipeline — arquitetura & referência

Como a infra gera criativos brand-aware, os dois caminhos de render, e o gap de fonte.
Para o **how-to operacional** (sequência de chamadas, prompts, loop), use a skill
`visant-creative` (`cli/skills/visant-creative/SKILL.md`) — este doc é a referência de
arquitetura, não repete os passos.

## Dois caminhos de render (mesma identidade, saídas diferentes)

| | Server-side (headless) | Figma (editável) |
|---|---|---|
| Engine | `@napi-rs/canvas` | Figma Plugin API |
| Entrada | plan JSON (camadas) | nós/instâncias |
| Saída | PNG (R2) | nó editável no arquivo |
| Uso | volume, white-label, PNG pronto | curadoria, peça editável |
| Fonte | registro via `GlobalFonts` (ver gap) | fontes do Figma (Noto Sans fallback) |

São **caminhos distintos** — não compartilham loader de fonte. O que compartilham é a
**fonte-da-verdade da identidade**: `BrandGuideline` (cores, `typography`, logos, voz).

## Entry points

- `server/routes/creative.ts`
  - `POST /api/creative/plan` (:53) — prompt + brand → plan (Gemini, brand-aware). Snapa cor/fonte ao guideline.
  - `POST /api/creative/render` (:160) — plan + bg URL → PNG → R2.
  - `POST /api/creative/generate-from-brand` (:221) — load brand → plan → render (tem o brand em mãos).
- `server/lib/creative-plan-engine.ts` — montagem do plan (Gemini, schema Zod em `creative-schema.ts`).
- `server/lib/creative-renderer.ts` — `renderCreativePlan(plan, options)` → Buffer PNG.
- MCP tools: `creative-generate`, `creative-render`, `creative-full`, `campaign-generate`, `canvas-*`.
- Figma: `plugin/src/handlers/operations.ts` (`applyOperations`/`CLONE_NODE`+`textOverrides`), `socialFrames.ts`.

## Gap conhecido: fallback serif no render server-side

**Sintoma:** criativos server-side saem em **serif**, fora da marca (que é grotesca).

**Causa-raiz** — `server/lib/creative-renderer.ts`:
- `ensureFonts()` (~:134) só tenta registrar **"Inter"** em 3 paths fixos
  (`/usr/share/fonts/...`, `assets/fonts/Inter-Regular.ttf`). **Nenhum existe** no repo/container,
  não há `@fontsource` instalado → `GlobalFonts` não registra nada.
- O fill usa `fontFamily = layer.fontFamily ?? 'Inter, sans-serif'` (~:287) — mas como nada foi
  registrado, `@napi-rs/canvas` cai na sua família default (serif-like).
- `BrandGuideline.typography[].family` (a fonte da marca, ex. "Helvetica Neue LT") e qualquer
  `woff2Url` **nunca chegam** ao renderer — `/render` não recebe brand fonts.

**Fix implementado (SSoT — fontes vêm do mesmo CDN que o caminho Puppeteer já usa):**
`server/lib/creative-renderer.ts` não bundla fonte; resolve do **@fontsource via jsDelivr**
(`cdn.jsdelivr.net/npm/@fontsource/<slug>@5/files/<slug>-latin-<weight>-normal.woff2`), que cobre
todo o Google Fonts (1500+ famílias). Reusa `fontSlug()` de `brand-fonts.ts` (SSoT do slug).
1. `RenderOptions` ganha `fonts?: { family; url? }[]` + `defaultFontFamily?`.
2. `ensureFonts(fonts)`: base garante **Inter** (CDN) p/ fallback grotesco; por família da marca,
   ordem — (a) `url` de WOFF2 enviado → `GlobalFonts.register(buffer, family)` (fidelidade total);
   (b) `@fontsource/<slug>` → qualquer Google Font; (c) **substituto métrico** p/ famílias não-Google
   (`helvetica/helvetica neue/arial → arimo`, `times → tinos`, etc.), registrado sob o nome original.
3. `pickFamily()` no draw: usa a família pedida se registrada, senão tira o sufixo de peso
   (`"Inter Bold" → "Inter"`), senão `defaultFontFamily`, senão `Inter` — **nunca cai em serif**.
4. `/render` e `/generate-from-brand` derivam `fonts`/`defaultFontFamily` de `brandGuideline.typography`.

Requer **Node 18+** (usa `fetch` global). Sem rede/cold-start sem CDN, cai em Inter local (`assets/fonts`)
se presente, senão fallback do canvas.

**Fidelidade máxima** ainda vem de um **WOFF2 próprio** no guideline (ex. Helvetica real, não o
substituto métrico Arimo). Marcas com fonte só *citada* (ex. Days n' Days → "Helvetica Neue LT")
caem no substituto — documente e prefira subir o WOFF2 via `brand-guidelines-upload-media`.

## Notas operacionais
- `creative-render` pode retornar `uploadError: "Storage limit exceeded"` e **ainda** um `imageUrl` válido.
- Formato IG feed = `4:5` (1080×1350).
- Gerar consome créditos (`account-profile._meta.credits_remaining`).
