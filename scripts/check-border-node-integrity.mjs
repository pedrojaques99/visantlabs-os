#!/usr/bin/env node
/**
 * check-border-node-integrity.mjs
 *
 * Verifies that `border-node` in index.css (`@utility` or a class inside
 * `@layer utilities`) defines BOTH border-style AND border-width (replacing
 * `border` which sets both).
 * Also checks that files using `border-node` don't also have a plain `border`
 * class on the same element (redundant), and that no variant (`hover:border-node`)
 * is used when the definition form can't produce one.
 *
 * Run: node scripts/check-border-node-integrity.mjs
 *      node scripts/check-border-node-integrity.mjs --self-test
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const CSS = join(ROOT, 'src/index.css');

// ── 1. border-node definition ──
//
// Duas formas valem no Tailwind v4 do repo (tailwindcss ^4.1, `@import 'tailwindcss'`):
//   - `@utility border-node { ... }`: a forma documentada do v4. Vira utilitário
//     de verdade e aceita variante (`hover:border-node`, `md:border-node`).
//   - `@layer utilities { .border-node { ... } }`: CSS comum dentro da camada
//     utilities. Funciona como classe solta, mas o v4 NÃO gera variante a partir
//     dela (o v3 gerava; o guia de upgrade do v4 manda migrar pra `@utility`).
// O script exigia só `@utility` e falhava em cima do index.css, que usa a
// segunda forma desde o commit 8391e4a8 ("ui ux audit"). Falso positivo:
// nenhuma variante de border-node existe em src/. Agora aceita as duas e só
// acusa a segunda quando alguém usa variante, o caso em que ela quebra de fato
// (VARIANT_RE, bloco 3).
function checkDefinition(css) {
  const asUtility = css.match(/@utility border-node\s*\{([^}]+)\}/);
  const asLayerClass = css.match(/@layer utilities\s*\{[\s\S]*?\.border-node\s*\{([^}]+)\}/);
  const block = asUtility || asLayerClass;
  const label = asUtility ? '@utility border-node' : '.border-node (@layer utilities)';
  const problems = [];
  if (!block) {
    problems.push(
      'border-node not found in index.css (expected `@utility border-node` or `.border-node` inside `@layer utilities`)'
    );
    return { isUtility: false, label, problems };
  }
  const body = block[1];
  if (!body.includes('border-style')) {
    problems.push(`${label} is missing border-style: solid (without it borders disappear; browser default is none)`);
  }
  if (!body.includes('border-width')) problems.push(`${label} is missing border-width`);

  // Sub-pixel (< 1px) borders render as 0px on 1x Windows/Linux displays — invisible.
  const subpixel = body.match(/border-width:\s*(var\([^)]+\))/);
  if (subpixel) {
    // `var(--x, 1px)` carrega fallback: o nome é só o que vem antes da vírgula.
    // Com o grupo antigo (`[^)]+`) o nome virava "--node-border-width, 1px", a
    // busca nunca casava e o check de sub-pixel ficava mudo.
    const varName = subpixel[1].match(/var\(\s*(--[\w-]+)/)?.[1];
    if (varName) {
      const escaped = varName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const value = css.match(new RegExp(`${escaped}:\\s*([^;\\n]+)`))?.[1]?.trim();
      const px = parseFloat(value);
      if (value && !isNaN(px) && px < 1) {
        problems.push(
          `${varName} is ${value}: sub-pixel borders are invisible on 1x displays. Use 1px minimum; thinness comes from border COLOR opacity.`
        );
      }
    }
  }
  return { isUtility: Boolean(asUtility), label, problems };
}

// Variante de border-node só existe com @utility (ver acima). Com `.border-node`
// em `@layer utilities`, `hover:border-node` não gera CSS e a borda some em silêncio.
const VARIANT_RE = /[\w\]-]:border-node\b/;
const REDUNDANT_RE = /\bborder border-node\b/;

if (process.argv.includes('--self-test')) {
  const ok = 'border-style: solid; border-width: var(--w, 1px);';
  const cases = [
    ['@layer utilities (forma atual do index.css) passa', `@layer utilities { .border-node { ${ok} } }`, 0],
    ['@utility passa', `@utility border-node { ${ok} }`, 0],
    ['ausente falha', '.foo { color: red; }', 1],
    ['sem border-style falha', '@layer utilities { .border-node { border-width: 1px; } }', 1],
    ['sub-pixel via var com fallback falha', `:root { --w: 0.5px; } @layer utilities { .border-node { ${ok} } }`, 1],
  ];
  const lines = [
    [VARIANT_RE, 'hover:border-node', true],
    [VARIANT_RE, 'data-[state=open]:border-node', true],
    [VARIANT_RE, 'className="border-node border-neutral-800"', false],
    [REDUNDANT_RE, 'className="border border-node"', true],
    [REDUNDANT_RE, 'className="border-node border-neutral-800"', false],
  ];
  let fail = 0;
  for (const [name, css, want] of cases) {
    const got = checkDefinition(css).problems.length;
    if (got !== want) fail++;
    console.log(`${got === want ? 'ok  ' : 'FAIL'} ${name} (problemas: ${got}, esperado ${want})`);
  }
  for (const [re, line, want] of lines) {
    const got = re.test(line);
    if (got !== want) fail++;
    console.log(`${got === want ? 'ok  ' : 'FAIL'} ${want ? 'acusa' : 'ignora'}: ${line}`);
  }
  process.exit(fail ? 1 : 0);
}

let errors = 0;
const css = readFileSync(CSS, 'utf8');
const def = checkDefinition(css);
for (const msg of def.problems) console.error(`ERROR: ${msg}`);
errors += def.problems.length;
if (!def.problems.length) console.log(`✓ ${def.label} defines border-style and border-width correctly.`);

function walkTsx(dir) {
  const out = [];
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) out.push(...walkTsx(p));
    else if (f.endsWith('.tsx')) out.push(p);
  }
  return out;
}

// ── 2. Check for `border border-node` redundancy (the plain `border` fights the token) ──
const REACTFLOW = join(ROOT, 'src/components/reactflow');
const UI = join(ROOT, 'src/components/ui');

const files = [...walkTsx(REACTFLOW), join(UI, 'textarea.tsx'), join(UI, 'select.tsx'), join(UI, 'input.tsx')];

for (const f of files) {
  let src;
  try {
    src = readFileSync(f, 'utf8');
  } catch {
    continue;
  }
  src.split('\n').forEach((line, i) => {
    if (REDUNDANT_RE.test(line)) {
      console.error(`REDUNDANCY: ${f.replace(ROOT, '')}:${i + 1}`);
      console.error(`  "border border-node": the plain 'border' (1px) overrides the border-node token. Remove 'border'.`);
      errors++;
    }
  });
}

// ── 3. Variants need @utility ──
if (!def.isUtility) {
  for (const f of walkTsx(join(ROOT, 'src'))) {
    readFileSync(f, 'utf8')
      .split('\n')
      .forEach((line, i) => {
        if (VARIANT_RE.test(line)) {
          console.error(`VARIANT: ${f.replace(ROOT, '')}:${i + 1}`);
          console.error(
            '  border-node is a plain class in @layer utilities; Tailwind v4 does not build variants from it. Move it to `@utility border-node`.'
          );
          errors++;
        }
      });
  }
}

if (errors === 0) {
  console.log('✓ No border-node integrity issues found.');
  process.exit(0);
} else {
  console.log(`\n${errors} issue(s) found.`);
  process.exit(1);
}
