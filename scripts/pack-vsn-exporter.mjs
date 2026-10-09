// Empacota o VSN Exporter pra download: public/vsn-exporter/ + os scripts que o menu chama
// (que moram em scripts/ do repo) -> public/vsn-exporter.zip. Roda no prebuild.
// Fora do zip: figma2deck.ps1, que depende da skill visant-demanda.
import JSZip from 'jszip';
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const raiz = 'public/vsn-exporter';
const extras = ['compress-pdf.ps1', 'optimize-print-pdf.ps1', 'compress-jpg.ps1', 'arte_final.py'];
const zip = new JSZip();

const anda = (dir) => {
  for (const nome of readdirSync(dir)) {
    const p = join(dir, nome);
    if (nome.includes('.local.')) continue; // .reg com caminho da máquina do dono
    if (statSync(p).isDirectory()) anda(p);
    else zip.file(join('vsn-exporter', relative(raiz, p)).split(sep).join('/'), readFileSync(p));
  }
};
anda(raiz);
for (const f of extras) {
  // Faltar um script não pode derrubar o deploy do site: avisa e o menu do exporter diz que não achou.
  if (existsSync(join('scripts', f))) zip.file(`vsn-exporter/scripts/${f}`, readFileSync(join('scripts', f)));
  else console.warn(`vsn-exporter.zip: scripts/${f} não encontrado, fica de fora`);
}

const buf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
writeFileSync('public/vsn-exporter.zip', buf);
console.log(`vsn-exporter.zip: ${Object.keys(zip.files).length} entradas, ${(buf.length / 1024).toFixed(0)} KB`);
