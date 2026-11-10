/**
 * Render spec for the headless Studio3D renderer (agent/API/CLI entry).
 *
 * Look = the Studio3D app's own state: defaults come from `useStudio3DStore`
 * (INITIAL_STATE), `preset` runs the app's `applyScenePreset`, `lighting` applies
 * one of `LIGHTING_PRESETS`, and `config` is the same partial config that
 * `studio3d-create-scene` stores. Nothing about the look is redefined here —
 * only what the app lacks: a deterministic camera move, duration, size, format.
 */
import { z } from 'zod';

export const CAMERA_MOVES = ['turntable', 'orbit', 'push', 'pull', 'sweep', 'static'] as const;
export const EASINGS = ['linear', 'easeIn', 'easeOut', 'easeInOut'] as const;
export const RENDER_FORMATS = ['mp4', 'mov', 'webm', 'png', 'png-seq'] as const;

const hex = z.string().regex(/^#[0-9A-Fa-f]{3,8}$/);

export const CameraSchema = z
  .object({
    move: z.enum(CAMERA_MOVES).default('turntable'),
    /** Camera distance from the object (scene units; the logo fits a 4-unit box). */
    distance: z.number().min(1).max(60).default(7),
    /** Camera elevation in degrees (0 = eye level, + = looking down). */
    elevation: z.number().min(-89).max(89).default(8),
    /** Starting azimuth in degrees (0 = front). */
    azimuth: z.number().default(0),
    /** Degrees covered: turntable/orbit sweep this; push/pull/sweep drift ±angle/2. */
    angle: z.number().optional(),
    /** push/pull start/end distance (push goes from→to, pull to→from). */
    from: z.number().min(1).max(60).optional(),
    to: z.number().min(1).max(60).optional(),
    /** sweep: elevation travelled (deg), centred on `elevation`. */
    elevationTo: z.number().default(20),
    /** Extra object spin in degrees across the clip (linear), on top of any move. */
    spin: z.number().default(0),
    easing: z.enum(EASINGS).optional(),
    fov: z.number().min(10).max(120).optional(),
    targetY: z.number().default(0),
  })
  .prefault({});

export const RenderSpecSchema = z.object({
  /** SVG markup (logo). One of svg | text is required. */
  svg: z.string().max(5 * 1024 * 1024).optional(),
  /** Text to set in type and extrude (uses `font`). */
  text: z.string().max(200).optional(),
  /** Studio3D font name (see FONTS in engine/useFont.ts), or a .ttf/.otf/.woff URL or local path. */
  font: z.string().optional(),
  /** App scene preset name (SCENE_PRESETS): 'Hero Banner', 'Liquid Metal', 'Dark Studio'... */
  preset: z.string().optional(),
  /** App lighting preset name (LIGHTING_PRESETS): '3-Point Studio', 'Rim Light', 'Dramatic'... */
  lighting: z.string().optional(),
  /** Partial Studio3D config (same keys as studio3d-create-scene / the store). Wins over presets. */
  config: z.record(z.string(), z.unknown()).default({}),
  /** '#hex' or 'transparent'. Overrides config.background. */
  background: z.union([z.literal('transparent'), hex]).optional(),
  camera: CameraSchema,
  width: z.number().int().min(64).max(3840).default(1920),
  height: z.number().int().min(64).max(3840).default(1080),
  fps: z.number().int().min(1).max(60).default(30),
  duration: z.number().min(0.1).max(30).default(4),
  format: z.enum(RENDER_FORMATS).default('mp4'),
  /** Render at N× and downscale (lanczos) — cleaner edges on chrome. */
  supersample: z.number().int().min(1).max(3).default(1),
  /** For format 'png': clip position 0–1 of the still. */
  stillAt: z.number().min(0).max(1).default(0),
  /** mp4 quality (x264 CRF, lower = better). */
  crf: z.number().int().min(0).max(40).default(16),
});

export type RenderSpec = z.input<typeof RenderSpecSchema>;
export type ParsedRenderSpec = z.output<typeof RenderSpecSchema>;

/** Resolved scene values the page needs (subset of the app store state). */
export interface ResolvedScene {
  material: string;
  color: string;
  metalness: number;
  roughness: number;
  opacity: number;
  depth: number;
  smoothness: number;
  bevelEnabled: boolean;
  bevelThickness: number;
  bevelSize: number;
  objectScale: number;
  background: string;
  environment: string;
  envMapIntensity: number;
  hdriIntensity: number;
  hdriRotation: number;
  toneMapping: string;
  toneMappingExposure: number;
  lightIntensity: number;
  lightPosition: [number, number, number];
  fillLightIntensity: number;
  fillLightPosition: [number, number, number];
  bounceLightIntensity: number;
  bounceLightPosition: [number, number, number];
  pointLightIntensity: number;
  pointLightPosition: [number, number, number];
  ambientIntensity: number;
  fov: number;
}

export interface PageJob {
  svg: string;
  scene: ResolvedScene;
  camera: Required<Omit<z.output<typeof CameraSchema>, 'easing' | 'fov' | 'angle' | 'from' | 'to'>> & {
    easing: string;
    fov: number;
    angle: number;
    from: number;
    to: number;
  };
  width: number;
  height: number;
  canvasWidth: number;
  canvasHeight: number;
  frames: number;
  stillAt: number;
  transparent: boolean;
  hdrBase64?: string;
}

/** Per-move defaults: turntable loops 360° linear; push/pull ease and drift. */
export function resolveCamera(c: z.output<typeof CameraSchema>, fov: number): PageJob['camera'] {
  const loop = c.move === 'turntable' || c.move === 'orbit';
  return {
    ...c,
    angle: c.angle ?? (loop ? 360 : c.move === 'sweep' ? 50 : 16),
    from: c.from ?? c.distance * 1.7,
    to: c.to ?? c.distance * 0.85,
    easing: c.easing ?? (loop ? 'linear' : 'easeInOut'),
    fov: c.fov ?? fov,
  };
}
