#!/usr/bin/env node
/**
 * i18n Merge Fragments — junta fragmentos de chave nos locales.
 *
 * Agentes que rodam em paralelo não podem editar src/locales/*.json ao mesmo
 * tempo (um sobrescreve o outro). Cada um escreve um fragmento
 * { "pt-BR": { "a.b.c": "texto" }, "en-US": { "a.b.c": "text" } } numa pasta,
 * e este script faz o merge uma vez só.
 *
 * Nunca sobrescreve chave existente: valor diferente vira conflito no relatório.
 * Chave que só veio num locale também é reportada (a UI mostraria a chave crua).
 *
 * Uso:
 *   node scripts/i18n-merge-fragments.mjs <pasta>           # dry-run
 *   node scripts/i18n-merge-fragments.mjs <pasta> --apply
 *   node scripts/i18n-merge-fragments.mjs <pasta> --apply --override a.b,c.d
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const ROOT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const LOCALES = ['pt-BR', 'en-US'];
const dir = process.argv[2];
const APPLY = process.argv.includes('--apply');
// Sobrescrever é exceção nomeada chave por chave, nunca um "force" geral:
// --override a.b,c.d (correção de tradução ou de nome aprovada).
const OVERRIDE = new Set(
  (process.argv[process.argv.indexOf('--override') + 1] || '').split(',').filter(Boolean)
);
if (!process.argv.includes('--override')) OVERRIDE.clear();
if (!dir || !fs.existsSync(dir)) {
  console.error('uso: node scripts/i18n-merge-fragments.mjs <pasta> [--apply]');
  process.exit(1);
}

const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const getAt = (obj, key) => key.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);

// devolve o motivo do bloqueio, ou null se gravou / já estava igual
function setAt(obj, key, value, override = false) {
  const parts = key.split('.');
  const last = parts.pop();
  let cur = obj;
  for (const p of parts) {
    if (cur[p] === undefined) cur[p] = {};
    else if (typeof cur[p] !== 'object' || Array.isArray(cur[p])) return `'${p}' já é texto`;
    cur = cur[p];
  }
  if (cur[last] === undefined || (override && typeof cur[last] === 'string')) {
    cur[last] = value;
    return null;
  }
  return cur[last] === value ? null : `existe com outro valor: ${JSON.stringify(cur[last])}`;
}

const locales = Object.fromEntries(
  LOCALES.map((l) => [l, readJson(path.join(ROOT_DIR, 'src', 'locales', `${l}.json`))])
);
const added = Object.fromEntries(LOCALES.map((l) => [l, 0]));
const problems = [];

for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.json'))) {
  const frag = readJson(path.join(dir, file));
  const keys = new Set(LOCALES.flatMap((l) => Object.keys(frag[l] || {})));
  for (const key of keys) {
    for (const l of LOCALES) {
      const value = frag[l]?.[key];
      if (value === undefined) {
        if (getAt(locales[l], key) === undefined) problems.push(`${file} ${l} ${key}: falta neste locale`);
        continue;
      }
      const before = getAt(locales[l], key);
      const err = setAt(locales[l], key, value, OVERRIDE.has(key));
      if (err) problems.push(`${file} ${l} ${key}: ${err}`);
      else if (before === undefined) added[l]++;
      else if (before !== value) console.log(`  ~ ${l} ${key}: ${JSON.stringify(before)} -> ${JSON.stringify(value)}`);
    }
  }
}

console.log(`chaves novas: ${LOCALES.map((l) => `${l}=${added[l]}`).join('  ')}`);
problems.forEach((p) => console.log(`  ! ${p}`));
if (APPLY) {
  for (const l of LOCALES)
    fs.writeFileSync(
      path.join(ROOT_DIR, 'src', 'locales', `${l}.json`),
      JSON.stringify(locales[l], null, 2) + '\n'
    );
  // JSON.stringify expande array curto em várias linhas; o prettier do repo
  // devolve o formato canônico, então o diff fica só com as chaves novas.
  execSync(`npx prettier --write ${LOCALES.map((l) => `src/locales/${l}.json`).join(' ')}`, {
    cwd: ROOT_DIR,
    stdio: 'ignore',
  });
  console.log('gravado.');
} else console.log('dry-run (use --apply).');
process.exit(problems.length ? 2 : 0);
