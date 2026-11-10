# Studio3D headless render

Renders a logo (SVG) or a word (text + font) from the 3D Studio as **mp4 / mov (alpha) / webm (alpha) / png / png sequence**. Every frame depends only on its index, so two runs of the same spec give identical files and no frames are dropped. This differs from the app's own export, which records in real time.

It reuses what the app already has:

| Piece | Source |
| --- | --- |
| Geometry (SVG → extruded mesh), materials | `@visant/extrude3d`, the code the engine uses |
| Look: defaults, scene presets, lighting presets, HDRIs, fonts | `useStudio3DStore` / `SCENE_PRESETS` / `LIGHTING_PRESETS` / `ENVIRONMENT_PRESETS` / `FONTS`. The renderer calls `applyScenePreset`, `setMaterial` and `applyConfig`, the same calls the app makes |
| Browser + encode | `puppeteer-core` + Chromium (launched the same way as `presetRenderer.ts`) + `ffmpeg` |

The only new part is the camera move, duration, size and format.

Code: `server/services/studio3dRender/` (`spec.ts` schema, `page.ts` browser side, `renderer.ts` Node side).

## Run

```bash
# one spec or an array of specs ("svgFile" and "out" are relative to the spec file)
npx tsx server/scripts/studio3d-render.mts docs/studio3d-render/visant-samples.json
npx tsx server/scripts/studio3d-render.mts my-spec.json out/logo.mp4

# list scene presets, lighting, environments, materials, fonts, moves
npx tsx server/scripts/studio3d-render.mts --presets
```

Chromium is found in this order: `PUPPETEER_EXECUTABLE_PATH`, then local Chrome, then Playwright's Chromium. `ffmpeg` comes from PATH, or from `FFMPEG_PATH` if set. On a machine with a GPU, 1080p renders at about 0.1 s per frame. On a server without a GPU, Chromium falls back to SwiftShader, which is slower. Extra Chromium flags can be passed in `STUDIO3D_GL_ARGS`.

### API and MCP

- `POST /api/studio3d/render` (authenticated). The body is a spec, plus optionally `sceneId` (render a saved scene; fields in the body override it), `svgData`, or `image` (base64 PNG, auto-traced). It returns `{ url, frames, fps, width, height, bytes, ms }`. The file is uploaded to R2. Formats: mp4, webm, png. Limits: 4 requests per minute per user and one render at a time per process.
- `GET /api/studio3d/render/presets` lists the names.
- MCP tool **`studio3d-render`** (free) wraps the endpoint. It sits alongside `studio3d-create-scene` / `studio3d-get-scene` and the other studio3d tools.

## Spec

```jsonc
{
  "svg": "<svg …>",               // or "svgFile" (CLI only) — or:
  "text": "VISANT", "font": "Archivo Black",   // a 3D Studio font name, a .ttf/.otf URL or a file path
  "preset": "Liquid Metal",       // app scene preset (optional)
  "lighting": "Rim Light",        // app lighting preset (optional)
  "config": {                     // same keys as studio3d-create-scene / the store; wins over presets
    "material": "chrome", "color": "#ffffff", "depth": 2.2, "smoothness": 0.6,
    "bevelEnabled": true, "environment": "city", "envMapIntensity": 1.4,
    "toneMapping": "ACES", "toneMappingExposure": 1.2, "hdriRotation": 0
  },
  "background": "#000000",        // or "transparent" (use mov / webm / png / png-seq to keep alpha)
  "camera": {
    "move": "turntable",          // turntable | orbit | push | pull | sweep | static
    "distance": 7,                // the logo fits a 4-unit box
    "elevation": 8, "azimuth": 0, // degrees
    "angle": 360,                 // degrees travelled (defaults: turntable/orbit 360, sweep 50, push/pull 16 of drift)
    "from": 12, "to": 6,          // push/pull distances
    "elevationTo": 20,            // sweep: elevation travelled
    "spin": 0,                    // extra object rotation (deg) across the clip
    "easing": "easeInOut",        // linear | easeIn | easeOut | easeInOut (loops default to linear)
    "fov": 50, "targetY": 0
  },
  "width": 1920, "height": 1080, "fps": 30, "duration": 4,
  "format": "mp4",                // mp4 (h264) | mov (ProRes 4444 + alpha) | webm (VP9 + alpha) | png | png-seq
  "supersample": 2,               // render at 2× and downscale with lanczos (cleaner chrome edges)
  "stillAt": 0,                   // png: clip position 0–1
  "crf": 16
}
```

Moves: **turntable** turns the object while the camera holds still. It is linear, so it loops seamlessly. **orbit** moves the camera around the object. **push** and **pull** dolly between `from` and `to` with a small drift. **sweep** pans across in azimuth while the elevation changes. **static** holds one framing. Every move can add an object `spin`.

Materials include chrome, liquidChrome, glass, frostedGlass, gold, holographic, carPaint and others; the full list comes from `--presets`. Scene presets: Product Shot, Hero Banner, Social Media, Dark Studio, Neon, Clay Render, Chrome Badge, Liquid Metal, Candy, Y2K. Lighting presets: 3-Point Studio, Rim Light, Dramatic, Flat, Cinematic.

## Not covered (yet)

- **Post effects:** bloom, DOF, vignette, shader overlays, fresnel tint, texture and normal maps.
- **Floor:** ground plane and contact shadows.
- **Backgrounds:** gradient and image backgrounds. Only a solid color or transparent is supported.
- **Model types:** coin, badge and stamp shape types, chains, imported GLB models, physics.
- **Glass:** glass on an empty background has nothing behind it to refract, so it reads as frosted white. The app behaves the same way. Use a lit environment and a colored or HDRI background.
