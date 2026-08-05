#!/usr/bin/env node
/**
 * Sobe uma pasta inteira de imagens/PDFs para o media kit de uma brand guideline.
 *
 * O MCP tem `brand-guidelines-upload-media`, mas ele exige o base64 dentro da chamada —
 * inviável em lote (um PNG de 1 MB vira ~1,4 MB de string no contexto do agente).
 * Este script fala direto com a rota POST /api/brand-guidelines/:id/media.
 *
 * A rota já deduplica por fingerprint: arquivo idêntico volta { duplicate: 'exact',
 * skipped: true } sem gravar nada, então rodar duas vezes é seguro.
 *
 * Uso:
 *   node scripts/upload-brand-media.mjs <brandId> <pasta> [--dry] [--pdf]
 *
 * Auth: VISANT_API_TOKEN no ambiente (Bearer JWT ou API key).
 *   setx VISANT_API_TOKEN "..."   # e reabra o terminal
 */

import { readdir, readFile, stat } from 'node:fs/promises';
import { basename, extname, join } from 'node:path';

const API_BASE = process.env.VISANT_API_BASE || 'https://api.visantlabs.com';
const TOKEN = process.env.VISANT_API_TOKEN;

const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp']);
const MIME = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
};

// R2 e a rota engasgam em arquivo gigante; 20 MB cobre mockup em alta sem virar
// upload de PSD achatado por engano.
const MAX_BYTES = 20 * 1024 * 1024;

const [, , brandId, dir, ...flags] = process.argv;
const dry = flags.includes('--dry');
const withPdf = flags.includes('--pdf');

if (!brandId || !dir) {
  console.error('uso: node scripts/upload-brand-media.mjs <brandId> <pasta> [--dry] [--pdf]');
  process.exit(1);
}
if (!TOKEN && !dry) {
  console.error('VISANT_API_TOKEN não está no ambiente. setx VISANT_API_TOKEN "..." e reabra o terminal.');
  process.exit(1);
}

/** Nome de arquivo do Figma ("Frame 4836.png") não vira label; deixa o humano nomear depois. */
function labelFor(file) {
  return basename(file, extname(file)).replace(/[_-]+/g, ' ').trim();
}

async function upload(file) {
  const path = join(dir, file);
  const ext = extname(file).toLowerCase();
  const { size } = await stat(path);

  if (size > MAX_BYTES) {
    return { file, status: 'skip', reason: `${(size / 1024 / 1024).toFixed(1)} MB > 20 MB` };
  }

  const contentType = MIME[ext];
  const type = ext === '.pdf' ? 'pdf' : 'image';
  const label = labelFor(file);

  if (dry) return { file, status: 'dry', reason: `${(size / 1024).toFixed(0)} KB → "${label}"` };

  const data = `data:${contentType};base64,${(await readFile(path)).toString('base64')}`;
  const res = await fetch(`${API_BASE}/api/brand-guidelines/${brandId}/media`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify({ data, label, type, contentType }),
  });

  if (!res.ok) {
    return { file, status: 'fail', reason: `HTTP ${res.status} ${(await res.text()).slice(0, 160)}` };
  }
  const json = await res.json();
  if (json.skipped) return { file, status: 'dup', reason: `já existe como "${json.existing?.label ?? '?'}"` };
  return { file, status: 'ok', reason: json.media?.url ?? '' };
}

const wanted = (await readdir(dir))
  .filter((f) => (withPdf && extname(f).toLowerCase() === '.pdf') || IMAGE_EXT.has(extname(f).toLowerCase()))
  .sort();

if (!wanted.length) {
  console.error(`nenhuma imagem em ${dir}`);
  process.exit(1);
}

console.log(`${wanted.length} arquivo(s)${dry ? ' (dry run)' : ''}\n`);

const tally = { ok: 0, dup: 0, skip: 0, fail: 0, dry: 0 };
// Sequencial de propósito: a rota tem rate limiter e o dedup compara contra o
// estado já gravado — paralelizar deixa duplicata escapar pelas frestas.
for (const file of wanted) {
  const r = await upload(file);
  tally[r.status]++;
  console.log(`  ${r.status.padEnd(4)} ${file}${r.reason ? ` — ${r.reason}` : ''}`);
}

console.log(
  `\nok ${tally.ok} · duplicado ${tally.dup} · pulado ${tally.skip} · falhou ${tally.fail}${dry ? ` · dry ${tally.dry}` : ''}`
);
process.exit(tally.fail ? 1 : 0);
