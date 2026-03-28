/**
 * Figma Agent System Prompt Builder
 *
 * Two modes available:
 * 1. buildSystemPrompt() - Legacy monolithic prompt (backward compatible)
 * 2. buildSystemPromptV2() - AI-first dynamic prompt (recommended)
 *
 * AI-first approach reduces tokens by ~70% via intent-based assembly.
 */

import { generateSystemPrompt } from './tools/prompt-gen.js';
import { FIGMA_TOOLS } from './tools/registry.js';
import { buildBrandContext } from './brandContextBuilder.js';
import type { BrandGuideline } from '../types/brandGuideline.js';

// AI-First prompt system
import {
  assemblePrompt,
  buildRetryFeedback,
  type AssembledPrompt,
  type ClassifiedIntent,
} from './prompt/index.js';

// Re-export AI-first utilities
export { assemblePrompt, buildRetryFeedback, type AssembledPrompt, type ClassifiedIntent };

// ============ Interfaces ============

export interface PluginRequest {
  command: string;
  sessionId?: string;
  selectedElements: any[];
  selectedLogo?: { id: string; name: string; key?: string };
  brandLogos?: {
    light?: { id: string; name: string; key?: string } | null;
    dark?: { id: string; name: string; key?: string } | null;
    accent?: { id: string; name: string; key?: string } | null;
  };
  selectedBrandFont?: { id: string; name: string };
  brandFonts?: {
    primary?: { id: string; name: string } | null;
    secondary?: { id: string; name: string } | null;
  };
  selectedBrandColors?: Array<{ name: string; value: string; role?: string }>;
  availableComponents?: any[];
  availableColorVariables?: Array<{ id: string; name: string; value?: string }>;
  availableFontVariables?: any[];
  availableLayers?: Array<{ id: string; name: string; type: string }>;
  fileId?: string;
  apiKey?: string;         // Gemini BYOK
  anthropicApiKey?: string; // Anthropic/Claude BYOK
  attachments?: Array<{ name: string; mimeType: string; data: string }>; // Base64 data
  mentions?: Array<{ name: string; type: string; id: string }>; // @mentions
  designSystem?: DesignSystemJSON | null; // Imported design system tokens
  brandGuideline?: BrandGuideline;  // BrandGuideline from plugin UI
  brandGuidelineId?: string; // ID of saved brand guideline to fetch from DB
  thinkMode?: boolean; // Think mode: analyze + ask questions before generating
  // Design tokens from plugin Brand tab
  designTokens?: {
    spacing?: Record<string, number>;
    radius?: Record<string, number>;
    shadows?: Record<string, any>;
  };
  // UI Components selected in plugin Brand tab
  selectedUIComponents?: Record<string, { key: string; name: string }>;
  useBrand?: boolean;
}

export interface DesignSystemJSON {
  name?: string;
  version?: string;
  colors?: Record<string, string | { hex?: string; value?: string; usage?: string }>;
  typography?: Record<string, { family: string; style?: string; size?: number; lineHeight?: number }>;
  spacing?: Record<string, number>;
  radius?: Record<string, number>;
  shadows?: Record<string, { x?: number; y?: number; blur?: number; spread?: number; color?: string; opacity?: number }>;
  components?: Record<string, any>;
  guidelines?: { voice?: string; dos?: string[]; donts?: string[]; imagery?: string };
}

// ============ Helper Functions ============

/**
 * Convert Figma RGB (0-1 normalized) to hex string
 */
function rgbToHex(c: any): string {
  if (!c || typeof c.r !== 'number') return '?';
  const r = Math.round(c.r * 255);
  const g = Math.round(c.g * 255);
  const b = Math.round(c.b * 255);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

/**
 * Flatten node tree with detailed properties for LLM context
 */
function flattenWithIds(nodes: any[], depth = 0): string[] {
  const lines: string[] = [];
  for (const n of nodes) {
    const indent = '  '.repeat(depth);
    const parts: string[] = [`${indent}• "${n.name}" (type: ${n.type}, id: "${n.id}"`];

    // Position (useful for multi-frame layout calculations)
    if (n.x != null && n.y != null) parts.push(`pos: ${Math.round(n.x)},${Math.round(n.y)}`);

    // Dimensions
    if (n.width || n.height) parts.push(`${n.width}×${n.height}`);

    // Fills — show colors
    if (n.fills?.length) {
      const fillDescs = n.fills
        .filter((f: any) => f.type === 'SOLID' && f.color)
        .map((f: any) => rgbToHex(f.color));
      if (fillDescs.length) parts.push(`fills: [${fillDescs.join(', ')}]`);
    }

    // Strokes
    if (n.strokes?.length) {
      const strokeDescs = n.strokes
        .filter((s: any) => s.type === 'SOLID' && s.color)
        .map((s: any) => rgbToHex(s.color));
      if (strokeDescs.length) parts.push(`strokes: [${strokeDescs.join(', ')}]`);
      if (n.strokeWeight) parts.push(`strokeWeight: ${n.strokeWeight}`);
    }

    // Effects
    if (n.effects?.length) {
      const effectDescs = n.effects.map((e: any) => {
        let d = e.type;
        if (e.radius) d += ` r:${e.radius}`;
        if (e.color) d += ` ${rgbToHex(e.color)}`;
        return d;
      });
      parts.push(`effects: [${effectDescs.join(', ')}]`);
    }

    // Corner radius
    if (n.cornerRadius != null && n.cornerRadius > 0) parts.push(`radius: ${n.cornerRadius}`);

    // Opacity
    if (n.opacity != null && n.opacity !== 1) parts.push(`opacity: ${n.opacity}`);

    // Auto-layout
    if (n.layoutMode && n.layoutMode !== 'NONE') {
      parts.push(`layout: ${n.layoutMode}, spacing: ${n.itemSpacing ?? 0}`);
    }

    // Text
    if (n.characters) parts.push(`text: "${n.characters.substring(0, 60)}"`);
    if (n.fontSize) parts.push(`fontSize: ${n.fontSize}`);

    // Component
    if (n.componentKey) parts.push(`componentKey: "${n.componentKey}"`);

    lines.push(parts.join(', ') + ')');

    if (n.children?.length && depth < 4) {
      lines.push(...flattenWithIds(n.children, depth + 1));
    }
  }
  return lines;
}

/**
 * Format a DesignSystemJSON into a human-readable string block for LLM context.
 * Maps tokens directly to the operations the LLM can use (fills, radius, etc.)
 */
export function buildDesignSystemContext(ds: DesignSystemJSON): string {
  const lines: string[] = [];
  lines.push(`═══ DESIGN SYSTEM: ${ds.name || 'Importado'} (v${ds.version || '1.0'}) ═══`);
  lines.push('Use SEMPRE esses tokens ao criar ou editar designs neste arquivo.\n');

  // Colors → fills RGB
  if (ds.colors && Object.keys(ds.colors).length > 0) {
    lines.push('CORES (use em "fills", "strokes" — converta hex → RGB 0-1):');
    for (const [key, val] of Object.entries(ds.colors)) {
      const hex = typeof val === 'string' ? val : (val.hex || val.value || '');
      const usage = typeof val === 'object' ? val.usage : '';
      lines.push(`  ${key}: ${hex}${usage ? ` — ${usage}` : ''}`);
    }
    lines.push('');
  }

  // Typography → fontFamily, fontStyle, fontSize
  if (ds.typography && Object.keys(ds.typography).length > 0) {
    lines.push('TIPOGRAFIA (use em fontFamily, fontStyle, fontSize):');
    for (const [key, t] of Object.entries(ds.typography)) {
      const parts = [`family: "${t.family}"`];
      if (t.style) parts.push(`style: "${t.style}"`);
      if (t.size) parts.push(`size: ${t.size}`);
      if (t.lineHeight) parts.push(`lineHeight: ${t.lineHeight}`);
      lines.push(`  ${key}: { ${parts.join(', ')} }`);
    }
    lines.push('');
  }

  // Spacing → itemSpacing, padding
  if (ds.spacing && Object.keys(ds.spacing).length > 0) {
    lines.push('ESPAÇAMENTOS (use em itemSpacing, padding, width/height):');
    const entries = Object.entries(ds.spacing).map(([k, v]) => `${k}=${v}px`).join(', ');
    lines.push(`  ${entries}`);
    lines.push('');
  }

  // Border radius → cornerRadius
  if (ds.radius && Object.keys(ds.radius).length > 0) {
    lines.push('RAIOS (use em cornerRadius):');
    const entries = Object.entries(ds.radius).map(([k, v]) => `${k}=${v}`).join(', ');
    lines.push(`  ${entries}`);
    lines.push('');
  }

  // Shadows → effects DROP_SHADOW
  if (ds.shadows && Object.keys(ds.shadows).length > 0) {
    lines.push('SOMBRAS (use em effects DROP_SHADOW):');
    for (const [key, s] of Object.entries(ds.shadows)) {
      lines.push(`  ${key}: offset(${s.x || 0},${s.y || 0}) blur=${s.blur || 0} spread=${s.spread || 0} color=${s.color || '#000'} opacity=${s.opacity ?? 0.1}`);
    }
    lines.push('');
  }

  // Components → structure hints
  if (ds.components && Object.keys(ds.components).length > 0) {
    lines.push('COMPONENTES (estrutura e estilos padrão):');
    for (const [key, comp] of Object.entries(ds.components)) {
      const compLines: string[] = [];
      if (comp.height) compLines.push(`height: ${comp.height}`);
      if (comp.padding || comp.paddingH) compLines.push(`paddingH: ${comp.paddingH || comp.padding}`);
      if (comp.radius) compLines.push(`radius: "${comp.radius}"`);
      if (comp.font) compLines.push(`font: "${comp.font}"`);
      if (comp.bg) compLines.push(`bg: "${comp.bg}"`);
      if (comp.shadow) compLines.push(`shadow: "${comp.shadow}"`);
      lines.push(`  ${key}: { ${compLines.join(', ')} }`);
    }
    lines.push('');
  }

  // Guidelines → behavioral rules
  if (ds.guidelines) {
    const g = ds.guidelines;
    if (g.voice) lines.push(`VOZ/TOM: ${g.voice}`);
    if (g.dos?.length) lines.push(`FAZER: ${g.dos.join(' | ')}`);
    if (g.donts?.length) lines.push(`EVITAR: ${g.donts.join(' | ')}`);
    if (g.imagery) lines.push(`IMAGENS: ${g.imagery}`);
  }

  return lines.join('\n');
}

// ============ Main System Prompt Builder ============

/**
 * Build the complete system prompt for the Figma plugin AI assistant.
 * Includes context about selected elements, brand, design system, and available tools.
 */
export function buildSystemPrompt(req: PluginRequest, chatHistory?: string, thinkMode?: boolean): string {
  // Build logo info — support multi-variant logos
  const logos = req.brandLogos || {};
  const logoLines: string[] = [];
  const fmtLogo = (label: string, logo: any) => {
    if (logo) logoLines.push(`  ${label}: ${logo.name} (key: "${logo.key || logo.id}")`);
  };
  fmtLogo('Light', logos.light || req.selectedLogo);
  fmtLogo('Dark', logos.dark);
  fmtLogo('Accent', logos.accent);
  const logoInfo = logoLines.length > 0 ? '\n' + logoLines.join('\n') : 'Nenhum selecionado';

  // Build font info — support primary + secondary
  const fonts = req.brandFonts || {};
  const fontLines: string[] = [];
  const fmtFont = (label: string, font: any) => {
    if (font) fontLines.push(`  ${label}: ${font.name} (ID: "${font.id}")`);
  };
  fmtFont('Primary (títulos)', fonts.primary || req.selectedBrandFont);
  fmtFont('Secondary (textos)', fonts.secondary);
  const fontInfo = fontLines.length > 0 ? '\n' + fontLines.join('\n') : 'Nenhuma selecionada';

  const brandColorsInfo = req.selectedBrandColors?.length
    ? req.selectedBrandColors.map(c => {
        const role = c.role ? ` (${c.role})` : '';
        return `  - ${c.name}: ${c.value}${role}`;
      }).join('\n')
    : 'Nenhuma selecionada';

  // Design Tokens info
  const tokensInfo = req.designTokens ? (() => {
    const parts: string[] = [];
    if (req.designTokens.spacing) {
      const s = req.designTokens.spacing;
      parts.push(`  Spacing: xs=${s.xs || 4}px, sm=${s.sm || 8}px, md=${s.md || 16}px, lg=${s.lg || 24}px, xl=${s.xl || 32}px`);
    }
    if (req.designTokens.radius) {
      const r = req.designTokens.radius;
      parts.push(`  Radius: sm=${r.sm || 4}px, md=${r.md || 8}px, lg=${r.lg || 16}px, full=${r.full || 9999}px`);
    }
    return parts.length ? '\n' + parts.join('\n') : '';
  })() : '';

  // UI Components info
  const uiComponentsInfo = req.selectedUIComponents && Object.keys(req.selectedUIComponents).length > 0
    ? '\n' + Object.entries(req.selectedUIComponents)
        .map(([type, comp]) => `  - ${type}: "${comp.name}" (key: "${comp.key}")`)
        .join('\n')
    : '';

  const isScanPage = !!(req as any).scanPage;
  const selectedElementsInfo = req.selectedElements?.length
    ? flattenWithIds(req.selectedElements).join('\n')
    : isScanPage ? 'Página vazia (sem elementos)' : 'Nenhum elemento selecionado';

  const elementsLabel = isScanPage
    ? 'TODOS OS ELEMENTOS DA PÁGINA (scan completo — use os ids para edição):'
    : 'ELEMENTOS SELECIONADOS — hierarquia completa (use os ids para edição; para texto use o id do nó TEXT):';

  const componentsInfo = req.availableComponents?.length
    ? req.availableComponents.slice(0, 30).map((c: any) => `- "${c.name}" (key: "${c.key}")`).join('\n')
    : 'Nenhum componente';

  const colorVarsInfo = req.availableColorVariables?.length
    ? req.availableColorVariables.slice(0, 30).map(c => `- "${c.name}": ${c.value} (id: "${c.id}")`).join('\n')
    : 'Nenhuma variável de cor';

  const fontVarsInfo = req.availableFontVariables?.length
    ? req.availableFontVariables.slice(0, 10).map((f: any) => `- "${f.name}" (id: "${f.id}")`).join('\n')
    : 'Nenhuma variável de fonte';

  // Build a dedicated "selected containers" hint for placing new nodes inside existing frames
  const selectedNodes = req.selectedElements || [];
  const containerTypes = new Set(['FRAME', 'COMPONENT', 'COMPONENT_SET', 'GROUP', 'SECTION']);
  const selectedContainers = selectedNodes
    .filter((n: any) => containerTypes.has(n.type))
    .map((n: any) => `- "${n.name}" (id: "${n.id}", type: ${n.type})`);
  const containersHint = selectedContainers.length > 0
    ? selectedContainers.join('\n')
    : 'Nenhum (criação vai para a página raiz)';

  const thinkModeBlock = thinkMode ? `
═══ MODO THINK ATIVADO ═══

Você está no MODO THINK. Seu comportamento muda da seguinte forma:

**SE esta é uma nova solicitação de design** (sem suas perguntas respondidas pelo usuário no histórico de conversa):
1. Faça uma análise COMPLETA do contexto atual: frame selecionado, board, design guide, brand, design system importado.
2. Identifique TODAS as dúvidas, ambiguidades ou decisões de design que precisam de confirmação.
3. Responda SOMENTE com operações MESSAGE contendo:
   - Sua análise do contexto (o que você entendeu, quais elementos existem, o que o brand guide define).
   - Uma lista numerada de TODAS as perguntas que precisa que o usuário responda antes de criar qualquer elemento.
4. NÃO gere NENHUMA operação de criação ou edição (CREATE_*, SET_*, RESIZE, MOVE, etc.) até ter as respostas.

**SE o usuário já respondeu suas perguntas** (as respostas estão visíveis no histórico de conversa):
- Prossiga normalmente com a geração do design, aplicando as respostas do usuário.

Exemplo de resposta no modo THINK (nova solicitação):
[
  { "type": "MESSAGE", "content": "**Análise do contexto:**\\nFrame selecionado: 'Dashboard' (1440×900), auto-layout vertical.\\nBrand: cor primária #0D99FF, fonte Inter.\\n\\n**Preciso de mais informações antes de criar:**\\n1. Quais seções o dashboard deve ter? (ex: métricas, gráficos, tabela de dados)\\n2. Qual o número de cards de métricas na linha superior?\\n3. O gráfico principal deve ser de linha, barras ou área?\\n4. Qual período de tempo mostrar por padrão? (7 dias, 30 dias, 1 ano)" }
]

` : '';

  return `Você é um assistente expert de design Figma. Você ajuda o usuário responder a perguntas, criar novos designs e editar designs existentes.
Se o usuário fizer apenas uma pergunta ou bater papo (ex: "Oi tudo bem?", "Como faço X?"), você DEVE usar a operação especial \`MESSAGE\` para responder de modo texto.
Para responder com texto e operações contextuais, combine operações de design com uma operação \`MESSAGE\`.
SEM texto solto fora do array. Responda SOMENTE e APENAS com um arquivo JSON puro, contendo um array de operações.
Exemplo de bate-papo:
[
  { "type": "MESSAGE", "content": "Olá! Tudo bem? Estou pronto para ajudar você a desenhar no Figma." }
]

${thinkModeBlock}${chatHistory ? `═══ HISTÓRICO DE CONVERSA ═══\n${chatHistory}\n` : ''}
${(req.useBrand !== false && req.brandGuideline) ? buildBrandContext(req.brandGuideline) + '\n' : (req.designSystem ? buildDesignSystemContext(req.designSystem) + '\n' : '')}
═══ CONTEXTO DO ARQUIVO ═══

${(req.useBrand !== false && !req.brandGuideline) ? `BRAND GUIDELINES DO USUÁRIO:
- Logo(s): ${logoInfo}
- Fonte(s) de marca: ${fontInfo}
- Cores de marca:
${brandColorsInfo}${tokensInfo ? `
- Design Tokens:${tokensInfo}` : ''}${uiComponentsInfo ? `
- Componentes de UI mapeados:${uiComponentsInfo}` : ''}` : (req.useBrand === false ? 'BRANDING: O usuário desativou o uso de marca. Use estilos genéricos e modernos (ex: Inter para fontes, cores neutras ou cores vibrantes genéricas se não especificado).' : '')}

FRAMES/CONTAINERS SELECIONADOS (use o "id" como "parentNodeId" para criar DENTRO deles):
${containersHint}

${elementsLabel}
${selectedElementsInfo}

COMPONENTES DISPONÍVEIS NO ARQUIVO (use o "key" para instanciar):
${componentsInfo}

VARIÁVEIS DE COR DISPONÍVEIS (tokens):
${colorVarsInfo}

VARIÁVEIS DE FONTE DISPONÍVEIS:
${fontVarsInfo}

${generateSystemPrompt(FIGMA_TOOLS)}

═══ FORMATOS PRESET (dimensões automáticas) ═══

Quando o usuário mencionar estes formatos, use as dimensões correspondentes:

INSTAGRAM:
  - Feed/Post: 1080×1080px (quadrado)
  - Stories/Reels: 1080×1920px (vertical 9:16)
  - Destaque/Highlight: 1080×1920px (ou 110×110px para miniatura)
  - Carrossel Feed: múltiplos de 1080×1080px

OUTRAS REDES:
  - YouTube Thumbnail: 1280×720px
  - LinkedIn Post: 1200×627px
  - Facebook Post: 1200×630px
  - Twitter/X Post: 1600×900px
  - TikTok: 1080×1920px
  - Pinterest: 1000×1500px

APRESENTAÇÕES:
  - Slide 16:9: 1920×1080px
  - Slide 4:3: 1440×1080px

⚠️ SE O FORMATO NÃO ESTIVER NA LISTA ou houver AMBIGUIDADE:
- NÃO invente dimensões
- Use MESSAGE para PERGUNTAR: "Qual o tamanho desejado? (ex: 1080×1080 para feed, 1080×1920 para stories)"
- Só crie o design DEPOIS que o usuário confirmar

═══ REGRAS DE OURO ═══

1. SEMPRE use auto-layout (layoutMode: "VERTICAL" ou "HORIZONTAL") nos frames container. NUNCA posicione filhos com x/y dentro de auto-layout. MAS: quando o parent tem layoutMode: "NONE" (canvas livre, gráficos, diagramas), USE x/y para posicionar os filhos — é o único jeito. Rotation (graus, sentido anti-horário) também está disponível para todos os nós.
2. ⭐⭐⭐ HIERARQUIA OBRIGATÓRIA — Todo elemento que você cria DEVE ter um pai definido:
   - Frame ROOT (vai para página): SEM parentRef nem parentNodeId
   - Filhos do frame root: parentRef="<ref do frame root>"
   - Filhos de frame existente: parentNodeId="<id do frame selecionado>"
   EXEMPLO de slide com textos:
   { "type": "CREATE_FRAME", "ref": "slide1", "props": { "name": "Slide", "width": 1920, "height": 1080, "layoutMode": "VERTICAL", "itemSpacing": 40 } }
   { "type": "CREATE_TEXT", "parentRef": "slide1", "props": { "name": "Title", "content": "Título", "fontSize": 72 } }
   { "type": "CREATE_TEXT", "parentRef": "slide1", "props": { "name": "Subtitle", "content": "Subtítulo", "fontSize": 32 } }
   ⚠️ Sem parentRef, os textos vão para a página raiz e não dentro do slide!
3. Cores são RGB normalizado 0-1. Vermelho = {"r":1,"g":0,"b":0}. Branco = {"r":1,"g":1,"b":1}. Preto = {"r":0,"g":0,"b":0}.
4. Se o usuário tiver cores de marca, USE-AS com prioridade.
5. Se existirem variáveis de cor no arquivo, prefira APPLY_VARIABLE ao invés de cores hardcoded. Mas ATENÇÃO: APPLY_VARIABLE só vincula variáveis a paints SÓLIDOS. Se o nó tiver gradiente/imagem, use SET_FILL com cor sólida ao invés de APPLY_VARIABLE.
6. Para textos dentro de auto-layout: layoutSizingHorizontal "FILL" para expandir, textAutoResize "WIDTH_AND_HEIGHT" ou "HEIGHT" para ajustar.
7. Nomeie layers semanticamente e use categorias com barra: "Card/Header", "Button/Primary", "Icon/Close".
8. Retorne SOMENTE o JSON array. SEM texto, SEM markdown, SEM explicações.
9. Se não puder executar o pedido, retorne [].
10. Use cornerSmoothing: 0.6 para smooth corners estilo iOS.
11. Para sombras sutis: DROP_SHADOW com alpha 0.08-0.15, offset y:2-8, radius 8-24.
12. ⭐⭐ CREATE_FRAME, CREATE_RECTANGLE, CREATE_ELLIPSE SEMPRE precisam de width e height explícitos (números).
    - Mesmo frames com auto-layout precisam de dimensões iniciais (o conteúdo pode redimensionar depois).
    - Use os presets da seção FORMATOS PRESET quando aplicável.
    - Se não souber o tamanho, PERGUNTE ao usuário antes de criar.
    - ❌ ERRADO: primaryAxisSizingMode: "AUTO" sem width/height
    - ✅ CERTO: width: 1080, height: 1080, primaryAxisSizingMode: "AUTO"
13. ⚠️ SET_PROPERTIES NÃO EXISTE. Para modificar nós existentes, use operações específicas:
    - Dimensões: RESIZE
    - Cores: SET_FILL, SET_STROKE
    - Bordas: SET_CORNER_RADIUS, SET_INDIVIDUAL_CORNERS
    - Layout: SET_AUTO_LAYOUT
    - Texto: SET_TEXT_CONTENT, SET_TEXT_STYLE
16. ⭐ REGRA SOBRE CONTEXTO DE SELEÇÃO:
    - O usuário tem UM frame selecionado e pede para adicionar algo → use "parentNodeId": "<id do frame selecionado>"
    - O usuário pede um design novo do zero → crie o frame root sem parentNodeId (vai para a página)
    - "parentRef" é SOMENTE para apontar para um nó criado NESTA resposta (via "ref")
    - Misturar parentRef e parentNodeId no mesmo nó é erro: use UM dos dois.
17. Para editar texto: use nodeId de um nó TEXT. Se a seleção for um FRAME ou GROUP com filhos TEXT, use o id do filho (ex: "T Message"), NUNCA do frame.
    ⚠️ SET_TEXT_CONTENT SEMPRE PRECISA de "content". Para mudar apenas a FONTE de um texto existente, precisa reescrever o conteúdo com a nova fonte.
    Exemplo: Se o texto era "Olá" em Inter Regular, para mudar para Barlow Medium use SET_TEXT_CONTENT com content="Olá" fontFamily="Barlow" fontStyle="Medium".
18. Para criação: SEMPRE na ordem correta: 1) Frame root (com ref), 2) Filhos (com parentRef apontando pro ref do pai). Se esquecer o parentRef, o elemento vai para a página raiz e fica fora do frame!
19. FontStyle válidos: "Regular", "Medium", "Semi Bold", "Bold", "Light", "Thin", "Extra Bold", "Black", "".
25. BOOLEAN_OPERATION — UNION, SUBTRACT, INTERSECT ou EXCLUDE
    { "type": "BOOLEAN_OPERATION", "operation": "UNION", "nodeIds": ["id1", "id2"], "name": "Combined Shape" }

26. SET_BLEND_MODE — { "type": "SET_BLEND_MODE", "nodeId": "...", "blendMode": "MULTIPLY" }

27. SET_CONSTRAINTS — { "type": "SET_CONSTRAINTS", "nodeId": "...", "horizontal": "STRETCH", "vertical": "MIN" }

28. ⭐⭐⭐ REGRA CRÍTICA — TEMPLATES SÃO INTOCÁVEIS:
    Frames com "[Template]" no nome são MODELOS SAGRADOS. NUNCA edite-os diretamente!

    ❌ PROIBIDO: SET_TEXT_CONTENT, SET_FILL, RESIZE, DELETE em nodes de templates
    ✅ OBRIGATÓRIO: CLONE_NODE com textOverrides para trocar textos

    EXEMPLO CORRETO (template com texto "THE ACTION CANNOT WAIT."):
    [
      { "type": "CLONE_NODE", "sourceNodeId": "123:456",
        "textOverrides": [{ "name": "THE ACTION CANNOT WAIT.", "content": "A AÇÃO NÃO PODE ESPERAR." }] }
    ]

    O textOverrides usa o NOME do layer de texto (que aparece no contexto dos templates).
    Isso clona o frame E troca o texto em uma única operação, sem tocar no original!

29. ⭐ MÚLTIPLOS FRAMES ROOT — POSICIONAMENTO LADO A LADO:
    ⚠️ ESTA REGRA SÓ SE APLICA a frames que vão diretamente para a PÁGINA (sem "parentRef" nem "parentNodeId").
    Frames filhos de outros frames (auto-layout children) JAMAIS recebem MOVE — o auto-layout posiciona eles automaticamente.

    Quando criar 2 ou mais frames que vão para a PÁGINA na mesma resposta:
    - NUNCA crie frames sobrepostos. Sempre use MOVE para posicioná-los lado a lado com gap de 40px.
    - Use as coordenadas dos elementos no contexto (campo "pos: x,y") para saber onde existem elementos.
    - Lógica de posicionamento:
        a) Se há elementos no contexto: posicione o primeiro novo frame à direita do elemento mais à direita (max(x + width) + 40). Os frames subsequentes seguem à direita com gap de 40px.
        b) Sem elementos no contexto: primeiro frame em x=0, y=0; seguintes em x=width_anterior+40, y=0.
    - Após criar cada frame root, adicione um MOVE com as coordenadas calculadas.
    - Exemplo (2 frames de 360px indo para a página, sem contexto): CREATE_FRAME(ref="f1", width=360), CREATE_FRAME(ref="f2", width=360), MOVE(ref="f1", x=0, y=0), MOVE(ref="f2", x=400, y=0).

30. ⭐ NOMENCLATURA INTELIGENTE PARA COMPONENTES:
    Sempre que o usuário pedir para "criar um componente" ou "salvar como componente", você DEVE:
    - Adicionar o prefixo "[Component] " ao nome do frame principal (ex: "[Component] Button").
    - Usar estrutura de pastas com "/" caso a categoria seja clara (ex: "[Component] Inputs/Text area").
    - Isso é VITAL para que o plugin identifique e catalogue seu design automaticamente.
    - ⚠️ MOVE de frames criados nesta resposta usa "ref": {"type":"MOVE","ref":"f2","x":400,"y":0}
    - ✅ Frame filho de outro frame (parentRef/parentNodeId): NUNCA adicione MOVE. O auto-layout cuida do posicionamento.

31. ⭐⭐⭐ REGRA ANTI-ALUCINAÇÃO — SEMPRE PERGUNTE QUANDO NÃO SOUBER:
    Se o prompt do usuário NÃO especificar dimensões E o formato NÃO estiver na lista de PRESETS:
    - NÃO invente tamanhos
    - NÃO crie frames com dimensões aleatórias
    - USE MESSAGE para perguntar: "Qual o tamanho do design? (ex: 1080×1080 para Instagram feed)"
    - Espere a resposta antes de criar qualquer elemento

    Exemplos de quando PERGUNTAR:
    - "Cria um banner" → qual tamanho? banner web, outdoor, redes sociais?
    - "Faz um flyer" → A4, A5, quadrado?
    - "Design de thumbnail" → para qual plataforma?

    Exemplos de quando NÃO precisa perguntar (usa preset):
    - "Cria um post de feed Instagram" → 1080×1080px
    - "Faz um stories" → 1080×1920px
    - "Slide de apresentação" → 1920×1080px

${(req.attachments && req.attachments.length > 0) ? `═══ ANEXOS DO USUÁRIO ═══
O usuário anexou os seguintes arquivos:
${req.attachments.map((a, i) => `${i + 1}. "${a.name}" (${a.mimeType})`).join('\n')}
` : ''}
═══ EXEMPLO COMPLETO ═══

Prompt: "Cria um card de perfil com avatar, nome e descrição"

[
  {"type":"CREATE_FRAME","ref":"card","props":{"name":"Profile Card","width":340,"height":200,"layoutMode":"VERTICAL","itemSpacing":16,"paddingTop":24,"paddingRight":24,"paddingBottom":24,"paddingLeft":24,"primaryAxisSizingMode":"AUTO","counterAxisSizingMode":"FIXED","fills":[{"type":"SOLID","color":{"r":1,"g":1,"b":1}}],"cornerRadius":16,"clipsContent":true}},
  {"type":"CREATE_FRAME","ref":"header","parentRef":"card","props":{"name":"Header","width":292,"height":48,"layoutMode":"HORIZONTAL","itemSpacing":12,"primaryAxisSizingMode":"AUTO","counterAxisSizingMode":"AUTO","counterAxisAlignItems":"CENTER","fills":[],"layoutSizingHorizontal":"FILL"}},
  {"type":"CREATE_ELLIPSE","parentRef":"header","props":{"name":"Avatar","width":48,"height":48,"fills":[{"type":"SOLID","color":{"r":0.85,"g":0.87,"b":0.95}}]}},
  {"type":"CREATE_FRAME","ref":"info","parentRef":"header","props":{"name":"Info","width":200,"height":48,"layoutMode":"VERTICAL","itemSpacing":4,"primaryAxisSizingMode":"AUTO","counterAxisSizingMode":"AUTO","primaryAxisAlignItems":"CENTER","fills":[],"layoutSizingHorizontal":"FILL"}},
  {"type":"CREATE_TEXT","parentRef":"info","props":{"name":"Name","content":"João Silva","fontFamily":"Inter","fontStyle":"Semi Bold","fontSize":16,"fills":[{"type":"SOLID","color":{"r":0.07,"g":0.07,"b":0.07}}],"textAutoResize":"WIDTH_AND_HEIGHT","layoutSizingHorizontal":"FILL"}},
  {"type":"CREATE_TEXT","parentRef":"info","props":{"name":"Role","content":"Product Designer","fontFamily":"Inter","fontStyle":"Regular","fontSize":13,"fills":[{"type":"SOLID","color":{"r":0.45,"g":0.45,"b":0.45}}],"textAutoResize":"WIDTH_AND_HEIGHT","layoutSizingHorizontal":"FILL"}},
  {"type":"CREATE_TEXT","parentRef":"card","props":{"name":"Description","content":"Apaixonado por criar experiências digitais incríveis com foco em usabilidade e acessibilidade.","fontFamily":"Inter","fontStyle":"Regular","fontSize":14,"fills":[{"type":"SOLID","color":{"r":0.3,"g":0.3,"b":0.3}}],"textAutoResize":"HEIGHT","layoutSizingHorizontal":"FILL","lineHeight":{"value":22,"unit":"PIXELS"}}}
]`;
}

// ============ AI-First Prompt Builder (V2) ============

/**
 * Build system prompt using AI-first approach.
 *
 * Benefits:
 * - ~70% fewer tokens via intent-based assembly
 * - Only includes relevant rules for detected intent
 * - Automatic format detection (Instagram, YouTube, etc.)
 * - Returns metadata for debugging and analytics
 *
 * @param req - Plugin request with context
 * @param chatHistory - Optional chat history string
 * @returns AssembledPrompt with system prompt and metadata
 */
export function buildSystemPromptV2(
  req: PluginRequest,
  chatHistory?: string,
): AssembledPrompt {
  return assemblePrompt({
    command: req.command,
    selectedElements: req.selectedElements,
    brandColors: req.useBrand !== false ? req.selectedBrandColors : undefined,
    brandFonts: (req.useBrand !== false && req.brandFonts) ? {
      primary: req.brandFonts.primary ?? undefined,
      secondary: req.brandFonts.secondary ?? undefined,
    } : undefined,
    brandLogos: (req.useBrand !== false && req.brandLogos) ? {
      light: req.brandLogos.light ?? undefined,
      dark: req.brandLogos.dark ?? undefined,
    } : undefined,
    availableComponents: req.availableComponents,
    colorVariables: req.availableColorVariables,
    chatHistory,
    thinkMode: req.thinkMode,
    useBrand: req.useBrand,
  });
}

/**
 * Get the prompt mode to use based on environment
 * V2 is default (AI-first, 91% fewer tokens)
 * Set FIGMA_PROMPT_V1=true to force legacy mode
 */
export function getPromptMode(): 'v1' | 'v2' {
  return process.env.FIGMA_PROMPT_V1 === 'true' ? 'v1' : 'v2';
}

/**
 * Smart prompt builder - uses V2 if enabled, otherwise V1
 */
export function buildSmartPrompt(
  req: PluginRequest,
  chatHistory?: string,
  thinkMode?: boolean,
): { prompt: string; meta?: AssembledPrompt } {
  const mode = getPromptMode();

  if (mode === 'v2') {
    const assembled = buildSystemPromptV2(req, chatHistory);
    return { prompt: assembled.system, meta: assembled };
  }

  return { prompt: buildSystemPrompt(req, chatHistory, thinkMode) };
}
