import type { BrandIdentity, StrategyNodeData } from '../types/reactFlow';
import { GoogleGenAI } from '@google/genai';

// Lazy initialization to avoid breaking app startup if API key is not configured
let ai: GoogleGenAI | null = null;
let currentApiKey: string | null = null;

const getAI = (): GoogleGenAI => {
  // Use cached instance or create from environment
  if (!ai || currentApiKey !== (import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.VITE_API_KEY || '').trim()) {
    const envApiKey = (import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.VITE_API_KEY || '').trim();
    
    if (!envApiKey || envApiKey === 'undefined' || envApiKey.length === 0) {
      throw new Error(
        "GEMINI_API_KEY não encontrada. " +
        "Configure GEMINI_API_KEY no arquivo .env para usar funcionalidades de IA. " +
        "Veja docs/SETUP_LLM.md para mais informações."
      );
    }
    
    currentApiKey = envApiKey;
    ai = new GoogleGenAI({ apiKey: envApiKey });
  }
  return ai;
};

/**
 * Gera prompt visual otimizado para nano banana (geração de mockups)
 * Arquitetura perfeita, direto, sem filosofia - apenas instruções técnicas
 * Usa apenas dados visuais (sem conceitos filosóficos que confundem modelos de imagem)
 */
export const generateVisualPrompt = async (
  brandIdentity: BrandIdentity,
  context?: {
    aspectRatio?: string;
    mockupType?: string;
    additionalDetails?: string;
    visualStrategyText?: string; // Dados estratégicos VISUAIS apenas (filtrados)
  }
): Promise<{
  mockupPrompt: string;
  compositionPrompt: string;
  stylePrompt: string;
}> => {
  const aspectRatio = context?.aspectRatio || '16:9';
  const mockupType = context?.mockupType || 'product';
  
  // Construir prompt baseado no BrandIdentity
  const colorPalette = [
    ...brandIdentity.colors.primary,
    ...brandIdentity.colors.secondary,
    ...brandIdentity.colors.accent,
  ].join(', ');

  // Visual style: apenas descritores visuais, sem filosofia
  const visualStyle = [
    brandIdentity.logo.style,
    brandIdentity.composition.style,
  ].filter(Boolean).join(', ');

  const visualElements = brandIdentity.visualElements.join(', ');

  // Adicionar dados visuais das estratégias se disponíveis
  let additionalVisualInfo = '';
  if (context?.visualStrategyText && context.visualStrategyText.trim()) {
    additionalVisualInfo = `\nAdditional visual guidelines: ${context.visualStrategyText}`;
  }

  // Prompt para mockups - arquitetura perfeita, direto, APENAS VISUAL
  const mockupPrompt = `A photorealistic, super-detailed ${aspectRatio === '16:9' ? 'widescreen cinematic shot' : aspectRatio === '4:3' ? 'standard photo' : 'square composition'} of a ${mockupType} mockup. 
Color palette: ${colorPalette || 'brand colors'}. 
Visual style: ${visualStyle || 'brand style'}. 
Typography: ${brandIdentity.typography.primary || 'brand typography'}. 
Visual elements: ${visualElements || 'brand elements'}. 
Composition: ${brandIdentity.composition.style || 'brand composition'}, grid: ${brandIdentity.composition.grid || 'brand grid'}, spacing: ${brandIdentity.composition.spacing || 'brand spacing'}.${additionalVisualInfo} 
Professional product photography with authentic materials, subtle surface details, natural reflections, sharp focus.${context?.additionalDetails ? ` ${context.additionalDetails}` : ''}`;

  // Prompt para composição
  const compositionPrompt = `Composition style: ${brandIdentity.composition.style || 'balanced'}. 
Grid system: ${brandIdentity.composition.grid || 'modular'}. 
Spacing: ${brandIdentity.composition.spacing || 'generous'}. 
Alignment: Follow brand guidelines. 
Safe area: Maintain comfortable breathing room around design elements.${additionalVisualInfo}`;

  // Prompt para estilo visual - APENAS DESCRITORES VISUAIS
  const stylePrompt = `Visual style: ${visualStyle || 'modern'}. 
Color palette: ${colorPalette || 'brand colors'}. 
Typography: ${brandIdentity.typography.primary || 'brand font'}${brandIdentity.typography.secondary ? `, ${brandIdentity.typography.secondary}` : ''}. 
Visual elements: ${visualElements || 'brand elements'}.${additionalVisualInfo}`;

  return {
    mockupPrompt: mockupPrompt.trim(),
    compositionPrompt: compositionPrompt.trim(),
    stylePrompt: stylePrompt.trim(),
  };
};

/**
 * Consolida dados estratégicos de múltiplos StrategyNodes
 */
export const consolidateStrategies = (
  strategies: Array<{
    nodeId: string;
    strategyType: string;
    data: StrategyNodeData['strategyData'];
  }>
): StrategyNodeData['strategyData'] => {
  const consolidated: StrategyNodeData['strategyData'] = {};

  for (const strategy of strategies) {
    if (!strategy.data) continue;

    // Consolidar persona
    if (strategy.data.persona && !consolidated.persona) {
      consolidated.persona = strategy.data.persona;
    }

    // Consolidar archetypes (priorizar primeiro encontrado)
    if (strategy.data.archetypes && !consolidated.archetypes) {
      consolidated.archetypes = strategy.data.archetypes;
    }

    // Consolidar marketResearch
    if (strategy.data.marketResearch && !consolidated.marketResearch) {
      consolidated.marketResearch = strategy.data.marketResearch;
    }

    // Consolidar competitors (merge arrays)
    if (strategy.data.competitors) {
      if (!consolidated.competitors) {
        consolidated.competitors = [];
      }
      const existing = consolidated.competitors as Array<{ name: string; url?: string }>;
      const newCompetitors = Array.isArray(strategy.data.competitors) 
        ? strategy.data.competitors 
        : [];
      
      // Evitar duplicatas
      const existingNames = new Set(existing.map(c => 
        typeof c === 'string' ? c : c.name
      ));
      
      newCompetitors.forEach(c => {
        const name = typeof c === 'string' ? c : c.name;
        if (!existingNames.has(name)) {
          existingNames.add(name);
          existing.push(typeof c === 'string' ? { name: c } : c);
        }
      });
      
      consolidated.competitors = existing;
    }

    // Consolidar references (merge arrays, evitar duplicatas)
    if (strategy.data.references) {
      if (!consolidated.references) {
        consolidated.references = [];
      }
      const existing = consolidated.references;
      strategy.data.references.forEach(ref => {
        if (!existing.includes(ref)) {
          existing.push(ref);
        }
      });
    }

    // Consolidar SWOT (merge arrays)
    if (strategy.data.swot) {
      if (!consolidated.swot) {
        consolidated.swot = {
          strengths: [],
          weaknesses: [],
          opportunities: [],
          threats: [],
        };
      }
      consolidated.swot.strengths.push(...(strategy.data.swot.strengths || []));
      consolidated.swot.weaknesses.push(...(strategy.data.swot.weaknesses || []));
      consolidated.swot.opportunities.push(...(strategy.data.swot.opportunities || []));
      consolidated.swot.threats.push(...(strategy.data.swot.threats || []));
    }

    // Consolidar colorPalettes (priorizar primeiro encontrado)
    if (strategy.data.colorPalettes && !consolidated.colorPalettes) {
      consolidated.colorPalettes = strategy.data.colorPalettes;
    }

    // Consolidar visualElements (merge arrays, evitar duplicatas)
    if (strategy.data.visualElements) {
      if (!consolidated.visualElements) {
        consolidated.visualElements = [];
      }
      const existing = consolidated.visualElements;
      strategy.data.visualElements.forEach(el => {
        if (!existing.includes(el)) {
          existing.push(el);
        }
      });
    }

    // Consolidar mockupIdeas (merge arrays, evitar duplicatas)
    if (strategy.data.mockupIdeas) {
      if (!consolidated.mockupIdeas) {
        consolidated.mockupIdeas = [];
      }
      const existing = consolidated.mockupIdeas;
      strategy.data.mockupIdeas.forEach(idea => {
        if (!existing.includes(idea)) {
          existing.push(idea);
        }
      });
    }

    // Consolidar moodboard (priorizar primeiro encontrado)
    if (strategy.data.moodboard && !consolidated.moodboard) {
      consolidated.moodboard = strategy.data.moodboard;
    }
  }

  return consolidated;
};

/**
 * Extrai apenas dados VISUAIS da estratégia (sem filosofia/conceitos)
 * Para uso em geração de imagens (MockupNode, PromptNode)
 */
export const extractVisualStrategyText = (
  consolidatedStrategies: StrategyNodeData['strategyData']
): string => {
  if (!consolidatedStrategies) return '';

  const sections: string[] = [];

  // Color Palettes - APENAS cores (sem psychology filosófica)
  if (consolidatedStrategies.colorPalettes && consolidatedStrategies.colorPalettes.length > 0) {
    const palettes = consolidatedStrategies.colorPalettes.map(p => 
      `${p.name}: ${p.colors.join(', ')}`
    ).join('\n');
    sections.push(`COLOR PALETTES:\n${palettes}`);
  }

  // Visual Elements - elementos gráficos concretos
  if (consolidatedStrategies.visualElements && consolidatedStrategies.visualElements.length > 0) {
    sections.push(`VISUAL ELEMENTS: ${consolidatedStrategies.visualElements.join(', ')}`);
  }

  // Mockup Ideas - ideias visuais concretas
  if (consolidatedStrategies.mockupIdeas && consolidatedStrategies.mockupIdeas.length > 0) {
    sections.push(`MOCKUP IDEAS:\n${consolidatedStrategies.mockupIdeas.map((idea, idx) => `${idx + 1}. ${idea}`).join('\n')}`);
  }

  // Moodboard - APENAS visual direction e key elements (sem summary conceitual)
  if (consolidatedStrategies.moodboard) {
    const mb = consolidatedStrategies.moodboard;
    if (mb.visualDirection || mb.keyElements) {
      const visualParts: string[] = [];
      if (mb.visualDirection) visualParts.push(`Visual Direction: ${mb.visualDirection}`);
      if (mb.keyElements && mb.keyElements.length > 0) {
        visualParts.push(`Key Visual Elements: ${mb.keyElements.join(', ')}`);
      }
      if (visualParts.length > 0) {
        sections.push(`VISUAL DIRECTION:\n${visualParts.join('\n')}`);
      }
    }
  }

  // References - podem conter referências visuais
  if (consolidatedStrategies.references && consolidatedStrategies.references.length > 0) {
    sections.push(`VISUAL REFERENCES: ${consolidatedStrategies.references.join(', ')}`);
  }

  return sections.join('\n\n');
};

/**
 * Converte dados estratégicos consolidados em um texto inteligente e estruturado
 * Versão completa com todos os dados (para análise e contexto geral)
 */
export const consolidateStrategiesToText = (
  consolidatedStrategies: StrategyNodeData['strategyData']
): string => {
  if (!consolidatedStrategies) return '';

  const sections: string[] = [];

  // Market Research
  if (consolidatedStrategies.marketResearch) {
    const mr = consolidatedStrategies.marketResearch;
    // Support both new (string) and old (object) formats
    if (typeof mr === 'string') {
      sections.push(`MARKET RESEARCH:\n${mr}`);
    } else if (typeof mr === 'object' && mr !== null) {
      sections.push(`MARKET RESEARCH:
- Mercado e Nicho: ${mr.mercadoNicho || 'N/A'}
- Público Alvo: ${mr.publicoAlvo || 'N/A'}
- Posicionamento: ${mr.posicionamento || 'N/A'}
- Insights: ${mr.insights || 'N/A'}`);
    }
  }

  // Persona
  if (consolidatedStrategies.persona) {
    const persona = consolidatedStrategies.persona;
    sections.push(`PERSONA:
- Demographics: ${persona.demographics || 'N/A'}
- Desires: ${persona.desires?.join(', ') || 'N/A'}
- Pain Points: ${persona.pains?.join(', ') || 'N/A'}`);
  }

  // Archetypes
  if (consolidatedStrategies.archetypes) {
    const arch = consolidatedStrategies.archetypes;
    sections.push(`ARCHETYPES:
- Primary: ${arch.primary?.title || 'N/A'} - ${arch.primary?.description || 'N/A'}
- Secondary: ${arch.secondary?.title || 'N/A'} - ${arch.secondary?.description || 'N/A'}
- Reasoning: ${arch.reasoning || 'N/A'}`);
  }

  // Competitors
  if (consolidatedStrategies.competitors && consolidatedStrategies.competitors.length > 0) {
    const competitors = consolidatedStrategies.competitors.map(c => 
      typeof c === 'string' ? c : c.name
    ).join(', ');
    sections.push(`COMPETITORS: ${competitors}`);
  }

  // References
  if (consolidatedStrategies.references && consolidatedStrategies.references.length > 0) {
    sections.push(`REFERENCES: ${consolidatedStrategies.references.join(', ')}`);
  }

  // SWOT
  if (consolidatedStrategies.swot) {
    const swot = consolidatedStrategies.swot;
    sections.push(`SWOT ANALYSIS:
- Strengths: ${swot.strengths?.join(', ') || 'N/A'}
- Weaknesses: ${swot.weaknesses?.join(', ') || 'N/A'}
- Opportunities: ${swot.opportunities?.join(', ') || 'N/A'}
- Threats: ${swot.threats?.join(', ') || 'N/A'}`);
  }

  // Color Palettes
  if (consolidatedStrategies.colorPalettes && consolidatedStrategies.colorPalettes.length > 0) {
    const palettes = consolidatedStrategies.colorPalettes.map(p => 
      `${p.name}: ${p.colors.join(', ')} (${p.psychology})`
    ).join('\n');
    sections.push(`COLOR PALETTES:\n${palettes}`);
  }

  // Visual Elements
  if (consolidatedStrategies.visualElements && consolidatedStrategies.visualElements.length > 0) {
    sections.push(`VISUAL ELEMENTS: ${consolidatedStrategies.visualElements.join(', ')}`);
  }

  // Mockup Ideas
  if (consolidatedStrategies.mockupIdeas && consolidatedStrategies.mockupIdeas.length > 0) {
    sections.push(`MOCKUP IDEAS:\n${consolidatedStrategies.mockupIdeas.map((idea, idx) => `${idx + 1}. ${idea}`).join('\n')}`);
  }

  // Moodboard
  if (consolidatedStrategies.moodboard) {
    const mb = consolidatedStrategies.moodboard;
    sections.push(`MOODBOARD:
- Summary: ${mb.summary || 'N/A'}
- Visual Direction: ${mb.visualDirection || 'N/A'}
- Key Elements: ${mb.keyElements?.join(', ') || 'N/A'}`);
  }

  return sections.join('\n\n');
};

/**
 * Gera prompt estratégico consolidado usando AI (opcional, para refinamento)
 */
export const generateStrategicPrompt = async (
  brandIdentity: BrandIdentity,
  consolidatedStrategies: StrategyNodeData['strategyData'],
  targetStep?: string
): Promise<string> => {
  const prompt = `You are a branding expert. Based on the brand identity and strategic data, generate a refined strategic prompt for ${targetStep || 'branding strategy'}.

Brand Identity:
- Colors: ${[...brandIdentity.colors.primary, ...brandIdentity.colors.secondary, ...brandIdentity.colors.accent].join(', ')}
- Typography: ${brandIdentity.typography.primary}
- Personality: ${brandIdentity.personality.tone}, ${brandIdentity.personality.feeling}
- Values: ${brandIdentity.personality.values.join(', ')}

Strategic Data:
${JSON.stringify(consolidatedStrategies, null, 2)}

Generate a concise, actionable strategic prompt that synthesizes this information.`;

  const response = await getAI().models.generateContent({
    model: 'gemini-2.5-flash',
    contents: { parts: [{ text: prompt }] },
  });

  return response.text.trim();
};
