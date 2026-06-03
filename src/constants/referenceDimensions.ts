export const REFERENCE_DIMENSIONS = {
  niche: ['luxury', 'tech', 'food', 'fashion', 'beauty', 'sports'],
  aesthetic: ['minimalist', 'brutalist', 'organic', 'retro', 'editorial', 'swiss'],
  vibe: ['premium', 'playful', 'corporate', 'edgy', 'warm', 'serene'],
  lighting: ['soft studio', 'golden hour', 'neon', 'flat', 'dramatic', 'rim'],
  texture: ['marble', 'concrete', 'wood', 'fabric', 'glossy', 'matte'],
  material: ['vinyl', 'metal', 'glass', 'paper', 'cardboard', 'ceramic'],
  angle: ['top-down', 'isometric', 'hero', 'close-up', 'eye-level', '45-degree'],
  color_mood: ['warm', 'cold', 'monochrome', 'vibrant', 'pastel', 'earth-tones'],
  mockup_type: ['packaging', 'stationery', 'apparel', 'signage', 'device', 'bottle'],
} as const;

export type ReferenceDimensionKey = keyof typeof REFERENCE_DIMENSIONS;
export type ReferenceDimensionValue<K extends ReferenceDimensionKey> =
  (typeof REFERENCE_DIMENSIONS)[K][number];
