/**
 * Server-side SVG → 3D → GLB export.
 *
 * The geometry + GLB serialization now live in @visant/extrude3d (`svgToGlb`,
 * dependency-free, no GLTFExporter). This service keeps only the server-specific
 * concerns: ensuring a `DOMParser` exists (SVGLoader needs one in Node) and
 * adapting the package's `Uint8Array` to a Node `Buffer`.
 */

import { svgToGlb as svgToGlbCore, type SvgToGlbOptions } from '@visant/extrude3d/glb';

export type ExportOptions = SvgToGlbOptions;

let domReady = false;

async function ensureDOMParser(): Promise<void> {
  if (domReady) return;
  if (typeof globalThis.DOMParser === 'undefined') {
    const { JSDOM } = await import('jsdom');
    const dom = new JSDOM('');
    globalThis.DOMParser = dom.window.DOMParser as any;
  }
  domReady = true;
}

export async function svgToGlb(svgString: string, opts: ExportOptions = {}): Promise<Buffer> {
  await ensureDOMParser();
  const { glb } = svgToGlbCore(svgString, opts);
  return Buffer.from(glb.buffer, glb.byteOffset, glb.byteLength);
}
