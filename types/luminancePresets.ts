import type { GeminiModel, AspectRatio } from '../types';

export type LuminancePresetType = 
  | 'natural-light'
  | 'studio-lighting'
  | 'golden-hour'
  | 'dramatic-shadows'
  | 'soft-light'
  | 'hard-light'
  | 'rim-light'
  | 'ambient-light'
  | 'sunset'
  | 'blue-hour'
  | 'overcast'
  | 'spotlight';

export interface LuminancePreset {
  id: LuminancePresetType | string; // Allow custom IDs from admin
  name: string;
  description: string;
  prompt: string;
  aspectRatio: AspectRatio;
  model?: GeminiModel;
  tags?: string[]; // Tags for filtering
}

export const LUMINANCE_PRESETS: LuminancePreset[] = [
  {
    id: 'natural-light',
    name: 'Natural Light',
    description: 'Soft, natural daylight',
    prompt: 'Apply natural daylight lighting to this image. Soft, even natural light with realistic shadows and highlights. Bright, clear, and natural appearance.',
    aspectRatio: '16:9',
    model: 'gemini-2.5-flash-image',
  },
  {
    id: 'studio-lighting',
    name: 'Studio Lighting',
    description: 'Professional studio lighting setup',
    prompt: 'Apply professional studio lighting to this image. Controlled, even lighting with soft shadows and professional appearance. Clean, commercial look.',
    aspectRatio: '16:9',
    model: 'gemini-2.5-flash-image',
  },
  {
    id: 'golden-hour',
    name: 'Golden Hour',
    description: 'Warm sunset or sunrise lighting',
    prompt: 'Apply golden hour lighting to this image. Warm, golden sunlight with soft shadows and warm tones. Magical, golden atmosphere typical of sunrise or sunset.',
    aspectRatio: '16:9',
    model: 'gemini-2.5-flash-image',
  },
  {
    id: 'dramatic-shadows',
    name: 'Dramatic Shadows',
    description: 'High contrast with strong shadows',
    prompt: 'Apply dramatic lighting with strong shadows to this image. High contrast lighting with deep shadows and bright highlights. Dramatic, cinematic appearance.',
    aspectRatio: '16:9',
    model: 'gemini-2.5-flash-image',
  },
  {
    id: 'soft-light',
    name: 'Soft Light',
    description: 'Gentle, diffused lighting',
    prompt: 'Apply soft, diffused lighting to this image. Gentle, even light with soft shadows and smooth transitions. Calm, peaceful atmosphere.',
    aspectRatio: '16:9',
    model: 'gemini-2.5-flash-image',
  },
  {
    id: 'hard-light',
    name: 'Hard Light',
    description: 'Direct, harsh lighting',
    prompt: 'Apply hard, direct lighting to this image. Strong, directional light with sharp shadows and high contrast. Bold, striking appearance.',
    aspectRatio: '16:9',
    model: 'gemini-2.5-flash-image',
  },
  {
    id: 'rim-light',
    name: 'Rim Light',
    description: 'Backlighting with edge glow',
    prompt: 'Apply rim lighting to this image. Backlighting that creates a glowing edge around the subject with dramatic separation from background. Cinematic, professional look.',
    aspectRatio: '16:9',
    model: 'gemini-2.5-flash-image',
  },
  {
    id: 'ambient-light',
    name: 'Ambient Light',
    description: 'Soft, ambient room lighting',
    prompt: 'Apply ambient room lighting to this image. Soft, warm ambient light with natural indoor atmosphere. Comfortable, cozy lighting.',
    aspectRatio: '16:9',
    model: 'gemini-2.5-flash-image',
  },
  {
    id: 'sunset',
    name: 'Sunset',
    description: 'Warm sunset lighting with orange tones',
    prompt: 'Apply sunset lighting to this image. Warm, orange and pink tones with soft shadows and romantic atmosphere. Beautiful, warm sunset glow.',
    aspectRatio: '16:9',
    model: 'gemini-2.5-flash-image',
  },
  {
    id: 'blue-hour',
    name: 'Blue Hour',
    description: 'Cool blue twilight lighting',
    prompt: 'Apply blue hour lighting to this image. Cool, blue tones with soft, diffused light typical of twilight. Mysterious, atmospheric appearance.',
    aspectRatio: '16:9',
    model: 'gemini-2.5-flash-image',
  },
  {
    id: 'overcast',
    name: 'Overcast',
    description: 'Soft, diffused overcast sky lighting',
    prompt: 'Apply overcast sky lighting to this image. Soft, even diffused light with cool tones and minimal shadows. Calm, neutral lighting.',
    aspectRatio: '16:9',
    model: 'gemini-2.5-flash-image',
  },
  {
    id: 'spotlight',
    name: 'Spotlight',
    description: 'Focused spotlight effect',
    prompt: 'Apply spotlight lighting to this image. Focused, dramatic light that highlights the subject with strong contrast and dark surroundings. Theatrical, dramatic effect.',
    aspectRatio: '16:9',
    model: 'gemini-2.5-flash-image',
  },
];
















