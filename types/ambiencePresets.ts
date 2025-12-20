import type { GeminiModel, AspectRatio } from '../types';

export type AmbiencePresetType = 
  | 'studio'
  | 'outdoor'
  | 'urban'
  | 'nature'
  | 'minimalist'
  | 'industrial'
  | 'luxury'
  | 'cozy'
  | 'modern'
  | 'vintage'
  | 'futuristic'
  | 'tropical';

export interface AmbiencePreset {
  id: AmbiencePresetType | string; // Allow custom IDs from admin
  name: string;
  description: string;
  prompt: string;
  aspectRatio: AspectRatio;
  model?: GeminiModel;
  tags?: string[]; // Tags for filtering
}

export const AMBIENCE_PRESETS: AmbiencePreset[] = [
  {
    id: 'studio',
    name: 'Studio',
    description: 'Clean studio environment with neutral background',
    prompt: 'Place this image in a clean studio environment with neutral background, professional lighting, and minimal distractions. Focus on the subject with clean, modern setting.',
    aspectRatio: '16:9',
    model: 'gemini-2.5-flash-image',
  },
  {
    id: 'outdoor',
    name: 'Outdoor',
    description: 'Natural outdoor setting',
    prompt: 'Place this image in a natural outdoor setting with natural lighting, open space, and environmental context. Realistic outdoor atmosphere and natural elements.',
    aspectRatio: '16:9',
    model: 'gemini-2.5-flash-image',
  },
  {
    id: 'urban',
    name: 'Urban',
    description: 'City street or urban environment',
    prompt: 'Place this image in an urban city environment with street elements, buildings, and city atmosphere. Modern urban setting with realistic cityscape background.',
    aspectRatio: '16:9',
    model: 'gemini-2.5-flash-image',
  },
  {
    id: 'nature',
    name: 'Nature',
    description: 'Natural landscape or forest setting',
    prompt: 'Place this image in a natural landscape setting with trees, plants, and natural elements. Organic, peaceful environment with natural beauty.',
    aspectRatio: '16:9',
    model: 'gemini-2.5-flash-image',
  },
  {
    id: 'minimalist',
    name: 'Minimalist',
    description: 'Clean, minimal background',
    prompt: 'Place this image in a minimalist environment with clean lines, simple background, and focus on the subject. Modern, uncluttered setting.',
    aspectRatio: '16:9',
    model: 'gemini-2.5-flash-image',
  },
  {
    id: 'industrial',
    name: 'Industrial',
    description: 'Industrial warehouse or factory setting',
    prompt: 'Place this image in an industrial environment with exposed brick, metal structures, and industrial elements. Raw, authentic industrial atmosphere.',
    aspectRatio: '16:9',
    model: 'gemini-2.5-flash-image',
  },
  {
    id: 'luxury',
    name: 'Luxury',
    description: 'High-end, luxurious setting',
    prompt: 'Place this image in a luxurious, high-end environment with premium materials, elegant decor, and sophisticated atmosphere. Premium, refined setting.',
    aspectRatio: '16:9',
    model: 'gemini-2.5-flash-image',
  },
  {
    id: 'cozy',
    name: 'Cozy',
    description: 'Warm, comfortable home setting',
    prompt: 'Place this image in a cozy, warm home environment with comfortable furniture, soft lighting, and inviting atmosphere. Comfortable, welcoming setting.',
    aspectRatio: '16:9',
    model: 'gemini-2.5-flash-image',
  },
  {
    id: 'modern',
    name: 'Modern',
    description: 'Contemporary modern interior',
    prompt: 'Place this image in a modern, contemporary interior with sleek furniture, clean design, and contemporary style. Modern, stylish environment.',
    aspectRatio: '16:9',
    model: 'gemini-2.5-flash-image',
  },
  {
    id: 'vintage',
    name: 'Vintage',
    description: 'Retro or vintage setting',
    prompt: 'Place this image in a vintage, retro environment with classic elements, nostalgic atmosphere, and period-appropriate decor. Timeless, classic setting.',
    aspectRatio: '16:9',
    model: 'gemini-2.5-flash-image',
  },
  {
    id: 'futuristic',
    name: 'Futuristic',
    description: 'Sci-fi or futuristic environment',
    prompt: 'Place this image in a futuristic, sci-fi environment with advanced technology, sleek surfaces, and cutting-edge design. Modern, forward-looking setting.',
    aspectRatio: '16:9',
    model: 'gemini-2.5-flash-image',
  },
  {
    id: 'tropical',
    name: 'Tropical',
    description: 'Tropical beach or paradise setting',
    prompt: 'Place this image in a tropical paradise setting with palm trees, beach elements, and vibrant tropical atmosphere. Exotic, vacation-like environment.',
    aspectRatio: '16:9',
    model: 'gemini-2.5-flash-image',
  },
];
















