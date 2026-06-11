/**
 * Worker de render PSD via ag-psd + node-canvas (sem Chromium/Photopea).
 * Engine portado do mockup-store — compositor com ordem bottom-up, máscaras
 * raster, clipping e smart objects vinculados (mesmo placedLayer.id).
 *
 * Uso: bun server/scripts/psd-render-worker-agpsd.ts --job <job.json>
 *
 * job.json:
 * {
 *   "psdPath": "/tmp/.../input.psd",
 *   "outputPath": "/tmp/.../output.png",
 *   "replacements": [{ "smartObject": "Design Here", "artPath": "/tmp/art-0.png" }],
 *   "hideLayers": ["Layer X"],          // opcional
 *   "previewMaxPx": 1400                 // opcional — JPEG menor em vez de PNG
 * }
 * Replacement SEM smartObject (ou "*") aplica a arte em TODAS as faces editáveis.
 *
 * Saída (stdout, última linha): JSON { success, sizeBytes, durationMs, replaced, width, height }
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import {
  flattenLayers,
  replaceLinkedSmartObjects,
  composePsd,
} from '../lib/psd-compose.js';
import { computeFaces, type FaceSo } from '../lib/psd-faces.js';
import { SO_TARGET, BRAND_HIDE } from '../lib/psd-render-constants.js';

function getArg(name: string, fallback = ''): string {
  const idx = process.argv.indexOf(`--${name}`);
  return idx !== -1 && process.argv[idx + 1] ? process.argv[idx + 1] : fallback;
}

interface JobReplacement {
  smartObject?: string;
  artPath: string;
}

interface Job {
  psdPath: string;
  outputPath: string;
  replacements: JobReplacement[];
  hideLayers?: string[];
  previewMaxPx?: number;
}

const jobPath = getArg('job');
if (!jobPath) {
  console.error(JSON.stringify({ error: 'Missing --job <job.json>' }));
  process.exit(1);
}

const start = Date.now();

try {
  const job = JSON.parse(readFileSync(resolve(jobPath), 'utf-8')) as Job;
  if (!job.psdPath || !job.outputPath || !job.replacements?.length) {
    throw new Error('job.json precisa de psdPath, outputPath e replacements[]');
  }

  const agPsd = await import('ag-psd');
  const { createCanvas, loadImage } = await import('canvas');
  agPsd.initializeCanvas(createCanvas as never);

  const psdBuffer = readFileSync(resolve(job.psdPath));
  const psd = agPsd.readPsd(new Uint8Array(psdBuffer).buffer as ArrayBuffer, {
    skipThumbnail: true,
  });

  const allLayers = flattenLayers(psd.children || []);
  const smartObjects = allLayers.filter((l: any) => l.placedLayer);

  // Faces editáveis (pra replacements sem smartObject explícito).
  // Watermarks/instruções (BRAND_HIDE) nunca são faces — mesmo filtro do scan.
  const faceSos: FaceSo[] = smartObjects
    .filter((l: any) => !BRAND_HIDE.test(l.name || ''))
    .map((l: any) => ({
      name: l.name || 'unnamed',
      path: l.path,
      innerWidth: l.placedLayer.width || (l.right - l.left),
      innerHeight: l.placedLayer.height || (l.bottom - l.top),
      hidden: !!l.hidden,
      linkId: l.placedLayer.id || undefined,
    }));
  const faces = computeFaces(faceSos);

  const byArea = (a: any, b: any) =>
    (b.right - b.left) * (b.bottom - b.top) > (a.right - a.left) * (a.bottom - a.top) ? b : a;
  const findTarget = (soName: string) => {
    const patternMatches = smartObjects.filter((l: any) => SO_TARGET.test(l.name || ''));
    return (
      allLayers.find((l: any) => l.path === soName) ||
      allLayers.find((l: any) => l.name === soName) ||
      allLayers.find((l: any) => l.path?.toLowerCase().includes(soName.toLowerCase())) ||
      allLayers.find((l: any) => l.name?.toLowerCase().includes(soName.toLowerCase())) ||
      (smartObjects.length === 1 ? smartObjects[0] : null) ||
      (patternMatches.length ? patternMatches.reduce(byArea) : null) ||
      (smartObjects.length ? smartObjects.reduce(byArea) : null)
    );
  };

  // Replacement sem smartObject → expande pra todas as faces
  const slots: Array<{ smartObject: string; artPath: string }> = [];
  for (const r of job.replacements) {
    if (!r.smartObject || r.smartObject === '*') {
      for (const f of faces) slots.push({ smartObject: f.smartObject, artPath: r.artPath });
    } else {
      slots.push({ smartObject: r.smartObject, artPath: r.artPath });
    }
  }

  const replacedNames = new Set<string>();
  const artCache = new Map<string, Buffer>();
  for (const slot of slots) {
    let artBuffer = artCache.get(slot.artPath);
    if (!artBuffer) {
      artBuffer = readFileSync(resolve(slot.artPath));
      artCache.set(slot.artPath, artBuffer);
    }

    const target = findTarget(slot.smartObject);
    if (!target) continue;
    if (!target.placedLayer && replacedNames.has(target.name)) continue; // já trocado

    const artImg = await loadImage(artBuffer);
    const replaced = replaceLinkedSmartObjects(allLayers, target, artImg, createCanvas as never);
    for (const r of replaced) replacedNames.add(r.name);
  }

  if (replacedNames.size === 0) {
    throw new Error(
      `Nenhum smart object encontrado. Disponíveis: ${smartObjects.map((l: any) => l.name).join(', ')}`
    );
  }

  // Esconde watermarks/instruções + hideLayers explícitos (nunca o que acabamos de trocar)
  const allHide = new Set(job.hideLayers || []);
  for (const layer of allLayers) {
    if (BRAND_HIDE.test(layer.name || '')) allHide.add(layer.name);
  }
  for (const name of replacedNames) allHide.delete(name);
  for (const hideName of allHide) {
    const layer = allLayers.find((l: any) => l.path === hideName || l.name === hideName);
    if (layer?.__original) layer.__original.hidden = true;
  }

  // Composita e exporta
  const fullCanvas = composePsd(psd, createCanvas as never);
  let outCanvas = fullCanvas;
  const previewMaxPx = job.previewMaxPx || 0;
  if (previewMaxPx > 0) {
    const scale = previewMaxPx / Math.max(psd.width, psd.height);
    if (scale < 1) {
      outCanvas = createCanvas(Math.round(psd.width * scale), Math.round(psd.height * scale));
      outCanvas.getContext('2d').drawImage(fullCanvas, 0, 0, outCanvas.width, outCanvas.height);
    }
  }

  const outBuffer = previewMaxPx
    ? outCanvas.toBuffer('image/jpeg', { quality: 0.8 })
    : outCanvas.toBuffer('image/png');

  const outDir = dirname(resolve(job.outputPath));
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  writeFileSync(resolve(job.outputPath), outBuffer);

  console.log(
    JSON.stringify({
      success: true,
      sizeBytes: outBuffer.length,
      durationMs: Date.now() - start,
      replaced: [...replacedNames],
      width: outCanvas.width,
      height: outCanvas.height,
    })
  );
} catch (err: any) {
  console.error(JSON.stringify({ error: err.message || String(err) }));
  process.exit(1);
}
