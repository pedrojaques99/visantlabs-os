#!/usr/bin/env node
/**
 * codemod-shouting-copy — tira o CAIXA-ALTA das strings de interface.
 *
 * 157 chaves do locale estavam escritas inteiras em maiúscula ("ENTRAR",
 * "NENHUM PROJETO AINDA", "BIBLIOTECA"). Isso existia porque o `MicroTitle`
 * aplicava `uppercase` no CSS e alguém replicou o visual na string — então em
 * muitos lugares a palavra gritava DUAS vezes.
 *
 * Agora que o MicroTitle default é heading de verdade, a string em CAPS aparece
 * crua e fica pior que antes. Sentence case é o conserto.
 *
 * NÃO toca (a lista existe porque codemod cego em copy é como se estraga copy):
 *   · sigla e acrônimo (CSS, API, PDF, SVG, IA, 3D…)
 *   · nome de marca e produto
 *   · string sem letra minúscula possível ("A-Z", "OK")
 *   · qualquer chave listada em KEEP
 *
 *   node scripts/codemod-shouting-copy.mjs           # PREVIEW
 *   node scripts/codemod-shouting-copy.mjs --apply
 */
import fs from 'node:fs';

const APPLY = process.argv.includes('--apply');
const LOCALES = ['src/locales/pt-BR.json', 'src/locales/en-US.json'];

/** Palavra que continua em caixa-alta mesmo dentro de uma frase convertida. */
const SIGLAS = new Set([
  'API','CSS','PDF','SVG','PNG','JPG','JPEG','WEBP','GIF','MP4','JSON','HTML','URL','URI','ID',
  'IA','AI','3D','2D','UI','UX','SEO','OG','MCP','SDK','CLI','QR','RGB','HSL','CMYK','HEX','DPI',
  'PSD','AI','EPS','TIFF','ZIP','CSV','XLS','OAUTH','JWT','SSO','CTA','ROI','KPI','B2B','B2C',
  'VISANT','BOXY','FAQ','LGPD','GDPR','CNPJ','CPF','A-Z','Z-A','OK','SIM','NAO',
]);

/** Chaves que ficam como estão, custe o que custar. */
const KEEP = [
  /^about\.title$/, // VISANT, é a marca
  /^plugin\.profile\.versionLabel$/, // rótulo de versão, técnico
  /^apps\.sort\./, // A-Z / Z-A
  /\.acronym$/,
];

const ehCaps = (v) =>
  typeof v === 'string' &&
  v.length > 2 &&
  v === v.toUpperCase() &&
  /[A-ZÀ-Ú]/.test(v) &&
  /[A-ZÀ-Ú]{2,}/.test(v);

function sentenceCase(s) {
  const palavras = s.split(/(\s+)/);
  let primeira = true;
  return palavras
    .map((w) => {
      if (/^\s+$/.test(w)) return w;
      const nu = w.replace(/[^\wÀ-Ú-]/g, '');
      if (SIGLAS.has(nu)) return w;
      if (/^[\d\W]+$/.test(w)) return w;
      const baixo = w.toLocaleLowerCase('pt-BR');
      if (primeira) {
        primeira = false;
        return baixo.charAt(0).toLocaleUpperCase('pt-BR') + baixo.slice(1);
      }
      return baixo;
    })
    .join('');
}

let total = 0;
const amostras = [];

for (const file of LOCALES) {
  const j = JSON.parse(fs.readFileSync(file, 'utf8'));
  let n = 0;

  (function walk(o, prefix) {
    for (const [k, v] of Object.entries(o)) {
      const kp = prefix ? `${prefix}.${k}` : k;
      if (typeof v === 'string') {
        if (!ehCaps(v)) continue;
        if (KEEP.some((re) => re.test(kp))) continue;
        const novo = sentenceCase(v);
        if (novo === v) continue;
        n++;
        if (amostras.length < 24) amostras.push(`${kp}\n      "${v}"  ->  "${novo}"`);
        o[k] = novo;
      } else if (v && typeof v === 'object') {
        walk(v, kp);
      }
    }
  })(j, '');

  total += n;
  console.log(`  ${String(n).padStart(4)}  ${file}`);
  if (APPLY && n) fs.writeFileSync(file, JSON.stringify(j, null, 2) + '\n');
}

console.log(`\n${APPLY ? 'APLICADO' : 'PREVIEW (use --apply)'}  —  ${total} string(s)\n`);
for (const a of amostras) console.log('    ' + a);
console.log('');
