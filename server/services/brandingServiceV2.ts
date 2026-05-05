import { GoogleGenAI, Type } from "@google/genai";
import type {
    CentralMessage, BrandPillar, MarketResearchV2, PersonaV2,
    ArchetypesV2, ToneOfVoicePillar, Manifesto, NamedColor,
    TypographyPair, GraphicSystem, LogoConcept, BrandingData,
} from '../../src/types/branding.js';
import { GEMINI_MODELS } from '../../src/constants/geminiModels.js';

// ═══════════════════════════════════════════
// Metodologia Visant — Branding Service v2
// 10 Steps em cascata
// ═══════════════════════════════════════════

let ai: GoogleGenAI | null = null;

const getAI = (): GoogleGenAI => {
    if (!ai) {
        const apiKey = (process.env.GEMINI_API_KEY || process.env.API_KEY || process.env.VITE_GEMINI_API_KEY || process.env.VITE_API_KEY || '').trim();
        if (!apiKey || apiKey === 'undefined' || apiKey.length === 0) {
            throw new Error("GEMINI_API_KEY não encontrada.");
        }
        ai = new GoogleGenAI({ apiKey });
    }
    return ai;
};

const detectLanguage = (text: string): 'pt-BR' | 'en-US' => {
    const lower = text.toLowerCase();
    const ptWords = ['é', 'são', 'para', 'com', 'uma', 'marca', 'produto', 'empresa', 'negócio', 'mercado', 'público', 'design', 'identidade'];
    const matches = ptWords.filter(w => lower.includes(w)).length;
    return matches >= 3 ? 'pt-BR' : 'en-US';
};

const langInstruction = (prompt: string): string => {
    return detectLanguage(prompt) === 'pt-BR'
        ? '\n\n**INSTRUÇÃO DE IDIOMA:** Responda COMPLETAMENTE em PORTUGUÊS BRASILEIRO.'
        : '';
};

interface GenResult<T> {
    result: T;
    inputTokens?: number;
    outputTokens?: number;
}

const withRetry = async <T>(fn: () => Promise<T>, retries = 3, timeout = 120000): Promise<T> => {
    for (let i = 0; i < retries; i++) {
        try {
            return await Promise.race([
                fn(),
                new Promise<never>((_, rej) => setTimeout(() => rej(new Error('Timeout')), timeout)),
            ]);
        } catch (e: any) {
            if (i >= retries - 1) throw e;
            await new Promise(r => setTimeout(r, 1000 * (i + 1)));
        }
    }
    throw new Error('Unreachable');
};

const extractTokens = (response: any) => ({
    inputTokens: response?.usageMetadata?.promptTokenCount,
    outputTokens: response?.usageMetadata?.candidatesTokenCount,
});

const VISANT_SYSTEM = `Você é um estrategista de marca seguindo a Metodologia Visant.

Princípios:
- Diferenciação exige sacrifício. Se uma escolha de marca não tem trade-off, não é estratégia — é lista de desejos.
- Nunca sugira "alta qualidade", "inovação" ou "foco no cliente" (são table stakes, não estratégia).
- Sem fluff: cada frase deve direcionar uma decisão.
- Lidere, não faça brainstorm genérico.
- A cascata é sagrada: cada etapa alimenta a próxima.`;

// ═══════════════════════════════════════════
// Step 1: Mensagem Central & Pilares
// ═══════════════════════════════════════════

export async function generateCentralMessageAndPillars(prompt: string): Promise<GenResult<{ centralMessage: CentralMessage; pillars: BrandPillar[] }>> {
    return withRetry(async () => {
        const systemPrompt = `${VISANT_SYSTEM}

A partir da descrição da marca, extraia:

1. MENSAGEM CENTRAL usando a fórmula Visant:
   PRODUTO + DIFERENCIAL + ELO EMOCIONAL = Mensagem Central

   - Produto: o que tecnicamente está sendo vendido
   - Diferencial: o que destaca das demais do mesmo ramo (NÃO pode ser genérico)
   - Elo Emocional: o sentimento que gera conexão

   Monte a frase: "[Produto] com o diferencial [Diferencial] que transmite [Elo Emocional]."

2. OS 3 PILARES: valores fundamentais que sustentam a Mensagem Central.
   Regra: pilar bom é aquele que, se violado, a marca deixa de ser ela mesma.
   Regra: pilar bom é aquele que a marca pode FAZER, não só DIZER.

   Para cada pilar: nome + descrição curta de como a marca o pratica.

Descrição da marca: "${prompt}"
${langInstruction(prompt)}`;

        const response = await getAI().models.generateContent({
            model: GEMINI_MODELS.TEXT,
            contents: { parts: [{ text: systemPrompt }] },
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        centralMessage: {
                            type: Type.OBJECT,
                            properties: {
                                product: { type: Type.STRING },
                                differential: { type: Type.STRING },
                                emotionalBond: { type: Type.STRING },
                                statement: { type: Type.STRING },
                            },
                        },
                        pillars: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    name: { type: Type.STRING },
                                    description: { type: Type.STRING },
                                },
                            },
                        },
                    },
                },
            },
        });

        const tokens = extractTokens(response);
        const parsed = JSON.parse(response.text?.trim() || '{}');
        return {
            result: {
                centralMessage: parsed.centralMessage,
                pillars: (parsed.pillars || []).slice(0, 3),
            },
            ...tokens,
        };
    });
}

// ═══════════════════════════════════════════
// Step 2: Pesquisa de Mercado (3 camadas)
// ═══════════════════════════════════════════

export async function generateMarketResearchV2(prompt: string, previousData: BrandingData): Promise<GenResult<MarketResearchV2>> {
    return withRetry(async () => {
        const systemPrompt = `${VISANT_SYSTEM}

Pesquisa de Mercado — 3 camadas Visant:

A inspiração (Pinterest/Behance) NÃO é pesquisa. Pesquisa é entender o território antes de construir nele.

Mapeie 3 camadas:
1. O que os concorrentes entregam BEM (para não competir nisso)
2. O que TODOS entregam MAL (onde mora a oportunidade)
3. O que NINGUÉM entrega (território livre)

> A frustração não resolvida do mercado é o ouro.

Também identifique 4-6 concorrentes estratégicos com análise de posicionamento.

Contexto:
- Marca: "${prompt}"
- Mensagem Central: ${previousData.centralMessage?.statement || 'N/A'}
- Pilares: ${previousData.pillars?.map(p => p.name).join(', ') || 'N/A'}
${langInstruction(prompt)}`;

        const response = await getAI().models.generateContent({
            model: GEMINI_MODELS.TEXT,
            contents: { parts: [{ text: systemPrompt }] },
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        whatCompetitorsDoWell: { type: Type.ARRAY, items: { type: Type.STRING } },
                        whatAllDoWrong: { type: Type.ARRAY, items: { type: Type.STRING } },
                        whatNobodyDoes: { type: Type.ARRAY, items: { type: Type.STRING } },
                        summary: { type: Type.STRING },
                        competitors: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    name: { type: Type.STRING },
                                    url: { type: Type.STRING },
                                    analysis: { type: Type.STRING },
                                },
                                required: ['name', 'analysis'],
                            },
                        },
                    },
                },
            },
        });

        const tokens = extractTokens(response);
        const parsed = JSON.parse(response.text?.trim() || '{}');
        return { result: parsed as MarketResearchV2, ...tokens };
    });
}

// ═══════════════════════════════════════════
// Step 3: Persona Visant
// ═══════════════════════════════════════════

export async function generatePersonaV2(prompt: string, previousData: BrandingData): Promise<GenResult<PersonaV2>> {
    return withRetry(async () => {
        const systemPrompt = `${VISANT_SYSTEM}

Persona Visant — foco em DORES, ANSEIOS e NECESSIDADES OCULTAS. Não demografia genérica.

Crie uma persona com:
- Nome real, idade, contexto (cidade, profissão, situação de vida)
- 4 Dores (pain points) nomeadas: "Dor 01: [título]" — o que tenta resolver sozinha e falha
- 4 Desejos nomeados: "Desejo 01: [título]" — o que deseja e não consegue

Perguntas-chave:
- O que essa pessoa deseja e não está conseguindo?
- O que ela tenta resolver sozinha e falha?
- O que ela teme?

Contexto construído:
- Marca: "${prompt}"
- Mensagem Central: ${previousData.centralMessage?.statement || 'N/A'}
- Pilares: ${previousData.pillars?.map(p => p.name).join(', ') || 'N/A'}
- Pesquisa: ${previousData.marketResearchV2?.summary || 'N/A'}
- Território livre: ${previousData.marketResearchV2?.whatNobodyDoes?.join('; ') || 'N/A'}
${langInstruction(prompt)}`;

        const response = await getAI().models.generateContent({
            model: GEMINI_MODELS.TEXT,
            contents: { parts: [{ text: systemPrompt }] },
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        name: { type: Type.STRING },
                        age: { type: Type.NUMBER },
                        context: { type: Type.STRING },
                        painPoints: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    id: { type: Type.STRING },
                                    title: { type: Type.STRING },
                                    description: { type: Type.STRING },
                                },
                            },
                        },
                        desires: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    id: { type: Type.STRING },
                                    title: { type: Type.STRING },
                                    description: { type: Type.STRING },
                                },
                            },
                        },
                    },
                },
            },
        });

        const tokens = extractTokens(response);
        const parsed = JSON.parse(response.text?.trim() || '{}');
        return { result: parsed as PersonaV2, ...tokens };
    });
}

// ═══════════════════════════════════════════
// Step 4: Arquétipos & Tom de Voz
// ═══════════════════════════════════════════

const ARCHETYPES_RAG = [
    { id: 1, titulo: "O Explorador", descricao: "Desafia padrões, busca novos caminhos. Curiosidade, exploração, mente aberta.", exemplos: ["Jeep", "The North Face", "SpaceX"] },
    { id: 2, titulo: "O Cara Comum", descricao: "Conexão e pertencimento. Autenticidade da vida cotidiana. Empatia e realismo.", exemplos: ["Hering", "Gap", "IKEA"] },
    { id: 3, titulo: "O Herói", descricao: "Superação, vitória, conquista. Tom confiante, motivador, firme.", exemplos: ["Nike", "BMW", "RedBull"] },
    { id: 4, titulo: "O Sábio", descricao: "Conhecimento, clareza. Reflexivo, didático, confiável. Autoridade sem arrogância.", exemplos: ["Google", "TED", "National Geographic"] },
    { id: 5, titulo: "O Cuidador", descricao: "Generosidade, proteção, apoio. Porto seguro. Bem-estar e pertencimento.", exemplos: ["Unicef", "Natura", "Volvo"] },
    { id: 6, titulo: "O Governante", descricao: "Autoridade, liderança, controle. Ordem, estabilidade, prestígio.", exemplos: ["Rolex", "Mercedes-Benz", "AmEx"] },
    { id: 7, titulo: "O Mago", descricao: "Mudança pelo exemplo, quebra de paradigmas. Inovação, insight visionário, disrupção.", exemplos: ["Apple", "Tesla", "Disney"] },
    { id: 8, titulo: "O Rebelde", descricao: "Desejo insaciável pela mudança. Rompe padrões, destrói o ultrapassado. Liberdade.", exemplos: ["Harley-Davidson", "Dr. Martens", "MTV"] },
    { id: 9, titulo: "O Criador", descricao: "Visionário, original. Expressão artística, atenção obsessiva a detalhes.", exemplos: ["Apple", "LEGO", "Patagonia"] },
    { id: 10, titulo: "O Prestativo", descricao: "Ajudar, servir, facilitar. Suporte, gentileza, resolução rápida.", exemplos: ["FedEx", "Localiza", "Amazon"] },
    { id: 11, titulo: "O Amante", descricao: "Desejo, beleza, intensidade. Conexão emocional profunda, sensorialidade.", exemplos: ["Chanel", "Victoria's Secret", "Häagen-Dazs"] },
    { id: 12, titulo: "O Bobo", descricao: "Humor, leveza, irreverência. Questiona o status quo com brincadeira.", exemplos: ["Skol", "Budweiser", "Doritos"] },
];

export async function generateArchetypesAndTone(prompt: string, previousData: BrandingData): Promise<GenResult<{ archetypes: ArchetypesV2; toneOfVoice: ToneOfVoicePillar[] }>> {
    return withRetry(async () => {
        const systemPrompt = `${VISANT_SYSTEM}

Marca é gente. O público julga marcas como julga pessoas.

1. MIX ARQUETÍPICO — primário + secundário (marca com um só = unidimensional).
   Pergunta-chave: "Se essa marca fosse uma pessoa, como ela se comportaria numa mesa de bar com estranhos?"

   Descreva o comportamento na mesa de bar (barBehavior).

2. TOM DE VOZ — exatamente 3 pilares. Cada pilar com:
   - Nome (ex: "Acolhedor", "Direto", "Incentivador")
   - Descrição de como a marca fala
   - Frase-exemplo real que a marca usaria

Arquétipos disponíveis:
${ARCHETYPES_RAG.map(a => `- ID ${a.id}: ${a.titulo} — ${a.descricao}`).join('\n')}

Contexto construído:
- Marca: "${prompt}"
- Mensagem Central: ${previousData.centralMessage?.statement || 'N/A'}
- Pilares: ${previousData.pillars?.map(p => `${p.name}: ${p.description}`).join('; ') || 'N/A'}
- Pesquisa: ${previousData.marketResearchV2?.summary || 'N/A'}
- Persona: ${previousData.personaV2?.name || 'N/A'} — Dores: ${previousData.personaV2?.painPoints?.map(p => p.title).join(', ') || 'N/A'}
${langInstruction(prompt)}`;

        const response = await getAI().models.generateContent({
            model: GEMINI_MODELS.TEXT,
            contents: { parts: [{ text: systemPrompt }] },
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        archetypes: {
                            type: Type.OBJECT,
                            properties: {
                                primary: {
                                    type: Type.OBJECT,
                                    properties: {
                                        id: { type: Type.NUMBER },
                                        title: { type: Type.STRING },
                                        description: { type: Type.STRING },
                                        examples: { type: Type.ARRAY, items: { type: Type.STRING } },
                                    },
                                },
                                secondary: {
                                    type: Type.OBJECT,
                                    properties: {
                                        id: { type: Type.NUMBER },
                                        title: { type: Type.STRING },
                                        description: { type: Type.STRING },
                                        examples: { type: Type.ARRAY, items: { type: Type.STRING } },
                                    },
                                },
                                barBehavior: { type: Type.STRING },
                                reasoning: { type: Type.STRING },
                            },
                        },
                        toneOfVoice: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    pillar: { type: Type.STRING },
                                    description: { type: Type.STRING },
                                    example: { type: Type.STRING },
                                },
                            },
                        },
                    },
                },
            },
        });

        const tokens = extractTokens(response);
        const parsed = JSON.parse(response.text?.trim() || '{}');

        const primaryArch = ARCHETYPES_RAG.find(a => a.id === parsed.archetypes?.primary?.id);
        const secondaryArch = ARCHETYPES_RAG.find(a => a.id === parsed.archetypes?.secondary?.id);

        const archetypes: ArchetypesV2 = {
            primary: {
                id: parsed.archetypes?.primary?.id || 1,
                title: primaryArch?.titulo || parsed.archetypes?.primary?.title || '',
                description: primaryArch?.descricao || parsed.archetypes?.primary?.description || '',
                examples: primaryArch?.exemplos || parsed.archetypes?.primary?.examples || [],
            },
            secondary: {
                id: parsed.archetypes?.secondary?.id || 2,
                title: secondaryArch?.titulo || parsed.archetypes?.secondary?.title || '',
                description: secondaryArch?.descricao || parsed.archetypes?.secondary?.description || '',
                examples: secondaryArch?.exemplos || parsed.archetypes?.secondary?.examples || [],
            },
            barBehavior: parsed.archetypes?.barBehavior || '',
            reasoning: parsed.archetypes?.reasoning || '',
        };

        const toneOfVoice: ToneOfVoicePillar[] = (parsed.toneOfVoice || []).slice(0, 3);

        return { result: { archetypes, toneOfVoice }, ...tokens };
    });
}

// ═══════════════════════════════════════════
// Step 5: Manifesto & Slogan
// ═══════════════════════════════════════════

export async function generateManifesto(prompt: string, previousData: BrandingData): Promise<GenResult<Manifesto>> {
    return withRetry(async () => {
        const systemPrompt = `${VISANT_SYSTEM}

Manifesto — condensa toda a estratégia em palavras que respiram.
Se a Mensagem Central é para dentro, o Manifesto é para fora.

Estrutura obrigatória — 3 Movimentos:

1. PROVOCAÇÃO: pergunta ou imagem que o leitor reconhece ("sim, isso é comigo").
   Pode começar com uma história que ajude a visualizar o universo da marca.

2. TENSÃO: o problema que existe — a frustração, a falta, o incômodo que a marca veio resolver.

3. PROMESSA: o que a marca faz, com quem, para quê. Feche com frase de impacto curta e marcante.

A frase final do manifesto vira SUGESTÃO DE SLOGAN.

Escreva o manifesto com emoção, narrativa e alma. Não seja genérico.

Contexto construído:
- Marca: "${prompt}"
- Mensagem Central: ${previousData.centralMessage?.statement || 'N/A'}
- Pilares: ${previousData.pillars?.map(p => `${p.name}: ${p.description}`).join('; ') || 'N/A'}
- Persona: ${previousData.personaV2?.name || 'N/A'}, ${previousData.personaV2?.context || 'N/A'}
  Dores: ${previousData.personaV2?.painPoints?.map(p => p.title).join(', ') || 'N/A'}
  Desejos: ${previousData.personaV2?.desires?.map(d => d.title).join(', ') || 'N/A'}
- Arquétipo primário: ${previousData.archetypesV2?.primary?.title || 'N/A'}
- Arquétipo secundário: ${previousData.archetypesV2?.secondary?.title || 'N/A'}
- Tom de Voz: ${previousData.toneOfVoice?.map(t => t.pillar).join(', ') || 'N/A'}
${langInstruction(prompt)}`;

        const response = await getAI().models.generateContent({
            model: GEMINI_MODELS.TEXT,
            contents: { parts: [{ text: systemPrompt }] },
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        provocation: { type: Type.STRING },
                        tension: { type: Type.STRING },
                        promise: { type: Type.STRING },
                        fullText: { type: Type.STRING },
                        sloganSuggestion: { type: Type.STRING },
                    },
                },
            },
        });

        const tokens = extractTokens(response);
        const parsed = JSON.parse(response.text?.trim() || '{}');
        return { result: parsed as Manifesto, ...tokens };
    });
}

// ═══════════════════════════════════════════
// Step 6: SWOT
// ═══════════════════════════════════════════

export async function generateSWOTV2(prompt: string, previousData: BrandingData): Promise<GenResult<{ strengths: string[]; weaknesses: string[]; opportunities: string[]; threats: string[] }>> {
    return withRetry(async () => {
        const systemPrompt = `${VISANT_SYSTEM}

Análise SWOT estratégica. Foco em fatores que impactam diferenciação e defensibilidade competitiva.

- Strengths: O que torna essa marca defensível e difícil de copiar
- Weaknesses: Gaps estratégicos que impedem diferenciação
- Opportunities: Gaps de mercado que suportam posicionamento único
- Threats: Forças competitivas que desafiam a posição da marca

Contexto:
- Marca: "${prompt}"
- Mensagem Central: ${previousData.centralMessage?.statement || 'N/A'}
- Pilares: ${previousData.pillars?.map(p => p.name).join(', ') || 'N/A'}
- Concorrentes: ${previousData.marketResearchV2?.competitors?.map(c => c.name).join(', ') || 'N/A'}
- Território livre: ${previousData.marketResearchV2?.whatNobodyDoes?.join('; ') || 'N/A'}
- Persona: ${previousData.personaV2?.name || 'N/A'}
${langInstruction(prompt)}`;

        const response = await getAI().models.generateContent({
            model: GEMINI_MODELS.TEXT,
            contents: { parts: [{ text: systemPrompt }] },
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
                        weaknesses: { type: Type.ARRAY, items: { type: Type.STRING } },
                        opportunities: { type: Type.ARRAY, items: { type: Type.STRING } },
                        threats: { type: Type.ARRAY, items: { type: Type.STRING } },
                    },
                },
            },
        });

        const tokens = extractTokens(response);
        const parsed = JSON.parse(response.text?.trim() || '{}');
        return {
            result: {
                strengths: parsed.strengths || [],
                weaknesses: parsed.weaknesses || [],
                opportunities: parsed.opportunities || [],
                threats: parsed.threats || [],
            },
            ...tokens,
        };
    });
}

// ═══════════════════════════════════════════
// Step 7: Paleta Cromática (cores nomeadas)
// ═══════════════════════════════════════════

export async function generateColorPaletteV2(prompt: string, previousData: BrandingData): Promise<GenResult<NamedColor[]>> {
    return withRetry(async () => {
        const systemPrompt = `${VISANT_SYSTEM}

Cromatismo Visant — Cor nomeada é cor com propósito.

Paleta + tipografia definem 80% do tom de uma marca. Uma paleta bem construída aguenta ser aplicada em tudo: foto, texto, botão, fundo escuro, fundo claro, grande, pequeno.

Crie 5-7 cores, cada uma com:
- NAME: nome criativo que comunica quando usá-la (ex: "Matchday Green", "Deep Green", "Court Blue")
- HEX: código hexadecimal
- ROLE: função na marca (ex: "O verde de dia de jogo, denso, maduro", "Quase preto, o chão da marca")
- PSYCHOLOGY: psicologia da cor e por que se encaixa no posicionamento

Inclua sempre: 1 cor vibrante principal, 1 cor neutra escura (chão), 1 cor clara (respiro/fundo), 2-3 cores de suporte.

Contexto:
- Marca: "${prompt}"
- Mensagem Central: ${previousData.centralMessage?.statement || 'N/A'}
- Pilares: ${previousData.pillars?.map(p => p.name).join(', ') || 'N/A'}
- Arquétipo primário: ${previousData.archetypesV2?.primary?.title || 'N/A'}
- Arquétipo secundário: ${previousData.archetypesV2?.secondary?.title || 'N/A'}
- Manifesto (tom): ${previousData.manifesto?.sloganSuggestion || 'N/A'}
- Tom de Voz: ${previousData.toneOfVoice?.map(t => t.pillar).join(', ') || 'N/A'}
${langInstruction(prompt)}`;

        const response = await getAI().models.generateContent({
            model: GEMINI_MODELS.TEXT,
            contents: { parts: [{ text: systemPrompt }] },
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        colors: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    name: { type: Type.STRING },
                                    hex: { type: Type.STRING },
                                    role: { type: Type.STRING },
                                    psychology: { type: Type.STRING },
                                },
                            },
                        },
                    },
                },
            },
        });

        const tokens = extractTokens(response);
        const parsed = JSON.parse(response.text?.trim() || '{}');
        return { result: (parsed.colors || []) as NamedColor[], ...tokens };
    });
}

// ═══════════════════════════════════════════
// Step 8: Par Tipográfico
// ═══════════════════════════════════════════

export async function generateTypography(prompt: string, previousData: BrandingData): Promise<GenResult<TypographyPair>> {
    return withRetry(async () => {
        const systemPrompt = `${VISANT_SYSTEM}

Par Tipográfico Visant — tipografia funciona em pares. Mínimo duas famílias, cada uma com função específica.

- HEADLINE: destaque, títulos grandes, carrega sotaque visual da marca.
- CORPO (Legibilidade): texto corrido, neutra, clara em tamanhos pequenos.

Erro clássico: usar uma fonte que tenta fazer os dois papéis.

Sugira fontes REAIS do Google Fonts ou Adobe Fonts. Para cada:
- family: nome exato da fonte
- rationale: por que essa fonte se encaixa no posicionamento

Contexto:
- Marca: "${prompt}"
- Mensagem Central: ${previousData.centralMessage?.statement || 'N/A'}
- Arquétipo primário: ${previousData.archetypesV2?.primary?.title || 'N/A'}
- Arquétipo secundário: ${previousData.archetypesV2?.secondary?.title || 'N/A'}
- Tom de Voz: ${previousData.toneOfVoice?.map(t => t.pillar).join(', ') || 'N/A'}
- Paleta: ${previousData.colorPaletteV2?.map(c => `${c.name} (${c.hex})`).join(', ') || 'N/A'}
${langInstruction(prompt)}`;

        const response = await getAI().models.generateContent({
            model: GEMINI_MODELS.TEXT,
            contents: { parts: [{ text: systemPrompt }] },
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        headline: {
                            type: Type.OBJECT,
                            properties: {
                                family: { type: Type.STRING },
                                rationale: { type: Type.STRING },
                            },
                        },
                        body: {
                            type: Type.OBJECT,
                            properties: {
                                family: { type: Type.STRING },
                                rationale: { type: Type.STRING },
                            },
                        },
                    },
                },
            },
        });

        const tokens = extractTokens(response);
        const parsed = JSON.parse(response.text?.trim() || '{}');
        return { result: parsed as TypographyPair, ...tokens };
    });
}

// ═══════════════════════════════════════════
// Step 9: Sistema Gráfico
// ═══════════════════════════════════════════

export async function generateGraphicSystem(prompt: string, previousData: BrandingData): Promise<GenResult<GraphicSystem>> {
    return withRetry(async () => {
        const systemPrompt = `${VISANT_SYSTEM}

Sistema Gráfico Visant — Uma marca forte é reconhecida mesmo sem o logo aparecer.

O que o olho reconhece é o conjunto: paleta aplicada de um jeito específico, pattern que se repete, forma de cortar foto, grafismo característico, grid editorial.

Defina os 4 componentes:

1. PATTERNS (2-3): padrões para fundos, tecidos, embalagens. Descreva visualmente.
2. GRAFISMOS (2-3): formas ou ilustrações próprias com DNA da marca. Devem derivar dos pilares e arquétipos.
3. REGRAS DE IMAGEM (3-4): como fotografa, como corta, que filtros aplica, que tipo de imagem usar.
4. GRID EDITORIAL: descrição da malha que organiza posts, páginas, apresentações.

Contexto:
- Marca: "${prompt}"
- Mensagem Central: ${previousData.centralMessage?.statement || 'N/A'}
- Pilares: ${previousData.pillars?.map(p => p.name).join(', ') || 'N/A'}
- Arquétipos: ${previousData.archetypesV2?.primary?.title || 'N/A'} + ${previousData.archetypesV2?.secondary?.title || 'N/A'}
- Manifesto: ${previousData.manifesto?.sloganSuggestion || 'N/A'}
- Paleta: ${previousData.colorPaletteV2?.map(c => `${c.name} (${c.hex})`).join(', ') || 'N/A'}
- Tipografia: ${previousData.typography?.headline?.family || 'N/A'} + ${previousData.typography?.body?.family || 'N/A'}
${langInstruction(prompt)}`;

        const response = await getAI().models.generateContent({
            model: GEMINI_MODELS.TEXT,
            contents: { parts: [{ text: systemPrompt }] },
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        patterns: { type: Type.ARRAY, items: { type: Type.STRING } },
                        graphicElements: { type: Type.ARRAY, items: { type: Type.STRING } },
                        imageRules: { type: Type.ARRAY, items: { type: Type.STRING } },
                        editorialGrid: { type: Type.STRING },
                    },
                },
            },
        });

        const tokens = extractTokens(response);
        const parsed = JSON.parse(response.text?.trim() || '{}');
        return { result: parsed as GraphicSystem, ...tokens };
    });
}

// ═══════════════════════════════════════════
// Step 10: Conceito de Logo
// ═══════════════════════════════════════════

export async function generateLogoConcept(prompt: string, previousData: BrandingData): Promise<GenResult<LogoConcept>> {
    return withRetry(async () => {
        const systemPrompt = `${VISANT_SYSTEM}

Conceito de Logo Visant — Logo é a peça mais vista no mundo (avatar, favicon, bordado).

3 fases: Conceito → Esboço → Construção & Teste.

Gere DIRETRIZES CONCEITUAIS (não o logo em si):

1. O que o símbolo PRECISA comunicar (lista derivada dos Pilares e Arquétipos)
2. 2-3 IDEIAS DE CONCEITO, cada uma com:
   - concept: descrição visual do conceito (ex: "Círculo duplo concêntrico + monograma")
   - meanings: significados (ex: ["A bola — símbolo primário do esporte", "A quadra — movimento orbital", "A turma — roda como símbolo de grupo"])

   Múltiplos significados em uma forma. Todos respondendo aos Pilares e Mix Arquetípico.

3. Notas sobre geometria e grid (ex: "construção em grid circular transmite profissionalismo e longevidade")

Contexto:
- Marca: "${prompt}"
- Mensagem Central: ${previousData.centralMessage?.statement || 'N/A'}
- Pilares: ${previousData.pillars?.map(p => `${p.name}: ${p.description}`).join('; ') || 'N/A'}
- Arquétipos: ${previousData.archetypesV2?.primary?.title || 'N/A'} + ${previousData.archetypesV2?.secondary?.title || 'N/A'}
- Manifesto: ${previousData.manifesto?.sloganSuggestion || 'N/A'}
- Paleta: ${previousData.colorPaletteV2?.map(c => c.name).join(', ') || 'N/A'}
- Tipografia headline: ${previousData.typography?.headline?.family || 'N/A'}
${langInstruction(prompt)}`;

        const response = await getAI().models.generateContent({
            model: GEMINI_MODELS.TEXT,
            contents: { parts: [{ text: systemPrompt }] },
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        whatItMustCommunicate: { type: Type.ARRAY, items: { type: Type.STRING } },
                        conceptIdeas: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    concept: { type: Type.STRING },
                                    meanings: { type: Type.ARRAY, items: { type: Type.STRING } },
                                },
                            },
                        },
                        geometryNotes: { type: Type.STRING },
                    },
                },
            },
        });

        const tokens = extractTokens(response);
        const parsed = JSON.parse(response.text?.trim() || '{}');
        return { result: parsed as LogoConcept, ...tokens };
    });
}

// ═══════════════════════════════════════════
// Re-export usage record from v1 (shared)
// ═══════════════════════════════════════════

export { createBrandingUsageRecord } from './brandingService.js';
