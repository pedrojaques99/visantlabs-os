import { describe, it, expect } from 'vitest';
import { getStepContent, hasStepContent, getStepDependencies, getSectionEmoji, getSectionColSpan } from '../../../src/utils/brandingHelpers';
import { isVisantV2 } from '../../../src/types/branding';
import type { BrandingData } from '../../../src/types/types';

const makeV2Data = (overrides: Partial<BrandingData> = {}): BrandingData => ({
  prompt: 'Test brand',
  version: 'v2',
  centralMessage: {
    product: 'App fitness',
    differential: 'IA personalizada',
    emotionalBond: 'Superação pessoal',
    statement: 'App fitness com IA personalizada que desperta superação pessoal',
  },
  pillars: [
    { name: 'Autonomia', description: 'O usuário é dono do próprio treino' },
    { name: 'Ciência', description: 'Base em evidências' },
    { name: 'Comunidade', description: 'Rede de apoio' },
  ],
  marketResearchV2: {
    whatCompetitorsDoWell: ['UX intuitiva', 'Gamificação'],
    whatAllDoWrong: ['Planos genéricos'],
    whatNobodyDoes: ['IA adaptativa em tempo real'],
    summary: 'Mercado saturado mas sem personalização real',
    competitors: [{ name: 'FitApp', analysis: 'Boa UX, planos genéricos' }],
  },
  personaV2: {
    name: 'Marina',
    age: 32,
    context: 'Profissional que mal tem tempo de treinar',
    painPoints: [
      { id: '1', title: 'Falta de tempo', description: 'Rotina de 12h' },
      { id: '2', title: 'Planos genéricos', description: 'Não consideram seu nível' },
    ],
    desires: [
      { id: '1', title: 'Eficiência', description: 'Treino de 30min que funcione' },
    ],
  },
  archetypesV2: {
    primary: { id: 6, title: 'Herói', description: 'Superação', examples: ['Nike'] },
    secondary: { id: 12, title: 'Sábio', description: 'Conhecimento', examples: ['Google'] },
    barBehavior: 'Fala com convicção mas ouve',
    reasoning: 'Herói para motivação, Sábio para credibilidade',
  },
  toneOfVoice: [
    { pillar: 'Direto', description: 'Sem rodeios', example: 'Seu treino. Seu ritmo.' },
  ],
  manifesto: {
    provocation: 'Você treina ou segue receita?',
    tension: 'O mercado vende fórmulas. Você não é fórmula.',
    promise: 'Treino que aprende com você.',
    fullText: 'Manifesto completo aqui',
    sloganSuggestion: 'Treino inteligente. Resultado real.',
  },
  swot: {
    strengths: ['IA adaptativa'],
    weaknesses: ['Marca nova'],
    opportunities: ['Mercado wellness'],
    threats: ['Concorrentes consolidados'],
  },
  colorPaletteV2: [
    { name: 'Energia Verde', hex: '#22c55e', role: 'Primária', psychology: 'Vitalidade' },
    { name: 'Foco Azul', hex: '#3b82f6', role: 'Secundária', psychology: 'Confiança' },
  ],
  typography: {
    headline: { family: 'Space Grotesk', rationale: 'Moderna e bold' },
    body: { family: 'Inter', rationale: 'Legibilidade em telas' },
  },
  graphicSystem: {
    patterns: ['Linhas diagonais ascendentes'],
    graphicElements: ['Ícones lineares'],
    imageRules: ['Fotos com luz natural'],
    editorialGrid: '12 colunas, margem 24px',
  },
  logoConcept: {
    whatItMustCommunicate: ['Movimento', 'Inteligência', 'Personalização'],
    conceptIdeas: [{ concept: 'Seta + Cérebro', meanings: ['Progresso', 'IA'] }],
    geometryNotes: 'Formas angulares com curvas suaves',
  },
  ...overrides,
});

// ═══ isVisantV2 ═══

describe('isVisantV2', () => {
  it('detects v2 by version field', () => {
    expect(isVisantV2({ prompt: 'test', version: 'v2' })).toBe(true);
  });

  it('detects v2 by centralMessage presence', () => {
    const data = makeV2Data();
    delete (data as any).version;
    expect(isVisantV2(data)).toBe(true);
  });

  it('returns false for legacy data', () => {
    expect(isVisantV2({ prompt: 'test', mercadoNicho: 'mercado' })).toBe(false);
  });

  it('returns false for empty data', () => {
    expect(isVisantV2({ prompt: 'test' })).toBe(false);
  });
});

// ═══ getStepContent — v2 ═══

describe('getStepContent — v2 steps', () => {
  const data = makeV2Data();

  it('step 101 returns centralMessage + pillars', () => {
    const result = getStepContent(101, data) as any;
    expect(result.centralMessage.statement).toContain('App fitness');
    expect(result.pillars).toHaveLength(3);
  });

  it('step 102 returns marketResearchV2', () => {
    const result = getStepContent(102, data) as any;
    expect(result.whatCompetitorsDoWell).toContain('UX intuitiva');
    expect(result.whatNobodyDoes).toContain('IA adaptativa em tempo real');
  });

  it('step 103 returns personaV2 with typed painPoints', () => {
    const result = getStepContent(103, data) as any;
    expect(result.name).toBe('Marina');
    expect(result.painPoints[0].title).toBe('Falta de tempo');
    expect(result.desires[0].title).toBe('Eficiência');
  });

  it('step 104 returns archetypes + toneOfVoice', () => {
    const result = getStepContent(104, data) as any;
    expect(result.archetypes.primary.title).toBe('Herói');
    expect(result.archetypes.secondary.title).toBe('Sábio');
    expect(result.toneOfVoice[0].pillar).toBe('Direto');
  });

  it('step 105 returns manifesto', () => {
    const result = getStepContent(105, data) as any;
    expect(result.provocation).toContain('treina');
    expect(result.sloganSuggestion).toBe('Treino inteligente. Resultado real.');
  });

  it('step 106 returns swot', () => {
    const result = getStepContent(106, data) as any;
    expect(result.strengths).toContain('IA adaptativa');
    expect(result.threats).toContain('Concorrentes consolidados');
  });

  it('step 107 returns NamedColor array', () => {
    const result = getStepContent(107, data) as any[];
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('Energia Verde');
    expect(result[0].hex).toBe('#22c55e');
    expect(result[0].role).toBe('Primária');
  });

  it('step 108 returns typography pair', () => {
    const result = getStepContent(108, data) as any;
    expect(result.headline.family).toBe('Space Grotesk');
    expect(result.body.family).toBe('Inter');
  });

  it('step 109 returns graphicSystem', () => {
    const result = getStepContent(109, data) as any;
    expect(result.patterns).toEqual(['Linhas diagonais ascendentes']);
    expect(result.editorialGrid).toContain('12 colunas');
  });

  it('step 110 returns logoConcept', () => {
    const result = getStepContent(110, data) as any;
    expect(result.whatItMustCommunicate).toContain('Movimento');
    expect(result.conceptIdeas[0].concept).toBe('Seta + Cérebro');
    expect(result.geometryNotes).toContain('angulares');
  });

  it('returns null for missing centralMessage (step 101)', () => {
    expect(getStepContent(101, { prompt: 'test' })).toBeNull();
  });

  it('returns null for unknown step number', () => {
    expect(getStepContent(999, data)).toBeNull();
  });
});

// ═══ hasStepContent — v2 ═══

describe('hasStepContent — v2 steps', () => {
  const data = makeV2Data();

  it('returns true for all populated v2 steps', () => {
    for (const step of [101, 102, 103, 104, 105, 106, 107, 108, 109, 110]) {
      expect(hasStepContent(step, data)).toBe(true);
    }
  });

  it('returns false for empty data', () => {
    const empty: BrandingData = { prompt: 'test' };
    expect(hasStepContent(101, empty)).toBe(false);
    expect(hasStepContent(107, empty)).toBe(false);
  });
});

// ═══ getStepDependencies — cascata validation ═══

describe('getStepDependencies — v2 cascata', () => {
  it('step 101 (Mensagem Central) has no dependencies', () => {
    expect(getStepDependencies(101)).toEqual([]);
  });

  it('step 102 depends only on 101', () => {
    expect(getStepDependencies(102)).toEqual([101]);
  });

  it('step 103 depends on 101, 102', () => {
    expect(getStepDependencies(103)).toEqual([101, 102]);
  });

  it('step 104 depends on 101-103', () => {
    expect(getStepDependencies(104)).toEqual([101, 102, 103]);
  });

  it('step 105 (Manifesto) depends on full strategy chain 101-104', () => {
    expect(getStepDependencies(105)).toEqual([101, 102, 103, 104]);
  });

  it('step 106 (SWOT) depends on 101-103 only — not manifesto', () => {
    expect(getStepDependencies(106)).toEqual([101, 102, 103]);
  });

  it('step 107 (Colors) depends on 101-105', () => {
    expect(getStepDependencies(107)).toEqual([101, 102, 103, 104, 105]);
  });

  it('step 108 (Typography) same deps as 107', () => {
    expect(getStepDependencies(108)).toEqual([101, 102, 103, 104, 105]);
  });

  it('step 109 (Graphic System) depends on 105, 107, 108', () => {
    expect(getStepDependencies(109)).toEqual([105, 107, 108]);
  });

  it('step 110 (Logo) depends on broad chain', () => {
    expect(getStepDependencies(110)).toEqual([101, 102, 103, 104, 105, 107, 108]);
  });
});

// ═══ UI helpers — v2 ═══

describe('getSectionEmoji — v2', () => {
  const expected: Record<number, string> = {
    101: '🎯', 102: '📊', 103: '👤', 104: '🎭', 105: '📜',
    106: '⚖️', 107: '🎨', 108: '✏️', 109: '🔷', 110: '💎',
  };

  for (const [step, emoji] of Object.entries(expected)) {
    it(`step ${step} → ${emoji}`, () => {
      expect(getSectionEmoji(Number(step))).toBe(emoji);
    });
  }
});

describe('getSectionColSpan — v2', () => {
  it('SWOT v2 (106) gets full width', () => {
    expect(getSectionColSpan(106)).toBe('md:col-span-3');
  });

  it('other v2 steps get 2-col span', () => {
    for (const step of [101, 102, 103, 104, 105, 107, 108, 109, 110]) {
      expect(getSectionColSpan(step)).toBe('md:col-span-2');
    }
  });
});

// ═══ Legacy backward compat ═══

describe('getStepContent — legacy steps still work', () => {
  const legacyData: BrandingData = {
    prompt: 'Legacy brand',
    mercadoNicho: 'Mercado de cafés especiais',
    publicoAlvo: 'Millennials urbanos',
    competitors: ['Starbucks', 'Blue Bottle'],
    swot: {
      strengths: ['Produto artesanal'],
      weaknesses: ['Escala limitada'],
      opportunities: ['Trend de specialty'],
      threats: ['Grandes redes'],
    },
  };

  it('step 1 returns mercadoNicho', () => {
    expect(getStepContent(1, legacyData)).toBe('Mercado de cafés especiais');
  });

  it('step 5 returns competitors array', () => {
    expect(getStepContent(5, legacyData)).toEqual(['Starbucks', 'Blue Bottle']);
  });

  it('step 7 returns swot object', () => {
    const swot = getStepContent(7, legacyData) as any;
    expect(swot.strengths).toContain('Produto artesanal');
  });
});
