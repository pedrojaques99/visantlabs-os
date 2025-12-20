import type { GeminiModel, AspectRatio } from '../types';

export type MockupPresetType = 'cap' | 'sp' | 'device' | 'tshirt' | 'business-card' | 'mug' | 'bag' | 'social-post' | 'poster' | 'letterhead' | 'notebook' | 'runner-squeeze' | 'magazine-spread' | 'storefront-window' | 'macbook-on-black-background';

export interface MockupPreset {
  id: MockupPresetType | string; // Allow custom IDs from admin
  name: string;
  description: string;
  prompt: string;
  referenceImageUrl: string; // URL no R2
  aspectRatio: AspectRatio;
  model?: GeminiModel; // Model padrão (opcional)
  tags?: string[]; // Tags for filtering
}

export const MOCKUP_PRESETS: MockupPreset[] = [
  {
    id: 'cap',
    name: 'Cap - Embroidered Logo',
    description: 'Logo bordado em boné',
    prompt: 'Product mockup: design embroidered on premium cap, centered with premium thread stitching. Neutral background, lighting highlights embroidery details. Realistic fabric texture and depth.',
    referenceImageUrl: '', // Será preenchido quando a imagem for enviada ao R2
    aspectRatio: '16:9',
    model: 'gemini-2.5-flash-image',
  },
  {
    id: 'sp',
    name: 'SP Billboard',
    description: 'Billboard 9:3 em São Paulo, dia ensolarado, prédios',
    prompt: 'Outdoor billboard mockup in São Paulo, Brazil. 9:3 aspect ratio, design displayed prominently. Sunny day, clear blue skies, modern buildings and São Paulo urban architecture. Realistic lighting, shadows, perspective. Integrated into cityscape with proper scale and depth.',
    referenceImageUrl: '', // Será preenchido quando a imagem for enviada ao R2
    aspectRatio: '16:9',
    model: 'gemini-3-pro-image-preview',
  },
  {
    id: 'device',
    name: 'iPhone 17 Pro Wallpaper',
    description: 'Logo como wallpaper em iPhone 17 Pro, cenário minimal studio',
    prompt: 'Minimalist studio mockup: iPhone 17 Pro displaying design as wallpaper. Minimal background, soft lighting. Design centered and scaled for screen. Realistic screen reflections, premium device details.',
    referenceImageUrl: '', // Será preenchido quando a imagem for enviada ao R2
    aspectRatio: '16:9',    
    model: 'gemini-2.5-flash-image',
  },
  {
    id: 'tshirt',
    name: 'T-shirt - Printed Logo',
    description: 'Logo estampado em camiseta premium, fundo neutro',
    prompt: 'Product mockup: design printed on premium t-shirt, positioned with vibrant colors. Neutral background, lighting highlights print quality and fabric texture. Realistic fabric folds and depth, laid flat or on mannequin.',
    referenceImageUrl: '', // Será preenchido quando a imagem for enviada ao R2
    aspectRatio: '16:9',
    model: 'gemini-2.5-flash-image',
  },
  {
    id: 'business-card',
    name: 'Business Card',
    description: 'Cartão de visita profissional, layout limpo',
    prompt: 'Business card mockup: clean modern layout, design displayed prominently with professional typography. Minimal background, soft lighting, subtle shadows for depth. Realistic paper texture, premium finish.',
    referenceImageUrl: '', // Será preenchido quando a imagem for enviada ao R2
    aspectRatio: '16:9',
    model: 'gemini-2.5-flash-image',
  },
  {
    id: 'mug',
    name: 'Mug - Logo Print',
    description: 'Caneca com logo, cenário minimalista',
    prompt: 'Minimalist studio mockup: premium ceramic mug with design printed. Minimal background, soft lighting. Design positioned and clearly visible. Realistic ceramic texture, subtle reflections, depth.',
    referenceImageUrl: '', // Será preenchido quando a imagem for enviada ao R2
    aspectRatio: '16:9',
    model: 'gemini-2.5-flash-image',
  },
  {
    id: 'bag',
    name: 'Tote Bag - Logo Print',
    description: 'Sacola ecológica com logo estampado',
    prompt: 'Product mockup: eco-friendly tote bag with design printed. Neutral background, lighting highlights design. Realistic fabric texture, natural folds, depth. High-quality sustainable appearance.',
    referenceImageUrl: '', // Será preenchido quando a imagem for enviada ao R2
    aspectRatio: '16:9',
    model: 'gemini-2.5-flash-image',
  },
  {
    id: 'social-post',
    name: 'Social Media Post',
    description: 'Post para Instagram, formato 1:1, fundo moderno',
    prompt: 'Instagram social media post mockup, 1:1 square format. Design displayed prominently with contemporary layout. Modern background, optimized for social media with good contrast and readability. Realistic screen or digital display effects.',
    referenceImageUrl: '', // Será preenchido quando a imagem for enviada ao R2
    aspectRatio: '16:9',
    model: 'gemini-2.5-flash-image',
  },
  {
    id: 'poster',
    name: 'Poster - Vertical',
    description: 'Pôster publicitário, formato vertical',
    prompt: 'Vertical poster mockup: design displayed prominently, modern eye-catching layout for advertising. Displayed on wall or clean environment, realistic lighting and shadows. Proper scale and perspective, design clearly visible and integrated.',
    referenceImageUrl: '', // Será preenchido quando a imagem for enviada ao R2
    aspectRatio: '16:9',
    model: 'gemini-2.5-flash-image',
  },
  {
    id: 'letterhead',
    name: 'Letterhead - Stationery',
    description: 'Papel timbrado profissional',
    prompt: 'Letterhead mockup: design prominently displayed at top, clean elegant layout for business correspondence. Minimal background, realistic paper texture, subtle shadows. Well-balanced composition, design integrated seamlessly.',
    referenceImageUrl: '', // Será preenchido quando a imagem for enviada ao R2
    aspectRatio: '16:9',
    model: 'gemini-2.5-flash-image',
  },
  {
    id: 'notebook',
    name: 'Notebook - Cover Logo',
    description: 'Caderno com logo na capa',
    prompt: 'Notebook mockup: design on cover, positioned and clearly visible. Minimal background, soft lighting. Realistic cover texture, subtle shadows, depth. Premium appearance, suitable for professional or personal use.',
    referenceImageUrl: '', // Será preenchido quando a imagem for enviada ao R2
    aspectRatio: '16:9',
    model: 'gemini-2.5-flash-image',
  },
    {
    id: 'runner-squeeze',
    name: 'Runner with Squeeze Bottle',
    description: 'Corredor bebendo água de squeeze com design aplicado, motion blur, ângulo diagonal',
    prompt: 'Product mockup: Action shot of athletic runner in motion, mid-action drinking from squeeze bottle with your design. Runner displays a focused, determined expression, executing a running stride with one hand holding the bottle to their mouth, body angled forward. Squeeze bottle features your design fully visible, high-quality print/emboss with realistic premium material and visible texture. Outdoor running environment (urban park or trail), dynamic background with strong motion blur to emphasize speed and movement, but runner and bottle sharp. Natural daylight, dynamic lighting and highlights on bottle and runner, high contrast between sharp subject and blurred background, natural shadows. Style is action sports photography, lifestyle, with realistic fabric and bottle textures, diagonal composition at low-to-medium angle. Medium-full crop, high resolution, sharp detail on subject and product. Reference design on bottle must match exactly.',
    referenceImageUrl: '', // Será preenchido quando a imagem for enviada ao R2
    aspectRatio: '16:9',
    model: 'gemini-2.5-flash-image',
  },
  {
    id: 'magazine-spread',
    name: 'Magazine Editorial Spread',
    description: 'Design aplicado em página dupla de revista editorial premium',
    prompt: 'Product mockup: Premium magazine double-page editorial spread featuring your design. Design is integrated into a professional, modern editorial layout with realistic typography and high-end print feel. Full double-page spread is visible, including paper texture, glossy or matte finish, typography, and binding details. The setting is a clean magazine background, white or colored page as appropriate for the design, in a realistic professional publication context. Lighting is soft studio with even illumination and subtle shadows/highlights from page depth and possible glossy finish. Style is modern editorial, authentic publication, with sharp typography and design details. Angle is slight perspective or flat lay, showing page depth, not distorted. High resolution, sharp, visually striking and authentic magazine feel. Reference design preserved exactly, no layout or text errors.',
    referenceImageUrl: '', // Será preenchido quando a imagem for enviada ao R2
    aspectRatio: '16:9',
    model: 'gemini-2.5-flash-image',
  },
  {
    id: 'storefront-window',
    name: 'Storefront Window Display',
    description: 'Design aplicado em vitrine de loja urbana, ambiente comercial realista',
    prompt: 'Product mockup: Urban storefront window display with your design applied and visible through glass, integrated into a realistic retail environment. Window display is viewed from a street-level perspective, design is clearly visible and professionally presented behind glass. Glass texture and realistic reflections are present, with design unobstructed and fully legible, not distorted or blurred. In the setting, an urban street scene is visible (pedestrians, city elements, shop exterior), with sunlight and interior lighting blending for a natural effect. Style is authentic urban retail photography, with texture detail on glass, window frames, and street surfaces. Composition is full storefront view, showing window, display, and some building architecture, slightly angled or straight pedestrian viewpoint. High resolution, sharp, commercial atmosphere. Reference design must match exactly within the display.',
    referenceImageUrl: '', // Será preenchido quando a imagem for enviada ao R2
    aspectRatio: '16:9',
    model: 'gemini-2.5-flash-image',
  },
  {
    id: 'macbook-on-black-background',
    name: 'MacBook on Black Background',
    description: 'MacBook com design aplicado em fundo preto',
    prompt: 'A high-angle shot captures a silver laptop, its screen a blank white, set against a stark black background. The device is positioned slightly angled, with the keyboard facing the viewer. The overall aesthetic is minimalist, sleek, and modern, with strong contrast between the light laptop and the dark background. The lighting is even, highlighting the laptop\'s metallic finish without harsh shadows.',
    referenceImageUrl: 'https://pub-0acbd500af3b4beaa8b93b07f6490d58.r2.dev/canvas/691e123b304058681621b711/693326b32885b62c1c30471f/node-image-1764976482248-7-1764975944966.png',
    aspectRatio: '16:9',
    model: 'gemini-2.5-flash-image',
  },
];