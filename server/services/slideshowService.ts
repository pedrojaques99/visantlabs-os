import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFile, mkdir, readFile, rm } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';

const execFileAsync = promisify(execFile);

export type SlideFormat = 'mp4' | 'webm' | 'gif';
export type SlideOrder = 'sequence' | 'random';

export interface SlideImage {
  filename: string;
  bytes: Buffer;
}

export interface SlideshowOptions {
  /** Seconds each photo is shown (>= 0.02). */
  perPhotoSec: number;
  order: SlideOrder;
  format: SlideFormat;
  /** Canvas width — derived from the first image by the caller; defaults to 1280. */
  width?: number;
  height?: number;
  fps?: number;
  /**
   * How many times the whole sequence repeats in the timeline (>= 1, default 1).
   * Generic on purpose: GIF already loops forever via `-loop 0`, so the plugin UI
   * keeps this at 1 for GIF rather than the service special-casing a format.
   */
  loops?: number;
}

export interface SlideshowResult {
  bytes: Buffer;
  contentType: string;
  ext: SlideFormat;
  durationSec: number;
  frameCount: number;
}

const MAX_PHOTOS = 300;
const MAX_DIMENSION = 3840;
const MAX_JOB_SIZE_BYTES = 500 * 1024 * 1024; // 500MB of source photos
const MAX_TOTAL_SEC = 600;
const MAX_LOOPS = 10;
/**
 * Ceiling on photos×loops. Every timeline entry is one more `-i` on the ffmpeg command
 * line, so without this 300 photos at 10x would build a 3000-input invocation.
 */
const MAX_TIMELINE_ENTRIES = 600;

const CONTENT_TYPE: Record<SlideFormat, string> = {
  mp4: 'video/mp4',
  webm: 'video/webm',
  gif: 'image/gif',
};

const SAFE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.bmp', '.tif', '.tiff', '.avif']);

export function validateSlideFormat(format: string): format is SlideFormat {
  return ['mp4', 'webm', 'gif'].includes(format);
}

export function validateSlideOrder(order: string): order is SlideOrder {
  return ['sequence', 'random'].includes(order);
}

export function validatePerPhotoSec(sec: number): string | null {
  if (!Number.isFinite(sec) || sec < 0.02) return 'Seconds per photo must be at least 0.02';
  if (sec > 60) return 'Seconds per photo must be at most 60';
  return null;
}

export function validateSlideDimensions(width?: number, height?: number): string | null {
  for (const v of [width, height]) {
    if (v === undefined) continue;
    if (!Number.isFinite(v) || v < 2) return 'Invalid dimensions';
    if (v > MAX_DIMENSION) return `Max dimension is ${MAX_DIMENSION}px`;
  }
  return null;
}

export function validateLoops(loops: number): string | null {
  if (!Number.isInteger(loops) || loops < 1) return 'Loops must be a whole number of at least 1';
  if (loops > MAX_LOOPS) return `Loops must be at most ${MAX_LOOPS}`;
  return null;
}

export function validatePhotos(
  images: SlideImage[],
  perPhotoSec: number,
  loops = 1
): string | null {
  if (!images.length) return 'No photos supplied';
  if (images.length > MAX_PHOTOS) return `Max ${MAX_PHOTOS} photos allowed`;

  const totalBytes = images.reduce((sum, i) => sum + i.bytes.length, 0);
  if (totalBytes > MAX_JOB_SIZE_BYTES) return 'Job size limit exceeded';

  const entries = images.length * loops;
  if (entries > MAX_TIMELINE_ENTRIES) {
    return `Photos × loops must be at most ${MAX_TIMELINE_ENTRIES}`;
  }
  if (entries * perPhotoSec > MAX_TOTAL_SEC) {
    return `Total duration must be at most ${MAX_TOTAL_SEC}s`;
  }
  return null;
}

function even(n: number): number {
  return Math.max(2, Math.round(n / 2) * 2);
}

function extOf(filename: string): string {
  const ext = extname(filename).toLowerCase();
  return SAFE_EXT.has(ext) ? ext : '.png';
}

/** Fisher–Yates. Math.random is fine here — this runs in the Node server, not a sandbox. */
function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Turn a list of images into a slideshow video/gif using the native ffmpeg binary.
 *
 * Each photo becomes one `-loop 1 -t d` input (exactly fps×d frames) and the inputs
 * are joined with the concat filter — this gives precise per-photo timing that the
 * concat *demuxer* doesn't (its `duration` directives drop frames with still images).
 * A scale/pad/setsar filter normalises every input to the same even-sized canvas so
 * mixed photo sizes concat cleanly; GIF gets a palettegen/paletteuse pass for quality.
 *
 * Sibling of `renderService`, not a replacement: that one is frame-based (the client
 * rasterises every frame and uploads them at a fixed fps), which for a slideshow would
 * mean uploading fps×duration identical frames per photo. Here one file per photo goes
 * up and ffmpeg owns the timing.
 */
export async function buildSlideshow(
  images: SlideImage[],
  opts: SlideshowOptions
): Promise<SlideshowResult> {
  if (!images.length) throw new Error('No photos supplied');

  const work = join(tmpdir(), 'visant-sequencer', randomUUID());
  await mkdir(work, { recursive: true });

  try {
    const ordered = opts.order === 'random' ? shuffle(images) : images;

    const names: string[] = [];
    for (let i = 0; i < ordered.length; i++) {
      const name = `i${i}${extOf(ordered[i].filename)}`;
      await writeFile(join(work, name), ordered[i].bytes);
      names.push(name);
    }

    // Each photo is written once; looping only repeats the references, so N loops cost
    // nothing on disk. `random` shuffles once and the result repeats — a loop replays the
    // same sequence rather than reshuffling per pass.
    const loops = Math.max(1, Math.floor(opts.loops ?? 1));
    const seq: string[] = [];
    for (let l = 0; l < loops; l++) seq.push(...names);

    const n = seq.length;
    // Floor only at ~1 frame so very fast scenes are possible; no upper limit.
    const d = Math.max(0.02, opts.perPhotoSec);
    const W = even(opts.width ?? 1280);
    const H = even(opts.height ?? 720);
    // GIF delays are quantised to 1/100s — 20fps (5cs/frame) divides cleanly; video uses 30.
    const fps = opts.fps ?? (opts.format === 'gif' ? 20 : 30);
    const norm =
      `scale=${W}:${H}:force_original_aspect_ratio=decrease,` +
      `pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1`;

    // One looped input per timeline entry → exact N×d timeline.
    const inputs: string[] = [];
    for (const name of seq) {
      inputs.push('-loop', '1', '-framerate', String(fps), '-t', String(d), '-i', name);
    }

    let chain = '';
    for (let i = 0; i < n; i++) chain += `[${i}:v]${norm}[v${i}];`;
    for (let i = 0; i < n; i++) chain += `[v${i}]`;

    const outName = `out.${opts.format}`;
    let args: string[];

    if (opts.format === 'gif') {
      const filter =
        `${chain}concat=n=${n}:v=1:a=0[c];` +
        `[c]split[s0][s1];[s0]palettegen=stats_mode=diff[p];[s1][p]paletteuse=dither=bayer:bayer_scale=3[v]`;
      args = ['-y', ...inputs, '-filter_complex', filter, '-map', '[v]', '-loop', '0', outName];
    } else if (opts.format === 'webm') {
      const filter = `${chain}concat=n=${n}:v=1:a=0,format=yuv420p[v]`;
      args = [
        '-y',
        ...inputs,
        '-filter_complex',
        filter,
        '-map',
        '[v]',
        '-c:v',
        'libvpx-vp9',
        '-b:v',
        '0',
        '-crf',
        '34',
        '-row-mt',
        '1',
        '-deadline',
        'good',
        outName,
      ];
    } else {
      const filter = `${chain}concat=n=${n}:v=1:a=0,format=yuv420p[v]`;
      args = [
        '-y',
        ...inputs,
        '-filter_complex',
        filter,
        '-map',
        '[v]',
        '-c:v',
        'libx264',
        '-preset',
        'veryfast',
        '-crf',
        '20',
        '-pix_fmt',
        'yuv420p',
        '-movflags',
        '+faststart',
        outName,
      ];
    }

    await execFileAsync('ffmpeg', args, {
      cwd: work,
      timeout: 5 * 60 * 1000,
      maxBuffer: 64 * 1024 * 1024,
    });

    const bytes = await readFile(join(work, outName));

    return {
      bytes,
      contentType: CONTENT_TYPE[opts.format],
      ext: opts.format,
      durationSec: d * n,
      frameCount: n,
    };
  } finally {
    await rm(work, { recursive: true, force: true }).catch(() => {});
  }
}

export async function probeFFmpeg(): Promise<boolean> {
  try {
    await execFileAsync('ffmpeg', ['-version']);
    return true;
  } catch {
    return false;
  }
}
