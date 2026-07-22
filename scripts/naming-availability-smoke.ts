/**
 * Smoke test do pré-filtro de disponibilidade da Naming Machine contra os
 * registries RDAP reais (sem mock). Serve para confirmar que o bootstrap da
 * IANA e os endpoints .com/.com.br continuam respondendo como esperado —
 * os unit tests usam fetch mockado e não pegariam uma mudança externa.
 *
 * Uso:
 *   npx tsx scripts/naming-availability-smoke.ts
 *   npx tsx scripts/naming-availability-smoke.ts MONTRIZ GALVA
 */

import { checkNames, statusOf, slugifyName } from '../server/lib/naming/availability.js';

/** Nomes com resultado previsível, para servir de asserção. */
const FIXTURES: Array<{ name: string; expect: string; why: string }> = [
  { name: 'google', expect: 'taken', why: '.com e .com.br ocupados' },
  {
    name: `zqx${Math.random().toString(36).slice(2, 10)}`,
    expect: 'free',
    why: 'slug aleatório, ninguém registrou',
  },
];

const extra = process.argv.slice(2);

async function main() {
  const cases = extra.length
    ? extra.map((name) => ({ name, expect: '', why: 'informado na linha de comando' }))
    : FIXTURES;

  const t0 = Date.now();
  const map = await checkNames(cases.map((c) => c.name));
  const elapsed = Date.now() - t0;

  let failed = 0;
  for (const c of cases) {
    const r = statusOf(map, c.name);
    const ok = !c.expect || r.status === c.expect;
    if (!ok) failed++;
    const mark = !c.expect ? '·' : ok ? '✓' : '✗';
    const reg = r.registered.length ? ` [${r.registered.join(', ')}]` : '';
    console.log(
      `${mark} ${c.name} → ${slugifyName(c.name)} : ${r.status}${reg}` +
        (c.expect && !ok ? `  (esperado: ${c.expect} — ${c.why})` : '')
    );
  }

  console.log(`\n${cases.length} nome(s) em ${elapsed}ms`);

  if (failed) {
    console.error(
      `\n${failed} divergência(s). Se os endpoints RDAP mudaram, revisar ` +
        'server/lib/naming/availability.ts (bootstrap + resolução de sufixo).'
    );
    process.exit(1);
  }
  console.log('RDAP respondendo como esperado.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Smoke test falhou:', err);
  process.exit(1);
});
