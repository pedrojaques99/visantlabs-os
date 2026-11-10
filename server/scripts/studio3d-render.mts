#!/usr/bin/env -S npx tsx
/**
 * Studio3D headless render — CLI.
 *
 *   npx tsx server/scripts/studio3d-render.mts <spec.json> [out]       render one spec
 *   npx tsx server/scripts/studio3d-render.mts --presets                list looks/moves/fonts
 *
 * spec.json may set "svgFile" (path, relative to the spec) instead of "svg",
 * and "out" instead of the 2nd arg. A JSON array renders several in sequence.
 * Docs: docs/studio3d-render.md
 */
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { renderStudio3D, listRenderPresets } from '../services/studio3dRender/renderer.js';

const [arg, outArg] = process.argv.slice(2);
if (!arg || arg === '-h' || arg === '--help') {
  console.log('usage: npx tsx server/scripts/studio3d-render.mts <spec.json> [out] | --presets');
  process.exit(arg ? 0 : 1);
}
if (arg === '--presets') {
  console.log(JSON.stringify(await listRenderPresets(), null, 2));
  process.exit(0);
}

const specPath = resolve(arg);
const raw = JSON.parse(await readFile(specPath, 'utf8'));
const specs: any[] = Array.isArray(raw) ? raw : [raw];
for (const s of specs) {
  if (s.svgFile) s.svg = await readFile(resolve(dirname(specPath), s.svgFile), 'utf8');
  const out = resolve(dirname(specPath), outArg && specs.length === 1 ? outArg : s.out);
  if (!s.out && !outArg) throw new Error('Set "out" in the spec or pass it as 2nd arg.');
  const { svgFile: _f, out: _o, ...spec } = s;
  let last = 0;
  const r = await renderStudio3D(spec, out, (d, t) => {
    const pct = Math.floor((d / t) * 10);
    if (pct > last) process.stdout.write(`\r${out}  ${d}/${t}`), (last = pct);
  });
  console.log(`\n✓ ${r.path}  ${r.width}x${r.height} ${r.frames}f @${r.fps}  ${(r.ms / 1000).toFixed(1)}s`);
}
process.exit(0);
