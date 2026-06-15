# @visant/logo-trace

Raster → **SVG** vectorization tuned for logos. [Potrace](https://www.npmjs.com/package/potrace) under the hood, wrapped with the bits that make a logo trace cleanly:

- **Otsu auto-threshold** — picks the black/white cutoff per image instead of a fixed 128.
- **Auto-invert** — light-on-light art (e.g. a gray wordmark on white) is inverted automatically before tracing, then inverted-retried if the first pass comes back empty.
- **Calibrated presets** — `logo`, `lettering`, `lineArt`, `stamp`.
- **Sanitize + optimize** — output is run through DOMPurify and a numeric/editor-cruft minifier, so you get a small, safe SVG string.

It powers the Visant Labs PNG→SVG trace endpoint and the Studio 3D GLB export (image → traced SVG → extruded mesh).

## Install

```bash
npm i @visant/logo-trace
# node-first peers (the server already has these):
npm i sharp jsdom dompurify
```

`potrace` is a direct dependency. `sharp` (Otsu grayscale + invert), `jsdom` and `dompurify` (the sanitize/optimize pass) are **optional peer dependencies**, imported lazily. Without `sharp`, `threshold: 'auto'` degrades to a fixed 128; the sanitize pass requires `jsdom` + `dompurify`.

## Usage

```ts
import { trace } from '@visant/logo-trace';
import { readFile } from 'node:fs/promises';

const png = await readFile('logo.png');

// Named preset:
const svg = await trace(png, { preset: 'logo' });
// → '<svg ...><path d="..."/></svg>'

// Or explicit options (override any preset value):
const svg2 = await trace(png, {
  preset: 'lettering',
  threshold: 'auto', // Otsu + auto-invert
  turdSize: 2, // drop speckles < 2px²
  optTolerance: 0.2, // curve smoothing
  alphaMax: 0.8, // corner roundness
  color: '#111111',
});
```

`trace` is an alias of `tracePipeline` (trace → sanitize → optimize). Use `traceImage` if you want the raw potrace output without the cleanup pass.

## Exports

| Entry        | Purpose                                                      |
| ------------ | ------------------------------------------------------------ |
| `.`          | everything below, flat                                       |
| `./presets`  | `TRACE_PRESETS`, `resolveTraceOptions`                       |
| `./sanitize` | `parseBase64Image`, `sanitizeSvg`, `optimizeSvg`, `cleanSvg` |

### API

| Export                          | Signature                                                               |
| ------------------------------- | ----------------------------------------------------------------------- |
| `trace` / `tracePipeline`       | `(buffer, opts?) => Promise<string>` — full pipeline                    |
| `traceImage`                    | `(buffer, opts?) => Promise<string>` — raw potrace SVG, no cleanup      |
| `cleanSvgPipeline` / `cleanSvg` | `(rawSvg) => Promise<string>` — sanitize + optimize an existing SVG     |
| `parseBase64Image`              | `(dataUri) => Buffer \| null` — parse a `data:image/...;base64,...` URI |
| `TRACE_PRESETS`                 | calibrated parameter sets per preset                                    |
| `resolveTraceOptions`           | `(opts) => TraceOptions` — merge a preset under explicit options        |

## Presets

| Preset      | turdSize | optTolerance | threshold | alphaMax |
| ----------- | -------- | ------------ | --------- | -------- |
| `logo`      | 3        | 0.3          | auto      | 0.8      |
| `lettering` | 1        | 0.15         | auto      | 0.5      |
| `lineArt`   | 0        | 0.1          | 128       | 1.0      |
| `stamp`     | 5        | 0.5          | auto      | 0.8      |

## From a base64 data URI

```ts
import { parseBase64Image, trace } from '@visant/logo-trace';

const buffer = parseBase64Image(dataUri); // null on a non-image / prefix-less string
if (!buffer) throw new Error('Invalid base64 image format');
const svg = await trace(buffer, { preset: 'logo' });
```

## License

MIT
