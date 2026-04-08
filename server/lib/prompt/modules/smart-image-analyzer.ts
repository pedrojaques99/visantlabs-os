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

export const getFigmaOperationsSystem = (context?: { 
  availableComponents?: any[], 
  brandContext?: string,
  tokens?: any 
}) => {
  const componentsList = context?.availableComponents?.length 
    ? `\nCOMPONENTES DISPONÍVEIS NO PROJETO (USE-OS SEMPRE QUE POSSÍVEL):\n${context.availableComponents.map(c => `- ${c.name} (Key: ${c.key || c.id})`).join('\n')}`
    : '';

  const brandContext = context?.brandContext 
    ? `\nCONTEXTO DE MARCA E TOKENS:\n${context.brandContext}`
    : '';

  return `Você é um especialista em Design Engineering no Figma. Sua tarefa é analisar screenshots de UI e gerar um JSON de operações que recrie o design no Figma com fidelidade absoluta, integrando-se ao Design System existente do usuário.

OPERAÇÕES DISPONÍVEIS:
- CREATE_FRAME: { type: "CREATE_FRAME", ref: "id", name: string, width, height, x?, y?, fills: [...], cornerRadius?, layoutMode?: "HORIZONTAL"|"VERTICAL", itemSpacing?, paddingTop/Right/Bottom/Left?, layoutSizingHorizontal: "FIXED"|"HUG"|"FILL", layoutSizingVertical: "FIXED"|"HUG"|"FILL", primaryAxisAlignItems: "MIN"|"CENTER"|"MAX"|"SPACE_BETWEEN", counterAxisAlignItems: "MIN"|"CENTER"|"MAX", effects?: [...], parentRef? }
- CREATE_TEXT: { type: "CREATE_TEXT", ref: "id", name, characters, x?, y?, fontSize, fontWeight: 100-900, fontFamily?, fontStyle?, letterSpacing?, lineHeight?, textAlignHorizontal: "LEFT"|"CENTER"|"RIGHT"|"JUSTIFIED", fills: [...], layoutSizingHorizontal?, parentRef? }
- CREATE_ICON: { type: "CREATE_ICON", ref: "id", name?, props: { icon: "prefix:name", size?, color: [...], x?, y? }, parentRef? }
- CREATE_SVG: { type: "CREATE_SVG", ref: "id", svgString, width, height, x?, y?, opacity?, parentRef? }
- CREATE_COMPONENT_INSTANCE: { type: "CREATE_COMPONENT_INSTANCE", ref: "id", componentKey: string, name?, width?, height?, x?, y?, parentRef? }

DIRETRIZES TÉCNICAS (REGRAS DE OURO):
1. CONTAINER RAIZ & SEMÂNTICA:
   - Frame principal fixo (ex: 400x800). Sempre nomeie camadas de forma semântica (ex: "Header", "Product Card", "Primary Call-to-Action").
   - DESIGN GUIDELINES (STRICT):
      - NO SHADOWS: Do NOT use drop shadows or effects unless explicitly stated in brand guidelines. Clean, flat design is preferred.
      - 8PX GRID: All spacing (gap, padding, coordinates) must be multiples of 8.
      - AUTO-LAYOUT: Use vertical/horizontal layout modes in almost all frames. Never overlap text nodes.
      - FONT ACCURACY: 
        1. Identify the font vibe (e.g., Geometric Sans, Humanist Serif, Monospace). 
        2. Match to 'availableBrandFonts' if they fit the role (Heading vs Body).
        3. If no match, use standard professional families: Inter (Geometric), Playfair Display (Serif), Roboto Mono (Mono).
        4. Capture precise 'fontStyle' (Regular, Medium, Bold, Italic) and 'fontSize'.
      - ICONS: Use 'CREATE_ICON' for UI icons (use standard Iconify sets like 'mdi', 'ph', 'tabler'). Never use images for icons.
      - COMPONENT PRIORITY: If an element matches a name/shape in 'availableComponents', YOU MUST use 'CREATE_COMPONENT_INSTANCE'. Only use primitives (RECTANGLE, FRAME) for custom layout structures.
2. ADAPTIVE COMPONENT MAPPING:
   - Se você identificar um elemento na imagem (Botão, Input, Card, Header) que corresponda a um dos COMPONENTES DISPONÍVEIS abaixo, USE CREATE_COMPONENT_INSTANCE em vez de recriá-lo do zero.
   - Mapeie por nome e intenção visual.${componentsList}
3. TOKENS & ACURÁCIA:
   - Use os TOKENS DA MARCA abaixo para todas as cores e fontes.${brandContext}
   - Se um token não existir, use o valor HEX/Font mais próximo detectado na imagem.
4. GRID & ESPAÇAMENTO:
   - Use múltiplos de 8 para itemSpacing e paddings.
   - Garanta alinhamentos precisos.
5. ICONES & VETORES:
   - USE CREATE_ICON para todos os ícones de UI (ex: menu, search, home, arrow-right).
   - Use bibliotecas como "mdi", "lucide" ou "ph" (ex: "lucide:arrow-right").

RESPONDA APENAS COM JSON:
{
  "name": "Nome do componente",
  "category": "card|page|section|navigation",
  "operations": [...],
  "tokens": {
    "colors": [...],
    "typography": [...]
  }
}
`;
};

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
