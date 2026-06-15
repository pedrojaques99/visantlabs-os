# @visant/psd-engine

Isomorphic PSD mockup compositor. Takes an [`ag-psd`](https://github.com/Agamnentzar/ag-psd) layer tree and composites it to a canvas — perspective warp, blend modes, raster masks, and linked smart objects — running identically on the server (node-canvas), in the browser (DOM canvas), or in a local CLI.

It powers the Visant Labs mockup render pipeline and the **Scene Package** format, which pre-processes a PSD once into compact geometry + flattened layer images so the per-art render is a trivial warp + blend on any canvas (no PSD shipped to the client, minimal RAM).

> The engine is a generic compositor. The value/secret is the PSD templates — which never ship inside this package.

## Install

```bash
npm i @visant/psd-engine
# server-side rendering also needs the optional peers:
npm i ag-psd canvas
```

`ag-psd` and `canvas` are **optional** peer dependencies. The engine core and `scene/render` never import them — you inject a canvas factory (`CreateCanvas`). Browser builds pull in nothing extra.

## Exports

| Entry                | Purpose                                                                                                                                        |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `.`                  | `composePsd`, `flattenLayers`, `replaceLinkedSmartObjects`, `perspectiveWarp`, `coverArtCanvas`, `BLEND_MAP`, `computeFaces`, constants, types |
| `./scene`            | `extractScene` (PSD tree → `SceneDoc` + layer canvases), `renderScene` (`SceneDoc` + art → canvas)                                             |
| `./adapters/node`    | `createNodeAdapter()` → `{ createCanvas, loadImage, toBuffer }`, `initializeAgPsdCanvas(agPsd)`                                                |
| `./adapters/browser` | `createCanvas`, `loadImage`, `toBlob`                                                                                                          |

## Server render (full PSD)

```ts
import { flattenLayers, replaceLinkedSmartObjects, composePsd } from '@visant/psd-engine';
import { createNodeAdapter, initializeAgPsdCanvas } from '@visant/psd-engine/adapters/node';
import * as agPsd from 'ag-psd';

const { createCanvas, loadImage, toBuffer } = await createNodeAdapter();
await initializeAgPsdCanvas(agPsd);

const psd = agPsd.readPsd(buffer, { skipThumbnail: true, skipCompositeImageData: true });
const allLayers = flattenLayers(psd.children);
const target = allLayers.find((l) => l.name === 'Design Here');
replaceLinkedSmartObjects(allLayers, target, await loadImage(artBuffer), createCanvas);
const out = toBuffer(composePsd(psd, createCanvas), 'image/png');
```

## Scene Package

```ts
import { extractScene, renderScene } from '@visant/psd-engine/scene';

// Once per PSD (server, node adapter):
const { doc, assets } = extractScene(psd, createCanvas);
// → upload `assets` (canvases) + persist `doc` (SceneDoc JSON)

// Per render (browser or node):
const out = renderScene(doc, loadedAssets, { [faceKey]: artImage }, createCanvas);
```

`doc.warnings` flags blend modes the Canvas-2D mapping can't reproduce 1:1 — a hint to fall back to the full server compose.

## License

MIT
