#!/usr/bin/env node
/**
 * sync-craft-tokens — emite a camada de craft do registry dentro do app.
 *
 * `packages/brand-tokens/craft.json` é a Layer 2 da library: raio, densidade,
 * elevação, foco e motion. Ela é **invariante por decisão** ("derivar o
 * esqueleto por marca reintroduz genericidade por aleatoriedade").
 *
 * O `src/index.css` só tinha a METADE de motion. Raio, densidade, elevação e
 * foco nunca chegaram, e o resultado está medido pelo `scan-ui-scale`: 8 raios
 * diferentes em uso, 1808 tamanhos em pixel cru, sombra inline por toda parte.
 * Não faltava linguagem de design. Faltava a linguagem chegar no arquivo.
 *
 * Este script gera o bloco a partir do craft.json, então ele nunca diverge da
 * library. Escrever à mão era o que garantia a próxima divergência.
 *
 *   node scripts/sync-craft-tokens.mjs           # escreve
 *   node scripts/sync-craft-tokens.mjs --check   # exit 1 se estiver fora de dia
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const CRAFT = path.join(ROOT, 'packages', 'brand-tokens', 'craft.json');
const CSS = path.join(ROOT, 'src', 'index.css');

const BEGIN = '  /* >>> craft layer — gerado por scripts/sync-craft-tokens.mjs. Não editar à mão. */';
const END = '  /* <<< craft layer */';

if (!fs.existsSync(CRAFT)) {
  console.error('craft.json não encontrado em', path.relative(ROOT, CRAFT));
  process.exit(1);
}

const craft = JSON.parse(fs.readFileSync(CRAFT, 'utf8'));
const L = [];

L.push(BEGIN);
L.push('  /*');
L.push('   * Layer 2 do registry Visant (packages/brand-tokens/craft.json).');
L.push('   * Invariante DE PROPÓSITO: raio, densidade, elevação e foco não mudam por');
L.push('   * marca. A marca entra pela cor e pela tipografia, não pelo esqueleto.');
L.push('   *');
L.push('   *   --r-control  botão, input, chip        --r-surface  card, painel');
L.push('   *   --r-pill     pílula, avatar            --e-*        elevação');
L.push('   *   --pad-card   respiro interno de card   --control-h  altura de controle');
L.push('   */');

for (const [k, v] of Object.entries(craft.radius ?? {})) L.push(`  --r-${k}: ${v};`);
L.push('');
for (const [k, v] of Object.entries(craft.density?.comfortable ?? {})) L.push(`  --${k}: ${v};`);
L.push('');
for (const [k, v] of Object.entries(craft.elevation ?? {})) L.push(`  --e-${k}: ${v};`);
L.push('');
if (craft.focus) L.push(`  --focus: ${craft.focus};`);
L.push(END);

const block = L.join('\n');

let css = fs.readFileSync(CSS, 'utf8');
const nl = css.includes('\r\n') ? '\r\n' : '\n';
const blockNl = block.replace(/\n/g, nl);

const hasBlock = css.includes(BEGIN);
let next;
if (hasBlock) {
  const start = css.indexOf(BEGIN);
  const end = css.indexOf(END, start) + END.length;
  next = css.slice(0, start) + blockNl + css.slice(end);
} else {
  // Ancora logo acima do bloco de motion, que já veio do mesmo craft.json.
  const anchor = '  --ease-out: cubic-bezier(0.23, 1, 0.32, 1);';
  const at = css.indexOf(anchor);
  if (at < 0) {
    console.error('âncora de motion não encontrada em src/index.css');
    process.exit(1);
  }
  next = css.slice(0, at) + blockNl + nl + nl + css.slice(at);
}

if (process.argv.includes('--check')) {
  // Comparação SEMÂNTICA, não byte a byte: o prettier reindenta o bloco depois
  // da escrita, e um diff textual acusaria divergência a cada formatação. O que
  // importa é que todo token do craft.json esteja no CSS com o mesmo valor.
  // O prettier quebra a sombra em várias linhas, então a busca colapsa espaço
  // em branco dos dois lados antes de comparar.
  // Além do espaço, o prettier normaliza decimal (`0.10` vira `0.1`), então a
  // comparação também corta zero à direita. Sem isso o check acusa divergência
  // em cima de dois valores idênticos.
  const flat = (s) =>
    s
      .replace(/\s+/g, ' ')
      .replace(/(\.\d*?)0+(?=\D|$)/g, '$1')
      .replace(/\.(?=\D|$)/g, '');
  const cssFlat = flat(css);
  const esperados = [...block.matchAll(/^\s*(--[\w-]+):\s*(.+);$/gm)].map((m) => [
    m[1],
    flat(m[2]).trim(),
  ]);
  const faltando = esperados.filter(([k, v]) => !cssFlat.includes(`${k}: ${v};`));
  if (faltando.length) {
    console.error('craft layer fora de dia. Rode: node scripts/sync-craft-tokens.mjs');
    for (const [k, v] of faltando) console.error(`  ${k} deveria ser ${v}`);
    process.exit(1);
  }
  console.log(`craft layer em dia (${esperados.length} tokens).`);
  process.exit(0);
}

if (next === css) {
  console.log('craft layer já em dia, nada a fazer.');
} else {
  fs.writeFileSync(CSS, next);
  const n = block.split('\n').filter((l) => /^\s*--/.test(l)).length;
  console.log(`craft layer escrita em src/index.css (${n} tokens).`);
  console.log('Nada muda visualmente: nenhum componente consome ainda. Isso é o ponto.');
}

// Densidade compacta fica como opt-in por atributo, igual ao registry.
const compact = craft.density?.compact;
if (compact) {
  // Guard insensível a aspas: o prettier reescreve "compact" como 'compact', e
  // um `includes` literal deixava o bloco ser anexado de novo a cada rodada.
  const jaTem = /\[data-density=['"]compact['"]\]/.test(fs.readFileSync(CSS, 'utf8'));
  if (!jaTem) {
    const rule =
      `${nl}/* Densidade compacta do registry — opt-in por atributo, igual à library. */${nl}` +
      `[data-density='compact'] {${nl}` +
      Object.entries(compact)
        .map(([k, v]) => `  --${k}: ${v};`)
        .join(nl) +
      `${nl}}${nl}`;
    fs.appendFileSync(CSS, rule);
    console.log('densidade compacta adicionada como [data-density="compact"].');
  }
}
