import { Sparkles, Building2, Palmtree, Gem, Camera, Zap, Palette } from 'lucide-react';

export interface MockupVibe {
  id: string;
  name: string;
  description: string;
  iconName: string;
  config: {
    categoryTags: string[];
    locationTags: string[];
    lightingTags: string[];
    angleTags: string[];
    effectTags: string[];
    materialTags: string[];
  };
}

export const MOCKUP_VIBES: MockupVibe[] = [
  {
    id: 'studio-clean',
    name: 'Studio Clean',
    description: 'Profissional, fundo minimalista e iluminação controlada.',
    iconName: 'Camera',
    config: {
      categoryTags: ['Product Photography', 'Clean Background'],
      locationTags: ['Studio'],
      lightingTags: ['Soft Light', 'Diffused Lighting'],
      angleTags: ['Front View', '45° View'],
      effectTags: [],
      materialTags: ['Matte'],
    },
  },
  {
    id: 'urban-raw',
    name: 'Urban Raw',
    description: 'Ambiente urbano, texturas de concreto e luz natural.',
    iconName: 'Building2',
    config: {
      categoryTags: ['Street Photography', 'Urban Setting'],
      locationTags: ['City Street', 'Concrete Wall'],
      lightingTags: ['Natural Light', 'Hard Shadows'],
      angleTags: ['Low Angle', 'Wide Shot'],
      effectTags: ['Film Grain'],
      materialTags: ['Textured'],
    },
  },
  {
    id: 'nature-organic',
    name: 'Nature Organic',
    description: 'Elementos naturais, plantas e luz solar suave.',
    iconName: 'Palmtree',
    config: {
      categoryTags: ['Lifestyle Photography', 'Organic Setting'],
      locationTags: ['Garden', 'Forest', 'Wooden Table'],
      lightingTags: ['Golden Hour', 'Dappled Light'],
      angleTags: ['Top Down', 'Eye Level'],
      effectTags: ['Bokeh'],
      materialTags: ['Wood', 'Fabric'],
    },
  },
  {
    id: 'luxury-elite',
    name: 'Luxury Elite',
    description: 'Elegância, tons escuros e materiais nobres.',
    iconName: 'Gem',
    config: {
      categoryTags: ['Luxury Branding', 'High-End Product'],
      locationTags: ['Marble Surface', 'Dark Room'],
      lightingTags: ['Rim Lighting', 'Dramatic Shadows'],
      angleTags: ['Close-Up', 'Macro'],
      effectTags: ['Reflective'],
      materialTags: ['Glass', 'Gold', 'Silk'],
    },
  },
  {
    id: 'pop-color',
    name: 'Pop Color',
    description: 'Cores vibrantes, alto contraste e energia.',
    iconName: 'Palette',
    config: {
      categoryTags: ['Bold Design', 'Creative Layout'],
      locationTags: ['Studio Foreground', 'Colored Backdrop'],
      lightingTags: ['Neon Light', 'Vibrant Lighting'],
      angleTags: ['Dynamic Angle'],
      effectTags: ['Saturated Colors'],
      materialTags: ['Plastic', 'Glossy'],
    },
  },
  {
    id: 'cinematic-zap',
    name: 'Cinematic',
    description: 'Estilo de cinema, iluminação dramática e profundidade.',
    iconName: 'Zap',
    config: {
      categoryTags: ['Cinematic Shot', 'Storytelling'],
      locationTags: ['Indoors', 'Atmospheric'],
      lightingTags: ['Volumetric Lighting', 'Backlit'],
      angleTags: ['Low Angle', 'Cinematic Pan'],
      effectTags: ['Mist', 'Lens Flare'],
      materialTags: ['Metalic'],
    },
  },
];
