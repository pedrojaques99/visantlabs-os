---
name: visant-creative
description: >-
  Gera criativos de social/marketing a partir de um brand do Visant — dois caminhos:
  (1) server-side headless (PNG via creative-generate→creative-render / creative-full),
  (2) Figma editável (use_figma a partir de um card-mestre clonável). Cobre o loop
  completo brand→gerar→renderizar→inspecionar→iterar, quando usar cada caminho, geração
  em lote, e o gap conhecido de fonte (serif fallback) com workaround. Use quando o
  usuário pedir "criar criativo/card/carrossel/anúncio", "gerar post pra marca X",
  "render server-side", "carrossel no Figma", ou citar creative-generate/creative-render.
  Triggers: "criar criativo", "gerar card", "carrossel", "anúncio da marca", /visant-creative.
---

# Visant Creative Pipeline

Gerar criativos brand-aware pela infra Visant. **Antes de qualquer geração:** auth + MCP precisam estar ok — ver [[visant-mcp-connect]]. Se a marca ainda não existe no Visant, criar/popular primeiro com [[visant-brand-populate]].

## Princípio: SSoT
- A **identidade** (cor/fonte/logo/voz) vive **só** no brand guideline do Visant. Nunca hardcode hex/fonte — puxe via `brand-guidelines-get` e passe `brandGuidelineId`.
- O **copy** vem do briefing do cliente. O motor só decide layout.
- Não recrie loaders/engines — os caminhos abaixo já existem.

## Passo 0 — Pegar o contexto da marca
```
brand-guidelines-list                  # achar o id
brand-guidelines-get { id, sections: "visual" }   # cor/typo/tokens p/ inspecionar
```
Guarde `id`, paleta (roles text/accent/bg), `typography[].family`, logos.

## Caminho A — Server-side (PNG headless) · escala / white-label
Melhor pra **volume, lote, entrega de PNG pronto**. Sem Figma. Custo marginal ~0 por peça depois do prompt afinado.

**Uma peça (com background IA):**
```
creative-full { prompt, format: "4:5", brandGuidelineId }
→ { imageUrl, projectId, plan }
```

**Type-only / minimalista (SEM imagem de fundo) — preferir o par generate→render:**
```
creative-generate { prompt, format, brandGuidelineId }      # → plan (JSON em camadas)
creative-render   { plan, format, accentColor }             # → imageUrl (PNG R2)
```
- Para card sólido, force `overlay: { type:"solid", opacity:1, color:"#121212" }` e **não** passe `backgroundImageUrl`.
- `accentColor` colore as palavras em `<accent>…</accent>`.
- **Loop de qualidade:** baixe o `imageUrl`, **inspecione com visão**, ajuste o `plan` e re-renderize. `creative-render` é barato/idempotente.

**Carrossel (N cards):** loop — 1 `creative-generate`+`creative-render` por card (ou `creative-full`). Formato IG feed = `4:5` (1080×1350).

**Lote por dados (CSV/variáveis):** usar Canvas node-graph (`canvas-*`, `canvas-parse-csv`, `canvas-resolve-variables`). **Campanha multi-ângulo:** `campaign-generate` (gera N variações benefit/urgency/lifestyle a partir de produto+brief) → `campaign-status`/`campaign-get`.

### Fonte (resolução automática + fidelidade)
O `creative-renderer` resolve fontes do **@fontsource via jsDelivr** (cobre todo o Google Fonts) e cai em **Inter** como fallback grotesco — nunca mais serif. Ordem por família da marca: WOFF2 enviado → Google Font (`@fontsource/<slug>`) → substituto métrico (`Helvetica/Arial → Arimo`, etc.). Para o cliente:
1. **Fidelidade máxima:** suba um **WOFF2** da fonte real no brand guideline (`brand-guidelines-upload-media`) → o `woff2Url` entra no `typography` e o renderer usa o arquivo exato (ex. Helvetica real em vez do substituto Arimo).
2. **Fonte do Google Fonts:** funciona sozinha — só ter `typography[].family` correta no guideline.
3. Sempre **inspecione o PNG** no loop generate→render→inspect. Detalhes/causa-raiz: `docs/CREATIVE_PIPELINE.md`. Requer Node 18+ no servidor.

## Caminho B — Figma editável · curadoria / entrega que o time edita
Melhor pra peça **única, premium, ou que precisa ficar editável** (ex.: post fixado). Requer a skill `figma-use` carregada antes de `use_figma`.

**Padrão card-mestre + clone (produção em escala dentro do Figma):**
1. Desenhe **um** master component com slots de texto **nomeados** (ex.: `Eyebrow`, `Title`, `Sub`, `Footer`) — 1080×1350, auto-layout, paleta da marca.
2. Produza via clone+override:
   - No plugin **Visant Copilot**: aba Bulk Cards (JSON de dados) ou `canvas.applyOperations` com `CLONE_NODE` + `textOverrides` (match por nome de layer) — ver `plugin/src/handlers/operations.ts` e `socialFrames.ts`.
   - Via MCP `use_figma`: instanciar o component e setar `characters` por slot (carregar fonte → await → mutar → retornar ids).
3. Fonte: o Figma do projeto usa **Noto Sans** como fallback de Helvetica Neue (Helvetica não instalada). Manter consistência.

## Escolha rápida
| Situação | Caminho |
|---|---|
| Lote, white-label, PNG pronto pro feed | **A (server-side)** |
| Variações por produto/coleção, CSV | **A — canvas/campaign** |
| Peça única editável, post fixado, curadoria | **B (Figma)** |
| Prototipar/travar um layout novo | **B**, depois replicar em A |

## Entradas/saídas que importam
- Créditos: `account-profile._meta.credits_remaining` (gerar consome).
- `creative-render` pode retornar `uploadError: "Storage limit exceeded"` mas **ainda devolve `imageUrl`** — use a URL.
- Formatos: `1:1`, `4:5` (1080×1350, feed), `9:16` (story), `16:9`.

Refs no repo: `server/routes/creative.ts`, `server/lib/creative-renderer.ts`, `server/lib/creative-plan-engine.ts`, `plugin/src/handlers/`. Doc de arquitetura: `docs/CREATIVE_PIPELINE.md`.
