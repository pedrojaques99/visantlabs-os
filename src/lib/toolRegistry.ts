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
  Search,
  Grid3X3,
  FileDown,
  type LucideIcon,
} from 'lucide-react';

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
  id: string;
  name: string;
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
    path: '/content-studio',
    icon: Wand2,
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
    path: '/visual-search',
    icon: Search,
    category: 'image',
    accepts: ['image/*'],
    outputs: [],
    supportsBatch: false,
    supportsBrandContext: false,
    isPipelineTarget: false,
  },

  // ── Converters ─────────────────────────────────────────────────────────
  {
    id: 'converter',
    name: 'Converter',
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
