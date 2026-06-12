# PSD Render — engine ag-psd + PSDs do Google Drive

Render de mockups PSD no VPS sem Chromium. O compositor é o pacote
**[`@visant/psd-engine`](../../packages/psd-engine/README.md)** (SSoT
isomórfico: server node-canvas, browser DOM canvas, CLI local) — consumido
também pela boxy-app e pelo mockup-store. Suporta máscaras raster, clipping,
blend modes, smart objects vinculados (mesmo `placedLayer.id`) e multi-face
(caixas, vitrines).

`server/lib/psd-compose.ts`, `psd-faces.ts` e `psd-render-constants.ts` são
re-exports finos do pacote (compat de import paths) — toda a lógica vive em
`@visant/psd-engine`. Não há mais código duplicado entre repos.

## Arquitetura

```
POST /api/psd-render/render
  ├─ PSD:  psdFileName → Google Drive (service account, cache LRU /tmp/psd-cache)
  │        psdUrl      → fetch direto (DO Spaces, zip suportado)
  ├─ Arte: arts[] = [{ smartObject?, artUrl | artBase64 }]
  │        sem smartObject (ou "*") = aplica em TODAS as faces editáveis
  ├─ Worker: bun server/scripts/psd-render-worker-agpsd.ts --job job.json
  │          (PSD_RENDER_ENGINE=photopea volta pro worker legado, arte única)
  └─ Output: DO Spaces da BOXY (public-read) → fallback R2
```

Watermarks/instruções (`[BOXY]`, "delete essa camada"…) são escondidos
automaticamente e nunca tratados como face.

## Controle de acesso por tier

| Tier | Quem | O que pode |
|---|---|---|
| `all` | admins, membros da equipe, `PSD_RENDER_ALLOWED_USERS` | biblioteca inteira (`GOOGLE_DRIVE_FOLDER_IDS`) + `psdUrl` arbitrária |
| `public` | qualquer usuário autenticado | só mockups BOXY (`GOOGLE_DRIVE_PUBLIC_FOLDER_IDS`); sem `psdUrl` |

**Equipe** = documento na collection Mongo **`team_members`** com `{ email }`
ou `{ userId }` (e-mail em lowercase). Adicionar alguém:

```js
db.team_members.insertOne({ email: "designer@visantlabs.com" })
```

O escopo de pasta usa verificação de ancestralidade (subpastas valem). Com
refresh token isso é importante: sem `GOOGLE_DRIVE_FOLDER_IDS`, o servidor
enxergaria a conta inteira (loga aviso no boot). Sem
`GOOGLE_DRIVE_PUBLIC_FOLDER_IDS`, o tier público é negado por completo.

## Env (Coolify)

| Var | Obrigatória | Descrição |
|---|---|---|
| `GOOGLE_DRIVE_REFRESH_TOKEN` | p/ psdFileName (opção A) | Reusa o `GOOGLE_CLIENT_ID/SECRET` já configurado. Gerar uma vez: adicionar `http://localhost:53682` nos redirect URIs do OAuth client e rodar `bun server/scripts/drive-auth-helper.ts`. Acessa o Drive como a sua conta, sem compartilhar pastas |
| `GOOGLE_SERVICE_ACCOUNT_KEY` | p/ psdFileName (opção B) | JSON de service account (Drive readonly). Compartilhar as pastas de PSD com o e-mail dele |
| `GOOGLE_DRIVE_FOLDER_IDS` | não | Restringe busca a essas pastas (CSV) |
| `PSD_CACHE_DIR` / `PSD_CACHE_MAX_GB` | não | Cache LRU de PSDs (default `/tmp/psd-cache`, 5GB) |
| `DO_SPACES_BUCKET` | p/ output no Spaces | Bucket de destino (creds `DO_SPACES_KEY/SECRET/ENDPOINT` já existem) |
| `DO_SPACES_CDN_URL` | não | URL pública CDN do bucket |
| `PSD_RENDER_ENGINE` | não | `agpsd` (default) ou `photopea` (legado) |
| `PSD_RENDER_MAX_CONCURRENT` | não | default 2 no agpsd (leve), 1 no photopea |
| `PSD_RENDER_ALLOWED_USERS` | recomendada | CSV de user IDs/e-mails autorizados além dos admins. Vazio = só admins |

## Exemplos

Arte única (legado, compatível):

```json
{ "psdUrl": "https://...psd", "artUrl": "https://...png", "smartObject": "Design Here" }
```

Logo da marca em todas as faces de uma caixa, PSD vindo do Drive:

```json
{
  "psdFileName": "BOX_ISOLATED.psd",
  "arts": [{ "artUrl": "https://cdn.../logo.png" }],
  "preview": 1400
}
```

Uma arte por face:

```json
{
  "psdFileName": "BOX_ISOLATED.psd",
  "arts": [
    { "smartObject": "L (Edite Aqui)*", "artUrl": "https://.../frente.png" },
    { "smartObject": "T (Edite Aqui)*", "artUrl": "https://.../topo.png" },
    { "smartObject": "R (Edite Aqui)*", "artUrl": "https://.../lado.png" }
  ]
}
```

Resposta: `{ success, data: { url, sizeBytes, durationMs, engine, replaced[] } }`

`GET /api/psd-render/status` mostra engine ativo e se Drive/Spaces estão configurados.

## Performance

ag-psd vs Photopea legado: ~3-8s vs ~25s por render, sem Chromium (RAM ~10x menor),
o que permitiu `MAX_CONCURRENT=2`. Testado com BOX_ISOLATED.psd (3 faces, 70MB)
nos dois modos (explícito e all-faces).

## Scene Packages — render no browser, RAM mínima

Um **Scene Package** é o PSD pré-processado uma única vez em geometria compacta
+ camadas flatten, para que o render por arte vire um warp + blend trivial em
qualquer canvas (sem mandar o PSD pro cliente, sem abrir o PSD a cada render).
Resolve o OOM do compose server-side (camadas full-res simultâneas) movendo o
render quente pro browser do usuário (Boxy / Visant web) ou pro node local
(mockup-store).

- **O que é:** `scene.json` (`SceneDoc`: dimensões + faces `{key, name, quad,
  innerW/H, maskRef?}` + camadas `base`/`over` com `blendMode`/`opacity`) +
  imagens flatten (WebP/PNG) das camadas. **O PSD nunca vai pro browser** — só
  flattens não-editáveis + JSON, servidos por signed URL com TTL atrás do gate
  de quota. `doc.warnings[]` sinaliza blend modes que o mapeamento Canvas-2D não
  reproduz 1:1 (dica pra cair no fallback server).

### Preprocessador (1x por PSD)

```bash
bun server/scripts/psd-scene-extract.ts <psdFileName|path>
```

Usa `@visant/psd-engine/scene` (`extractScene`) + adapter node → sobe
`scene.json` + camadas pro Spaces privado sob `scenes/<psdHash>/` e registra na
collection Mongo `psd_scenes` (`psdFileName, hash, sceneUrl, faces, warnings,
bytes`). É a única operação pesada e roda **uma vez** por PSD (semáforo Redis).

### Endpoints de scene

| Rota | Auth | Função |
|---|---|---|
| `POST /api/psd-render/scene-prepare` | `generate` (+ tier `all` ou partner key p/ pasta pública) | Dispara o extract de um PSD sem scene |
| `GET /api/psd-render/scenes` | `authenticate` (tier) | Lista scenes disponíveis pro tier (catálogo) |
| `GET /api/psd-render/scenes/:psdFileName` | `authenticate` (tier) | Retorna `SceneDoc` + **signed URLs (TTL ~10min)** das camadas — é o que o proxy da Boxy chama após o check de quota |

### Fast path no /render

`POST /render` checa se existe scene pro PSD: se sim, renderiza **do scene**
(RAM mínima, sem abrir o PSD); senão cai no pipeline ag-psd atual.
`?forcePsd=true` força o caminho completo.

O cliente browser compartilhado é `src/lib/mockup/sceneClient.ts`
(`@visant/psd-engine/scene` + adapter browser): fetch `SceneDoc` → carrega
imagens → render em canvas → `toBlob`. Mesmo módulo importado pela boxy-app via
npm — zero duplicação. Página interna de prova: `/admin/psd-scene`.

## Agente autônomo — MCP tools

O agente produz mockups fim-a-fim (escolhe template → gera arte → renderiza →
publica) via tools no `server/mcp/platform-mcp.ts`. `psd_scenes` é a porta única
do catálogo (sem acesso direto ao banco):

| Tool | Scope | Função |
|---|---|---|
| `psd-scene-list` | read | Catálogo de scenes/PSDs com faces, dimensões, warnings |
| `psd-scene-prepare` | generate | Dispara o preprocessamento de um PSD sem scene |
| `psd-mockup-produce` | generate | Fim-a-fim: gera arte (`artPrompt`/`brandGuidelineId`) ou usa `artUrl` → render via scene fast path (fallback `/render`) → publica no Spaces → `{ imageUrl, sceneUsed, face, artUrl }`. Cobra 1 geração de imagem (render grátis), refund em falha |

Os tools `mockup-store-*` (bridge local pro `Z:\BOXY\mockup-store`) continuam
para o fluxo de render local em lote. Workflow completo documentado na skill
`.claude/skills/psd-mockup-engine/SKILL.md`.
