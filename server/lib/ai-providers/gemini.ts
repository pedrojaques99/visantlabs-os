// Gemini provider for fast execution and simple tasks
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { FigmaOperation } from '../../../src/lib/figma-types';
import type { AIProvider, AIGenerationOptions } from './types';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

const geminiProvider: AIProvider = {
  name: 'gemini',

  async generateOperations(
    systemPrompt: string,
    userPrompt: string,
    options?: AIGenerationOptions
  ): Promise<FigmaOperation[]> {
    try {
      const model = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: options?.temperature ?? 0.2,
        },
        systemInstruction: systemPrompt,
      });

      const result = await model.generateContent(userPrompt);
      const responseText = result.response.text();

      // Parse JSON response
      let operations: any[] = [];
      try {
        const parsed = JSON.parse(responseText);
        if (Array.isArray(parsed)) {
          operations = parsed;
        } else if (parsed.operations && Array.isArray(parsed.operations)) {
          operations = parsed.operations;
        }
      } catch (parseError) {
        console.error('[Gemini] Parse error:', parseError);
        // Try regex fallback
        const jsonMatch = responseText.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          try {
            operations = JSON.parse(jsonMatch[0]);
          } catch (_e) {
            operations = [];
          }
        }
      }

      return Array.isArray(operations) ? operations : [];
    } catch (error) {
      console.error('[Gemini Provider] Error:', error);
      throw error;
    }
  },
};

export default geminiProvider;
