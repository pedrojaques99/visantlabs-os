# PSD Render — engine ag-psd + PSDs do Google Drive

Render de mockups PSD no VPS sem Chromium: compositor ag-psd + node-canvas
portado do mockup-store (Z:\BOXY\mockup-store, `src/lib/psd-compose.ts`).
Suporta máscaras raster, clipping, blend modes, smart objects vinculados
(mesmo `placedLayer.id`) e multi-face (caixas, vitrines).

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

## Controle de acesso (DENY por padrão)

O render dá acesso indireto à biblioteca de PSDs licenciados — a rota só
permite **admins** (`user.isAdmin`) e usuários listados em
**`PSD_RENDER_ALLOWED_USERS`** (CSV de IDs e/ou e-mails). Todo o resto recebe 403.

No Drive, **`GOOGLE_DRIVE_FOLDER_IDS`** restringe quais pastas o render enxerga
(verificação de ancestralidade — subpastas valem). Com refresh token isso é
importante: sem a restrição, o servidor enxerga a conta inteira (loga aviso no boot).

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

## Manter em sincronia

`server/lib/psd-compose.ts`, `psd-faces.ts` e `psd-render-constants.ts` são
portados do mockup-store — se corrigir bug num lado, replicar no outro.
