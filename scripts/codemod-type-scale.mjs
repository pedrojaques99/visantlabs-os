#!/usr/bin/env node
/**
 * codemod-type-scale — 1793 tamanhos em pixel cru viram escala nomeada.
 *
 * A distribuição medida (2026-08-18) explica o problema inteiro:
 *
 *   1334  text-[10px]      74% de tudo
 *    339  text-[11px]
 *     52  text-[9px]
 *     76  8, 7, 12, 13, 15px
 *
 * Ou seja: o app não estava inventando oitenta tamanhos por capricho. Ele
 * precisava de UM degrau abaixo de `text-xs` (12px), esse degrau não existia, e
 * cada tela resolveu na mão. Dois degraus novos (`text-2xs` = 10px, `text-3xs`
 * = 9px) cobrem 1725 dos 1793 casos.
 *
 * O mapa foi escolhido pra MINIMIZAR mudança visual, não pra ficar bonito na
 * tabela: 10px, 9px e 12px caem em degrau de valor idêntico e não mexem um
 * pixel. Só ~430 usos mudam, e mudam 1px. Consistência e aparência não se
 * consertam no mesmo commit sem alguém olhar.
 *
 *   node scripts/codemod-type-scale.mjs           # PREVIEW
 *   node scripts/codemod-type-scale.mjs --apply
 */
import fs from 'node:fs';
import path from 'node:path';

const APPLY = process.argv.includes('--apply');
const IGNORE = /(^|[\\/])(node_modules|dist|build|coverage|__tests__)([\\/]|$)/;

/** px cru → degrau. `delta` é a mudança visual em pixels, pra relatar honesto. */
const MAP = {
  7: { to: 'text-3xs', delta: +2 },
  8: { to: 'text-3xs', delta: +1 },
  9: { to: 'text-3xs', delta: 0 },
  10: { to: 'text-2xs', delta: 0 },
  11: { to: 'text-2xs', delta: -1 },
  12: { to: 'text-xs', delta: 0 },
  13: { to: 'text-sm', delta: +1 },
  15: { to: 'text-base', delta: +1 },
};

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (!IGNORE.test(full)) walk(full, out);
    } else if (/\.(tsx|jsx)$/.test(e.name)) out.push(full);
  }
  return out;
}

const files = walk(path.resolve(process.cwd(), 'src'));
const porTamanho = {};
let total = 0;
let arquivos = 0;

for (const file of files) {
  const src = fs.readFileSync(file, 'utf8');
  let n = 0;
  const next = src.replace(/\btext-\[(\d+)px\]/g, (m, px) => {
    const hit = MAP[Number(px)];
    if (!hit) return m;
    n++;
    porTamanho[px] = (porTamanho[px] ?? 0) + 1;
    return hit.to;
  });
  if (n) {
    total += n;
    arquivos++;
    if (APPLY) fs.writeFileSync(file, next);
  }
}

console.log(`\n${APPLY ? 'APLICADO' : 'PREVIEW (use --apply)'}\n`);
console.log('   px   ->  degrau        usos   mudança visual');
let mexem = 0;
for (const px of Object.keys(porTamanho).sort((a, b) => porTamanho[b] - porTamanho[a])) {
  const { to, delta } = MAP[Number(px)];
  if (delta !== 0) mexem += porTamanho[px];
  const d = delta === 0 ? 'nenhuma' : `${delta > 0 ? '+' : ''}${delta}px`;
  console.log(
    `  ${String(px).padStart(3)}px  ->  ${to.padEnd(12)} ${String(porTamanho[px]).padStart(5)}   ${d}`
  );
}
console.log(`\n  ${total} troca(s) em ${arquivos} arquivo(s)`);
console.log(`  ${total - mexem} sem mudança de pixel, ${mexem} mudam 1 a 2px\n`);
