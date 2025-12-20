import type { GeminiModel, AspectRatio } from '../types';

export type TexturePresetType = 
  | 'wood-grain'
  | 'metal'
  | 'fabric'
  | 'glass'
  | 'concrete'
  | 'marble'
  | 'leather'
  | 'paper'
  | 'stone'
  | 'ceramic'
  | 'plastic'
  | 'brushed-metal';

export interface TexturePreset {
  id: TexturePresetType | string; // Allow custom IDs from admin
  name: string;
  description: string;
  prompt: string;
  aspectRatio: AspectRatio;
  model?: GeminiModel;
  tags?: string[]; // Tags for filtering
}

export const TEXTURE_PRESETS: TexturePreset[] = [
  {
    id: 'wood-grain',
    name: 'Wood Grain',
    description: 'Natural wood texture with grain patterns',
    prompt: 'Apply realistic wood grain texture to this image. Natural wood surface with visible grain patterns, knots, and natural variations. Warm tones, realistic depth and lighting.',
    aspectRatio: '16:9',
    model: 'gemini-2.5-flash-image',
  },
  {
    id: 'metal',
    name: 'Metal',
    description: 'Metallic surface with reflective properties',
    prompt: 'Apply realistic metal texture to this image. Metallic surface with reflective properties, subtle scratches, and industrial finish. Realistic lighting and reflections.',
    aspectRatio: '16:9',
    model: 'gemini-2.5-flash-image',
  },
  {
    id: 'fabric',
    name: 'Fabric',
    description: 'Textile material with woven texture',
    prompt: 'Apply realistic fabric texture to this image. Woven textile material with visible threads, natural folds, and soft surface. Realistic fabric depth and texture.',
    aspectRatio: '16:9',
    model: 'gemini-2.5-flash-image',
  },
  {
    id: 'glass',
    name: 'Glass',
    description: 'Transparent glass surface with reflections',
    prompt: 'Apply realistic glass texture to this image. Transparent glass surface with subtle reflections, refractions, and depth. Clean, polished finish with realistic lighting.',
    aspectRatio: '16:9',
    model: 'gemini-2.5-flash-image',
  },
  {
    id: 'concrete',
    name: 'Concrete',
    description: 'Industrial concrete surface',
    prompt: 'Apply realistic concrete texture to this image. Industrial concrete surface with natural variations, subtle cracks, and matte finish. Urban, architectural feel.',
    aspectRatio: '16:9',
    model: 'gemini-2.5-flash-image',
  },
  {
    id: 'marble',
    name: 'Marble',
    description: 'Luxurious marble with veining',
    prompt: 'Apply realistic marble texture to this image. Luxurious marble surface with natural veining patterns, polished finish, and elegant appearance. High-end, premium look.',
    aspectRatio: '16:9',
    model: 'gemini-2.5-flash-image',
  },
  {
    id: 'leather',
    name: 'Leather',
    description: 'Genuine leather texture',
    prompt: 'Apply realistic leather texture to this image. Genuine leather surface with natural grain, subtle imperfections, and rich texture. Premium, luxurious appearance.',
    aspectRatio: '16:9',
    model: 'gemini-2.5-flash-image',
  },
  {
    id: 'paper',
    name: 'Paper',
    description: 'Paper or cardstock texture',
    prompt: 'Apply realistic paper texture to this image. Paper or cardstock surface with subtle texture, natural fibers, and matte finish. Clean, professional appearance.',
    aspectRatio: '16:9',
    model: 'gemini-2.5-flash-image',
  },
  {
    id: 'stone',
    name: 'Stone',
    description: 'Natural stone surface',
    prompt: 'Apply realistic stone texture to this image. Natural stone surface with natural variations, mineral patterns, and rough texture. Earthy, organic feel.',
    aspectRatio: '16:9',
    model: 'gemini-2.5-flash-image',
  },
  {
    id: 'ceramic',
    name: 'Ceramic',
    description: 'Smooth ceramic finish',
    prompt: 'Apply realistic ceramic texture to this image. Smooth ceramic surface with glossy finish, subtle reflections, and clean appearance. Modern, refined look.',
    aspectRatio: '16:9',
    model: 'gemini-2.5-flash-image',
  },
  {
    id: 'plastic',
    name: 'Plastic',
    description: 'Synthetic plastic material',
    prompt: 'Apply realistic plastic texture to this image. Synthetic plastic material with smooth surface, subtle reflections, and modern finish. Clean, contemporary appearance.',
    aspectRatio: '16:9',
    model: 'gemini-2.5-flash-image',
  },
  {
    id: 'brushed-metal',
    name: 'Brushed Metal',
    description: 'Brushed metal with directional grain',
    prompt: 'Apply realistic brushed metal texture to this image. Brushed metal surface with directional grain patterns, subtle reflections, and industrial finish. Modern, sleek appearance.',
    aspectRatio: '16:9',
    model: 'gemini-2.5-flash-image',
  },
];
















