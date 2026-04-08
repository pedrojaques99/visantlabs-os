// server/services/brandSharedService.ts
import { BrandGuideline } from '../types/brandGuideline.js';
import { BrandingData } from '../../src/types/branding.js';

export const brandSharedService = {
  /**
   * Converts BrandingData from Branding Machine into a BrandGuideline structure
   */
  brandingToGuideline(brandingData: BrandingData): Partial<BrandGuideline> {
    const identity = {
      name: brandingData.name || '',
      tagline: '', // BrandingData might not have a explicit tagline field in some versions
      description: '', 
    };

    // Try to extract description from market research if available
    if (brandingData.mercadoNicho || brandingData.marketResearch) {
      identity.description = typeof brandingData.marketResearch === 'string' 
        ? brandingData.marketResearch 
        : (brandingData.mercadoNicho || '');
    }

    const colors = (brandingData.colorPalettes || []).flatMap((palette: any) => 
      (palette.colors || []).map((hex: string, index: number) => ({
        hex,
        name: `${palette.name} ${index + 1}`,
        role: palette.psychology || '',
      }))
    );

    // typography is usually in visualElements which is a string[] in this version
    // but we can try to find entries that look like fonts
    const typography = (brandingData.visualElements || [])
      .filter((v: any) => typeof v === 'string' && (v.includes('Font') || v.includes('Typography')))
      .map((t: string) => ({
        family: t.split(':')[0] || 'Inter',
        role: 'body',
        style: 'Regular',
        size: 16,
      }));

    // Strategy tags from Branding Machine analysis
    const tags: Record<string, string[]> = {};
    if (brandingData.persona) {
      tags['Persona'] = [brandingData.persona.demographics || 'Demographics Available'].filter(Boolean);
    }
    if (brandingData.archetypes) {
      tags['Archetype'] = [brandingData.archetypes.primary?.title, brandingData.archetypes.secondary?.title].filter(Boolean) as string[];
    }
    if (brandingData.swot) {
      tags['SWOT'] = ['Analysis Available'];
    }

    return {
      identity,
      colors,
      typography,
      tags,
      //Guidelines
      guidelines: {
          voice: brandingData.posicionamento || '',
          dos: [],
          donts: [],
      },
      // Strategy
      strategy: {
        archetypes: brandingData.archetypes ? [
          brandingData.archetypes.primary && { name: brandingData.archetypes.primary.title, description: brandingData.archetypes.primary.description || '' },
          brandingData.archetypes.secondary && { name: brandingData.archetypes.secondary.title, description: brandingData.archetypes.secondary.description || '' }
        ].filter(Boolean) as any[] : [],
        personas: brandingData.persona ? [{
          name: 'Target Persona',
          bio: brandingData.persona.demographics || '',
          traits: [...(brandingData.persona.pains || []), ...(brandingData.persona.desires || [])].filter(Boolean) as string[]
        }] : [],
        positioning: brandingData.posicionamento ? [brandingData.posicionamento] : []
      }
    };


  }
};
