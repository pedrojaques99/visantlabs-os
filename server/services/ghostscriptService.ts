import { execFile } from 'child_process';
import { promisify } from 'util';
import { writeFile, readFile, unlink, mkdtemp } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomBytes } from 'crypto';
import { logger } from '../lib/logger';

const execFileAsync = promisify(execFile);

const GS_TIMEOUT = 60_000;
const MAX_BUFFER = 50 * 1024 * 1024;

type CompressPreset = 'screen' | 'ebook' | 'printer' | 'prepress';

interface RasterizeOptions {
  dpi?: number;
  format?: 'png' | 'jpeg';
  pages?: string; // e.g. '1-3' or '1,3,5'
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function tmpName(ext: string): string {
  return `gs_${randomBytes(8).toString('hex')}.${ext}`;
}

async function withTempDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), 'gs-'));
  try {
    return await fn(dir);
  } finally {
    // best-effort cleanup — don't block on errors
    try {
      const { readdir } = await import('fs/promises');
      const files = await readdir(dir);
      await Promise.allSettled(files.map((f) => unlink(join(dir, f))));
      const { rmdir } = await import('fs/promises');
      await rmdir(dir);
    } catch {}
  }
}

async function runGs(args: string[]): Promise<void> {
  try {
    await execFileAsync('gs', args, {
      timeout: GS_TIMEOUT,
      maxBuffer: MAX_BUFFER,
    });
  } catch (err: any) {
    logger.error({ err, args: args.slice(0, 6) }, 'Ghostscript failed');
    throw new Error(`Ghostscript error: ${err.stderr || err.message}`);
  }
}

function bufferFromBase64(input: string): Buffer {
  const cleaned = input.replace(/^data:application\/pdf;base64,/, '');
  return Buffer.from(cleaned, 'base64');
}

// ---------------------------------------------------------------------------
// PDF Compression
// ---------------------------------------------------------------------------

export async function compressPdf(
  input: string | Buffer,
  preset: CompressPreset = 'ebook'
): Promise<Buffer> {
  const inputBuf = typeof input === 'string' ? bufferFromBase64(input) : input;

  return withTempDir(async (dir) => {
    const inPath = join(dir, tmpName('pdf'));
    const outPath = join(dir, tmpName('pdf'));

    await writeFile(inPath, inputBuf);

    await runGs([
      '-sDEVICE=pdfwrite',
      `-dCompatibilityLevel=1.4`,
      `-dPDFSETTINGS=/${preset}`,
      '-dNOPAUSE',
      '-dBATCH',
      '-dSAFER',
      '-dQUIET',
      `-sOutputFile=${outPath}`,
      inPath,
    ]);

    return readFile(outPath);
  });
}

// ---------------------------------------------------------------------------
// RGB → CMYK
// ---------------------------------------------------------------------------

export async function convertToCmyk(input: string | Buffer): Promise<Buffer> {
  const inputBuf = typeof input === 'string' ? bufferFromBase64(input) : input;

  return withTempDir(async (dir) => {
    const inPath = join(dir, tmpName('pdf'));
    const outPath = join(dir, tmpName('pdf'));

    await writeFile(inPath, inputBuf);

    await runGs([
      '-sDEVICE=pdfwrite',
      '-dNOPAUSE',
      '-dBATCH',
      '-dSAFER',
      '-dQUIET',
      '-sProcessColorModel=DeviceCMYK',
      '-sColorConversionStrategy=CMYK',
      `-sOutputFile=${outPath}`,
      inPath,
    ]);

    return readFile(outPath);
  });
}

// ---------------------------------------------------------------------------
// PDF → Images (rasterize pages)
// ---------------------------------------------------------------------------

export async function rasterizePages(
  input: string | Buffer,
  opts: RasterizeOptions = {}
): Promise<Buffer[]> {
  const inputBuf = typeof input === 'string' ? bufferFromBase64(input) : input;
  const { dpi = 150, format = 'png' } = opts;
  const device = format === 'jpeg' ? 'jpeg' : 'png16m';

  return withTempDir(async (dir) => {
    const inPath = join(dir, tmpName('pdf'));
    const outPattern = join(dir, `page-%03d.${format === 'jpeg' ? 'jpg' : 'png'}`);

    await writeFile(inPath, inputBuf);

    const args = [
      `-sDEVICE=${device}`,
      `-r${dpi}`,
      '-dNOPAUSE',
      '-dBATCH',
      '-dSAFER',
      '-dQUIET',
      `-sOutputFile=${outPattern}`,
    ];

    if (opts.pages) {
      args.push(`-dFirstPage=${opts.pages.split('-')[0] || '1'}`);
      const last = opts.pages.split('-')[1];
      if (last) args.push(`-dLastPage=${last}`);
    }

    args.push(inPath);
    await runGs(args);

    const { readdir } = await import('fs/promises');
    const files = (await readdir(dir)).filter((f) => f.startsWith('page-')).sort();

    return Promise.all(files.map((f) => readFile(join(dir, f))));
  });
}

// ---------------------------------------------------------------------------
// Images → PDF (multi-page)
// ---------------------------------------------------------------------------

export async function imagesToPdf(images: Buffer[]): Promise<Buffer> {
  // Use pdf-lib for this — it's simpler and doesn't need GS
  const { PDFDocument } = await import('pdf-lib');
  const doc = await PDFDocument.create();

  for (const imgBuf of images) {
    let image;
    const header = imgBuf.subarray(0, 4);
    if (header[0] === 0x89 && header[1] === 0x50) {
      image = await doc.embedPng(imgBuf);
    } else {
      image = await doc.embedJpg(imgBuf);
    }
    const page = doc.addPage([image.width, image.height]);
    page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
  }

  const bytes = await doc.save();
  return Buffer.from(bytes);
}

// ---------------------------------------------------------------------------
// PDF Merge
// ---------------------------------------------------------------------------

export async function mergePdfs(inputs: Buffer[]): Promise<Buffer> {
  return withTempDir(async (dir) => {
    const inPaths: string[] = [];
    for (let i = 0; i < inputs.length; i++) {
      const p = join(dir, `input-${i}.pdf`);
      await writeFile(p, inputs[i]);
      inPaths.push(p);
    }

    const outPath = join(dir, 'merged.pdf');

    await runGs([
      '-sDEVICE=pdfwrite',
      '-dNOPAUSE',
      '-dBATCH',
      '-dSAFER',
      '-dQUIET',
      `-sOutputFile=${outPath}`,
      ...inPaths,
    ]);

    return readFile(outPath);
  });
}

// ---------------------------------------------------------------------------
// PDF/A Conversion
// ---------------------------------------------------------------------------

export async function convertToPdfA(input: string | Buffer): Promise<Buffer> {
  const inputBuf = typeof input === 'string' ? bufferFromBase64(input) : input;

  return withTempDir(async (dir) => {
    const inPath = join(dir, tmpName('pdf'));
    const outPath = join(dir, tmpName('pdf'));

    await writeFile(inPath, inputBuf);

    await runGs([
      '-dPDFA=2',
      '-dNOOUTERSAVE',
      '-dNOPAUSE',
      '-dBATCH',
      '-dSAFER',
      '-dQUIET',
      '-sProcessColorModel=DeviceRGB',
      '-sDEVICE=pdfwrite',
      '-dPDFACompatibilityPolicy=1',
      `-sOutputFile=${outPath}`,
      inPath,
    ]);

    return readFile(outPath);
  });
}

// ---------------------------------------------------------------------------
// EPS/AI → PDF
// ---------------------------------------------------------------------------

export async function convertEpsToPdf(input: Buffer): Promise<Buffer> {
  return withTempDir(async (dir) => {
    const inPath = join(dir, tmpName('eps'));
    const outPath = join(dir, tmpName('pdf'));

    await writeFile(inPath, input);

    await runGs([
      '-sDEVICE=pdfwrite',
      '-dNOPAUSE',
      '-dBATCH',
      '-dSAFER',
      '-dQUIET',
      '-dEPSCrop',
      `-sOutputFile=${outPath}`,
      inPath,
    ]);

    return readFile(outPath);
  });
}
