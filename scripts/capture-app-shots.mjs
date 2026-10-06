#!/usr/bin/env node
/**
 * capture-app-shots — prints reais dos apps (landing + capas da /apps), em vez
 * de thumb gerada por IA ou ilustração geométrica.
 *
 * Por que existe: capturar pelo browser do usuário amarra o print à resolução
 * física do monitor (1366x768 aqui) e ainda deixa nome e créditos do dono na
 * tela. Headless resolve os dois: viewport arbitrário, escala 2x, e o recorte
 * por rota tira o chrome do app junto com o dado pessoal.
 *
 *   node scripts/capture-app-shots.mjs                  # tudo, pro .tmp-shots
 *   node scripts/capture-app-shots.mjs --only=canvas,3d-studio
 *   node scripts/capture-app-shots.mjs --out=public/tools --webp   # publica
 *   node scripts/capture-app-shots.mjs --full           # viewport inteiro, sem recorte (depurar)
 *   node scripts/capture-app-shots.mjs --headed         # pra depurar seletor
 *   node scripts/capture-app-shots.mjs --list           # lista os prints disponíveis
 *
 *   CAPTURE_BASE=http://localhost:5199 node scripts/capture-app-shots.mjs ...
 *
 * Sem --out ele NÃO toca em public/. Publicar é passo explícito.
 *
 * Portão de custo (LEI: toda chamada de IA contabiliza): durante a captura,
 * toda requisição /api que não seja GET é ABORTADA no browser. O print é de
 * leitura: não gera, não salva, não cobra. O que foi barrado sai no log da
 * rota, pra ninguém confundir tela vazia com bug.
 */
import { chromium } from 'playwright';
import sharp from 'sharp';
import fs from 'node:fs/promises';
import path from 'node:path';

const BASE = process.env.CAPTURE_BASE || 'http://localhost:3000';
const argv = process.argv.slice(2);
const flag = (name) => argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];
const has = (name) => argv.includes(`--${name}`);

const OUT = flag('out') || path.join(process.cwd(), '.tmp-shots');
const ONLY = flag('only')
  ?.split(',')
  .map((s) => s.trim());
const AS_WEBP = has('webp');
const FULL = has('full');
const SCALE = Number(flag('scale') || 2);
const MAX_W = Number(flag('max') || 1400);

// Recorte: IGUAL pra todas as capas. A área útil do app (sem topbar, onde
// moram nome, avatar e créditos, e sem o rail da esquerda) sai sempre com
// 1680x1050 CSS px, que já é 16:10 — a proporção da capa na /apps
// (MediaTile aspectRatio={16/10}). Mesmo tamanho = mesma escala de UI no
// card, que é o que fazia as capas antigas não conversarem entre si.
const AREA = { width: 1680, height: 1050 };
// Topbar mede 48px (shell) ou 56px (mini-app): +57 cobre as duas.
const TOP = 57;
// Viewport base. Tela COM rail ganha a largura do rail (medida em runtime)
// antes do print, então o conteúdo fica com os mesmos 1680px das sem rail.
const VIEWPORT = { width: AREA.width, height: AREA.height + TOP };

// Arquivos de exemplo pros mini-tools. Neutros e do próprio repo: a foto é a
// cena genérica de prova (sem marca de cliente, sem rosto em foco), o SVG é a
// textura da própria Visant e o PNG é o ícone do Labs (com transparência, que
// é o que favicon/watermark/remove-bg precisam pra mostrar resultado).
const SAMPLE = {
  photo: 'public/proof/generic.jpg',
  svg: 'public/textures/visant-grid.svg',
  icon: 'public/logo-vsn-labs.png',
};

// Botão primário "processar" da sidebar do MiniAppShell: w-full text-xs com
// o rótulo em <span class="ml-2">. Só "w-full" pegava "Marcar foco" no
// remove-bg e "Repetir em mosaico" no watermark.
const PROCESS_BTN = 'button.w-full.text-xs:has(> span.ml-2):not([disabled])';

/**
 * Uma entrada por capa. `file` casa com /tools/<file>.webp, que é o nome que
 * a AppsPage (e a landing) já referenciam.
 *
 * O recorte não é por rota: mede topbar e rail no DOM (ver chromeBox).
 * upload: arquivo carregado pelo input file real do Dropzone.
 * process: seletor clicado depois do upload. SÓ em ferramenta que roda no
 *   browser (canvas/shader/wasm). Rota que chama IA paga não tem `process`.
 * mock: { caminho: json } — resposta GET fixa, pra pular estado que
 *   dispararia geração ao montar.
 * type: [{ sel, text, enter }] — preenche campo antes do print (ferramenta
 *   que sem entrada é tela vazia: qrcode, color-converter).
 * wheel: N notches de scroll (zoom out) no centro da área útil.
 * draw: traça pinceladas no <canvas> (grid-paint não tem upload).
 */
const SHOTS = [
  // ── Pro ────────────────────────────────────────────────────────────────
  {
    file: 'mockup-machine',
    route: '/mockupmachine',
    // SEM upload: o upload dispara aiApi.analyzeSetup (Gemini, pago) sozinho.
    // A capa é a ferramenta em repouso.
    settle: 3500,
  },
  {
    file: 'branding-machine',
    resolve: async (api) => {
      // O mais completo, não o mais recente: projeto com etapa faltando mostra
      // fileira de pílulas vermelhas "Bloqueado", que lê como erro na capa.
      const { projects = [] } = await api('/api/branding?limit=30');
      const filled = (d = {}) =>
        Object.values(d).filter((v) => v && (typeof v !== 'object' || Object.keys(v).length))
          .length;
      const best = projects.sort((a, b) => filled(b.data) - filled(a.data))[0];
      if (!best) throw new Error('nenhum projeto de branding');
      return `/branding-machine?projectId=${best.id}`;
    },
    settle: 3500,
    // O projeto abre com um modal de etapa por cima. Escape antes do print.
    escape: true,
    dismiss: ['[aria-label*="fechar" i]', '[aria-label*="close" i]'],
  },
  {
    file: 'brand-guidelines',
    route: '/brand-guidelines',
    waitFor: '[class*="grid"] a, [class*="grid"] button',
    settle: 2500,
  },
  {
    file: 'canvas',
    // Pega o projeto com mais nós. Clicar no primeiro item da lista trazia
    // "Untitled" com 1 nó, que é print de canvas vazio.
    resolve: async (api) => {
      const { projects = [] } = await api('/api/canvas/?limit=20');
      const best = projects
        .map((p) => ({ id: p.id, n: p.nodes?.length ?? p.data?.nodes?.length ?? 0 }))
        .sort((a, b) => b.n - a.n)[0];
      if (!best?.n) throw new Error('nenhum projeto de canvas com nós');
      return `/canvas/${best.id}`;
    },
    waitFor: '.react-flow, canvas',
    settle: 4000,
    fitView: true,
  },
  {
    file: 'instagram-extractor',
    route: '/extractor',
    settle: 2500,
  },
  {
    file: 'moodboard-studio',
    route: '/moodboard',
    // Upload só vira sourceImage; a detecção (IA) é botão manual.
    upload: SAMPLE.photo,
    settle: 4500,
  },
  {
    file: 'budget-machine',
    route: '/budget-machine',
    settle: 2500,
  },
  {
    file: 'content-studio',
    route: '/content-studio',
    settle: 2500,
  },
  {
    file: 'naming-machine',
    route: '/naming',
    // Sessão salva em fase 'deck' com o baralho vazio dispara fetchBatch (IA)
    // ao montar. Lista de sessões vazia => abre no briefing, sem gerar nada.
    mock: { '/api/naming-sessions': { sessions: [] } },
    settle: 3000,
  },
  {
    file: 'copilot',
    // Atrás de VITE_FEATURE_COPILOT: rodar contra um vite com a flag ligada.
    route: '/copilot',
    // A lista de sessões é o histórico de conversa do dono ("opa blz?",
    // nome de cliente). Capa sai com a lista vazia.
    mock: { '/api/copilot/sessions': { sessions: [] } },
    settle: 3000,
  },

  // ── Creative ───────────────────────────────────────────────────────────
  {
    file: 'grid-machine',
    route: '/grid-machine',
    upload: SAMPLE.svg,
    settle: 3000,
  },
  {
    file: '3d-studio',
    route: '/3d-studio',
    waitFor: 'canvas',
    settle: 4000, // WebGL precisa de frame pintado, não só de DOM
  },
  {
    // Stateless: sem upload a tela é um dropzone vazio. O halftone roda no
    // cliente, então subir um arquivo aqui não gasta crédito nem chama IA.
    // Arquivo é cmyk-halftone porque é o que a AppsPage E o banco apontam.
    file: 'cmyk-halftone',
    route: '/image-lab',
    upload: SAMPLE.photo,
    // O preview abre a 100% (pixel real) e vira um recorte de bolinhas. Roda a
    // roda do mouse pra afastar até a foto inteira caber, como o dono vê.
    wheel: 6,
    settle: 4500,
  },
  {
    file: 'gridpaint',
    route: '/grid-paint',
    draw: true,
    settle: 2000,
  },
  {
    file: 'labs',
    route: '/labs',
    settle: 3000,
  },

  // ── Mini-tools: todos rodam no browser (canvas, shader, wasm/onnx) ─────
  { file: 'compress', route: '/compress', upload: SAMPLE.photo, process: PROCESS_BTN, settle: 3000 },
  // Upscale = shader bicúbico local (applyShaderEffect), não IA.
  { file: 'upscale', route: '/upscale', upload: SAMPLE.photo, process: PROCESS_BTN, settle: 5000 },
  // Remove-bg = @imgly/background-removal no browser (baixa o modelo do CDN).
  { file: 'remove-bg', route: '/remove-bg', upload: SAMPLE.photo, process: PROCESS_BTN, settle: 45000 },
  { file: 'watermark', route: '/watermark', upload: SAMPLE.photo, process: PROCESS_BTN, settle: 3000 },
  { file: 'file-converter', route: '/converter', upload: SAMPLE.photo, process: PROCESS_BTN, settle: 3000 },
  { file: 'svg-optimizer', route: '/svg-optimizer', upload: SAMPLE.svg, settle: 3000 },
  { file: 'favicon', route: '/favicon', upload: SAMPLE.icon, process: PROCESS_BTN, settle: 3000 },
  {
    file: 'og-image',
    route: '/og-image',
    upload: SAMPLE.icon,
    type: [{ sel: '#og-title', text: 'Visant Labs' }],
    settle: 3000,
  },
  {
    file: 'color-converter',
    route: '/color-converter',
    // Paleta da própria Visant: três cores dão grade de conversão de verdade.
    type: [
      { sel: '#color-converter-input', text: '#00D9FF', enter: true },
      // 2ª cor escura: o contraste WCAG compara as duas primeiras, e um par
      // reprovado pinta pílulas vermelhas que leem como erro na capa.
      { sel: '#color-converter-input', text: '#0A0A0A', enter: true },
      { sel: '#color-converter-input', text: '#FF6038', enter: true },
    ],
    settle: 2000,
  },
  {
    file: 'qrcode',
    route: '/qrcode',
    type: [{ sel: 'aside input[type=text], input[type=text]', text: 'https://visantlabs.com' }],
    settle: 2000,
  },
  {
    file: 'visual-search',
    route: '/visual-search',
    // Buscar = embedding da consulta (IA). A capa é a busca em repouso.
    settle: 3500,
  },

  // ── Admin ──────────────────────────────────────────────────────────────
  {
    file: 'smart-analyzer',
    route: '/admin/smart-analyzer',
    settle: 3000,
  },

  // ── Landing (bento): mantidos com o recorte próprio ────────────────────
  {
    file: 'playground',
    resolve: async (api) => {
      const { miniApps = [] } = await api('/api/playground/feed?limit=10');
      if (!miniApps.length) throw new Error('nenhum mini-app publicado');
      return `/playground/${miniApps[0].slug}`;
    },
    waitFor: 'iframe, canvas',
    settle: 5000,
  },
];

/**
 * Roda dentro da página antes de cada print, e devolve o que ainda vaza.
 *
 * Duas famílias: dado pessoal (nome, e-mail, saldo de crédito) e ruído
 * temporal (toast, checklist de onboarding, tooltip). A primeira é a que
 * impede o print de ir pra produção, então a varredura é no documento
 * inteiro. Restringir a header/nav deixou passar o "Good morning, Pedro"
 * que o playground escreve no meio da página.
 */
const SANITIZE = `(() => {
  const kill = (el) => { if (el) el.style.setProperty('visibility','hidden','important'); };

  document.querySelectorAll(
    '[data-sonner-toaster],[data-radix-popper-content-wrapper],[role="status"],[role="alert"],.Toastify'
  ).forEach((el) => el.style.setProperty('display','none','important'));

  document.querySelectorAll('[data-vsn-component*="Checklist"],[data-vsn-component*="Chat"]')
    .forEach((el) => el.style.setProperty('display','none','important'));

  // Saudação com nome próprio, e-mail e saldo de crédito. Documento inteiro.
  const PII = /(bom dia|boa tarde|boa noite|good (morning|afternoon|evening)|welcome back|ol[aá]),?\\s+\\w|@[\\w.-]+\\.\\w{2,}|\\bcr[eé]ditos?\\b/i;
  const leaked = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const hits = [];
  let n;
  while ((n = walker.nextNode())) {
    const txt = (n.textContent || '').trim();
    if (txt && txt.length < 120 && PII.test(txt)) hits.push(n);
  }
  for (const node of hits) {
    const el = node.parentElement;
    if (!el) continue;
    leaked.push((node.textContent || '').trim().slice(0, 60));
    kill(el.closest('button,a,[role="button"]') || el);
  }
  return leaked;
})()`;

// Chave i18n crua na tela (ex.: "apps.naming.title") = tradução faltando.
// Não esconde: o print com chave crua não pode ser publicado, então avisa.
const RAW_KEYS = `(() => {
  const out = new Set();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = walker.nextNode())) {
    const el = n.parentElement;
    if (!el || el.closest('script,style,code,pre')) continue;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height || r.bottom < 0 || r.top > innerHeight) continue;
    const txt = (n.textContent || '').trim();
    if (/^[a-z][a-zA-Z0-9_]*(\\.[a-zA-Z0-9_]+){1,}$/.test(txt) && !/\\.(com|br|io|ai|app|png|jpg|svg|webp)$/.test(txt)) out.add(txt);
  }
  return [...out].slice(0, 8);
})()`;

const login = async (page) => {
  // `tsx watch` derruba a conexão do Prisma quando recarrega, e o dev-login
  // devolve 500 por alguns segundos. Não é motivo pra perder a rodada inteira.
  let body = null;
  for (let attempt = 1; attempt <= 4; attempt++) {
    const res = await page.request
      .post(`${BASE}/api/auth/dev-login`, { data: {} })
      .catch(() => null);
    if (res?.ok()) {
      body = await res.json().catch(() => null);
      if (body) break;
    }
    if (attempt === 4) throw new Error(`dev-login falhou após 4 tentativas (${res?.status()})`);
    process.stdout.write(` [login retry ${attempt}] `);
    await page.waitForTimeout(3000);
  }
  const token = body.token || body.accessToken || body?.data?.token;
  if (!token) throw new Error(`dev-login não devolveu token. Chaves: ${Object.keys(body)}`);
  await page.addInitScript((t) => {
    localStorage.setItem('auth_token', t);
    localStorage.setItem('token', t);
    // Mata o onboarding antes de ele montar, em vez de esconder depois
    localStorage.setItem('vsn_onboarding_dismissed', '1');
  }, token);
  return token;
};

/**
 * Mede o chrome do app: rail = <aside> colado no canto esquerdo, da altura da
 * tela; topbar = <header> no topo. Devolve onde a área útil começa.
 */
const CHROME = `(() => {
  let rail = 0, top = 0;
  for (const e of document.querySelectorAll('aside')) {
    const r = e.getBoundingClientRect();
    if (r.left <= 1 && r.top <= 1 && r.width >= 160 && r.width <= 320 && r.height >= innerHeight * 0.8)
      rail = Math.max(rail, Math.round(r.right));
  }
  for (const e of document.querySelectorAll('header')) {
    const r = e.getBoundingClientRect();
    if (r.top <= 1 && r.height > 0 && r.height <= 80) top = Math.max(top, Math.round(r.bottom));
  }
  return { rail, top };
})()`;

// Estado por rota que o route handler lê (o handler é do contexto inteiro).
const net = { blocked: [], mock: null };

const capture = async (page, shot, api) => {
  net.blocked = [];
  net.mock = shot.mock || null;
  const route = shot.resolve ? await shot.resolve(api) : shot.route;
  await page.setViewportSize(VIEWPORT);
  await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(1500);

  // Tela com rail: alarga o viewport pela largura do rail, assim a área útil
  // continua com AREA.width e a UI sai na mesma escala das telas sem rail.
  let chrome = await page.evaluate(CHROME);
  if (chrome.rail) {
    await page.setViewportSize({ width: AREA.width + chrome.rail, height: VIEWPORT.height });
    await page.waitForTimeout(1000);
    chrome = await page.evaluate(CHROME);
  }
  if (chrome.top > TOP) throw new Error(`topbar com ${chrome.top}px, maior que TOP=${TOP}`);

  if (shot.upload) {
    const file = path.resolve(process.cwd(), shot.upload);
    await fs.access(file);
    // O input costuma ser hidden atrás de um dropzone; setInputFiles não
    // precisa dele visível, e é o caminho que não dispara diálogo do SO.
    const input = page.locator('input[type=file]').first();
    await input.waitFor({ state: 'attached', timeout: 15000 });
    await input.setInputFiles(file);
    await page.waitForTimeout(1200);
  }

  for (const step of shot.type ?? []) {
    const el = page.locator(step.sel).first();
    await el.waitFor({ state: 'visible', timeout: 10000 });
    await el.fill(step.text);
    if (step.enter) await el.press('Enter');
    await page.waitForTimeout(400);
  }

  if (shot.wheel) {
    await page.mouse.move(chrome.rail + AREA.width / 2, TOP + AREA.height / 2);
    for (let i = 0; i < shot.wheel; i++) {
      await page.mouse.wheel(0, 100);
      await page.waitForTimeout(80);
    }
    await page.waitForTimeout(800);
  }

  if (shot.draw) {
    // Pinceladas em onda atravessando o canvas: mostra a grade pintada sem
    // depender de arquivo. Coordenadas relativas ao bbox do canvas.
    const box = await page.locator('canvas').first().boundingBox();
    if (!box) throw new Error('draw: canvas não encontrado');
    for (let k = 0; k < 5; k++) {
      const y0 = box.y + box.height * (0.2 + k * 0.15);
      await page.mouse.move(box.x + box.width * 0.1, y0);
      await page.mouse.down();
      for (let i = 0; i <= 40; i++) {
        const t = i / 40;
        await page.mouse.move(
          box.x + box.width * (0.1 + 0.8 * t),
          y0 + Math.sin(t * Math.PI * 2 + k) * box.height * 0.06
        );
      }
      await page.mouse.up();
    }
  }

  if (shot.process) {
    const btn = page.locator(shot.process).first();
    await btn.click({ timeout: 8000 }).catch(() => {
      throw new Error(`botão de processar não encontrado (${shot.process})`);
    });
  }

  if (shot.waitFor) {
    await page.waitForSelector(shot.waitFor, { timeout: 15000 }).catch(() => {});
  }
  await page.waitForTimeout(shot.settle ?? 2000);

  if (shot.fitView) {
    // react-flow expõe o fit-view por atributo; teclado não funciona headless
    await page
      .locator('.react-flow__controls-fitview, [aria-label*="fit" i]')
      .first()
      .click({ timeout: 3000 })
      .catch(() => {});
    await page.waitForTimeout(1200);
  }

  if (shot.escape) {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(600);
  }
  for (const sel of shot.dismiss ?? []) {
    await page
      .locator(sel)
      .first()
      .click({ timeout: 3000 })
      .catch(() => {});
    await page.waitForTimeout(500);
  }

  // Tira foco/hover de onde o clique de processar deixou o mouse.
  const vp = page.viewportSize();
  await page.mouse.move(vp.width - 2, vp.height - 2);
  const leaked = await page.evaluate(SANITIZE);
  const rawKeys = await page.evaluate(RAW_KEYS);
  await page.waitForTimeout(400);

  const clip = FULL
    ? { x: 0, y: 0, width: vp.width, height: vp.height }
    : { x: chrome.rail, y: TOP, width: AREA.width, height: AREA.height };

  const png = await page.screenshot({ clip, type: 'png' });
  const target = path.join(OUT, `${shot.file}.${AS_WEBP ? 'webp' : 'png'}`);

  // Capturar a 2x e publicar a 2x são coisas diferentes: o card mais largo da
  // landing tem ~800px CSS, então 1400px cobre retina e o resto é peso morto.
  let pipe = sharp(png);
  if (AS_WEBP) {
    pipe = pipe.resize({ width: MAX_W, withoutEnlargement: true }).webp({ quality: 80, effort: 6 });
  } else {
    pipe = pipe.png({ compressionLevel: 9 });
  }
  await pipe.toFile(target);

  const meta = await sharp(png).metadata();
  const { size } = await fs.stat(target);
  if (AS_WEBP && size > 320_000)
    console.warn(`\n    aviso: ${shot.file}.webp ficou com ${Math.round(size / 1024)}KB`);
  return { file: target, w: meta.width, h: meta.height, route, leaked, rawKeys, blocked: [...net.blocked] };
};

const main = async () => {
  if (has('list')) {
    console.log(SHOTS.map((s) => `${s.file.padEnd(20)} ${s.route || '(resolve)'}`).join('\n'));
    return;
  }
  await fs.mkdir(OUT, { recursive: true });
  const list = ONLY ? SHOTS.filter((s) => ONLY.includes(s.file)) : SHOTS;
  if (!list.length)
    throw new Error(
      `--only não casou com nenhuma rota. Disponíveis: ${SHOTS.map((s) => s.file).join(', ')}`
    );

  // WebGL em headless: sem SwiftShader o 3D Studio cai no ErrorBoundary
  // ("Essa área travou") e o print sai com estado de erro.
  const browser = await chromium.launch({
    headless: !has('headed'),
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  });
  const ctx = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: FULL ? 1 : SCALE,
    colorScheme: 'dark',
    locale: 'pt-BR',
    reducedMotion: 'reduce', // congela animação de entrada, senão o print pega meio-fade
  });

  // Portão de custo: /api só lê. Ver cabeçalho.
  await ctx.route('**/api/**', async (r) => {
    const req = r.request();
    const url = new URL(req.url());
    if (req.method() === 'GET' && net.mock) {
      const hit = Object.keys(net.mock).find((p) => url.pathname === p);
      if (hit) return r.fulfill({ json: net.mock[hit] });
    }
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method())) return r.continue();
    net.blocked.push(`${req.method()} ${url.pathname}`);
    return r.abort('blockedbyclient');
  });

  // O bucket R2 (HDRI do 3D Studio) só libera CORS pras origens conhecidas.
  // Vite em porta alternativa (5199) leva CORS bloqueado e o 3D Studio cai
  // no ErrorBoundary. Busca pelo lado do Playwright e devolve com ACAO.
  await ctx.route('https://*.r2.dev/**', async (r) => {
    try {
      const resp = await r.fetch();
      await r.fulfill({
        response: resp,
        headers: { ...resp.headers(), 'access-control-allow-origin': '*' },
      });
    } catch {
      await r.continue();
    }
  });

  const page = await ctx.newPage();
  page.on('pageerror', () => {});

  const token = await login(page);
  const api = async (ep) => {
    const r = await page.request.get(`${BASE}${ep}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!r.ok()) throw new Error(`${ep} devolveu ${r.status()}`);
    return r.json();
  };

  const results = [];
  for (const shot of list) {
    process.stdout.write(`  ${shot.file.padEnd(20)}`);
    try {
      const r = await capture(page, shot, api);
      const warn = [
        r.leaked?.length ? `PII escondido: ${r.leaked.join(' / ')}` : '',
        r.rawKeys?.length ? `CHAVE i18n CRUA: ${r.rawKeys.join(', ')}` : '',
        r.blocked?.length ? `barrado: ${[...new Set(r.blocked)].join(', ')}` : '',
      ]
        .filter(Boolean)
        .join('  |  ');
      console.log(`ok  ${r.w}x${r.h}  ${r.route}${warn ? `\n      ${warn}` : ''}`);
      results.push({ ...shot, ok: true, ...r });
    } catch (err) {
      console.log(`FALHOU  ${err.message.split('\n')[0]}`);
      results.push({ ...shot, ok: false, error: err.message });
    }
  }

  await browser.close();

  const ok = results.filter((r) => r.ok).length;
  const pii = results.filter((r) => r.leaked?.length);
  const raw = results.filter((r) => r.rawKeys?.length);
  console.log(`\n${ok}/${results.length} capturados em ${OUT}`);
  if (pii.length) {
    console.log(`${pii.length} rota(s) tinham dado pessoal na tela. Foi escondido antes do print,`);
    console.log('mas vale conferir o PNG antes de publicar.');
  }
  if (raw.length) console.log(`${raw.length} rota(s) com chave i18n crua na tela: NÃO publicar sem corrigir.`);
  if (!AS_WEBP)
    console.log('PNG. Rode com --webp --out=public/tools quando os recortes estiverem bons.');
  process.exitCode = ok === results.length && !raw.length ? 0 : 1;
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
