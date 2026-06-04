import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';

let HeadlessPhotopea: any;
const searchPaths = [
  resolve(process.cwd(), 'node_modules/@printmadehq/mockup-generator/src/photopea-headless/index.js'),
];
for (const p of searchPaths) {
  try {
    const mod = await import(p);
    HeadlessPhotopea = mod.default;
    break;
  } catch {}
}
if (!HeadlessPhotopea) {
  console.error(JSON.stringify({ error: 'HeadlessPhotopea not found. Install @printmadehq/mockup-generator' }));
  process.exit(1);
}

function getArg(name: string, fallback = ''): string {
  const idx = process.argv.indexOf(`--${name}`);
  return idx !== -1 && process.argv[idx + 1] ? process.argv[idx + 1] : fallback;
}

const psdPath = getArg('psd');
const artPath = getArg('art');
const soName = getArg('smart-object');
const hideLayers = getArg('hide').split(',').map(s => s.trim()).filter(Boolean);
const outputPath = getArg('output', '/tmp/psd-render-output.png');

if (!psdPath || !artPath || !soName) {
  console.error(JSON.stringify({ error: 'Missing required args: --psd, --art, --smart-object' }));
  process.exit(1);
}

const outputDir = dirname(outputPath);
if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true });

try {
  const psdBuffer = readFileSync(resolve(psdPath));
  const artBuffer = readFileSync(resolve(artPath));

  const hp = await HeadlessPhotopea.create({
    showBrowser: false,
    logFunction: () => {},
    maxWaitTime: 180000,
  });

  await hp.loadAsset(psdBuffer);
  await new Promise(r => setTimeout(r, 2000));

  const hideChecks = hideLayers.map(name =>
    `if (doc.layers[i].name == ${JSON.stringify(name)}) doc.layers[i].visible = false;`
  ).join('\n    ');

  await hp.runScript(`
    var doc = app.activeDocument;
    for (var i = 0; i < doc.layers.length; i++) {
      ${hideChecks}
      if (doc.layers[i].name == ${JSON.stringify(soName)}) doc.activeLayer = doc.layers[i];
    }
    executeAction(stringIDToTypeID("placedLayerEditContents"), undefined, DialogModes.NO);
  `);
  await new Promise(r => setTimeout(r, 3000));

  await hp.loadAsset(artBuffer);
  await new Promise(r => setTimeout(r, 1500));
  await hp.runScript(`app.activeDocument.selection.selectAll();`);
  await hp.runScript(`app.activeDocument.selection.copy(true);`);
  await hp.runScript(`app.activeDocument.close(SaveOptions.DONOTSAVECHANGES);`);
  await new Promise(r => setTimeout(r, 1000));

  await hp.runScript(`app.activeDocument.selection.selectAll();`);
  await hp.runScript(`app.activeDocument.selection.clear();`);
  await hp.runScript(`app.activeDocument.paste();`);
  await new Promise(r => setTimeout(r, 1000));
  await hp.runScript(`app.activeDocument.flatten();`);

  await hp.runScript(`app.activeDocument.save();`);
  await new Promise(r => setTimeout(r, 2000));
  await hp.runScript(`app.activeDocument.close(SaveOptions.DONOTSAVECHANGES);`);
  await new Promise(r => setTimeout(r, 4000));

  const pngBuffer = await hp.exportImage('png');
  writeFileSync(resolve(outputPath), pngBuffer);

  await hp.destroy();

  console.log(JSON.stringify({
    success: true,
    outputPath: resolve(outputPath),
    sizeBytes: pngBuffer.length,
  }));
} catch (err: any) {
  console.error(JSON.stringify({ error: err.message || String(err) }));
  process.exit(1);
}
