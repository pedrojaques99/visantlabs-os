#!/usr/bin/env node
// Aplica patches de locale escritos por agentes paralelos em src/locales/*.json.
// Patch: {"set": {"pt-BR": {"a.b.c": "texto"}, "en-US": {...}}, "remove": ["a.b.x"]}
// Uso: node scripts/merge-locale-patches.mjs <patch.json>... [--write]
// Sem --write só mostra o que mudaria e acusa conflitos (mesma chave com valores diferentes).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const args = process.argv.slice(2);
const write = args.includes('--write');
const patches = args.filter(a => a !== '--write');
if (!patches.length) { console.error('uso: merge-locale-patches.mjs <patch.json>... [--write]'); process.exit(1); }

const LOCALES = ['pt-BR', 'en-US'];
const dir = path.resolve('src/locales');
const data = Object.fromEntries(LOCALES.map(l => [l, JSON.parse(fs.readFileSync(path.join(dir, `${l}.json`), 'utf8'))]));

const get = (o, k) => k.split('.').reduce((a, p) => (a && typeof a === 'object' ? a[p] : undefined), o);
function set(o, k, v) {
  const ps = k.split('.');
  let cur = o;
  for (const p of ps.slice(0, -1)) {
    if (cur[p] === undefined) cur[p] = {};
    else if (typeof cur[p] !== 'object') throw new Error(`"${k}": "${p}" já é texto, não dá pra aninhar`);
    cur = cur[p];
  }
  cur[ps.at(-1)] = v;
}
function del(o, k) {
  const ps = k.split('.');
  const parent = ps.length > 1 ? get(o, ps.slice(0, -1).join('.')) : o;
  if (!parent || !(ps.at(-1) in parent)) return false;
  delete parent[ps.at(-1)];
  return true;
}

const seen = {}; // locale:key -> {value, from}
const ops = [];
let conflicts = 0;
for (const file of patches) {
  const p = JSON.parse(fs.readFileSync(file, 'utf8'));
  const from = path.basename(file);
  for (const [loc, kv] of Object.entries(p.set || {})) {
    if (!LOCALES.includes(loc)) { console.error(`locale desconhecido "${loc}" em ${from}`); conflicts++; continue; }
    for (const [k, v] of Object.entries(kv)) {
      const id = `${loc}:${k}`;
      if (seen[id] && seen[id].value !== v) { console.error(`CONFLITO ${id}: ${seen[id].from}="${seen[id].value}" vs ${from}="${v}"`); conflicts++; continue; }
      seen[id] = { value: v, from };
      ops.push({ type: 'set', loc, k, v, from });
    }
  }
  for (const k of p.remove || []) ops.push({ type: 'remove', k, from });
}

const removed = new Set(ops.filter(o => o.type === 'remove').map(o => o.k));
for (const o of ops) if (o.type === 'set' && removed.has(o.k)) { console.error(`CONFLITO ${o.k}: ${o.from} define, outro patch remove`); conflicts++; }

let changed = 0;
for (const o of ops) {
  if (o.type === 'set') {
    const old = get(data[o.loc], o.k);
    if (old === o.v) continue;
    if (old && typeof old === 'object') { console.error(`CONFLITO ${o.loc}:${o.k}: já é um grupo de chaves; sobrescrever apagaria ${Object.keys(old).length} filhas`); conflicts++; continue; }
    console.log(`${old === undefined ? '+' : '~'} ${o.loc} ${o.k} = "${o.v}"${old !== undefined ? `  (era "${old}")` : ''}`);
    set(data[o.loc], o.k, o.v); changed++;
  } else {
    for (const l of LOCALES) if (del(data[l], o.k)) { console.log(`- ${l} ${o.k}`); changed++; }
  }
}
// avisa chave nova que só existe num idioma
for (const o of ops.filter(o => o.type === 'set')) {
  const other = LOCALES.find(l => l !== o.loc);
  if (get(data[other], o.k) === undefined) console.warn(`aviso: ${o.k} sem tradução em ${other}`);
}

console.log(`\n${changed} mudanças, ${conflicts} conflitos.`);
if (conflicts) process.exit(2);
if (write) {
  for (const l of LOCALES) fs.writeFileSync(path.join(dir, `${l}.json`), JSON.stringify(data[l], null, 2) + '\n');
  console.log('gravado.');
} else console.log('(prévia; rode com --write para gravar)');
