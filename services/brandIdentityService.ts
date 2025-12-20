import { GoogleGenAI, Type } from "@google/genai";
import type { BrandIdentity } from '../types/reactFlow';
import type { UploadedImage } from '../types';

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
 * Extract brand identity from logo image and PDF/PNG document using Gemini
 * @param logoImage - Logo image as UploadedImage
 * @param identityBase64 - PDF or PNG document as base64 string
 * @param identityType - Type of identity file ('pdf' or 'png')
 * @param strategyText - Optional strategic context data to enhance analysis
 * @returns Extracted BrandIdentity
 */
export const extractBrandIdentity = async (
  logoImage: UploadedImage,
  identityBase64: string,
  identityType: 'pdf' | 'png' = 'pdf',
  strategyText?: string
): Promise<BrandIdentity> => {
  const identityTypeName = identityType === 'pdf' ? 'PDF document' : 'PNG/image document';
  
  let prompt = `You are an expert brand identity analyst. Your task is to analyze a logo image and a brand identity guide ${identityTypeName}, then extract comprehensive brand information in a structured format.

**LOGO ANALYSIS:**
Analyze the logo image and extract:
- Primary colors (hex codes)
- Style characteristics (minimalist, complex, geometric, organic, modern, classic, etc.)
- Visual elements (symbols, typography, shapes, patterns)

**IDENTITY GUIDE ANALYSIS:**
Analyze the brand identity guide ${identityTypeName} and extract:
- Color palette: Primary colors, secondary colors, accent colors (all as hex codes)
- Typography: Primary font family, secondary font (if any), font weights used
- Composition style: Grid system, alignment preferences, spacing patterns
- Brand personality: Tone of voice, emotional feeling, core values
- Visual elements: Patterns, textures, icons, illustrations, graphic styles`;

  // Add strategic context if available
  if (strategyText && strategyText.trim()) {
    prompt += `

**STRATEGIC CONTEXT:**
Use the following strategic information to enhance and contextualize your analysis. Consider how these strategic elements align with or inform the visual identity:
${strategyText}

When analyzing colors, typography, and visual elements, cross-reference with the strategic data to ensure consistency and alignment with the brand strategy.`;
  }

  prompt += `

**OUTPUT FORMAT:**
You must return a JSON object matching this exact structure:
{
  "logo": {
    "colors": ["#HEX1", "#HEX2"],
    "style": "description",
    "elements": ["element1", "element2"]
  },
  "colors": {
    "primary": ["#HEX1", "#HEX2"],
    "secondary": ["#HEX3", "#HEX4"],
    "accent": ["#HEX5"]
  },
  "typography": {
    "primary": "Font Name",
    "secondary": "Font Name or null",
    "weights": ["400", "700", "900"]
  },
  "composition": {
    "style": "description",
    "grid": "description",
    "spacing": "description"
  },
  "personality": {
    "tone": "description",
    "feeling": "description",
    "values": ["value1", "value2", "value3"]
  },
  "visualElements": ["element1", "element2", "element3"]
}

**INSTRUCTIONS:**
1. Be thorough and accurate in your analysis
2. Extract ALL colors as hex codes (e.g., #FF5733)
3. If information is missing from the ${identityTypeName}, infer from the logo where reasonable${strategyText ? ', or use strategic context to inform your analysis' : ''}
4. Return ONLY valid JSON, no markdown, no code blocks, no explanation
5. All arrays should have at least one item if possible
6. Use empty arrays only when absolutely no information is available`;

  const parts: any[] = [];

  // Add logo image
  parts.push({
    inlineData: {
      data: logoImage.base64,
      mimeType: logoImage.mimeType,
    },
  });

  // Add identity document (PDF or PNG/image)
  // Clean base64 (remove data URL prefix if present)
  const cleanBase64 = identityBase64.includes(',') ? identityBase64.split(',')[1] : identityBase64;
  const identityMimeType = identityType === 'pdf' ? 'application/pdf' : 'image/png';
  
  parts.push({
    inlineData: {
      data: cleanBase64,
      mimeType: identityMimeType,
    },
  });

  // Add prompt
  parts.push({ text: prompt });

  const response = await getAI().models.generateContent({
    model: 'gemini-2.5-flash',
    contents: { parts },
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          logo: {
            type: Type.OBJECT,
            properties: {
              colors: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              style: { type: Type.STRING },
              elements: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
            },
          },
          colors: {
            type: Type.OBJECT,
            properties: {
              primary: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              secondary: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              accent: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
            },
          },
          typography: {
            type: Type.OBJECT,
            properties: {
              primary: { type: Type.STRING },
              secondary: { type: Type.STRING, nullable: true },
              weights: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
            },
          },
          composition: {
            type: Type.OBJECT,
            properties: {
              style: { type: Type.STRING },
              grid: { type: Type.STRING },
              spacing: { type: Type.STRING },
            },
          },
          personality: {
            type: Type.OBJECT,
            properties: {
              tone: { type: Type.STRING },
              feeling: { type: Type.STRING },
              values: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
            },
          },
          visualElements: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
        },
      },
    },
  });

  const jsonString = response.text.trim();
  if (!jsonString) {
    throw new Error('Empty response from Gemini');
  }

  try {
    const identity = JSON.parse(jsonString) as BrandIdentity;
    
    // Validate required fields
    if (!identity.logo || !identity.colors || !identity.typography || !identity.composition || !identity.personality || !identity.visualElements) {
      throw new Error('Invalid brand identity structure returned from Gemini');
    }

    // Ensure arrays exist
    identity.logo.colors = identity.logo.colors || [];
    identity.logo.elements = identity.logo.elements || [];
    identity.colors.primary = identity.colors.primary || [];
    identity.colors.secondary = identity.colors.secondary || [];
    identity.colors.accent = identity.colors.accent || [];
    identity.typography.weights = identity.typography.weights || [];
    identity.personality.values = identity.personality.values || [];
    identity.visualElements = identity.visualElements || [];

    return identity;
  } catch (error) {
    console.error('Failed to parse brand identity JSON:', error);
    console.error('Response text:', jsonString);
    throw new Error(`Failed to parse brand identity: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};
