#!/usr/bin/env node
/**
 * O tom do neutro escuro do app e o do motor de tokens são o MESMO.
 *
 * A marca Visant declara um Chumbo neutro (#0d0d0d). Até 2026-10-28 cada lado
 * inventava o seu "morno": o motor (`packages/brand-tokens`) emprestava o matiz
 * do Offwhite e pintava o dark de rosado (h≈18); o `src/index.css` tinha um
 * marrom escrito à mão (h=45). O site e a library (ui.visantlabs.com) saíam com
 * dois chumbos diferentes, e nenhum era o da marca.
 *
 * A luminosidade de cada token continua sendo decisão do app (hierarquia de
 * superfície). O que este portão prende é a COR do neutro: croma e matiz dos
 * tokens neutros do `.dark` têm de ser os que o motor deriva da marca.
 *
 *   node scripts/check-neutral-tint.mjs
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { converter } from 'culori';
import { compileBrandTokens } from '../packages/brand-tokens/src/engine.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const toOklch = converter('oklch');

// Abaixo disso o neutro lê como cinza e o matiz é ruído (mesmo corte do motor).
const CINZA = 0.004;
// Acima disso não é neutro, é cor (destructive, success, charts…): fora do portão.
const NEUTRO_MAX = 0.03;

const marca = JSON.parse(readFileSync(join(ROOT, 'packages/brand-tokens/src/fixtures/visant.json'), 'utf8'));
const motor = toOklch(compileBrandTokens(marca).themes.dark.background);
const motorCinza = (motor.c ?? 0) < CINZA;

const css = readFileSync(join(ROOT, 'src/index.css'), 'utf8').replace(/\r\n/g, '\n');
const ini = css.indexOf('\n.dark {\n');
const bloco = css.slice(ini, css.indexOf('\n}\n', ini));

const falhas = [];
for (const [, nome, l, c, h] of bloco.matchAll(/^\s*(--[\w-]+):\s*oklch\(([\d.]+) ([\d.]+) ([\d.]+)/gm)) {
  const croma = Number(c);
  if (croma > NEUTRO_MAX) continue;
  const cinza = croma < CINZA;
  if (motorCinza && !cinza) falhas.push(`${nome}: oklch(${l} ${c} ${h}) tem tom; o motor deriva chumbo neutro`);
  if (!motorCinza && cinza) falhas.push(`${nome}: cinza puro; o motor deriva matiz ${Math.round(motor.h)}`);
  if (!motorCinza && !cinza && Math.abs(Number(h) - motor.h) > 15)
    falhas.push(`${nome}: matiz ${h}; o motor deriva ${Math.round(motor.h)}`);
}

if (falhas.length) {
  console.error(`✗ o neutro escuro do app diverge do motor de tokens:\n  ${falhas.join('\n  ')}`);
  process.exit(1);
}
console.log(`✓ neutro escuro do app = motor (${motorCinza ? 'chumbo neutro' : `matiz ${Math.round(motor.h)}`})`);
