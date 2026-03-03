import express, { Request, Response } from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';

const router = express.Router();

interface PluginRequest {
  command: string;
  selectedElements: any[];
  selectedLogo?: { id: string; name: string; key?: string };
  selectedBrandFont?: { id: string; name: string };
  selectedBrandColors?: Array<{ name: string; value: string }>;
  availableComponents?: any[];
  availableColorVariables?: Array<{ id: string; name: string; value?: string }>;
  availableFontVariables?: any[];
  apiKey?: string;
}

function buildSystemPrompt(req: PluginRequest): string {
  const logoInfo = req.selectedLogo
    ? `${req.selectedLogo.name} (key: "${req.selectedLogo.key || req.selectedLogo.id}")`
    : 'Nenhum selecionado';

  const fontInfo = req.selectedBrandFont
    ? `${req.selectedBrandFont.name} (ID: "${req.selectedBrandFont.id}")`
    : 'Nenhuma selecionada';

  const brandColorsInfo = req.selectedBrandColors?.length
    ? req.selectedBrandColors.map(c => `${c.name}: ${c.value}`).join(', ')
    : 'Nenhuma selecionada';

  const flattenWithIds = (nodes: any[], depth = 0): string[] => {
    const lines: string[] = [];
    for (const n of nodes) {
      let desc = `${' '.repeat(depth)}• "${n.name}" (type: ${n.type}, id: "${n.id}"`;
      if (n.characters) desc += `, text: "${n.characters.substring(0, 60)}"`;
      desc += ')';
      lines.push(desc);
      if (n.children?.length && depth < 4) {
        lines.push(...flattenWithIds(n.children, depth + 1));
      }
    }
    return lines;
  };

  const selectedElementsInfo = req.selectedElements?.length
    ? flattenWithIds(req.selectedElements).join('\n')
    : 'Nenhum elemento selecionado';

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

  return `Você é um assistente expert de design Figma. Gera operações JSON para criar e editar designs no Figma.
Responda SOMENTE com um JSON array de operações. SEM texto, SEM markdown, SEM explicações.

═══ CONTEXTO DO ARQUIVO ═══

BRAND GUIDELINES DO USUÁRIO:
- Logo: ${logoInfo}
- Fonte de marca: ${fontInfo}
- Cores de marca: ${brandColorsInfo}

FRAMES/CONTAINERS SELECIONADOS (use o "id" como "parentNodeId" para criar DENTRO deles):
${containersHint}

ELEMENTOS SELECIONADOS — hierarquia completa (use os ids para edição; para texto use o id do nó TEXT):
${selectedElementsInfo}

COMPONENTES DISPONÍVEIS NO ARQUIVO (use o "key" para instanciar):
${componentsInfo}

VARIÁVEIS DE COR DISPONÍVEIS (tokens):
${colorVarsInfo}

VARIÁVEIS DE FONTE DISPONÍVEIS:
${fontVarsInfo}

═══ OPERAÇÕES DISPONÍVEIS ═══

CRIAÇÃO — dois modos de especificar o pai:
  • "parentRef": "refName"  → pai é outro nó criado NESTA MESMA resposta (via "ref")
  • "parentNodeId": "<id>"  → pai é um nó JÁ EXISTENTE no Figma (ex: frame selecionado)
  ⚠️  REGRA CRÍTICA: se o usuário quer adicionar algo DENTRO de um elemento selecionado,
      use "parentNodeId" com o id desse elemento. SEM parentNodeId → o nó vai para a página.

1. CREATE_FRAME — Frame container com auto-layout
   { "type": "CREATE_FRAME", "ref": "card", "props": {
     "name": "Card", "width": 360, "height": 200,
     "layoutMode": "VERTICAL", "itemSpacing": 12,
     "paddingTop": 16, "paddingRight": 16, "paddingBottom": 16, "paddingLeft": 16,
     "primaryAxisSizingMode": "AUTO", "counterAxisSizingMode": "FIXED",
     "primaryAxisAlignItems": "MIN", "counterAxisAlignItems": "MIN",
     "fills": [{"type": "SOLID", "color": {"r": 1, "g": 1, "b": 1}}],
     "cornerRadius": 12, "clipsContent": true
   }}

2. CREATE_RECTANGLE — Retângulo, divider, background
   { "type": "CREATE_RECTANGLE", "ref": "divider", "parentRef": "card", "props": {
     "name": "Divider", "width": 360, "height": 1,
     "fills": [{"type": "SOLID", "color": {"r": 0.9, "g": 0.9, "b": 0.9}}],
     "layoutSizingHorizontal": "FILL"
   }}

3. CREATE_ELLIPSE — Círculo, avatar, dot
   { "type": "CREATE_ELLIPSE", "ref": "avatar", "parentRef": "header", "props": {
     "name": "Avatar", "width": 40, "height": 40,
     "fills": [{"type": "SOLID", "color": {"r": 0.85, "g": 0.85, "b": 0.9}}]
   }}

4. CREATE_TEXT — Texto com tipografia completa
   { "type": "CREATE_TEXT", "parentRef": "card", "props": {
     "name": "Title", "content": "Hello World",
     "fontFamily": "Inter", "fontStyle": "Semi Bold", "fontSize": 18,
     "fills": [{"type": "SOLID", "color": {"r": 0.07, "g": 0.07, "b": 0.07}}],
     "textAutoResize": "WIDTH_AND_HEIGHT",
     "layoutSizingHorizontal": "FILL"
   }}

5. CREATE_COMPONENT_INSTANCE — Instanciar componente existente
   { "type": "CREATE_COMPONENT_INSTANCE", "parentNodeId": "<existingFrameId>", "componentKey": "abc123", "name": "Button" }

   ── Exemplo: adicionar dentro de frame SELECIONADO (id "123:4") ──
   { "type": "CREATE_TEXT", "parentNodeId": "123:4", "props": {
     "name": "Label", "content": "Olá", "fontFamily": "Inter", "fontStyle": "Regular", "fontSize": 16,
     "fills": [{"type": "SOLID", "color": {"r": 0.07, "g": 0.07, "b": 0.07}}],
     "textAutoResize": "WIDTH_AND_HEIGHT"
   }}

EDIÇÃO DE NÓS EXISTENTES (usar nodeId de elemento selecionado):
6.  SET_FILL — { "type": "SET_FILL", "nodeId": "...", "fills": [{"type": "SOLID", "color": {"r": 0, "g": 0.5, "b": 1}}] }
7.  SET_STROKE — { "type": "SET_STROKE", "nodeId": "...", "strokes": [{"type": "SOLID", "color": {"r": 0, "g": 0, "b": 0}}], "strokeWeight": 1, "strokeAlign": "INSIDE" }
8.  SET_CORNER_RADIUS — { "type": "SET_CORNER_RADIUS", "nodeId": "...", "cornerRadius": 8, "cornerSmoothing": 0.6 }
9.  SET_EFFECTS — { "type": "SET_EFFECTS", "nodeId": "...", "effects": [{"type": "DROP_SHADOW", "color": {"r":0,"g":0,"b":0,"a":0.12}, "offset": {"x":0,"y":4}, "radius": 16, "spread": 0}] }
10. SET_AUTO_LAYOUT — { "type": "SET_AUTO_LAYOUT", "nodeId": "...", "layoutMode": "VERTICAL", "itemSpacing": 8, "paddingTop": 16, "paddingRight": 16, "paddingBottom": 16, "paddingLeft": 16 }
11. RESIZE — { "type": "RESIZE", "nodeId": "...", "width": 400, "height": 300 }
12. MOVE — { "type": "MOVE", "nodeId": "...", "x": 100, "y": 200 }
13. RENAME — { "type": "RENAME", "nodeId": "...", "name": "Novo Nome" }
14. SET_TEXT_CONTENT — { "type": "SET_TEXT_CONTENT", "nodeId": "...", "content": "Novo texto", "fontSize": 14, "fontFamily": "Inter", "fontStyle": "Regular" }
15. SET_OPACITY — { "type": "SET_OPACITY", "nodeId": "...", "opacity": 0.5 }

TOKENS / VARIABLES:
16. APPLY_VARIABLE — { "type": "APPLY_VARIABLE", "nodeId": "...", "variableId": "...", "field": "fills" }
17. APPLY_STYLE — { "type": "APPLY_STYLE", "nodeId": "...", "styleId": "...", "styleType": "FILL" }

ESTRUTURA:
18. GROUP_NODES — { "type": "GROUP_NODES", "nodeIds": ["..."], "name": "Group" }
19. UNGROUP — { "type": "UNGROUP", "nodeId": "..." }
20. DETACH_INSTANCE — { "type": "DETACH_INSTANCE", "nodeId": "..." }
21. DELETE_NODE — { "type": "DELETE_NODE", "nodeId": "..." }

═══ REGRAS DE OURO ═══

1. SEMPRE use auto-layout (layoutMode: "VERTICAL" ou "HORIZONTAL") nos frames container. NUNCA posicione filhos com x/y dentro de auto-layout.
2. Use "ref"/"parentRef" para hierarquia. O frame root tem "ref", filhos referenciam com "parentRef".
3. Cores são RGB normalizado 0-1. Vermelho = {"r":1,"g":0,"b":0}. Branco = {"r":1,"g":1,"b":1}. Preto = {"r":0,"g":0,"b":0}.
4. Se o usuário tiver cores de marca, USE-AS com prioridade.
5. Se existirem variáveis de cor no arquivo, prefira APPLY_VARIABLE ao invés de cores hardcoded.
6. Para textos dentro de auto-layout: layoutSizingHorizontal "FILL" para expandir, textAutoResize "WIDTH_AND_HEIGHT" ou "HEIGHT" para ajustar.
7. Nomeie layers semanticamente: "Card/Header", "Button/Primary", "Icon/Close".
8. Retorne SOMENTE o JSON array. SEM texto, SEM markdown, SEM explicações.
9. Se não puder executar o pedido, retorne [].
10. Use cornerSmoothing: 0.6 para smooth corners estilo iOS.
11. Para sombras sutis: DROP_SHADOW com alpha 0.08-0.15, offset y:2-8, radius 8-24.
16. ⭐ REGRA SOBRE CONTEXTO DE SELEÇÃO:
    - O usuário tem UM frame selecionado e pede para adicionar algo → use "parentNodeId": "<id do frame selecionado>"
    - O usuário pede um design novo do zero → crie o frame root sem parentNodeId (vai para a página)
    - "parentRef" é SOMENTE para apontar para um nó criado NESTA resposta (via "ref")
    - Misturar parentRef e parentNodeId no mesmo nó é erro: use UM dos dois.
17. Para editar texto: use nodeId de um nó TEXT. Se a seleção for um FRAME ou GROUP com filhos TEXT, use o id do filho (ex: "T Message"), NUNCA do frame. SET_TEXT_CONTENT só funciona em TEXT.
18. Para criação: sempre comece com o frame/container root e adicione filhos na ORDEM com parentRef.
19. FontStyle válidos: "Regular", "Medium", "Semi Bold", "Bold", "Light", "Thin", "Extra Bold", "Black", "Italic".

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

// POST /plugin - Generate design operations from natural language
router.post('/', async (req: Request, res: Response) => {
  try {
    const {
      command,
      selectedElements = [],
      selectedLogo,
      selectedBrandFont,
      selectedBrandColors,
      availableComponents = [],
      availableColorVariables = [],
      availableFontVariables = [],
      apiKey: userApiKey
    } = req.body as PluginRequest;

    if (!command) {
      return res.status(400).json({ error: 'Command is required' });
    }

    // BYOK: use user's key if provided, else fall back to server key
    const effectiveKey = userApiKey || process.env.GEMINI_API_KEY || '';
    if (!effectiveKey) {
      return res.status(400).json({ error: 'No API key configured. Please add your Gemini API key in plugin settings.' });
    }

    const genAIInstance = new GoogleGenerativeAI(effectiveKey);

    // Build context-aware prompt
    const systemPrompt = buildSystemPrompt({
      command,
      selectedElements,
      selectedLogo,
      selectedBrandFont,
      selectedBrandColors,
      availableComponents,
      availableColorVariables,
      availableFontVariables,
    });

    const userPrompt = `═══ PEDIDO DO USUÁRIO ═══\n\n"${command}"`;

    // Call Gemini API with JSON output mode
    const model = genAIInstance.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.2,
      },
      systemInstruction: systemPrompt,
    });

    const result = await model.generateContent(userPrompt);
    const responseText = result.response.text();

    console.log('[Plugin API] AI Response:', responseText.substring(0, 500));

    // Parse the response - extract JSON array
    let operations: any[] = [];
    try {
      const parsed = JSON.parse(responseText);
      // Handle both direct array and wrapped object
      if (Array.isArray(parsed)) {
        operations = parsed;
      } else if (parsed.operations && Array.isArray(parsed.operations)) {
        operations = parsed.operations;
      } else {
        // Try to extract JSON array from the response
        const jsonMatch = responseText.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          operations = JSON.parse(jsonMatch[0]);
        }
      }
    } catch (parseError) {
      console.error('[Plugin API] Failed to parse AI response:', responseText.substring(0, 200));
      // Try regex fallback
      try {
        const jsonMatch = responseText.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          operations = JSON.parse(jsonMatch[0]);
        }
      } catch (_e) {
        operations = [];
      }
    }

    // Validate it's an array
    if (!Array.isArray(operations)) {
      operations = [];
    }

    // Validate operations have required fields
    operations = operations.filter(op =>
      op && op.type && (
        op.nodeId || op.props || op.componentKey ||
        op.nodeIds || op.fills || op.strokes ||
        op.effects || op.layoutMode || op.variableId ||
        op.styleId || op.content || op.name ||
        op.width != null || op.opacity != null ||
        op.cornerRadius != null || op.x != null
      )
    );

    console.log(`[Plugin API] Generated ${operations.length} operation(s) for: "${command.substring(0, 60)}"`);

    // Return operations to apply
    res.json({
      success: true,
      operations,
      message: `Generated ${operations.length} operation(s)`
    });
  } catch (error: any) {
    console.error('[Plugin API] Route error:', error);
    res.status(500).json({
      error: 'Failed to process command',
      message: error.message
    });
  }
});

export default router;
