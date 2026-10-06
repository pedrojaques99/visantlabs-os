#!/usr/bin/env node
/**
 * codemod-radius-scale — junta os nomes de raio na escala de dois níveis.
 *
 * O index.css já mapeia sm/md -> --r-control e lg/xl/2xl -> --r-surface (craft
 * layer). Os "600 raios sortidos" do scan-ui-scale eram, na maioria, nomes
 * diferentes pro MESMO valor: rounded-sm e rounded-md desenham igual, e
 * rounded-lg, rounded-xl e rounded-2xl também. Este codemod deixa um nome por
 * nível (md = controle, xl = superfície), então a troca não muda pixel nenhum.
 * A exceção é o rounded-3xl, que não está na escala: vira superfície (muda de
 * valor), menos nas superfícies que renderizam a MARCA do cliente.
 *
 *   node scripts/codemod-radius-scale.mjs            # dry-run, lista o que mudaria
 *   node scripts/codemod-radius-scale.mjs --apply
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const APPLY = process.argv.includes('--apply');
const MAP = { sm: 'md', lg: 'xl', '2xl': 'xl', '3xl': 'xl' };
// Superfície que desenha a marca do cliente: o 3xl ali pode ser dado da marca.
const BRAND_SURFACE = /src[\\/](components[\\/]brand[\\/]guidelines[\\/]preview|pages[\\/]PublicBrandGuideline|components[\\/]brand[\\/]BrandReadOnlyView)/;
const DIR = /^(?:t|b|l|r|s|e|tl|tr|bl|br|ss|se|es|ee)-$/;

// prefixo de variante (md:, hover:, group-hover:, [&>x]:) + rounded + direção opcional + tamanho
const RE = /(?<=^|[\s"'`{(])((?:[\w-]+:|\[[^\]\s]+\]:)*)rounded-((?:t|b|l|r|s|e|tl|tr|bl|br|ss|se|es|ee)-)?(sm|lg|2xl|3xl)(?=$|[\s"'`})!])/g;

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (!/node_modules|dist|build|__tests__/.test(e.name)) walk(full, out);
    } else if (/\.(tsx|jsx|ts)$/.test(e.name)) out.push(full);
  }
  return out;
}

let files = 0;
let swaps = 0;
const by = {};
for (const file of walk(path.join(ROOT, 'src'))) {
  const src = fs.readFileSync(file, 'utf8');
  const brand = BRAND_SURFACE.test(file);
  let n = 0;
  const out = src.replace(RE, (m, variant, dir = '', size) => {
    if (dir && !DIR.test(dir)) return m;
    if (size === '3xl' && brand) return m;
    n++;
    by[size] = (by[size] || 0) + 1;
    return `${variant}rounded-${dir}${MAP[size]}`;
  });
  if (n) {
    files++;
    swaps += n;
    if (APPLY) fs.writeFileSync(file, out);
  }
}
console.log(`${APPLY ? 'aplicado' : 'dry-run'}: ${swaps} trocas em ${files} arquivos`, by);
