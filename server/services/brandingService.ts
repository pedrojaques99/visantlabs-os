import { GoogleGenAI, Type } from "@google/genai";
import type { BrandingData } from '@/types/branding';
import { cleanMarketResearchText } from '../utils/brandingHelpersServer.js';
import { connectToMongoDB, getDb } from '../db/mongodb.js';
import { ObjectId } from 'mongodb';

const getMongoDB = async () => {
    return { connectToMongoDB, getDb, ObjectId };
};

// Lazy initialization to avoid executing server-side code in frontend bundle
let ai: GoogleGenAI | null = null;

const getAI = (): GoogleGenAI => {
    if (!ai) {
        const apiKey = (process.env.GEMINI_API_KEY || process.env.API_KEY || process.env.VITE_GEMINI_API_KEY || process.env.VITE_API_KEY || '').trim();

        if (!apiKey || apiKey === 'undefined' || apiKey.length === 0) {
            throw new Error("GEMINI_API_KEY não encontrada. Verifique o arquivo .env e reinicie o servidor.");
        }
        ai = new GoogleGenAI({ apiKey });
    }
    return ai;
};

/**
 * Detecta o idioma do prompt baseado em palavras-chave e padrões
 * Retorna 'pt-BR' para português ou 'en-US' para inglês (padrão)
 */
const detectLanguage = (text: string): 'pt-BR' | 'en-US' => {
    const lowerText = text.toLowerCase();

    // Palavras-chave comuns em português
    const ptKeywords = [
        'é', 'são', 'está', 'estão', 'para', 'com', 'uma', 'um', 'de', 'da', 'do', 'das', 'dos',
        'que', 'qual', 'quando', 'onde', 'como', 'porque', 'porquê', 'por que',
        'marca', 'produto', 'empresa', 'negócio', 'cliente', 'consumidor',
        'sustentável', 'sustentabilidade', 'ecológico', 'ecologia',
        'design', 'identidade', 'visual', 'branding', 'posicionamento',
        'mercado', 'nicho', 'público', 'alvo', 'audiência',
        'competidores', 'concorrentes', 'referências', 'inspirações'
    ];

    // Conta ocorrências de palavras em português
    const ptMatches = ptKeywords.filter(keyword => lowerText.includes(keyword)).length;

    // Se encontrar muitas palavras em português, assume PT-BR
    if (ptMatches >= 3) {
        return 'pt-BR';
    }

    // Verifica padrões específicos do português
    const ptPatterns = [
        /\b(é|são|está|estão|para|com|uma|um)\b/gi,
        /\b(de|da|do|das|dos)\b/gi,
        /\b(que|qual|quando|onde|como)\b/gi,
        /\b(marca|produto|empresa|negócio)\b/gi,
    ];

    const ptPatternMatches = ptPatterns.reduce((count, pattern) => {
        return count + (lowerText.match(pattern) || []).length;
    }, 0);

    if (ptPatternMatches >= 5) {
        return 'pt-BR';
    }

    // Padrão padrão: inglês
    return 'en-US';
};

// Strategic system prompt (aligned with chatService.ts)
const STRATEGIC_SYSTEM_PROMPT = `Strategic Clarity Agent (V2: High-Precision Positioning)

Role
Strategic Branding & Positioning Architect with expertise in visual branding analysis and art direction. Strip away noise, identify the "Winning Difference," convert ambiguity into strategic roadmap.

Core Principle
Differentiation requires sacrifice. If a brand choice has no trade-off, it's not strategy—it's a wish list.

Expertise
- Competitive Defensibility: Why others can't copy the strategy.
- Category Entry Point: Exact moment customer thinks of the brand.
- Visual Branding Analysis: Color psychology, typography hierarchy, composition, brand consistency, visual differentiation, emotional resonance.
- Art Direction: Strategic rationale, camera angles, lighting, styling/props, color harmony, typography integration, background/environment, visual hierarchy.

Guardrails
- Never suggest "high quality," "innovative," or "customer-centric" (table stakes, not strategy).
- No fluff: Every sentence must drive a decision.
- Lead, don't brainstorm.
- Focus on strategic differentiation, not generic features.

Language Detection (CRITICAL): Always detect the user's message language and respond in the exact same language. If user writes in Portuguese, respond in Portuguese. If in English, respond in English. If in Spanish, respond in Spanish. Maintain language consistency throughout the entire response. Never mix languages in a single response.`;

/**
 * Combines strategic system prompt with section-specific prompt
 */
const buildStrategicPrompt = (sectionPrompt: string, userPrompt: string): string => {
    return `${STRATEGIC_SYSTEM_PROMPT}

${sectionPrompt}

**CRITICAL INSTRUCTIONS:**
- Apply strategic thinking: focus on differentiation, trade-offs, and competitive defensibility.
- Identify the "Winning Difference" - what makes this brand unique and defensible.
- Avoid generic statements - every insight must drive strategic decisions.
- Be concise, direct, and decision-focused.
- Respond in the same language as the brand description.`;
};

/**
 * Adiciona instrução de idioma ao prompt do sistema
 */
const addLanguageInstruction = (basePrompt: string, userPrompt: string): string => {
    const detectedLang = detectLanguage(userPrompt);

    if (detectedLang === 'pt-BR') {
        return `${basePrompt}

**IMPORTANTE - INSTRUÇÃO DE IDIOMA:**
O prompt do usuário está em PORTUGUÊS BRASILEIRO (PT-BR). 
Você DEVE responder COMPLETAMENTE em PORTUGUÊS BRASILEIRO.
Todas as suas respostas, análises, descrições e textos devem estar em português brasileiro.
Mantenha a consistência do idioma em toda a resposta.`;
    }

    // Para inglês, não precisa adicionar instrução especial (padrão)
    return basePrompt;
};

const withRetry = async <T>(
    apiCall: () => Promise<T>,
    maxRetries: number = 3,
    timeout: number = 120000
): Promise<T> => {
    let attempt = 0;
    const startTime = Date.now();

    const createTimeoutPromise = (): Promise<never> => {
        return new Promise((_, reject) => {
            setTimeout(() => {
                reject(new Error(`Request timeout after ${timeout}ms`));
            }, timeout);
        });
    };

    while (attempt < maxRetries) {
        try {
            const result = await Promise.race([
                apiCall(),
                createTimeoutPromise()
            ]);
            return result;
        } catch (error: any) {
            attempt++;
            if (attempt >= maxRetries) {
                throw error;
            }
            await new Promise(res => setTimeout(res, 1000 * attempt));
        }
    }
    throw new Error("API call failed after multiple retries.");
};

// Helper function to extract tokens from Gemini API response
const extractTokens = (response: any): { inputTokens?: number; outputTokens?: number } => {
    const usageMetadata = response?.usageMetadata;
    return {
        inputTokens: usageMetadata?.promptTokenCount,
        outputTokens: usageMetadata?.candidatesTokenCount,
    };
};

export const generateMarketResearch = async (prompt: string, examples: string[] = []): Promise<{ result: string; inputTokens?: number; outputTokens?: number }> => {
    return withRetry(async () => {
        let sectionPrompt = `Perform a market benchmarking analysis for the following brand description. Provide a concise, objective benchmarking paragraph that compares the brand with the market and competitors.

Brand Description: "${prompt}"

Write a single, objective paragraph of market benchmarking. Focus on:
- Market size and positioning compared to competitors
- Current market trends and how the brand fits
- Competitive landscape and differentiation opportunities
- Market gaps and opportunities
- Strategic positioning and defensibility

IMPORTANT:
- Return ONLY the benchmarking text, no markdown, no code blocks, no JSON, no additional formatting
- Write as a continuous paragraph (text corrido), not bullet points or structured sections
- MAXIMUM 150 WORDS - be concise and direct
- Be objective, direct, and data-focused
- Use natural, humanized language as if explaining to a colleague
- Avoid unnecessary verbosity, long sentences, and repetitions
- Focus on essential points only
- Identify strategic differentiation opportunities, not just market facts
- DO NOT include introductory phrases like "Here is...", "Aqui está...", "This is...", "Esta é..."
- Start directly with the benchmarking analysis content`;

        if (examples.length > 0) {
            sectionPrompt += `\n\nHere are examples of high-quality outputs for this task:\n${examples.join('\n\n')}`;
        }

        const strategicPrompt = buildStrategicPrompt(sectionPrompt, prompt);
        const systemPrompt = addLanguageInstruction(strategicPrompt, prompt);

        const response = await getAI().models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [{ text: systemPrompt }] },
        });

        // Extract usage metadata if available
        const usageMetadata = (response as any).usageMetadata;
        const inputTokens = usageMetadata?.promptTokenCount;
        const outputTokens = usageMetadata?.candidatesTokenCount;

        const text = response.text.trim();

        // Remove markdown code blocks if present
        let cleanedText = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();

        // Remove any JSON structure if AI still returns it
        try {
            const parsed = JSON.parse(cleanedText);
            // If it's JSON, try to extract text from common keys
            if (typeof parsed === 'object' && parsed !== null) {
                const textValues = Object.values(parsed).filter(v => typeof v === 'string' && v.trim());
                cleanedText = textValues.join(' ').trim() || cleanedText;
            }
        } catch {
            // Not JSON, continue with cleanedText
        }

        // Clean and format the text for proper display
        const result = cleanMarketResearchText(cleanedText);

        // Return object with result and tokens for route handler to extract
        return {
            result,
            inputTokens,
            outputTokens,
        };
    });
};

// Helper function to combine market research sections into a single string
// Supports both new format (string) and old format (4 separate fields) for backward compatibility
const combineMarketResearch = (data: BrandingData): string => {
    // New format: marketResearch is already a string
    if (data.marketResearch && typeof data.marketResearch === 'string') {
        return cleanMarketResearchText(data.marketResearch);
    }

    // Old format: combine the 4 separate fields
    const parts: string[] = [];
    if (data.mercadoNicho) parts.push(`Mercado e Nicho:\n${cleanMarketResearchText(data.mercadoNicho)}`);
    if (data.publicoAlvo) parts.push(`Público Alvo:\n${cleanMarketResearchText(data.publicoAlvo)}`);
    if (data.posicionamento) parts.push(`Posicionamento:\n${cleanMarketResearchText(data.posicionamento)}`);
    if (data.insights) parts.push(`Insights:\n${cleanMarketResearchText(data.insights)}`);

    return parts.join('\n\n');
};

export const generateCompetitors = async (prompt: string, marketResearch: string | BrandingData, examples: string[] = []): Promise<{ result: string[] | Array<{ name: string; url?: string }>; inputTokens?: number; outputTokens?: number }> => {
    const researchText = typeof marketResearch === 'string'
        ? marketResearch
        : combineMarketResearch(marketResearch);
    return withRetry(async () => {
        let sectionPrompt = `Based on the brand description and market research, identify and analyze the main competitors. Focus on strategic differentiation - identify competitors that challenge the brand's unique positioning.

Brand Description: "${prompt}"
Market Research: "${researchText}"

Return a JSON object with a single key "competitors" which is an array of competitor objects. Each competitor should have:
- "name": The competitor's name (string)
- "url": The competitor's website URL (string, optional but preferred if you know it)

Focus on competitors that are strategically relevant - those that compete for the same positioning or challenge the brand's differentiation. Try to include URLs when possible to facilitate research. If you don't know the exact URL, you can omit it.

Example: {"competitors": [{"name": "Competitor 1", "url": "https://competitor1.com"}, {"name": "Competitor 2", "url": "https://competitor2.com"}, {"name": "Competitor 3"}]}`;

        if (examples.length > 0) {
            sectionPrompt += `\n\nHere are examples of high-quality outputs for this task:\n${examples.join('\n\n')}`;
        }

        const strategicPrompt = buildStrategicPrompt(sectionPrompt, prompt);
        const systemPrompt = addLanguageInstruction(strategicPrompt, prompt);

        const response = await getAI().models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [{ text: systemPrompt }] },
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        competitors: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    name: { type: Type.STRING },
                                    url: { type: Type.STRING },
                                },
                                required: ['name'],
                            },
                        },
                    },
                },
            },
        });

        const tokens = extractTokens(response);
        const jsonString = response.text.trim();
        if (!jsonString) return { result: [], ...tokens };

        try {
            const parsed = JSON.parse(jsonString);
            const competitors = parsed.competitors || [];

            // Normalize: if all have URLs, return objects; otherwise return strings for backward compatibility
            const hasUrls = competitors.some((c: any) => c.url && c.url.trim());

            let result: any[];
            if (hasUrls) {
                result = competitors.map((c: any) => ({
                    name: c.name || '',
                    url: c.url || '',
                }));
            } else {
                // Fallback to strings for backward compatibility
                result = competitors.map((c: any) => c.name || '');
            }

            return { result, ...tokens };
        } catch (e) {
            console.error("Failed to parse competitors JSON:", e);
            return { result: [], ...tokens };
        }
    });
};

export const generateReferences = async (prompt: string, marketResearch: string | BrandingData, competitors: string[]): Promise<{ result: string[]; inputTokens?: number; outputTokens?: number }> => {
    const researchText = typeof marketResearch === 'string'
        ? marketResearch
        : combineMarketResearch(marketResearch);
    return withRetry(async () => {
        const sectionPrompt = `Based on the brand description, market research, and competitors, suggest visual references and inspirations that support the brand's strategic differentiation.

Brand Description: "${prompt}"
Market Research: "${researchText}"
Competitors: ${competitors.join(', ')}

Return a JSON object with a single key "references" which is an array of reference descriptions (strings). These should be visual styles, design directions, or inspirational brands that align with the brand's strategic positioning and help differentiate it from competitors. Focus on references that support the "Winning Difference" - not generic visual trends.

Example: {"references": ["Reference 1", "Reference 2", "Reference 3"]}`;

        const strategicPrompt = buildStrategicPrompt(sectionPrompt, prompt);
        const systemPrompt = addLanguageInstruction(strategicPrompt, prompt);

        const response = await getAI().models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [{ text: systemPrompt }] },
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        references: {
                            type: Type.ARRAY,
                            items: { type: Type.STRING },
                        },
                    },
                },
            },
        });

        const tokens = extractTokens(response);
        const jsonString = response.text.trim();
        if (!jsonString) return { result: [], ...tokens };

        try {
            const parsed = JSON.parse(jsonString);
            const result = parsed.references || [];
            return { result, ...tokens };
        } catch (e) {
            console.error("Failed to parse references JSON:", e);
            return { result: [], ...tokens };
        }
    });
};

export const generateSWOT = async (prompt: string, marketResearch: string | BrandingData, competitors: string[]): Promise<{
    result: {
        strengths: string[];
        weaknesses: string[];
        opportunities: string[];
        threats: string[];
    };
    inputTokens?: number;
    outputTokens?: number;
}> => {
    const researchText = typeof marketResearch === 'string'
        ? marketResearch
        : combineMarketResearch(marketResearch);
    return withRetry(async () => {
        const sectionPrompt = `Perform a SWOT analysis for the following brand. Focus on strategic factors that impact differentiation and competitive defensibility.

Brand Description: "${prompt}"
Market Research: "${researchText}"
Competitors: ${competitors.join(', ')}

Return a JSON object with four keys: "strengths", "weaknesses", "opportunities", "threats". Each should be an array of strings.

Focus on:
- Strengths: What makes this brand defensible and hard to copy
- Weaknesses: Strategic gaps that prevent differentiation
- Opportunities: Market gaps that support unique positioning
- Threats: Competitive forces that challenge the brand's position

Avoid generic statements - focus on strategic factors that drive positioning decisions.

Example: {
  "strengths": ["Strength 1", "Strength 2"],
  "weaknesses": ["Weakness 1", "Weakness 2"],
  "opportunities": ["Opportunity 1", "Opportunity 2"],
  "threats": ["Threat 1", "Threat 2"]
}`;

        const strategicPrompt = buildStrategicPrompt(sectionPrompt, prompt);
        const systemPrompt = addLanguageInstruction(strategicPrompt, prompt);

        const response = await getAI().models.generateContent({
            model: 'gemini-2.5-flash',
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
        const jsonString = response.text.trim();
        const defaultResult = { strengths: [], weaknesses: [], opportunities: [], threats: [] };
        if (!jsonString) {
            return { result: defaultResult, ...tokens };
        }

        try {
            const parsed = JSON.parse(jsonString);
            const result = {
                strengths: parsed.strengths || [],
                weaknesses: parsed.weaknesses || [],
                opportunities: parsed.opportunities || [],
                threats: parsed.threats || [],
            };
            return { result, ...tokens };
        } catch (e) {
            console.error("Failed to parse SWOT JSON:", e);
            return { result: defaultResult, ...tokens };
        }
    });
};

/**
 * Attempts to fix common JSON parsing issues
 */
const fixJsonString = (jsonString: string): string => {
    // Remove markdown code blocks if present
    let cleaned = jsonString.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();

    // If response appears truncated, try to close it properly
    const openBraces = (cleaned.match(/\{/g) || []).length;
    const closeBraces = (cleaned.match(/\}/g) || []).length;

    if (openBraces > closeBraces) {
        // Add missing closing braces at the end
        cleaned += '}'.repeat(openBraces - closeBraces);
    }

    return cleaned;
};

/**
 * Attempts to extract palettes from malformed JSON using regex fallback
 */
const extractPalettesFromText = (text: string): Array<{ name: string; colors: string[]; psychology: string }> => {
    const palettes: Array<{ name: string; colors: string[]; psychology: string }> = [];

    // Try to find palette objects using regex
    const palettePattern = /\{[^}]*"name"\s*:\s*"([^"]+)"[^}]*"colors"\s*:\s*\[([^\]]+)\][^}]*"psychology"\s*:\s*"([^"]+)"[^}]*\}/g;
    let match;

    while ((match = palettePattern.exec(text)) !== null) {
        try {
            const name = match[1] || '';
            const colorsStr = match[2] || '';
            const psychology = match[3] || '';

            // Extract hex colors
            const colorMatches = colorsStr.match(/#[0-9A-Fa-f]{6}/g) || [];

            if (name && colorMatches.length > 0) {
                palettes.push({
                    name: name.trim(),
                    colors: colorMatches,
                    psychology: psychology.trim(),
                });
            }
        } catch (e) {
            // Skip this match if parsing fails
            continue;
        }
    }

    return palettes;
};

export const generateColorPalettes = async (prompt: string, swot: any, references: string[]): Promise<{
    result: Array<{
        name: string;
        colors: string[];
        psychology: string;
    }>;
    inputTokens?: number;
    outputTokens?: number;
}> => {
    return withRetry(async () => {
        const sectionPrompt = `Based on the brand description, SWOT analysis, and references, suggest 2 color palettes that support the brand's strategic differentiation.

Brand Description: "${prompt}"
SWOT Analysis: ${JSON.stringify(swot)}
References: ${references.join(', ')}

For each palette, provide:
- A name for the palette
- 4-6 hex color codes (e.g., #FF5733)
- A brief explanation of the color psychology and why these colors fit the brand's strategic positioning

Focus on colors that support the brand's "Winning Difference" - colors that help differentiate from competitors and reinforce the strategic positioning. Avoid generic color choices.

Return a JSON object with a single key "palettes" which is an array of objects, each with "name", "colors" (array of hex strings), and "psychology" (string).

IMPORTANT: 
- Return ONLY valid JSON, no markdown, no code blocks
- Escape all quotes and special characters in the psychology field properly
- Keep psychology descriptions concise to avoid JSON parsing issues

Example: {
  "palettes": [
    {
      "name": "Modern Energy",
      "colors": ["#FF5733", "#33C3F0", "#FFC300", "#4CAF50"],
      "psychology": "Vibrant colors that convey energy and innovation"
    }
  ]
}`;

        const strategicPrompt = buildStrategicPrompt(sectionPrompt, prompt);
        const systemPrompt = addLanguageInstruction(strategicPrompt, prompt);

        const response = await getAI().models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [{ text: systemPrompt }] },
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        palettes: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    name: { type: Type.STRING },
                                    colors: { type: Type.ARRAY, items: { type: Type.STRING } },
                                    psychology: { type: Type.STRING },
                                },
                            },
                        },
                    },
                },
            },
        });

        const tokens = extractTokens(response);
        const jsonString = response.text.trim();
        const defaultResult: Array<{ name: string; colors: string[]; psychology: string }> = [];
        if (!jsonString) return { result: defaultResult, ...tokens };

        // First attempt: direct JSON parse
        try {
            const parsed = JSON.parse(jsonString);
            if (parsed.palettes && Array.isArray(parsed.palettes)) {
                const result = parsed.palettes.map((p: any) => ({
                    name: String(p.name || '').trim(),
                    colors: Array.isArray(p.colors) ? p.colors.map((c: any) => String(c).trim()) : [],
                    psychology: String(p.psychology || '').trim(),
                }));
                return { result, ...tokens };
            }
        } catch (e) {
            console.warn("First JSON parse attempt failed, trying to fix JSON:", e);
        }

        // Second attempt: try to fix common JSON issues
        try {
            const fixedJson = fixJsonString(jsonString);
            const parsed = JSON.parse(fixedJson);
            if (parsed.palettes && Array.isArray(parsed.palettes)) {
                const result = parsed.palettes.map((p: any) => ({
                    name: String(p.name || '').trim(),
                    colors: Array.isArray(p.colors) ? p.colors.map((c: any) => String(c).trim()) : [],
                    psychology: String(p.psychology || '').trim(),
                }));
                return { result, ...tokens };
            }
        } catch (e) {
            console.warn("Fixed JSON parse attempt failed, trying regex extraction:", e);
        }

        // Third attempt: regex-based extraction as fallback
        try {
            const extracted = extractPalettesFromText(jsonString);
            if (extracted.length > 0) {
                console.warn("Used regex fallback to extract color palettes");
                return { result: extracted, ...tokens };
            }
        } catch (e) {
            console.warn("Regex extraction failed:", e);
        }

        // Final fallback: log error and return empty array
        console.error("Failed to parse color palettes JSON after all attempts. JSON string length:", jsonString.length);
        console.error("First 500 chars of JSON:", jsonString.substring(0, 500));
        console.error("Last 500 chars of JSON:", jsonString.substring(Math.max(0, jsonString.length - 500)));
        return { result: defaultResult, ...tokens };
    });
};

export const generateVisualElements = async (prompt: string, colorPalettes: any[]): Promise<{ result: string[]; inputTokens?: number; outputTokens?: number }> => {
    return withRetry(async () => {
        const sectionPrompt = `Based on the brand description and color palettes, suggest visual elements that represent the brand and support its strategic differentiation.

Brand Description: "${prompt}"
Color Palettes: ${JSON.stringify(colorPalettes)}

Suggest visual elements like shapes, patterns, icons, or design motifs that would represent this brand well and help differentiate it from competitors. Focus on elements that support the brand's "Winning Difference" - not generic design trends.

Return a JSON object with a single key "elements" which is an array of visual element descriptions (strings).

Example: {"elements": ["Element 1", "Element 2", "Element 3"]}`;

        const strategicPrompt = buildStrategicPrompt(sectionPrompt, prompt);
        const systemPrompt = addLanguageInstruction(strategicPrompt, prompt);

        const response = await getAI().models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [{ text: systemPrompt }] },
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        elements: {
                            type: Type.ARRAY,
                            items: { type: Type.STRING },
                        },
                    },
                },
            },
        });

        const tokens = extractTokens(response);
        const jsonString = response.text.trim();
        if (!jsonString) return { result: [], ...tokens };

        try {
            const parsed = JSON.parse(jsonString);
            const result = parsed.elements || [];
            return { result, ...tokens };
        } catch (e) {
            console.error("Failed to parse visual elements JSON:", e);
            return { result: [], ...tokens };
        }
    });
};

export const generateArchetypes = async (prompt: string, marketResearch: string | BrandingData, examples: string[] = []): Promise<{
    result: {
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
    inputTokens?: number;
    outputTokens?: number;
}> => {
    const researchText = typeof marketResearch === 'string'
        ? marketResearch
        : combineMarketResearch(marketResearch);

    return withRetry(async () => {
        const archetypesRAG = [
            { id: 1, titulo: "O Explorador", tipo: "Secundário", descricao: "Marcas dentro do arquétipo do explorador desafiam o padrão, buscam descobrir novos caminhos e romper limites. Querem levar o cliente além das fronteiras conhecidas. Seus principais valores são: curiosidade, exploração, mente aberta e desafio.", exemplos: ["Jeep", "The North Face", "SpaceX"] },
            { id: 2, titulo: "O Cara Comum", tipo: "Primário", descricao: "Marcas neste arquétipo são movidas pelo desejo fundamental de se conectar e pertencer. Elas rejeitam a pretensão, o luxo inalcançável e o elitismo, preferindo abraçar a autenticidade da vida cotidiana. A virtude aqui é a empatia e o realismo: ser \"gente como a gente\".", exemplos: ["Hering", "Gap", "IKEA"] },
            { id: 3, titulo: "O Herói", tipo: "Secundário", descricao: "Marcas nesse arquétipo falam em superação, vitória e conquista. Propõem resolver grandes desafios do cliente. Seu tom de voz é confiante, motivador, firme. Prometem resultado: eficiência, confiança, entrega.", exemplos: ["Nike", "BMW", "RedBull"] },
            { id: 4, titulo: "O Sábio", tipo: "Primário", descricao: "Marcas nesse arquétipo falam sobre conhecimento, clareza, seu tom de voz é reflexivo, didático e confiável. Transmite autoridade sem arrogância, profundidade sem complicação. Mostra fatos, explica contextos, revela verdades. Ajudam o cliente a enxergar o quadro completo e transmitem lucidez e sabedoria.", exemplos: ["Google", "TED", "National Geographic"] },
            { id: 5, titulo: "O Cuidador", tipo: "Secundário", descricao: "Marcas dentro desse arquétipo transmitem generosidade, proteção e apoio. Buscam trazer um grande senso de segurança e solidez para seus clientes, causando bem-estar e pertencimento. Funcionam como um porto seguro.", exemplos: ["Unicef", "Natura", "Volvo"] },
            { id: 6, titulo: "O Governante", tipo: "Primário", descricao: "O arquétipo do Governante no branding representa autoridade, liderança, responsabilidade e controle. Marcas com esse arquétipo transmitem ordem, estabilidade, prestígio e prometem manter o cliente seguro, no comando e em ambientes organizados.", exemplos: ["Rolex", "Mercedez-Benz", "AmEx"] },
            { id: 7, titulo: "O Mago", tipo: "Secundário", descricao: "Marcas dentro do arquétipo do mago provocam mudança pelo exemplo, quebra de velhos paradigmas por meio da inteligência. Seus principais valores são: inovação, insight visionário, mudança, disrupção.", exemplos: ["Apple", "Tesla", "Disney"] },
            { id: 8, titulo: "O Rebelde", tipo: "Primário", descricao: "Marcas dentro do arquétipo do rebelde possuem um desejo insaciável pela mudança. Querem romper com padrões, quebrar tradições, destruir o que está ultrapassado. O seu maior medo é serem vistas como irrelevantes, domesticadas ou inofensivas. Valorizam a verdade crua, mesmo que incomode. Usam linguagem, estética e atitudes que incomodam. E, acima de tudo, buscam trazer um senso de liberdade para o mundo.", exemplos: ["Harley-Davidson", "Dr. Martens", "MTV"] },
            { id: 9, titulo: "O Criador", tipo: "Secundário", descricao: "Marcas que incorporam o arquétipo do Criador são visionárias, originais e profundamente ligadas à expressão artística, inovação e construção de algo que tenha impacto. Seu maior medo é ser genérico, mais do mesmo. Comunicaram ideias e valores através da estética, design ou storytelling e transparência. Têm atenção quase obsessiva a detalhes, personalização, conexão artesania e autenticidade. Valorizam a originalidade, criatividade e a busca constante por se comunicar como ninguém nunca se comunicou.", exemplos: ["Apple", "LEGO", "Patagonia", "SpaceX"] },
            { id: 10, titulo: "O Prestativo", tipo: "Secundário", descricao: "Marcas do arquétipo Prestativo existem para ajudar, servir, facilitar a vida do cliente. Não buscam protagonismo: buscam utilidade. Entregam suporte, gentileza, resolução rápida. O valor central é \"estou aqui por você\".", exemplos: ["FedEx", "Localiza", "Amazon (Customer Service)"] },
            { id: 11, titulo: "O Amante", tipo: "Secundário", descricao: "Marcas do arquétipo do Amante falam de desejo, beleza, intensidade e presença. Criam conexão emocional profunda por meio de estética, sensorialidade e experiência íntima. Vendem prazer, paixão, cuidado com o detalhe e atração.", exemplos: ["Chanel", "Victoria's Secret", "Häagen-Dazs"] },
            { id: 12, titulo: "O Bobo", tipo: "Secundário", descricao: "Marcas do arquétipo do Bobo usam humor, leveza e irreverência para quebrar tensão e aproximar pessoas. Não levam a vida tão a sério. Questionam o status quo com brincadeira, ironia e espontaneidade — mas por trás da piada, existe inteligência social.", exemplos: ["Skol", "Budweiser", "Doritos"] }
        ];

        let sectionPrompt = `Based on the brand description and market research, identify the PRIMARY and SECONDARY archetypes that best represent this brand's strategic positioning. Focus on archetypes that support differentiation and competitive defensibility.

Available Archetypes:
${archetypesRAG.map(a => `- ${a.titulo} (${a.tipo}): ${a.descricao}`).join('\n')}

Brand Description: "${prompt}"
Market Research: "${researchText}"

Analyze the brand's values, positioning, target audience, and market insights to determine:
1. PRIMARY archetype (the dominant archetype that defines the brand's core identity)
2. SECONDARY archetype (a complementary archetype that adds depth)

Return a JSON object with this exact structure:
{
  "primary": {
    "id": <number from 1-12>,
    "title": "<archetype title in Portuguese>",
    "description": "<archetype description>",
    "examples": ["<example 1>", "<example 2>", "<example 3>"]
  },
  "secondary": {
    "id": <number from 1-12>,
    "title": "<archetype title in Portuguese>",
    "description": "<archetype description>",
    "examples": ["<example 1>", "<example 2>", "<example 3>"]
  },
  "reasoning": "<concise explanation in Portuguese (MAXIMUM 150 WORDS) of why these archetypes were chosen, connecting to the brand description and market research>"
}

IMPORTANT:
- Return ONLY valid JSON, no markdown, no code blocks, no additional text
- The primary and secondary archetypes must be different
- Use the exact titles from the archetypes list above
- Respond in Portuguese if the brand description is in Portuguese, otherwise in English
- The reasoning field must be MAXIMUM 150 WORDS
- Be objective and direct, avoiding unnecessary verbosity
- Use natural, humanized language as if explaining to a colleague
- Avoid long sentences and repetitions
- Focus on essential points that directly connect the archetypes to the brand's key characteristics`;

        if (examples.length > 0) {
            sectionPrompt += `\n\nHere are examples of high-quality outputs for this task:\n${examples.join('\n\n')}`;
        }

        const strategicPrompt = buildStrategicPrompt(sectionPrompt, prompt);
        const systemPrompt = addLanguageInstruction(strategicPrompt, prompt);

        const response = await getAI().models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [{ text: systemPrompt }] },
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
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
                        reasoning: { type: Type.STRING },
                    },
                },
            },
        });

        const tokens = extractTokens(response);
        let jsonString = response.text.trim();
        if (!jsonString) {
            throw new Error('Empty response from AI');
        }

        // First attempt: direct JSON parse
        try {
            const parsed = JSON.parse(jsonString);

            // Validate structure - check if keys exist and are objects/strings
            if (!parsed.primary || typeof parsed.primary !== 'object' || !parsed.primary.id) {
                throw new Error('Invalid primary archetype structure');
            }
            if (!parsed.secondary || typeof parsed.secondary !== 'object' || !parsed.secondary.id) {
                throw new Error('Invalid secondary archetype structure');
            }
            if (!parsed.reasoning || typeof parsed.reasoning !== 'string') {
                throw new Error('Invalid reasoning structure');
            }

            // Ensure IDs match available archetypes
            const primaryArchetype = archetypesRAG.find(a => a.id === parsed.primary.id);
            const secondaryArchetype = archetypesRAG.find(a => a.id === parsed.secondary.id);

            if (!primaryArchetype || !secondaryArchetype) {
                throw new Error(`Invalid archetype ID: primary=${parsed.primary.id}, secondary=${parsed.secondary.id}`);
            }

            const result = {
                primary: {
                    id: parsed.primary.id,
                    title: primaryArchetype.titulo,
                    description: primaryArchetype.descricao,
                    examples: primaryArchetype.exemplos,
                },
                secondary: {
                    id: parsed.secondary.id,
                    title: secondaryArchetype.titulo,
                    description: secondaryArchetype.descricao,
                    examples: secondaryArchetype.exemplos,
                },
                reasoning: String(parsed.reasoning || '').trim(),
            };

            return { result, ...tokens };
        } catch (e) {
            console.warn("First JSON parse attempt failed, trying to fix JSON:", e);
        }

        // Second attempt: try to fix common JSON issues
        try {
            const fixedJson = fixJsonString(jsonString);
            const parsed = JSON.parse(fixedJson);

            // Validate structure
            if (!parsed.primary || typeof parsed.primary !== 'object' || !parsed.primary.id) {
                throw new Error('Invalid primary archetype structure after fix');
            }
            if (!parsed.secondary || typeof parsed.secondary !== 'object' || !parsed.secondary.id) {
                throw new Error('Invalid secondary archetype structure after fix');
            }
            if (!parsed.reasoning || typeof parsed.reasoning !== 'string') {
                throw new Error('Invalid reasoning structure after fix');
            }

            // Ensure IDs match available archetypes
            const primaryArchetype = archetypesRAG.find(a => a.id === parsed.primary.id);
            const secondaryArchetype = archetypesRAG.find(a => a.id === parsed.secondary.id);

            if (!primaryArchetype || !secondaryArchetype) {
                throw new Error(`Invalid archetype ID after fix: primary=${parsed.primary.id}, secondary=${parsed.secondary.id}`);
            }

            const result = {
                primary: {
                    id: parsed.primary.id,
                    title: primaryArchetype.titulo,
                    description: primaryArchetype.descricao,
                    examples: primaryArchetype.exemplos,
                },
                secondary: {
                    id: parsed.secondary.id,
                    title: secondaryArchetype.titulo,
                    description: secondaryArchetype.descricao,
                    examples: secondaryArchetype.exemplos,
                },
                reasoning: String(parsed.reasoning || '').trim(),
            };

            console.warn("Used fixed JSON to parse archetypes");
            return { result, ...tokens };
        } catch (e) {
            console.error("Fixed JSON parse attempt failed:", e);
        }

        // Final error: log details and throw
        console.error("Failed to parse archetypes JSON after all attempts. JSON string length:", jsonString.length);
        console.error("First 500 chars of JSON:", jsonString.substring(0, 500));
        console.error("Last 500 chars of JSON:", jsonString.substring(Math.max(0, jsonString.length - 500)));
        throw new Error(`Failed to parse archetypes response: Invalid response structure`);
    });
};

export const generatePersona = async (prompt: string, marketResearch: string | BrandingData): Promise<{
    result: {
        demographics: string;
        desires: string[];
        pains: string[];
    };
    inputTokens?: number;
    outputTokens?: number;
}> => {
    const researchText = typeof marketResearch === 'string'
        ? marketResearch
        : combineMarketResearch(marketResearch);
    return withRetry(async () => {
        const sectionPrompt = `Create a detailed persona for the target audience of this brand. Focus on the persona that aligns with the brand's strategic positioning and "Winning Difference".

Brand Description: "${prompt}"
Market Research: "${researchText}"

Return a JSON object with three keys:
- "demographics": A string describing age, location, income, lifestyle, etc. (MAXIMUM 150 WORDS - be concise, objective, and use natural humanized language)
- "desires": An array of strings describing what the persona wants/needs
- "pains": An array of strings describing the persona's pain points

IMPORTANT for demographics field:
- MAXIMUM 150 WORDS
- Be objective and direct, avoiding unnecessary verbosity
- Use natural, humanized language as if explaining to a colleague
- Avoid long sentences and repetitions
- Focus on essential demographic information only

Example: {
  "demographics": "Age 25-40, urban professionals...",
  "desires": ["Desire 1", "Desire 2"],
  "pains": ["Pain 1", "Pain 2"]
}`;

        const strategicPrompt = buildStrategicPrompt(sectionPrompt, prompt);
        const systemPrompt = addLanguageInstruction(strategicPrompt, prompt);

        const response = await getAI().models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [{ text: systemPrompt }] },
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        demographics: { type: Type.STRING },
                        desires: { type: Type.ARRAY, items: { type: Type.STRING } },
                        pains: { type: Type.ARRAY, items: { type: Type.STRING } },
                    },
                },
            },
        });

        const tokens = extractTokens(response);
        const jsonString = response.text.trim();
        const defaultResult = { demographics: '', desires: [], pains: [] };
        if (!jsonString) {
            return { result: defaultResult, ...tokens };
        }

        try {
            const parsed = JSON.parse(jsonString);
            const result = {
                demographics: parsed.demographics || '',
                desires: parsed.desires || [],
                pains: parsed.pains || [],
            };
            return { result, ...tokens };
        } catch (e) {
            console.error("Failed to parse persona JSON:", e);
            return { result: defaultResult, ...tokens };
        }
    });
};

export const generateMockupIdeas = async (prompt: string, allData: BrandingData, examples: string[] = []): Promise<{ result: string[]; inputTokens?: number; outputTokens?: number }> => {
    return withRetry(async () => {
        let sectionPrompt = `Based on all the branding information, suggest mockup ideas that would be coherent with this brand segment and showcase its strategic differentiation.

Brand Description: "${prompt}"
Branding Data: ${JSON.stringify(allData, null, 2)}

Suggest specific mockup ideas (e.g., "Product packaging mockup", "Website homepage mockup", "Social media post mockup") that would showcase this brand effectively.

Return a JSON object with a single key "mockups" which is an array of mockup idea descriptions (strings).

Example: {"mockups": ["Mockup idea 1", "Mockup idea 2", "Mockup idea 3"]}`;

        if (examples.length > 0) {
            sectionPrompt += `\n\nHere are examples of high-quality outputs for this task:\n${examples.join('\n\n')}`;
        }

        const strategicPrompt = buildStrategicPrompt(sectionPrompt, prompt);
        const systemPrompt = addLanguageInstruction(strategicPrompt, prompt);

        const response = await getAI().models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [{ text: systemPrompt }] },
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        mockups: {
                            type: Type.ARRAY,
                            items: { type: Type.STRING },
                        },
                    },
                },
            },
        });

        const tokens = extractTokens(response);
        const jsonString = response.text.trim();
        if (!jsonString) return { result: [], ...tokens };

        try {
            const parsed = JSON.parse(jsonString);
            const result = parsed.mockups || [];
            return { result, ...tokens };
        } catch (e) {
            console.error("Failed to parse mockup ideas JSON:", e);
            return { result: [], ...tokens };
        }
    });
};

export const generateMoodboard = async (prompt: string, allData: BrandingData): Promise<{
    result: {
        summary: string;
        visualDirection: string;
        keyElements: string[];
    };
    inputTokens?: number;
    outputTokens?: number;
}> => {
    return withRetry(async () => {
        const sectionPrompt = `Based on all the branding information, create a comprehensive moodboard that synthesizes the brand's visual identity and direction, emphasizing strategic differentiation.

Brand Description: "${prompt}"
Branding Data: ${JSON.stringify(allData, null, 2)}

Create a moodboard summary that includes:
1. A summary paragraph that synthesizes all branding elements into a cohesive visual narrative
2. A visual direction description that explains the overall aesthetic, style, and mood
3. Key visual elements that should be featured in the moodboard (specific design elements, textures, patterns, etc.)

Return a JSON object with three keys:
- "summary": A string with a comprehensive summary of the brand's visual identity (MAXIMUM 150 WORDS)
- "visualDirection": A string describing the visual direction and aesthetic (MAXIMUM 150 WORDS)
- "keyElements": An array of strings describing key visual elements to include

IMPORTANT for summary and visualDirection fields:
- MAXIMUM 150 WORDS each
- Be objective and direct, avoiding unnecessary verbosity
- Use natural, humanized language as if explaining to a colleague
- Avoid long sentences and repetitions
- Focus on essential information only

Example: {
  "summary": "A modern, minimalist brand that combines...",
  "visualDirection": "Clean lines, soft gradients, and organic shapes...",
  "keyElements": ["Geometric patterns", "Natural textures", "Bold typography"]
}`;

        const strategicPrompt = buildStrategicPrompt(sectionPrompt, prompt);
        const systemPrompt = addLanguageInstruction(strategicPrompt, prompt);

        const response = await getAI().models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [{ text: systemPrompt }] },
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        summary: { type: Type.STRING },
                        visualDirection: { type: Type.STRING },
                        keyElements: {
                            type: Type.ARRAY,
                            items: { type: Type.STRING },
                        },
                    },
                },
            },
        });

        const tokens = extractTokens(response);
        const jsonString = response.text.trim();
        const defaultResult = { summary: '', visualDirection: '', keyElements: [] };
        if (!jsonString) {
            return { result: defaultResult, ...tokens };
        }

        try {
            const parsed = JSON.parse(jsonString);
            const result = {
                summary: parsed.summary || '',
                visualDirection: parsed.visualDirection || '',
                keyElements: parsed.keyElements || [],
            };
            return { result, ...tokens };
        } catch (e) {
            console.error("Failed to parse moodboard JSON:", e);
            return { result: defaultResult, ...tokens };
        }
    });
};

/**
 * Create a usage record in the database for branding step generation
 * This function should be called after successful generation to track credit usage
 * 
 * @param userId - The user ID who generated the content
 * @param stepNumber - The branding step number (1-13)
 * @param promptLength - Length of the prompt used for generation
 * @param creditsDeducted - Number of credits deducted (usually 1 for branding steps)
 * @param subscriptionStatus - User's subscription status
 * @param hasActiveSubscription - Whether user has active subscription
 * @param isAdmin - Whether user is admin (admins don't have credits deducted)
 */
export const createBrandingUsageRecord = async (
    userId: string,
    stepNumber: number,
    promptLength: number,
    creditsDeducted: number = 1,
    subscriptionStatus: string = 'free',
    hasActiveSubscription: boolean = false,
    isAdmin: boolean = false,
    inputTokens?: number,
    outputTokens?: number
): Promise<void> => {
    try {
        const { connectToMongoDB, getDb, ObjectId } = await getMongoDB();
        await connectToMongoDB();
        const db = getDb();

        // Import usage tracking utilities
        const { calculateTextGenerationCost } = await import('../../server/utils/usageTracking.js');

        // Use real tokens if available, otherwise estimate
        const actualInputTokens = inputTokens ?? (promptLength ? Math.ceil(promptLength / 4) : 500);
        const actualOutputTokens = outputTokens ?? 1000; // Average response size if not provided
        const cost = calculateTextGenerationCost(actualInputTokens, actualOutputTokens, 'gemini-2.5-flash');

        // Create usage record for billing
        const usageRecord: any = {
            userId,
            type: 'branding',
            feature: 'brandingmachine' as const,
            stepNumber,
            timestamp: new Date(),
            promptLength,
            model: 'gemini-2.5-flash',
            cost,
            creditsDeducted: isAdmin ? 0 : creditsDeducted, // Admins don't have credits deducted
            subscriptionStatus,
            hasActiveSubscription,
            isAdmin, // Track admin status in usage record
            createdAt: new Date(),
        };

        // Add real tokens if available
        if (inputTokens !== undefined) {
            usageRecord.inputTokens = inputTokens;
        }
        if (outputTokens !== undefined) {
            usageRecord.outputTokens = outputTokens;
        }

        await db.collection('usage_records').insertOne(usageRecord);

        if (isAdmin) {
            console.log(`[BrandingService] Recorded branding usage for admin user ${userId} (no credits deducted):`, {
                stepNumber,
                inputTokens: inputTokens ?? 'estimated',
                outputTokens: outputTokens ?? 'estimated',
                timestamp: usageRecord.timestamp,
            });
        } else {
            console.log(`[BrandingService] Recorded branding usage for user ${userId}:`, {
                stepNumber,
                creditsDeducted: creditsDeducted,
                inputTokens: inputTokens ?? 'estimated',
                outputTokens: outputTokens ?? 'estimated',
                timestamp: usageRecord.timestamp,
            });
        }
    } catch (error: any) {
        // Log error but don't throw - usage tracking failure shouldn't break generation
        console.error('[BrandingService] Failed to create usage record:', {
            error: error.message,
            userId,
            stepNumber,
            timestamp: new Date().toISOString(),
        });
    }
};

