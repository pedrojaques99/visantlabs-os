import type { BrandingData } from '../types';
import { parseMarketResearch, categorizeMarketSection, type ParsedSection } from './brandingParsers.js';
import { cleanMarketResearchText } from './brandingHelpersServer.js';

export { cleanMarketResearchText };

export const getStepContent = (stepNumber: number, data: BrandingData) => {
  // Helper to clean and normalize string content
  const cleanString = (text: string): string => {
    return cleanMarketResearchText(text);
  };

  // Helper to ensure steps 1-4 always return strings
  const ensureString = (value: any): string => {
    if (typeof value === 'string') return cleanString(value);
    if (value === null || value === undefined) return '';
    return cleanString(String(value));
  };

  switch (stepNumber) {
    case 1:
      return ensureString(data.mercadoNicho);
    case 2:
      return ensureString(data.publicoAlvo);
    case 3:
      return ensureString(data.posicionamento);
    case 4:
      return ensureString(data.insights);
    case 5:
      return data.competitors;
    case 6:
      return data.references;
    case 7:
      return data.swot;
    case 8:
      return data.colorPalettes;
    case 9:
      return data.visualElements;
    case 10:
      return data.persona;
    case 11:
      return data.mockupIdeas;
    case 12:
      return data.moodboard;
    case 13:
      return data.archetypes;
    default:
      return null;
  }
};

export const hasStepContent = (stepNumber: number, data: BrandingData): boolean => {
  const content = getStepContent(stepNumber, data);
  if (!content) return false;
  if (typeof content === 'string') return content.trim().length > 0;
  if (Array.isArray(content)) return content.length > 0;
  if (typeof content === 'object') return Object.keys(content).length > 0;
  return false;
};

export const getSectionEmoji = (stepNumber: number): string => {
  switch (stepNumber) {
    case 1: return '📊'; // Mercado e Nicho
    case 2: return '👥'; // Público Alvo
    case 3: return '🎯'; // Posicionamento
    case 4: return '💡'; // Insights
    case 5: return '🏢'; // Competitors
    case 6: return '🎨'; // References
    case 7: return '⚖️'; // SWOT Analysis
    case 8: return '🎨'; // Color Palettes
    case 9: return '🎨'; // Visual Elements
    case 10: return '👤'; // Persona
    case 11: return '💡'; // Mockup Ideas
    case 12: return '🖼️'; // Moodboard
    case 13: return '🎭'; // Arquétipos
    default: return '📝';
  }
};

export const getSectionColSpan = (stepNumber: number): string => {
  // Market Research sections, Color Palettes, Persona, Mockup Ideas, Moodboard Summary, Archetypes get more space
  if ([1, 2, 3, 4, 8, 10, 11, 12, 13].includes(stepNumber)) {
    return 'md:col-span-2';
  }
  // SWOT gets full width
  if (stepNumber === 7) {
    return 'md:col-span-3';
  }
  return '';
};

export const getStepDependencies = (stepNumber: number): number[] => {
  switch (stepNumber) {
    case 1: // Mercado e Nicho - no dependencies
    case 2: // Público Alvo - no dependencies
    case 3: // Posicionamento - no dependencies
    case 4: // Insights - no dependencies
      return [];
    case 5: // Competitors needs all 4 market research sections
      return [1, 2, 3, 4];
    case 6: // References needs all 4 market research sections + Competitors
      return [1, 2, 3, 4, 5];
    case 7: // SWOT needs all 4 market research sections + Competitors
      return [1, 2, 3, 4, 5];
    case 8: // Color Palettes needs SWOT + References
      return [7, 6];
    case 9: // Visual Elements needs Color Palettes
      return [8];
    case 10: // Persona needs all 4 market research sections
      return [1, 2, 3, 4];
    case 13: // Archetypes needs all 4 market research sections
      return [1, 2, 3, 4];
    case 11: // Mockup Ideas - no dependencies
    case 12: // Moodboard - no dependencies
      return [];
    default:
      return [];
  }
};

export const getDependencyStepTitle = (
  stepNumber: number,
  steps: Array<{ id: number; title: string }>
): string => {
  const step = steps.find(s => s.id === stepNumber);
  return step?.title || `Step ${stepNumber}`;
};

// Migrate old marketResearch (string) to new structure (4 separate properties)
export const migrateMarketResearch = (data: BrandingData): BrandingData => {
  // If already migrated or no marketResearch, return as is
  if (data.mercadoNicho || !data.marketResearch || typeof data.marketResearch !== 'string') {
    return data;
  }

  const parsed = parseMarketResearch(data.marketResearch);
  if (!parsed || parsed.length === 0) {
    return data;
  }

  // Preserve all existing fields including UI states (collapsedSections, compactSections, layout)
  const migrated: BrandingData = {
    ...data,
    // Explicitly preserve UI states if they exist
    collapsedSections: data.collapsedSections,
    compactSections: data.compactSections,
    layout: data.layout,
  };

  // Group sections by category
  const grouped: Record<string, string[]> = {
    'mercado-nicho': [],
    'publico-alvo': [],
    'posicionamento': [],
    'insights': [],
  };

  parsed.forEach((section: ParsedSection) => {
    const category = categorizeMarketSection(section.title);

    // Combine subsections and items into text
    const parts: string[] = [];

    section.subsections.forEach(sub => {
      if (sub.title) {
        parts.push(`**${sub.title}**:`);
      }
      parts.push(...sub.content);
    });

    if (section.items.length > 0) {
      parts.push(...section.items);
    }

    if (parts.length > 0) {
      grouped[category].push(parts.join('\n'));
    }
  });

  // Convert grouped arrays to strings, ensuring they're always strings
  migrated.mercadoNicho = grouped['mercado-nicho'].join('\n\n').trim() || '';
  migrated.publicoAlvo = grouped['publico-alvo'].join('\n\n').trim() || '';
  migrated.posicionamento = grouped['posicionamento'].join('\n\n').trim() || '';
  migrated.insights = grouped['insights'].join('\n\n').trim() || '';

  return migrated;
};


export const extractTextFromContent = (content: any): string => {
  if (!content) return '';

  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    return content.map(item => {
      if (typeof item === 'string') return item;
      if (typeof item === 'object' && item !== null) {
        return Object.entries(item)
          .map(([key, value]) => `${key}: ${typeof value === 'string' ? value : JSON.stringify(value)}`)
          .join('\n');
      }
      return String(item);
    }).join('\n');
  }

  if (typeof content === 'object' && content !== null) {
    return Object.entries(content)
      .map(([key, value]) => {
        if (Array.isArray(value)) {
          return `${key}:\n${value.map(v => `  - ${typeof v === 'string' ? v : JSON.stringify(v)}`).join('\n')}`;
        }
        if (typeof value === 'object' && value !== null) {
          return `${key}:\n${JSON.stringify(value, null, 2)}`;
        }
        return `${key}: ${value}`;
      })
      .join('\n\n');
  }

  return String(content);
};

