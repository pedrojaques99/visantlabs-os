#!/usr/bin/env node
/**
 * O tom dos neutros do app e o do motor de tokens são o MESMO, nos dois modos.
 *
 * A marca Visant declara um Chumbo neutro (#0d0d0d) e um Offwhite (#f3e9e9).
 * Até 2026-10-28 cada lado inventava o seu "morno": o motor
 * (`packages/brand-tokens`) emprestava o matiz do Offwhite ao dark e o pintava
 * de rosado (h≈18); o `src/index.css` tinha um marrom escrito à mão (h=40–45)
 * nos dois modos. O site e a library (ui.visantlabs.com) saíam com cores
 * diferentes, e nenhuma era a da marca.
 *
 * A luminosidade de cada token continua sendo decisão do app (hierarquia de
 * superfície). O que este portão prende é a COR do neutro: croma e matiz dos
 * tokens neutros de `:root` e `.dark` têm de ser os que o motor deriva da marca.
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
// Folga de matiz: o motor interpola no CAM02, e o matiz de um neutro de croma
// baixo anda alguns graus entre o fundo e o texto (17 → 23 na Visant).
const FOLGA_MATIZ = 15;

const marca = JSON.parse(
  readFileSync(join(ROOT, 'packages/brand-tokens/src/fixtures/visant.json'), 'utf8')
);
const temas = compileBrandTokens(marca).themes;
const css = readFileSync(join(ROOT, 'src/index.css'), 'utf8').replace(/\r\n/g, '\n');

function bloco(abertura) {
  const ini = css.indexOf(abertura);
  if (ini < 0) throw new Error(`bloco ${abertura.trim()} não encontrado em src/index.css`);
  return css.slice(ini, css.indexOf('\n}\n', ini));
}

const falhas = [];
const resumo = [];
for (const [modo, abertura] of [
  ['claro', '\n:root {\n  --radius'],
  ['escuro', '\n.dark {\n'],
]) {
  const motor = toOklch(temas[modo === 'claro' ? 'light' : 'dark'].background);
  const motorCinza = (motor.c ?? 0) < CINZA;
  resumo.push(`${modo}: ${motorCinza ? 'neutro' : `matiz ${Math.round(motor.h)}`}`);

  for (const [, nome, l, c, h] of bloco(abertura).matchAll(
    /^\s*(--[\w-]+):\s*oklch\(([\d.]+) ([\d.]+) ([\d.]+)/gm
  )) {
    const croma = Number(c);
    // Croma 0 é neutro escolhido de propósito (primary, ring do sidebar…).
    if (croma === 0 || croma > NEUTRO_MAX) continue;
    const cinza = croma < CINZA;
    const onde = `${modo} ${nome}: oklch(${l} ${c} ${h})`;
    if (motorCinza && !cinza) falhas.push(`${onde} tem tom; o motor deriva chumbo neutro`);
    if (!motorCinza && !cinza && Math.abs(Number(h) - motor.h) > FOLGA_MATIZ)
      falhas.push(`${onde} — o motor deriva matiz ${Math.round(motor.h)}`);
  }
}

if (falhas.length) {
  console.error(`✗ os neutros do app divergem do motor de tokens:\n  ${falhas.join('\n  ')}`);
  process.exit(1);
}
console.log(`✓ neutros do app = motor (${resumo.join(' · ')})`);
