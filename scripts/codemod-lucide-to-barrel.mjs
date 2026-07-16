// Codemod: aponta todos os imports de `lucide-react` em src/** para o barrel
// `@/lib/ui/icons`. Só troca a string de origem — o barrel re-exporta os ícones
// do Phosphor com os nomes do lucide, então o JSX dos consumidores não muda.
//
// Uso: node scripts/codemod-lucide-to-barrel.mjs [--dry]
import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { relative } from 'node:path';

const DRY = process.argv.includes('--dry');
const BARREL = 'src/lib/ui/icons.ts'; // NÃO reescrever (auto-import circular)

const files = execSync('git ls-files "src/**/*.ts" "src/**/*.tsx"', {
  encoding: 'utf8',
})
  .split('\n')
  .filter(Boolean)
  .filter((f) => relative('.', f).replace(/\\/g, '/') !== BARREL);

const SRC_RE = /(from\s*)(['"])lucide-react\2/g;

let changed = 0;
let hits = 0;
for (const f of files) {
  const src = readFileSync(f, 'utf8');
  if (!src.includes('lucide-react')) continue;
  const next = src.replace(SRC_RE, (_m, from, q) => {
    hits++;
    return `${from}${q}@/lib/ui/icons${q}`;
  });
  if (next !== src) {
    changed++;
    if (!DRY) writeFileSync(f, next);
  }
}

console.log(
  `${DRY ? '[DRY] ' : ''}${changed} arquivos ${DRY ? 'seriam alterados' : 'alterados'}, ${hits} imports reapontados.`,
);
