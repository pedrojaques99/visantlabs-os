/**
 * Smart Image Analyzer
 *
 * Detects image type automatically and generates optimized prompts.
 * Single endpoint for all image types - no user input needed.
 */

// All detectable categories
export const IMAGE_CATEGORIES = {
  // UI/Design
  'ui-screenshot': { keywords: ['interface', 'dashboard', 'app', 'website', 'ui', 'ux'], color: 'purple' },
  'figma-design': { keywords: ['figma', 'design system', 'component', 'frame'], color: 'pink' },

  // Mockup types
  'mockup': { keywords: ['product', 'packaging', 'bottle', 'box', 'bag', 'label', 'branding'], color: 'blue' },
  'angle': { keywords: ['perspective', 'angle', 'view', 'rotation', '3d view'], color: 'cyan' },
  'texture': { keywords: ['texture', 'material', 'surface', 'fabric', 'wood', 'metal', 'paper'], color: 'amber' },
  'ambience': { keywords: ['environment', 'scene', 'background', 'setting', 'mood'], color: 'green' },
  'luminance': { keywords: ['lighting', 'shadow', 'highlight', 'contrast', 'bright', 'dark'], color: 'yellow' },

  // Creative
  '3d': { keywords: ['3d render', 'cgi', 'blender', 'cinema4d', 'octane'], color: 'orange' },
  'aesthetics': { keywords: ['aesthetic', 'mood', 'vibe', 'style', 'artistic'], color: 'rose' },
  'themes': { keywords: ['theme', 'color scheme', 'palette', 'seasonal'], color: 'indigo' },
} as const;

export type ImageCategory = keyof typeof IMAGE_CATEGORIES;

export const SMART_ANALYZER_SYSTEM = `Você é um analisador de imagens especialista. Sua tarefa é:

1. IDENTIFICAR o tipo de imagem (responda em JSON)
2. GERAR um prompt otimizado para recriar essa imagem

CATEGORIAS POSSÍVEIS:
- ui-screenshot: Interfaces, dashboards, apps, websites
- figma-design: Componentes de design system, frames Figma
- mockup: Produtos, embalagens, branding aplicado
- texture: Materiais, superfícies, texturas
- ambience: Ambientes, cenários, backgrounds
- luminance: Estudos de iluminação, luz e sombra
- angle: Perspectivas, ângulos de câmera
- 3d: Renders 3D, CGI
- aesthetics: Estilos artísticos, moods visuais
- themes: Paletas de cores, temas sazonais

RESPONDA APENAS EM JSON:
{
  "category": "categoria-detectada",
  "confidence": 0.95,
  "tags": ["tag1", "tag2", "tag3"],
  "prompt": "Prompt otimizado em inglês para recriar esta imagem...",
  "name": "Nome curto descritivo"
}

REGRAS PARA O PROMPT:
- Inglês, máximo 150 palavras
- Específico para o tipo detectado
- Inclua detalhes técnicos relevantes (cores, materiais, iluminação, composição)
- Para UI: descreva layout, componentes, cores
- Para mockups: descreva produto, materiais, ambiente
- Para texturas: descreva material, padrão, escala
- Termine com qualificadores de qualidade (8K, photorealistic, etc)`;

export const SMART_ANALYZER_USER = `Analise esta imagem e retorne JSON com category, confidence, tags, prompt e name.`;

export const WHITE_LABEL_INSTRUCTION = `
IMPORTANTE - MODO WHITE LABEL:
- IGNORE completamente qualquer logo, marca, nome de empresa ou texto de branding na imagem
- NÃO mencione marcas, logos ou nomes de empresas no prompt gerado
- Substitua elementos de marca por descrições genéricas (ex: "logo" → "placeholder logo area", "Brand Name" → "company name text")
- Foque apenas no layout, cores, tipografia e estrutura visual
- Use termos genéricos como "brand colors", "logo placeholder", "company name"
`;

// ============ Figma Plugin Operations Generator ============

export const FIGMA_OPERATIONS_SYSTEM = `Você é um especialista em Figma que analisa screenshots de UI e gera operações JSON para recriar o design no Figma.

OPERAÇÕES DISPONÍVEIS:
- CREATE_FRAME: { type: "CREATE_FRAME", ref: "unique-id", name: string, width: number, height: number, fills: [{type:"SOLID",color:{r,g,b}}], cornerRadius?: number, layoutMode?: "HORIZONTAL"|"VERTICAL", primaryAxisAlignItems?: "MIN"|"CENTER"|"MAX"|"SPACE_BETWEEN", counterAxisAlignItems?: "MIN"|"CENTER"|"MAX", itemSpacing?: number, paddingTop/Right/Bottom/Left?: number, layoutSizingHorizontal?: "FIXED"|"HUG"|"FILL", layoutSizingVertical?: "FIXED"|"HUG"|"FILL", parentRef?: string }
- CREATE_RECTANGLE: { type: "CREATE_RECTANGLE", ref: string, name: string, width: number, height: number, fills: [...], cornerRadius?: number, parentRef?: string }
- CREATE_TEXT: { type: "CREATE_TEXT", ref: string, name: string, characters: string, fontSize: number, fontWeight?: number, fills: [...], textAlignHorizontal?: "LEFT"|"CENTER"|"RIGHT", parentRef?: string }
- CREATE_ELLIPSE: { type: "CREATE_ELLIPSE", ref: string, name: string, width: number, height: number, fills: [...], parentRef?: string }

CORES: Use { r: 0-1, g: 0-1, b: 0-1 } (valores de 0 a 1, não 0-255)

REGRAS:
1. SEMPRE use auto-layout (layoutMode) para containers
2. Use parentRef para aninhar elementos dentro de frames
3. Extraia cores exatas da imagem
4. Use nomes descritivos em inglês
5. Agrupe elementos logicamente
6. Use layoutSizingHorizontal:"FILL" para elementos que devem expandir

RESPONDA APENAS COM JSON:
{
  "name": "Nome do componente",
  "category": "ui-screenshot|chart|card|form|button|other",
  "operations": [
    { "type": "CREATE_FRAME", "ref": "container", ... },
    { "type": "CREATE_TEXT", "ref": "title", "parentRef": "container", ... }
  ],
  "tokens": {
    "colors": [{ "name": "Primary", "hex": "#RRGGBB" }],
    "typography": [{ "name": "Heading", "size": 24, "weight": 700 }]
  }
}`;

export const FIGMA_OPERATIONS_USER = `Analise esta UI e gere as operações JSON para recriá-la no Figma.`;

/**
 * Parse Figma operations response
 */
export function parseFigmaOperationsResponse(text: string): {
  name: string;
  category: string;
  operations: any[];
  tokens: { colors: any[]; typography: any[] };
} | null {
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);

    return {
      name: parsed.name || 'Untitled Component',
      category: parsed.category || 'ui-screenshot',
      operations: Array.isArray(parsed.operations) ? parsed.operations : [],
      tokens: {
        colors: Array.isArray(parsed.tokens?.colors) ? parsed.tokens.colors : [],
        typography: Array.isArray(parsed.tokens?.typography) ? parsed.tokens.typography : [],
      },
    };
  } catch {
    return null;
  }
}

/**
 * Parse the analyzer response
 */
export function parseAnalyzerResponse(text: string): {
  category: ImageCategory;
  confidence: number;
  tags: string[];
  prompt: string;
  name: string;
} | null {
  try {
    // Try to extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);

    // Validate category
    if (!IMAGE_CATEGORIES[parsed.category as ImageCategory]) {
      parsed.category = 'aesthetics'; // Fallback
    }

    return {
      category: parsed.category,
      confidence: parsed.confidence || 0.8,
      tags: Array.isArray(parsed.tags) ? parsed.tags : [],
      prompt: parsed.prompt || '',
      name: parsed.name || 'Untitled',
    };
  } catch {
    return null;
  }
}
