---
name: visant-mcp-connect
description: Setup and use the Visant Labs MCP server — brand management, AI mockups, creative studio, canvas, budgets, moodboards, PDF extraction, campaigns, smart analysis, and more. Trigger when user mentions Visant, wants to connect to the Visant API, asks about brand tools, PDF extraction via MCP, or says anything like "conecta o visant", "quero usar as tools do visant", "setup visant mcp".
tags:
  - mcp
  - visant
  - brand
  - ai-tools
---

# Visant Labs MCP

**API:** `https://api.visantlabs.com`
**MCP:** `https://api.visantlabs.com/api/mcp`
**Auth:** OAuth 2.1 + PKCE (dynamic client registration) or API Key (`visant_sk_...`)
**Tools:** 93 (Platform MCP) + 15 (Figma MCP)

---

## Conectar (fluxo Claude-first)

### Passo 1 — Verificar se já tem credenciais

```bash
cat ~/.visant/credentials.json
```

Se existir e tiver `apiKey`, pule para o Passo 3.

### Passo 2 — Autenticar

Peça o email e senha ao usuário, depois rode:

```bash
npx visantlabs login -e EMAIL -p SENHA
```

Isso salva `~/.visant/credentials.json` com o `apiKey` permanente (`visant_sk_...`).

### Passo 3 — Configurar o MCP (global, qualquer diretório)

```bash
claude mcp add --transport http \
  --header "Authorization: Bearer <apiKey>" \
  --scope user \
  visant https://api.visantlabs.com/api/mcp
```

> **Não use** `mcpServers` no `settings.json` nem `mcp-remote` — o servidor suporta Streamable HTTP direto.

### Passo 4 — Verificar

```bash
claude mcp list
# deve mostrar: visant: https://api.visantlabs.com/api/mcp (HTTP) - ✓ Connected
```

As tools aparecem com o prefixo `mcp__visant__` na próxima sessão.

---

## Tools disponíveis (116 tools)

### Account & Auth (6 tools)

| Tool              | O que faz                                  |
| ----------------- | ------------------------------------------ |
| `account-profile` | Perfil do user (nome, email, plano)        |
| `account-usage`   | Créditos restantes, limites, ciclo billing |
| `auth-login`      | Login email/senha → JWT                    |
| `auth-register`   | Criar conta → JWT                          |
| `api-key-create`  | Gerar API key `visant_sk_xxx`              |
| `api-key-list`    | Listar API keys existentes                 |

### Brand Guidelines (23 tools)

| Tool                                | O que faz                                                           |
| ----------------------------------- | ------------------------------------------------------------------- |
| `brand-guidelines-list`             | Lista todas as brand guidelines                                     |
| `brand-guidelines-get`              | Dados completos (JSON ou `format:"prompt"` para LLM-ready)          |
| `brand-guidelines-create`           | Criar nova guideline                                                |
| `brand-guidelines-update`           | Patch parcial (cores, tipografia, strategy, tokens)                 |
| `brand-guidelines-delete`           | Deletar — confirmar com user antes                                  |
| `brand-guidelines-duplicate`        | Duplicar guideline                                                  |
| `brand-guidelines-share`            | Gerar/revogar link público                                          |
| `brand-guidelines-public`           | Acessar por slug (sem auth)                                         |
| `brand-guidelines-ingest`           | Extrair de URL/texto e mergear na guideline                         |
| `brand-guidelines-compliance-check` | Auditoria AI (contraste, tipografia, voz, completude)               |
| `brand-guidelines-versions`         | Histórico de versões                                                |
| `brand-guidelines-restore-version`  | Restaurar versão anterior                                           |
| `brand-guidelines-compare-versions` | Diff entre 2 versões (cores adicionadas, tipografia alterada, etc.) |
| `brand-guidelines-upload-logo`      | Upload logo (base64/URL, variants: primary/dark/light/icon)         |
| `brand-guidelines-upload-media`     | Upload media kit (imagem/PDF)                                       |
| `brand-guidelines-delete-logo`      | Deletar logo por ID                                                 |
| `brand-guidelines-delete-media`     | Deletar media por ID                                                |
| `brand-guidelines-export`           | Export JSON completo para backup/migração                           |
| `brand-guidelines-compile`          | Compilar tokens → CSS custom properties, Tailwind, JSON             |
| `brand-guidelines-health-check`     | Auditoria de completude (quais seções faltam)                       |
| `brand-guidelines-figma-sync`       | Importar cores, tipografia e tokens do Figma                        |
| `brand-guidelines-figma-link`       | Linkar/deslinkar arquivo Figma                                      |
| `brand-guidelines-knowledge-list`   | Listar docs da knowledge base                                       |

### Branding Machine (5 tools)

| Tool                | O que faz                                                                                                         |
| ------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `branding-generate` | Gerar identidade visual. RECOMENDADO: `step:"visant-full"` (Metodologia Visant, 10 steps). Legacy: `step:"full"`. |
| `branding-list`     | Listar projetos de branding                                                                                       |
| `branding-get`      | Detalhar projeto                                                                                                  |
| `branding-save`     | Salvar/atualizar projeto                                                                                          |
| `branding-delete`   | Deletar projeto — confirmar com user                                                                              |

### Mockup Machine (6 tools)

| Tool              | O que faz                                                                                   |
| ----------------- | ------------------------------------------------------------------------------------------- |
| `mockup-generate` | Gerar mockup AI. Descreva SÓ a cena — passe o design como `referenceImages`. Costs credits. |
| `mockup-list`     | Listar mockups                                                                              |
| `mockup-get`      | Detalhar mockup                                                                             |
| `mockup-update`   | Atualizar metadata                                                                          |
| `mockup-delete`   | Deletar — confirmar com user                                                                |
| `mockup-presets`  | Presets por categoria (business-card, social-media, packaging, apparel, etc.)               |

### AI Tools (10 tools)

| Tool                           | O que faz                                                                                   | Custo   |
| ------------------------------ | ------------------------------------------------------------------------------------------- | ------- |
| `ai-generate-image`            | Gerar imagem do zero (sem brand injection). Models: gpt-image-2, gemini, seedream-5-0-lite. | Credits |
| `ai-describe-image`            | Descrever imagem (URL ou base64)                                                            | Free    |
| `ai-improve-prompt`            | Melhorar prompt text                                                                        | Free    |
| `ai-suggest-prompt-variations` | Gerar variações criativas de um prompt                                                      | Free    |
| `ai-extract-colors`            | Extrair paleta de cores de qualquer imagem                                                  | Free    |
| `ai-generate-naming`           | Gerar nomes de marca/produto a partir de um brief                                           | Credits |
| `ai-change-object`             | Substituir/modificar objetos em mockup existente                                            | Credits |
| `ai-apply-theme`               | Aplicar temas visuais (christmas, cyberpunk, minimalist...)                                 | Credits |
| `smart-analyze`                | Auto-detectar tipo de design + gerar prompt pronto para mockup-generate                     | Free    |
| `upload-image`                 | Upload base64 → URL pública (R2). Sempre usar antes de mockup-generate.                     | Free    |

### Creative Studio (8 tools)

| Tool                       | O que faz                                                           |
| -------------------------- | ------------------------------------------------------------------- |
| `creative-full`            | Pipeline completo: plan → background → render PNG → save. One-shot. |
| `creative-generate`        | Gerar layout estruturado (layers, overlay, background prompt)       |
| `creative-render`          | Renderizar plan em PNG server-side                                  |
| `creative-projects-create` | Salvar projeto creative                                             |
| `creative-projects-list`   | Listar projetos                                                     |
| `creative-projects-get`    | Detalhar projeto                                                    |
| `creative-projects-update` | Atualizar projeto                                                   |
| `creative-projects-delete` | Deletar projeto — confirmar com user                                |

### Campaign (2 tools)

| Tool                | O que faz                                                                         |
| ------------------- | --------------------------------------------------------------------------------- |
| `campaign-generate` | Batch async de ads: múltiplas variações × formatos. Retorna jobId. Costs credits. |
| `campaign-status`   | Poll do progresso do batch (planning → generating → done)                         |

### Canvas / Whiteboard (8 tools)

| Tool                       | O que faz                                |
| -------------------------- | ---------------------------------------- |
| `canvas-create`            | Criar whiteboard                         |
| `canvas-list`              | Listar projetos                          |
| `canvas-list-projects`     | Listar com summary de node types         |
| `canvas-get`               | Detalhar (nodes, edges, drawings)        |
| `canvas-update`            | Atualizar nodes/edges/linkedGuideline    |
| `canvas-delete`            | Deletar — confirmar com user             |
| `canvas-share`             | Compartilhar (canEdit/canView por email) |
| `canvas-parse-csv`         | Preview CSV → DataNode rows              |
| `canvas-resolve-variables` | Resolver `{{placeholders}}` em prompt    |

### Budget (6 tools)

| Tool               | O que faz                                        |
| ------------------ | ------------------------------------------------ |
| `budget-create`    | Criar orçamento (clientName, projectDescription) |
| `budget-list`      | Listar orçamentos                                |
| `budget-get`       | Detalhar com line items                          |
| `budget-update`    | Atualizar campos                                 |
| `budget-delete`    | Deletar — confirmar com user                     |
| `budget-duplicate` | Duplicar                                         |

### Payments & Settings (5 tools)

| Tool                           | O que faz                                                               |
| ------------------------------ | ----------------------------------------------------------------------- |
| `payments-subscription-status` | Tier, créditos, can_generate, reset date                                |
| `payments-usage`               | Uso detalhado de créditos (free + subscription)                         |
| `payments-plans`               | Listar planos com preços (USD/BRL)                                      |
| `settings-byok-status`         | Status de API keys configuradas (Gemini/OpenAI/Seedream) e storage tier |

### Document & Image Extraction (2 tools)

| Tool                | O que faz                                                                                                     |
| ------------------- | ------------------------------------------------------------------------------------------------------------- |
| `document-extract`  | **Dual-mode:** (1) URL → extrai imagens HD (Behance, Pinterest, Dribbble). (2) PDF → markdown + brand tokens. |
| `image-extract-url` | Extrair URLs de imagens de qualquer página web (suporta lazy-load, srcset)                                    |

### Moodboard (3 tools)

| Tool                    | O que faz                                 |
| ----------------------- | ----------------------------------------- |
| `moodboard-detect-grid` | Detectar bounding boxes em moodboard grid |
| `moodboard-suggest`     | Sugerir animações/vídeo para cada cell    |
| `moodboard-upscale`     | Upscale imagem para 1K/2K/4K              |

### Video (1 tool)

| Tool             | O que faz                                                           |
| ---------------- | ------------------------------------------------------------------- |
| `video-generate` | Gerar vídeo AI (text-to-video, image-to-video). Models: veo, kling. |

### Community (7 tools)

| Tool                      | O que faz                         |
| ------------------------- | --------------------------------- |
| `community-presets`       | Browse presets públicos de mockup |
| `community-preset-get`    | Detalhar preset                   |
| `community-preset-create` | Criar preset comunitário          |
| `community-preset-update` | Atualizar preset                  |
| `community-preset-delete` | Deletar preset                    |
| `community-preset-like`   | Like/unlike preset                |
| `community-profiles`      | Browse perfis da comunidade       |

---

## Workflows recomendados

### Mockup de design existente (logo, sticker, poster)

1. `upload-image` — converter base64 → URL pública
2. `mockup-generate` — URL em `referenceImages`, descreva SÓ a cena no `prompt`
   - **NÃO** descreva o design (texto, layout, fontes) — a AI vai alucinar

### Brand → Design System → Code

1. `brand-guidelines-create` (ou `brand-guidelines-ingest` de URL/texto)
2. `brand-guidelines-health-check` — ver o que falta
3. `brand-guidelines-figma-link` + `brand-guidelines-figma-sync` — importar tokens do Figma
4. `brand-guidelines-compile` — exportar CSS/Tailwind/JSON tokens

### Smart analysis (auto-detect + auto-prompt)

1. `smart-analyze` — passar qualquer imagem → categoria + prompt pronto
2. `mockup-generate` — usar o prompt retornado diretamente

### Batch ad campaign

1. `campaign-generate` — fire async batch (retorna jobId)
2. `campaign-status` — poll até `status="done"`, coletar image URLs

### Editar mockup existente

1. `ai-change-object` — substituir/modificar objetos na imagem
2. `ai-apply-theme` — aplicar temas visuais (christmas, cyberpunk, etc.)

---

## MCP Prompts (templates prontos)

Use `listPrompts()` para descobrir templates disponíveis:

| Prompt           | O que faz                                                                                      |
| ---------------- | ---------------------------------------------------------------------------------------------- |
| `mockup-scene`   | Prompts de cena provados por categoria + estilo. Vem de community presets + feedback positivo. |
| `prompt-library` | Busca full-text no acervo inteiro (community + feedback + patterns auto-promovidos).           |

### Exemplo:

```
getPrompt("mockup-scene", { category: "sticker", style: "minimal" })
→ retorna prompt pronto para usar no mockup-generate
```

---

## Token expirado / 401

```bash
cat ~/.visant/credentials.json   # extrai .apiKey
```

Atualize o Bearer no MCP config e reinicie a sessão. Se não existir: `npx visantlabs login`.

---

## Dicas de uso

- **Brand context em geração**: passe `brandGuidelineId` em mockup-generate, creative-full, creative-generate, ai-generate-naming, campaign-generate para injetar cores/tipografia/voz automaticamente.
- **format: "prompt"** no `brand-guidelines-get` retorna texto otimizado para LLM context, não JSON.
- **creative-full** é o atalho — evita encadear generate + mockup-generate + render manualmente.
- **Créditos**: `payments-subscription-status` ou `payments-usage` mostra saldo detalhado. `settings-byok-status` mostra quais API keys estão configuradas.
- **Tools grátis**: upload-image, ai-describe-image, ai-improve-prompt, ai-suggest-prompt-variations, ai-extract-colors, smart-analyze.
- **Scope enforcement**: tokens OAuth respeitam scopes `read`, `write`, `generate` — tools de geração requerem scope `generate`.
