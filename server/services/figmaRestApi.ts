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
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`.toUpperCase();
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
  if (lower.includes('heading') || lower.includes('h1') || lower.includes('title')) return 'heading';
  if (lower.includes('h2') || lower.includes('subtitle')) return 'subheading';
  if (lower.includes('body') || lower.includes('paragraph')) return 'body';
  if (lower.includes('caption') || lower.includes('small')) return 'caption';
  if (lower.includes('button') || lower.includes('cta')) return 'button';
  if (lower.includes('label')) return 'label';
  return 'custom';
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
export async function getFileStyles(fileKey: string, token: string): Promise<{
  colors: Array<{ key: string; name: string; color: FigmaColor }>;
  textStyles: Array<{ key: string; name: string; fontFamily: string; fontSize: number; fontWeight: number }>;
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
    const textStyles: Array<{ key: string; name: string; fontFamily: string; fontSize: number; fontWeight: number }> = [];

    for (const [key, style] of Object.entries(fileData.styles)) {
      if (style.styleType === 'FILL') {
        colors.push({ key, name: style.name, color: { r: 0.5, g: 0.5, b: 0.5, a: 1 } });
      } else if (style.styleType === 'TEXT') {
        textStyles.push({ key, name: style.name, fontFamily: 'Inter', fontSize: 16, fontWeight: 400 });
      }
    }

    return { colors, textStyles };
  }

  const nodes = await response.json();
  const colors: Array<{ key: string; name: string; color: FigmaColor }> = [];
  const textStyles: Array<{ key: string; name: string; fontFamily: string; fontSize: number; fontWeight: number }> = [];

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
export async function extractDesignTokens(fileKey: string, token: string): Promise<ExtractedDesignTokens> {
  const [fileData, styles] = await Promise.all([
    getFileData(fileKey, token),
    getFileStyles(fileKey, token),
  ]);

  // Extract colors
  const colors = styles.colors.map(c => ({
    hex: rgbaToHex(c.color),
    name: c.name,
    role: inferColorRole(c.name),
  }));

  // Extract typography
  const typography = styles.textStyles.map(t => ({
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
