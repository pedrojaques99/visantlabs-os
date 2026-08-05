/**
 * Figma REST API Client
 * Single service for all Figma API operations
 */

const FIGMA_API_BASE = 'https://api.figma.com/v1';

// ═══ Types ═══

export interface FigmaColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface FigmaStyle {
  key: string;
  name: string;
  styleType: 'FILL' | 'TEXT' | 'EFFECT' | 'GRID';
  description?: string;
}

export interface FigmaComponent {
  key: string;
  name: string;
  description?: string;
  thumbnailUrl?: string;
  containingFrame?: { name: string };
}

export interface FigmaFileData {
  name: string;
  lastModified: string;
  thumbnailUrl?: string;
  styles: Record<string, FigmaStyle>;
  components: Record<string, FigmaComponent>;
}

export interface ExtractedDesignTokens {
  colors: Array<{ hex: string; name: string; role?: string }>;
  typography: Array<{ family: string; style?: string; role: string; size?: number }>;
  components: Array<{ key: string; name: string; thumbnailUrl?: string; description?: string }>;
}

// ═══ Helpers ═══

function rgbaToHex(color: FigmaColor): string {
  const r = Math.round(color.r * 255);
  const g = Math.round(color.g * 255);
  const b = Math.round(color.b * 255);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b
    .toString(16)
    .padStart(2, '0')}`.toUpperCase();
}

function inferColorRole(name: string): string | undefined {
  const lower = name.toLowerCase();
  if (lower.includes('primary')) return 'primary';
  if (lower.includes('secondary')) return 'secondary';
  if (lower.includes('accent')) return 'accent';
  if (lower.includes('background') || lower.includes('bg')) return 'background';
  if (lower.includes('text') || lower.includes('foreground')) return 'text';
  if (lower.includes('border') || lower.includes('stroke')) return 'border';
  if (lower.includes('error') || lower.includes('danger')) return 'error';
  if (lower.includes('success')) return 'success';
  if (lower.includes('warning')) return 'warning';
  return undefined;
}

function inferTypographyRole(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes('heading') || lower.includes('h1') || lower.includes('title'))
    return 'heading';
  if (lower.includes('h2') || lower.includes('subtitle')) return 'subheading';
  if (lower.includes('body') || lower.includes('paragraph')) return 'body';
  if (lower.includes('caption') || lower.includes('small')) return 'caption';
  if (lower.includes('button') || lower.includes('cta')) return 'button';
  if (lower.includes('label')) return 'label';
  return 'custom';
}

// ═══ Text extraction ═══

export interface ExtractedFigmaText {
  fileName: string;
  markdown: string;
  /** Pages that produced text, in canvas order. */
  pages: Array<{ name: string; frames: number; characters: number }>;
  textNodes: number;
  characters: number;
  truncated: boolean;
}

/** Nodes walked before we stop — a brand deck is hundreds, a design system is tens of thousands. */
const MAX_TEXT_NODES = 4000;

/** Frame/section-ish containers whose name is worth a heading. */
const CONTAINER_TYPES = new Set(['FRAME', 'SECTION', 'COMPONENT', 'COMPONENT_SET', 'GROUP']);

function isAutoName(name: string): boolean {
  return /^(frame|group|rectangle|ellipse|vector|slice|component|instance)[\s_-]*\d*$/i.test(
    String(name || '').trim()
  );
}

/** Escape the few characters that would turn extracted copy into accidental markdown. */
function escapeMd(s: string): string {
  return s.replace(/([#*_`>[\]])/g, '\\$1');
}

/**
 * Read every TEXT node in a Figma file and render it as markdown.
 *
 * This is the piece that turns a Figma file into raw material for a guideline,
 * and it existed only as a button in the plugin that downloaded a file on the
 * user's machine — an agent could not reach it and had to ask a human to click.
 * The plugin runs it inside the sandbox against the open document; the REST API
 * gives the same text for any file the user's token can read, with no plugin and
 * no open tab, which is what makes it usable headless.
 *
 * Nodes are emitted in canvas reading order (top-to-bottom, then left-to-right)
 * so a deck comes out in the order a person would read it, not in Figma's
 * internal child order.
 */
export async function extractTextAsMarkdown(
  fileKey: string,
  token: string
): Promise<ExtractedFigmaText> {
  // No `depth` — the shallow fetch used elsewhere stops above every TEXT node.
  const response = await fetch(`${FIGMA_API_BASE}/files/${fileKey}`, {
    headers: { 'X-Figma-Token': token },
  });
  if (!response.ok) {
    throw new Error(`Figma API error: ${response.status} - ${await response.text()}`);
  }
  const data: any = await response.json();

  const fileName: string = data?.name || 'Figma file';
  const lines: string[] = [`# ${fileName}`, ''];
  const pages: ExtractedFigmaText['pages'] = [];
  let textNodes = 0;
  let characters = 0;
  let truncated = false;

  /** Collect TEXT descendants of a node, in reading order. */
  const collectText = (node: any, out: Array<{ x: number; y: number; text: string }>): void => {
    if (!node || truncated) return;
    if (node.visible === false) return;
    if (node.type === 'TEXT') {
      const chars = String(node.characters || '').trim();
      if (chars) {
        if (textNodes >= MAX_TEXT_NODES) {
          truncated = true;
          return;
        }
        textNodes++;
        characters += chars.length;
        const box = node.absoluteBoundingBox || {};
        out.push({ x: Number(box.x) || 0, y: Number(box.y) || 0, text: chars });
      }
      return;
    }
    for (const child of node.children || []) collectText(child, out);
  };

  for (const page of data?.document?.children || []) {
    if (page?.type !== 'CANVAS') continue;
    const pageLines: string[] = [];
    let pageChars = 0;
    let frameCount = 0;

    for (const child of page.children || []) {
      const nodes: Array<{ x: number; y: number; text: string }> = [];
      collectText(child, nodes);
      if (!nodes.length) continue;

      // Reading order: rows top-to-bottom, then left-to-right within a row.
      nodes.sort((a, b) => (Math.abs(a.y - b.y) > 8 ? a.y - b.y : a.x - b.x));

      frameCount++;
      if (CONTAINER_TYPES.has(child.type) && child.name && !isAutoName(child.name)) {
        pageLines.push(`### ${escapeMd(child.name)}`, '');
      }
      for (const n of nodes) {
        pageChars += n.text.length;
        // Multi-line text nodes stay one block — a paragraph is one thought.
        pageLines.push(escapeMd(n.text.replace(/\r\n/g, '\n')), '');
      }
      if (truncated) break;
    }

    if (pageLines.length) {
      lines.push(`## ${escapeMd(page.name || 'Page')}`, '', ...pageLines);
      pages.push({ name: page.name || 'Page', frames: frameCount, characters: pageChars });
    }
    if (truncated) break;
  }

  if (truncated) {
    lines.push(
      '',
      `_Truncated at ${MAX_TEXT_NODES} text nodes. Extract specific pages for the rest._`
    );
  }

  return {
    fileName,
    markdown: lines
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim(),
    pages,
    textNodes,
    characters,
    truncated,
  };
}

// ═══ API Functions ═══

/**
 * Fetch file metadata and styles
 */
export async function getFileData(fileKey: string, token: string): Promise<FigmaFileData> {
  const response = await fetch(`${FIGMA_API_BASE}/files/${fileKey}?depth=1`, {
    headers: { 'X-Figma-Token': token },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Figma API error: ${response.status} - ${error}`);
  }

  const data = await response.json();

  return {
    name: data.name,
    lastModified: data.lastModified,
    thumbnailUrl: data.thumbnailUrl,
    styles: data.styles || {},
    components: data.components || {},
  };
}

/**
 * Get full style definitions (colors, text styles)
 */
export async function getFileStyles(
  fileKey: string,
  token: string
): Promise<{
  colors: Array<{ key: string; name: string; color: FigmaColor }>;
  textStyles: Array<{
    key: string;
    name: string;
    fontFamily: string;
    fontSize: number;
    fontWeight: number;
  }>;
}> {
  // First get the style keys from file
  const fileData = await getFileData(fileKey, token);
  const styleKeys = Object.keys(fileData.styles);

  if (styleKeys.length === 0) {
    return { colors: [], textStyles: [] };
  }

  // Fetch style nodes to get actual values
  const nodeIds = styleKeys.join(',');
  const response = await fetch(`${FIGMA_API_BASE}/files/${fileKey}/nodes?ids=${nodeIds}`, {
    headers: { 'X-Figma-Token': token },
  });

  if (!response.ok) {
    // Fallback: return just names without values
    const colors: Array<{ key: string; name: string; color: FigmaColor }> = [];
    const textStyles: Array<{
      key: string;
      name: string;
      fontFamily: string;
      fontSize: number;
      fontWeight: number;
    }> = [];

    for (const [key, style] of Object.entries(fileData.styles)) {
      if (style.styleType === 'FILL') {
        colors.push({ key, name: style.name, color: { r: 0.5, g: 0.5, b: 0.5, a: 1 } });
      } else if (style.styleType === 'TEXT') {
        textStyles.push({
          key,
          name: style.name,
          fontFamily: 'Inter',
          fontSize: 16,
          fontWeight: 400,
        });
      }
    }

    return { colors, textStyles };
  }

  const nodes = await response.json();
  const colors: Array<{ key: string; name: string; color: FigmaColor }> = [];
  const textStyles: Array<{
    key: string;
    name: string;
    fontFamily: string;
    fontSize: number;
    fontWeight: number;
  }> = [];

  for (const [key, style] of Object.entries(fileData.styles)) {
    const node = nodes.nodes?.[key]?.document;

    if (style.styleType === 'FILL' && node?.fills?.[0]?.color) {
      colors.push({
        key,
        name: style.name,
        color: node.fills[0].color,
      });
    } else if (style.styleType === 'TEXT' && node?.style) {
      textStyles.push({
        key,
        name: style.name,
        fontFamily: node.style.fontFamily || 'Inter',
        fontSize: node.style.fontSize || 16,
        fontWeight: node.style.fontWeight || 400,
      });
    }
  }

  return { colors, textStyles };
}

/**
 * Get component thumbnails
 */
export async function getComponentThumbnails(
  fileKey: string,
  componentIds: string[],
  token: string
): Promise<Record<string, string>> {
  if (componentIds.length === 0) return {};

  const ids = componentIds.join(',');
  const response = await fetch(
    `${FIGMA_API_BASE}/images/${fileKey}?ids=${ids}&format=png&scale=2`,
    { headers: { 'X-Figma-Token': token } }
  );

  if (!response.ok) {
    console.error('[FigmaAPI] Failed to get thumbnails');
    return {};
  }

  const data = await response.json();
  return data.images || {};
}

/**
 * Extract design tokens from a Figma file
 * Returns colors, typography, and components in BrandGuideline format
 */
export async function extractDesignTokens(
  fileKey: string,
  token: string
): Promise<ExtractedDesignTokens> {
  const [fileData, styles] = await Promise.all([
    getFileData(fileKey, token),
    getFileStyles(fileKey, token),
  ]);

  // Extract colors
  const colors = styles.colors.map((c) => ({
    hex: rgbaToHex(c.color),
    name: c.name,
    role: inferColorRole(c.name),
  }));

  // Extract typography
  const typography = styles.textStyles.map((t) => ({
    family: t.fontFamily,
    style: t.fontWeight >= 600 ? 'bold' : 'regular',
    role: inferTypographyRole(t.name),
    size: t.fontSize,
  }));

  // Extract components (potential logos)
  const componentEntries = Object.entries(fileData.components);
  const componentKeys = componentEntries.map(([key]) => key);

  // Get thumbnails for components
  const thumbnails = await getComponentThumbnails(fileKey, componentKeys, token);

  const components = componentEntries.map(([key, comp]) => ({
    key,
    name: comp.name,
    description: comp.description,
    thumbnailUrl: thumbnails[key],
  }));

  return { colors, typography, components };
}

/**
 * Parse Figma URL to extract file key
 */
export function parseFigmaUrl(url: string): { fileKey: string; nodeId?: string } | null {
  try {
    const parsed = new URL(url);

    if (!parsed.hostname.includes('figma.com')) {
      return null;
    }

    // Match /file/KEY or /design/KEY
    const match = parsed.pathname.match(/\/(file|design)\/([a-zA-Z0-9]+)/);
    if (!match) return null;

    const fileKey = match[2];

    // Extract node-id from query params if present
    const nodeId = parsed.searchParams.get('node-id')?.replace('-', ':') || undefined;

    return { fileKey, nodeId };
  } catch {
    return null;
  }
}
