#!/usr/bin/env node
/**
 * codemod-semantic-color — 14 matizes crus viram 3 tokens semânticos.
 *
 * Medido em 2026-08-18: 459 utilitários de cor literal do Tailwind em src/,
 * espalhados por catorze matizes. A maior parte não é escolha estética, é
 * SEMÂNTICA escrita em hex por outro nome: vermelho é erro, âmbar é aviso,
 * verde é sucesso. O app já tem `--destructive`, `--warning` e `--success`, e
 * ninguém usava.
 *
 * O ganho não é purismo de token. É que `red-400`, `red-500` e `rose-500` são
 * três vermelhos diferentes na mesma tela, e é isso que lê como carnaval.
 *
 * Fica de FORA (precisa de decisão humana, não de regra):
 *   blue, purple, violet, indigo, pink, fuchsia, sky, orange — decoração ou
 *   cor de categoria. Trocar por token semântico mentiria sobre o significado.
 *
 *   node scripts/codemod-semantic-color.mjs           # PREVIEW
 *   node scripts/codemod-semantic-color.mjs --apply
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const APPLY = process.argv.includes('--apply');
const IGNORE = /(^|[\\/])(node_modules|dist|build|coverage|__tests__)([\\/]|$)/;

/** matiz literal → token semântico do app. */
const MAP = {
  red: 'destructive',
  rose: 'destructive',
  amber: 'warning',
  yellow: 'warning',
  green: 'success',
  emerald: 'success',
};

/** Propriedades onde a troca é segura e o token existe. */
const PROPS = ['text', 'bg', 'border', 'ring', 'fill', 'stroke', 'from', 'to', 'via', 'decoration'];

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (!IGNORE.test(full)) walk(full, out);
    } else if (/\.(tsx|jsx)$/.test(e.name)) out.push(full);
  }
  return out;
}

const files = walk(path.resolve(ROOT, 'src'));
const hues = Object.keys(MAP).join('|');
const props = PROPS.join('|');
// captura: (prefixo de variante opcional)(prop)-(matiz)-(tom)(/opacidade opcional)
const RE = new RegExp(`\\b(${props})-(${hues})-(\\d{2,3})(\\/(?:\\d{1,3}|\\[[^\\]]+\\]))?\\b`, 'g');

let total = 0;
const porArquivo = [];

for (const file of files) {
  const src = fs.readFileSync(file, 'utf8');
  let n = 0;
  const next = src.replace(RE, (_m, prop, hue, _shade, alpha) => {
    n++;
    return `${prop}-${MAP[hue]}${alpha ?? ''}`;
  });
  if (n) {
    total += n;
    porArquivo.push({ file: path.relative(ROOT, file).replace(/\\/g, '/'), n });
    if (APPLY) fs.writeFileSync(file, next);
  }
}

porArquivo.sort((a, b) => b.n - a.n);
console.log(`\n${APPLY ? 'APLICADO' : 'PREVIEW (use --apply)'}\n`);
for (const f of porArquivo.slice(0, 15)) console.log(`  ${String(f.n).padStart(4)}  ${f.file}`);
if (porArquivo.length > 15) console.log(`  ... mais ${porArquivo.length - 15} arquivo(s)`);
console.log(`\n  ${total} troca(s) em ${porArquivo.length} arquivo(s)`);
console.log('  matizes cobertos: red, rose -> destructive | amber, yellow -> warning');
console.log('                    green, emerald -> success\n');
