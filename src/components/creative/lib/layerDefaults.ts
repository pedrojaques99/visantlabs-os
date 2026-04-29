import type { TextLayerData, ShapeLayerData, LogoLayerData } from '../store/creativeTypes';

/**
 * Single source of truth for layer creation defaults — drop, paste,
 * keyboard-add all funnel through these so layouts stay coherent.
 *
 * Drop offsets center the new layer on the cursor (subtract half the default
 * width/height in normalized coords).
 */

export const DEFAULT_FONT_SIZE = 48;
export const DEFAULT_TEXT_COLOR = '#ffffff';

// Default sizes (normalized 0-1 of canvas dimensions)
export const DEFAULTS = {
  text: { w: 0.4, h: 0.08 },
  shape: { w: 0.15, h: 0.15 },
  logo: { w: 0.2, h: 0.1 },
  image: { w: 0.4, h: 0.3 },
} as const;

// Drop centering — half the default size, used as offset from cursor pos
const half = (size: { w: number; h: number }) => ({ x: size.w / 2, y: size.h / 2 });

export const DROP_OFFSETS = {
  text: { x: half(DEFAULTS.text).x, y: half(DEFAULTS.text).y },
  shape: { x: half(DEFAULTS.shape).x, y: half(DEFAULTS.shape).y },
  logo: { x: half(DEFAULTS.logo).x, y: half(DEFAULTS.logo).y },
  image: { x: half(DEFAULTS.image).x, y: half(DEFAULTS.image).y },
} as const;

export const buildTextLayerData = (
  pos: { x: number; y: number },
  fontFamily: string
): TextLayerData => ({
  type: 'text',
  content: 'Novo texto',
  role: 'body',
  position: { x: pos.x - DROP_OFFSETS.text.x, y: pos.y - DROP_OFFSETS.text.y },
  size: DEFAULTS.text,
  align: 'left',
  fontSize: DEFAULT_FONT_SIZE,
  fontFamily,
  color: DEFAULT_TEXT_COLOR,
  bold: false,
});

export const buildShapeLayerData = (
  pos: { x: number; y: number },
  color: string
): ShapeLayerData => ({
  type: 'shape',
  shape: 'rect',
  color,
  position: { x: pos.x - DROP_OFFSETS.shape.x, y: pos.y - DROP_OFFSETS.shape.y },
  size: DEFAULTS.shape,
});

export const buildLogoLayerData = (
  pos: { x: number; y: number },
  url: string,
  /** logo = compact aspect, image = larger square-ish */
  variant: 'logo' | 'image' = 'logo'
): LogoLayerData => {
  const size = variant === 'logo' ? DEFAULTS.logo : DEFAULTS.image;
  const offsets = variant === 'logo' ? DROP_OFFSETS.logo : DROP_OFFSETS.image;
  return {
    type: 'logo',
    url,
    position: { x: pos.x - offsets.x, y: pos.y - offsets.y },
    size,
  };
};
