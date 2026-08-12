# Fluxos de autenticação do Visant Labs

SSoT de **como cada superfície entra**. O backend (`api.visantlabs.com`) é o único
dono de identidade: nenhum app da casa fala com o Google por conta própria.

Se você está plugando um app novo, leia só a tabela e a seção do seu fluxo.

## Os quatro fluxos

| Fluxo | Entrada | Quem usa hoje | Quando escolher |
|---|---|---|---|
| **Redirect** | `GET /api/auth/google` (sem `source`) | App web `visantlabs.com` | O app roda numa aba normal e pode ser levado pro Google e trazido de volta |
| **Popup + poll** | `GET /api/auth/google?source=<origem>` | Plugin do Figma, Visant Club | O app **não pode navegar pra fora** (iframe de plugin) ou está em outro domínio |
| **OAuth 2.1 + PKCE** | `GET /oauth/authorize` | MCP (claude.ai), integrações de terceiro | App de terceiro pedindo acesso à conta de um usuário, com escopo |
| **Device flow** | `POST /oauth/device/code` | CLI, agentes headless | Não há browser local nem `redirect_uri` pra escutar |

Senha/e-mail (`POST /api/auth/signin`) atravessa todos: é o caminho padrão, e os
de cima existem porque nem toda superfície consegue mostrar um formulário.

## Popup + poll (o que mais gera confusão)

```
cliente                        api.visantlabs.com                 Google
  │  GET /auth/google?source=club                                    │
  │ ─────────────────────────────►  cria sessão {sessionId, source}  │
  │ ◄───────────────────────────── { authUrl, sessionId }            │
  │  abre popup em authUrl ─────────────────────────────────────────►│
  │                              ◄── GET /auth/google/callback ──────│
  │                                 grava token na sessão            │
  │                                 responde a PÁGINA de retorno     │
  │  GET /auth/google/poll/:sessionId                                │
  │ ─────────────────────────────►  entrega o token e apaga a sessão │
```

Três regras que não são óbvias:

1. **O `state` sempre começa com `plugin:`**, mesmo quando quem entrou foi o
   Club ou o CLI. É compatibilidade com builds antigos do plugin do Figma que já
   estão instalados por aí — o prefixo é histórico, não semântico. Quem diz de
   onde veio o login é o `source` guardado na sessão.
2. **A página de retorno é do servidor**, não do app. Por isso ela precisa saber
   pra onde mandar o usuário voltar; sem `source` correto ela mentiria (foi
   exatamente o bug de "Volte para o Figma" aparecendo em quem entrou pelo Club).
3. **A sessão é de uso único e vive 5 minutos.** O segundo poll do mesmo
   `sessionId` responde `expired`, de propósito.

### Plugar uma superfície nova

1. Registrar a origem em `server/lib/oauthPopupPage.ts`:

   ```ts
   export const POPUP_OAUTH_SOURCES = {
     …,
     minhaSuperficie: { product: 'Nome do app', backTo: 'Volte para o Nome do app' },
   }
   ```

2. Chamar `GET /api/auth/google?source=minhaSuperficie` e polar
   `GET /api/auth/google/poll/:sessionId` a cada 2–3s.

Nada de HTML novo, nada de rota nova. `source` fora dessa lista devolve **400** —
antes caía calado no fluxo de redirect e o cliente polava um `sessionId` que
nunca existiu.

### Obrigações do cliente

- **Abrir o popup no gesto do clique** (`window.open` síncrono, antes do
  `fetch`), senão o browser bloqueia.
- **Não ler `popup.closed`**: COOP bloqueia cross-origin. Fechar em best-effort.
- **Amarrar o `sessionId` a este browser.** Ele é a única credencial do fluxo:
  quem tiver o `sessionId` recebe o token de quem autenticar. O Club grava um
  cookie `httpOnly` de 5 min no `/start` e confere no `/poll`
  (`visant-club/app/api/oauth/google/*`) — copie esse padrão. Sem isso: mandar a
  `authUrl` pra vítima e polar do lado de fora é takeover de conta com um clique.
- **Ter timeout** menor ou igual à vida da sessão (5 min) e mostrar erro pra
  `status: 'error' | 'expired'`.

## Redirect

`GET /api/auth/google` sem `source` devolve `{ authUrl }` e o callback termina em
`{FRONTEND_BASE_URL}/auth?token=…`. **Não mande `source` num app de redirect**: a
resposta passaria a trazer `sessionId` e o callback responderia HTML em vez de
redirecionar.

`GET /api/auth/google/link` (autenticado) é o mesmo desenho pra vincular Google a
uma conta existente; usa `state=link:<userId>`.

## O que NÃO é deste fluxo

- **BOXY** (`@boxy-monkey/boxy-app`) tem login próprio, via **NextAuth**
  (`GoogleProvider`), com credencial própria. Não passa por aqui. A rota
  `/api/auth/google` de lá era um segundo fluxo feito à mão, sem `state` e sem
  callback que o aceitasse — hoje só encaminha pro NextAuth.
- **mockup-store** usa OAuth 2.1 (`/oauth/authorize`) e device flow — telas
  próprias do `/oauth/*`, não a página de popup.
- **visantismo** não tem login próprio: `docs/PLANO-PRODUCT-ONLY.md` de lá é
  plano **para o Club** e reusa o `googleStart/googlePoll` dele — já em
  `source=club`, nada a plugar.
- **jaques-os** tem OAuth do YouTube (canal próprio, um operador, localhost).
  Não é identidade de usuário e não encosta neste fluxo.

Varredura de 2026-08-11 em `Z:\Cursor` e `Z:\BOXY`: fora o que está nas tabelas
acima, nenhum repo tem código de OAuth — os outros acertos eram só documentação.

## Onde mexer

| O quê | Arquivo |
|---|---|
| Origens e cópia da página de retorno | `server/lib/oauthPopupPage.ts` |
| Rotas Google (start, callback, poll, link) | `server/routes/auth.ts` |
| OAuth 2.1 / device flow | `server/routes/oauth.ts` |
| Testes do fluxo popup | `tests/integration/routes/auth.test.ts` |
