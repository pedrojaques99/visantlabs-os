/**
 * Module: Design Excellence (Sexy Design)
 * 
 * Instructions to make the output look professional, premium, and "sexy".
 */

export const DESIGN_EXCELLENCE_RULES = `DESIGN SEXY & PROFISSIONAL (GUIA DE ESTILO):
1. PROFUNDIDADE: Use efeitos de LAYER_BLUR elementos de fundo. EVITE DROP_SHADOW; prefira sobreposições de cores e transparências sutis (Glassmorphism).
2. GRADIENTES: Use apenas de fundo, leve e sutil, ou em elementos de destaque. Não intrusivo.
3. ELEMENTOS DECORATIVOS: Crie "blobs" (CREATE_ELLIPSE) com cores de marca, baixa opacidade (0.1-0.3) e LAYER_BLUR alto (80-150) no fundo para dar textura. IMPORTANTE: Sempre use \`layoutPositioning: "ABSOLUTE"\` em elementos decorativos de fundo para não quebrarem o Auto Layout do container pai.
4. TIPOGRAFIA & ACURÁCIA: Use contraste extremo de escala. Títulos gigantes (120px+) vs Legendas pequenas (14px). Use o peso Bold da fonte de marca para destaque. Garanta que a família tipográfica (fontFamily) detectada ou da marca seja usada com precisão em todos os níveis de hierarquia.
5. RESPIRO (WHITE SPACE): Use paddings generosos (80px, 120px). Não aperte o conteúdo contra as bordas.
6. CONTINUIDADE (CARROSSEL): Para posts de Instagram, adicione elementos que "vazam" de um slide para o outro, convidando ao deslize.
7. REFORÇO DE MARCA: Use CREATE_COMPONENT_INSTANCE com o \`key\` do logo da marca. Posicione-o de forma discreta (ex: canto inferior direito) usando \`layoutPositioning: "ABSOLUTE"\` se estiver dentro de um frame de conteúdo.
8. ALINHAMENTO: Mantenha tudo no grid ou use alinhamentos ópticos consistentes.
`;

export const PREMIUM_EXAMPLE_HINT = `DICA DE COMPOSICAO PREMIUM:
- Camada 1: Elipse gigante com Layer Blur 150px no fundo (opacidade 15%), layoutPositioning: "ABSOLUTE"
- Camada 2: Titulo com fontFamily da Marca, Semi Bold, 140px, Tracking -2%
- Camada 3: Logo da marca (Instância) no canto superior, layoutPositioning: "ABSOLUTE"
- Detalhes: Linhas de 0,75px com opacidade 20% para divisores modernos
`;
