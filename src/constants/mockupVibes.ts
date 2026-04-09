import {
  AVAILABLE_LOCATION_TAGS,
  AVAILABLE_ANGLE_TAGS,
  AVAILABLE_LIGHTING_TAGS,
  AVAILABLE_EFFECT_TAGS,
  AVAILABLE_MATERIAL_TAGS,
} from '@/utils/mockupConstants';

export type VibeSegment = 
  | 'construção' 
  | 'advocacia' 
  | 'saúde' 
  | 'sport' 
  | 'fashion' 
  | 'lifestyle' 
  | 'finance' 
  | 'tech' 
  | 'saas';

export type VibeStyle = 
  | 'elegante' 
  | 'artesanal' 
  | 'pop' 
  | 'energic' 
  | 'natural' 
  | 'industrial';

export interface VibeConfig {
  locationTags: string[];
  lightingTags: string[];
  angleTags: string[];
  effectTags: string[];
  materialTags: string[];
}

const pick = (source: readonly string[], tag: string): string => {
  if (!source.includes(tag)) {
    console.error(`[mockupVibes] Tag "${tag}" não existe no array fonte.`);
    return tag; // Fallback to string
  }
  return tag;
};

const loc = (t: string) => pick(AVAILABLE_LOCATION_TAGS, t);
const ang = (t: string) => pick(AVAILABLE_ANGLE_TAGS, t);
const lit = (t: string) => pick(AVAILABLE_LIGHTING_TAGS, t);
const eff = (t: string) => pick(AVAILABLE_EFFECT_TAGS, t);
const mat = (t: string) => pick(AVAILABLE_MATERIAL_TAGS, t);

export const VIBE_SEGMENTS: { id: VibeSegment; name: string; icon: string }[] = [
  { id: 'tech', name: 'Tech', icon: 'Cpu' },
  { id: 'saas', name: 'SaaS', icon: 'Cloud' },
  { id: 'finance', name: 'Finance', icon: 'BarChart' },
  { id: 'fashion', name: 'Fashion', icon: 'ShoppingBag' },
  { id: 'sport', name: 'Sport', icon: 'Trophy' },
  { id: 'saúde', name: 'Saúde', icon: 'Activity' },
  { id: 'advocacia', name: 'Advocacia', icon: 'Scale' },
  { id: 'construção', name: 'Construção', icon: 'HardHat' },
  { id: 'lifestyle', name: 'Lifestyle', icon: 'Coffee' },
];

export const VIBE_STYLES: { id: VibeStyle; name: string; icon: string }[] = [
  { id: 'elegante', name: 'Elegante', icon: 'Gem' },
  { id: 'artesanal', name: 'Artesanal', icon: 'Scissors' },
  { id: 'pop', name: 'Pop', icon: 'Palette' },
  { id: 'energic', name: 'Energic', icon: 'Zap' },
  { id: 'natural', name: 'Natural', icon: 'Leaf' },
  { id: 'industrial', name: 'Industrial', icon: 'Factory' },
];

// Base tags for each segment
const SEGMENT_BASES: Record<VibeSegment, Partial<VibeConfig>> = {
  tech: {
    locationTags: [loc('Modern Office'), loc('Urban Loft')],
    materialTags: [mat('Brushed Aluminum'), mat('Soft-touch Plastic')],
  },
  saas: {
    locationTags: [loc('Workspace'), loc('Modern Office')],
    effectTags: [eff('Micro-contrast')],
  },
  finance: {
    locationTags: [loc('Modern Office'), loc('Limestone Surfaces')],
    lightingTags: [lit('Bright Sunlight')],
  },
  fashion: {
    locationTags: [loc('Minimalist Studio'), loc('Urban City')],
    lightingTags: [lit('Studio Lighting'), lit('Hard Sunlight')],
  },
  sport: {
    locationTags: [loc('Urban City'), loc('Brutalist Concrete')],
    angleTags: [ang('Low Angle'), ang('Hero Angle')],
  },
  saúde: {
    locationTags: [loc('Minimalist Studio'), loc('Nature landscape')],
    lightingTags: [lit('Natural Light'), lit('Soft Light')],
  },
  advocacia: {
    locationTags: [loc('Modern Office'), loc('Limestone Surfaces')],
    materialTags: [mat('Tactile Paper Grain'), mat('Embossed')],
  },
  construção: {
    locationTags: [loc('Concrete'), loc('Urban City')],
    materialTags: [mat('Raw Linen'), mat('Liquid Chrome')],
  },
  lifestyle: {
    locationTags: [loc('Urban Loft'), loc('Wooden Table')],
    lightingTags: [lit('Golden Hour'), lit('Natural Light')],
  },
};

// Style overlays
const STYLE_OVERLAYS: Record<VibeStyle, Partial<VibeConfig>> = {
  elegante: {
    lightingTags: [lit('Cinematic'), lit('Rim Light'), lit('Soft Light')],
    effectTags: [eff('Anamorphic Flare'), eff('8k Resolution')],
    materialTags: [mat('Metallic Platinum'), mat('Frosted Glass')],
  },
  artesanal: {
    materialTags: [mat('Tactile Paper Grain'), mat('Raw Linen'), mat('Ceramic')],
    lightingTags: [lit('Natural Light')],
    effectTags: [eff('Micro-contrast')],
  },
  pop: {
    lightingTags: [lit('Hard Sunlight'), lit('Shadow overlay')],
    effectTags: [eff('High Contrast'), eff('Ray-tracing')],
    locationTags: [loc('Light Box')],
  },
  energic: {
    lightingTags: [lit('Rim Light'), lit('Cinematic')],
    effectTags: [eff('Lens Flare'), eff('Motion Blur')],
    angleTags: [ang('Dutch Angle'), ang('Hero Angle')],
  },
  natural: {
    locationTags: [loc('Nature landscape'), loc('Grass/Lawn')],
    lightingTags: [lit('Natural Light'), lit('Golden Hour')],
    effectTags: [eff('Bokeh')],
  },
  industrial: {
    locationTags: [loc('Brutalist Concrete'), loc('Concrete')],
    materialTags: [mat('Brushed Aluminum'), mat('Liquid Chrome')],
    lightingTags: [lit('Chiaroscuro')],
  },
};

export function getCombinedVibeConfig(segment: VibeSegment, style: VibeStyle): VibeConfig {
  const base = SEGMENT_BASES[segment];
  const overlay = STYLE_OVERLAYS[style];

  return {
    locationTags: [...(base.locationTags || []), ...(overlay.locationTags || [])].slice(0, 3),
    lightingTags: [...(base.lightingTags || []), ...(overlay.lightingTags || [])].slice(0, 3),
    angleTags: [...(base.angleTags || []), ...(overlay.angleTags || [])].slice(0, 3),
    effectTags: [...(base.effectTags || []), ...(overlay.effectTags || [])].slice(0, 3),
    materialTags: [...(base.materialTags || []), ...(overlay.materialTags || [])].slice(0, 3),
  };
}
