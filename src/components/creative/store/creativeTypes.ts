export type CreativeFormat = '1:1' | '9:16' | '16:9' | '4:5';

export interface TextLayerData {
  type: 'text';
  content: string;        // supports <accent>word</accent>
  role: 'headline' | 'subheadline' | 'body' | 'custom';
  position: { x: number; y: number };  // 0-1 normalized (top-left origin)
  size: { w: number; h: number };      // 0-1 normalized
  align: 'left' | 'center' | 'right';
  fontSize: number;       // px at preview resolution
  fontFamily: string;     // resolved family name
  color: string;          // hex
  bold: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  /** Rotation in degrees, default 0 */
  rotation?: number;
  // ── Konva-rendered visual effects (added 2026-04-27, all optional) ──
  /** 0-1; defaults to 1 (fully opaque) when undefined */
  opacity?: number;
  /** Drop-shadow color, e.g. "rgba(0,0,0,0.5)" or "#000000". Required for shadow to render. */
  shadowColor?: string;
  /** Shadow blur radius in px (Konva pixel units). Default 0 = sharp. */
  shadowBlur?: number;
  /** Shadow X offset in px. Default 0. */
  shadowOffsetX?: number;
  /** Shadow Y offset in px. Default 0. */
  shadowOffsetY?: number;
}

export interface LogoLayerData {
  type: 'logo';
  url: string;
  position: { x: number; y: number };
  size: { w: number; h: number };
  /** Rotation in degrees, default 0 */
  rotation?: number;
  // ── Konva-rendered visual effects (added 2026-04-27, all optional) ──
  /** 0-1; defaults to 1 (fully opaque) when undefined */
  opacity?: number;
  /** Drop-shadow color, e.g. "rgba(0,0,0,0.5)" or "#000000". Required for shadow to render. */
  shadowColor?: string;
  /** Shadow blur radius in px (Konva pixel units). Default 0 = sharp. */
  shadowBlur?: number;
  /** Shadow X offset in px. Default 0. */
  shadowOffsetX?: number;
  /** Shadow Y offset in px. Default 0. */
  shadowOffsetY?: number;
  /**
   * Konva filter values. All optional; presence (non-zero / true) triggers
   * cache() + filter on the node. Renderer maps these to Konva.Filters.*.
   */
  filters?: {
    brightness?: number;  // -1 .. 1
    contrast?: number;    // -100 .. 100
    blur?: number;        // 0 .. 40 (px)
    grayscale?: boolean;
  };
  /** Optional crop window in 0-1 of source image dimensions. */
  crop?: { x: number; y: number; w: number; h: number };
}

export interface ShapeLayerData {
  type: 'shape';
  shape: 'rect';
  color: string;          // hex
  position: { x: number; y: number };
  size: { w: number; h: number };
  /** Rotation in degrees, default 0 */
  rotation?: number;
  /** Corner radius in px (Konva pixel units). Default 0 = sharp. */
  cornerRadius?: number;
  /** Stroke color (hex). Required with strokeWidth > 0 to render border. */
  strokeColor?: string;
  /** Stroke width in px. Default 0 = no border. */
  strokeWidth?: number;
  // ── Konva-rendered visual effects (added 2026-04-27, all optional) ──
  /** 0-1; defaults to 1 (fully opaque) when undefined */
  opacity?: number;
  /** Drop-shadow color, e.g. "rgba(0,0,0,0.5)" or "#000000". Required for shadow to render. */
  shadowColor?: string;
  /** Shadow blur radius in px (Konva pixel units). Default 0 = sharp. */
  shadowBlur?: number;
  /** Shadow X offset in px. Default 0. */
  shadowOffsetX?: number;
  /** Shadow Y offset in px. Default 0. */
  shadowOffsetY?: number;
}

export interface GroupLayerData {
  type: 'group';
  children: string[];      // IDs of child layers
  position: { x: number; y: number };
  size: { w: number; h: number };
}

export type CreativeLayerData = TextLayerData | LogoLayerData | ShapeLayerData | GroupLayerData;

export interface CreativeLayer {
  id: string;
  visible: boolean;
  /** When true: drag/select disabled on canvas, kept editable from sidebar. Default false. */
  locked?: boolean;
  zIndex: number;
  data: CreativeLayerData;
}

export interface CreativeOverlay {
  type: 'gradient' | 'solid';
  direction?: 'top' | 'bottom' | 'left' | 'right';
  opacity: number;
  color?: string;
}

export interface CreativeAIResponse {
  background?: { prompt: string };
  overlay?: CreativeOverlay;
  layers: CreativeLayerData[];
}

export type CreativeStatus = 'setup' | 'generating' | 'editing';

export type CreativeTool = 'select' | 'lasso';

export type BackgroundLayerData = {
  type: 'background';
  url: string | null;
};
