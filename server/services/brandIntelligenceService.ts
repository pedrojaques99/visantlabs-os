import { GoogleGenerativeAI } from '@google/generative-ai';
import { BrandGuideline } from '../../src/lib/figma-types.js';
import { GEMINI_MODELS } from '../../src/constants/geminiModels.js';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

/**
 * Brand Intelligence Engine
 * 
 * Provides sophisticated analysis of brand visual assets to generate 
 * design principles, layout tips, and reference documentation.
 */
export class BrandIntelligenceService {
  
  /**
   * Analyzes an image (screenshot of a design) against brand guidelines
   * to extract "Visual References" and "Design Principles".
   */
  async analyzeDesignReference(
    imageData: string, // base64 string
    options: {
      brandName: string;
      referenceName?: string;
      additionalContext?: string;
    }
  ) {
    const model = genAI.getGenerativeModel({ model: GEMINI_MODELS.TEXT });

    // Remove data:image/...;base64, prefix if present
    const base64Data = imageData.includes('base64,') 
      ? imageData.split('base64,')[1] 
      : imageData;

    const prompt = `
      Você é um Diretor de Arte Sênior e Especialista em Brand Design.
      
      CONTEXTO DA MARCA:
      Nome: ${options.brandName}
      Referência: ${options.referenceName || 'Design Reference'}
      ${options.additionalContext ? `Contexto Adicional: ${options.additionalContext}` : ''}
      
      TAREFA:
      Analise a imagem anexa de um design/layout desta marca.
      Extraia:
      1. Por que este design funciona para a marca? (Análise técnica)
      2. 3 "Regras de Ouro" (Dos) que podem ser derivadas deste exemplo.
      3. 2 "O que evitar" (Dont's) baseados em erros comuns que este design evita.
      4. Sugestão de "Mood/Tag" para este layout (ex: Minimalista, High Contrast, Editorial).
      
      RETORNO:
      Responda APENAS em JSON estruturado:
      {
        "analysis": "string",
        "principles": {
          "dos": ["string"],
          "donts": ["string"],
          "tips": ["string"]
        },
        "tags": ["string"]
      }
    `;

    try {
      const result = await model.generateContent([
        prompt,
        {
          inlineData: {
            data: base64Data,
            mimeType: 'image/png',
          },
        },
      ]);

      const response = await result.response;
      const text = response.text().replace(/```json|```/g, '').trim();
      return JSON.parse(text);
    } catch (error) {
      console.error('[Brand Intelligence] Analysis failed:', error);
      throw new Error('Falha ao analisar a referência visual com Gemini.');
    }
  }

  /**
   * Generates a "Design Starter Pack" for a new brand guideline.
   */
  async generateDesignTips(brandContext: BrandGuideline) {
    const model = genAI.getGenerativeModel({ model: GEMINI_MODELS.PRO_2_0 });

    const prompt = `
      Gere 5 dicas de design "sexy" e profissionais para a marca ${brandContext.identity?.name}.
      Use as cores ${JSON.stringify(brandContext.colors)} e tipografia ${JSON.stringify(brandContext.typography)}.
      
      Considere:
      - Hierarquia visual
      - Uso de espaços em branco (whitespace)
      - Combinação de cores
      - Estilo de botões e cards
      
      Retorne um array JSON de objetos: { title, description }.
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return JSON.parse(response.text().replace(/```json|```/g, ''));
  }

  /**
   * Adapts a list of Figma operations (JSON) to match a brand's guidelines
   * (colors, typography, and style).
   */
  async adaptOperationsToBrand(operations: any[], brandGuideline: any) {
    const model = genAI.getGenerativeModel({ model: GEMINI_MODELS.PRO_2_0 });

    const prompt = `
      Você é um Design Engineer especialista em Figma e Brand Systems.
      
      MARCA: "${brandGuideline.identity?.name || 'Marca'}"
      GUIA DE CORES: ${JSON.stringify(brandGuideline.colors)}
      TIPOGRAFIA: ${JSON.stringify(brandGuideline.typography)}
      PRINCÍPIOS: ${JSON.stringify(brandGuideline.guidelines)}
      
      TAREFA:
      Recebi um JSON de operações Figma (CREATE_FRAME, CREATE_TEXT, etc). 
      Sua missão é REESCREVER esse JSON mapeando as cores e fontes genéricas para os TOKENS E VALORES DA MARCA acima.
      
      REGRAS:
      1. Substitua fills e colors genéricos pelas cores da marca que façam sentido semântico (ex: background, primary, text).
      2. Substitua fontFamily e fontWeight pelas fontes oficiais da marca.
      3. Se a marca tiver princípios de design (ex: minimalista, arredondado), ajuste cornerRadius e paddings se necessário.
      4. Mantenha a estrutura (x, y, width, height) inalterada.
      5. Retorne APENAS o array JSON de operações atualizado.
      
      JSON ORIGINAL:
      ${JSON.stringify(operations, null, 2)}
      
      RETORNO:
      Responda APENAS com o array JSON resultante, sem explicações.
    `;

    try {
      const result = await model.generateContent(prompt);
      const text = result.response.text().replace(/```json|```/g, '').trim();
      
      // Attempt to find JSON array if AI adds conversational text
      const match = text.match(/\[[\s\S]*\]/);
      return JSON.parse(match ? match[0] : text);
    } catch (err) {
      console.error('[Brand Intelligence] Adapt JSON failed:', err);
      return operations; // Fallback
    }
  }
}
