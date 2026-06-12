# @visant/extrude3d

**SVG / text → extruded 3D geometry**, in pure [three.js](https://threejs.org). Parse an SVG (or opentype.js glyphs) into shapes, extrude them with bevel / curve / smoothness controls, smooth crease normals, project triplanar UVs, center + scale — then either hand the `BufferGeometry` to your renderer or serialize it to a binary glTF (`.glb`).

No React, no [@react-three](https://github.com/pmndrs/react-three-fiber). Just functions over three.js objects, so the same code runs in the browser and in plain Node.

It powers the Visant Labs Studio3D engine (the `useExtrudedGeometry` hook and `<ExtrudedSVG>` component are thin wrappers around this) and the server-side GLB export.

## Install

```bash
npm i @visant/extrude3d three
# optional — only if you use textToSvg():
npm i opentype.js
```

`three` is a peer dependency. `opentype.js` is an **optional** peer — this package never imports it; `textToSvg` takes any font object that structurally matches `OpenTypeFontLike`.

> The browser geometry path uses `three/examples/jsm` (`SVGLoader`, `BufferGeometryUtils`). The `./glb` path is DOM-free except that `SVGLoader` needs a `DOMParser` — in Node, install one (e.g. via `jsdom`) on `globalThis` before calling.

## Quick start

### Browser: SVG → BufferGeometry

```ts
import { buildExtrudedGeometry } from '@visant/extrude3d';
import * as THREE from 'three';

const result = buildExtrudedGeometry(svgString, {
  depth: 2,        // extrusion depth knob
  smoothness: 0.5, // 0–1 → bevel segments + curve subdivisions
  bevelEnabled: true,
});

if (result) {
  const mesh = new THREE.Mesh(
    result.geometry,
    new THREE.MeshStandardMaterial({ color: '#c0c0c0' })
  );
  // center + fit to a 4-unit box, matching the Studio3D engine:
  mesh.position.set(-result.center.x, -result.center.y, -result.center.z);
  mesh.scale.setScalar(result.baseScale);

  // you own the geometry — dispose when done:
  // result.geometry.dispose();
}
```

### Node: SVG → GLB buffer

```ts
import { svgToGlb } from '@visant/extrude3d/glb';
import { JSDOM } from 'jsdom';
import { writeFile } from 'node:fs/promises';

// SVGLoader needs a DOMParser in Node:
globalThis.DOMParser = new JSDOM('').window.DOMParser;

const { glb } = svgToGlb(svgString, {
  depth: 0.9,
  smoothness: 0.5,
  color: '#c0c0c0',
  metalness: 0.6,
  roughness: 0.3,
});

await writeFile('logo.glb', glb); // glb is a Uint8Array (glTF magic header)
```

### Text → SVG → geometry

```ts
import * as opentype from 'opentype.js';
import { textToSvg, buildExtrudedGeometry } from '@visant/extrude3d';

const font = opentype.parse(fontArrayBuffer);
const svg = textToSvg('Visant', font);      // centered 200×200 SVG of glyph paths
const result = buildExtrudedGeometry(svg, { depth: 2, smoothness: 0.6 });
```

### Material presets

```ts
import { getSimpleMaterialProps, materialPresets } from '@visant/extrude3d/materials';

// flat prop bag for a <meshPhysicalMaterial>:
const props = getSimpleMaterialProps('chrome', '#ff0066');
// → { color, metalness, roughness, clearcoat, transmission, ior, ... }
```

## Exports

| Entry | Purpose |
| --- | --- |
| `.` | everything below, flat |
| `./materials` | PBR preset library (`materialPresets`, `MATERIAL_LIB`, `getSimpleMaterialProps`, `resolveMaterial`) |
| `./fonts` | `textToSvg(text, font)` — opentype glyphs → centered SVG |
| `./glb` | `svgToGlb(svg, opts)` — dependency-free binary glTF serializer |

### Geometry API

| Export | Signature |
| --- | --- |
| `buildExtrudedGeometry` | `(svg \| Shape[], opts) => { geometry, center, baseScale, shapeCount } \| null` |
| `parseShapesFromSVG` | `(svg) => THREE.Shape[]` — SVGLoader fills + tessellated strokes, drops the viewBox rect |
| `buildExtrudeSettings` | `(maxFlatDim, shapeCount, opts) => ExtrudeSettings` — the engine's depth/bevel/segment math |
| `measureFlatMaxDim` | `(shapes) => number` — larger of flat width/height (≥ 1) |
| `smoothCreaseNormals` | `(geometry, creaseAngleRad) => BufferGeometry` — averages normals below the crease angle |
| `recomputeTriplanarUVs` | `(geometry, box3) => void` — box-projected UVs, in place |

## Options

`buildExtrudedGeometry(svg, opts)`:

| Option | Default | Meaning |
| --- | --- | --- |
| `depth` | — | extrusion depth knob (scaled by flat bounds) |
| `smoothness` | — | 0–1 → bevel segments (`4 + s·8`) + curve subdivisions (`32 + s·64`) |
| `bevelEnabled` | `true` | |
| `bevelThickness` / `bevelSize` | `0.5` | scaled by `min(maxFlatDim·0.05, 1)`, clamped to half the depth |
| `vertexBudget` | `600000` | total vertex budget; segment counts shrink to fit |
| `creaseAngle` | `Math.PI/6` | crease-smoothing threshold; `null` → plain `computeVertexNormals` |

## License

MIT
