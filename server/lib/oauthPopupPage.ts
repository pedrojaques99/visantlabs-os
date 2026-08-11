/**
 * Página de retorno do OAuth em popup (fluxo popup + poll).
 *
 * SSoT de QUEM abriu o popup. O callback do Google não sabe de onde veio o
 * login — quem sabe é a sessão criada em /auth/google?source=<x>. Sem isso a
 * página fala "volte para o Figma" pra quem entrou pelo Club.
 *
 * Fonte nova = adicionar uma entrada aqui e mandar ?source=<chave>.
 *
 * Os quatro fluxos de auth da casa e quando usar cada um: docs/AUTH_FLOWS.md.
 */

export type PopupOAuthSource = keyof typeof POPUP_OAUTH_SOURCES;

export const POPUP_OAUTH_SOURCES = {
  plugin: { product: 'Figma', backTo: 'Volte para o Figma' },
  club: { product: 'Visant Club', backTo: 'Volte para o Visant Club' },
  app: { product: 'Visant Labs', backTo: 'Volte para o Visant Labs' },
  cli: { product: 'terminal', backTo: 'Volte para o terminal' },
} as const;

const FALLBACK = { product: 'Visant', backTo: 'Volte para a janela anterior' };

export function isPopupOAuthSource(value: unknown): value is PopupOAuthSource {
  return typeof value === 'string' && value in POPUP_OAUTH_SOURCES;
}

function copyFor(source?: string) {
  return isPopupOAuthSource(source) ? POPUP_OAUTH_SOURCES[source] : FALLBACK;
}

const SHELL = (title: string, body: string) => `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark">
<title>${title}</title>
<style>
  :root{--bg:#0a0a0a;--fg:#fafafa;--muted:#8a8a8a;--line:rgba(255,255,255,.08);--accent:#00d9ff;--danger:#ff5c5c}
  *{box-sizing:border-box}
  body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;
    background:var(--bg);color:var(--fg);
    font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Inter,sans-serif;
    -webkit-font-smoothing:antialiased}
  body::before{content:"";position:fixed;inset:0;pointer-events:none;
    background:radial-gradient(60% 50% at 50% 0%,rgba(0,217,255,.10),transparent 70%)}
  .card{position:relative;width:100%;max-width:380px;text-align:center;padding:40px 32px;
    border:1px solid var(--line);border-radius:16px;background:rgba(255,255,255,.02);
    animation:rise .4s cubic-bezier(.22,1,.36,1) both}
  .mark{width:56px;height:56px;margin:0 auto 20px;display:grid;place-items:center;border-radius:50%;
    border:1px solid var(--line);background:rgba(0,217,255,.06)}
  .mark.err{background:rgba(255,92,92,.06)}
  svg{width:26px;height:26px;fill:none;stroke:var(--accent);stroke-width:2.2;
    stroke-linecap:round;stroke-linejoin:round}
  .err svg{stroke:var(--danger)}
  svg path,svg line{stroke-dasharray:32;stroke-dashoffset:32;animation:draw .5s .15s cubic-bezier(.22,1,.36,1) forwards}
  svg line:last-child{animation-delay:.3s}
  h1{margin:0 0 8px;font-size:19px;font-weight:600;letter-spacing:-.01em}
  p{margin:0;font-size:14px;line-height:1.5;color:var(--muted)}
  .hint{margin-top:20px;padding-top:16px;border-top:1px solid var(--line);font-size:12px;color:#6a6a6a}
  @keyframes rise{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
  @keyframes draw{to{stroke-dashoffset:0}}
  @media (prefers-reduced-motion:reduce){*{animation:none!important}svg path,svg line{stroke-dashoffset:0}}
</style></head>
<body>${body}
<script>
  // Popup aberto por window.open fecha sozinho; aba solta só mostra a dica.
  setTimeout(function(){ if (window.opener) { try { window.close() } catch (e) {} } }, 2000);
</script>
</body></html>`;

/** Página de sucesso do popup — o token já foi entregue ao poll. */
export function renderPopupSuccessPage(source?: string): string {
  const { backTo } = copyFor(source);
  return SHELL(
    'Login concluído — Visant',
    `<main class="card">
  <div class="mark"><svg viewBox="0 0 24 24"><path d="M4 12.5 9.5 18 20 6.5"/></svg></div>
  <h1>Login concluído</h1>
  <p>${backTo} para continuar.</p>
  <div class="hint">Você já pode fechar esta aba.</div>
</main>`
  );
}

/** Página de erro do popup — o poll recebe o erro em paralelo. */
export function renderPopupErrorPage(source?: string): string {
  const { product } = copyFor(source);
  return SHELL(
    'Erro no login — Visant',
    `<main class="card">
  <div class="mark err"><svg viewBox="0 0 24 24"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg></div>
  <h1>Não deu pra entrar</h1>
  <p>Feche esta aba e tente de novo pelo ${product}.</p>
  <div class="hint">Se insistir, fale com contato@visant.co.</div>
</main>`
  );
}
