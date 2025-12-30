import { GoogleGenAI } from "@google/genai";
import type { StrategyNodeData } from '../types/reactFlow';

// Lazy initialization to avoid breaking app startup if API key is not configured
let ai: GoogleGenAI | null = null;
let currentApiKey: string | null = null;

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

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatContext {
  images?: string[]; // Array of base64 images
  text?: string; // Text context from TextNode
  strategyData?: StrategyNodeData['strategyData']; // Strategy data from StrategyNode
}

// Validation constants
const MAX_MESSAGE_LENGTH = 5000;
const MAX_CONTEXT_TEXT_LENGTH = 10000;
const MAX_CONTEXT_IMAGES = 4;

// Blocked patterns for security
const BLOCKED_PATTERNS = [
  /ignore.*previous/gi,
  /forget.*context/gi,
  /system.*prompt/gi,
  /reveal.*(?:api|key|secret|password)/gi,
];

const IMAGE_GENERATION_PATTERNS = [
  /generate.*image/gi,
  /create.*image/gi,
  /draw.*picture/gi,
  /make.*photo/gi,
];

// Safe system prompt with action detection support
const DEFAULT_SYSTEM_PROMPT = `You are a helpful design assistant specializing in product mockups and brand strategy. You can help users create and manage nodes in their design canvas.

RULES:
- You can ONLY respond with TEXT. Never generate images.
- You can ANALYZE and DESCRIBE images provided as context.
- You can help create and improve prompts for mockup generation.
- You can analyze brand strategy and suggest improvements.
- If asked to generate images, politely explain you can only provide text guidance.
- Always use provided context (images, text, strategy) when answering questions.
- Be helpful, creative, and professional.

CONTEXT AWARENESS:
- If brand strategy is provided, use it to inform your suggestions.
- If images are provided, you can analyze them for design feedback.
- If text context is provided, use it to understand the project better.

NODE SUGGESTIONS:
When suggesting mockups, prompts, or design ideas that the user might want to create as nodes, format them as actionable suggestions using this structure:

**[ACTION:node_type]** Title: Description

Available node types:
- prompt: For text-to-image generation prompts
- mockup: For product mockup presets (cap, tshirt, mug, poster, etc.)
- strategy: For brand strategy analysis
- text: For text notes

Example format:
**[ACTION:prompt]** Coffee Bag Mockup: A premium kraft paper coffee bag with minimalist typography, placed on a rustic wooden table with scattered coffee beans, morning sunlight

**[ACTION:mockup]** T-Shirt Display: Use the "tshirt" preset for a lifestyle product shot

When the user asks for mockup suggestions, creative ideas, or prompts, use this format so they can easily create nodes from your suggestions.`;

// Regex to detect action suggestions in AI responses
export const ACTION_PATTERN = /\*\*\[ACTION:(prompt|mockup|strategy|text)\]\*\*\s*([^:]+):\s*(.+?)(?=\n\*\*\[ACTION:|$)/gs;

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

/**
 * Validate message content
 */
function validateMessage(message: string): void {
  if (!message || message.trim().length === 0) {
    throw new Error('Message cannot be empty');
  }

  if (message.length > MAX_MESSAGE_LENGTH) {
    throw new Error(`Message too long. Maximum ${MAX_MESSAGE_LENGTH} characters allowed.`);
  }

  // Check for blocked patterns
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(message)) {
      throw new Error('Message contains blocked content. Please rephrase.');
    }
  }

  // Check for image generation requests
  for (const pattern of IMAGE_GENERATION_PATTERNS) {
    if (pattern.test(message)) {
      throw new Error('Image generation is not available in chat. Please use image generation nodes for creating images.');
    }
  }
}

/**
 * Validate context
 */
function validateContext(context: ChatContext): void {
  if (context.text && context.text.length > MAX_CONTEXT_TEXT_LENGTH) {
    throw new Error(`Context text too long. Maximum ${MAX_CONTEXT_TEXT_LENGTH} characters allowed.`);
  }

  if (context.images && context.images.length > MAX_CONTEXT_IMAGES) {
    throw new Error(`Too many context images. Maximum ${MAX_CONTEXT_IMAGES} images allowed.`);
  }
}

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
 * @returns AI response text
 */
export async function sendChatMessage(
  messages: ChatMessage[],
  context?: ChatContext,
  apiKey?: string
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

    // Add system prompt as first message if there's context
    if (contextParts.length > 0 || context?.images?.length) {
      contents.unshift({
        role: 'user',
        parts: [{ text: DEFAULT_SYSTEM_PROMPT }],
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

