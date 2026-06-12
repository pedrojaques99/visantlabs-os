/**
 * Preprocessador de Scene Packages — extrai a geometria + camadas flatten de um
 * PSD UMA vez, pra que o render por uso vire um compose trivial (warp + blend) em
 * qualquer canvas (browser do user, CLI local, ou server fallback).
 *
 * Engine: @visant/psd-engine/scene (SSoT — zero reimplementação).
 *
 * Uso:
 *   # Local, escreve scene.json + WebPs num diretório:
 *   npx tsx server/scripts/psd-scene-extract.ts --psd ./templates/Flag.psd --out ./out/flag
 *
 *   # Drive + upload pro Spaces (privado) + registro no Mongo (catálogo do agente):
 *   npx tsx server/scripts/psd-scene-extract.ts --psd "Uns - Flag Mockup.psd" --upload
 *
 * Flags:
 *   --psd <fileName|path>   nome no Google Drive OU caminho local pro .psd  (obrigatório)
 *   --out <dir>            diretório de saída local (default ./scene-out/<hash>)
 *   --upload              sobe os assets (privados) pro Spaces e grava no Mongo
 *
 * NÃO rode contra produção sem intenção — --upload escreve no Spaces/Mongo reais.
 */
import { mkdirSync, writeFileSync } from 'fs';
import path from 'path';
import { basename } from 'path';
import {
  resolvePsdPath,
  extractSceneFromPsd,
  uploadSceneAssets,
  saveSceneRecord,
} from '../services/sceneStore.js';

function getArg(name: string, fallback = ''): string {
  const idx = process.argv.indexOf(`--${name}`);
  return idx !== -1 && process.argv[idx + 1] ? process.argv[idx + 1] : fallback;
}
function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

async function main() {
  const psdArg = getArg('psd');
  if (!psdArg) {
    console.error('Faltou --psd <fileName|path>');
    process.exit(1);
  }
  const upload = hasFlag('upload');

  // Nome canônico do PSD (chave do registro) = basename, mesmo quando passamos path.
  const psdFileName = basename(psdArg);

  console.log(`[scene-extract] resolvendo "${psdArg}"...`);
  const psdPath = await resolvePsdPath(psdArg, 'all');

  console.log(`[scene-extract] extraindo scene de ${psdPath}...`);
  const { record, uploads } = await extractSceneFromPsd(psdPath, psdFileName);

  console.log(
    `[scene-extract] ✔ ${record.faces.length} face(s), ${record.files.length} camada(s), ` +
      `${(record.bytes / 1e6).toFixed(2)}MB, ${record.warnings.length} warning(s)`
  );
  if (record.warnings.length) {
    for (const w of record.warnings) console.log(`  ⚠ ${w}`);
  }

  if (upload) {
    console.log(`[scene-extract] subindo ${uploads.length} asset(s) pro Spaces (${record.basePath})...`);
    await uploadSceneAssets(uploads);

    const { connectToMongoDB, getDb } = await import('../db/mongodb.js');
    await connectToMongoDB();
    const db = getDb();
    await saveSceneRecord(db, record);
    console.log(`[scene-extract] ✔ registro gravado no Mongo (psd_scenes) pra "${psdFileName}"`);
    process.exit(0);
  }

  // Saída local: scene.json + cada camada como arquivo.
  const outDir = getArg('out') || path.resolve(process.cwd(), 'scene-out', record.hash);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(path.join(outDir, 'scene.json'), JSON.stringify(record.doc, null, 2));
  for (const u of uploads) {
    const ext = u.contentType.includes('webp') ? 'webp' : 'png';
    writeFileSync(path.join(outDir, `${u.ref}.${ext}`), u.buffer);
  }
  console.log(`[scene-extract] ✔ escrito em ${outDir}`);
}

main().catch((err) => {
  console.error('[scene-extract] erro:', err.message || err);
  process.exit(1);
});
