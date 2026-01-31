import type { AvailableTags } from '../services/tagService.js';

/**
 * User context for analysis (optional)
 * Provides existing user selections to help AI suggest complementary tags
 */
export interface UserContext {
  selectedBrandingTags?: string[];
}

/**
 * Parameters for building analysis prompt
 */
export interface AnalysisPromptParams {
  availableTags?: AvailableTags;
  instructions?: string;
  userContext?: UserContext;
}

/**
 * Builds a comprehensive prompt for AI image analysis
 * Follows best practices of prompt engineering:
 * - Clear role definition
 * - Structured instructions
 * - Context about available options
 * - User preferences integration
 * - Explicit output format
 * 
 * @param params - Parameters for building the prompt
 * @returns Complete prompt string ready for AI
 */
export function buildAnalysisPrompt(params: AnalysisPromptParams): string {
  const { availableTags, instructions, userContext } = params;

  // Limit tags per category to keep prompt smaller and speed up Gemini (fewer input tokens)
  const MAX_TAGS_PER_CATEGORY = 50;
  const slice = (arr: string[]) => (arr.length > MAX_TAGS_PER_CATEGORY ? arr.slice(0, MAX_TAGS_PER_CATEGORY) : arr);
  const availableTagsSection = availableTags
    ? `\n\n**AVAILABLE TAGS (Choose from these when possible):**
- **Branding/Estilo:** ${availableTags.branding.length > 0 ? slice(availableTags.branding).join(', ') : 'N/A'}
- **Categorias de Mockup:** ${availableTags.categories.length > 0 ? slice(availableTags.categories).join(', ') : 'N/A'}
- **Locais/Ambientes:** ${availableTags.locations.length > 0 ? slice(availableTags.locations).join(', ') : 'N/A'}
- **Ângulos:** ${availableTags.angles.length > 0 ? slice(availableTags.angles).join(', ') : 'N/A'}
- **Iluminação:** ${availableTags.lighting.length > 0 ? slice(availableTags.lighting).join(', ') : 'N/A'}
- **Efeitos:** ${availableTags.effects.length > 0 ? slice(availableTags.effects).join(', ') : 'N/A'}
- **Materiais/Texturas:** ${availableTags.materials.length > 0 ? slice(availableTags.materials).join(', ') : 'N/A'}

**IMPORTANT:** When suggesting tags, prioritize exact matches from the available tags list above. Only suggest tags not in the list if they are highly relevant and no suitable alternative exists.`
    : '';

  // Build user context section if provided
  const userContextSection = userContext?.selectedBrandingTags && userContext.selectedBrandingTags.length > 0
    ? `\n\n**USER'S CURRENT SELECTIONS:**
- **Branding já selecionado:** ${userContext.selectedBrandingTags.join(', ')}

**CONTEXT:** The user has already selected these branding tags. Your suggestions should:
1. Complement the existing branding style (suggest tags that work well together)
2. Consider the visual style implied by these selections
3. Suggest additional branding tags that enhance or expand the current style
4. Ensure all other category suggestions align with this branding direction`
    : '';

  // Build instructions section if provided
  const instructionsSection = instructions
    ? `\n\n**USER'S SPECIAL INSTRUCTIONS:**
"${instructions}"

**CONTEXT:** These are specific requirements or preferences from the user. Pay special attention to these instructions when suggesting tags, especially for branding and location categories.`
    : '';

  return `Você é um especialista em mockup, fotografia de produto e design visual.

**SUA TAREFA:**
Analise a imagem fornecida e sugira as melhores tags para cada categoria para criar um mockup perfeito e profissional.${availableTagsSection}${userContextSection}${instructionsSection}

**DIRETRIZES PARA SUGESTÕES:**

1. **Branding/Estilo (Mínimo 4 tags):**
   - Analise o estilo visual da imagem (cores, tipografia, estética geral)
   - Sugira tags que descrevam o estilo visual e a identidade da marca
   - Considere: moderno, minimalista, luxuoso, corporativo, criativo, etc.
   - Se o usuário já selecionou tags de branding, sugira complementares

2. **Categorias de Mockup (Mínimo 3 tags):**
   - Identifique os tipos de mockup mais adequados para esta imagem
   - Considere o formato e conteúdo do design
   - Exemplos: T-Shirt, Mug, Poster, Business Card, Book Cover, etc.

3. **Locais/Ambientes (Mínimo 3 tags):**
   - Sugira ambientes onde o mockup ficaria bem contextualizado
   - Considere o estilo da marca e o tipo de produto
   - Exemplos: Minimalist Studio, Light Box, Modern Office, Nature landscape, etc.

4. **Ângulos (2 melhores opções):**
   - Analise a composição atual e sugira os melhores ângulos de visualização
   - Considere o tipo de produto e o estilo visual
   - Exemplos: Frontal, Lateral, Superior, Isométrico, etc.

5. **Iluminação (2 melhores opções):**
   - Sugira estilos de iluminação que realcem o produto
   - Considere o mood e a estética da marca
   - Exemplos: Studio Lighting, Golden Hour, Natural Light, Cinematic, etc.

6. **Efeitos Visuais (2 sugestões):**
   - Sugira efeitos que adicionem interesse visual sem distrair
   - Considere o estilo da marca
   - Exemplos: Bokeh, Vintage Film, High Contrast, Motion Blur, etc.

7. **Materiais/Texturas (2 sugestões):**
   - Analise a superfície e sugira materiais/texturas adequados
   - Considere o tipo de produto e o estilo visual
   - Exemplos: Wood, Metal, Glass, Fabric, Leather, etc.

**FORMATO DE RESPOSTA:**
Retorne APENAS um objeto JSON válido com esta estrutura exata:
{
  "branding": ["tag1", "tag2", "tag3", "tag4"],
  "categories": ["tag1", "tag2", "tag3"],
  "locations": ["tag1", "tag2", "tag3"],
  "angles": ["tag1", "tag2"],
  "lighting": ["tag1", "tag2"],
  "effects": ["tag1", "tag2"],
  "materials": ["tag1", "tag2"]
}

**REGRAS CRÍTICAS:**
- Use tags exatas da lista de tags disponíveis quando possível
- Se uma tag não estiver na lista mas for altamente relevante, você pode sugerir, mas prefira alternativas da lista
- Todas as tags devem ser strings válidas (sem caracteres especiais desnecessários)
- Retorne arrays vazios [] se não conseguir sugerir tags para uma categoria
- O JSON deve ser válido e parseable`;
}
