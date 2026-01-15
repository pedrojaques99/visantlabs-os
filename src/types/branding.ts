import { SectionLayout } from './types';

export interface BrandingData {
    prompt: string;
    name?: string;
    marketResearch?: string; // Mantido para compatibilidade com projetos antigos
    mercadoNicho?: string;
    publicoAlvo?: string;
    posicionamento?: string;
    insights?: string;
    competitors?: string[] | Array<{ name: string; url?: string }>;
    references?: string[];
    swot?: {
        strengths: string[];
        weaknesses: string[];
        opportunities: string[];
        threats: string[];
    };
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
        reasoning: string; // Explicação de por que esses arquétipos foram escolhidos
    };
    layout?: SectionLayout; // Layout customizado das sections
    collapsedSections?: number[]; // IDs das seções collapsed (estado de UI)
    compactSections?: number[]; // IDs das seções compact (estado de UI)
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
