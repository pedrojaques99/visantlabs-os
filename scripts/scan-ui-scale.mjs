#!/usr/bin/env node
/**
 * scan-ui-scale — o portão que faltava.
 *
 * O `scan-design-violations.mjs` policia COR e só cor. Tipo, peso, raio e
 * densidade de micro-label nunca tiveram detector, então cada tela decidiu
 * sozinha por três anos. Genérico é a média de muitas decisões locais, e é
 * por isso que a UI passa em todo linter e ainda lê como template.
 *
 * Este script não conserta nada. Ele conta, e conta POR ARQUIVO, porque o
 * defeito é de agregado: cada linha isolada é defensável.
 *
 *   node scripts/scan-ui-scale.mjs                    # app inteiro, resumo
 *   node scripts/scan-ui-scale.mjs src/components/cockpit
 *   node scripts/scan-ui-scale.mjs --top 20           # piores arquivos
 *   node scripts/scan-ui-scale.mjs --check            # exit 1 se piorar
 *
 * `--check` compara com `scripts/.ui-scale-baseline.json` e falha se algum
 * total subir. É catraca: o número existente é dívida conhecida, o número novo
 * é regressão. Regravar a linha de base: `--save-baseline`.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const BASELINE = path.join(ROOT, 'scripts', '.ui-scale-baseline.json');

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const opt = (name, dflt) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : dflt;
};
const targets = args.filter((a) => !a.startsWith('--') && !/^\d+$/.test(a));

/**
 * Cada regra devolve os matches de UMA linha. `budget` é por arquivo: acima
 * dele o arquivo entra no relatório. Zero significa "nunca deveria aparecer".
 */
const RULES = [
  {
    id: 'micro-label',
    label: 'micro-label (mono/caixa-alta/tracking)',
    budget: 2,
    why: 'Mono + caixa-alta + tracking largo e a assinatura de dashboard de IA. O MicroTitle default virou heading de verdade; so tone="technical" e label solto ainda contam.',
    test: (line) =>
      /<MicroTitle[^>]*tone=['"]?technical/.test(line) ||
      (/uppercase/.test(line) && /tracking-(widest|\[0?\.\d+em\])/.test(line)),
  },
  {
    id: 'px-cru',
    label: 'tamanho de fonte em px cru',
    budget: 0,
    why: 'text-[13px] é uma escala de uma tela só. Use a escala do Tailwind (text-xs..text-2xl) pra que duas telas concordem.',
    test: (line) => /text-\[\d+px\]/.test(line),
  },
  {
    id: 'peso-pesado',
    label: 'peso bold/semibold',
    budget: 3,
    why: 'Com semibold e bold em tudo, nada tem ênfase. Chrome de produto vive em regular e medium; bold é reservado.',
    test: (line) => /font-(bold|semibold|black)\b/.test(line),
  },
  {
    id: 'raio-sortido',
    label: 'raios diferentes no mesmo arquivo',
    budget: 3,
    why: 'Raio é linguagem: um pra controle, um pra card, um pra pílula. Oito valores é ausência de decisão.',
    test: null, // medido por variedade, não por contagem — ver abaixo
    variety: (src) => new Set(src.match(/rounded-(?:sm|md|lg|xl|2xl|3xl|none)\b/g) || []).size,
  },
  {
    id: 'accent-repouso',
    label: 'accent em repouso (sem estado)',
    budget: 2,
    why: 'Cor só onde é core. text-/border-brand-cyan sem variante é decoração; accent num estado (hover, selecionado) é sinal. 602 usos nus medidos antes do codemod.',
    test: (line) =>
      /(^|[\s"'`])(text|border)-brand-cyan(?=[\s"'`]|$)/.test(line) &&
      !/\?|active|selected|current|checked/i.test(line),
  },
  {
    id: 'matiz-cru',
    label: 'matiz literal do Tailwind',
    budget: 0,
    why: 'red/amber/green têm token semântico (destructive/warning/success). Categórico tem --chart-1..5. Matiz literal é um terceiro sistema de cor, e três vermelhos diferentes na mesma tela é o que lê como carnaval.',
    test: (line) =>
      /\b(text|bg|border|ring|fill|stroke|from|to|via|decoration)-(red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b/.test(
        line
      ),
  },
  {
    id: 'opacidade-cru',
    label: 'cor por opacidade arbitrária',
    budget: 6,
    why: 'text-white/45, border-white/10 e bg-black/[0.02] são um tema paralelo ao dos tokens. Dois sistemas de cor na mesma tela nunca alinham.',
    test: (line) => /(?:text|bg|border)-(?:white|black|foreground)\/(?:\d{1,3}|\[[\d.]+\])/.test(line),
  },
];

const IGNORE_DIR = /(^|[\\/])(node_modules|dist|build|\.next|coverage|__tests__)([\\/]|$)/;
const IS_UI = /\.(tsx|jsx)$/;

function walk(dir, out = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (!IGNORE_DIR.test(full)) walk(full, out);
    } else if (IS_UI.test(e.name)) {
      out.push(full);
    }
  }
  return out;
}

function collect() {
  const roots = targets.length ? targets : ['src'];
  const files = [];
  for (const r of roots) {
    const abs = path.resolve(ROOT, r);
    if (!fs.existsSync(abs)) continue;
    if (fs.statSync(abs).isDirectory()) walk(abs, files);
    else if (IS_UI.test(abs)) files.push(abs);
  }
  return files;
}

/** Comentário e import não são interface. Contar ali infla o número e mata a confiança no detector. */
function isCode(line) {
  const t = line.trim();
  return !(t.startsWith('//') || t.startsWith('*') || t.startsWith('/*') || t.startsWith('import '));
}

function scanFile(file) {
  const src = fs.readFileSync(file, 'utf8');
  const lines = src.split(/\r?\n/);
  const counts = {};
  for (const rule of RULES) {
    if (rule.variety) {
      counts[rule.id] = rule.variety(src);
      continue;
    }
    let n = 0;
    for (const line of lines) if (isCode(line) && rule.test(line)) n++;
    counts[rule.id] = n;
  }
  return counts;
}

const files = collect();
const perFile = [];
const totals = Object.fromEntries(RULES.map((r) => [r.id, 0]));

for (const f of files) {
  const counts = scanFile(f);
  for (const r of RULES) totals[r.id] += counts[r.id];
  const over = RULES.filter((r) => counts[r.id] > r.budget);
  if (over.length) {
    perFile.push({
      file: path.relative(ROOT, f).replace(/\\/g, '/'),
      counts,
      // "peso" do arquivo: quanto ele passa do orçamento, somado
      excess: over.reduce((s, r) => s + (counts[r.id] - r.budget), 0),
      over: over.map((r) => r.id),
    });
  }
}

perFile.sort((a, b) => b.excess - a.excess);

if (flag('--save-baseline')) {
  fs.writeFileSync(BASELINE, JSON.stringify({ totals, files: files.length }, null, 2) + '\n');
  console.log('linha de base gravada:', path.relative(ROOT, BASELINE));
  process.exit(0);
}

console.log(`\nscan-ui-scale  ${files.length} arquivo(s) de interface\n`);
for (const r of RULES) {
  const acima = perFile.filter((f) => f.over.includes(r.id)).length;
  console.log(
    `  ${String(totals[r.id]).padStart(5)}  ${r.label.padEnd(38)} ${acima} arquivo(s) acima do orçamento (${r.budget})`
  );
}

const top = Number(opt('--top', '12'));
if (perFile.length) {
  console.log(`\n  piores ${Math.min(top, perFile.length)} arquivos:\n`);
  for (const f of perFile.slice(0, top)) {
    const detalhe = f.over.map((id) => `${id}=${f.counts[id]}`).join('  ');
    console.log(`    ${f.file}`);
    console.log(`      ${detalhe}`);
  }
}

console.log('\n  por que cada um importa:');
for (const r of RULES) console.log(`    ${r.id}: ${r.why}`);

if (flag('--check')) {
  if (!fs.existsSync(BASELINE)) {
    console.error('\nsem linha de base. Rode --save-baseline primeiro.');
    process.exit(1);
  }
  const base = JSON.parse(fs.readFileSync(BASELINE, 'utf8'));
  const piorou = RULES.filter((r) => totals[r.id] > (base.totals[r.id] ?? 0));
  if (piorou.length) {
    console.error('\nREGRESSÃO — subiu em relação à linha de base:');
    for (const r of piorou)
      console.error(`  ${r.id}: ${base.totals[r.id]} -> ${totals[r.id]}`);
    process.exit(1);
  }
  console.log('\ncatraca OK — nada piorou.');
}

console.log('');
