# Photo Sequencer

Frames do canvas → vídeo em sequência (mp4/webm/gif), pelo plugin Visant Copilot, atrás de login.
**Implementado.** Engine portada do `auto-video-editor-ai`, não reescrita.

Plugin → `Settings › Tools › Photo Sequencer`.

## Fluxo

```
Seleção no Figma
  └─ sandbox: exportAsync → base64        (op image.exportNodes, em lotes de 20)
      └─ UI: grid, reordenar, s/foto, formato
          └─ POST /api/sequencer           (Bearer JWT)
              └─ buildSlideshow → ffmpeg → uploadSequenceVideo → R2
                  └─ { videoUrl } → downloadFromUrl()
```

## Decisões

| Questão | Decisão | Porquê |
|---|---|---|
| Fonte das imagens | Seleção do canvas | É o motivo de estar no Figma. Upload de arquivo o app web já faz. |
| Entrega | R2 → `{ videoUrl }` → download | `*.r2.dev` já no manifest; evita blob pesado no iframe. |
| Gate | `authenticate` só, sem créditos | ffmpeg determinístico, não IA. Igual ao `/render`. |
| Onde na UI | Section no `ToolsTab` | Ferramenta, não modo principal. Não custa `activeView` novo. |

## Por que não reusar o `/render`

`renderService.ts` é **frame-based**: o cliente rasteriza cada frame e sobe JPEGs (`frame_%06d.jpg`), o servidor encoda num fps fixo. Pra slideshow, seriam `fps × duração` frames **duplicados** por foto — 30 frames idênticos por segundo por imagem.

`buildSlideshow` sobe **1 arquivo por foto** e faz o timing no ffmpeg: um input `-loop 1 -t d` por foto, unidos pelo filtro `concat`. Contratos diferentes → serviços irmãos.

> O comentário no topo de `slideshowService.ts` explica por que o concat *demuxer* não serve (perde frames com still images). Não reescrever sem ler.

## Arquivos

### Backend
| Arquivo | O quê |
|---|---|
| `server/services/slideshowService.ts` | `buildSlideshow` + `validate*` + `probeFFmpeg` |
| `server/routes/sequencer.ts` | `POST /api/sequencer`, `GET /api/sequencer/health` |
| `server/services/r2Service.ts` | `uploadSequenceVideo` (novo, ~linha 720) |
| `server/app.ts` | mount `['/sequencer', sequencerRoutes]` |
| `tests/integration/routes/sequencer.test.ts` | 13 testes (auth + validação) |

ffmpeg já vem no container (`Dockerfile:6`). `express.json({ limit: '300mb' })` (`app.ts:286`) cobre o payload base64.

**`uploadSequenceVideo` em vez de `uploadCanvasVideo`:** aquele monta a key como `canvas/${userId}/${canvasId}/…` — e aqui não existe canvas — e infere o formato de um prefixo `data:video/`, o que rotularia um **GIF** (`image/gif`) como `video/mp4`. O novo recebe o formato explícito e grava em `sequencer/${userId}/`.

### Plugin
| Arquivo | O quê |
|---|---|
| `shared/protocol.ts` | op `image.exportNodes` + `ExportedNodeImage` |
| `plugin/src/ui/lib/client.ts` | `ROUTE['image.exportNodes'] = 'figma'` |
| `plugin/src/handlers/photoSequence.ts` | `exportNodes` — export em lote |
| `plugin/src/handlers/registry.ts` | cola da op |
| `plugin/src/ui/components/tools/PhotoSequencerSection.tsx` | o painel |
| `plugin/src/ui/components/common/AuthGate.tsx` | gate reusável (novo) |
| `plugin/src/ui/lib/download.ts` | `downloadFile` / `downloadFromUrl` |
| `plugin/src/ui/components/tools/ToolsTab.tsx` | entrada no `SECTIONS` |

`manifest.json` **não mudou** — `api.visantlabs.com` e `*.r2.dev` já estavam liberados.

## Detalhes que não são óbvios

- **Ordem.** `figma.currentPage.selection` volta em ordem de **camada**, não de clique. Por isso `ExportedNodeImage` carrega `x`/`y` e existe o botão **Ordenar** (esquerda→direita, cima→baixo, com tolerância de 40px pra não trocar de linha por desalinho).
- **Export em lotes de 20.** `client.request` é travado em 30s sem override por chamada (`client.ts`). Exportar centenas de frames a 2x num round-trip só estoura. Os ids vêm de `selectionDetails`; se o store estiver vazio, cai numa chamada única contra a seleção viva.
- **Toda task trata o próprio erro.** `OpButton` chama `runner.run()` sem `.catch`, e `useOpRunner` não tem `catch` — só `finally`. Uma task que rejeita vira *unhandled rejection*: o spinner para e o usuário não vê erro. Todas as tasks deste painel usam try/catch + `showToast`. **Vale pra qualquer painel novo.**
- **Sem slider.** `@radix-ui/react-slider` não é dep do monorepo; é `<input type="range">`, como em ~10 outros lugares.
- **Guard de payload no cliente** em 180MB — base64 infla ~33% e o express corta em 300mb. Melhor uma frase que um 413 do body parser.

## Verificado

- Engine: 3 formatos × imagens de tamanhos mistos (800x600 / 1920x1080 / 400x400) → `ffprobe` bate a duração exata (1.500000s pra 1.5s), mp4 45 frames @30fps, gif 30 @20fps, `sequence` determinístico, foto única OK.
- `tsc --noEmit`: raiz limpa; plugin com **os mesmos 16 erros pré-existentes** do HEAD, zero novos.
- Bundle esbuild (UI + sandbox) OK, com os módulos novos no grafo.
- Tailwind emite as classes do painel (`accent-brand-cyan` inclusive).
- 28 testes de integração passando (`sequencer` + `render`).

## Pendências conhecidas (pré-existentes, fora do escopo)

- `npm run build` no plugin falha no guard `check-icons` por ícones banidos em `src/components/cockpit/SurpriseMockupHero.tsx` e `src/components/shell/*` — arquivos do webapp, intocados, já quebrados antes disto.
- Registry driftando do contrato: `image.paste` e `image.exportNode` estão no `ROUTE`/`OpMap` mas **não têm handler** (`UNKNOWN_OP`); `text.scanFontsPage` tem handler mas não está no `OpMap`; `export.framesData` falta no `ROUTE`.
- Duas fontes de verdade pra base URL: `config.API_BASE_URL` (usada por `useApi`/`useAuth`, e por este painel via `apiUrl()`) e `store.serverUrl` (usada pelo `client`). `initApiBaseUrl()` existe e nunca é chamada.

## Falta

Teste ponta-a-ponta no Figma real com backend rodando — nada aqui foi exercitado contra uma seleção viva.
