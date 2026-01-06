import { GoogleGenAI } from "@google/genai";
import type { StrategyNodeData } from '../types/reactFlow';
import { validateMessage, validateContext } from './chatValidators';
import { buildSystemPrompt } from './promptTemplates';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatContext {
  images?: string[]; // Array of base64 images
  text?: string; // Text context from TextNode
  strategyData?: StrategyNodeData['strategyData']; // Strategy data from StrategyNode
}

// ============================================================================
// AI Instance Management
// ============================================================================

// Lazy initialization to avoid breaking app startup if API key is not configured
let ai: GoogleGenAI | null = null;
let currentApiKey: string | null = null;

/**
 * Get or create AI instance
 * @param apiKey - Optional API key (user's own key)
 * @returns GoogleGenAI instance
 */
const getAI = (apiKey?: string): GoogleGenAI => {
  // If a specific API key is provided, use it (for user's own API key)
  if (apiKey && apiKey.trim().length > 0) {
    return new GoogleGenAI({ apiKey: apiKey.trim() });
  }

  // Helper to safely get env vars in both Node.js and Vite environments
  const getEnvVar = (key: string): string | undefined => {
    // Try process.env (Node.js/Server)
    if (typeof process !== 'undefined' && process.env && process.env[key]) {
      return process.env[key];
    }
    // Try import.meta.env (Vite/Client)
    try {
      // @ts-ignore - import.meta.env is Vite specific
      if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
        // @ts-ignore
        return import.meta.env[key];
      }
    } catch (e) {
      // Ignore errors accessing import.meta
    }
    return undefined;
  };

  const storedKey = getEnvVar('VITE_GEMINI_API_KEY') || getEnvVar('VITE_API_KEY') || getEnvVar('GEMINI_API_KEY') || '';
  const currentKey = storedKey.trim();

  // Otherwise use cached instance or create from environment
  if (!ai || currentApiKey !== currentKey) {
    if (!currentKey || currentKey === 'undefined' || currentKey.length === 0) {
      throw new Error(
        "GEMINI_API_KEY não encontrada. " +
        "Configure GEMINI_API_KEY no arquivo .env para usar funcionalidades de IA."
      );
    }

    currentApiKey = currentKey;
    ai = new GoogleGenAI({ apiKey: currentKey });
  }
  return ai;
};

// ============================================================================
// Action Detection
// ============================================================================

// Regex to detect action suggestions in AI responses
// Captures: type, title, and full description (including multi-line prompts)
// Uses [\s\S] to match any character including newlines, stops at next ACTION or end of string
export const ACTION_PATTERN = /\*\*\[ACTION:(prompt|mockup|strategy|text)\]\*\*\s*([^:\n]+?):\s*([\s\S]+?)(?=\n\*\*\[ACTION:|$)/g;

export interface DetectedAction {
  type: 'prompt' | 'mockup' | 'strategy' | 'text';
  title: string;
  description: string;
  fullPrompt: string;
}

/**
 * Parse AI response to detect actionable suggestions
 */
export function parseActionsFromResponse(content: string): DetectedAction[] {
  const actions: DetectedAction[] = [];
  const regex = new RegExp(ACTION_PATTERN.source, 'gs');
  let match;
  
  while ((match = regex.exec(content)) !== null) {
    const [, type, title, description] = match;
    actions.push({
      type: type as DetectedAction['type'],
      title: title.trim(),
      description: description.trim(),
      fullPrompt: `${title.trim()}: ${description.trim()}`,
    });
  }
  
  return actions;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Format strategy data as text for context
 */
function formatStrategyData(strategyData?: StrategyNodeData['strategyData']): string {
  if (!strategyData) return '';

  const parts: string[] = [];

  if (strategyData.marketResearch) {
    const mr = strategyData.marketResearch;
    if (typeof mr === 'object') {
      parts.push('Market Research:');
      if (mr.mercadoNicho) parts.push(`Nicho: ${mr.mercadoNicho}`);
      if (mr.publicoAlvo) parts.push(`Público Alvo: ${mr.publicoAlvo}`);
      if (mr.posicionamento) parts.push(`Posicionamento: ${mr.posicionamento}`);
      if (mr.insights) parts.push(`Insights: ${mr.insights}`);
    }
  }

  if (strategyData.persona) {
    const p = strategyData.persona;
    parts.push('\nPersona:');
    if (p.demographics) parts.push(`Demographics: ${p.demographics}`);
    if (p.desires?.length) parts.push(`Desires: ${p.desires.join(', ')}`);
    if (p.pains?.length) parts.push(`Pains: ${p.pains.join(', ')}`);
  }

  if (strategyData.archetypes) {
    const arch = strategyData.archetypes;
    parts.push('\nArchetypes:');
    if (arch.primary) parts.push(`Primary: ${arch.primary.title} - ${arch.primary.description}`);
    if (arch.secondary) parts.push(`Secondary: ${arch.secondary.title} - ${arch.secondary.description}`);
  }

  if (strategyData.colorPalettes?.length) {
    parts.push('\nColor Palettes:');
    strategyData.colorPalettes.forEach(p => {
      parts.push(`${p.name}: ${p.colors.join(', ')} - ${p.psychology}`);
    });
  }

  if (strategyData.mockupIdeas?.length) {
    parts.push('\nMockup Ideas:');
    strategyData.mockupIdeas.forEach((idea, idx) => {
      parts.push(`${idx + 1}. ${idea}`);
    });
  }

  return parts.join('\n');
}

/**
 * Process an image source (URL or base64) into the format required by Gemini
 */
async function processImage(source: string): Promise<{ data: string; mimeType: string }> {
  try {
    // Handle URLs
    if (source.startsWith('http://') || source.startsWith('https://')) {
      const response = await fetch(source);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.statusText}`);
      }
      const blob = await response.blob();

      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64String = reader.result as string;
          // Format is "data:image/png;base64,..."
          const [header, data] = base64String.split(',');
          const mimeType = header.split(':')[1].split(';')[0];
          resolve({
            data: data,
            mimeType: mimeType
          });
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    }

    // Handle existing Base64
    if (source.includes(',')) {
      const [header, data] = source.split(',');
      const mimeType = header.split(':')[1].split(';')[0];
      return { data, mimeType };
    }

    // Handle raw Base64 (assume PNG if no mime type provided, though unlikely in this app's context)
    return {
      data: source,
      mimeType: 'image/png'
    };
  } catch (error) {
    console.error('Error processing image:', error);
    throw new Error('Failed to process image. Please ensure the image URL is accessible and valid.');
  }
}

/**
 * Send chat message to Gemini API
 * 
 * @param messages - Conversation history
 * @param context - Optional context (images, text, strategy)
 * @param apiKey - Optional API key (user's own key)
 * @param systemPrompt - Optional custom system prompt (overrides DEFAULT_SYSTEM_PROMPT)
 * @returns AI response text
 */
export async function sendChatMessage(
  messages: ChatMessage[],
  context?: ChatContext,
  apiKey?: string,
  systemPrompt?: string
): Promise<string> {
  // Validate last message (user message)
  const lastMessage = messages[messages.length - 1];
  if (!lastMessage || lastMessage.role !== 'user') {
    throw new Error('Last message must be from user');
  }

  validateMessage(lastMessage.content);

  if (context) {
    validateContext(context);
  }

  try {
    const aiInstance = getAI(apiKey);

    // Build context prompt
    const contextParts: string[] = [];

    if (context?.strategyData) {
      const strategyText = formatStrategyData(context.strategyData);
      if (strategyText) {
        contextParts.push('Brand Strategy Context:\n' + strategyText);
      }
    }

    if (context?.text) {
      contextParts.push('Text Context:\n' + context.text);
    }

    // Pre-process images if present
    const processedImages: { inlineData: { data: string; mimeType: string } }[] = [];
    if (context?.images && context.images.length > 0) {
      const imagePromises = context.images.map(processImage);
      const results = await Promise.all(imagePromises);
      results.forEach(img => {
        processedImages.push({
          inlineData: {
            data: img.data,
            mimeType: img.mimeType
          }
        });
      });
    }

    // Build contents for Gemini
    const contents = messages.map((msg, index) => {
      const parts: any[] = [];

      // Add images to context only on the last user message
      if (msg.role === 'user' && index === messages.length - 1 && processedImages.length > 0) {
        parts.push(...processedImages);
      }

      // Build text content
      let textContent = msg.content;

      // Add context to the last user message
      if (msg.role === 'user' && index === messages.length - 1 && contextParts.length > 0) {
        textContent = contextParts.join('\n\n') + '\n\nUser Question:\n' + msg.content;
      }

      parts.push({ text: textContent });

      return {
        role: msg.role === 'user' ? 'user' : 'model',
        parts: parts,
      };
    });

    // Add system prompt as first message if there's context or custom system prompt
    // Use custom system prompt if provided, otherwise use default only if there's context
    if (systemPrompt) {
      // Always add custom system prompt
      contents.unshift({
        role: 'user',
        parts: [{ text: systemPrompt }],
      });
    } else if (contextParts.length > 0 || context?.images?.length) {
      // Only add default system prompt if there's context
      // Build prompt with context for better tag selection guidance
      const systemPromptText = buildSystemPrompt(context);
      contents.unshift({
        role: 'user',
        parts: [{ text: systemPromptText }],
      });
    }

    // CRITICAL: Do NOT include responseModalities - we only want text
    const response = await aiInstance.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: contents,
      // No responseModalities = text only
    });

    const textResponse = response.text.trim();

    if (!textResponse) {
      throw new Error('No text response generated');
    }

    // Verify no images were generated (safety check)
    const hasImages = response.candidates?.[0]?.content?.parts?.some(
      part => part.inlineData !== undefined
    );

    if (hasImages) {
      console.warn('[ChatService] Received image data when text-only was expected. Ignoring images.');
    }

    return textResponse;
  } catch (error: any) {
    console.error('[ChatService] Error sending message:', error);

    // Re-throw with user-friendly message
    if (error.message) {
      throw error;
    }

    throw new Error('Failed to send chat message. Please try again.');
  }
}

