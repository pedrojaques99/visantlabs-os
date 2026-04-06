import type { CreativeFormat } from '../store/creativeTypes';

export interface Dimensions {
  width: number;
  height: number;
}

export const FORMAT_DIMENSIONS: Record<CreativeFormat, Dimensions> = {
  '1:1':  { width: 1080, height: 1080 },
  '9:16': { width: 1080, height: 1920 },
  '16:9': { width: 1920, height: 1080 },
  '4:5':  { width: 1080, height: 1350 },
};

/**
 * Returns preview dimensions that fit within maxWidth/maxHeight while
 * preserving the format's aspect ratio. The actual export uses FORMAT_DIMENSIONS.
 */
export function getPreviewDimensions(
  format: CreativeFormat,
  maxWidth: number,
  maxHeight: number
): Dimensions {
  const target = FORMAT_DIMENSIONS[format];
  const scale = Math.min(maxWidth / target.width, maxHeight / target.height, 1);
  return {
    width: Math.round(target.width * scale),
    height: Math.round(target.height * scale),
  };
}
