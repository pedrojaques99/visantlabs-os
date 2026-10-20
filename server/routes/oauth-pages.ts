/**
 * Telas do fluxo OAuth (login, consentimento, device flow, OOB, erro).
 *
 * São HTML servido pela API, fora do SPA: o agente abre o navegador direto em
 * api.visantlabs.com. Por isso não há Tailwind aqui, mas os valores são os
 * tokens do `src/index.css` (cores oklch dos dois temas, --r-control,
 * --r-surface, --control-h, --e-modal, --focus) e o botão principal é a
 * variante `primary` do Button. Ícone vem do @phosphor-icons/react renderizado
 * no servidor, nunca desenhado à mão.
 */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  CheckIcon as Check,
  CopyIcon as Copy,
  EyeIcon as Eye,
  GoogleLogoIcon as GoogleLogo,
  PencilSimpleIcon as PencilSimple,
  SparkleIcon as Sparkle,
  WarningCircleIcon as WarningCircle,
  XIcon as X,
} from '@phosphor-icons/react/ssr';
import { FRONTEND_BASE_URL } from '../lib/mcp-constants.js';

// ── Idioma ────────────────────────────────────────────────────────────────────

export type OAuthLang = 'pt' | 'en';

export function langFrom(acceptLanguage: string | undefined): OAuthLang {
  return /^\s*pt\b/i.test(acceptLanguage || '') ? 'pt' : 'en';
}

const T = {
  pt: {
    signInTitle: (app: string) => `Entre pra conectar ${app}`,
    signInLead: 'Use a conta da Visant Labs que vai dar o acesso.',
    email: 'E-mail',
    password: 'Senha',
    signIn: 'Entrar',
    signingIn: 'Entrando…',
    noAccount: 'Ainda não tem conta?',
    createAccount: 'Criar conta',
    invalidCredentials: 'E-mail ou senha não conferem.',
    google: 'Continuar com Google',
    or: 'ou com e-mail',
    forgot: 'Esqueci a senha',
    googleFailed: 'Não deu pra entrar com o Google. Tente de novo ou use e-mail e senha.',
    consentTitle: (app: string) => `${app} quer acessar sua conta`,
    connectedAs: 'Conectando como',
    notYou: 'Trocar de conta',
    willBeAble: 'Vai poder',
    scopeRead: 'Ler suas marcas e projetos',
    scopeWrite: 'Criar e editar conteúdo em seu nome',
    scopeGenerate: 'Gerar imagens, mockups e criativos',
    scopeGenerateNote: 'Usa os créditos da sua conta',
    returnsTo: 'Depois de permitir, você volta pra',
    oobReturns: 'Depois de permitir, o código aparece aqui pra você colar no agente.',
    deny: 'Recusar',
    approve: 'Permitir',
    revokeHint: 'Dá pra desconectar quando quiser em',
    revokeLink: 'Apps conectados',
    deviceTitle: 'Conecte seu agente',
    deviceLead: 'Digite o código que o agente mostrou.',
    deviceLoginLead: 'Digite o código que o agente mostrou e entre na sua conta.',
    deviceCode: 'Código do agente',
    deviceMissing: 'Digite o código que aparece no agente.',
    continue: 'Continuar',
    deviceConfirm: 'Confira se o agente mostra este mesmo código',
    doneTitle: 'Agente conectado',
    doneLead: 'Pode fechar esta janela e voltar pra conversa.',
    deniedTitle: 'Acesso recusado',
    deniedLead: 'Nada foi compartilhado. Pode fechar esta janela.',
    oobTitle: 'Acesso liberado',
    oobLead: 'Copie o código e cole no agente pra terminar a conexão.',
    oobCode: 'Código de autorização',
    copy: 'Copiar código',
    copied: 'Copiado',
    oobExpires: 'Vale por 10 minutos.',
    errorTitle: 'Não deu pra continuar',
    tryAgain: 'Tentar de novo',
    pageSignIn: 'Entrar',
    pageAuthorize: 'Autorizar',
    pageDevice: 'Conectar agente',
    pageDone: 'Conectado',
    pageDenied: 'Recusado',
    pageError: 'Erro',
  },
  en: {
    signInTitle: (app: string) => `Sign in to connect ${app}`,
    signInLead: 'Use the Visant Labs account that will grant access.',
    email: 'Email',
    password: 'Password',
    signIn: 'Sign in',
    signingIn: 'Signing in…',
    noAccount: 'No account yet?',
    createAccount: 'Create one',
    invalidCredentials: 'Email or password is incorrect.',
    google: 'Continue with Google',
    or: 'or with email',
    forgot: 'Forgot password',
    googleFailed: 'Google sign-in failed. Try again or use email and password.',
    consentTitle: (app: string) => `${app} wants to access your account`,
    connectedAs: 'Connecting as',
    notYou: 'Switch account',
    willBeAble: 'It will be able to',
    scopeRead: 'Read your brands and projects',
    scopeWrite: 'Create and edit content on your behalf',
    scopeGenerate: 'Generate images, mockups and creatives',
    scopeGenerateNote: 'Spends your account credits',
    returnsTo: 'After you allow, you go back to',
    oobReturns: 'After you allow, the code shows up here for you to paste in your agent.',
    deny: 'Deny',
    approve: 'Allow',
    revokeHint: 'You can disconnect anytime in',
    revokeLink: 'Connected apps',
    deviceTitle: 'Connect your agent',
    deviceLead: 'Type the code your agent is showing.',
    deviceLoginLead: 'Type the code your agent is showing and sign in.',
    deviceCode: 'Agent code',
    deviceMissing: 'Type the code shown by your agent.',
    continue: 'Continue',
    deviceConfirm: 'Check that your agent shows this same code',
    doneTitle: 'Agent connected',
    doneLead: 'You can close this window and go back to the conversation.',
    deniedTitle: 'Access denied',
    deniedLead: 'Nothing was shared. You can close this window.',
    oobTitle: 'Access granted',
    oobLead: 'Copy the code and paste it in your agent to finish connecting.',
    oobCode: 'Authorization code',
    copy: 'Copy code',
    copied: 'Copied',
    oobExpires: 'Valid for 10 minutes.',
    errorTitle: 'Could not continue',
    tryAgain: 'Try again',
    pageSignIn: 'Sign in',
    pageAuthorize: 'Authorize',
    pageDevice: 'Connect agent',
    pageDone: 'Connected',
    pageDenied: 'Denied',
    pageError: 'Error',
  },
} as const;

/** Mensagens de erro conhecidas, pra a tela não falar `redirect_uri` com quem não é dev. */
export const OAUTH_ERRORS = {
  pt: {
    missing: 'O link de autorização está incompleto. Volte pro app e tente conectar de novo.',
    unknownClient: 'Esse app não está registrado na Visant Labs.',
    badRedirect: 'O endereço de retorno desse app não confere com o registrado.',
    session: 'Sua sessão expirou. Entre de novo pra continuar.',
    deviceInvalid: 'Código inválido ou vencido. Confira e tente de novo.',
    deviceExpired: 'Esse código venceu. Peça um novo ao agente.',
    server: 'Algo falhou do nosso lado. Tente de novo em instantes.',
  },
  en: {
    missing: 'The authorization link is incomplete. Go back to the app and try connecting again.',
    unknownClient: 'This app is not registered with Visant Labs.',
    badRedirect: "This app's return address doesn't match the registered one.",
    session: 'Your session expired. Sign in again to continue.',
    deviceInvalid: 'Invalid or expired code. Check it and try again.',
    deviceExpired: 'This code has expired. Ask your agent for a new one.',
    server: 'Something failed on our side. Try again in a moment.',
  },
} as const;

export type OAuthErrorKey = keyof (typeof OAUTH_ERRORS)['en'];

// ── Primitivas ───────────────────────────────────────────────────────────────

const esc = (s: string) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/** Ícone Phosphor como SVG estático, decorativo (o texto ao lado é o nome). */
const icon = (C: typeof Eye, size = 16) =>
  renderToStaticMarkup(createElement(C, { size, 'aria-hidden': true, focusable: 'false' }));

const ICON = {
  read: icon(Eye),
  write: icon(PencilSimple),
  generate: icon(Sparkle),
  check: icon(Check, 20),
  x: icon(X, 20),
  warn: icon(WarningCircle, 20),
  copy: icon(Copy),
  copied: icon(Check),
  google: icon(GoogleLogo),
};

const STYLES = `
:root {
  color-scheme: light;
  --background: oklch(0.972 0.005 40);
  --foreground: oklch(0.19 0.008 40);
  --card: oklch(0.988 0.004 45);
  --muted: oklch(0.945 0.007 40);
  --muted-foreground: oklch(0.53 0.012 42);
  --accent: oklch(0.945 0.007 40);
  --destructive: oklch(0.577 0.245 27.325);
  --success: oklch(0.6 0.17 150);
  --warning: oklch(0.68 0.16 65);
  --border: oklch(0.19 0.008 40 / 11%);
  --border-hover: oklch(0.19 0.008 40 / 24%);
  --input: oklch(0.19 0.008 40 / 14%);
  --ring: oklch(0.62 0.012 42);
  --brand-cyan: oklch(0.81 0.156 198.6);
  --shadow: 0 0% 0%;
  --r-control: 0.375rem;
  --r-surface: 0.625rem;
  --control-h: 2.25rem;
  --e-modal: 0 8px 40px hsl(var(--shadow) / 0.22);
  --focus: 0 0 0 2px var(--background), 0 0 0 4px var(--foreground);
  --ease-out: cubic-bezier(0.23, 1, 0.32, 1);
}
@media (prefers-color-scheme: dark) {
  :root {
    color-scheme: dark;
    --background: oklch(0.165 0.005 45);
    --foreground: oklch(0.965 0.004 60);
    --card: oklch(0.205 0.006 45);
    --muted: oklch(0.235 0.006 45);
    --muted-foreground: oklch(0.68 0.011 50);
    --accent: oklch(0.26 0.007 45);
    --destructive: oklch(0.704 0.191 22.216);
    --success: oklch(0.72 0.19 150);
    --warning: oklch(0.822 0.146 73.8);
    --border: oklch(0.93 0.012 60 / 11%);
    --border-hover: oklch(0.93 0.012 60 / 22%);
    --input: oklch(0.93 0.012 60 / 14%);
    --ring: oklch(0.58 0.011 50);
  }
}
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html { -webkit-text-size-adjust: 100%; }
body {
  font-family: 'Manrope', ui-sans-serif, system-ui, sans-serif;
  font-size: 0.875rem; line-height: 1.5;
  background: var(--background); color: var(--foreground);
  min-height: 100dvh; display: grid; place-items: center;
  padding: 1.5rem 1rem;
  -webkit-font-smoothing: antialiased;
}
.shell { width: 100%; max-width: 26rem; display: grid; gap: 1rem; }
.mark { font-size: 0.875rem; font-weight: 500; color: var(--muted-foreground); padding-inline: 0.25rem; }
.card {
  background: var(--card); border: 1px solid var(--border);
  border-radius: var(--r-surface); box-shadow: var(--e-modal);
  padding: 1.75rem 1.5rem; display: grid; gap: 1.25rem;
  animation: enter 180ms var(--ease-out) both;
}
@keyframes enter { from { opacity: 0; transform: translateY(4px); } }
@media (prefers-reduced-motion: reduce) { .card { animation: none; } }
h1 { font-size: 1.25rem; line-height: 1.35; font-weight: 600; letter-spacing: -0.01em; overflow-wrap: anywhere; }
.lead { color: var(--muted-foreground); margin-top: 0.375rem; }
.who {
  display: flex; align-items: center; justify-content: space-between; gap: 0.75rem;
  padding: 0.625rem 0.75rem; border-radius: var(--r-control); background: var(--muted);
}
.who-label { font-size: 0.75rem; color: var(--muted-foreground); }
.who-email { font-weight: 500; overflow-wrap: anywhere; }
.list-label { font-size: 0.75rem; color: var(--muted-foreground); margin-bottom: 0.5rem; }
.scopes { list-style: none; display: grid; gap: 0.75rem; }
.scope { display: grid; grid-template-columns: 1rem 1fr; gap: 0.75rem; align-items: start; }
.scope svg { margin-top: 0.15rem; color: var(--muted-foreground); }
.scope-note { display: block; font-size: 0.75rem; color: var(--muted-foreground); }
.dest { font-size: 0.75rem; color: var(--muted-foreground); }
.mono { font-family: 'Red Hat Mono', ui-monospace, monospace; color: var(--foreground); }
.actions { display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; }
.btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 0.5rem;
  height: var(--control-h); padding: 0 1rem; border-radius: var(--r-control);
  font: inherit; font-weight: 500; text-decoration: none; cursor: pointer;
  border: 1px solid var(--border); background: transparent; color: var(--foreground);
  transition: background-color 150ms var(--ease-out), border-color 150ms var(--ease-out), color 150ms var(--ease-out);
}
.btn:hover { background: var(--accent); border-color: var(--border-hover); }
.btn:active { transform: translateY(1px); }
.btn-primary {
  border-color: oklch(from var(--brand-cyan) l c h / 30%);
  background: oklch(from var(--brand-cyan) l c h / 10%);
}
.btn-primary:hover {
  border-color: oklch(from var(--brand-cyan) l c h / 45%);
  background: oklch(from var(--brand-cyan) l c h / 20%);
}
.btn-block { width: 100%; }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }
:focus-visible { outline: none; box-shadow: var(--focus); }
.field { display: grid; gap: 0.375rem; }
.field label { font-size: 0.75rem; font-weight: 500; color: var(--muted-foreground); }
.input {
  height: var(--control-h); width: 100%; padding: 0 0.75rem;
  border-radius: var(--r-control); border: 1px solid var(--input);
  background: transparent; color: var(--foreground); font: inherit;
  transition: border-color 150ms var(--ease-out);
}
.input:hover { border-color: var(--border-hover); }
.input:focus-visible { border-color: var(--ring); box-shadow: none; outline: 2px solid var(--ring); outline-offset: 1px; }
.input::placeholder { color: var(--muted-foreground); opacity: 0.6; }
.input-code {
  height: 3rem; text-align: center; font-family: 'Red Hat Mono', ui-monospace, monospace;
  font-size: 1.25rem; letter-spacing: 0.2em; text-transform: uppercase;
}
.form { display: grid; gap: 0.875rem; }
.alert { font-size: 0.75rem; color: var(--destructive); min-height: 1rem; }
.alert:empty { display: none; }
.sep { display: flex; align-items: center; gap: 0.75rem; font-size: 0.75rem; color: var(--muted-foreground); }
.sep::before, .sep::after { content: ''; flex: 1; height: 1px; background: var(--border); }
.label-row { display: flex; align-items: baseline; justify-content: space-between; gap: 0.75rem; }
.label-row .link { font-size: 0.75rem; }
.foot { font-size: 0.75rem; color: var(--muted-foreground); padding-inline: 0.25rem; }
.link { color: var(--foreground); text-decoration: underline; text-underline-offset: 3px; text-decoration-color: var(--border-hover); border-radius: 2px; }
.link:hover { text-decoration-color: currentColor; }
.status {
  width: 2.5rem; height: 2.5rem; border-radius: 9999px; display: grid; place-items: center;
  background: var(--muted); color: var(--muted-foreground);
}
.status-ok { color: var(--success); }
.status-warn { color: var(--warning); }
.code-row { display: grid; gap: 0.5rem; }
.code-box {
  font-family: 'Red Hat Mono', ui-monospace, monospace; font-size: 0.75rem; line-height: 1.6;
  padding: 0.625rem 0.75rem; border-radius: var(--r-control); background: var(--muted);
  word-break: break-all; user-select: all;
}
.code-pill {
  justify-self: start; font-family: 'Red Hat Mono', ui-monospace, monospace; font-size: 1.125rem;
  letter-spacing: 0.15em; padding: 0.375rem 0.75rem; border-radius: var(--r-control); background: var(--muted);
}
`;

function page(p: { lang: OAuthLang; title: string; body: string; script?: string }): string {
  return `<!DOCTYPE html>
<html lang="${p.lang === 'pt' ? 'pt-BR' : 'en'}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="robots" content="noindex" />
  <link rel="icon" type="image/png" href="${FRONTEND_BASE_URL}/logo-vsn-labs.png" />
  <title>${esc(p.title)} · Visant Labs</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600&family=Red+Hat+Mono:wght@400;500&display=swap" />
  <style>${STYLES}</style>
</head>
<body>
  <main class="shell">
    <div class="mark">Visant Labs</div>
${p.body}
  </main>${p.script ? `\n  <script>${p.script}</script>` : ''}
</body>
</html>`;
}

const revokeFoot = (t: (typeof T)[OAuthLang]) =>
  `<p class="foot">${t.revokeHint} <a class="link" href="${FRONTEND_BASE_URL}/settings/connected-apps" target="_blank" rel="noopener">${t.revokeLink}</a>.</p>`;

function scopeList(t: (typeof T)[OAuthLang], scopes: string): string {
  const set = new Set(scopes.split(/[\s+]+/).filter(Boolean));
  const items = [
    set.has('read') && `<li class="scope">${ICON.read}<span>${t.scopeRead}</span></li>`,
    set.has('write') && `<li class="scope">${ICON.write}<span>${t.scopeWrite}</span></li>`,
    set.has('generate') &&
      `<li class="scope">${ICON.generate}<span>${t.scopeGenerate}<span class="scope-note">${t.scopeGenerateNote}</span></span></li>`,
  ].filter(Boolean);
  return `<div><p class="list-label">${t.willBeAble}</p><ul class="scopes">${items.join('')}</ul></div>`;
}

const whoBlock = (t: (typeof T)[OAuthLang], email: string | null, switchUrl?: string) =>
  email
    ? `<div class="who"><div><div class="who-label">${t.connectedAs}</div><div class="who-email">${esc(email)}</div></div>${
        switchUrl ? `<a class="link who-label" href="${esc(switchUrl)}">${t.notYou}</a>` : ''
      }</div>`
    : '';

/** Formata o input do código de device (ABCD-1234) e é reaproveitado por duas telas. */
const CODE_MASK = `
  var codeEl = document.getElementById('deviceCode');
  codeEl.addEventListener('input', function () {
    var v = this.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    if (v.length > 4) v = v.slice(0, 4) + '-' + v.slice(4, 8);
    this.value = v;
  });`;

/**
 * Login por Google ou e-mail/senha. Os dois terminam no mesmo lugar: o caminho
 * de volta (`/oauth/authorize?...` ou `/oauth/device?code=...`) com `&token=`.
 * No Google quem cola o token é o callback da API (ver oauthReturnPath em auth.ts).
 */
const signInScript = (p: {
  apiBase: string;
  /** Caminho de volta fixo; sem ele, o caminho sai do código digitado (device). */
  returnPath?: string;
  t: (typeof T)[OAuthLang];
}) => `
  var api = ${JSON.stringify(p.apiBase)};
  var form = document.getElementById('signin');
  var alertEl = document.getElementById('alert');
  var btn = document.getElementById('submit');
  var googleBtn = document.getElementById('google');
  function returnPath() {
    ${
      p.returnPath
        ? `return ${JSON.stringify(p.returnPath)};`
        : `var code = codeEl.value.trim();
    if (!code) { alertEl.textContent = ${JSON.stringify(p.t.deviceMissing)}; codeEl.focus(); return null; }
    return '/oauth/device?code=' + encodeURIComponent(code);`
    }
  }
  googleBtn.addEventListener('click', async function () {
    alertEl.textContent = '';
    var path = returnPath();
    if (!path) return;
    googleBtn.disabled = true;
    try {
      var res = await fetch(api + '/api/auth/google?return_to=' + encodeURIComponent(path));
      var data = await res.json().catch(function () { return {}; });
      if (!res.ok || !data.authUrl) throw new Error();
      window.location.href = data.authUrl;
    } catch (err) {
      alertEl.textContent = ${JSON.stringify(p.t.googleFailed)};
      googleBtn.disabled = false;
    }
  });
  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    alertEl.textContent = '';
    var path = returnPath();
    if (!path) return;
    btn.disabled = true; btn.textContent = ${JSON.stringify(p.t.signingIn)};
    try {
      var res = await fetch(api + '/api/auth/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email.value, password: form.password.value }),
      });
      var data = await res.json().catch(function () { return {}; });
      if (!res.ok || !data.token) throw new Error(${JSON.stringify(p.t.invalidCredentials)});
      window.location.href = api + path + '&token=' + encodeURIComponent(data.token);
    } catch (err) {
      alertEl.textContent = err.message;
      btn.disabled = false; btn.textContent = ${JSON.stringify(p.t.signIn)};
    }
  });`;

/** Google primeiro (é como a maioria entra), e-mail e senha logo abaixo. */
const googleBlock = (t: (typeof T)[OAuthLang]) => `
      <button type="button" class="btn btn-block" id="google">${ICON.google}<span>${t.google}</span></button>
      <p class="sep">${t.or}</p>`;

const credentialFields = (t: (typeof T)[OAuthLang], autofocus: boolean) => `
      <div class="field">
        <label for="email">${t.email}</label>
        <input class="input" type="email" id="email" name="email" required autocomplete="email"${autofocus ? ' autofocus' : ''} />
      </div>
      <div class="field">
        <div class="label-row">
          <label for="password">${t.password}</label>
          <a class="link" href="${FRONTEND_BASE_URL}/forgot-password" target="_blank" rel="noopener">${t.forgot}</a>
        </div>
        <input class="input" type="password" id="password" name="password" required autocomplete="current-password" />
      </div>`;

// ── Telas ────────────────────────────────────────────────────────────────────

export function buildLoginPage(p: {
  lang: OAuthLang;
  apiBase: string;
  clientName: string;
  /** URL de /oauth/authorize com todos os parâmetros, sem o token */
  authorizeUrl: string;
  /** O Google devolveu erro na tentativa anterior */
  googleFailed?: boolean;
}): string {
  const t = T[p.lang];
  const { pathname, search } = new URL(p.authorizeUrl);
  return page({
    lang: p.lang,
    title: t.pageSignIn,
    body: `
    <section class="card">
      <div>
        <h1>${esc(t.signInTitle(p.clientName))}</h1>
        <p class="lead">${t.signInLead}</p>
      </div>${googleBlock(t)}
      <form class="form" id="signin" novalidate>${credentialFields(t, false)}
        <p class="alert" id="alert" role="alert">${p.googleFailed ? t.googleFailed : ''}</p>
        <button type="submit" class="btn btn-primary btn-block" id="submit">${t.signIn}</button>
      </form>
    </section>
    <p class="foot">${t.noAccount} <a class="link" href="${FRONTEND_BASE_URL}" target="_blank" rel="noopener">${t.createAccount}</a></p>`,
    script: signInScript({ apiBase: p.apiBase, returnPath: pathname + search, t }),
  });
}

export function buildConsentPage(p: {
  lang: OAuthLang;
  action: string;
  clientName: string;
  accountEmail: string | null;
  /** Host pra onde o navegador volta; null em OOB */
  returnHost: string | null;
  switchAccountUrl: string;
  scopes: string;
  hidden: Record<string, string>;
}): string {
  const t = T[p.lang];
  const hidden = Object.entries(p.hidden)
    .filter(([, v]) => v)
    .map(([k, v]) => `<input type="hidden" name="${esc(k)}" value="${esc(v)}" />`)
    .join('\n        ');
  return page({
    lang: p.lang,
    title: t.pageAuthorize,
    body: `
    <section class="card">
      <h1>${esc(t.consentTitle(p.clientName))}</h1>
      ${whoBlock(t, p.accountEmail, p.switchAccountUrl)}
      ${scopeList(t, p.scopes)}
      <p class="dest">${
        p.returnHost
          ? `${t.returnsTo} <span class="mono">${esc(p.returnHost)}</span>.`
          : t.oobReturns
      }</p>
      <form method="POST" action="${esc(p.action)}" class="actions">
        ${hidden}
        <button type="submit" name="action" value="deny" class="btn">${t.deny}</button>
        <button type="submit" name="action" value="approve" class="btn btn-primary">${t.approve}</button>
      </form>
    </section>
    ${revokeFoot(t)}`,
  });
}

export function buildDeviceLoginPage(p: {
  lang: OAuthLang;
  apiBase: string;
  prefillCode: string;
  /** O Google devolveu erro na tentativa anterior */
  googleFailed?: boolean;
}): string {
  const t = T[p.lang];
  return page({
    lang: p.lang,
    title: t.pageDevice,
    body: `
    <section class="card">
      <div>
        <h1>${t.deviceTitle}</h1>
        <p class="lead">${t.deviceLoginLead}</p>
      </div>
      <div class="field">
        <label for="deviceCode">${t.deviceCode}</label>
        <input class="input input-code" id="deviceCode" type="text" inputmode="text" autocomplete="one-time-code" maxlength="9" placeholder="ABCD-1234" value="${esc(p.prefillCode)}"${p.prefillCode ? '' : ' autofocus'} />
      </div>${googleBlock(t)}
      <form class="form" id="signin" novalidate>${credentialFields(t, false)}
        <p class="alert" id="alert" role="alert">${p.googleFailed ? t.googleFailed : ''}</p>
        <button type="submit" class="btn btn-primary btn-block" id="submit">${t.signIn}</button>
      </form>
    </section>
    <p class="foot">${t.noAccount} <a class="link" href="${FRONTEND_BASE_URL}" target="_blank" rel="noopener">${t.createAccount}</a></p>`,
    script: CODE_MASK + signInScript({ apiBase: p.apiBase, t }),
  });
}

export function buildDeviceCodeEntryPage(p: {
  lang: OAuthLang;
  apiBase: string;
  token: string;
}): string {
  const t = T[p.lang];
  return page({
    lang: p.lang,
    title: t.pageDevice,
    body: `
    <section class="card">
      <div>
        <h1>${t.deviceTitle}</h1>
        <p class="lead">${t.deviceLead}</p>
      </div>
      <form class="form" method="GET" action="${esc(p.apiBase)}/oauth/device" id="codeForm">
        <div class="field">
          <label for="deviceCode">${t.deviceCode}</label>
          <input class="input input-code" id="deviceCode" name="code" type="text" autocomplete="one-time-code" maxlength="9" placeholder="ABCD-1234" required autofocus />
        </div>
        <input type="hidden" name="token" value="${esc(p.token)}" />
        <button type="submit" class="btn btn-primary btn-block">${t.continue}</button>
      </form>
    </section>`,
    script: CODE_MASK,
  });
}

export function buildDeviceConsentPage(p: {
  lang: OAuthLang;
  action: string;
  clientName: string;
  accountEmail: string | null;
  userCode: string;
  scopes: string;
  token: string;
}): string {
  const t = T[p.lang];
  return page({
    lang: p.lang,
    title: t.pageAuthorize,
    body: `
    <section class="card">
      <h1>${esc(t.consentTitle(p.clientName))}</h1>
      ${whoBlock(t, p.accountEmail)}
      <div>
        <p class="list-label">${t.deviceConfirm}</p>
        <div class="code-pill">${esc(p.userCode)}</div>
      </div>
      ${scopeList(t, p.scopes)}
      <form method="POST" action="${esc(p.action)}" class="actions">
        <input type="hidden" name="user_code" value="${esc(p.userCode)}" />
        <input type="hidden" name="token" value="${esc(p.token)}" />
        <button type="submit" name="action" value="deny" class="btn">${t.deny}</button>
        <button type="submit" name="action" value="approve" class="btn btn-primary">${t.approve}</button>
      </form>
    </section>
    ${revokeFoot(t)}`,
  });
}

/**
 * Retorno do login com Google em popup (plugin, Club, CLI). Fecha sozinho
 * quando foi aberto por window.open; aba solta só mostra a dica.
 */
export function buildPopupResultPage(p: {
  ok: boolean;
  title: string;
  lead: string;
  hint: string;
}): string {
  return page({
    lang: 'pt',
    title: p.title,
    body: `
    <section class="card">
      <div class="status ${p.ok ? 'status-ok' : 'status-warn'}">${p.ok ? ICON.check : ICON.warn}</div>
      <div>
        <h1>${esc(p.title)}</h1>
        <p class="lead">${esc(p.lead)}</p>
      </div>
      <p class="dest">${esc(p.hint)}</p>
    </section>`,
    script: `
  setTimeout(function () { if (window.opener) { try { window.close(); } catch (e) {} } }, 2000);`,
  });
}

/** Fim de fluxo: conectado ou recusado. Serve device flow e OOB negado. */
export function buildDonePage(p: { lang: OAuthLang; approved: boolean }): string {
  const t = T[p.lang];
  return page({
    lang: p.lang,
    title: p.approved ? t.pageDone : t.pageDenied,
    body: `
    <section class="card">
      <div class="status ${p.approved ? 'status-ok' : ''}">${p.approved ? ICON.check : ICON.x}</div>
      <div>
        <h1>${p.approved ? t.doneTitle : t.deniedTitle}</h1>
        <p class="lead">${p.approved ? t.doneLead : t.deniedLead}</p>
      </div>
    </section>`,
  });
}

export function buildOobCodePage(p: { lang: OAuthLang; code: string }): string {
  const t = T[p.lang];
  return page({
    lang: p.lang,
    title: t.pageDone,
    body: `
    <section class="card">
      <div class="status status-ok">${ICON.check}</div>
      <div>
        <h1>${t.oobTitle}</h1>
        <p class="lead">${t.oobLead}</p>
      </div>
      <div>
        <p class="list-label">${t.oobCode}</p>
        <div class="code-row">
          <div class="code-box" id="code">${esc(p.code)}</div>
          <button type="button" class="btn btn-block" id="copy" aria-live="polite">${ICON.copy}<span>${t.copy}</span></button>
        </div>
      </div>
      <p class="dest">${t.oobExpires}</p>
    </section>`,
    script: `
  var copyBtn = document.getElementById('copy');
  var idle = copyBtn.innerHTML;
  var done = ${JSON.stringify(`${ICON.copied}<span>${t.copied}</span>`)};
  copyBtn.addEventListener('click', function () {
    navigator.clipboard.writeText(document.getElementById('code').textContent).then(function () {
      copyBtn.innerHTML = done;
      setTimeout(function () { copyBtn.innerHTML = idle; }, 2000);
    });
  });`,
  });
}

export function buildErrorPage(p: {
  lang: OAuthLang;
  error: OAuthErrorKey;
  retryUrl?: string;
}): string {
  const t = T[p.lang];
  return page({
    lang: p.lang,
    title: t.pageError,
    body: `
    <section class="card">
      <div class="status status-warn">${ICON.warn}</div>
      <div>
        <h1>${t.errorTitle}</h1>
        <p class="lead">${OAUTH_ERRORS[p.lang][p.error]}</p>
      </div>
      ${p.retryUrl ? `<a class="btn btn-block" href="${esc(p.retryUrl)}">${t.tryAgain}</a>` : ''}
    </section>`,
  });
}
