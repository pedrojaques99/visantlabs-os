import {
  Minimize2,
  ArrowLeftRight,
  Eraser,
  Stamp,
  Maximize2,
  FileCode,
  Image,
  QrCode,
  Pipette,
  CircleDot,
  LayoutGrid,
  Box,
  Paintbrush,
  Crown,
  Instagram,
  Palette,
  Calculator,
  Wand2,
  Megaphone,
  Search,
  Grid3X3,
  FileDown,
  Library,
  type LucideIcon,
} from '@/lib/ui/icons';

// ---------------------------------------------------------------------------
// MIME helpers
// ---------------------------------------------------------------------------

export type MimePattern =
  | 'image/*'
  | 'image/jpeg'
  | 'image/png'
  | 'image/webp'
  | 'image/svg+xml'
  | 'image/x-icon'
  | 'image/gif'
  | 'application/pdf'
  | 'text/*'
  | 'none';

export function mimeMatches(pattern: MimePattern, concrete: string): boolean {
  if (pattern === concrete) return true;
  if (pattern.endsWith('/*')) {
    return concrete.startsWith(pattern.replace('/*', '/'));
  }
  return false;
}

// ---------------------------------------------------------------------------
// Tool definition
// ---------------------------------------------------------------------------

export type ToolCategory =
  | 'pro'
  | 'creative'
  | 'image'
  | 'converters'
  | 'generators'
  | 'audio'
  | 'community'
  | 'admin';

export interface ToolDef {
  /** Stable identifier — NEVER localized. Used as pipeline `source`, lookup key. */
  id: string;
  /** English literal. Fallback label only — prefer `nameKey` via `toolLabel()`. */
  name: string;
  /**
   * i18n key for the UI label, pointing at the SAME `apps.<key>.name` the /apps
   * catalog renders, so a tool never shows two different names across screens.
   * Optional: registry tools without a catalog entry fall back to `name`.
   */
  nameKey?: string;
  path: string;
  icon: LucideIcon;
  category: ToolCategory;
  accepts: MimePattern[];
  outputs: MimePattern[];
  supportsBatch: boolean;
  supportsBrandContext: boolean;
  isExternal?: boolean;
  /** Tools that make sense as "send to" targets from other tools */
  isPipelineTarget: boolean;
}

// ---------------------------------------------------------------------------
// Registry — SSoT for all tools
// ---------------------------------------------------------------------------

export const TOOL_REGISTRY: ToolDef[] = [
  // ── Pro Tools ──────────────────────────────────────────────────────────
  {
    id: 'mockupmachine',
    name: 'Mockup Machine',
    nameKey: 'apps.mockupMachine.name',
    path: '/',
    icon: Crown,
    category: 'pro',
    accepts: ['image/*'],
    outputs: ['image/png', 'image/jpeg'],
    supportsBatch: false,
    supportsBrandContext: true,
    isPipelineTarget: true,
  },
  {
    id: 'canvas',
    name: 'Canvas',
    nameKey: 'apps.canvas.name',
    path: '/canvas',
    icon: LayoutGrid,
    category: 'pro',
    accepts: ['image/*'],
    outputs: ['image/png'],
    supportsBatch: false,
    supportsBrandContext: true,
    isPipelineTarget: true,
  },
  {
    id: 'content-studio',
    name: 'Content Studio',
    nameKey: 'apps.contentStudio.name',
    path: '/content-studio',
    icon: Wand2,
    category: 'pro',
    accepts: [],
    outputs: ['image/png', 'image/jpeg'],
    supportsBatch: false,
    supportsBrandContext: true,
    isPipelineTarget: false,
  },
  {
    id: 'campaigns',
    name: 'Campaigns',
    path: '/campaigns',
    icon: Megaphone,
    category: 'pro',
    accepts: [],
    outputs: ['image/png', 'image/jpeg'],
    supportsBatch: false,
    supportsBrandContext: true,
    isPipelineTarget: false,
  },

  // ── Creative Lab ───────────────────────────────────────────────────────
  {
    id: 'image-lab',
    name: 'Image Lab',
    nameKey: 'apps.imageLab.name',
    path: '/image-lab',
    icon: CircleDot,
    category: 'creative',
    accepts: ['image/*'],
    outputs: ['image/png', 'image/jpeg', 'image/webp'],
    supportsBatch: false,
    supportsBrandContext: false,
    isPipelineTarget: true,
  },
  {
    id: 'grid-machine',
    name: 'Grid Machine',
    nameKey: 'apps.gridMachine.name',
    path: '/grid-machine',
    icon: LayoutGrid,
    category: 'creative',
    accepts: ['image/*'],
    outputs: ['image/png'],
    supportsBatch: false,
    supportsBrandContext: false,
    isPipelineTarget: false,
  },
  {
    id: '3d-studio',
    name: '3D Studio',
    nameKey: 'apps.studio3d.name',
    path: '/3d-studio',
    icon: Box,
    category: 'creative',
    accepts: ['image/*'],
    outputs: ['image/png'],
    supportsBatch: false,
    supportsBrandContext: true,
    isPipelineTarget: false,
  },

  // ── Image Tools ────────────────────────────────────────────────────────
  {
    id: 'compress',
    name: 'Compressor',
    nameKey: 'apps.imageCompressor.name',
    path: '/compress',
    icon: Minimize2,
    category: 'image',
    accepts: ['image/jpeg', 'image/png', 'image/webp'],
    outputs: ['image/jpeg', 'image/png', 'image/webp'],
    supportsBatch: true,
    supportsBrandContext: true,
    isPipelineTarget: true,
  },
  {
    id: 'upscale',
    name: 'Upscale',
    nameKey: 'apps.bicubicUpscale.name',
    path: '/upscale',
    icon: Maximize2,
    category: 'image',
    accepts: ['image/jpeg', 'image/png', 'image/webp'],
    outputs: ['image/png'],
    supportsBatch: true,
    supportsBrandContext: false,
    isPipelineTarget: true,
  },
  {
    id: 'remove-bg',
    name: 'Remove BG',
    nameKey: 'apps.backgroundRemover.name',
    path: '/remove-bg',
    icon: Eraser,
    category: 'image',
    accepts: ['image/jpeg', 'image/png', 'image/webp'],
    outputs: ['image/png'],
    supportsBatch: true,
    supportsBrandContext: false,
    isPipelineTarget: true,
  },
  {
    id: 'watermark',
    name: 'Watermark',
    nameKey: 'apps.watermark.name',
    path: '/watermark',
    icon: Stamp,
    category: 'image',
    accepts: ['image/jpeg', 'image/png', 'image/webp'],
    outputs: ['image/png'],
    supportsBatch: true,
    supportsBrandContext: true,
    isPipelineTarget: true,
  },
  {
    id: 'visual-search',
    name: 'Visual Search',
    nameKey: 'apps.visualSearch.name',
    path: '/visual-search',
    icon: Search,
    category: 'image',
    accepts: ['image/*'],
    outputs: [],
    supportsBatch: false,
    supportsBrandContext: false,
    isPipelineTarget: false,
  },
  {
    id: 'references',
    name: 'Reference Library',
    path: '/references',
    icon: Library,
    category: 'image',
    accepts: ['image/*'],
    outputs: [],
    supportsBatch: true,
    supportsBrandContext: false,
    isPipelineTarget: false,
  },

  // ── Converters ─────────────────────────────────────────────────────────
  {
    id: 'converter',
    name: 'Converter',
    nameKey: 'apps.fileConverter.name',
    path: '/converter',
    icon: ArrowLeftRight,
    category: 'converters',
    accepts: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
    outputs: ['image/png', 'image/jpeg', 'image/webp', 'application/pdf', 'image/x-icon'],
    supportsBatch: true,
    supportsBrandContext: false,
    isPipelineTarget: true,
  },
  {
    id: 'svg-optimizer',
    name: 'SVG Optimizer',
    nameKey: 'apps.svgOptimizer.name',
    path: '/svg-optimizer',
    icon: FileCode,
    category: 'converters',
    accepts: ['image/svg+xml'],
    outputs: ['image/svg+xml'],
    supportsBatch: true,
    supportsBrandContext: false,
    isPipelineTarget: true,
  },
  {
    id: 'color-converter',
    name: 'Color Converter',
    nameKey: 'apps.colorConverter.name',
    path: '/color-converter',
    icon: Pipette,
    category: 'converters',
    accepts: ['none'],
    outputs: ['none'],
    supportsBatch: false,
    supportsBrandContext: false,
    isPipelineTarget: false,
  },

  // ── Utilities ──────────────────────────────────────────────────────────
  {
    id: 'grid-paint',
    name: 'Grid Paint',
    nameKey: 'apps.gridPaint.name',
    path: '/grid-paint',
    icon: Grid3X3,
    category: 'creative',
    accepts: ['none'],
    outputs: ['image/png', 'image/svg+xml'],
    supportsBatch: false,
    supportsBrandContext: false,
    isPipelineTarget: false,
  },
  {
    id: 'color-palette',
    name: 'Color Palette',
    path: '/color-palette',
    icon: Palette,
    category: 'converters',
    accepts: ['image/*'],
    outputs: ['none'],
    supportsBatch: false,
    supportsBrandContext: false,
    isPipelineTarget: false,
  },

  // ── PDF Tools ──────────────────────────────────────────────────────────
  {
    id: 'pdf-compress',
    name: 'PDF Compress',
    nameKey: 'apps.pdfCompress.name',
    path: '/pdf-compress',
    icon: FileDown,
    category: 'converters',
    accepts: ['application/pdf'],
    outputs: ['application/pdf'],
    supportsBatch: true,
    supportsBrandContext: false,
    isPipelineTarget: true,
  },

  // ── Generators ─────────────────────────────────────────────────────────
  {
    id: 'qrcode',
    name: 'QR Code',
    nameKey: 'apps.qrCode.name',
    path: '/qrcode',
    icon: QrCode,
    category: 'generators',
    accepts: ['none'],
    outputs: ['image/png'],
    supportsBatch: false,
    supportsBrandContext: false,
    isPipelineTarget: false,
  },
  {
    id: 'favicon',
    name: 'Favicon Generator',
    nameKey: 'apps.faviconGenerator.name',
    path: '/favicon',
    icon: Image,
    category: 'generators',
    accepts: ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'],
    outputs: ['image/png', 'image/x-icon'],
    supportsBatch: false,
    supportsBrandContext: true,
    isPipelineTarget: true,
  },
  {
    id: 'og-image',
    name: 'OG Image',
    nameKey: 'apps.ogImage.name',
    path: '/og-image',
    icon: Image,
    category: 'generators',
    accepts: ['image/*'],
    outputs: ['image/png'],
    supportsBatch: false,
    supportsBrandContext: true,
    isPipelineTarget: true,
  },
];

// ---------------------------------------------------------------------------
// Lookup helpers
// ---------------------------------------------------------------------------

const byId = new Map(TOOL_REGISTRY.map((t) => [t.id, t]));

/**
 * Localized UI label for a tool. Falls back to the English `name` literal when
 * the tool has no catalog entry, or when the key is missing from the locales
 * (our `translate()` echoes the key back in that case).
 */
export function toolLabel(tool: ToolDef, t: (key: string) => string): string {
  if (!tool.nameKey) return tool.name;
  const translated = t(tool.nameKey);
  return translated && translated !== tool.nameKey ? translated : tool.name;
}

export function getToolById(id: string): ToolDef | undefined {
  return byId.get(id);
}

/** Tools that can receive an asset with the given MIME type via pipeline */
export function getCompatibleTargets(outputMime: string, excludeId?: string): ToolDef[] {
  return TOOL_REGISTRY.filter(
    (t) =>
      t.isPipelineTarget && t.id !== excludeId && t.accepts.some((a) => mimeMatches(a, outputMime))
  );
}

/** All tools that support brand context injection */
export function getBrandAwareTools(): ToolDef[] {
  return TOOL_REGISTRY.filter((t) => t.supportsBrandContext);
}
