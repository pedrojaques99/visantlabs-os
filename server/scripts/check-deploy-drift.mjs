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
 *   node scripts/check-deploy-drift.mjs --ref <sha> --aguardar 300   (pós-deploy)
 *
 * Sai 1 se o que está no ar diverge do ref. Feito pra rodar em cron/CI.
 *
 * Dois modos, porque as duas perguntas são diferentes:
 *
 *   vigia   (padrão)      "isso aqui está drifted AGORA?" — usado em cron. Tolera
 *                         divergência recente, porque deploy em andamento não é
 *                         defeito, e alarme em todo merge vira alarme ignorado.
 *
 *   --aguardar <seg>      "o deploy que eu acabei de disparar CHEGOU?" — usado no
 *                         CI logo após subir. Aqui a tolerância seria um bug: o
 *                         deploy silencioso é exatamente o que estamos caçando,
 *                         então espera até bater e reprova se estourar o prazo.
 */

import { execFileSync } from 'node:child_process';

const arg = (n, padrao) => {
  const i = process.argv.indexOf(`--${n}`);
  return i !== -1 ? process.argv[i + 1] : padrao;
};

const URL_BASE = arg('url', process.env.DEPLOY_CHECK_URL || 'https://api.visantlabs.com');
const REF = arg('ref', 'main');
const TOLERANCIA_MIN = Number(arg('tolerancia', '30'));
const AGUARDAR_SEG = Number(arg('aguardar', '0'));
const INTERVALO_SEG = 10;

function sha(ref) {
  try {
    // stderr ignorado de propósito: quando REF já é um SHA cru, a primeira
    // tentativa (`origin/<sha>`) falha por definição e o `fatal:` do git faria
    // o log do CI parecer quebrado num caminho que é esperado.
    return execFileSync('git', ['rev-parse', ref], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return null;
  }
}

const esperado = sha(`origin/${REF}`) ?? sha(REF);
if (!esperado) {
  console.error(`não consegui resolver o SHA de ${REF} — rode \`git fetch\` antes.`);
  process.exit(2);
}

const curto = (s) => s.slice(0, 8);
const dormir = (seg) => new Promise((r) => setTimeout(r, seg * 1000));

async function consultarSaude() {
  const res = await fetch(`${URL_BASE}/api/health`, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`health respondeu ${res.status}`);
  return res.json();
}

// ── Modo espera: usado logo depois de disparar um deploy ────────────────────
if (AGUARDAR_SEG > 0) {
  const limite = Date.now() + AGUARDAR_SEG * 1000;
  let ultimoErro = null;
  let visto = null;

  console.log(`aguardando ${curto(esperado)} chegar em ${URL_BASE} (até ${AGUARDAR_SEG}s)…`);

  while (Date.now() < limite) {
    try {
      const s = await consultarSaude();
      if (s.commit === esperado) {
        console.log(`✓ no ar = ${curto(esperado)} · up há ${Math.floor((s.uptime ?? 0) / 60)} min`);
        process.exit(0);
      }
      // Reinício derruba o /api/health por alguns segundos: erro aqui é esperado
      // no meio do caminho, e só vira veredito quando o prazo estoura.
      if (s.commit !== visto) {
        visto = s.commit;
        console.log(`  … ainda ${visto ? curto(visto) : '(sem commit exposto)'}`);
      }
      ultimoErro = null;
    } catch (err) {
      ultimoErro = err instanceof Error ? err.message : String(err);
      console.log(`  … ${ultimoErro}`);
    }
    await dormir(INTERVALO_SEG);
  }

  console.error('');
  console.error(`✗ ${AGUARDAR_SEG}s depois, ${URL_BASE} não está rodando ${curto(esperado)}.`);
  if (visto) console.error(`  Último commit visto no ar: ${curto(visto)}`);
  if (ultimoErro) console.error(`  Último erro: ${ultimoErro}`);
  console.error('');
  console.error('  O deploy foi aceito mas não chegou. Ver, nesta ordem:');
  console.error('   1. o log do build no Coolify (o passo anterior imprime a URL);');
  console.error('   2. o container subiu e caiu? (crash em boot mantém o antigo servindo)');
  console.error('   3. SOURCE_COMMIT chega na env do container? Sem ela o /api/health');
  console.error('      não expõe `commit` e esta checagem não tem como confirmar nada.');
  process.exit(1);
}

// ── Modo vigia (padrão) ────────────────────────────────────────────────────
let saude;
try {
  saude = await consultarSaude();
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
console.error('   1. o workflow "Deploy backend" rodou, ou saiu como `skipped`?');
console.error('      (ele só dispara quando o "Test Suite" fecha VERDE em main)');
console.error('   2. os secrets COOLIFY_URL/COOLIFY_TOKEN/COOLIFY_APP_UUID existem?');
console.error('      (`gh secret list` — repo sem secrets faz o job falhar no portão)');
console.error('   3. subir na mão: `gh workflow run "Deploy backend" --ref main`');
process.exit(1);
