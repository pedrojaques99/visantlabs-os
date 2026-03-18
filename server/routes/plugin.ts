import express, { Request, Response, NextFunction } from 'express';
import { chooseProvider } from '../lib/ai-providers/router.js';
import { getDb, connectToMongoDB } from '../db/mongodb.js';
import { prisma } from '../db/prisma.js';
import { pluginBridge } from '../lib/pluginBridge.js';
import { operationValidator } from '../lib/operationValidator.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { getUserIdFromToken } from '../utils/auth.js';
import { rateLimit } from 'express-rate-limit';

// Rate limiter for agent commands (strict - 20 req/min)
const agentCommandLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { error: 'Too many agent commands. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});
import { ObjectId } from 'mongodb';
import WebSocket, { WebSocketServer } from 'ws';
import type { BrandGuideline } from '../types/brandGuideline.js';
import { buildBrandContext } from '../lib/brandContextBuilder.js';
import { resolveBrandGuideline, buildGuidelineChoiceContext } from '../lib/brandResolver.js';
import { scanTemplates, buildTemplateContext } from '../lib/templateScanner.js';
import { buildFormatPresetsContext } from '../lib/formatPresets.js';

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
 * Validate plugin token — reuses centralized JWT verification from utils/auth.ts
 */
function validatePluginToken(token: string | null): string | null {
  return getUserIdFromToken(token);
}

/**
 * Optional auth middleware — populates userId if valid token, but doesn't block.
 * Allows BYOK users without accounts to still use the plugin.
 */
function optionalAuth(req: AuthRequest, _res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace('Bearer ', '') || req.body?.authToken;
  const userId = getUserIdFromToken(token);
  if (userId) {
    req.userId = userId;
    // Note: email is not extracted by getUserIdFromToken for minimal token validation
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
  selectedBrandColors?: Array<{ name: string; value: string }>;
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
  brandGuideline?: any  // BrandGuideline from plugin UI
  brandGuidelineId?: string; // ID of saved brand guideline to fetch from DB
  thinkMode?: boolean; // Think mode: analyze + ask questions before generating
}

interface DesignSystemJSON {
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

/**
 * Format a DesignSystemJSON into a human-readable string block for LLM context.
 * Maps tokens directly to the operations the LLM can use (fills, radius, etc.)
 */
function buildDesignSystemContext(ds: DesignSystemJSON): string {
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

// buildBrandContext is now imported from ../lib/brandContextBuilder.js

function buildSystemPrompt(req: PluginRequest, chatHistory?: string, thinkMode?: boolean): string {
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
${req.brandGuideline ? buildBrandContext(req.brandGuideline) + '\n' : (req.designSystem ? buildDesignSystemContext(req.designSystem) + '\n' : '')}
═══ CONTEXTO DO ARQUIVO ═══

${!req.brandGuideline ? `BRAND GUIDELINES DO USUÁRIO:
- Logo(s): ${logoInfo}
- Fonte(s) de marca: ${fontInfo}
- Cores de marca: ${brandColorsInfo}` : ''}

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

   Exemplo com layoutMode NONE + posicionamento absoluto dos filhos:
   { "type": "CREATE_FRAME", "ref": "canvas", "props": {
     "name": "Canvas", "width": 800, "height": 600, "layoutMode": "NONE",
     "fills": [{"type": "SOLID", "color": {"r": 1, "g": 1, "b": 1}}], "clipsContent": true
   }}
   Filhos dentro de layoutMode NONE usam x, y para posição absoluta:
   { "type": "CREATE_FRAME", "ref": "box", "parentRef": "canvas", "props": {
     "name": "Box", "width": 200, "height": 100, "x": 50, "y": 80,
     "layoutMode": "NONE", "fills": [{"type": "SOLID", "color": {"r": 0.9, "g": 0.9, "b": 1}}]
   }}

2. CREATE_RECTANGLE — Retângulo, divider, background, linhas
   { "type": "CREATE_RECTANGLE", "ref": "divider", "parentRef": "card", "props": {
     "name": "Divider", "width": 360, "height": 1,
     "fills": [{"type": "SOLID", "color": {"r": 0.9, "g": 0.9, "b": 0.9}}],
     "layoutSizingHorizontal": "FILL"
   }}
   Exemplo com posição absoluta + rotação (linha diagonal):
   { "type": "CREATE_RECTANGLE", "parentRef": "canvas", "props": {
     "name": "Line", "width": 200, "height": 2, "x": 100, "y": 300, "rotation": -45,
     "fills": [{"type": "SOLID", "color": {"r": 0.3, "g": 0.3, "b": 0.3}}]
   }}

3. CREATE_ELLIPSE — Círculo, avatar, dot, outline
   { "type": "CREATE_ELLIPSE", "ref": "avatar", "parentRef": "header", "props": {
     "name": "Avatar", "width": 40, "height": 40,
     "fills": [{"type": "SOLID", "color": {"r": 0.85, "g": 0.85, "b": 0.9}}]
   }}
   Exemplo com stroke, opacity e posição absoluta:
   { "type": "CREATE_ELLIPSE", "parentRef": "canvas", "props": {
     "name": "Circle Outline", "width": 120, "height": 120, "x": 340, "y": 240,
     "fills": [], "strokes": [{"type": "SOLID", "color": {"r": 0.2, "g": 0.5, "b": 1}}],
     "strokeWeight": 3, "opacity": 0.8
   }}

4. CREATE_TEXT — Texto com tipografia completa
   { "type": "CREATE_TEXT", "parentRef": "card", "props": {
     "name": "Title", "content": "Hello World",
     "fontFamily": "Inter", "fontStyle": "Semi Bold", "fontSize": 18,
     "fills": [{"type": "SOLID", "color": {"r": 0.07, "g": 0.07, "b": 0.07}}],
     "textAutoResize": "WIDTH_AND_HEIGHT",
     "layoutSizingHorizontal": "FILL"
   }}
   Exemplo com posição absoluta + rotação (label vertical):
   { "type": "CREATE_TEXT", "parentRef": "canvas", "props": {
     "name": "Y Axis", "content": "Performance", "x": 10, "y": 300, "rotation": 90,
     "fontFamily": "Inter", "fontStyle": "Regular", "fontSize": 12,
     "fills": [{"type": "SOLID", "color": {"r": 0.4, "g": 0.4, "b": 0.4}}],
     "textAutoResize": "WIDTH_AND_HEIGHT"
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
⚠️ IMPORTANTE: O contexto contém a propriedade "characters" dos nós TEXT selecionados. USE SEMPRE o conteúdo atual se estiver editando formatação.
Exemplo do contexto: {"name":"Title","type":"TEXT","id":"11:12","characters":"Olá Mundo","fontSize":24}
Se vai mudar apenas a fonte: SET_TEXT_CONTENT com content="Olá Mundo" (mantém conteúdo) + nova fontFamily/fontStyle
6.  SET_FILL — Cor sólida:
    { "type": "SET_FILL", "nodeId": "...", "fills": [{"type": "SOLID", "color": {"r": 0, "g": 0.5, "b": 1}}] }
    Gradiente linear (FASE 2):
    { "type": "SET_FILL", "nodeId": "...", "fills": [{"type": "GRADIENT_LINEAR", "gradientTransform": [[1,0,0],[0,1,0]], "gradientStops": [{"position": 0, "color": {"r": 0.1, "g": 0.1, "b": 0.3, "a": 1}}, {"position": 1, "color": {"r": 0.3, "g": 0.1, "b": 0.5, "a": 1}}]}] }
7.  SET_STROKE — { "type": "SET_STROKE", "nodeId": "...", "strokes": [{"type": "SOLID", "color": {"r": 0, "g": 0, "b": 0}}], "strokeWeight": 1, "strokeAlign": "INSIDE" }
8.  SET_CORNER_RADIUS — { "type": "SET_CORNER_RADIUS", "nodeId": "...", "cornerRadius": 8, "cornerSmoothing": 0.6 }
9.  SET_EFFECTS — { "type": "SET_EFFECTS", "nodeId": "...", "effects": [{"type": "DROP_SHADOW", "color": {"r":0,"g":0,"b":0,"a":0.12}, "offset": {"x":0,"y":4}, "radius": 16, "spread": 0}] }
10. SET_AUTO_LAYOUT — { "type": "SET_AUTO_LAYOUT", "nodeId": "...", "layoutMode": "VERTICAL", "itemSpacing": 8, "paddingTop": 16, "paddingRight": 16, "paddingBottom": 16, "paddingLeft": 16 }
11. RESIZE — { "type": "RESIZE", "nodeId": "...", "width": 400, "height": 300 }
12. MOVE — { "type": "MOVE", "nodeId": "...", "x": 100, "y": 200 }
13. RENAME — { "type": "RENAME", "nodeId": "...", "name": "Novo Nome" }
14. SET_TEXT_CONTENT — ⚠️ OBRIGATÓRIO: sempre inclua "content" (novo texto) + opcionais fontSize/fontFamily/fontStyle
    { "type": "SET_TEXT_CONTENT", "nodeId": "...", "content": "Novo texto", "fontSize": 14, "fontFamily": "Barlow", "fontStyle": "Medium" }
    ⚠️ NÃO deixe "content" em branco ou ausente. Se o usuário quer apenas mudar a FONTE existente, precisa reescrever o conteúdo com a nova fonte.
15. SET_OPACITY — { "type": "SET_OPACITY", "nodeId": "...", "opacity": 0.5 }

TOKENS / VARIABLES:
16. APPLY_VARIABLE — { "type": "APPLY_VARIABLE", "nodeId": "...", "variableId": "...", "field": "fills" }
    ⚠️ APPLY_VARIABLE só funciona com fills/strokes que são SOLID. Para nós com gradiente ou imagem, use SET_FILL primeiro para converter para SOLID, ou use SET_FILL diretamente com a cor desejada.
17. APPLY_STYLE — { "type": "APPLY_STYLE", "nodeId": "...", "styleId": "...", "styleType": "FILL" }

ESTRUTURA:
18. GROUP_NODES — { "type": "GROUP_NODES", "nodeIds": ["..."], "name": "Group" }
19. UNGROUP — { "type": "UNGROUP", "nodeId": "..." }
20. DETACH_INSTANCE — { "type": "DETACH_INSTANCE", "nodeId": "..." }
21. DELETE_NODE — { "type": "DELETE_NODE", "nodeId": "..." }

DUPLICAÇÃO:
22. CLONE_NODE — ⭐ OBRIGATÓRIO para duplicar/copiar frames e templates. Preserva TUDO (fontes, imagens, estilos).
    { "type": "CLONE_NODE", "sourceNodeId": "<id>", "ref": "copy",
      "textOverrides": [{ "name": "Nome do Layer de Texto", "content": "Novo texto aqui" }] }
    ⚠️ Use "textOverrides" para trocar textos PELO NOME DO LAYER durante o clone. Não precisa saber o ID novo!

═══ REGRAS DE OURO ═══

1. SEMPRE use auto-layout (layoutMode: "VERTICAL" ou "HORIZONTAL") nos frames container. NUNCA posicione filhos com x/y dentro de auto-layout. MAS: quando o parent tem layoutMode: "NONE" (canvas livre, gráficos, diagramas), USE x/y para posicionar os filhos — é o único jeito. Rotation (graus, sentido anti-horário) também está disponível para todos os nós.
2. Use "ref"/"parentRef" para hierarquia. O frame root tem "ref", filhos referenciam com "parentRef".
3. Cores são RGB normalizado 0-1. Vermelho = {"r":1,"g":0,"b":0}. Branco = {"r":1,"g":1,"b":1}. Preto = {"r":0,"g":0,"b":0}.
4. Se o usuário tiver cores de marca, USE-AS com prioridade.
5. Se existirem variáveis de cor no arquivo, prefira APPLY_VARIABLE ao invés de cores hardcoded. Mas ATENÇÃO: APPLY_VARIABLE só vincula variáveis a paints SÓLIDOS. Se o nó tiver gradiente/imagem, use SET_FILL com cor sólida ao invés de APPLY_VARIABLE.
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
17. Para editar texto: use nodeId de um nó TEXT. Se a seleção for um FRAME ou GROUP com filhos TEXT, use o id do filho (ex: "T Message"), NUNCA do frame.
    ⚠️ SET_TEXT_CONTENT SEMPRE PRECISA de "content". Para mudar apenas a FONTE de um texto existente, precisa reescrever o conteúdo com a nova fonte.
    Exemplo: Se o texto era "Olá" em Inter Regular, para mudar para Barlow Medium use SET_TEXT_CONTENT com content="Olá" fontFamily="Barlow" fontStyle="Medium".
18. Para criação: sempre comece com o frame/container root e adicione filhos na ORDEM com parentRef.
19. FontStyle válidos: "Regular", "Medium", "Semi Bold", "Bold", "Light", "Thin", "Extra Bold", "Black", "".
20. GRADIENTES (FASE 2): Tipos suportados: GRADIENT_LINEAR, GRADIENT_RADIAL, GRADIENT_ANGULAR, GRADIENT_DIAMOND. Cada gradiente PRECISA de "gradientTransform" e "gradientStops". Cores nos stops usam RGBA (0-1).
    Transform padrão horizontal: [[1,0,0],[0,1,0]]. Diagonal 45°: [[0.7,0.7,-0.1],[-0.7,0.7,0.5]]. Vertical: [[0,1,0],[-1,0,1]].
    Exemplo completo: { "type": "SET_FILL", "nodeId": "...", "fills": [{"type": "GRADIENT_LINEAR", "gradientTransform": [[1,0,0],[0,1,0]], "gradientStops": [{"position": 0, "color": {"r": 0.05, "g": 0.05, "b": 0.15, "a": 1}}, {"position": 1, "color": {"r": 0.2, "g": 0.1, "b": 0.4, "a": 1}}]}] }
21. IMAGENS (FASE 2): Use SET_IMAGE_FILL com URLs (unsplash.com, picsum.photos). Para cards com foto: crie RECTANGLE, aplique SET_IMAGE_FILL.
22. COMPONENTES (FASE 2): Use CREATE_COMPONENT para reutilizáveis. Variants via COMBINE_AS_VARIANTS com naming "Property=Value".
23. SVG (FASE 2): Use CREATE_SVG para ícones simples. Gere SVG inline com viewBox correto. Preferir componentes da library quando disponíveis.
24. RICH TEXT (FASE 2): Para formatação mista, use CREATE_TEXT seguido de SET_TEXT_RANGES com ranges de caracteres.
25. CONSTRAINTS (FASE 2): Em frames sem auto-layout, sempre setar constraints. Buttons: horizontal STRETCH, vertical MIN.
26. MEMÓRIA (FASE 3): Consulte o histórico de conversa. Se o user referencia algo que criamos antes, use os nodeIds do histórico.
27. ⚠️ SET_TEXT_CONTENT REQUER "content" OBRIGATORIAMENTE. Nunca gere SET_TEXT_CONTENT sem o campo "content" preenchido com uma string válida.
    - Se o user quer mudar APENAS a fonte de um texto existente, você PRECISA saber ou INFERIR qual é o conteúdo atual (ex: "Título", "Descrição")
    - Reescreva com a nova formatação: {"type":"SET_TEXT_CONTENT","nodeId":"...","content":"[conteúdo original ou inferido]","fontFamily":"Nova Fonte","fontStyle":"Novo estilo"}

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
    - ⚠️ MOVE de frames criados nesta resposta usa "ref": {"type":"MOVE","ref":"f2","x":400,"y":0}
    - ✅ Frame filho de outro frame (parentRef/parentNodeId): NUNCA adicione MOVE. O auto-layout cuida do posicionamento.

${req.attachments?.length ? `═══ ANEXOS DO USUÁRIO ═══
O usuário anexou os seguintes arquivos:
${req.attachments.map((a, i) => `${i + 1}. "${a.name}" (${a.mimeType})`).join('\n')}
Você pode usar esses dados como referência para criar designs, por exemplo: imagens para extrair cores/estilos, CSVs para dados de tabelas, PDFs para conteúdo.
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

// ============ NEW: Agent Command Endpoint ============

/**
 * POST /api/plugin/agent-command
 * Called by MCP server or external agents to push operations to plugin
 * SECURITY: Requires authentication + rate limiting (CRIT-001 fix)
 */
router.post('/agent-command', agentCommandLimiter, authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { fileId, operations } = req.body;
    const userId = req.userId;

    // Log for audit trail
    console.log(`[Plugin Agent] User ${userId} sending ${operations?.length || 0} operations to file ${fileId}`);

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
 * Redirect to new documentation system at /api/docs/plugin
 */
router.get('/docs', (req: Request, res: Response) => {
  res.redirect(307, '/api/docs/plugin');
});

/**
 * DEPRECATED: Old documentation route
 * Removed in favor of /api/docs/plugin
 */
// ============ Existing HTTP Polling Endpoint ============

// POST /plugin - Generate design operations from natural language (FASE 3: Multi-model + Chat Memory)
router.post('/', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const {
      command,
      sessionId,
      fileId,
      selectedElements = [],
      selectedLogo,
      brandLogos,
      selectedBrandFont,
      brandFonts,
      selectedBrandColors,
      availableComponents = [],
      availableColorVariables = [],
      availableFontVariables = [],
      availableLayers = [],
      apiKey: userApiKey,
      anthropicApiKey: userAnthropicKey,
      attachments = [],
      mentions = [],
      designSystem,
      brandGuideline: brandGuidelineFromUI,
      brandGuidelineId,
      thinkMode = false,
    } = req.body as PluginRequest;

    if (!command) {
      return res.status(400).json({ error: 'Command is required' });
    }

    // Credit check — skip for BYOK users (they use their own keys)
    const isByok = !!(userApiKey || userAnthropicKey);
    if (req.userId && !isByok) {
      const credits = await checkCredits(req.userId);
      if (!credits.canGenerate) {
        return res.status(403).json({ error: credits.reason, code: 'NO_CREDITS' });
      }
    }

    // ═══ BRANDED SOCIAL POSTS: Auto-resolve brand guideline ═══
    let brandGuideline: BrandGuideline | null = brandGuidelineFromUI || null;
    let brandChoiceContext = '';

    // Try explicit brandGuidelineId first
    if (brandGuidelineId && !brandGuideline) {
      try {
        const savedGuideline = await prisma.brandGuideline.findUnique({
          where: { id: brandGuidelineId },
        });
        if (savedGuideline) {
          brandGuideline = {
            id: savedGuideline.id,
            identity: savedGuideline.identity as any,
            logos: savedGuideline.logos as any,
            colors: savedGuideline.colors as any,
            typography: savedGuideline.typography as any,
            tags: savedGuideline.tags as any,
            media: savedGuideline.media as any,
            tokens: savedGuideline.tokens as any,
            guidelines: savedGuideline.guidelines as any,
          };
          console.log('[Plugin] Loaded brand guideline from DB:', brandGuidelineId);
        }
      } catch (bgError) {
        console.error('[Plugin] Error fetching brand guideline:', bgError);
      }
    }

    // If still no brand, try auto-resolve from project linkage
    if (!brandGuideline && fileId && req.userId) {
      try {
        const brandResult = await resolveBrandGuideline(fileId, req.userId, brandGuidelineId);
        if (brandResult.guideline) {
          brandGuideline = brandResult.guideline;
          console.log('[Plugin] Auto-resolved brand guideline from project linkage');
        } else if (brandResult.needsUserChoice) {
          brandChoiceContext = buildGuidelineChoiceContext(brandResult.availableGuidelines);
          console.log('[Plugin] No linked brand, LLM will ask user to choose');
        }
      } catch (resolveError) {
        console.error('[Plugin] Error auto-resolving brand:', resolveError);
      }
    }

    // ═══ BRANDED SOCIAL POSTS: Scan templates ═══
    let templateContext = '';
    if (fileId && pluginBridge.getSession(fileId)) {
      try {
        const templates = await scanTemplates(fileId);
        templateContext = buildTemplateContext(templates);
        if (templates.length > 0) {
          console.log(`[Plugin] Found ${templates.length} templates in file`);
          console.log(`[Plugin] Template IDs:`, templates.map(t => ({ id: t.id, name: t.name })));
          console.log(`[Plugin] Template context preview:`, templateContext.slice(0, 500));
        }
      } catch (templateError) {
        console.error('[Plugin] Error scanning templates:', templateError);
      }
    }

    // ═══ BRANDED SOCIAL POSTS: Format presets ═══
    const formatPresetsContext = buildFormatPresetsContext();

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
    let systemPrompt = buildSystemPrompt(
      {
        command,
        selectedElements,
        selectedLogo,
        brandLogos,
        selectedBrandFont,
        brandFonts,
        selectedBrandColors,
        availableComponents,
        availableColorVariables,
        availableFontVariables,
        availableLayers,
        attachments,
        mentions,
        designSystem: designSystem || null,
        brandGuideline: brandGuideline || undefined,
      },
      chatHistory,
      thinkMode
    );

    // ═══ BRANDED SOCIAL POSTS: Inject additional context ═══
    const additionalContext = [
      brandChoiceContext,
      templateContext,
      formatPresetsContext,
    ].filter(Boolean).join('\n\n');

    if (additionalContext) {
      // Insert before "═══ OPERAÇÕES DISPONÍVEIS ═══"
      const insertPoint = systemPrompt.indexOf('═══ OPERAÇÕES DISPONÍVEIS ═══');
      if (insertPoint > 0) {
        systemPrompt = systemPrompt.slice(0, insertPoint) + additionalContext + '\n\n' + systemPrompt.slice(insertPoint);
      } else {
        systemPrompt += '\n\n' + additionalContext;
      }
    }

    const userPrompt = `═══ PEDIDO DO USUÁRIO ═══\n\n"${command}"`;

    // Generate operations using selected provider
    let operations: any[] = [];
    let usage: { inputTokens: number; outputTokens: number; totalTokens: number } | undefined;
    const generationStart = Date.now();
    try {
      const result = await provider.generateOperations(systemPrompt, userPrompt, {
        temperature: 0.2,
        maxTokens: 8192,
        // Pass BYOK Anthropic key if the user provided one
        apiKey: userAnthropicKey || undefined,
        // Pass attachments (images, PDFs, CSVs) for multimodal processing
        attachments: attachments || [],
        // Agent status callback — broadcasts search progress to plugin UI via WebSocket
        onStatus: fileId
          ? (message: string) => {
            pluginBridge.notify(fileId, { type: 'AGENT_STATUS', message });
          }
          : undefined,
      });
      operations = result.operations;
      usage = result.usage;
      console.log(`[Plugin] LLM generated ${operations.length} operations:`, operations.map((o: any) => o.type));
      if (operations.length > 0) {
        console.log(`[Plugin] First operation:`, JSON.stringify(operations[0]).slice(0, 300));
      }
    } catch (aiError) {
      console.error(`[Plugin] ${provider.name} error:`, aiError);
      // Fallback gracefully
      operations = [];
    }
    const durationMs = Date.now() - generationStart;

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
      usage: usage || undefined,
      durationMs,
    });

    // Deduct credit after successful response (non-blocking, only for authenticated non-BYOK users)
    const isByokUser = !!(userApiKey || userAnthropicKey);
    if (req.userId && !isByokUser && validOps.length > 0) {
      deductCredit(req.userId).catch(e => console.error('[Plugin] Credit deduction error:', e));
    }
  } catch (error: any) {
    console.error('[Plugin API] Route error:', error);
    res.status(500).json({
      error: 'Failed to process command',
      message: error.message,
    });
  }
});

// ============ Plugin Auth Status (same credit fields as /payments/usage) ============

router.get('/auth/status', optionalAuth, async (req: AuthRequest, res: Response) => {
  if (!req.userId) {
    return res.json({
      authenticated: false,
      canGenerate: true, // Allow unauthenticated BYOK users
    });
  }

  try {
    await connectToMongoDB();
    const db = getDb();
    const user = await db.collection('users').findOne({ _id: new ObjectId(req.userId) });
    if (!user) {
      return res.json({ authenticated: false, canGenerate: true });
    }

    const hasActiveSubscription = user.subscriptionStatus === 'active';
    const freeGenerationsUsed = user.freeGenerationsUsed || 0;
    const monthlyCredits = user.monthlyCredits || 20;
    const creditsUsed = user.creditsUsed || 0;
    const creditsRemaining = Math.max(0, monthlyCredits - creditsUsed);
    const totalCreditsEarned = user.totalCreditsEarned ?? 0;
    const totalCredits = totalCreditsEarned + creditsRemaining;

    res.json({
      authenticated: true,
      email: user.email,
      subscriptionTier: user.subscriptionTier || 'free',
      hasActiveSubscription,
      freeGenerationsUsed,
      freeGenerationsRemaining: Math.max(0, FREE_GENERATIONS_LIMIT - freeGenerationsUsed),
      monthlyCredits,
      creditsUsed,
      creditsRemaining,
      totalCredits,
      canGenerate: hasActiveSubscription
        ? totalCredits > 0
        : (freeGenerationsUsed < FREE_GENERATIONS_LIMIT && totalCredits > 0),
    });
  } catch (error: any) {
    console.error('[Plugin] Auth status error:', error.message);
    res.json({ authenticated: false, canGenerate: true });
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
