import { SectionLayout } from './types';

// ═══════════════════════════════════════════
// Metodologia Visant — BrandingData v2
// 3 Fases, 10 Steps (cascata)
// ═══════════════════════════════════════════

// Etapa 01: Mensagem Central
export interface CentralMessage {
    product: string;
    differential: string;
    emotionalBond: string;
    statement: string;
}

// Etapa 01: Pilares
export interface BrandPillar {
    name: string;
    description: string;
}

// Etapa 02: Pesquisa de Mercado
export interface MarketResearchV2 {
    whatCompetitorsDoWell: string[];
    whatAllDoWrong: string[];
    whatNobodyDoes: string[];
    summary: string;
    competitors: Array<{
        name: string;
        url?: string;
        analysis: string;
    }>;
}

// Etapa 02b: Persona Visant
export interface PersonaV2 {
    name: string;
    age: number;
    context: string;
    painPoints: Array<{
        id: string;
        title: string;
        description: string;
    }>;
    desires: Array<{
        id: string;
        title: string;
        description: string;
    }>;
}

// Etapa 03: Arquétipos
export interface ArchetypesV2 {
    primary: {
        id: number;
        title: string;
        description: string;
        examples: string[];
    };
    secondary: {
        id: number;
        title: string;
        description: string;
        examples: string[];
    };
    barBehavior: string;
    reasoning: string;
}

// Etapa 03: Tom de Voz
export interface ToneOfVoicePillar {
    pillar: string;
    description: string;
    example: string;
}

// Etapa 04: Manifesto
export interface Manifesto {
    provocation: string;
    tension: string;
    promise: string;
    fullText: string;
    sloganSuggestion: string;
}

// Etapa 05: Conceito de Logo
export interface LogoConcept {
    whatItMustCommunicate: string[];
    conceptIdeas: Array<{
        concept: string;
        meanings: string[];
    }>;
    geometryNotes: string;
}

// Etapa 06: Cor nomeada
export interface NamedColor {
    name: string;
    hex: string;
    role: string;
    psychology: string;
}

// Etapa 06: Tipografia
export interface TypographyPair {
    headline: {
        family: string;
        rationale: string;
    };
    body: {
        family: string;
        rationale: string;
    };
}

// Etapa 07: Sistema Gráfico
export interface GraphicSystem {
    patterns: string[];
    graphicElements: string[];
    imageRules: string[];
    editorialGrid: string;
}

// ═══════════════════════════════════════════
// BrandingData — v2 (Metodologia Visant)
// ═══════════════════════════════════════════

export interface BrandingData {
    prompt: string;
    name?: string;
    version?: 'v2'; // presente = formato Visant

    // ═══ FASE 1 — ESTRATÉGIA ═══
    centralMessage?: CentralMessage;
    pillars?: BrandPillar[];
    marketResearchV2?: MarketResearchV2;
    personaV2?: PersonaV2;
    archetypesV2?: ArchetypesV2;
    toneOfVoice?: ToneOfVoicePillar[];
    manifesto?: Manifesto;

    // ═══ FASE 2 — IDENTIDADE VISUAL ═══
    colorPaletteV2?: NamedColor[];
    typography?: TypographyPair;
    graphicSystem?: GraphicSystem;
    logoConcept?: LogoConcept;

    // ═══ ANÁLISE COMPLEMENTAR ═══
    swot?: {
        strengths: string[];
        weaknesses: string[];
        opportunities: string[];
        threats: string[];
    };

    // ═══ LEGACY (backward compat) ═══
    marketResearch?: string;
    mercadoNicho?: string;
    publicoAlvo?: string;
    posicionamento?: string;
    insights?: string;
    competitors?: string[] | Array<{ name: string; url?: string }>;
    references?: string[];
    colorPalettes?: Array<{
        name: string;
        colors: string[];
        psychology: string;
    }>;
    visualElements?: string[];
    persona?: {
        demographics: string;
        desires: string[];
        pains: string[];
    };
    mockupIdeas?: string[];
    moodboard?: {
        summary: string;
        visualDirection: string;
        keyElements: string[];
    };
    archetypes?: {
        primary: {
            id: number;
            title: string;
            description: string;
            examples: string[];
        };
        secondary: {
            id: number;
            title: string;
            description: string;
            examples: string[];
        };
        reasoning: string;
    };

    // ═══ UI STATE ═══
    layout?: SectionLayout;
    collapsedSections?: number[];
    compactSections?: number[];
}

export interface BrandingProject {
    _id: string;
    userId: string;
    name?: string | null;
    prompt: string;
    data: BrandingData;
    createdAt: string;
    updatedAt: string;
}

export function isVisantV2(data: BrandingData): boolean {
    return data.version === 'v2' || !!data.centralMessage;
}
