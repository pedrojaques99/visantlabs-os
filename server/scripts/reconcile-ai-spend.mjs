#!/usr/bin/env node
/**
 * reconcile-ai-spend — cruza o que o app contabilizou com o que o provedor cobrou.
 *
 * O portão (`server/lib/ai/metered.ts`) garante que toda chamada DO SERVIDOR grave um
 * `usage_record`. Ele não alcança script local, AI Studio, nem chave usada fora daqui — foi
 * exatamente por aí que os R$ 443,68 do dia 7/ago/2026 passaram. Este script existe pra essa
 * diferença aparecer em dias, não quando a fatura chega.
 *
 *   node server/scripts/reconcile-ai-spend.mjs --days 14
 *   node server/scripts/reconcile-ai-spend.mjs --day 2026-08-07 --billed 80.10
 *   node server/scripts/reconcile-ai-spend.mjs --days 7 --tolerance 0.20 --check
 *
 * `--billed` é o valor da fatura em USD pra aquele dia (Cloud Console → Faturamento →
 * Relatórios, agrupando por SKU). Com `BILLING_BQ_TABLE` configurado, ele é buscado sozinho no
 * export de faturamento do BigQuery — veja abaixo.
 *
 * Variáveis (opcionais, só pro modo automático):
 *   BILLING_BQ_PROJECT  projeto que hospeda o export
 *   BILLING_BQ_TABLE    ex. `meu-projeto.billing.gcp_billing_export_v1_XXXX`
 *   BILLING_GCP_PROJECT filtra por projeto cobrado (ex. vsn-mock-machine-gen)
 * A autenticação usa Application Default Credentials (`gcloud auth application-default login`).
 */

import 'dotenv/config';
import { MongoClient } from 'mongodb';

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : fallback;
};
const has = (name) => args.includes(`--${name}`);

const days = Number(flag('days', 14));
const singleDay = flag('day', null);
const billedOverride = flag('billed', null);
const tolerance = Number(flag('tolerance', 0.25)); // 25% de divergência é o padrão

// ── o que o app contabilizou ────────────────────────────────────────────────

async function appSpendByDay() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI não configurada');

  const client = new MongoClient(uri);
  await client.connect();
  try {
    const db = client.db(process.env.MONGODB_DB_NAME || undefined);
    const from = singleDay
      ? new Date(`${singleDay}T00:00:00Z`)
      : new Date(Date.now() - days * 86_400_000);
    const to = singleDay ? new Date(`${singleDay}T23:59:59Z`) : new Date();

    const rows = await db
      .collection('usage_records')
      .aggregate([
        { $match: { timestamp: { $gte: from, $lte: to } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
            cost: { $sum: '$cost' },
            calls: { $sum: 1 },
            errors: { $sum: { $cond: [{ $eq: ['$outcome', 'error'] }, 1, 0] } },
          },
        },
        { $sort: { _id: 1 } },
      ])
      .toArray();

    return rows.map((r) => ({
      day: r._id,
      app: Number(r.cost.toFixed(2)),
      calls: r.calls,
      errors: r.errors,
    }));
  } finally {
    await client.close();
  }
}

// ── o que o provedor cobrou ─────────────────────────────────────────────────

/**
 * Lê o export de faturamento no BigQuery. Devolve `null` quando não está configurado — nesse caso
 * o valor tem que vir por `--billed`, que é como o Cloud Console mostra.
 */
async function billedByDay(fromDay, toDay) {
  const table = process.env.BILLING_BQ_TABLE;
  const project = process.env.BILLING_BQ_PROJECT;
  if (!table || !project) return null;

  const { GoogleAuth } = await import('google-auth-library');
  const auth = new GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/bigquery.readonly'],
  });
  const clientAuth = await auth.getClient();

  const projectFilter = process.env.BILLING_GCP_PROJECT
    ? `AND project.id = @gcpProject`
    : '';

  const query = `
    SELECT FORMAT_DATE('%Y-%m-%d', DATE(usage_start_time)) AS day,
           ROUND(SUM(cost), 2) AS billed
    FROM \`${table}\`
    WHERE DATE(usage_start_time) BETWEEN @from AND @to
      AND service.description LIKE '%AI%'
      ${projectFilter}
    GROUP BY day
    ORDER BY day
  `;

  const res = await clientAuth.request({
    url: `https://bigquery.googleapis.com/bigquery/v2/projects/${project}/queries`,
    method: 'POST',
    data: {
      query,
      useLegacySql: false,
      parameterMode: 'NAMED',
      queryParameters: [
        { name: 'from', parameterType: { type: 'DATE' }, parameterValue: { value: fromDay } },
        { name: 'to', parameterType: { type: 'DATE' }, parameterValue: { value: toDay } },
        ...(process.env.BILLING_GCP_PROJECT
          ? [
              {
                name: 'gcpProject',
                parameterType: { type: 'STRING' },
                parameterValue: { value: process.env.BILLING_GCP_PROJECT },
              },
            ]
          : []),
      ],
    },
  });

  const map = new Map();
  for (const row of res.data.rows ?? []) {
    map.set(row.f[0].v, Number(row.f[1].v));
  }
  return map;
}

// ── relatório ───────────────────────────────────────────────────────────────

const app = await appSpendByDay();
if (app.length === 0) {
  console.log('nenhum usage_record na janela — nada a reconciliar');
  process.exit(0);
}

let billed = null;
if (billedOverride && singleDay) {
  billed = new Map([[singleDay, Number(billedOverride)]]);
} else {
  try {
    billed = await billedByDay(app[0].day, app[app.length - 1].day);
  } catch (err) {
    console.warn(`[billing] não consegui ler o BigQuery: ${err.message}`);
  }
}

const linhas = app.map((r) => {
  const cobrado = billed?.get(r.day) ?? null;
  const gap = cobrado === null ? null : Number((cobrado - r.app).toFixed(2));
  const razao = cobrado === null || r.app === 0 ? null : cobrado / r.app;
  return { ...r, cobrado, gap, razao };
});

console.log('\nGasto de IA — app × provedor (USD)\n');
console.table(
  linhas.map((l) => ({
    dia: l.day,
    app: l.app,
    cobrado: l.cobrado ?? '—',
    diferenca: l.gap ?? '—',
    'x maior': l.razao ? `${l.razao.toFixed(1)}x` : '—',
    chamadas: l.calls,
    erros: l.errors,
  }))
);

if (!billed) {
  console.log(
    '\nSem valor de fatura: passe `--day AAAA-MM-DD --billed <USD>` (Cloud Console →\n' +
      'Faturamento → Relatórios, agrupe por SKU) ou configure BILLING_BQ_TABLE +\n' +
      'BILLING_BQ_PROJECT pro modo automático.\n'
  );
  process.exit(0);
}

const furados = linhas.filter(
  (l) => l.cobrado !== null && l.gap > 1 && (l.app === 0 || l.cobrado / l.app > 1 + tolerance)
);

if (furados.length === 0) {
  console.log(`\nOK — nenhum dia divergindo mais que ${(tolerance * 100).toFixed(0)}%.\n`);
  process.exit(0);
}

console.log(`\nGASTO NÃO CONTABILIZADO em ${furados.length} dia(s):`);
for (const l of furados) {
  console.log(
    `  ${l.day}: provedor US$ ${l.cobrado}, app US$ ${l.app} → US$ ${l.gap} sem dono` +
      (l.razao ? ` (${l.razao.toFixed(1)}x)` : '')
  );
}
console.log(
  '\nSuspeitos de sempre: script local com a chave no .env, AI Studio, ou uma chave do mesmo\n' +
    'projeto GCP usada por outro app. Ver `.agent/plans/AI-SPEND-ACCOUNTING.md`.\n'
);

if (has('check')) process.exit(1);
