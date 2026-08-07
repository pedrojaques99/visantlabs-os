/**
 * Roda a engine de regras de logo num arquivo local e imprime o resultado.
 *
 * Serve pra dois casos: conferir a medição antes de confiar nela, e derivar
 * regras de um logo que ainda não está numa guideline.
 *
 * Uso:
 *   npx tsx scripts/derive-logo-rules.ts <arquivo> [--module capHeight|halfCapHeight|stem]
 *                                        [--safety 1] [--palette '#2C352F,#EEEEEE']
 */

import { readFile } from 'node:fs/promises';
import { deriveLogoRules, type ClearSpaceModule } from '../server/lib/brand/logoRules.js';

function flag(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

const file = process.argv[2];
if (!file || file.startsWith('--')) {
  console.error('uso: npx tsx scripts/derive-logo-rules.ts <arquivo> [--module ...] [--safety N] [--palette "#hex,#hex"]');
  process.exit(1);
}

const rules = await deriveLogoRules(await readFile(file), {
  module: (flag('module') as ClearSpaceModule) ?? 'capHeight',
  safety: Number(flag('safety') ?? 1),
  palette: (flag('palette') ?? '')
    .split(',')
    .map((h) => h.trim())
    .filter(Boolean)
    .map((hex) => ({ hex })),
});

const g = rules.geometry;
console.log(`\n${file}`);
console.log(`  arquivo        ${g.canvas.width} × ${g.canvas.height}`);
console.log(`  tinta (bbox)   ${g.bbox.width} × ${g.bbox.height}  ·  proporção ${g.aspectRatio}:1`);
console.log(`  caixa-alta     ${g.capHeight} px`);
console.log(`  haste / barra  ${g.stemWidth} / ${g.barWidth} px`);
console.log(`  traço fino     ${g.thinnestStroke} px  (${((g.thinnestStroke / g.bbox.width) * 100).toFixed(2)}% da largura)`);
console.log(`  cor da tinta   ${g.inkColor}  ·  densidade ${g.inkDensity}`);
console.log(`  folga embutida ${JSON.stringify(g.bakedPadding)}`);
console.log(`\n  respiro   ${rules.clearSpace.statement}`);
console.log(`            ${rules.clearSpace.css}`);
console.log(`  mínimo    ${rules.minSize.statement}`);
console.log(`            (tela governada por ${rules.minSize.screenGovernedBy}, impressão por ${rules.minSize.printGovernedBy})`);

if (rules.backgrounds.length) {
  console.log('\n  fundos:');
  for (const b of rules.backgrounds) {
    const mark = b.verdict === 'ok' ? 'ok  ' : b.verdict === 'caution' ? 'ATEN' : 'FALHA';
    console.log(`    ${mark} ${b.hex.padEnd(8)} ${String(b.contrast).padStart(6)}:1  ${b.name ?? ''}`);
  }
}
