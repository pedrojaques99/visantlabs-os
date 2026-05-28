export interface SvgOptimizeOptions {
  removeComments: boolean;
  removeMetadata: boolean;
  removeEditorData: boolean;
  removeEmptyGroups: boolean;
  minifyPaths: boolean;
  removeHiddenElements: boolean;
  prettify: boolean;
}

const DEFAULT_OPTIONS: SvgOptimizeOptions = {
  removeComments: true,
  removeMetadata: true,
  removeEditorData: true,
  removeEmptyGroups: true,
  minifyPaths: true,
  removeHiddenElements: true,
  prettify: false,
};

/** Editor-specific namespace attributes */
const EDITOR_XMLNS = [
  'xmlns:inkscape',
  'xmlns:sodipodi',
  'xmlns:sketch',
  'xmlns:dc',
  'xmlns:cc',
  'xmlns:rdf',
];

/** Editor-specific attribute prefixes */
const EDITOR_ATTR_PREFIXES = [
  'inkscape:',
  'sodipodi:',
  'sketch:',
  'data-name',
];

/**
 * Lightweight regex-based SVG optimizer.
 * No DOM parsing — all string transformations.
 */
export function optimizeSvg(
  svgString: string,
  options?: Partial<SvgOptimizeOptions>,
): { optimized: string; originalSize: number; optimizedSize: number; savings: number } {
  const opts: SvgOptimizeOptions = { ...DEFAULT_OPTIONS, ...options };
  const originalSize = new Blob([svgString]).size;

  let svg = svgString;

  // 1. Remove XML processing instructions <?xml ...?>
  svg = svg.replace(/<\?xml[^?]*\?>\s*/gi, '');

  // 2. Remove DOCTYPE declarations
  svg = svg.replace(/<!DOCTYPE[^>]*>\s*/gi, '');

  // 3. Remove XML comments <!-- ... -->
  if (opts.removeComments) {
    svg = svg.replace(/<!--[\s\S]*?-->/g, '');
  }

  // 4. Remove <metadata>...</metadata>
  if (opts.removeMetadata) {
    svg = svg.replace(/<metadata[\s\S]*?<\/metadata>\s*/gi, '');
  }

  // 5. Remove editor-specific namespace declarations and attributes
  if (opts.removeEditorData) {
    // Remove editor xmlns declarations
    for (const ns of EDITOR_XMLNS) {
      svg = svg.replace(new RegExp(`\\s+${ns.replace(':', ':')}="[^"]*"`, 'gi'), '');
    }
    // Remove editor-prefixed attributes (inkscape:label, sodipodi:docname, etc.)
    for (const prefix of EDITOR_ATTR_PREFIXES) {
      svg = svg.replace(new RegExp(`\\s+${prefix.replace(':', ':')}[a-z-]*="[^"]*"`, 'gi'), '');
    }
    // Remove xmlns:xlink if xlink: is not used in the rest of the content
    const withoutXlinkDecl = svg.replace(/\s+xmlns:xlink="[^"]*"/gi, '');
    if (!/xlink:/i.test(withoutXlinkDecl)) {
      svg = withoutXlinkDecl;
    }
    // Remove <sodipodi:...> elements
    svg = svg.replace(/<sodipodi:[^>]*\/>\s*/gi, '');
    svg = svg.replace(/<sodipodi:[^>]*>[\s\S]*?<\/sodipodi:[^>]*>\s*/gi, '');
    // Remove <inkscape:...> elements
    svg = svg.replace(/<inkscape:[^>]*\/>\s*/gi, '');
    svg = svg.replace(/<inkscape:[^>]*>[\s\S]*?<\/inkscape:[^>]*>\s*/gi, '');
  }

  // 6. Remove empty groups <g></g> and <g ...></g> (repeated for nested)
  if (opts.removeEmptyGroups) {
    let prev = '';
    while (prev !== svg) {
      prev = svg;
      svg = svg.replace(/<g[^>]*>\s*<\/g>\s*/gi, '');
    }
  }

  // 7. Remove hidden elements
  if (opts.removeHiddenElements) {
    svg = svg.replace(/<[^>]+\s+display\s*=\s*"none"[^>]*(?:\/>|>[\s\S]*?<\/[^>]+>)\s*/gi, '');
    svg = svg.replace(/<[^>]+\s+visibility\s*=\s*"hidden"[^>]*(?:\/>|>[\s\S]*?<\/[^>]+>)\s*/gi, '');
  }

  // 8. Minify numeric values in paths and attributes
  if (opts.minifyPaths) {
    // Remove trailing zeros after decimal: 0.500 -> .5, 1.00 -> 1
    svg = svg.replace(/\b(\d+)\.0+\b/g, '$1');
    svg = svg.replace(/\b0+(\.\d*[1-9])0+\b/g, '$1');
    svg = svg.replace(/\b0+(\.\d+)\b/g, '$1');
    // Leading zero: 0.5 -> .5 (only in numeric contexts)
    svg = svg.replace(/(?<=[\s,(":]|^)0+(\.\d+)/g, '$1');
  }

  // 9. Collapse whitespace (multiple spaces/newlines -> single space)
  if (!opts.prettify) {
    svg = svg.replace(/\s{2,}/g, ' ');
    svg = svg.replace(/>\s+</g, '><');
    svg = svg.trim();
  }

  // 10. Prettify: simple indentation
  if (opts.prettify) {
    svg = prettifySvg(svg);
  }

  const optimizedSize = new Blob([svg]).size;
  const savings = originalSize > 0 ? Math.round((1 - optimizedSize / originalSize) * 100) : 0;

  return { optimized: svg, originalSize, optimizedSize, savings };
}

function prettifySvg(svg: string): string {
  // First collapse to single line
  let s = svg.replace(/\s{2,}/g, ' ').replace(/>\s+</g, '><').trim();

  // Split on tags
  const tokens = s.replace(/></g, '>\n<').split('\n');
  let indent = 0;
  const lines: string[] = [];

  for (const token of tokens) {
    const trimmed = token.trim();
    if (!trimmed) continue;

    const isSelfClosing = /\/>$/.test(trimmed);
    const isClosingTag = /^<\//.test(trimmed);

    if (isClosingTag) indent = Math.max(0, indent - 1);
    lines.push('  '.repeat(indent) + trimmed);
    if (!isSelfClosing && !isClosingTag && /^<[^/!?]/.test(trimmed)) indent++;
  }

  return lines.join('\n');
}

/**
 * Sanitize SVG for safe inline rendering:
 * removes <script> tags and on* event attributes.
 */
export function sanitizeSvgForRender(svg: string): string {
  let s = svg;
  s = s.replace(/<script[\s\S]*?<\/script>/gi, '');
  s = s.replace(/<script[^>]*\/>/gi, '');
  s = s.replace(/\s+on\w+="[^"]*"/gi, '');
  s = s.replace(/\s+on\w+='[^']*'/gi, '');
  s = s.replace(/\s+on\w+=[^\s>]*/gi, '');
  return s;
}
