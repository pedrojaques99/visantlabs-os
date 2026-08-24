#!/usr/bin/env node
/**
 * codemod-accent-scarcity — tira o accent de repouso.
 *
 * A regra da casa: **cor só onde é core.** Accent em repouso é decoração;
 * accent num ESTADO (hover, selecionado, ativo) é sinal. Medido em 2026-08-18:
 * 1168 usos de `brand-cyan`, dos quais ~600 eram `text-`/`border-` nus, sem
 * variante nenhuma. Isso é o carnaval.
 *
 * O que ele NÃO toca, de propósito:
 *   · `bg-brand-cyan`            — é o preenchimento do CTA, o uso legítimo
 *   · `hover:` / `active:` / `data-[state=…]:` etc — variante é estado
 *   · linha com ternário          — `isActive ? 'text-brand-cyan' : …` é
 *                                   estado escrito em JS, não em Tailwind
 *   · linha com active/selected/current/checked no identificador
 *
 * Falso negativo aqui é barato (a catraca do scan-ui-scale pega depois). Falso
 * positivo apaga sinal de verdade, então o filtro é conservador de propósito.
 *
 *   node scripts/codemod-accent-scarcity.mjs            # PREVIEW (padrão)
 *   node scripts/codemod-accent-scarcity.mjs --apply
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const APPLY = process.argv.includes('--apply');
const targets = process.argv.slice(2).filter((a) => !a.startsWith('--'));

const IGNORE = /(^|[\\/])(node_modules|dist|build|coverage|__tests__)([\\/]|$)/;

/** Accent nu → token neutro. A chave é `(^|[\s"'`])` : sem variante na frente. */
const SWAPS = [
  { from: 'text-brand-cyan', to: 'text-foreground' },
  { from: 'border-brand-cyan', to: 'border-border' },
];

/** Linha que provavelmente carrega ESTADO, não decoração. */
const STATEFUL = /\?|active|selected|current|checked|isOn|highlight|\bon\b/i;

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (!IGNORE.test(full)) walk(full, out);
    } else if (/\.(tsx|jsx)$/.test(e.name)) out.push(full);
  }
  return out;
}

const roots = targets.length ? targets : ['src'];
const files = [];
for (const r of roots) {
  const abs = path.resolve(ROOT, r);
  if (!fs.existsSync(abs)) continue;
  fs.statSync(abs).isDirectory() ? walk(abs, files) : files.push(abs);
}

let trocas = 0;
let pulos = 0;
const porArquivo = [];

for (const file of files) {
  const src = fs.readFileSync(file, 'utf8');
  const lines = src.split(/\r?\n/);
  let mudou = 0;
  let pulouAqui = 0;

  const next = lines.map((line) => {
    let out = line;
    for (const { from, to } of SWAPS) {
      // sem variante na frente: precedido por início, espaço, aspa ou crase
      const re = new RegExp(`(^|[\\s"'\`])${from}(?=[\\s"'\`]|$)`, 'g');
      if (!re.test(out)) continue;
      re.lastIndex = 0;
      if (STATEFUL.test(out)) {
        pulouAqui += (out.match(re) || []).length;
        continue;
      }
      out = out.replace(re, (_m, pre) => {
        mudou++;
        return pre + to;
      });
    }
    return out;
  });

  if (mudou) {
    porArquivo.push({ file: path.relative(ROOT, file).replace(/\\/g, '/'), mudou, pulouAqui });
    trocas += mudou;
    if (APPLY) fs.writeFileSync(file, next.join(src.includes('\r\n') ? '\r\n' : '\n'));
  }
  pulos += pulouAqui;
}

porArquivo.sort((a, b) => b.mudou - a.mudou);
console.log(`\n${APPLY ? 'APLICADO' : 'PREVIEW (use --apply)'}\n`);
for (const f of porArquivo.slice(0, 20)) console.log(`  ${String(f.mudou).padStart(4)}  ${f.file}`);
if (porArquivo.length > 20) console.log(`  ... mais ${porArquivo.length - 20} arquivo(s)`);
console.log(`\n  ${trocas} troca(s) em ${porArquivo.length} arquivo(s)`);
console.log(`  ${pulos} pulada(s) por parecerem estado (ternário/active/selected)\n`);
