#!/usr/bin/env node
/**
 * capture-app-shots — prints reais dos apps pra landing, em vez de thumb gerada por IA.
 *
 * Por que existe: capturar pelo browser do usuário amarra o print à resolução
 * física do monitor (1366x768 aqui) e ainda deixa nome e créditos do dono na
 * tela. Headless resolve os dois: viewport arbitrário, escala 2x, e o recorte
 * por rota tira o chrome do app junto com o dado pessoal.
 *
 *   node scripts/capture-app-shots.mjs                  # tudo, pro scratchpad
 *   node scripts/capture-app-shots.mjs --only=canvas,3d-studio
 *   node scripts/capture-app-shots.mjs --out=public/tools --webp   # publica
 *   node scripts/capture-app-shots.mjs --headed         # pra depurar seletor
 *
 * Sem --out ele NÃO toca em public/. Publicar é passo explícito.
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
const ONLY = flag('only')?.split(',').map((s) => s.trim());
const AS_WEBP = has('webp');
const SCALE = Number(flag('scale') || 2);
const MAX_W = Number(flag('max') || 1400);

// Viewport de captura. Grande de propósito: o recorte de cada rota é um
// pedaço disto, e sobra resolução pra tela retina depois do downscale.
const VIEWPORT = { width: 1680, height: 1050 };

/**
 * Uma entrada por thumb da landing. `file` casa com /tools/<file>.webp.
 *
 * clip: fração do viewport (0..1), não pixel — assim mexer no VIEWPORT não
 * quebra todos os recortes de uma vez.
 * ratio: proporção alvo do card na landing (o bento é ~3:2, o marquee ~16:10).
 */
const SHOTS = [
  {
    file: 'brand-guidelines',
    route: '/brand-guidelines',
    waitFor: '[class*="grid"] a, [class*="grid"] button',
    settle: 2500,
    // Corta a sidebar (esquerda) e a topbar (onde moram nome e créditos).
    // y começa abaixo do botão "Nova marca", senão sobra um toco de pílula
    // branca no canto superior direito.
    clip: { x: 0.16, y: 0.135, w: 0.84, h: 0.6 },
  },
  {
    file: '3d-studio',
    route: '/3d-studio',
    waitFor: 'canvas',
    settle: 4000, // WebGL precisa de frame pintado, não só de DOM
    // x=0 de propósito: o rail de ferramentas inteiro lê como app, meio rail
    // cortado lê como print mal tirado.
    clip: { x: 0.0, y: 0.085, w: 1.0, h: 0.8 },
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
    clipTo: { selector: '.react-flow__node', pad: 70 },
  },
  {
    file: 'mockup-machine',
    route: '/mockupmachine',
    // Upload não cobra crédito (a geração é que cobra) e já tira a tela do
    // estado 'dropzone vazia' pro estado 'ferramenta com arte dentro'.
    upload: 'public/proof/generic.jpg',
    // A analise do upload leva ~20s. Print antes disso pega o 'ANALISANDO'.
    settle: 28000,
    clip: { x: 0.0, y: 0.06, w: 0.62, h: 0.78 },
  },
  {
    file: 'branding-machine',
    resolve: async (api) => {
      const { projects = [] } = await api('/api/branding?limit=10');
      if (!projects.length) throw new Error('nenhum projeto de branding');
      return `/branding-machine?projectId=${projects[0].id}`;
    },
    settle: 3500,
    // O projeto abre com um modal de etapa por cima. Escape antes do print.
    escape: true,
    dismiss: ['[aria-label*="fechar" i]', '[aria-label*="close" i]'],
    clip: { x: 0.16, y: 0.1, w: 0.84, h: 0.62 },
  },
  {
    file: 'playground',
    resolve: async (api) => {
      const { miniApps = [] } = await api('/api/playground/feed?limit=10');
      if (!miniApps.length) throw new Error('nenhum mini-app publicado');
      return `/playground/${miniApps[0].slug}`;
    },
    waitFor: 'iframe, canvas',
    settle: 5000,
    clipTo: { selector: 'iframe', pad: 56 },
    clip: { x: 0.02, y: 0.09, w: 0.72, h: 0.7 },
  },
  {
    // Stateless: sem upload a tela é um dropzone vazio. O halftone roda no
    // cliente, então subir um arquivo aqui não gasta crédito nem chama IA.
    file: 'image-lab',
    route: '/image-lab',
    upload: 'public/proof/generic.jpg',
    settle: 4500,
    clip: { x: 0.0, y: 0.085, w: 1.0, h: 0.82 },
  },
  {
    file: 'moodboard-studio',
    route: '/moodboard',
    upload: 'public/proof/generic.jpg',
    settle: 4500,
    clipTo: { selector: 'main img, [class*="oodboard"] img, canvas', pad: 110 },
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

const capture = async (page, shot, api) => {
  const route = shot.resolve ? await shot.resolve(api) : shot.route;
  await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded', timeout: 45000 });

  if (shot.upload) {
    const file = path.resolve(process.cwd(), shot.upload);
    await fs.access(file);
    // O input costuma ser hidden atrás de um dropzone; setInputFiles não
    // precisa dele visível, e é o caminho que não dispara diálogo do SO.
    const input = page.locator('input[type=file]').first();
    await input.waitFor({ state: 'attached', timeout: 10000 });
    await input.setInputFiles(file);
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

  const leaked = await page.evaluate(SANITIZE);
  await page.waitForTimeout(400);

  let clip;
  let clipNote = null;
  if (shot.clipTo) {
    // Recorte medido sobre o conteúdo, não sobre o viewport. Telas de canvas
    // e de mini-app posicionam o conteúdo em runtime, então fração fixa erra
    // e sobra tela preta em volta do que interessa.
    const { selector, pad = 60, minH = 0.35 } = shot.clipTo;
    const box = await page.evaluate(
      ([sel, p]) => {
        const els = [...document.querySelectorAll(sel)].filter((e) => {
          const r = e.getBoundingClientRect();
          return r.width > 8 && r.height > 8 && r.bottom > 0 && r.top < innerHeight;
        });
        if (!els.length) return null;
        const r = els.map((e) => e.getBoundingClientRect());
        const x = Math.max(0, Math.min(...r.map((b) => b.left)) - p);
        const y = Math.max(0, Math.min(...r.map((b) => b.top)) - p);
        const x2 = Math.min(innerWidth, Math.max(...r.map((b) => b.right)) + p);
        const y2 = Math.min(innerHeight, Math.max(...r.map((b) => b.bottom)) + p);
        return { x, y, width: x2 - x, height: y2 - y };
      },
      [selector, pad]
    );
    const tooSmall = box && box.height < minH * VIEWPORT.height;
    if (!box || tooSmall) {
      // Sem fallback o print some da rodada, que é pior que um enquadramento
      // mediano. Cai pro recorte por fração e avisa.
      if (!shot.clip)
        throw new Error(
          !box ? `clipTo não achou "${selector}" e não há clip de reserva` : `clipTo achou área pequena demais e não há clip de reserva`
        );
      clipNote = !box ? `clipTo falhou (${selector}), usou clip fixo` : 'clipTo pequeno demais, usou clip fixo';
    } else {
      clip = {
        x: Math.round(box.x),
        y: Math.round(box.y),
        width: Math.round(box.width),
        height: Math.round(box.height),
      };
    }
  }
  if (!clip) {
    const c = shot.clip;
    clip = {
      x: Math.round(c.x * VIEWPORT.width),
      y: Math.round(c.y * VIEWPORT.height),
      width: Math.round(c.w * VIEWPORT.width),
      height: Math.round(c.h * VIEWPORT.height),
    };
  }

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
  return { file: target, w: meta.width, h: meta.height, route, leaked, clipNote };
};

const main = async () => {
  await fs.mkdir(OUT, { recursive: true });
  const list = ONLY ? SHOTS.filter((s) => ONLY.includes(s.file)) : SHOTS;
  if (!list.length) throw new Error(`--only não casou com nenhuma rota. Disponíveis: ${SHOTS.map((s) => s.file).join(', ')}`);

  const browser = await chromium.launch({ headless: !has('headed') });
  const ctx = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: SCALE,
    colorScheme: 'dark',
    locale: 'pt-BR',
    reducedMotion: 'reduce', // congela animação de entrada, senão o print pega meio-fade
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
    process.stdout.write(`  ${shot.file.padEnd(18)}`);
    try {
      const r = await capture(page, shot, api);
      const warn = [r.leaked?.length ? `⚠ PII: ${r.leaked.join(' / ')}` : '', r.clipNote ? `⚠ ${r.clipNote}` : ''].filter(Boolean).join('  ');
      console.log(`ok  ${r.w}x${r.h}  ${r.route}${warn}`);
      results.push({ ...shot, ok: true, ...r });
    } catch (err) {
      console.log(`FALHOU  ${err.message.split('\n')[0]}`);
      results.push({ ...shot, ok: false, error: err.message });
    }
  }

  await browser.close();

  const ok = results.filter((r) => r.ok).length;
  const pii = results.filter((r) => r.leaked?.length);
  console.log(`\n${ok}/${results.length} capturados em ${OUT}`);
  if (pii.length) {
    console.log(`${pii.length} rota(s) tinham dado pessoal na tela. Foi escondido antes do print,`);
    console.log('mas vale conferir o PNG antes de publicar.');
  }
  if (!AS_WEBP)
    console.log('PNG. Rode com --webp --out=public/tools quando os recortes estiverem bons.');
  process.exitCode = ok === results.length ? 0 : 1;
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
