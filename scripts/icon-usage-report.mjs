// Conta quantas vezes cada ícone do barrel é renderizado (`<Icone`) em src/**,
// e gera src/lib/ui/icon-usage.generated.ts (consumido pela rota /design-system/icons).
// Rode após adicionar/remover usos de ícones: node scripts/icon-usage-report.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const ROOT = process.cwd();

// 1) Nomes exportados pelo barrel (o nome local = depois do `as`, ou o próprio).
const barrel = readFileSync('src/lib/ui/icons.ts', 'utf8');
const names = new Set();
for (const line of barrel.split('\n')) {
  const m = line.match(/^export\s+\{\s*([A-Za-z0-9]+)(?:\s+as\s+([A-Za-z0-9]+))?\s*\}/);
  if (m) names.add(m[2] || m[1]);
}

// 2) Varre src/** e conta ocorrências de `<Nome` (abertura de JSX).
const files = execSync('git ls-files "src/**/*.tsx"', { encoding: 'utf8' })
  .split('\n')
  .filter(Boolean)
  .filter((f) => f !== 'src/pages/IconReviewPage.tsx'); // não contar a própria vitrine

const counts = new Map([...names].map((n) => [n, { count: 0, files: 0 }]));
const tagRe = /<([A-Z][A-Za-z0-9]*)[\s/>]/g;

for (const f of files) {
  let src;
  try {
    src = readFileSync(f, 'utf8');
  } catch {
    continue;
  }
  const seen = new Set();
  let m;
  while ((m = tagRe.exec(src))) {
    const tag = m[1];
    if (!counts.has(tag)) continue;
    counts.get(tag).count++;
    seen.add(tag);
  }
  for (const tag of seen) counts.get(tag).files++;
}

// 3) Ordena por uso desc, depois alfabético.
const rows = [...counts.entries()]
  .map(([name, v]) => ({ name, count: v.count, files: v.files }))
  .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

const total = rows.reduce((s, r) => s + r.count, 0);
const unused = rows.filter((r) => r.count === 0).length;

const out = `// AUTO-GERADO por scripts/icon-usage-report.mjs — não editar à mão.
// ${rows.length} ícones no barrel, ${total} usos de JSX no total, ${unused} sem uso de JSX (só config/import).
export interface IconUsage {
  name: string;
  count: number;
  files: number;
}
export const ICON_USAGE_TOTAL = ${total};
export const ICON_USAGE: IconUsage[] = ${JSON.stringify(rows, null, 2)};
`;

writeFileSync('src/lib/ui/icon-usage.generated.ts', out);
console.log(
  `OK: ${rows.length} ícones, ${total} usos JSX, ${unused} sem JSX. Top 5:`,
  rows.slice(0, 5).map((r) => `${r.name}(${r.count})`).join(' '),
);
