#!/usr/bin/env node
/**
 * scan-ui-slop.mjs
 *
 * Visual "AI slop" linter — flags the two anti-patterns the design system bans
 * everywhere EXCEPT their one legit home, so a route can be de-slopped to signal
 * hierarchy instead of decoration:
 *
 *   1. cyan-non-cta   — `brand-cyan` / `text-cyan` / `bg-cyan` styling on something
 *                       that is NOT a primary CTA or a selected/active state. Cyan
 *                       is the accent; on tags/labels/stats/borders it's noise.
 *   2. mono-uppercase — `font-mono` + `uppercase` together on something that is NOT
 *                       a genuinely technical label (dimensions, hex, ratios, codes).
 *                       Decorative uppercase-mono on titles/nav/descriptions = slop.
 *
 * Detection ONLY — no --fix. Both are judgment calls (a technical label SHOULD be
 * mono-uppercase; a selected chip SHOULD be cyan), so we flag and rank; a human or
 * sub-agent decides. Mirrors scan-copy-slop.mjs on purpose.
 *
 * Usage:
 *   node scripts/scan-ui-slop.mjs             # ranked report, worst route first
 *   node scripts/scan-ui-slop.mjs --json      # machine output
 *   node scripts/scan-ui-slop.mjs --summary   # per-route counts only
 *   node scripts/scan-ui-slop.mjs --page X    # only files whose path matches X
 *   node scripts/scan-ui-slop.mjs --check     # catraca: exit 1 se algum total subir
 *   node scripts/scan-ui-slop.mjs --save-baseline   # regrava scripts/.ui-slop-baseline.json
 *   node scripts/scan-ui-slop.mjs --self-test       # casos travados (falso positivo e exceção)
 *
 * Exceção escrita (mesmo contrato do scan-design e do ruido-scan): até 8 linhas
 * acima, `EXCEÇÃO ao ui-slop/<cyan|mono>: motivo` ou `EXCEÇÃO ao ruido-scan/<regra>: motivo`.
 *
 * `--check` compara os totais (cyan, mono, internal) com a linha de base. Igual
 * ou menor passa; maior falha. O número existente é dívida conhecida, o novo é
 * regressão. Quando cair, regrave a linha de base pra a catraca apertar junto.
 */

import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'fs';
import { join, relative } from 'path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const SRC_DIR = join(ROOT, 'src');
const ARGS = process.argv.slice(2);
const FLAGS = new Set(ARGS.filter((a) => a.startsWith('--')));
const JSON_MODE = FLAGS.has('--json');
const SUMMARY_MODE = FLAGS.has('--summary');
const PAGE_FILTER = (() => {
  const i = ARGS.indexOf('--page');
  return i >= 0 ? ARGS[i + 1] : null;
})();

const IGNORE_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.next', '__tests__', 'test', 'tests']);
const norm = (p) => p.replace(/[\\/]/g, '/');

// Surfaces where mono/cyan swatches are legitimately the subject matter, not chrome.
// Flagged still (for --json) but demoted out of the actionable ranking.
const INTERNAL = /\/(Admin|Docs|DesignSystem)|\/design-system\//i;

// ─── Signals ────────────────────────────────────────────────────────────────
const CYAN_RE = /\b(?:text|bg|border|from|via|to|ring|fill|stroke)-brand-cyan\b|\b(?:text|bg|border)-cyan-\d/;
const MONO_UC = /font-mono/;
const HAS_UC = /\buppercase\b/;

// A line reads as CTA/selected/interactive if it carries any of these — cyan there
// is allowed, so we DON'T flag it. Fuzzy on purpose; report-only.
const CTA_CTX =
  /\b(?:onClick|role=["']button|type=["']submit|<button|<Button|<Link\b|href=|cursor-pointer|selected|isSelected|isActive|active|aria-selected|data-state|data-active|group-hover|hover:|focus:|toggle)\b/i;

// A mono/uppercase line reads as a genuinely technical label if it's near a unit,
// code, ratio, hex, dimension, or shortcut — mono-uppercase there is allowed.
//
// As unidades PRECISAM vir coladas num número (`24px`, `2MB`) ou soltas como
// palavra. Sem isso o `\b…\b` casava utilitário do Tailwind — `mb-2` virava "MB",
// `px-4` virava "px" — e QUALQUER className com espaçamento suprimia o achado em
// silêncio. Foi assim que `font-mono uppercase mb-2` passou batido por meses.
const UNIT = '(?:px|dpi|kb|mb|ppi|rgba?|hsla?|hex|ratio|aspect|kbd|shortcut|Ctrl)';
const TECHNICAL_CTX = new RegExp(
  `(?:(?<=\\d)|(?<![\\w-]))${UNIT}(?![\\w-])` +
    String.raw`|\d+×\d+|\d+x\d+|\d+:\d+|⌘|#[0-9a-f]{3,6}\b` +
    String.raw`|tabular-nums|\{[^}]*\.(?:width|height|size|dpi|ratio)\b`,
  'i'
);

// ─── Cyan em estado selecionado ─────────────────────────────────────────────
// A regra permite cyan em estado selecionado, mas o CTA_CTX só olhava a PRÓPRIA
// linha. O formato mais comum de chip/aba do repo quebra o ternário em linhas:
//
//     isSelected
//       ? 'border-brand-cyan bg-brand-cyan/10'
//       : 'border-neutral-800'
//
// e a linha do cyan (`? 'border-brand-cyan'`) não carrega a condição, então o
// scanner acusava cyan-non-cta em cima de estado selecionado. Falso positivo em
// massa (CanvasBottomToolbar ×6, FieldPropertiesPanel ×4, BrandCustomizationPanel
// ×4...), achado na onda 4 do slop killer (2026-10-05).
//
// Duas saídas legítimas, as duas escopadas pelo que a regra declara:
//   1. a classe está no ramo VERDADEIRO de um ternário cuja condição nomeia
//      selected/active/checked/current/focused (mesma linha ou até 3 acima);
//      o ramo `:` (falso) continua acusando, porque ali é o NÃO selecionado;
//   2. a classe vem prefixada por variante de estado (data-[state=...]:,
//      aria-selected:, focus-visible:, peer-checked: e parentes).
const STATE_WORD = /(?:selected|active|checked|current|focused)/i;
const NOT_STATE = /inactive|unchecked|unselected/i;
const STATE_VARIANT =
  /^(?:group-|peer-)?(?:data-\[(?:state|selected|active|checked|current)[^\]]*\]|aria-(?:selected|checked|current|pressed)|aria-\[(?:selected|checked|current|pressed)[^\]]*\]|focus-visible|focus-within|focus|checked|selected|active)$/;
const CYAN_TOKEN = /(?<![\w\-[\]=&/.:])(?:[\w\-[\]=&/.:]+:)?(?:text|bg|border|from|via|to|ring|fill|stroke)-(?:brand-cyan|cyan-\d+)\S*/g;

/** Todo token cyan da linha vem atrás de uma variante de estado? */
function cyanOnlyUnderStateVariant(line) {
  const tokens = line.match(CYAN_TOKEN) || [];
  if (!tokens.length) return false;
  return tokens.every((tok) => {
    const variants = tok.split(':').slice(0, -1);
    return variants.length > 0 && variants.some((v) => STATE_VARIANT.test(v));
  });
}

/** Condição do ternário cujo ramo verdadeiro carrega o cyan, ou null. */
function ternaryConditionFor(lines, i) {
  const line = lines[i];
  const cyanAt = line.search(CYAN_RE);
  const before = line.slice(0, cyanAt);
  const q = before.lastIndexOf('?');
  if (q !== -1 && before[q + 1] !== '.' && before[q + 1] !== '?') {
    // `:` entre o `?` e o cyan = ramo falso (o NÃO selecionado).
    if (/\s:\s|^\s*:/.test(before.slice(q + 1))) return null;
    // Só a cauda antes do `?`: a linha inteira traria `isActive` de outro prop.
    const cond = before.slice(Math.max(0, q - 60), q).trim();
    if (cond) return cond;
    // Linha começa com `?`: a condição está acima (até 3 linhas).
    return lines
      .slice(Math.max(0, i - 3), i)
      .join(' ')
      .slice(-100);
  }
  return null;
}

// Igualdade contra o item do loop (`sel === item.value ?`, `item.id === sel ?`)
// também é estado de seleção. Lista branca do lado do item (.id/.value/.key ou
// variável de loop nua) pra NÃO deixar passar `status === 'error' ?`.
const LOOP_VAR = '(?:item|opt|option|tab|tool|preset|entry|chip|seg|o|v|k)';
const ITEM_SIDE = String.raw`(?:[\w$]+\.(?:id|value|key)|${LOOP_VAR})`;
const ITEM_EQ = new RegExp(
  String.raw`===\s*${ITEM_SIDE}\s*(?:&&.*)?$|(?:^|[\s(!&|{])${ITEM_SIDE}\s*===\s*[\w$.]+\s*$`
);

function cyanIsSelectedState(lines, i) {
  if (cyanOnlyUnderStateVariant(lines[i])) return true;
  const cond = ternaryConditionFor(lines, i);
  if (!cond) return false;
  if (STATE_WORD.test(cond) && !NOT_STATE.test(cond)) return true;
  return ITEM_EQ.test(cond.trim());
}

// ─── Exceção escrita ────────────────────────────────────────────────────────
// Mesmo contrato do scan-design-violations e do ruido-scan do visant-killer:
// um comentário até 8 linhas ACIMA (ou na própria linha) dizendo
//
//     // EXCEÇÃO ao ui-slop/mono: hex é valor técnico
//     {/* EXCEÇÃO ao ruido-scan/mono-uppercase: tipo de arquivo (PDF) é técnico */}
//
// libera o achado. Precisa nomear a regra (cyan|cyan-non-cta, mono|mono-uppercase)
// sob ui-slop/ ou ruido-scan/ E trazer motivo: "EXCEÇÃO" solto ou sem texto
// depois dos dois-pontos não libera nada, senão vira marcador mudo.
const EXCEPTION_WINDOW = 8;
const RULE_ALIASES = {
  'cyan-non-cta': ['cyan-non-cta', 'cyan'],
  'mono-uppercase': ['mono-uppercase', 'mono'],
};
const EXCEPTION_RE = {};
for (const [rule, names] of Object.entries(RULE_ALIASES)) {
  EXCEPTION_RE[rule] = new RegExp(
    String.raw`EXCE(?:Ç|C)(?:Ã|A)O\s+ao\s+(?:ui-slop|ruido-scan)/(?:${names.join('|')})(?![\w-])\s*:\s*(.*)`,
    'i'
  );
}

/** Há "EXCEÇÃO ao <escopo>/<regra>: <motivo>" na janela acima da linha i? */
function hasWrittenException(lines, i, rule) {
  const re = EXCEPTION_RE[rule];
  for (let k = i; k >= Math.max(0, i - EXCEPTION_WINDOW); k--) {
    const m = lines[k].match(re);
    if (!m) continue;
    // O motivo pode quebrar pra linha seguinte do comentário; conta as duas.
    const next = (lines[k + 1] ?? '').replace(/^\s*(?:\/\/|\*|\/\*|\{\/\*)/, '');
    const reason = `${m[1].replace(/\*\/\}?\s*$/, '')} ${k + 1 <= i ? next : ''}`;
    if ((reason.match(/\p{L}/gu) ?? []).length >= 8 && /\p{L}{3,}/u.test(m[1])) return true;
  }
  return false;
}

function isNoise(line) {
  const t = line.trim();
  return t.startsWith('//') || t.startsWith('*') || t.startsWith('/*') || /^import\s/.test(t);
}

// ─── Walk ─────────────────────────────────────────────────────────────────────
function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (!IGNORE_DIRS.has(entry)) walk(full, out);
    } else if (entry.endsWith('.tsx')) out.push(full);
  }
  return out;
}

// ─── Self-test (trava os falsos positivos já consertados) ────────────────────
// Caso novo que escapar: acrescente aqui, nunca substitua.
if (FLAGS.has('--self-test')) {
  const cases = [
    // [descrição, linhas, índice da linha com cyan, deve acusar?]
    ['ternário multilinha isSelected (ramo ?)', ['  isSelected', "    ? 'border-brand-cyan bg-brand-cyan/10'", "    : 'border-neutral-800'"], 1, false],
    ['ternário mesma linha focused', ["focused && !locked ? 'text-brand-cyan' : 'text-neutral-800'"], 0, false],
    ['ternário activeTab === x', ["{activeTab === 'logo' ? 'text-brand-cyan' : ''}"], 0, false],
    ['data-[state=on]: prefixo', ['className="data-[state=on]:text-brand-cyan text-neutral-400"'], 0, false],
    ['aria-selected: prefixo', ['className="aria-selected:bg-brand-cyan/10"'], 0, false],
    ['focus-visible: prefixo', ['className="focus-visible:ring-brand-cyan rounded"'], 0, false],
    ['peer-checked: prefixo', ['className="peer-checked:border-brand-cyan"'], 0, false],
    ['ternário X === item.value', ["{sel === item.value ? 'text-brand-cyan' : ''}"], 0, false],
    ['ternário item.id === X', ["{item.id === sel ? 'border-brand-cyan' : ''}"], 0, false],
    // verdadeiros: continuam acusando
    ["status === 'error' não é seleção", ["{status === 'error' ? 'text-brand-cyan' : ''}"], 0, true],
    ['cyan estático em badge', ['<span className="text-brand-cyan text-xs">Novo</span>'], 0, true],
    ['ramo falso (: ) do selecionado', ['  isSelected', "    ? 'border-neutral-600'", "    : 'border-brand-cyan'"], 2, true],
    ['condição não-estado (isPrimary)', ["isPrimary ? 'fill-brand-cyan' : ''"], 0, true],
    ['condição inactive não conta', ["isInactive ? 'text-brand-cyan' : ''"], 0, true],
    ['variante não-estado (md:)', ['className="md:text-brand-cyan"'], 0, true],
    ['prefixo de estado só num dos tokens', ['className="peer-checked:bg-brand-cyan/10 text-brand-cyan"'], 0, true],
  ];
  let fail = 0;
  for (const [name, ls, idx, want] of cases) {
    const got = CYAN_RE.test(ls[idx]) && !CTA_CTX.test(ls[idx]) && !cyanIsSelectedState(ls, idx);
    if (got !== want) fail++;
    console.log(`${got === want ? 'ok  ' : 'FAIL'} ${want ? 'acusa' : 'ignora'}: ${name}`);
  }
  // Exceção escrita: [descrição, linhas, índice do achado, regra, deve acusar?]
  const MONO = '<span className="font-mono uppercase text-2xs">{label}</span>';
  const CYAN = '<span className="text-brand-cyan text-xs">Novo</span>';
  const exceptionCases = [
    ['ruido-scan/mono-uppercase na linha de cima', ['{/* EXCEÇÃO ao ruido-scan/mono-uppercase: hex é valor técnico. */}', MONO], 1, 'mono-uppercase', false],
    ['ruido-scan/mono (apelido curto)', ['{/* EXCEÇÃO ao ruido-scan/mono: spec técnica do arquivo (formato, fps) */}', MONO], 1, 'mono-uppercase', false],
    ['ui-slop/mono 8 linhas acima', ['// EXCEÇÃO ao ui-slop/mono: código de pedido é identificador', ...Array(7).fill('x'), MONO], 8, 'mono-uppercase', false],
    ['ui-slop/cyan libera cyan', ['// EXCEÇÃO ao ui-slop/cyan: swatch da cor da marca, o cyan é o assunto', CYAN], 1, 'cyan-non-cta', false],
    ['motivo quebrado na linha seguinte', ['// EXCEÇÃO ao ui-slop/cyan: swatch', '// da paleta, o cyan é o próprio assunto', CYAN], 2, 'cyan-non-cta', false],
    ['sem acento (EXCECAO) também vale', ['// EXCECAO ao ui-slop/mono: identificador técnico do lote', MONO], 1, 'mono-uppercase', false],
    // verdadeiros: continuam acusando
    ['9 linhas acima (fora da janela)', ['// EXCEÇÃO ao ui-slop/mono: código de pedido é identificador', ...Array(8).fill('x'), MONO], 9, 'mono-uppercase', true],
    ['sem motivo', ['// EXCEÇÃO ao ui-slop/mono:', MONO], 1, 'mono-uppercase', true],
    ['motivo curto demais', ['// EXCEÇÃO ao ui-slop/mono: ok', MONO], 1, 'mono-uppercase', true],
    ['regra trocada (cyan não libera mono)', ['// EXCEÇÃO ao ui-slop/cyan: swatch da cor da marca, o cyan é o assunto', MONO], 1, 'mono-uppercase', true],
    ['regra de outro nome (mono-x)', ['// EXCEÇÃO ao ruido-scan/mono-x: motivo escrito aqui', MONO], 1, 'mono-uppercase', true],
    ['escopo desconhecido', ['// EXCEÇÃO ao audit:design/mono: motivo escrito aqui', MONO], 1, 'mono-uppercase', true],
    ['EXCEÇÃO solta sem regra', ['// EXCEÇÃO: hex é valor técnico do arquivo', MONO], 1, 'mono-uppercase', true],
    ['exceção ABAIXO não vale', [MONO, '// EXCEÇÃO ao ui-slop/mono: código de pedido é identificador'], 0, 'mono-uppercase', true],
  ];
  for (const [name, ls, idx, rule, want] of exceptionCases) {
    const base =
      rule === 'mono-uppercase'
        ? MONO_UC.test(ls[idx]) && HAS_UC.test(ls[idx]) && !TECHNICAL_CTX.test(ls[idx])
        : CYAN_RE.test(ls[idx]) && !CTA_CTX.test(ls[idx]) && !cyanIsSelectedState(ls, idx);
    const got = base && !hasWrittenException(ls, idx, rule);
    if (got !== want) fail++;
    console.log(`${got === want ? 'ok  ' : 'FAIL'} ${want ? 'acusa' : 'ignora'}: ${name}`);
  }
  process.exit(fail ? 1 : 0);
}

const files = walk(SRC_DIR);
const hits = [];

for (const file of files) {
  const rel = norm(relative(ROOT, file));
  if (PAGE_FILTER && !rel.toLowerCase().includes(PAGE_FILTER.toLowerCase())) continue;
  const lines = readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, i) => {
    if (isNoise(line)) return;
    const snippet = line.trim().slice(0, 120);

    if (
      CYAN_RE.test(line) &&
      !CTA_CTX.test(line) &&
      !cyanIsSelectedState(lines, i) &&
      !hasWrittenException(lines, i, 'cyan-non-cta')
    ) {
      hits.push({ file: rel, line: i + 1, pattern: 'cyan-non-cta', snippet, internal: INTERNAL.test(rel) });
    }
    if (
      MONO_UC.test(line) &&
      HAS_UC.test(line) &&
      !TECHNICAL_CTX.test(line) &&
      !hasWrittenException(lines, i, 'mono-uppercase')
    ) {
      hits.push({ file: rel, line: i + 1, pattern: 'mono-uppercase', snippet, internal: INTERNAL.test(rel) });
    }
  });
}

// ─── Aggregate by route ─────────────────────────────────────────────────────
const byFile = {};
for (const h of hits) {
  const b = (byFile[h.file] ||= { file: h.file, internal: h.internal, cyan: 0, mono: 0, hits: [] });
  if (h.pattern === 'cyan-non-cta') b.cyan++;
  else b.mono++;
  b.hits.push(h);
}
const ranked = Object.values(byFile).sort((a, b) => b.cyan + b.mono - (a.cyan + a.mono));
const actionable = ranked.filter((r) => !r.internal);

// ─── Catraca ────────────────────────────────────────────────────────────────
const BASELINE = join(ROOT, 'scripts', '.ui-slop-baseline.json');
const totals = {
  cyan: actionable.reduce((n, r) => n + r.cyan, 0),
  mono: actionable.reduce((n, r) => n + r.mono, 0),
  internal: ranked.filter((r) => r.internal).reduce((n, r) => n + r.cyan + r.mono, 0),
};
if ((FLAGS.has('--check') || FLAGS.has('--save-baseline')) && PAGE_FILTER) {
  console.error('--check/--save-baseline medem o app inteiro; não combine com --page.');
  process.exit(2);
}
if (FLAGS.has('--save-baseline')) {
  writeFileSync(BASELINE, JSON.stringify({ totals }, null, 2) + '\n');
  console.log('linha de base gravada:', norm(relative(ROOT, BASELINE)), totals);
  process.exit(0);
}
if (FLAGS.has('--check')) {
  if (!existsSync(BASELINE)) {
    console.error('sem linha de base. Rode --save-baseline primeiro.');
    process.exit(1);
  }
  const base = JSON.parse(readFileSync(BASELINE, 'utf8')).totals;
  const piorou = Object.keys(totals).filter((k) => totals[k] > (base[k] ?? 0));
  for (const k of Object.keys(totals)) console.log(`  ${k.padEnd(9)} ${base[k] ?? 0} -> ${totals[k]}`);
  if (piorou.length) {
    console.error(`\nREGRESSÃO de ui-slop em: ${piorou.join(', ')}. Rode sem --check pra ver as linhas.`);
    process.exit(1);
  }
  const caiu = Object.keys(totals).some((k) => totals[k] < (base[k] ?? 0));
  console.log(
    caiu ? '\ncatraca OK — melhorou; rode --save-baseline pra apertar.' : '\ncatraca OK — nada piorou.'
  );
  process.exit(0);
}

// ─── Output ─────────────────────────────────────────────────────────────────
if (JSON_MODE) {
  console.log(JSON.stringify({ total: hits.length, files: ranked }, null, 2));
  process.exit(0);
}

const PAD = (n) => String(n).padStart(3);
console.log('\n■ UI slop by route (worst first)  —  cyan = non-CTA cyan, mono = decorative font-mono+uppercase\n');
console.log('   cyan  mono   route');
for (const r of actionable) {
  if (!r.cyan && !r.mono) continue;
  console.log(`   ${PAD(r.cyan)}  ${PAD(r.mono)}   ${r.file}`);
}

if (!SUMMARY_MODE) {
  console.log('\n── line-level (top 20 routes) ──');
  for (const r of actionable.slice(0, 20)) {
    if (!r.cyan && !r.mono) continue;
    console.log(`\n${r.file}  (cyan ${r.cyan} / mono ${r.mono})`);
    for (const h of r.hits) console.log(`  ${h.line} [${h.pattern === 'cyan-non-cta' ? 'cyan' : 'mono'}]: ${h.snippet}`);
  }
}

const internalTotal = ranked.filter((r) => r.internal).reduce((n, r) => n + r.cyan + r.mono, 0);
console.log('\n── summary ──');
console.log(`  ${PAD(actionable.reduce((n, r) => n + r.cyan, 0))}  cyan-non-cta (actionable)`);
console.log(`  ${PAD(actionable.reduce((n, r) => n + r.mono, 0))}  mono-uppercase (actionable)`);
console.log(`  ${PAD(internalTotal)}  internal (Admin/Docs/DesignSystem — demoted, likely legit)`);
console.log(`  ${PAD(actionable.filter((r) => r.cyan || r.mono).length)}  routes with slop`);
process.exit(0);
