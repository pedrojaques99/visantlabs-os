// @visant/logo-trace — SVG sanitization + optimization + data-URI parsing.
//
// `jsdom` and `dompurify` are optional peers, imported lazily. They are only
// needed for the sanitize/optimize pass (the server always has them); the trace
// core can run without them if you skip cleanup.

import type { SvgOptimizeOptions } from './types.js';

// ── data-URI parsing ────────────────────────────────────────────────────────

/**
 * Parse a `data:image/<mime>;base64,<payload>` string into a Buffer.
 * Returns `null` when the string is not a base64 image data-URI — callers use
 * that to reject bad input (e.g. respond 400). It validates the prefix rather
 * than stripping it, so a raw (prefix-less) base64 blob is intentionally
 * rejected. The MIME pattern is wide enough to match e.g. `image/svg+xml`.
 */
export function parseBase64Image(image: string): Buffer | null {
  const match = image.match(/^data:image\/[^;]+;base64,(.+)$/i);
  if (!match) return null;
  return Buffer.from(match[1], 'base64');
}

// ── SVG sanitization (DOMPurify) ─────────────────────────────────────────────

let _purify: any = null;
async function getPurify(): Promise<any> {
  if (_purify) return _purify;
  let JSDOM: any;
  let createDOMPurify: any;
  try {
    JSDOM = (await import('jsdom')).JSDOM;
    createDOMPurify = (await import('dompurify')).default;
  } catch {
    throw new Error(
      '@visant/logo-trace sanitize requires the optional peer dependencies ' +
        '"jsdom" and "dompurify". Install them with `npm i jsdom dompurify`.'
    );
  }
  _purify = createDOMPurify(new JSDOM('').window as any);
  return _purify;
}

/** Strip scripts / unsafe content from an SVG string, keeping SVG + filters + <use>. */
export async function sanitizeSvg(svg: string): Promise<string> {
  const purify = await getPurify();
  return purify.sanitize(svg, {
    USE_PROFILES: { svg: true, svgFilters: true },
    ADD_TAGS: ['use'],
  });
}

// ── SVG optimization ─────────────────────────────────────────────────────────

function escapeRegexSpecial(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const EDITOR_XMLNS = [
  'xmlns:inkscape',
  'xmlns:sodipodi',
  'xmlns:sketch',
  'xmlns:dc',
  'xmlns:cc',
  'xmlns:rdf',
];

const EDITOR_ATTR_PREFIXES = ['inkscape:', 'sodipodi:', 'sketch:', 'data-name'];

/**
 * Strip editor cruft, comments, metadata, hidden/empty nodes and minify numeric
 * literals from an SVG string. Pure string transforms except the optional
 * `removeHiddenElements` pass, which needs jsdom.
 */
export async function optimizeSvg(
  svgString: string,
  options?: Partial<SvgOptimizeOptions>
): Promise<string> {
  const opts: Required<SvgOptimizeOptions> = {
    removeComments: true,
    removeMetadata: true,
    removeEditorData: true,
    removeEmptyGroups: true,
    minifyPaths: true,
    removeHiddenElements: true,
    ...options,
  };

  let svg = svgString;

  svg = svg.replace(/<\?xml[^?]*\?>\s*/gi, '');
  svg = svg.replace(/<!DOCTYPE[^>]*>\s*/gi, '');

  if (opts.removeComments) {
    let prev = '';
    while (prev !== svg) {
      prev = svg;
      svg = svg.replace(/<!--[\s\S]*?-->/g, '');
    }
  }

  if (opts.removeMetadata) {
    svg = svg.replace(/<metadata[\s\S]*?<\/metadata>\s*/gi, '');
  }

  if (opts.removeEditorData) {
    for (const ns of EDITOR_XMLNS) {
      const escaped = escapeRegexSpecial(ns);
      svg = svg.replace(new RegExp(`\\s+${escaped}="[^"]*"`, 'gi'), '');
    }
    for (const prefix of EDITOR_ATTR_PREFIXES) {
      const escaped = escapeRegexSpecial(prefix);
      svg = svg.replace(new RegExp(`\\s+${escaped}[a-z-]*="[^"]*"`, 'gi'), '');
    }
    const withoutXlinkDecl = svg.replace(/\s+xmlns:xlink="[^"]*"/gi, '');
    if (!/xlink:/i.test(withoutXlinkDecl)) {
      svg = withoutXlinkDecl;
    }
    svg = svg.replace(/<sodipodi:[^>]*\/>\s*/gi, '');
    svg = svg.replace(/<sodipodi:[^>]*>[\s\S]*?<\/sodipodi:[^>]*>\s*/gi, '');
    svg = svg.replace(/<inkscape:[^>]*\/>\s*/gi, '');
    svg = svg.replace(/<inkscape:[^>]*>[\s\S]*?<\/inkscape:[^>]*>\s*/gi, '');
  }

  if (opts.removeEmptyGroups) {
    let prev = '';
    while (prev !== svg) {
      prev = svg;
      svg = svg.replace(/<g[^>]*>\s*<\/g>\s*/gi, '');
    }
  }

  if (opts.removeHiddenElements) {
    const { JSDOM } = await import('jsdom');
    const dom = new JSDOM(svg, { contentType: 'image/svg+xml' });
    const doc = dom.window.document;
    doc
      .querySelectorAll('[display="none"], [visibility="hidden"]')
      .forEach((el: any) => el.remove());
    svg = doc.documentElement.outerHTML;
  }

  if (opts.minifyPaths) {
    svg = svg.replace(/\b(\d+)\.0+\b/g, '$1');
    svg = svg.replace(/\b0+(\.\d*[1-9])0+\b/g, '$1');
    svg = svg.replace(/\b0+(\.\d+)\b/g, '$1');
    svg = svg.replace(/(?<=[\s,(":]|^)0+(\.\d+)/g, '$1');
  }

  svg = svg.replace(/\s{2,}/g, ' ');
  svg = svg.replace(/>\s+</g, '><');
  svg = svg.trim();

  return svg;
}

/** sanitize → optimize. Used to clean SVG pasted from Figma/Illustrator/etc. */
export async function cleanSvg(raw: string): Promise<string> {
  const sanitized = await sanitizeSvg(raw);
  return optimizeSvg(sanitized);
}
