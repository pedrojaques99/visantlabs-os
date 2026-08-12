#!/usr/bin/env node
/**
 * check-deploy-drift.mjs — o commit que está no ar é o commit que foi mergeado?
 *
 * Existe por causa de 2026-08-07. Três falhas se somaram, e as três em silêncio:
 *   1. `deploy.yml` usa secrets.VPS_HOST/USER/SSH_KEY — e o repo tem ZERO secrets
 *      configurados, então o job sempre morreu em `Error: missing server host`.
 *   2. Antes disso, o job nem chegava a rodar: ele depende do Test Suite passar
 *      em `main`, que estava vermelho desde julho. O deploy aparecia como
 *      `skipped`, que não parece falha para quem passa o olho.
 *   3. O /api/health só expunha `version` do package.json ("0.0.0", imutável),
 *      então não havia como perceber que a VPS rodava código de 8,8 dias antes.
 *
 * Resultado: semanas de merges sem chegar em produção, incluindo o conserto de
 * um render que devolvia 500 pra todo mundo. Nenhum teste pegaria isso — o
 * código estava certo, o que faltava era ele estar no ar.
 *
 * Uso:
 *   node scripts/check-deploy-drift.mjs
 *   node scripts/check-deploy-drift.mjs --url https://api.visantlabs.com --ref main
 *
 * Sai 1 se o que está no ar diverge do ref. Feito pra rodar em cron/CI.
 */

import { execFileSync } from 'node:child_process';

const arg = (n, padrao) => {
  const i = process.argv.indexOf(`--${n}`);
  return i !== -1 ? process.argv[i + 1] : padrao;
};

const URL_BASE = arg('url', process.env.DEPLOY_CHECK_URL || 'https://api.visantlabs.com');
const REF = arg('ref', 'main');
const TOLERANCIA_MIN = Number(arg('tolerancia', '30'));

function sha(ref) {
  try {
    return execFileSync('git', ['rev-parse', ref], { encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

const esperado = sha(`origin/${REF}`) ?? sha(REF);
if (!esperado) {
  console.error(`não consegui resolver o SHA de ${REF} — rode \`git fetch\` antes.`);
  process.exit(2);
}

let saude;
try {
  const res = await fetch(`${URL_BASE}/api/health`, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`health respondeu ${res.status}`);
  saude = await res.json();
} catch (err) {
  // Servidor fora do ar é pior que drift, e merece o mesmo exit 1.
  console.error(`✗ ${URL_BASE} não respondeu: ${err instanceof Error ? err.message : err}`);
  process.exit(1);
}

const rodando = saude.commit;
const upMin = Math.floor((saude.uptime ?? 0) / 60);

if (!rodando) {
  console.error('✗ /api/health não expõe `commit`.');
  console.error('  A versão no ar é antiga (anterior a esta checagem) ou GIT_COMMIT_SHA');
  console.error('  não foi injetada no deploy. Sem isso, drift é indetectável.');
  process.exit(1);
}

const curto = (s) => s.slice(0, 8);

if (rodando === esperado) {
  console.log(`✓ no ar = ${REF} (${curto(esperado)}) · up há ${upMin} min`);
  process.exit(0);
}

// Divergência recém-mergeada ainda pode estar subindo; só alarma passada a
// tolerância, senão o alerta dispara em todo merge e vira ruído ignorado.
let atras = null;
try {
  atras = execFileSync('git', ['rev-list', '--count', `${rodando}..${esperado}`], {
    encoding: 'utf8',
  }).trim();
} catch {
  /* commit no ar pode não existir local — segue sem a contagem */
}

console.error(`✗ DRIFT: no ar ${curto(rodando)}, ${REF} está em ${curto(esperado)}`);
if (atras) console.error(`  ${atras} commit(s) mergeado(s) que não estão em produção.`);
console.error(`  Servidor no ar há ${upMin} min (${saude.startedAt ?? '?'}).`);

if (upMin < TOLERANCIA_MIN) {
  console.error(`  Uptime < ${TOLERANCIA_MIN} min: pode ser deploy em andamento. Não alarmo ainda.`);
  process.exit(0);
}

console.error('');
console.error('  O deploy não aconteceu. Checar, nesta ordem:');
console.error('   1. o job "Deploy to VPS" rodou, ou saiu como `skipped`?');
console.error('   2. os secrets VPS_HOST/VPS_USER/VPS_SSH_KEY existem? (`gh secret list`)');
console.error('   3. se o deploy é manual, ninguém subiu — suba.');
process.exit(1);
