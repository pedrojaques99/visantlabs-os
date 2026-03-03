import express, { Request, Response, NextFunction } from 'express';
import { chooseProvider } from '../lib/ai-providers/index.js';
import { getDb, connectToMongoDB } from '../db/mongodb.js';
import { pluginBridge } from '../lib/pluginBridge.js';
import { operationValidator } from '../lib/operationValidator.js';
import { AuthRequest } from '../middleware/auth.js';
import { JWT_SECRET } from '../utils/jwtSecret.js';
import jwt from 'jsonwebtoken';
import { ObjectId } from 'mongodb';
import WebSocket, { WebSocketServer } from 'ws';

const router = express.Router();

// ============ WebSocket Server (will be initialized in server/index.ts) ============

let wss: WebSocketServer | null = null;

/**
 * Initialize WebSocket server (call once from server/index.ts)
 */
export function initPluginWebSocket(server: any) {
  wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req: any, socket: any, head: any) => {
    if (req.url?.startsWith('/api/plugin/ws')) {
      wss!.handleUpgrade(req, socket, head, (ws: any) => {
        handlePluginConnection(ws, req);
      });
    }
  });

  console.log('[PluginWS] WebSocket server initialized');
}

/**
 * Handle plugin WebSocket connection
 */
function handlePluginConnection(ws: WebSocket, req: any) {
  // Extract auth from query: ws://host/api/plugin/ws?token=XXX&fileId=YYY
  const url = new URL(req.url, `http://${req.headers.host}`);
  const token = url.searchParams.get('token');
  const fileId = url.searchParams.get('fileId');

  // Validate auth
  const userId = validatePluginToken(token);
  if (!userId || !fileId) {
    ws.close(4001, 'Unauthorized');
    console.warn('[PluginWS] Connection rejected: invalid token or fileId');
    return;
  }

  // Register session
  const session = pluginBridge.register(fileId, ws, userId);
  console.log(`[PluginWS] Connected: fileId=${fileId}, userId=${userId}`);

  // Handle messages from plugin
  ws.on('message', (data: any) => {
    try {
      const message = JSON.parse(data.toString());
      handlePluginMessage(fileId, message);
    } catch (err) {
      console.error('[PluginWS] Invalid JSON from plugin:', err);
      ws.send(
        JSON.stringify({
          type: 'ERROR',
          error: 'Invalid JSON',
        }),
      );
    }
  });

  // Handle disconnect
  ws.on('close', () => {
    pluginBridge.unregister(fileId);
    console.log(`[PluginWS] Disconnected: fileId=${fileId}`);
  });

  // Handle errors
  ws.on('error', (err: any) => {
    console.error(`[PluginWS] Error (fileId=${fileId}):`, err.message);
    pluginBridge.unregister(fileId);
  });

  // Send init message
  ws.send(
    JSON.stringify({
      type: 'PLUGIN_READY',
      fileId,
    }),
  );
}

/**
 * Handle messages from plugin (ACKs, selection changes, etc.)
 */
function handlePluginMessage(fileId: string, message: any) {
  const { type } = message;

  switch (type) {
    case 'OPERATION_ACK':
    case 'OPERATION_ERROR':
      // Forward to pluginBridge for ACK tracking
      pluginBridge.onMessage(fileId, message);
      break;

    case 'SELECTION_CHANGED':
      // User selection changed
      pluginBridge.onMessage(fileId, message);
      break;

    default:
      console.warn(`[PluginWS] Unknown message type: ${type}`);
  }
}

/**
 * Validate plugin token — real JWT verification using same secret as auth.ts
 */
function validatePluginToken(token: string | null): string | null {
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; email: string };
    return decoded.userId;
  } catch (_e) {
    return null;
  }
}

/**
 * Optional auth middleware — populates userId if valid token, but doesn't block.
 * Allows BYOK users without accounts to still use the plugin.
 */
function optionalAuth(req: AuthRequest, _res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace('Bearer ', '') || req.body?.authToken;
  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; email: string };
      req.userId = decoded.userId;
      req.userEmail = decoded.email;
    } catch (_e) {
      // Invalid token — continue without auth
    }
  }
  next();
}

const FREE_GENERATIONS_LIMIT = 4;

/**
 * Check if user can generate (reuses same logic as /payments/usage)
 */
async function checkCredits(userId: string): Promise<{ canGenerate: boolean; reason?: string; isByok?: boolean }> {
  try {
    await connectToMongoDB();
    const db = getDb();
    const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });
    if (!user) return { canGenerate: false, reason: 'Usuário não encontrado' };

    const hasActiveSubscription = user.subscriptionStatus === 'active';
    const freeGenerationsUsed = user.freeGenerationsUsed || 0;
    const monthlyCredits = user.monthlyCredits || 20;
    const creditsUsed = user.creditsUsed || 0;
    const creditsRemaining = Math.max(0, monthlyCredits - creditsUsed);
    const totalCreditsEarned = user.totalCreditsEarned ?? 0;
    const totalCredits = totalCreditsEarned + creditsRemaining;

    const canGenerate = hasActiveSubscription
      ? totalCredits > 0
      : (freeGenerationsUsed < FREE_GENERATIONS_LIMIT && totalCredits > 0);

    if (!canGenerate) {
      return {
        canGenerate: false,
        reason: hasActiveSubscription
          ? 'Créditos esgotados. Aguarde a renovação ou compre mais.'
          : `Limite gratuito atingido (${FREE_GENERATIONS_LIMIT} gerações). Assine para continuar.`,
      };
    }
    return { canGenerate: true };
  } catch (_e) {
    // If credit check fails, allow (fail-open for BYOK users)
    return { canGenerate: true };
  }
}

/**
 * Deduct one credit after successful operation (reuses same fields as payments)
 */
async function deductCredit(userId: string): Promise<void> {
  try {
    await connectToMongoDB();
    const db = getDb();
    const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });
    if (!user) return;

    const hasActiveSubscription = user.subscriptionStatus === 'active';
    if (hasActiveSubscription) {
      await db.collection('users').updateOne(
        { _id: new ObjectId(userId) },
        { $inc: { creditsUsed: 1 } }
      );
    } else {
      await db.collection('users').updateOne(
        { _id: new ObjectId(userId) },
        { $inc: { freeGenerationsUsed: 1 } }
      );
    }
  } catch (_e) {
    console.error('[Plugin] Failed to deduct credit:', _e);
  }
}

interface PluginRequest {
  command: string;
  sessionId?: string;
  selectedElements: any[];
  selectedLogo?: { id: string; name: string; key?: string };
  selectedBrandFont?: { id: string; name: string };
  selectedBrandColors?: Array<{ name: string; value: string }>;
  availableComponents?: any[];
  availableColorVariables?: Array<{ id: string; name: string; value?: string }>;
  availableFontVariables?: any[];
  availableLayers?: Array<{ id: string; name: string; type: string }>;
  fileId?: string;
  apiKey?: string;         // Gemini BYOK
  anthropicApiKey?: string; // Anthropic/Claude BYOK
}

function buildSystemPrompt(req: PluginRequest, chatHistory?: string): string {
  const logoInfo = req.selectedLogo
    ? `${req.selectedLogo.name} (key: "${req.selectedLogo.key || req.selectedLogo.id}")`
    : 'Nenhum selecionado';

  const fontInfo = req.selectedBrandFont
    ? `${req.selectedBrandFont.name} (ID: "${req.selectedBrandFont.id}")`
    : 'Nenhuma selecionada';

  const brandColorsInfo = req.selectedBrandColors?.length
    ? req.selectedBrandColors.map(c => `${c.name}: ${c.value}`).join(', ')
    : 'Nenhuma selecionada';

  const rgbToHex = (c: any): string => {
    if (!c || typeof c.r !== 'number') return '?';
    const r = Math.round(c.r * 255), g = Math.round(c.g * 255), b = Math.round(c.b * 255);
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  };

  const flattenWithIds = (nodes: any[], depth = 0): string[] => {
    const lines: string[] = [];
    for (const n of nodes) {
      const indent = '  '.repeat(depth);
      const parts: string[] = [`${indent}• "${n.name}" (type: ${n.type}, id: "${n.id}"`];

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
  };

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

  return `Você é um assistente expert de design Figma. Você ajuda o usuário responder a perguntas, criar novos designs e editar designs existentes.
Se o usuário fizer apenas uma pergunta ou bater papo (ex: "Oi tudo bem?", "Como faço X?"), você DEVE usar a operação especial \`MESSAGE\` para responder de modo texto.
Para responder com texto e operações contextuais, combine operações de design com uma operação \`MESSAGE\`.
SEM texto solto fora do array. Responda SOMENTE e APENAS com um arquivo JSON puro, contendo um array de operações.
Exemplo de bate-papo:
[
  { "type": "MESSAGE", "content": "Olá! Tudo bem? Estou pronto para ajudar você a desenhar no Figma." }
]

${chatHistory ? `═══ HISTÓRICO DE CONVERSA ═══\n${chatHistory}\n` : ''}
═══ CONTEXTO DO ARQUIVO ═══

BRAND GUIDELINES DO USUÁRIO:
- Logo: ${logoInfo}
- Fonte de marca: ${fontInfo}
- Cores de marca: ${brandColorsInfo}

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

═══ OPERAÇÕES DISPONÍVEIS ═══

CRIAÇÃO — dois modos de especificar o pai:
  • "parentRef": "refName"  → pai é outro nó criado NESTA MESMA resposta (via "ref")
  • "parentNodeId": "<id>"  → pai é um nó JÁ EXISTENTE no Figma (ex: frame selecionado)
  ⚠️  REGRA CRÍTICA: se o usuário quer adicionar algo DENTRO de um elemento selecionado,
      use "parentNodeId" com o id desse elemento. SEM parentNodeId → o nó vai para a página.

0. MESSAGE — Resposta em texto para bate-papo, explicação ou dúvidas
   { "type": "MESSAGE", "content": "Texto da resposta" }

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
20. GRADIENTES (FASE 2): Use gradientStops com positions 0-1. Transform padrão linear: [[1,0,0],[0,1,0]]. Diagonal: [[0.7,0.7,-0.1],[-0.7,0.7,0.5]].
21. IMAGENS (FASE 2): Use SET_IMAGE_FILL com URLs (unsplash.com, picsum.photos). Para cards com foto: crie RECTANGLE, aplique SET_IMAGE_FILL.
22. COMPONENTES (FASE 2): Use CREATE_COMPONENT para reutilizáveis. Variants via COMBINE_AS_VARIANTS com naming "Property=Value".
23. SVG (FASE 2): Use CREATE_SVG para ícones simples. Gere SVG inline com viewBox correto. Preferir componentes da library quando disponíveis.
24. RICH TEXT (FASE 2): Para formatação mista, use CREATE_TEXT seguido de SET_TEXT_RANGES com ranges de caracteres.
25. CONSTRAINTS (FASE 2): Em frames sem auto-layout, sempre setar constraints. Buttons: horizontal STRETCH, vertical MIN.
26. MEMÓRIA (FASE 3): Consulte o histórico de conversa. Se o user referencia algo que criamos antes, use os nodeIds do histórico.

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

// ============ NEW: Agent Command Endpoint ============

/**
 * POST /api/plugin/agent-command
 * Called by MCP server or external agents to push operations to plugin
 */
router.post('/agent-command', async (req: Request, res: Response) => {
  try {
    const { fileId, operations } = req.body;

    // Validate input
    if (!fileId) {
      return res.status(400).json({ error: 'Missing fileId' });
    }

    if (!Array.isArray(operations) || operations.length === 0) {
      return res.status(400).json({ error: 'Missing or empty operations array' });
    }

    // Validate operations
    const validation = operationValidator.validateBatch(operations);

    if (validation.invalid.length > 0) {
      return res.status(400).json({
        error: 'Operation validation failed',
        invalid: validation.invalid.map((inv) => ({
          type: inv.op.type,
          errors: inv.errors,
        })),
      });
    }

    // Push to plugin
    const result = await pluginBridge.push(fileId, validation.valid);

    if (!result.success) {
      return res.status(500).json({
        error: 'Plugin did not acknowledge operations',
        errors: result.errors,
      });
    }

    res.json({
      success: true,
      appliedCount: result.appliedCount,
    });
  } catch (err) {
    console.error('[Plugin Agent] Error:', err);
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Unknown error',
    });
  }
});

// ============ Debug Endpoint (Development Only) ============

/**
 * GET /api/plugin/debug/sessions
 * Returns active plugin sessions (development only)
 */
router.get('/debug/sessions', (req: Request, res: Response) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'Not available in production' });
  }

  const sessions = pluginBridge.getSessions();
  res.json({ sessions, count: sessions.length });
});

// ============ Documentation Route ============

/**
 * GET /api/plugin/docs
 * Returns HTML documentation for the Figma plugin
 */
router.get('/docs', (req: Request, res: Response) => {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Visant Labs Figma Plugin - Documentation</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      padding: 20px;
    }

    .container {
      max-width: 1200px;
      margin: 0 auto;
      background: white;
      border-radius: 12px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      overflow: hidden;
    }

    header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 40px 30px;
      text-align: center;
    }

    header h1 {
      font-size: 2.5em;
      margin-bottom: 10px;
    }

    header p {
      font-size: 1.2em;
      opacity: 0.9;
    }

    nav {
      display: flex;
      flex-wrap: wrap;
      gap: 20px;
      padding: 20px 30px;
      background: #f8f9fa;
      border-bottom: 1px solid #e0e0e0;
      justify-content: center;
    }

    nav a {
      color: #667eea;
      text-decoration: none;
      font-weight: 500;
      padding: 8px 15px;
      border-radius: 6px;
      transition: all 0.3s ease;
    }

    nav a:hover {
      background: #667eea;
      color: white;
    }

    .content {
      padding: 30px;
    }

    section {
      margin-bottom: 40px;
      display: none;
    }

    section.active {
      display: block;
    }

    h2 {
      color: #667eea;
      margin-bottom: 20px;
      font-size: 2em;
      border-bottom: 3px solid #667eea;
      padding-bottom: 10px;
    }

    h3 {
      color: #764ba2;
      margin-top: 20px;
      margin-bottom: 10px;
      font-size: 1.3em;
    }

    .feature-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 20px;
      margin: 20px 0;
    }

    .feature-card {
      border: 2px solid #e0e0e0;
      border-radius: 8px;
      padding: 20px;
      transition: all 0.3s ease;
    }

    .feature-card:hover {
      border-color: #667eea;
      box-shadow: 0 8px 16px rgba(102, 126, 234, 0.1);
    }

    .feature-card h4 {
      color: #667eea;
      margin-bottom: 10px;
    }

    .code-block {
      background: #f5f5f5;
      border: 1px solid #ddd;
      border-radius: 8px;
      padding: 15px;
      margin: 15px 0;
      overflow-x: auto;
      font-family: 'Monaco', 'Courier New', monospace;
      font-size: 0.9em;
      line-height: 1.5;
    }

    .command-block {
      background: #1e1e1e;
      color: #d4d4d4;
      border-radius: 8px;
      padding: 15px;
      margin: 15px 0;
      overflow-x: auto;
      font-family: 'Monaco', 'Courier New', monospace;
      font-size: 0.9em;
      line-height: 1.5;
    }

    .command-block code {
      color: #ce9178;
    }

    .info-box {
      background: #e3f2fd;
      border-left: 4px solid #2196F3;
      padding: 15px;
      margin: 15px 0;
      border-radius: 4px;
    }

    .success-box {
      background: #e8f5e9;
      border-left: 4px solid #4caf50;
      padding: 15px;
      margin: 15px 0;
      border-radius: 4px;
    }

    .warning-box {
      background: #fff3e0;
      border-left: 4px solid #ff9800;
      padding: 15px;
      margin: 15px 0;
      border-radius: 4px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
    }

    table th {
      background: #667eea;
      color: white;
      padding: 12px;
      text-align: left;
    }

    table td {
      padding: 12px;
      border-bottom: 1px solid #e0e0e0;
    }

    table tr:hover {
      background: #f5f5f5;
    }

    .tool-list {
      list-style: none;
      padding: 0;
    }

    .tool-list li {
      padding: 10px 0;
      border-bottom: 1px solid #e0e0e0;
    }

    .tool-list strong {
      color: #667eea;
    }

    .step-number {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      background: #667eea;
      color: white;
      border-radius: 50%;
      font-weight: bold;
      margin-right: 10px;
    }

    footer {
      text-align: center;
      padding: 20px;
      background: #f8f9fa;
      border-top: 1px solid #e0e0e0;
      color: #666;
      font-size: 0.9em;
    }

    .btn-group {
      display: flex;
      gap: 10px;
      margin: 20px 0;
      flex-wrap: wrap;
    }

    .btn {
      padding: 10px 20px;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-weight: 500;
      transition: all 0.3s ease;
      text-decoration: none;
      display: inline-block;
    }

    .btn-primary {
      background: #667eea;
      color: white;
    }

    .btn-primary:hover {
      background: #764ba2;
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
    }

    .btn-secondary {
      background: #e0e0e0;
      color: #333;
    }

    .btn-secondary:hover {
      background: #d0d0d0;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>🎨 Visant Labs Figma Plugin</h1>
      <p>AI-Powered Design Assistant with Agent Support</p>
    </header>

    <nav>
      <a href="#" onclick="showSection('overview'); return false;">📋 Overview</a>
      <a href="#" onclick="showSection('setup'); return false;">⚙️ Setup & Installation</a>
      <a href="#" onclick="showSection('usage'); return false;">🚀 Quick Start</a>
      <a href="#" onclick="showSection('mcp'); return false;">🔧 MCP Integration</a>
      <a href="#" onclick="showSection('tools'); return false;">🛠️ Available Tools</a>
      <a href="#" onclick="showSection('http'); return false;">📡 HTTP API</a>
      <a href="#" onclick="showSection('troubleshoot'); return false;">🔍 Troubleshooting</a>
    </nav>

    <div class="content">
      <!-- Overview Section -->
      <section id="overview" class="active">
        <h2>📋 Plugin Overview</h2>

        <p>The Visant Labs Figma Plugin is an AI-powered design assistant that helps you create and modify designs using natural language commands. It supports both human UI interaction and agent-based automation via MCP (Model Context Protocol).</p>

        <h3>Key Features</h3>
        <div class="feature-grid">
          <div class="feature-card">
            <h4>🤖 AI-Powered</h4>
            <p>Create designs using natural language. Just describe what you want and the plugin generates it.</p>
          </div>
          <div class="feature-card">
            <h4>🔌 Agent Support</h4>
            <p>External agents (Claude, Cursor) can control Figma operations via MCP or HTTP API.</p>
          </div>
          <div class="feature-card">
            <h4>⚡ Real-Time</h4>
            <p>WebSocket-based communication ensures operations apply instantly without polling.</p>
          </div>
          <div class="feature-card">
            <h4>37+ Operations</h4>
            <p>Create frames, shapes, text, components, and apply styles - all via simple operations.</p>
          </div>
          <div class="feature-card">
            <h4>🎨 Brand Guidelines</h4>
            <p>Store and apply brand colors, fonts, and logos automatically.</p>
          </div>
          <div class="feature-card">
            <h4>💾 Chat Memory</h4>
            <p>Sessions remember your design requests and maintain context across conversations.</p>
          </div>
        </div>

        <h3>Architecture</h3>
        <div class="info-box">
          <strong>Three ways to interact:</strong>
          <ul style="margin-left: 20px; margin-top: 10px;">
            <li><strong>Manual UI:</strong> Use the plugin panel in Figma (today's experience)</li>
            <li><strong>HTTP API:</strong> Send operations from any HTTP client or server</li>
            <li><strong>MCP Server:</strong> Connect external agents like Claude or Cursor</li>
          </ul>
        </div>
      </section>

      <!-- Setup Section -->
      <section id="setup">
        <h2>⚙️ Setup & Installation</h2>

        <h3>Prerequisites</h3>
        <ul style="margin-left: 20px;">
          <li>Node.js 18+ and npm</li>
          <li>Figma account with plugin access</li>
          <li>Git (for cloning the repo)</li>
        </ul>

        <h3>Step 1: Clone & Install</h3>
        <div class="command-block">
<code>git clone https://github.com/pedrojaques99/visantlabs-os.git
cd visantlabs-os
npm install</code>
        </div>

        <h3>Step 2: Configure Environment</h3>
        <div class="command-block">
<code>cp .env.example .env.local
# Edit .env.local and set:
# - MONGODB_URI (for chat history)
# - ANTHROPIC_API_KEY or GOOGLE_API_KEY (for AI)</code>
        </div>

        <h3>Step 3: Run Development Stack</h3>
        <p>Open 2-3 terminals:</p>

        <p><strong>Terminal 1: Frontend + Figma Plugin</strong></p>
        <div class="command-block">
<code>npm run dev</code>
        </div>

        <p><strong>Terminal 2: Backend Server</strong></p>
        <div class="command-block">
<code>npm run dev:server</code>
        </div>

        <p><strong>Terminal 3: MCP Server (Optional)</strong></p>
        <div class="command-block">
<code>npm run mcp:figma</code>
        </div>

        <h3>Step 4: Load Plugin in Figma</h3>
        <ol>
          <li>Open Figma</li>
          <li>Menu → Plugins → Development → Import plugin from manifest</li>
          <li>Select: <code>visantlabs-os/plugin/manifest.json</code></li>
          <li>Plugin appears in your plugins menu</li>
        </ol>

        <div class="success-box">
          ✅ <strong>Success!</strong> The plugin is now running and ready to use.
        </div>
      </section>

      <!-- Usage Section -->
      <section id="usage">
        <h2>🚀 Quick Start</h2>

        <h3>Method 1: Manual UI (Current Experience)</h3>
        <ol>
          <li>Open Figma and load the plugin (right panel)</li>
          <li>Type a design request: "Create a card with avatar and description"</li>
          <li>Click <strong>Send</strong> or press Enter</li>
          <li>Watch as the design is created on your canvas</li>
        </ol>

        <div class="info-box">
          <strong>Pro Tips:</strong>
          <ul style="margin-left: 20px; margin-top: 10px;">
            <li>Be specific: "Create a blue 200×200 button" works better than "make something blue"</li>
            <li>Reference existing elements: "Make the selected frame's background light gray"</li>
            <li>Use brand guidelines: Set your logo and colors in Settings → Brand</li>
          </ul>
        </div>

        <h3>Method 2: HTTP API</h3>
        <p>Send operations from any HTTP client:</p>

        <div class="command-block">
<code>curl -X POST http://localhost:3001/api/plugin/agent-command \\
  -H "Content-Type: application/json" \\
  -d '{
    "fileId": "12345:67890",
    "operations": [{
      "type": "CREATE_RECTANGLE",
      "props": {
        "name": "Red Box",
        "width": 100,
        "height": 100,
        "fills": [{
          "type": "SOLID",
          "color": {"r": 1, "g": 0, "b": 0}
        }]
      }
    }]
  }'</code>
        </div>

        <p><strong>Response:</strong></p>
        <div class="code-block">
{
  "success": true,
  "appliedCount": 1
}
        </div>

        <h3>Method 3: Via MCP (Claude Desktop)</h3>
        <p>Connect external agents to control Figma:</p>

        <ol>
          <li>Update <code>~/.config/Claude/claude_desktop_config.json</code>:</li>
        </ol>

        <div class="code-block">
{
  "mcpServers": {
    "figma": {
      "command": "npm",
      "args": ["run", "mcp:figma"],
      "cwd": "/path/to/visantlabs-os"
    }
  }
}
        </div>

        <ol start="2">
          <li>Restart Claude Desktop</li>
          <li>Ask Claude: <em>"Create a 1440×900 frame with a dark background"</em></li>
          <li>The frame appears instantly in your Figma file</li>
        </ol>

        <div class="success-box">
          ✅ <strong>That's it!</strong> You can now use Claude to design in Figma.
        </div>
      </section>

      <!-- MCP Section -->
      <section id="mcp">
        <h2>🔧 MCP Integration</h2>

        <div class="info-box">
          <strong>What is MCP?</strong> The Model Context Protocol allows AI agents to control applications through a standard interface. Think of it as "AI can call functions in your app."
        </div>

        <h3>Available MCP Tools</h3>
        <table>
          <thead>
            <tr>
              <th>Tool</th>
              <th>Description</th>
              <th>Parameters</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>get_selection</strong></td>
              <td>Get currently selected nodes</td>
              <td>fileId</td>
            </tr>
            <tr>
              <td><strong>create_frame</strong></td>
              <td>Create a new frame</td>
              <td>fileId, name, width, height, backgroundColor</td>
            </tr>
            <tr>
              <td><strong>create_rectangle</strong></td>
              <td>Create a rectangle shape</td>
              <td>fileId, name, width, height, fill</td>
            </tr>
            <tr>
              <td><strong>create_text</strong></td>
              <td>Create text element</td>
              <td>fileId, text, name, fontSize, fontFamily</td>
            </tr>
            <tr>
              <td><strong>set_fill</strong></td>
              <td>Change fill color</td>
              <td>fileId, nodeId, fill</td>
            </tr>
            <tr>
              <td><strong>rename_node</strong></td>
              <td>Rename a node</td>
              <td>fileId, nodeId, name</td>
            </tr>
            <tr>
              <td><strong>delete_node</strong></td>
              <td>Delete a node</td>
              <td>fileId, nodeId</td>
            </tr>
            <tr>
              <td><strong>chat</strong></td>
              <td>Natural language commands</td>
              <td>fileId, message</td>
            </tr>
          </tbody>
        </table>

        <h3>Setup Steps</h3>

        <h4><span class="step-number">1</span> Start the MCP Server</h4>
        <div class="command-block">
<code>npm run mcp:figma</code>
        </div>

        <h4><span class="step-number">2</span> Configure Your Agent</h4>
        <p><strong>For Claude Desktop:</strong></p>
        <div class="code-block">
{
  "mcpServers": {
    "figma": {
      "command": "npm",
      "args": ["run", "mcp:figma"],
      "cwd": "/path/to/visantlabs-os"
    }
  }
}
        </div>

        <p><strong>For Cursor:</strong></p>
        <div class="code-block">
1. Settings → Features → MCP
2. Add MCP server with same config
3. Restart Cursor
        </div>

        <h4><span class="step-number">3</span> Test Connection</h4>
        <p>Ask your agent: <em>"What Figma tools are available?"</em></p>
        <p>It should list all 8 MCP tools.</p>

        <h3>Example: Agent Workflow</h3>
        <div class="code-block">
<code>User: "Create a marketing card design"

Agent:
1. Calls create_frame("Hero Card", 1440, 900)
2. Calls create_rectangle(inside frame, "background", fill: blue)
3. Calls create_text("Headline", "Transform Your Design")
4. Calls create_text("Description", "With AI-powered automation")
5. Calls set_fill(description, light gray)

Result: Entire card design created in Figma instantly</code>
        </div>
      </section>

      <!-- Tools Section -->
      <section id="tools">
        <h2>🛠️ Available Tools</h2>

        <h3>Creation Tools</h3>

        <div style="margin: 20px 0;">
          <h4>🖼️ create_frame</h4>
          <p>Create a new frame (container for design elements)</p>
          <div class="code-block">
{
  "fileId": "12345:67890",
  "name": "Hero Section",
  "width": 1440,
  "height": 900,
  "backgroundColor": "#FFFFFF"
}
          </div>
        </div>

        <div style="margin: 20px 0;">
          <h4>⬜ create_rectangle</h4>
          <p>Create a rectangle shape</p>
          <div class="code-block">
{
  "fileId": "12345:67890",
  "name": "Button",
  "width": 200,
  "height": 50,
  "fill": "#667EEA"
}
          </div>
        </div>

        <div style="margin: 20px 0;">
          <h4>📝 create_text</h4>
          <p>Create a text element</p>
          <div class="code-block">
{
  "fileId": "12345:67890",
  "text": "Hello World",
  "name": "Title",
  "fontSize": 32,
  "fontFamily": "Inter"
}
          </div>
        </div>

        <h3>Editing Tools</h3>

        <div style="margin: 20px 0;">
          <h4>🎨 set_fill</h4>
          <p>Change the fill color of a node</p>
          <div class="code-block">
{
  "fileId": "12345:67890",
  "nodeId": "123:456",
  "fill": "#FF5733"
}
          </div>
        </div>

        <div style="margin: 20px 0;">
          <h4>✏️ rename_node</h4>
          <p>Rename a design element</p>
          <div class="code-block">
{
  "fileId": "12345:67890",
  "nodeId": "123:456",
  "name": "Primary Button"
}
          </div>
        </div>

        <div style="margin: 20px 0;">
          <h4>🗑️ delete_node</h4>
          <p>Delete a design element</p>
          <div class="code-block">
{
  "fileId": "12345:67890",
  "nodeId": "123:456"
}
          </div>
        </div>

        <h3>Advanced Tools</h3>

        <div style="margin: 20px 0;">
          <h4>💬 chat</h4>
          <p>Send natural language commands</p>
          <div class="code-block">
{
  "fileId": "12345:67890",
  "message": "Create a card with avatar, name, and description"
}
          </div>
        </div>

        <div style="margin: 20px 0;">
          <h4>👆 get_selection</h4>
          <p>Get information about selected elements</p>
          <div class="code-block">
{
  "fileId": "12345:67890"
}
          </div>
        </div>
      </section>

      <!-- HTTP API Section -->
      <section id="http">
        <h2>📡 HTTP API Reference</h2>

        <h3>Endpoints</h3>

        <h4>POST /api/plugin/agent-command</h4>
        <p><strong>Send design operations to the plugin</strong></p>

        <p><strong>Request:</strong></p>
        <div class="code-block">
{
  "fileId": "12345:67890",
  "operations": [
    {
      "type": "CREATE_RECTANGLE",
      "props": {
        "name": "Box",
        "width": 100,
        "height": 100,
        "fills": [{
          "type": "SOLID",
          "color": {"r": 1, "g": 0, "b": 0}
        }]
      }
    }
  ]
}
        </div>

        <p><strong>Response (Success):</strong></p>
        <div class="code-block">
{
  "success": true,
  "appliedCount": 1
}
        </div>

        <p><strong>Response (Error):</strong></p>
        <div class="code-block">
{
  "success": false,
  "appliedCount": 0,
  "errors": ["Plugin not connected for fileId: 12345:67890"]
}
        </div>

        <h4>GET /api/plugin/docs</h4>
        <p><strong>Get this documentation page</strong></p>

        <h4>GET /api/plugin/debug/sessions (Development Only)</h4>
        <p><strong>View active plugin sessions</strong></p>

        <p><strong>Response:</strong></p>
        <div class="code-block">
{
  "sessions": [
    {
      "fileId": "12345:67890",
      "userId": "plugin-user",
      "connectedAt": "2026-03-03T12:00:00.000Z",
      "queueSize": 0,
      "pendingAcks": 0
    }
  ],
  "count": 1
}
        </div>

        <h3>Status Codes</h3>
        <table>
          <tr>
            <th>Code</th>
            <th>Meaning</th>
            <th>Solution</th>
          </tr>
          <tr>
            <td>200</td>
            <td>Success</td>
            <td>Operations applied to Figma</td>
          </tr>
          <tr>
            <td>400</td>
            <td>Validation Error</td>
            <td>Check operation schema in response</td>
          </tr>
          <tr>
            <td>500</td>
            <td>Plugin Error</td>
            <td>Check server logs</td>
          </tr>
          <tr>
            <td>503</td>
            <td>Plugin Not Connected</td>
            <td>Make sure plugin is open in Figma</td>
          </tr>
        </table>

        <h3>Examples</h3>

        <p><strong>Create a blue rectangle:</strong></p>
        <div class="command-block">
<code>curl -X POST http://localhost:3001/api/plugin/agent-command \\
  -H "Content-Type: application/json" \\
  -d '{
    "fileId": "12345:67890",
    "operations": [{
      "type": "CREATE_RECTANGLE",
      "props": {
        "name": "Blue Box",
        "width": 200,
        "height": 200,
        "fills": [{
          "type": "SOLID",
          "color": {"r": 0, "g": 0, "b": 1}
        }]
      }
    }]
  }'</code>
        </div>

        <p><strong>Change a node's color:</strong></p>
        <div class="command-block">
<code>curl -X POST http://localhost:3001/api/plugin/agent-command \\
  -H "Content-Type: application/json" \\
  -d '{
    "fileId": "12345:67890",
    "operations": [{
      "type": "SET_FILL",
      "nodeId": "123:456",
      "fills": [{
        "type": "SOLID",
        "color": {"r": 1, "g": 0.5, "b": 0}
      }]
    }]
  }'</code>
        </div>
      </section>

      <!-- Troubleshooting Section -->
      <section id="troubleshoot">
        <h2>🔍 Troubleshooting</h2>

        <h3>Plugin Doesn't Connect to Server</h3>

        <div class="warning-box">
          <strong>Problem:</strong> WebSocket connection errors in console
        </div>

        <p><strong>Solutions:</strong></p>
        <ol style="margin-left: 20px;">
          <li>Make sure server is running: <code>npm run dev:server</code></li>
          <li>Check CORS settings in server/index.ts</li>
          <li>Verify port 3001 is not blocked by firewall</li>
          <li>Restart Figma and reload plugin</li>
        </ol>

        <h3>Operations Not Applying</h3>

        <div class="warning-box">
          <strong>Problem:</strong> API returns 200 but nothing changes in Figma
        </div>

        <p><strong>Solutions:</strong></p>
        <ol style="margin-left: 20px;">
          <li>Check plugin UI is open (not just loaded)</li>
          <li>Verify fileId matches actual open file</li>
          <li>Check browser console (F12) for errors</li>
          <li>Try a simple operation: <code>CREATE_RECTANGLE</code></li>
          <li>Check operation validation errors in response</li>
        </ol>

        <h3>Timeout Errors</h3>

        <div class="warning-box">
          <strong>Problem:</strong> "Operation timeout (10000ms)" errors
        </div>

        <p><strong>Solutions:</strong></p>
        <ol style="margin-left: 20px;">
          <li>Plugin UI might be frozen - refresh Figma</li>
          <li>Try smaller batches (5 ops instead of 50)</li>
          <li>Check Figma app responsiveness</li>
          <li>Increase timeout: <code>FIGMA_WS_OP_TIMEOUT=20000</code></li>
        </ol>

        <h3>MCP Tools Not Appearing</h3>

        <div class="warning-box">
          <strong>Problem:</strong> Claude/Cursor doesn't show Figma tools
        </div>

        <p><strong>Solutions:</strong></p>
        <ol style="margin-left: 20px;">
          <li>Verify MCP server is running: <code>npm run mcp:figma</code></li>
          <li>Check config file path (use absolute paths)</li>
          <li>Restart Claude Desktop / Cursor completely</li>
          <li>Check logs for MCP connection errors</li>
          <li>Verify Node.js and npm are in PATH</li>
        </ol>

        <h3>Get Help</h3>

        <div class="info-box">
          <p><strong>Check these resources:</strong></p>
          <ul style="margin-left: 20px; margin-top: 10px;">
            <li><a href="/plugin/docs" style="color: #667eea;">Full Documentation</a> (this page)</li>
            <li><code>/plugin/AGENT.md</code> - Agent integration guide</li>
            <li><code>docs/implementation_plan_v2.md</code> - Architecture details</li>
            <li>Server logs: <code>npm run dev:server 2>&1 | grep Plugin</code></li>
            <li>Browser console (F12) in Figma</li>
          </ul>
        </div>
      </section>
    </div>

    <footer>
      <p>Visant Labs Figma Plugin Documentation | Version 2.0.0 | <a href="/plugin/docs" style="color: #667eea;">Back to Docs</a></p>
      <p>For issues and feature requests: <a href="https://github.com/pedrojaques99/visantlabs-os" style="color: #667eea;">GitHub Repository</a></p>
    </footer>
  </div>

  <script>
    function showSection(sectionId) {
      // Hide all sections
      document.querySelectorAll('section').forEach(s => s.classList.remove('active'));

      // Show selected section
      const section = document.getElementById(sectionId);
      if (section) section.classList.add('active');

      // Update active nav link
      document.querySelectorAll('nav a').forEach(a => a.style.background = 'transparent');
      event.target.style.background = '#667eea';
      event.target.style.color = 'white';

      // Scroll to top
      window.scrollTo(0, 0);
    }
  </script>
</body>
</html>
  `;

  res.header('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});

// ============ Existing HTTP Polling Endpoint ============

// POST /plugin - Generate design operations from natural language (FASE 3: Multi-model + Chat Memory)
router.post('/', async (req: Request, res: Response) => {
  try {
    const {
      command,
      sessionId,
      fileId,
      selectedElements = [],
      selectedLogo,
      selectedBrandFont,
      selectedBrandColors,
      availableComponents = [],
      availableColorVariables = [],
      availableFontVariables = [],
      availableLayers = [],
      apiKey: userApiKey,
      anthropicApiKey: userAnthropicKey,
    } = req.body as PluginRequest;

    if (!command) {
      return res.status(400).json({ error: 'Command is required' });
    }

    // FASE 3: Load or create session for chat memory
    let chatHistory = '';
    if (sessionId && fileId) {
      try {
        const db = getDb();
        const collection = db.collection<any>('plugin_sessions');

        const session = await collection.findOneAndUpdate(
          { _id: sessionId },
          {
            $set: { updatedAt: new Date(), fileId },
            $setOnInsert: { createdAt: new Date(), messages: [], context: {} }
          },
          { upsert: true, returnDocument: 'after' }
        );

        // Build chat history from last 10 messages (FASE 3)
        if (session && session.messages && session.messages.length > 0) {
          chatHistory = session.messages
            .slice(-10)
            .map((m: any) => `[${m.role.toUpperCase()}]: ${m.content}`)
            .join('\n');
        }
      } catch (sessionError) {
        console.error('[Plugin] Session error:', sessionError);
        // Continue without session
      }
    }

    // Calculate context size for provider selection
    const contextSize =
      (selectedElements?.length || 0) +
      (availableComponents?.length || 0) +
      (availableLayers?.length || 0);

    // FASE 3: Intelligently choose provider based on complexity
    const provider = chooseProvider(command, contextSize);

    // Build context-aware prompt
    const systemPrompt = buildSystemPrompt(
      {
        command,
        selectedElements,
        selectedLogo,
        selectedBrandFont,
        selectedBrandColors,
        availableComponents,
        availableColorVariables,
        availableFontVariables,
        availableLayers,
      },
      chatHistory
    );

    const userPrompt = `═══ PEDIDO DO USUÁRIO ═══\n\n"${command}"`;

    // Generate operations using selected provider
    let operations: any[] = [];
    try {
      operations = await provider.generateOperations(systemPrompt, userPrompt, {
        temperature: 0.2,
        maxTokens: 8192,
        // Pass BYOK Anthropic key if the user provided one
        apiKey: userAnthropicKey || undefined,
      });
    } catch (aiError) {
      console.error(`[Plugin] ${provider.name} error:`, aiError);
      // Fallback gracefully
      operations = [];
    }

    // Validate operations have required fields
    operations = operations.filter(
      (op) =>
        op &&
        op.type &&
        (op.nodeId ||
          op.props ||
          op.componentKey ||
          op.nodeIds ||
          op.fills ||
          op.strokes ||
          op.effects ||
          op.layoutMode ||
          op.variableId ||
          op.styleId ||
          op.content ||
          op.name ||
          op.width != null ||
          op.opacity != null ||
          op.cornerRadius != null ||
          op.x != null)
    );

    console.log(
      `[Plugin API] [${provider.name}] Generated ${operations.length} op(s) for: "${command.substring(0, 60)}"`
    );
    // Log each operation so we can see what the LLM actually returned
    operations.forEach((op, i) => {
      if (op.type === 'MESSAGE') {
        console.log(`  [${i + 1}] MESSAGE: "${String(op.content ?? '').substring(0, 120)}"`);
      } else {
        const label = op.props?.name || op.name || op.nodeId || '';
        console.log(`  [${i + 1}] ${op.type}${label ? ` "${label}"` : ''}`);
      }
    });

    // Save to session if available (FASE 3)
    if (sessionId && fileId) {
      try {
        const db = getDb();
        const collection = db.collection<any>('plugin_sessions');
        await collection.updateOne(
          { _id: sessionId },
          {
            $push: {
              messages: {
                $each: [
                  { role: 'user', content: command, timestamp: new Date() },
                  { role: 'assistant', content: `Generated ${operations.length} operations`, operations, timestamp: new Date() }
                ]
              }
            } as any
          }
        );
      } catch (sessionError) {
        console.error('[Plugin] Failed to save to session:', sessionError);
      }
    }

    // Validate operations before sending to plugin
    const validation = operationValidator.validateBatch(operations);
    if (validation.invalid.length > 0) {
      console.warn(`[Plugin] ${validation.invalid.length} invalid operation(s) filtered:`);
      validation.invalid.forEach(({ op, errors }) => {
        console.warn(`  ✗ ${op.type}: ${errors.join(', ')}`);
      });
    }

    const validOps = validation.valid;
    const warnings = validation.invalid.map(({ op, errors }) =>
      `${op.type}: ${errors.join(', ')}`
    );

    // Return validated operations to apply
    res.json({
      success: true,
      operations: validOps,
      message: `Generated ${validOps.length} operation(s)${warnings.length > 0 ? ` (${warnings.length} filtered)` : ''}`,
      provider: provider.name,
      warnings: warnings.length > 0 ? warnings : undefined,
    });
  } catch (error: any) {
    console.error('[Plugin API] Route error:', error);
    res.status(500).json({
      error: 'Failed to process command',
      message: error.message,
    });
  }
});

// ============ Image Proxy (CORS bypass for figma.createImageAsync) ============

const ALLOWED_IMAGE_DOMAINS = [
  'images.unsplash.com',
  'picsum.photos',
  'fastly.picsum.photos',
  'res.cloudinary.com',
  'upload.wikimedia.org',
  'via.placeholder.com',
];

router.get('/proxy-image', async (req: Request, res: Response) => {
  try {
    const imageUrl = req.query.url as string;
    if (!imageUrl) {
      return res.status(400).json({ error: 'Missing url parameter' });
    }

    // Validate URL
    let parsed: URL;
    try {
      parsed = new URL(imageUrl);
    } catch (_e) {
      return res.status(400).json({ error: 'Invalid URL' });
    }

    // Domain allowlist for security
    if (!ALLOWED_IMAGE_DOMAINS.some(d => parsed.hostname.endsWith(d))) {
      return res.status(403).json({
        error: 'Domain not allowed',
        allowed: ALLOWED_IMAGE_DOMAINS
      });
    }

    // Fetch image
    const response = await fetch(imageUrl, {
      headers: { 'User-Agent': 'VisantCopilot/1.0' }
    });

    if (!response.ok) {
      return res.status(response.status).json({
        error: `Upstream returned ${response.status}`
      });
    }

    // Set content type and pipe response
    const contentType = response.headers.get('content-type') || 'image/png';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.setHeader('Access-Control-Allow-Origin', '*');

    const buffer = Buffer.from(await response.arrayBuffer());
    res.send(buffer);
  } catch (error: any) {
    console.error('[ProxyImage] Error:', error.message);
    res.status(500).json({ error: 'Failed to fetch image' });
  }
});

export default router;
