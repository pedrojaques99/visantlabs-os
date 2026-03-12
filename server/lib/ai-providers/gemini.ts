// Gemini provider for fast execution and simple tasks
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { FigmaOperation } from '../../../src/lib/figma-types.js';
import type { AIProvider, AIGenerationOptions, AIGenerationResult } from './types.js';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

const geminiProvider: AIProvider = {
  name: 'gemini',

  async generateOperations(
    systemPrompt: string,
    userPrompt: string,
    options?: AIGenerationOptions
  ): Promise<AIGenerationResult> {
    try {
      const model = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: options?.temperature ?? 0.2,
        },
        systemInstruction: systemPrompt,
      });

      // Build multimodal content
      const parts: any[] = [{ text: userPrompt }];

      if (options?.attachments && options.attachments.length > 0) {
        for (const att of options.attachments) {
          if (att.mimeType.startsWith('image/')) {
            parts.push({
              inlineData: {
                mimeType: att.mimeType,
                data: att.data,
              },
            });
          } else if (att.mimeType === 'application/pdf') {
            parts.push({
              inlineData: {
                mimeType: 'application/pdf',
                data: att.data,
              },
            });
          } else if (att.mimeType === 'text/csv') {
            // For CSV, include as text
            try {
              const csvContent = Buffer.from(att.data, 'base64').toString('utf-8');
              parts.push({
                text: `\n\n📊 Arquivo CSV: ${att.name}\n\`\`\`csv\n${csvContent}\n\`\`\``,
              });
            } catch (_e) {
              console.warn(`[Gemini] Failed to decode CSV ${att.name}`);
            }
          }
        }
      }

      const result = await model.generateContent(parts as any);
      const responseText = result.response.text();

      // Extract token usage from Gemini response
      const meta = result.response.usageMetadata;
      const usage = meta ? {
        inputTokens: meta.promptTokenCount ?? 0,
        outputTokens: meta.candidatesTokenCount ?? 0,
        totalTokens: meta.totalTokenCount ?? 0,
      } : undefined;

      // Parse JSON response
      let operations: any[] = [];
      const cleanResponse = (text: string) => {
        return text
          .replace(/```json\n?/g, '')
          .replace(/```\n?/g, '')
          .trim();
      };

      try {
        const sanitized = cleanResponse(responseText);
        const parsed = JSON.parse(sanitized);
        if (Array.isArray(parsed)) {
          operations = parsed;
        } else if (parsed.operations && Array.isArray(parsed.operations)) {
          operations = parsed.operations;
        }
      } catch (parseError) {
        console.warn('[Gemini] Standard JSON.parse failed, trying regex extraction...');
        
        // Try regex fallback - find the first [ and the last ]
        const startBracket = responseText.indexOf('[');
        const endBracket = responseText.lastIndexOf(']');
        
        if (startBracket !== -1 && endBracket !== -1 && endBracket > startBracket) {
          const jsonArrayPart = responseText.substring(startBracket, endBracket + 1);
          try {
            operations = JSON.parse(jsonArrayPart);
          } catch (regexError) {
            console.error('[Gemini] Regex extraction parse error:', regexError);
            console.log('[Gemini] Raw response that failed:', responseText);
            operations = [];
          }
        } else {
          console.error('[Gemini] Could not find JSON array in response');
          console.log('[Gemini] Raw response that failed:', responseText);
          operations = [];
        }
      }

      return { operations: Array.isArray(operations) ? operations : [], usage };
    } catch (error) {
      console.error('[Gemini Provider] Error:', error);
      throw error;
    }
  },
};

export default geminiProvider;
