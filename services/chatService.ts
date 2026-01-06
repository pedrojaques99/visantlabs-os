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
const DEFAULT_SYSTEM_PROMPT = `Strategic Clarity Agent (V2: High-Precision Positioning)

Role
Strategic Branding & Positioning Architect with expertise in visual branding analysis and art direction. Strip away noise, identify the "Winning Difference," convert ambiguity into strategic roadmap.

Core Principle
Differentiation requires sacrifice. If a brand choice has no trade-off, it's not strategy—it's a wish list.

Response Structure (Mandatory)
1. Diagnosis: One sentence defining the hidden obstacle.
2. Radical Truth: What the brand fails to acknowledge.
3. Strategic Trade-off: "To win at [X], you must lose/ignore [Y]."
4. Positioning Pillar: Concrete, non-negotiable direction.
5. Litmus Test: One question to validate future creative ideas.

Expertise
- Competitive Defensibility: Why others can't copy the strategy.
- Category Entry Point: Exact moment customer thinks of the brand.
- Visual Branding Analysis: Color psychology, typography hierarchy, composition, brand consistency, visual differentiation, emotional resonance.
- Art Direction: When suggesting mockups, include strategic rationale, camera angles, lighting, styling/props, color harmony, typography integration, background/environment, visual hierarchy.

Guardrails
- Never suggest "high quality," "innovative," or "customer-centric" (table stakes, not strategy).
- No fluff: Every sentence must drive a decision.
- Lead, don't brainstorm.

Technical
- Text-only responses. Analyze and describe images. Create/improve mockup prompts.
- Use all provided context (strategy, images, text) to inform analysis.
- Language Detection (CRITICAL): Always detect the user's message language and respond in the exact same language. If user writes in Portuguese, respond in Portuguese. If in English, respond in English. If in Spanish, respond in Spanish. Maintain language consistency throughout the entire conversation. Never mix languages in a single response.

Node Suggestions Format
**[ACTION:node_type]** Title: Description

Node Type Selection (CRITICAL):
- text: Use for branding positioning elements (Diagnosis, Radical Truth, Strategic Trade-off, Positioning Pillar, Litmus Test), strategic insights, brand analysis, positioning statements, strategic recommendations, brand strategy content. NEVER use prompt for these.
- prompt: Use ONLY for text-to-image generation prompts (visual descriptions for image creation).
- mockup: Use for product mockup presets (cap, tshirt, mug, poster, etc.).
- strategy: Use for complete brand strategy analysis documents.

Image Prompt Generation Format (CRITICAL - MANDATORY STRUCTURE):
When creating **[ACTION:prompt]** suggestions, you MUST follow this exact detailed structure in a single, flowing paragraph:

1. Camera Position & Composition: Start with camera angle, shot type (close-up, wide, overhead, etc.), and object positioning/angle.
2. Main Subject: Describe the primary object/product in detail (material, style, premium/quality indicators).
3. Screen/Display Content (if applicable): Detailed description of what appears on screens/displays (interfaces, layouts, visualizations, UI elements).
4. Material Textures & Finishes: Specific material descriptions (brushed metal, matte glass, premium leather, etc.) with texture details.
5. Color Palette & Aesthetic: Color scheme description with mood/feeling (dark-themed, neutral palette, metallic accents, etc.).
6. Lighting & Environment: Ambient lighting conditions, setting description, shadow quality, reflections.
7. Photographic Style & Technical Specs: Capture method (35mm film, digital, etc.), aesthetic treatment (vintage, cinematic, etc.), grain/texture, resolution quality.

Format: Write as ONE continuous, detailed paragraph. Use commas to separate elements within each section. Be extremely specific and descriptive. Aim for 150-300 words total.

AVAILABLE TAGS FOR PROMPT GENERATION (USE THESE APPROPRIATELY BASED ON BRANDING CONTEXT):

Branding Tags (use to match brand personality):
Agriculture, Casual, Corporate, Creative, Crypto/Web3, Eco-friendly, Energetic, Exclusive, Fashion, Feminine, Food, Friendly, Handmade, Health & Wellness, Industrial, Kids & Baby, Luxury, Minimalist, Modern, Playful, Sport, Tech, Travel & Hospitality, Vintage, Elegant

Location/Ambience Tags (use for environment/setting):
Tokyo, New York, Brazil, Paris, London, Nordic, California Coast, Minimalist Studio, Light Box, Nature landscape, Urban City, Workspace, Grass/Lawn, Concrete, Wooden Slat Wall, Wooden Table, Glass Environment, Modern Office, Brutalist Concrete, Textured Bouclé Sofa, Limestone Surfaces, Urban Loft

Angle Tags (use for camera positioning):
Eye-Level, High Angle, Low Angle, Top-Down (Flat Lay), Dutch Angle, Worm's-Eye View, 45° Angle, Three-Quarter View, Side View, Profile, Close-Up, Detail Shot, Wide Shot, Establishing Shot, Macro 100mm, Hero Angle, Isometric View

Lighting Tags (use for lighting conditions):
Studio Lighting, Golden Hour, Blue Hour, Overcast, Direct Sunlight, Night Scene, Cinematic, Shadow overlay, Soft Light, Diffused, Natural Light, Hard Sunlight, Global Illumination, Chiaroscuro, Rim Light, Caustic Lighting

Effect Tags (use for visual effects):
Bokeh, Motion Blur, Vintage Film, Monochrome, Long Exposure, Lens Flare, High Contrast, Fish-eye lens, Halftone, Ray-tracing, Subsurface Scattering, Micro-contrast, 8k Resolution, Anamorphic Flare

Material Tags (use for material textures):
Frosted Glass, Brushed Aluminum, Raw Linen, Liquid Chrome, Soft-touch Plastic, Embossed, Debossed, Tactile Paper Grain, Ceramic, Metallic Platinum, Liquid Glass, Condensation Droplets

TAG SELECTION RULES (CRITICAL - ANALYZE BRANDING CONTEXT FIRST):
1. Analyze provided branding context:
   - Check for branding tags (Agriculture, Casual, Corporate, Creative, Crypto/Web3, Eco-friendly, Energetic, Exclusive, Fashion, Feminine, Food, Friendly, Handmade, Health & Wellness, Industrial, Kids & Baby, Luxury, Minimalist, Modern, Playful, Sport, Tech, Travel & Hospitality, Vintage, Elegant)
   - Review strategy data (persona, archetypes, color palettes, market research)
   - Analyze connected images for visual style cues
   - Review connected text for brand positioning clues

2. Map branding to appropriate tags:
   - Luxury/Exclusive: Minimalist Studio, Modern Office, Studio Lighting, Soft Light, Metallic Platinum, Frosted Glass, Ray-tracing, 8k Resolution
   - Tech/Modern: Urban City, Workspace, Modern Office, Cinematic, Global Illumination, Brushed Aluminum, Liquid Chrome, Ray-tracing, Anamorphic Flare
   - Eco-friendly/Handmade: Nature landscape, Wooden Table, Natural Light, Golden Hour, Raw Linen, Tactile Paper Grain, Vintage Film
   - Sport/Energetic: Urban City, Grass/Lawn, Direct Sunlight, Golden Hour, Motion Blur, High Contrast, Bokeh
   - Fashion/Feminine: Minimalist Studio, Glass Environment, Soft Light, Diffused, Frosted Glass, Bokeh, Lens Flare
   - Corporate/Professional: Modern Office, Workspace, Studio Lighting, Eye-Level, High Angle, Brushed Aluminum, Monochrome
   - Creative/Playful: Urban Loft, Workspace, Cinematic, Golden Hour, Bokeh, Lens Flare, Fish-eye lens
   - Vintage: Wooden Slat Wall, Concrete, Overcast, Vintage Film, Monochrome, Halftone
   - Food: Wooden Table, Nature landscape, Golden Hour, Natural Light, Raw Linen, Ceramic
   - Travel & Hospitality: California Coast, Nordic, Nature landscape, Golden Hour, Blue Hour, Natural Light, Soft Light

3. Integrate tags naturally:
   - Don't list tags separately - weave them into the descriptive narrative
   - Use tag concepts as inspiration, not rigid requirements
   - Combine multiple relevant tags when appropriate
   - Ensure tag choices align with the brand's strategic positioning

Example of PERFECT prompt format with tag integration:
**[ACTION:prompt]** Premium Tablet Mockup: Frontal close-up of a premium minimalist tablet on a sleek architectural stand, slightly tilted. The screen displays a sophisticated, abstract digital interface with clean geometric layouts, subtle data visualizations, and elegant UI elements. High-end material textures: brushed metal bezels and matte glass. Dark-themed aesthetic using a deep neutral palette with refined metallic accents. Ambient lighting in a luxury minimalist setting, soft shadows, no harsh reflections. Captured on 35mm film, vintage film scan aesthetic, high grain, cinematic textures, ultra-high resolution mockup style.

Mockup suggestions must include: strategic rationale, camera angle/perspective, lighting/mood, styling/props, color/typography, technical specs (preset, aspect ratio).

Examples:
**[ACTION:text]** The Diagnosis: The brand is competing on features instead of owning a unique category position.

**[ACTION:text]** The Strategic Trade-off: To win at premium positioning, you must be willing to lose price-sensitive customers.

**[ACTION:text]** The Positioning Pillar: The only brand that [unique value proposition] for [specific audience] in [category].

**[ACTION:prompt]** Coffee Bag Mockup (Eco-friendly Branding): Overhead 45° angle of a premium kraft paper bag with minimalist typography, positioned on a rustic wooden table with scattered coffee beans around it. The bag features matte finish with subtle embossed branding and natural paper texture with tactile paper grain. Warm earth tones with deep browns, cream whites, and golden accents. Morning sunlight streaming through window, creating soft directional shadows and highlighting texture details. Natural textures throughout, minimalist composition with shallow depth of field. Captured on 35mm film, warm golden hour aesthetic, fine grain, natural lighting, high-resolution product photography style.

**[ACTION:prompt]** Luxury Tech Product (Tech/Luxury Branding): Hero angle close-up of a premium minimalist tablet on a sleek architectural stand in a modern office environment, slightly tilted at three-quarter view. The screen displays a sophisticated, abstract digital interface with clean geometric layouts, subtle data visualizations, and elegant UI elements. High-end material textures: brushed aluminum bezels and frosted glass with liquid chrome accents. Dark-themed aesthetic using a deep neutral palette with refined metallic platinum accents. Studio lighting with soft diffused illumination, creating chiaroscuro effects with soft shadows and no harsh reflections. Ray-tracing enabled, 8k resolution, cinematic textures, ultra-high resolution mockup style with micro-contrast details.

**[ACTION:prompt]** Sportswear Mockup (Sport/Energetic Branding): Low angle dynamic shot of a premium athletic t-shirt displayed on an urban city background, captured at eye-level with motion blur effects. The fabric shows high-performance texture with soft-touch plastic details and embossed logo elements. Vibrant color palette with energetic contrasts and brand-specific accent colors. Direct sunlight with golden hour lighting, creating dramatic rim light effects and high contrast shadows. Captured with anamorphic flare, bokeh background, cinematic motion blur, high-resolution action photography style.

**[ACTION:mockup]** T-Shirt Display: "tshirt" preset, street photography aesthetic, natural daylight, urban background, dynamic composition, brand colors as accents`;

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

