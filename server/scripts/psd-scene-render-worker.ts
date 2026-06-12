/**
 * Worker de Scene Render — processo filho LIMPO (sem sharp/libvips carregado).
 *
 * Motivo da existência: no processo principal do servidor, sharp (libvips) e
 * node-canvas (Cairo/GLib) cohabitam e conflitam símbolos no Debian — qualquer
 * Image.setSource explode com "out of memory" espúrio. Isolar o render num
 * filho que só carrega node-canvas elimina o clash por construção (mesmo
 * padrão do psd-render-worker-agpsd, mas ordens de magnitude mais leve:
 * compose de scene ≈ 50-150MB vs GBs do PSD).
 *
 * Uso: bun psd-scene-render-worker.ts <job.json>
 * job.json: {
 *   docPath: string,                       // SceneDoc serializado
 *   assets: { [ref]: filePath },           // camadas PNG
 *   artByFace: { [faceKey]: filePath },    // artes por face
 *   defaultArtPath?: string,               // arte default (todas as faces)
 *   previewMaxPx?: number,                 // >0 = JPEG preview reduzido
 *   outputPath: string
 * }
 * stdout (última linha): { success, sizeBytes, width, height } | { error }
 */
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

async function main() {
  const jobPath = process.argv[2];
  if (!jobPath) throw new Error('uso: psd-scene-render-worker.ts <job.json>');
  const job = JSON.parse(readFileSync(resolve(jobPath), 'utf8'));

  const { createNodeAdapter } = await import('@visant/psd-engine/adapters/node');
  const { renderScene } = await import('@visant/psd-engine/scene');
  const adapter = await createNodeAdapter();

  const doc = JSON.parse(readFileSync(resolve(job.docPath), 'utf8'));

  const loadFile = async (p: string) => {
    const buf = readFileSync(resolve(p));
    if (
      buf.length > 12 &&
      buf.toString('ascii', 0, 4) === 'RIFF' &&
      buf.toString('ascii', 8, 12) === 'WEBP'
    ) {
      throw new Error(
        `asset WebP (pré-migração) — rode server/scripts/migrate-scene-assets-png.ts`
      );
    }
    return adapter.loadImage(buf);
  };

  const assets: Record<string, any> = {};
  for (const [ref, p] of Object.entries(job.assets as Record<string, string>)) {
    assets[ref] = await loadFile(p);
  }

  const artMap: Record<string, any> = {};
  for (const [faceKey, p] of Object.entries((job.artByFace || {}) as Record<string, string>)) {
    artMap[faceKey] = await loadFile(p);
  }
  const defaultArt = job.defaultArtPath ? await loadFile(job.defaultArtPath) : undefined;

  const canvas = renderScene(doc, assets, artMap, adapter.createCanvas, { defaultArt });

  const previewMaxPx = job.previewMaxPx || 0;
  let outCanvas = canvas;
  if (previewMaxPx > 0) {
    const scale = previewMaxPx / Math.max(doc.width, doc.height);
    if (scale < 1) {
      outCanvas = adapter.createCanvas(
        Math.round(doc.width * scale),
        Math.round(doc.height * scale)
      );
      outCanvas.getContext('2d').drawImage(canvas, 0, 0, outCanvas.width, outCanvas.height);
    }
  }
  const isJpeg = previewMaxPx > 0;
  const outBuffer: Buffer = isJpeg
    ? adapter.toBuffer(outCanvas, 'image/jpeg', { quality: 0.8 })
    : adapter.toBuffer(outCanvas, 'image/png');

  writeFileSync(resolve(job.outputPath), outBuffer);
  console.log(
    JSON.stringify({
      success: true,
      sizeBytes: outBuffer.length,
      width: outCanvas.width,
      height: outCanvas.height,
    })
  );
}

main().catch((err) => {
  console.log(JSON.stringify({ error: err?.message || String(err) }));
  process.exit(1);
});
