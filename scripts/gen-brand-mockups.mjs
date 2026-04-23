/**
 * Brand Mockup Generator — agnóstico de marca
 *
 * Uso:
 *   node scripts/gen-brand-mockups.mjs --brand "Sports 248" --count 5
 *   node scripts/gen-brand-mockups.mjs --brand "Nike" --count 3
 *   npm run gen:mockups -- --brand "Adidas" --count 7
 *
 * O script:
 *   1. Sobe o servidor Visant se estiver offline
 *   2. Autentica via Bearer token (MCP platform)
 *   3. Busca a brand guideline pelo nome
 *   4. Extrai identidade visual (cores, logos, tipografia, voz)
 *   5. Gera N prompts brand-aware com variação de formato
 *   6. Chama OpenAI gpt-image-2 para cada prompt
 *   7. Salva PNGs em scripts/output/<slug-da-marca>/
 */

import { spawn } from 'child_process';
import { mkdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { Buffer } from 'buffer';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// ── CLI args ──────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const getArg = (flag, fallback) => {
  const i = args.indexOf(flag);
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
};
const BRAND_NAME = getArg('--brand', process.env.BRAND || '');
const COUNT = Math.min(parseInt(getArg('--count', '5'), 10), 10);

if (!BRAND_NAME) {
  console.error('Uso: node scripts/gen-brand-mockups.mjs --brand "Nome da Marca" [--count 5]');
  process.exit(1);
}

// ── Config ────────────────────────────────────────────────────────────────────
const API_PORT   = process.env.SERVER_PORT || 3100;
const MCP_URL    = `http://localhost:${API_PORT}/api/mcp`;
const VISANT_KEY = process.env.VISANT_API_TOKEN ||
  'REMOVED_VISANT_KEY';
const OPENAI_KEY = process.env.OPENAI_KEY ||
  'REMOVED_OPENAI_KEY';

const slug = name => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
const OUTPUT_DIR = join(__dirname, 'output', slug(BRAND_NAME));
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── Server ────────────────────────────────────────────────────────────────────
async function isServerUp() {
  try {
    const res = await fetch(MCP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json, text/event-stream', 'Origin': 'http://localhost:3000' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 0, method: 'tools/list', params: {} }),
      signal: AbortSignal.timeout(2000),
    });
    return res.status < 500;
  } catch { return false; }
}

async function ensureServer() {
  if (await isServerUp()) { console.log(`✅ Servidor na porta ${API_PORT}`); return null; }
  console.log('🚀 Subindo servidor...');
  const proc = spawn('npx', ['tsx', 'server/index.ts'], {
    cwd: ROOT,
    env: { ...process.env, SERVER_PORT: String(API_PORT) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  proc.stderr.on('data', d => process.stderr.write(`[srv] ${d}`));
  for (let i = 0; i < 30; i++) {
    await sleep(1000);
    if (await isServerUp()) { console.log(`✅ Pronto em ${i + 1}s\n`); return proc; }
    process.stdout.write('.');
  }
  throw new Error('Servidor não subiu em 30s');
}

// ── MCP bearer call ───────────────────────────────────────────────────────────
let _id = 1;
async function mcpCall(tool, args) {
  const res = await fetch(MCP_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
      'Authorization': `Bearer ${VISANT_KEY}`,
      'Origin': 'http://localhost:3000',
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: _id++, method: 'tools/call', params: { name: tool, arguments: args } }),
  });
  const text = await res.text();
  let payload;
  if (text.includes('data:')) {
    for (const line of text.split('\n').filter(l => l.startsWith('data:')).reverse()) {
      const raw = line.slice(5).trim();
      if (!raw || raw === '[DONE]') continue;
      try { payload = JSON.parse(raw); break; } catch {}
    }
  } else {
    payload = JSON.parse(text);
  }
  if (payload?.error) throw new Error(`MCP: ${JSON.stringify(payload.error)}`);
  const content = payload?.result?.content?.find(c => c.type === 'text')?.text;
  if (content) { try { return JSON.parse(content); } catch { return content; } }
  return payload?.result;
}

// ── Fetch logo as base64 — NEVER describe logo in prompt, always inject as image ──
async function fetchLogoBase64(logos) {
  // RULE: Never describe logos in prompt text — always inject as reference image.
  // Source: server/docs/brand-prompting.html + server/routes/docs.ts
  const priority = ['primary', 'light', 'dark', 'icon', 'horizontal', 'stacked'];
  const sorted = [...(logos || [])].sort((a, b) => {
    const ai = priority.indexOf(a.variant); const bi = priority.indexOf(b.variant);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  for (const logo of sorted.slice(0, 2)) {
    if (!logo.url) continue;
    try {
      const res = await fetch(logo.url);
      if (!res.ok) continue;
      const buffer = await res.arrayBuffer();
      const mime = res.headers.get('content-type') || 'image/png';
      return { base64: Buffer.from(buffer).toString('base64'), mimeType: mime };
    } catch { /* non-critical */ }
  }
  return null;
}

// ── Brand context builder ─────────────────────────────────────────────────────
function extractBrandCtx(brand) {
  const colors   = brand?.colors?.slice(0, 5).map(c => c.hex || c.name).filter(Boolean).join(', ') || '';
  const fonts    = brand?.typography?.slice(0, 3).map(t => t.family).filter(Boolean).join(', ') || '';
  const tagline  = brand?.identity?.tagline || '';
  const voice    = brand?.strategy?.manifesto?.slice?.(0, 120) || '';
  const industry = brand?.identity?.description?.slice?.(0, 80) || '';
  const keywords = brand?.tags?.branding?.slice?.(0, 5)?.join(', ') || '';

  // NOTE: No logo description here — logo is injected as base64 reference image
  return [
    `Brand: ${brand?.identity?.name || BRAND_NAME}.`,
    tagline  && `Tagline: "${tagline}".`,
    industry && `About: ${industry}.`,
    colors   && `Brand colors: ${colors}.`,
    fonts    && `Typography: ${fonts}.`,
    voice    && `Voice: ${voice}.`,
    keywords && `Keywords: ${keywords}.`,
  ].filter(Boolean).join(' ');
}

// ── Mockup template library ───────────────────────────────────────────────────
const MOCKUP_TEMPLATES = [
  {
    slug: 'app-hero',
    name: 'App Hero Screen',
    size: '1024x1536',
    template: ctx => `${ctx}

Design a premium mobile app hero screen. Dark UI with performance stats dashboard, brand accent colors as glowing data highlights, bold typographic hierarchy, athlete silhouette in background. Looks like a real production app on iPhone 15 Pro. High-end, editorial sports aesthetic.`,
  },
  {
    slug: 'instagram-post',
    name: 'Instagram Feed Post',
    size: '1024x1024',
    template: ctx => `${ctx}

Design an Instagram square post. Dynamic sports photography with motion, bold ALL-CAPS headline overlay, brand color gradient, clean logo placement. High energy, editorial, minimal copy. Lifestyle sports brand feel.`,
  },
  {
    slug: 'product-packaging',
    name: 'Product Packaging Mockup',
    size: '1536x1024',
    template: ctx => `${ctx}

Design a premium product packaging mockup. Athletic apparel box or bag on marble surface, brand logo embossed, color stripe in brand palette, typography in brand font, dramatic side lighting. Luxury sports brand.`,
  },
  {
    slug: 'landing-page',
    name: 'Landing Page Hero',
    size: '1536x1024',
    template: ctx => `${ctx}

Design a website landing page hero section. Full-width cinematic athlete background, navigation bar with logo, large hero headline, subtitle, CTA button in brand accent color. Modern, conversion-focused. Looks like a real Webflow site.`,
  },
  {
    slug: 'email-campaign',
    name: 'Email Campaign',
    size: '1024x1536',
    template: ctx => `${ctx}

Design a marketing email newsletter. Header with brand logo on dark background, hero product image, bold promotional headline, product grid (3 items), discount badge in brand accent, clean footer. Conversion-optimized layout.`,
  },
  {
    slug: 'billboard',
    name: 'Outdoor Billboard',
    size: '1536x1024',
    template: ctx => `${ctx}

Design a large-format outdoor billboard. Minimal — one bold athlete image, one powerful headline, brand logo. Shot in urban environment for context. Brand colors dominate. Premium advertising aesthetic.`,
  },
  {
    slug: 'story-ad',
    name: 'Instagram Story Ad',
    size: '1024x1536',
    template: ctx => `${ctx}

Design an Instagram Story advertisement. Full-bleed vertical format, swipe-up CTA at bottom, brand-colored text overlay, product or athlete centered, 15-second video frame feel. Mobile-native design.`,
  },
  {
    slug: 'product-card',
    name: 'E-commerce Product Card',
    size: '1024x1024',
    template: ctx => `${ctx}

Design an e-commerce product card. Clean white background, product hero image centered, product name in brand typography, price, star rating, add-to-cart button in brand accent. Premium online store feel.`,
  },
  {
    slug: 'business-card',
    name: 'Business Card',
    size: '1536x1024',
    template: ctx => `${ctx}

Design premium double-sided business cards. Brand logo front-and-center, brand colors, contact info in brand typography. Photographed on dark texture surface with soft shadow. Luxury print design.`,
  },
  {
    slug: 'brand-poster',
    name: 'Brand Manifesto Poster',
    size: '1024x1536',
    template: ctx => `${ctx}

Design a brand manifesto poster. Large typographic layout with brand statement, brand colors as background or accents, minimal photography, editorial grid. Wall-art quality print design.`,
  },
];

// ── OpenAI gpt-image-2 (gpt-image-2) ─────────────────────────────────────────
// RULE: Logo is NEVER described in prompt — always passed as reference image input.
// Reference: server/docs/brand-prompting.html, server/routes/mockups.ts:805
async function generateImage(prompt, size, logoRef = null) {
  // If we have a logo, use /v1/images/edits (supports image inputs)
  // Otherwise use /v1/images/generations
  if (logoRef) {
    const form = new FormData();
    form.append('model', 'gpt-image-2');
    form.append('prompt', prompt);
    form.append('n', '1');
    form.append('size', size);
    // Attach logo as reference image
    const logoBlob = new Blob([Buffer.from(logoRef.base64, 'base64')], { type: logoRef.mimeType });
    form.append('image[]', logoBlob, 'logo.png');

    const res = await fetch('https://api.openai.com/v1/images/edits', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${OPENAI_KEY}` },
      body: form,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error?.message || JSON.stringify(data).slice(0, 200));
    return data.data?.[0]?.b64_json || data.data?.[0]?.url;
  }

  // No logo — straight generation
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENAI_KEY}` },
    body: JSON.stringify({ model: 'gpt-image-2', prompt, n: 1, size, output_format: 'png' }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || JSON.stringify(data).slice(0, 200));
  return data.data?.[0]?.b64_json || data.data?.[0]?.url;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('══════════════════════════════════════════════════════');
  console.log(` Brand Mockup Generator — "${BRAND_NAME}" × ${COUNT} mockups`);
  console.log('══════════════════════════════════════════════════════\n');

  mkdirSync(OUTPUT_DIR, { recursive: true });
  const serverProc = await ensureServer();

  try {
    // MCP: find brand guideline
    console.log(`🔍 [MCP Bearer] Buscando "${BRAND_NAME}"...`);
    const list = await mcpCall('brand-guidelines-list', {});
    const guidelines = list?.guidelines || [];

    const found = guidelines.find(g =>
      (g?.identity?.name || '').toLowerCase().includes(BRAND_NAME.toLowerCase())
    );

    if (!found) {
      console.log('\n📋 Guidelines disponíveis:');
      guidelines.forEach((g, i) => console.log(`   ${i + 1}. ${g?.identity?.name || g.id}`));
      throw new Error(`"${BRAND_NAME}" não encontrado nas brand guidelines`);
    }
    console.log(`✅ Encontrado: "${found.identity?.name}" (id: ${found.id})`);

    // MCP: get full brand context
    const detail = await mcpCall('brand-guidelines-get', { id: found.id, format: 'structured' });
    console.log(`🎨 ${detail?.colors?.length || 0} cores · ${detail?.logos?.length || 0} logos · ${detail?.typography?.length || 0} fontes\n`);

    const brandCtx = extractBrandCtx(detail);

    // Fetch logo as base64 — NEVER describe in prompt, always inject as image input
    const logoRef = await fetchLogoBase64(detail?.logos || []);
    if (logoRef) {
      console.log(`🖼️  Logo carregado como base64 (${logoRef.mimeType}) — será injetado como reference image`);
    } else {
      console.log(`⚠️  Nenhum logo disponível — gerando sem referência de logo`);
    }

    // Select N templates (rotating)
    const selected = Array.from({ length: COUNT }, (_, i) => {
      const tpl = MOCKUP_TEMPLATES[i % MOCKUP_TEMPLATES.length];
      return { ...tpl, slug: `${String(i + 1).padStart(2, '0')}-${tpl.slug}`, prompt: tpl.template(brandCtx) };
    });

    // Generate
    console.log(`🎬 Gerando ${COUNT} imagens com gpt-image-2 (gpt-image-2)...\n`);
    const results = [];

    for (let i = 0; i < selected.length; i++) {
      const spec = selected[i];
      process.stdout.write(`  [${i + 1}/${COUNT}] ${spec.name} (${spec.size}) ... `);
      try {
        const data = await generateImage(spec.prompt, spec.size, logoRef);
        const path = join(OUTPUT_DIR, `${spec.slug}.png`);
        if (data?.startsWith('http')) {
          results.push({ ...spec, status: 'ok', imageUrl: data });
          console.log('✅ (url)');
        } else if (data) {
          writeFileSync(path, Buffer.from(data, 'base64'));
          results.push({ ...spec, status: 'ok', savedPath: path });
          console.log('✅');
        } else {
          throw new Error('Resposta vazia da API');
        }
      } catch (e) {
        console.log(`❌ ${e.message.slice(0, 100)}`);
        results.push({ ...spec, status: 'error', error: e.message });
      }
      if (i < selected.length - 1) await sleep(1200);
    }

    // Summary
    console.log('\n' + '═'.repeat(58));
    console.log(`📊 RESULTADO — "${found.identity?.name}" × gpt-image-2`);
    console.log('═'.repeat(58));
    results.forEach((r, i) => {
      const icon = r.status === 'ok' ? '✅' : '❌';
      console.log(`${icon} [${i + 1}] ${r.name}`);
      if (r.savedPath) console.log(`     💾 ${r.savedPath}`);
      if (r.imageUrl)  console.log(`     🔗 ${r.imageUrl}`);
      if (r.error)     console.log(`     💬 ${r.error}`);
    });

    const ok = results.filter(r => r.status === 'ok').length;
    console.log(`\n🎯 ${ok}/${COUNT} mockups gerados com sucesso`);
    console.log(`📁 Output: ${OUTPUT_DIR}`);

  } finally {
    if (serverProc) { serverProc.kill(); console.log('\n🛑 Servidor encerrado'); }
  }
}

main().catch(err => { console.error('\n💥', err.message); process.exit(1); });
