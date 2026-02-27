import type { GeminiModel, AspectRatio } from './types';

export type BrandingPresetType =
    | 'Luxury'
    | 'Exclusive'
    | 'Tech'
    | 'Modern'
    | 'Eco-friendly'
    | 'Handmade'
    | 'Sport'
    | 'Energetic'
    | 'Fashion'
    | 'Feminine'
    | 'Corporate'
    | 'Professional'
    | 'Creative'
    | 'Playful'
    | 'Vintage'
    | 'Food'
    | 'Travel & Hospitality';

export interface BrandingPreset {
    id: BrandingPresetType | string; // Allow custom IDs from admin
    name: string;
    description: string;
    prompt: string;
    aspectRatio?: AspectRatio;
    model?: GeminiModel;
    tags?: string[]; // Tags for filtering
}

// These constants will serve as the initial seed data for the database
export const BRANDING_PRESETS: BrandingPreset[] = [
    {
        id: 'Luxury',
        name: 'Luxury',
        description: 'High-end, premium aesthetic',
        prompt: 'The brand style is Luxury: sophisticated, high-end, and premium. Use elegant materials like marble, gold accents, and rich textures. Lighting should be dramatic and polished.'
    },
    {
        id: 'Exclusive',
        name: 'Exclusive',
        description: 'Limited edition, rare, and high-value',
        prompt: 'The brand style is Exclusive: rare, premium, and elite. Focus on clean lines, high-contrast sophisticated lighting, and an atmosphere of high value and scarcity.'
    },
    {
        id: 'Tech',
        name: 'Tech',
        description: 'Modern technology and innovation',
        prompt: 'The brand style is Tech: modern, innovative, and sleek. Use materials like brushed geometric metal, glass, and cool lighting. The vibe should be futuristic and precise.'
    },
    {
        id: 'Modern',
        name: 'Modern',
        description: 'Contemporary, clean, and current',
        prompt: 'The brand style is Modern: clean, contemporary, and minimal. Focus on simple geometric shapes, neutral backgrounds, and soft, diffusing lighting.'
    },
    {
        id: 'Eco-friendly',
        name: 'Eco-friendly',
        description: 'Natural, sustainable, and organic',
        prompt: 'The brand style is Eco-friendly: natural, organic, and sustainable. Use materials like raw wood, recycled paper, and plant elements. Lighting should be soft and natural.'
    },
    {
        id: 'Handmade',
        name: 'Handmade',
        description: 'Crafted, artisanal, and personal',
        prompt: 'The brand style is Handmade: artisanal, crafty, and authentic. Focus on textures like fabric, ceramics, and warm, inviting lighting settings.'
    },
    {
        id: 'Sport',
        name: 'Sport',
        description: 'Active, dynamic, and energetic',
        prompt: 'The brand style is Sport: active, dynamic, and strong. Use high-contrast lighting, bold angles, and durable textures like rubber or mesh.'
    },
    {
        id: 'Energetic',
        name: 'Energetic',
        description: 'Vibrant, lively, and dynamic',
        prompt: 'The brand style is Energetic: vibrant, lively, and bold. Use bright, saturated colors in the accessories (not the design itself), dynamic angles, and high-key lighting.'
    },
    {
        id: 'Fashion',
        name: 'Fashion',
        description: 'Trendy, stylish, and editorial',
        prompt: 'The brand style is Fashion: editorial, chic, and trendy. Use studio lighting, fabric drapes, and a high-fashion photography aesthetic.'
    },
    {
        id: 'Feminine',
        name: 'Feminine',
        description: 'Soft, elegant, and graceful',
        prompt: 'The brand style is Feminine: soft, elegant, and graceful. Use pastel tones in the environment, soft focus (bokeh), and delicate textures.'
    },
    {
        id: 'Corporate',
        name: 'Corporate',
        description: 'Professional, reliable, and structured',
        prompt: 'The brand style is Corporate: professional, structured, and reliable. Use office-like settings, glass, steel, and clean, flat lighting.'
    },
    {
        id: 'Professional',
        name: 'Professional',
        description: 'Expert, clean, and trustworthy',
        prompt: 'The brand style is Professional: clean, sharp, and trustworthy. Minimal visual clutter, sharp focus, and neutral business-appropriate backgrounds.'
    },
    {
        id: 'Creative',
        name: 'Creative',
        description: 'Artistic, expressive, and unique',
        prompt: 'The brand style is Creative: artistic, colorful, and expressive. Use unusual angles, artistic props, and playful, colorful lighting.'
    },
    {
        id: 'Playful',
        name: 'Playful',
        description: 'Fun, whimsical, and lighthearted',
        prompt: 'The brand style is Playful: fun, whimsical, and lighthearted. Use bright colors, rounded shapes in props, and bright, happy lighting.'
    },
    {
        id: 'Vintage',
        name: 'Vintage',
        description: 'Retro, nostalgic, and classic',
        prompt: 'The brand style is Vintage: retro, nostalgic, and classic. Use grain, warm tones, antique wood or paper textures, and possibly a slightly desaturated color grade.'
    },
    {
        id: 'Food',
        name: 'Food',
        description: 'Appetizing, fresh, and culinary',
        prompt: 'The brand style is Food: appetizing, fresh, and culinary. Use kitchen or dining settings, natural daylight, and props like ingredients or cutlery.'
    },
    {
        id: 'Travel & Hospitality',
        name: 'Travel & Hospitality',
        description: 'Welcoming, adventurous, and scenic',
        prompt: 'The brand style is Travel & Hospitality: welcoming, scenic, and adventurous. Use outdoor settings, hotel lobbies, or nature backgrounds with warm, inviting light.'
    }
];
