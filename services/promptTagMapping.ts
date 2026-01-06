import {
  AVAILABLE_ANGLE_TAGS,
  AVAILABLE_LIGHTING_TAGS,
  AVAILABLE_EFFECT_TAGS,
  AVAILABLE_MATERIAL_TAGS,
} from '../utils/mockupConstants.js';
import { getBackgroundsForBranding } from '../utils/promptHelpers.js';

/**
 * Tag mapping interface for all tag categories
 */
export interface TagMapping {
  location: string[];
  angle: string[];
  lighting: string[];
  effect: string[];
  material: string[];
}

/**
 * Maps branding tags to appropriate lighting tags
 */
function getLightingTagsForBranding(brandingTags: string[]): string[] {
  const allLightings = [...AVAILABLE_LIGHTING_TAGS];
  const brandingLightingMap: Record<string, string[]> = {
    "Luxury": ["Studio Lighting", "Soft Light", "Diffused", "Cinematic", "Chiaroscuro"],
    "Exclusive": ["Studio Lighting", "Soft Light", "Diffused", "Cinematic"],
    "Tech": ["Cinematic", "Global Illumination", "Studio Lighting", "Soft Light"],
    "Modern": ["Cinematic", "Global Illumination", "Studio Lighting", "Soft Light"],
    "Eco-friendly": ["Natural Light", "Golden Hour", "Soft Light", "Diffused"],
    "Handmade": ["Natural Light", "Golden Hour", "Soft Light", "Overcast"],
    "Sport": ["Direct Sunlight", "Golden Hour", "Hard Sunlight", "Cinematic"],
    "Energetic": ["Direct Sunlight", "Golden Hour", "Hard Sunlight", "Cinematic"],
    "Fashion": ["Studio Lighting", "Soft Light", "Diffused", "Cinematic"],
    "Feminine": ["Soft Light", "Diffused", "Golden Hour", "Natural Light"],
    "Corporate": ["Studio Lighting", "Soft Light", "Diffused", "Natural Light"],
    "Professional": ["Studio Lighting", "Soft Light", "Diffused", "Natural Light"],
    "Creative": ["Cinematic", "Golden Hour", "Studio Lighting", "Soft Light"],
    "Playful": ["Cinematic", "Golden Hour", "Direct Sunlight", "Soft Light"],
    "Vintage": ["Overcast", "Natural Light", "Soft Light", "Golden Hour"],
    "Food": ["Golden Hour", "Natural Light", "Soft Light", "Diffused"],
    "Travel & Hospitality": ["Golden Hour", "Blue Hour", "Natural Light", "Soft Light"],
  };

  if (brandingTags.length === 0) {
    return allLightings;
  }

  const relevantLightings = new Set<string>();
  brandingTags.forEach(tag => {
    const lightings = brandingLightingMap[tag] || [];
    lightings.forEach(lighting => relevantLightings.add(lighting));
  });

  if (relevantLightings.size > 0) {
    const relevantArray = Array.from(relevantLightings);
    const randomLightings = allLightings
      .filter(lighting => !relevantLightings.has(lighting))
      .sort(() => 0.5 - Math.random())
      .slice(0, Math.min(3, allLightings.length - relevantLightings.size));
    return [...relevantArray, ...randomLightings];
  }

  return allLightings;
}

/**
 * Maps branding tags to appropriate effect tags
 */
function getEffectTagsForBranding(brandingTags: string[]): string[] {
  const allEffects = [...AVAILABLE_EFFECT_TAGS];
  const brandingEffectMap: Record<string, string[]> = {
    "Luxury": ["Ray-tracing", "8k Resolution", "Micro-contrast", "Subsurface Scattering"],
    "Exclusive": ["Ray-tracing", "8k Resolution", "Micro-contrast", "Subsurface Scattering"],
    "Tech": ["Ray-tracing", "Anamorphic Flare", "8k Resolution", "Micro-contrast"],
    "Modern": ["Ray-tracing", "8k Resolution", "Micro-contrast", "Subsurface Scattering"],
    "Eco-friendly": ["Vintage Film", "Natural Light", "Monochrome"],
    "Handmade": ["Vintage Film", "Halftone", "Monochrome"],
    "Sport": ["Motion Blur", "High Contrast", "Bokeh", "Anamorphic Flare"],
    "Energetic": ["Motion Blur", "High Contrast", "Bokeh", "Lens Flare"],
    "Fashion": ["Bokeh", "Lens Flare", "8k Resolution", "Micro-contrast"],
    "Feminine": ["Bokeh", "Lens Flare", "Soft Light", "Vintage Film"],
    "Corporate": ["Monochrome", "High Contrast", "8k Resolution"],
    "Professional": ["Monochrome", "High Contrast", "8k Resolution"],
    "Creative": ["Bokeh", "Lens Flare", "Fish-eye lens", "Anamorphic Flare"],
    "Playful": ["Bokeh", "Lens Flare", "Fish-eye lens", "Motion Blur"],
    "Vintage": ["Vintage Film", "Monochrome", "Halftone", "Long Exposure"],
    "Food": ["Vintage Film", "Natural Light", "Bokeh"],
    "Travel & Hospitality": ["Vintage Film", "Bokeh", "Natural Light"],
  };

  if (brandingTags.length === 0) {
    return allEffects;
  }

  const relevantEffects = new Set<string>();
  brandingTags.forEach(tag => {
    const effects = brandingEffectMap[tag] || [];
    effects.forEach(effect => relevantEffects.add(effect));
  });

  if (relevantEffects.size > 0) {
    const relevantArray = Array.from(relevantEffects);
    const randomEffects = allEffects
      .filter(effect => !relevantEffects.has(effect))
      .sort(() => 0.5 - Math.random())
      .slice(0, Math.min(3, allEffects.length - relevantEffects.size));
    return [...relevantArray, ...randomEffects];
  }

  return allEffects;
}

/**
 * Maps branding tags to appropriate material tags
 */
function getMaterialTagsForBranding(brandingTags: string[]): string[] {
  const allMaterials = [...AVAILABLE_MATERIAL_TAGS];
  const brandingMaterialMap: Record<string, string[]> = {
    "Luxury": ["Metallic Platinum", "Frosted Glass", "Liquid Chrome", "Liquid Glass"],
    "Exclusive": ["Metallic Platinum", "Frosted Glass", "Liquid Chrome", "Liquid Glass"],
    "Tech": ["Brushed Aluminum", "Liquid Chrome", "Frosted Glass", "Liquid Glass"],
    "Modern": ["Brushed Aluminum", "Frosted Glass", "Liquid Chrome", "Metallic Platinum"],
    "Eco-friendly": ["Raw Linen", "Tactile Paper Grain", "Ceramic"],
    "Handmade": ["Raw Linen", "Tactile Paper Grain", "Ceramic", "Embossed"],
    "Sport": ["Soft-touch Plastic", "Embossed", "Brushed Aluminum"],
    "Energetic": ["Soft-touch Plastic", "Embossed", "Brushed Aluminum"],
    "Fashion": ["Frosted Glass", "Liquid Glass", "Metallic Platinum", "Embossed"],
    "Feminine": ["Frosted Glass", "Liquid Glass", "Raw Linen", "Embossed"],
    "Corporate": ["Brushed Aluminum", "Frosted Glass", "Metallic Platinum"],
    "Professional": ["Brushed Aluminum", "Frosted Glass", "Metallic Platinum"],
    "Creative": ["Frosted Glass", "Liquid Chrome", "Embossed", "Debossed"],
    "Playful": ["Soft-touch Plastic", "Embossed", "Frosted Glass"],
    "Vintage": ["Tactile Paper Grain", "Embossed", "Debossed", "Ceramic"],
    "Food": ["Raw Linen", "Ceramic", "Tactile Paper Grain"],
    "Travel & Hospitality": ["Raw Linen", "Ceramic", "Frosted Glass"],
  };

  if (brandingTags.length === 0) {
    return allMaterials;
  }

  const relevantMaterials = new Set<string>();
  brandingTags.forEach(tag => {
    const materials = brandingMaterialMap[tag] || [];
    materials.forEach(material => relevantMaterials.add(material));
  });

  if (relevantMaterials.size > 0) {
    const relevantArray = Array.from(relevantMaterials);
    const randomMaterials = allMaterials
      .filter(material => !relevantMaterials.has(material))
      .sort(() => 0.5 - Math.random())
      .slice(0, Math.min(3, allMaterials.length - relevantMaterials.size));
    return [...relevantArray, ...randomMaterials];
  }

  return allMaterials;
}

/**
 * Maps branding tags to appropriate angle tags
 */
function getAngleTagsForBranding(brandingTags: string[]): string[] {
  const allAngles = [...AVAILABLE_ANGLE_TAGS];
  const brandingAngleMap: Record<string, string[]> = {
    "Luxury": ["Hero Angle", "Close-Up", "Detail Shot", "Eye-Level", "High Angle"],
    "Exclusive": ["Hero Angle", "Close-Up", "Detail Shot", "Eye-Level"],
    "Tech": ["Hero Angle", "Three-Quarter View", "45° Angle", "Isometric View"],
    "Modern": ["Hero Angle", "Three-Quarter View", "45° Angle", "Eye-Level"],
    "Eco-friendly": ["Top-Down (Flat Lay)", "Eye-Level", "High Angle", "Wide Shot"],
    "Handmade": ["Top-Down (Flat Lay)", "Eye-Level", "High Angle", "Wide Shot"],
    "Sport": ["Low Angle", "Worm's-Eye View", "Dutch Angle", "Dynamic Shot"],
    "Energetic": ["Low Angle", "Worm's-Eye View", "Dutch Angle", "Dynamic Shot"],
    "Fashion": ["Hero Angle", "Close-Up", "Profile", "Eye-Level"],
    "Feminine": ["High Angle", "Top-Down (Flat Lay)", "Eye-Level", "Close-Up"],
    "Corporate": ["Eye-Level", "High Angle", "Three-Quarter View", "Profile"],
    "Professional": ["Eye-Level", "High Angle", "Three-Quarter View", "Profile"],
    "Creative": ["Dutch Angle", "Worm's-Eye View", "Fish-eye lens", "Isometric View"],
    "Playful": ["Dutch Angle", "Worm's-Eye View", "Low Angle", "Fish-eye lens"],
    "Vintage": ["Eye-Level", "High Angle", "Profile", "Wide Shot"],
    "Food": ["Top-Down (Flat Lay)", "High Angle", "Eye-Level", "Close-Up"],
    "Travel & Hospitality": ["Wide Shot", "Establishing Shot", "Eye-Level", "High Angle"],
  };

  if (brandingTags.length === 0) {
    return allAngles;
  }

  const relevantAngles = new Set<string>();
  brandingTags.forEach(tag => {
    const angles = brandingAngleMap[tag] || [];
    angles.forEach(angle => relevantAngles.add(angle));
  });

  if (relevantAngles.size > 0) {
    const relevantArray = Array.from(relevantAngles);
    const randomAngles = allAngles
      .filter(angle => !relevantAngles.has(angle))
      .sort(() => 0.5 - Math.random())
      .slice(0, Math.min(3, allAngles.length - relevantAngles.size));
    return [...relevantArray, ...randomAngles];
  }

  return allAngles;
}

/**
 * Get all appropriate tags for given branding tags
 * Reuses getBackgroundsForBranding from promptHelpers and extends it with other tag categories
 */
export function getTagsForBranding(brandingTags: string[]): TagMapping {
  return {
    location: getBackgroundsForBranding(brandingTags),
    angle: getAngleTagsForBranding(brandingTags),
    lighting: getLightingTagsForBranding(brandingTags),
    effect: getEffectTagsForBranding(brandingTags),
    material: getMaterialTagsForBranding(brandingTags),
  };
}





