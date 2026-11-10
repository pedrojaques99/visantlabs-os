/**
 * Headless, deterministic Studio3D render: spec → mp4 / mov (alpha) / webm
 * (alpha) / png / png sequence.
 *
 *   1. Resolve the look through the app's own store (defaults, scene preset,
 *      lighting preset, config) — see spec.ts.
 *   2. Text → SVG in Node with opentype.js + @visant/extrude3d `textToSvg`
 *      (same path as the app's text mode).
 *   3. Bundle page.ts with esbuild, open it in Chromium (puppeteer-core, same
 *      launch pattern as presetRenderer/brandBookRenderer), render frame i as a
 *      pure function of i, pull PNGs out with toDataURL.
 *   4. Pipe PNGs to ffmpeg.
 *
 * Heavy deps (puppeteer-core, esbuild, the app store) load lazily so importing
 * this module never costs boot time on the API server.
 */
import { spawn } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  RenderSpecSchema,
  resolveCamera,
  type PageJob,
  type ParsedRenderSpec,
  type RenderSpec,
  type ResolvedScene,
} from './spec.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '../../..');
const CACHE_DIR = join(tmpdir(), 'visant-studio3d-render');

export interface RenderResult {
  /** Output file (or directory for png-seq). */
  path: string;
  format: ParsedRenderSpec['format'];
  width: number;
  height: number;
  frames: number;
  fps: number;
  ms: number;
}

// ─── look resolution (the app store is the source of truth) ─────────────────

async function loadStore() {
  // The store's `persist` wants localStorage; in Node give it a throwaway one.
  if (typeof (globalThis as any).localStorage === 'undefined') {
    const m = new Map<string, string>();
    (globalThis as any).localStorage = {
      getItem: (k: string) => m.get(k) ?? null,
      setItem: (k: string, v: string) => void m.set(k, String(v)),
      removeItem: (k: string) => void m.delete(k),
    };
  }
  return import('../../../src/stores/studio3dStore.js');
}

export async function listRenderPresets() {
  const { SCENE_PRESETS, LIGHTING_PRESETS, ENVIRONMENT_PRESETS, MATERIAL_PRESETS } =
    await loadStore();
  const { FONTS } = await import('../../../src/components/3d-studio/engine/useFont.js');
  const { CAMERA_MOVES, EASINGS, RENDER_FORMATS } = await import('./spec.js');
  return {
    scenePresets: SCENE_PRESETS,
    lightingPresets: Object.keys(LIGHTING_PRESETS),
    environments: ENVIRONMENT_PRESETS.map((e) => e.id),
    materials: MATERIAL_PRESETS.map((m) => m.id),
    fonts: FONTS.map((f) => f.name),
    cameraMoves: CAMERA_MOVES,
    easings: EASINGS,
    formats: RENDER_FORMATS,
  };
}

export async function resolveScene(spec: ParsedRenderSpec) {
  const { useStudio3DStore, SCENE_PRESETS, LIGHTING_PRESETS, ENVIRONMENT_PRESETS } =
    await loadStore();
  const st = useStudio3DStore.getState();
  st.resetScene();
  if (spec.preset) {
    if (!SCENE_PRESETS[spec.preset])
      throw new Error(
        `Unknown preset "${spec.preset}". Options: ${Object.keys(SCENE_PRESETS).join(', ')}`
      );
    st.applyScenePreset(spec.preset);
  }
  if (spec.lighting) {
    const l = LIGHTING_PRESETS[spec.lighting];
    if (!l)
      throw new Error(
        `Unknown lighting "${spec.lighting}". Options: ${Object.keys(LIGHTING_PRESETS).join(', ')}`
      );
    useStudio3DStore.setState(l.values as any);
  }
  const cfg = spec.config as Record<string, any>;
  // Picking a material in the app also loads its metalness/roughness/opacity.
  if (typeof cfg.material === 'string')
    useStudio3DStore.getState().setMaterial(cfg.material as any);
  useStudio3DStore.getState().applyConfig(cfg as any);

  const s = useStudio3DStore.getState() as any;
  const background =
    spec.background && spec.background !== 'transparent' ? spec.background : s.background;
  const scene: ResolvedScene = {
    material: s.material,
    color: s.color,
    metalness: s.metalness,
    roughness: s.roughness,
    opacity: s.opacity,
    depth: s.depth,
    smoothness: s.smoothness,
    bevelEnabled: s.bevelEnabled,
    bevelThickness: s.bevelThickness,
    bevelSize: s.bevelSize,
    objectScale: s.objectScale,
    background,
    environment: s.environment,
    envMapIntensity: s.envMapIntensity,
    hdriIntensity: s.hdriIntensity,
    hdriRotation: s.hdriRotation,
    toneMapping: s.toneMapping,
    toneMappingExposure: s.toneMappingExposure,
    lightIntensity: s.lightIntensity,
    lightPosition: s.lightPosition,
    fillLightIntensity: s.fillLightIntensity,
    fillLightPosition: s.fillLightPosition,
    bounceLightIntensity: s.bounceLightIntensity,
    bounceLightPosition: s.bounceLightPosition,
    pointLightIntensity: s.pointLightIntensity,
    pointLightPosition: s.pointLightPosition,
    ambientIntensity: s.ambientIntensity,
    fov: s.fov,
  };
  const hdriUrl: string | undefined =
    s.customHdriUrl || ENVIRONMENT_PRESETS.find((e) => e.id === s.environment)?.file;
  return { scene, hdriUrl, font: (spec.font ?? s.font) as string };
}

// ─── inputs ──────────────────────────────────────────────────────────────────

async function fetchCached(url: string): Promise<Buffer> {
  await mkdir(CACHE_DIR, { recursive: true });
  const file = join(CACHE_DIR, url.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-120));
  if (existsSync(file)) return readFile(file);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET ${url} → ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(file, buf);
  return buf;
}

async function textToSvgString(text: string, font: string): Promise<string> {
  let bytes: Buffer;
  if (/^https?:\/\//.test(font)) bytes = await fetchCached(font);
  else if (existsSync(font)) bytes = await readFile(font);
  else {
    const { FONTS } = await import('../../../src/components/3d-studio/engine/useFont.js');
    const def = FONTS.find((f) => f.name.toLowerCase() === font.toLowerCase());
    if (!def)
      throw new Error(`Unknown font "${font}". Use a Studio3D font name, a URL or a file path.`);
    bytes = await fetchCached(def.url);
  }
  const opentype = await import('opentype.js');
  const parse = (opentype as any).parse ?? (opentype as any).default.parse;
  const f = parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  const { textToSvg } = await import('../../../packages/extrude3d/src/fonts.js');
  return textToSvg(text, f);
}

// ─── browser ─────────────────────────────────────────────────────────────────

let bundleCache: string | null = null;
async function pageBundle(): Promise<string> {
  if (bundleCache) return bundleCache;
  const esbuild = await import('esbuild');
  const out = await esbuild.build({
    entryPoints: [join(HERE, 'page.ts')],
    bundle: true,
    write: false,
    format: 'iife',
    platform: 'browser',
    target: 'es2022',
    minify: true,
    logLevel: 'silent',
    absWorkingDir: REPO,
  });
  bundleCache = out.outputFiles[0].text;
  return bundleCache;
}

/** PUPPETEER_EXECUTABLE_PATH → local Chrome → Playwright's Chromium. */
function findChromium(): string {
  const env = process.env.PUPPETEER_EXECUTABLE_PATH;
  if (env && existsSync(env)) return env;
  const candidates = [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/chromium',
    '/usr/bin/google-chrome',
  ];
  for (const c of candidates) if (existsSync(c)) return c;
  const pw = process.env.LOCALAPPDATA
    ? join(process.env.LOCALAPPDATA, 'ms-playwright')
    : join(process.env.HOME || '', '.cache/ms-playwright');
  if (existsSync(pw)) {
    for (const d of readdirSync(pw)
      .filter((n) => /^chromium-\d+$/.test(n))
      .sort()
      .reverse()) {
      for (const sub of [
        'chrome-win64/chrome.exe',
        'chrome-win/chrome.exe',
        'chrome-linux/chrome',
      ]) {
        const p = join(pw, d, sub);
        if (existsSync(p)) return p;
      }
    }
  }
  throw new Error('No Chromium found. Set PUPPETEER_EXECUTABLE_PATH.');
}

function ffmpegArgs(spec: ParsedRenderSpec, out: string): string[] {
  const scale =
    spec.supersample > 1 ? ['-vf', `scale=${spec.width}:${spec.height}:flags=lanczos`] : [];
  const input = [
    '-y',
    '-loglevel',
    'error',
    '-f',
    'image2pipe',
    '-framerate',
    String(spec.fps),
    '-c:v',
    'png',
    '-i',
    '-',
  ];
  switch (spec.format) {
    case 'mp4':
      return [
        ...input,
        ...scale,
        '-c:v',
        'libx264',
        '-preset',
        'slow',
        '-crf',
        String(spec.crf),
        '-pix_fmt',
        'yuv420p',
        '-movflags',
        '+faststart',
        out,
      ];
    case 'mov': // ProRes 4444 keeps alpha
      return [
        ...input,
        ...scale,
        '-c:v',
        'prores_ks',
        '-profile:v',
        '4444',
        '-pix_fmt',
        'yuva444p10le',
        '-vendor',
        'apl0',
        out,
      ];
    case 'webm': // VP9 with alpha
      return [
        ...input,
        ...scale,
        '-c:v',
        'libvpx-vp9',
        '-pix_fmt',
        'yuva420p',
        '-b:v',
        '0',
        '-crf',
        '18',
        '-row-mt',
        '1',
        out,
      ];
    case 'png':
      return [...input, ...scale, '-frames:v', '1', out];
    case 'png-seq':
      return [...input, ...scale, '-start_number', '0', join(out, 'frame_%04d.png')];
  }
}

export async function renderStudio3D(
  input: RenderSpec,
  outPath: string,
  onProgress?: (done: number, total: number) => void
): Promise<RenderResult> {
  const t0 = Date.now();
  const spec = RenderSpecSchema.parse(input);
  if (!spec.svg && !spec.text) throw new Error('Provide `svg` or `text`.');

  const { scene, hdriUrl, font } = await resolveScene(spec);
  const svg = spec.svg ?? (await textToSvgString(spec.text!, font));
  let hdrBase64: string | undefined;
  if (hdriUrl) {
    try {
      hdrBase64 = (await fetchCached(hdriUrl)).toString('base64');
    } catch {
      hdrBase64 = undefined; // RoomEnvironment fallback
    }
  }

  const frames = spec.format === 'png' ? 1 : Math.max(1, Math.round(spec.duration * spec.fps));
  const ss = spec.supersample;
  const job: PageJob = {
    svg,
    scene,
    camera: resolveCamera(spec.camera, scene.fov),
    width: spec.width,
    height: spec.height,
    canvasWidth: spec.width * ss,
    canvasHeight: spec.height * ss,
    frames,
    stillAt: spec.stillAt,
    transparent: spec.background === 'transparent',
    hdrBase64,
  };

  const out = resolve(outPath);
  await mkdir(spec.format === 'png-seq' ? out : dirname(out), { recursive: true });

  const puppeteer = (await import('puppeteer-core')).default;
  const browser = await puppeteer.launch({
    executablePath: findChromium(),
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--ignore-gpu-blocklist',
      '--enable-unsafe-swiftshader', // software GL fallback on GPU-less servers
      ...(process.env.STUDIO3D_GL_ARGS?.split(' ').filter(Boolean) ?? []),
    ],
  });
  const ff = spawn(process.env.FFMPEG_PATH || 'ffmpeg', ffmpegArgs(spec, out), {
    stdio: ['pipe', 'ignore', 'pipe'],
  });
  let ffErr = '';
  ff.stderr.on('data', (d) => (ffErr += d));
  const ffDone = new Promise<void>((res, rej) => {
    ff.on('error', rej);
    ff.on('close', (code) =>
      code === 0 ? res() : rej(new Error(`ffmpeg exited ${code}: ${ffErr}`))
    );
  });

  try {
    const page = await browser.newPage();
    const pageErrors: string[] = [];
    page.on('pageerror', (e) => pageErrors.push(String(e)));
    await page.setContent(
      '<!doctype html><html><body style="margin:0;background:transparent"></body></html>'
    );
    await page.addScriptTag({ content: await pageBundle() });
    await page.evaluate((j) => (window as any).__s3d.setup(j), job as any);
    for (let i = 0; i < frames; i++) {
      const dataUrl = (await page.evaluate((n) => (window as any).__s3d.frame(n), i)) as string;
      const png = Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64');
      if (!ff.stdin.write(png)) await new Promise((r) => ff.stdin.once('drain', r));
      onProgress?.(i + 1, frames);
    }
    if (pageErrors.length) throw new Error(`Page error: ${pageErrors.join('; ')}`);
    ff.stdin.end();
    await ffDone;
  } catch (err) {
    ff.kill();
    throw err;
  } finally {
    await browser.close().catch(() => {});
  }

  return {
    path: out,
    format: spec.format,
    width: spec.width,
    height: spec.height,
    frames,
    fps: spec.fps,
    ms: Date.now() - t0,
  };
}
