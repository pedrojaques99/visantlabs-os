/// <reference types="@figma/plugin-typings" />

import type { FigmaOperation } from '../../../src/lib/figma-types';
import { postToUI } from '../utils/postMessage';
import { ensurePagesLoaded, setPagesLoaded, setCanUndo, DEFAULT_FONT } from '../state';
import { serializeNode, serializeSelection } from '../utils/serialize';

/**
 * Summary item for operation results
 */
interface SummaryItem {
  text: string;
  nodeId?: string;
  nodeName?: string;
}

/**
 * Normalize fills to valid Figma format
 * Handles common AI-generated formats like hex strings, color objects, etc.
 */
function normalizeFills(fills: any): Paint[] | undefined {
  if (!fills || !Array.isArray(fills)) return undefined;

  const validTypes = ['SOLID', 'GRADIENT_LINEAR', 'GRADIENT_RADIAL', 'GRADIENT_ANGULAR', 'GRADIENT_DIAMOND', 'IMAGE', 'VIDEO'];

  return fills.map((fill: any) => {
    // Already valid format
    if (fill.type && validTypes.includes(fill.type)) {
      // Ensure color is in correct format { r, g, b }
      if (fill.type === 'SOLID' && fill.color) {
        const color = normalizeColor(fill.color);
        return { ...fill, color };
      }
      return fill;
    }

    // Convert hex string or invalid format to SOLID
    let color = { r: 0, g: 0, b: 0 };

    if (typeof fill === 'string') {
      color = hexToRgb(fill);
    } else if (fill.color) {
      color = normalizeColor(fill.color);
    } else if (fill.hex) {
      color = hexToRgb(fill.hex);
    } else if (fill.r !== undefined) {
      color = normalizeColor(fill);
    }

    return {
      type: 'SOLID' as const,
      color,
      opacity: fill.opacity ?? 1,
    };
  }).filter(Boolean) as Paint[];
}

/**
 * Normalize color to Figma format { r, g, b } with values 0-1
 */
function normalizeColor(color: any): RGB {
  if (!color) return { r: 0, g: 0, b: 0 };

  // Already normalized (values 0-1)
  if (typeof color.r === 'number' && color.r <= 1 && color.g <= 1 && color.b <= 1) {
    return { r: color.r, g: color.g, b: color.b };
  }

  // Values 0-255, need to normalize
  if (typeof color.r === 'number' && (color.r > 1 || color.g > 1 || color.b > 1)) {
    return { r: color.r / 255, g: color.g / 255, b: color.b / 255 };
  }

  // Hex string
  if (typeof color === 'string') {
    return hexToRgb(color);
  }

  return { r: 0, g: 0, b: 0 };
}

/**
 * Convert hex color to Figma RGB (0-1 range)
 */
function hexToRgb(hex: string): RGB {
  const clean = hex.replace('#', '');
  const bigint = parseInt(clean, 16);
  return {
    r: ((bigint >> 16) & 255) / 255,
    g: ((bigint >> 8) & 255) / 255,
    b: (bigint & 255) / 255,
  };
}

/**
 * Apply a batch of Figma operations
 */
export async function applyOperations(ops: FigmaOperation[]) {
  // Create native Figma undo checkpoint
  figma.commitUndo();
  setCanUndo(true);

  // Reset page cache per batch
  setPagesLoaded(false);

  const createdNodes = new Map<string, SceneNode>();
  const createdPages = new Map<string, PageNode>();
  const summaryLines: string[] = [];
  const summaryItems: SummaryItem[] = [];

  function pushSummary(text: string, node?: SceneNode | BaseNode | null) {
    summaryLines.push(text);
    summaryItems.push({
      text,
      nodeId: node && 'id' in node ? node.id : undefined,
      nodeName: node && 'name' in node ? (node as any).name : undefined,
    });
  }

  async function getParent(parentRef?: string, parentNodeId?: string): Promise<BaseNode & ChildrenMixin> {
    // Check created pages first (for frames inside new pages)
    if (parentRef && createdPages.has(parentRef)) {
      return createdPages.get(parentRef) as BaseNode & ChildrenMixin;
    }
    if (parentRef && createdNodes.has(parentRef)) {
      return createdNodes.get(parentRef) as BaseNode & ChildrenMixin;
    }
    if (parentNodeId) {
      const node = await figma.getNodeByIdAsync(parentNodeId);
      if (node && 'children' in node) {
        return node as BaseNode & ChildrenMixin;
      }
    }
    return figma.currentPage;
  }

  const total = ops.length;
  for (let i = 0; i < ops.length; i++) {
    const op = ops[i];
    const opName = (op as any).props?.name || (op as any).name || op.type;
    console.log('[OPERATION]', op.type, JSON.stringify(op).slice(0, 200));

    // Notify UI of progress before applying
    postToUI({
      type: 'OP_PROGRESS',
      current: i + 1,
      total,
      opType: op.type,
      opName,
      status: 'applying'
    });

    try {
      await processOperation(op, { createdNodes, createdPages, pushSummary, getParent });

      // Notify UI of success
      postToUI({
        type: 'OP_PROGRESS',
        current: i + 1,
        total,
        opType: op.type,
        opName,
        status: 'done'
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.warn(`⚠️ Op ${op.type}: ${errorMsg}`);
      postToUI({
        type: 'OP_PROGRESS',
        current: i + 1,
        total,
        opType: op.type,
        opName,
        status: 'error',
        error: errorMsg
      });
    }
  }

  // Select root nodes created and zoom to view
  const rootNodes = [...createdNodes.values()].filter(n => n.parent === figma.currentPage);
  if (rootNodes.length > 0) {
    figma.currentPage.selection = rootNodes;
    figma.viewport.scrollAndZoomIntoView(rootNodes);
  }

  // Build ref → nodeId mapping
  const nodeIdMap: Record<string, { nodeId: string; name: string }> = {};
  for (const [ref, node] of createdNodes) {
    nodeIdMap[ref] = { nodeId: node.id, name: node.name };
  }

  const summary = summaryLines.length > 0 ? summaryLines.join('\n') : undefined;
  postToUI({ type: 'OPERATIONS_DONE', count: ops.length, summary, summaryItems, canUndo: true, nodeIdMap });
}

interface OperationContext {
  createdNodes: Map<string, SceneNode>;
  createdPages: Map<string, PageNode>;
  pushSummary: (text: string, node?: SceneNode | BaseNode | null) => void;
  getParent: (parentRef?: string, parentNodeId?: string) => Promise<BaseNode & ChildrenMixin>;
}

async function processOperation(op: FigmaOperation, ctx: OperationContext) {
  const { createdNodes, createdPages, pushSummary, getParent } = ctx;

  // Resiliency: prioritize op.props but fallback to op root for flat JSON objects
  const rawOp = op as any;
  const props = rawOp.props || rawOp;

  // ═══ CREATE_PAGE ═══
  if (op.type === 'CREATE_PAGE') {
    const page = figma.createPage();
    page.name = props.name || 'Nova Página';
    if (op.ref) createdPages.set(op.ref, page);
    pushSummary(`Página criada @"${page.name}"`, page);
    return;
  }

  // ═══ CREATE_FRAME ═══
  if (op.type === 'CREATE_FRAME') {
    const parent = await getParent(op.parentRef, op.parentNodeId);
    const frame = figma.createFrame();
    frame.name = props.name || 'Frame';
    const fw = props.width > 0 ? props.width : 100;
    const fh = props.height > 0 ? props.height : 100;
    frame.resize(fw, fh);

    // Auto-layout
    if (props.layoutMode && props.layoutMode !== 'NONE') {
      frame.layoutMode = props.layoutMode;
      frame.primaryAxisSizingMode = props.primaryAxisSizingMode ?? 'AUTO';
      frame.counterAxisSizingMode = props.counterAxisSizingMode ?? 'AUTO';
      frame.primaryAxisAlignItems = props.primaryAxisAlignItems ?? 'MIN';
      frame.counterAxisAlignItems = props.counterAxisAlignItems ?? 'MIN';
      frame.itemSpacing = props.itemSpacing ?? 0;
      if (props.counterAxisSpacing != null && 'counterAxisSpacing' in frame) {
        (frame as any).counterAxisSpacing = props.counterAxisSpacing;
      }
      frame.layoutWrap = props.layoutWrap ?? 'NO_WRAP';
      frame.paddingTop = props.paddingTop ?? 0;
      frame.paddingRight = props.paddingRight ?? 0;
      frame.paddingBottom = props.paddingBottom ?? 0;
      frame.paddingLeft = props.paddingLeft ?? 0;
      if (props.strokesIncludedInLayout != null && 'strokesIncludedInLayout' in frame) {
        (frame as any).strokesIncludedInLayout = props.strokesIncludedInLayout;
      }
      if (props.minWidth != null && 'minWidth' in frame) (frame as any).minWidth = props.minWidth;
      if (props.maxWidth != null && 'maxWidth' in frame) (frame as any).maxWidth = props.maxWidth;
      if (props.minHeight != null && 'minHeight' in frame) (frame as any).minHeight = props.minHeight;
      if (props.maxHeight != null && 'maxHeight' in frame) (frame as any).maxHeight = props.maxHeight;
    }

    if (props.fills) frame.fills = normalizeFills(props.fills) || [];
    if (props.cornerRadius != null) frame.cornerRadius = props.cornerRadius;
    if (props.cornerSmoothing != null) frame.cornerSmoothing = props.cornerSmoothing;
    if (props.clipsContent != null) frame.clipsContent = props.clipsContent;
    if (props.strokes) frame.strokes = props.strokes as any;
    if (props.strokeWeight != null) frame.strokeWeight = props.strokeWeight;
    if (props.opacity != null) frame.opacity = props.opacity;

    // Posicionamento do frame
    if (parent === figma.currentPage || parent.type === 'PAGE') {
      const page = parent as PageNode;
      const gap = props.positionGap ?? 100;

      if (props.autoPosition) {
        const siblings = page.children.filter(n => n.type === 'FRAME' || n.type === 'COMPONENT');

        if (props.autoPosition === 'right' && siblings.length > 0) {
          // Posiciona à direita do último frame
          const maxX = Math.max(0, ...siblings.map(n => n.x + n.width));
          frame.x = maxX + gap;
          frame.y = 0;
        } else if (props.autoPosition === 'below' && siblings.length > 0) {
          // Posiciona abaixo do último frame
          const maxY = Math.max(0, ...siblings.map(n => n.y + n.height));
          frame.x = 0;
          frame.y = maxY + gap;
        } else if (props.autoPosition === 'grid') {
          // Grid: calcula posição baseado em linha/coluna
          const cols = 4;
          const idx = siblings.length;
          const col = idx % cols;
          const row = Math.floor(idx / cols);
          const maxW = Math.max(fw, ...siblings.map(n => n.width));
          const maxH = Math.max(fh, ...siblings.map(n => n.height));
          frame.x = col * (maxW + gap);
          frame.y = row * (maxH + gap);
        } else {
          frame.x = 0;
          frame.y = 0;
        }
      } else if (props.x != null || props.y != null) {
        // Posição explícita
        frame.x = props.x ?? 0;
        frame.y = props.y ?? 0;
      } else {
        // Fallback: centro do viewport
        frame.x = figma.viewport.center.x - fw / 2;
        frame.y = figma.viewport.center.y - fh / 2;
      }
    }
    parent.appendChild(frame);

    if (parent !== figma.currentPage && parent.type !== 'PAGE') {
      if (props.x != null) frame.x = props.x;
      if (props.y != null) frame.y = props.y;
    }
    if (props.rotation != null) frame.rotation = props.rotation;

    if (props.layoutSizingHorizontal && parent !== figma.currentPage) {
      frame.layoutSizingHorizontal = props.layoutSizingHorizontal;
    }
    if (props.layoutSizingVertical && parent !== figma.currentPage) {
      frame.layoutSizingVertical = props.layoutSizingVertical;
    }

    if (op.ref) createdNodes.set(op.ref, frame);
    pushSummary(`Criado @"${frame.name}"`, frame);
  }

  // ═══ CREATE_RECTANGLE ═══
  else if (op.type === 'CREATE_RECTANGLE') {
    const parent = await getParent(op.parentRef, op.parentNodeId);
    const rect = figma.createRectangle();
    rect.name = props.name || 'Retângulo';
    rect.resize(props.width > 0 ? props.width : 100, props.height > 0 ? props.height : 100);
    if (props.fills) rect.fills = normalizeFills(props.fills) || [];
    if (props.cornerRadius != null) rect.cornerRadius = props.cornerRadius;
    if (props.strokes) rect.strokes = props.strokes as any;
    if (props.strokeWeight != null) rect.strokeWeight = props.strokeWeight;
    if (props.opacity != null) rect.opacity = props.opacity;
    if (props.effects) rect.effects = mapEffects(props.effects);
    if (props.constraints && 'constraints' in rect) (rect as any).constraints = props.constraints;
    parent.appendChild(rect);

    if (props.x != null) rect.x = props.x;
    if (props.y != null) rect.y = props.y;
    if (props.rotation != null) rect.rotation = props.rotation;

    if (props.layoutSizingHorizontal && parent !== figma.currentPage) {
      rect.layoutSizingHorizontal = props.layoutSizingHorizontal;
    }
    if (props.layoutSizingVertical && parent !== figma.currentPage) {
      rect.layoutSizingVertical = props.layoutSizingVertical;
    }
    if (op.ref) createdNodes.set(op.ref, rect);
    pushSummary(`Criado @"${rect.name}"`, rect);
  }

  // ═══ CREATE_ELLIPSE ═══
  else if (op.type === 'CREATE_ELLIPSE') {
    const parent = await getParent(op.parentRef, op.parentNodeId);
    const ellipse = figma.createEllipse();
    ellipse.name = props.name || 'Elipse';
    ellipse.resize(props.width > 0 ? props.width : 100, props.height > 0 ? props.height : 100);
    if (props.fills) ellipse.fills = normalizeFills(props.fills) || [];
    if (props.strokes) ellipse.strokes = props.strokes as any;
    if (props.strokeWeight != null) ellipse.strokeWeight = props.strokeWeight;
    if (props.opacity != null) ellipse.opacity = props.opacity;
    if (props.effects) ellipse.effects = mapEffects(props.effects);
    if (props.constraints && 'constraints' in ellipse) (ellipse as any).constraints = props.constraints;
    parent.appendChild(ellipse);

    if (props.x != null) ellipse.x = props.x;
    if (props.y != null) ellipse.y = props.y;
    if (props.rotation != null) ellipse.rotation = props.rotation;

    if (props.layoutSizingHorizontal && parent !== figma.currentPage) {
      ellipse.layoutSizingHorizontal = props.layoutSizingHorizontal;
    }
    if (props.layoutSizingVertical && parent !== figma.currentPage) {
      ellipse.layoutSizingVertical = props.layoutSizingVertical;
    }
    if (op.ref) createdNodes.set(op.ref, ellipse);
    pushSummary(`Criado @"${ellipse.name}"`, ellipse);
  }

  // ═══ CREATE_TEXT ═══
  else if (op.type === 'CREATE_TEXT') {
    const fontFamily = props.fontFamily ?? 'Inter';
    const fontStyle = props.fontStyle ?? 'Regular';
    try {
      await figma.loadFontAsync({ family: fontFamily, style: fontStyle });
    } catch {
      await figma.loadFontAsync(DEFAULT_FONT);
    }

    const parent = await getParent(op.parentRef, op.parentNodeId);
    const text = figma.createText();
    try {
      text.fontName = { family: fontFamily, style: fontStyle };
    } catch {
      text.fontName = DEFAULT_FONT;
    }
    text.characters = props.content || props.characters || '';
    if (props.name) text.name = props.name;
    if (props.fontSize) text.fontSize = props.fontSize;
    if (props.fills) text.fills = normalizeFills(props.fills) || [];
    if (props.textAlignHorizontal) text.textAlignHorizontal = props.textAlignHorizontal;
    if (props.textAlignVertical) text.textAlignVertical = props.textAlignVertical;
    if (props.textAutoResize) text.textAutoResize = props.textAutoResize;
    if (props.textDecoration && props.textDecoration !== 'NONE') {
      text.textDecoration = props.textDecoration;
    }
    if (props.textCase && props.textCase !== 'ORIGINAL') {
      text.textCase = props.textCase;
    }
    if (props.lineHeight) text.lineHeight = props.lineHeight;
    if (props.letterSpacing) text.letterSpacing = props.letterSpacing;
    if (props.paragraphSpacing != null) text.paragraphSpacing = props.paragraphSpacing;
    if (props.opacity != null) text.opacity = props.opacity;

    parent.appendChild(text);
    if (props.x != null) text.x = props.x;
    if (props.y != null) text.y = props.y;
    if (props.rotation != null) text.rotation = props.rotation;

    if (props.layoutSizingHorizontal && parent !== figma.currentPage) {
      text.layoutSizingHorizontal = props.layoutSizingHorizontal;
    }
    if (props.layoutSizingVertical && parent !== figma.currentPage) {
      text.layoutSizingVertical = props.layoutSizingVertical;
    }
    if (op.ref) createdNodes.set(op.ref, text);
    pushSummary(`Criado @"${text.name}"`, text);
  }

  // ═══ CREATE_COMPONENT_INSTANCE ═══
  else if (op.type === 'CREATE_COMPONENT_INSTANCE') {
    const parent = await getParent(op.parentRef, op.parentNodeId);
    let component: ComponentNode | null = null;

    try {
      await ensurePagesLoaded();
      const allComps = figma.root.findAllWithCriteria({ types: ['COMPONENT'] });
      component = allComps.find(c => c.key === op.componentKey) || null;
    } catch {
      // Continue to try import
    }

    if (!component) {
      try {
        component = await figma.importComponentByKeyAsync(op.componentKey);
      } catch {
        postToUI({ type: 'ERROR', message: `Componente não encontrado: ${op.componentKey}` });
        return;
      }
    }

    const instance = component.createInstance();
    if (op.name) instance.name = op.name;
    parent.appendChild(instance);
    if (op.ref) createdNodes.set(op.ref, instance);
    pushSummary(`Criado @"${instance.name}"`, instance);
  }

  // ═══ SET_FILL ═══
  else if (op.type === 'SET_FILL') {
    const node = await figma.getNodeByIdAsync(op.nodeId) as GeometryMixin | null;
    if (node && 'fills' in node) {
      node.fills = op.fills as any;
      pushSummary(`Editado fill @"${(node as any).name}"`, node as SceneNode);
    }
  }

  // ═══ SET_STROKE ═══
  else if (op.type === 'SET_STROKE') {
    const node = await figma.getNodeByIdAsync(op.nodeId) as GeometryMixin | null;
    if (node && 'strokes' in node) {
      node.strokes = op.strokes as any;
      if (op.strokeWeight != null) node.strokeWeight = op.strokeWeight;
      if (op.strokeAlign && 'strokeAlign' in node) {
        (node as any).strokeAlign = op.strokeAlign;
      }
      pushSummary(`Editado stroke @"${(node as any).name}"`, node as SceneNode);
    }
  }

  // ═══ SET_IMAGE_FILL ═══
  else if (op.type === 'SET_IMAGE_FILL') {
    const node = op.nodeId
      ? await figma.getNodeByIdAsync(op.nodeId)
      : (op.ref ? createdNodes.get(op.ref) : null);
    if (node && 'fills' in node) {
      try {
        const image = await figma.createImageAsync(op.imageUrl);
        (node as GeometryMixin).fills = [{
          type: 'IMAGE',
          imageHash: image.hash,
          scaleMode: op.scaleMode || 'FILL',
        } as Paint];
        pushSummary(`Imagem aplicada @"${(node as any).name}"`, node as SceneNode);
      } catch (e) {
        postToUI({ type: 'ERROR', message: `Falha ao carregar imagem: ${String(e)}` });
      }
    }
  }

  // ═══ SET_CORNER_RADIUS ═══
  else if (op.type === 'SET_CORNER_RADIUS') {
    const node = await figma.getNodeByIdAsync(op.nodeId) as any;
    if (node && 'cornerRadius' in node) {
      node.cornerRadius = op.cornerRadius;
      if (op.cornerSmoothing != null && 'cornerSmoothing' in node) {
        node.cornerSmoothing = op.cornerSmoothing;
      }
      pushSummary(`Editado radius @"${node.name}"`, node as SceneNode);
    }
  }

  // ═══ SET_EFFECTS ═══
  else if (op.type === 'SET_EFFECTS') {
    const node = await figma.getNodeByIdAsync(op.nodeId) as BlendMixin | null;
    if (node && 'effects' in node) {
      node.effects = mapEffects(op.effects);
      pushSummary(`Editado effects @"${(node as any).name}"`, node as SceneNode);
    }
  }

  // ═══ SET_AUTO_LAYOUT ═══
  else if (op.type === 'SET_AUTO_LAYOUT') {
    const node = await figma.getNodeByIdAsync(op.nodeId) as FrameNode | null;
    if (node && (node.type === 'FRAME' || node.type === 'COMPONENT' || node.type === 'COMPONENT_SET')) {
      node.layoutMode = op.layoutMode;
      if (op.primaryAxisSizingMode) node.primaryAxisSizingMode = op.primaryAxisSizingMode;
      if (op.counterAxisSizingMode) node.counterAxisSizingMode = op.counterAxisSizingMode;
      if (op.primaryAxisAlignItems) node.primaryAxisAlignItems = op.primaryAxisAlignItems;
      if (op.counterAxisAlignItems) node.counterAxisAlignItems = op.counterAxisAlignItems;
      if (op.layoutWrap) node.layoutWrap = op.layoutWrap;
      if (op.itemSpacing != null) node.itemSpacing = op.itemSpacing;
      if (op.counterAxisSpacing != null && 'counterAxisSpacing' in node) {
        (node as any).counterAxisSpacing = op.counterAxisSpacing;
      }
      if (op.paddingTop != null) node.paddingTop = op.paddingTop;
      if (op.paddingRight != null) node.paddingRight = op.paddingRight;
      if (op.paddingBottom != null) node.paddingBottom = op.paddingBottom;
      if (op.paddingLeft != null) node.paddingLeft = op.paddingLeft;
      if (op.strokesIncludedInLayout != null && 'strokesIncludedInLayout' in node) {
        (node as any).strokesIncludedInLayout = op.strokesIncludedInLayout;
      }
      if (op.layoutSizingHorizontal && 'layoutSizingHorizontal' in node) {
        (node as any).layoutSizingHorizontal = op.layoutSizingHorizontal;
      }
      if (op.layoutSizingVertical && 'layoutSizingVertical' in node) {
        (node as any).layoutSizingVertical = op.layoutSizingVertical;
      }
      pushSummary(`Editado layout @"${node.name}"`, node);
    }
  }

  // ═══ RESIZE ═══
  else if (op.type === 'RESIZE') {
    const node = await figma.getNodeByIdAsync(op.nodeId) as SceneNode | null;
    if (node && 'resize' in node) {
      (node as any).resize(op.width, op.height);
      pushSummary(`Redimensionado @"${node.name}"`, node);
    }
  }

  // ═══ MOVE ═══
  else if (op.type === 'MOVE') {
    const node = (op.ref ? createdNodes.get(op.ref) : null) as SceneNode | null
      ?? (op.nodeId ? await figma.getNodeByIdAsync(op.nodeId) as SceneNode | null : null);
    if (node) {
      node.x = op.x;
      node.y = op.y;
      pushSummary(`Movido @"${node.name}"`, node);
    }
  }

  // ═══ RENAME ═══
  else if (op.type === 'RENAME') {
    const node = await figma.getNodeByIdAsync(op.nodeId);
    if (node) {
      const oldName = node.name;
      node.name = op.name;
      pushSummary(`Renomeado @"${oldName}" → @"${op.name}"`, node);
    }
  }

  // ═══ SET_TEXT_CONTENT ═══
  else if (op.type === 'SET_TEXT_CONTENT') {
    const node = await figma.getNodeByIdAsync(op.nodeId) as TextNode | null;
    if (node && node.type === 'TEXT') {
      const fontsUsed: FontName[] = [];
      const seen = new Set<string>();
      try {
        const segments = node.getStyledTextSegments(['fontName']);
        for (const seg of segments) {
          const fn = seg.fontName as FontName;
          const key = `${fn.family}::${fn.style}`;
          if (!seen.has(key)) {
            seen.add(key);
            fontsUsed.push(fn);
            try { await figma.loadFontAsync(fn); } catch { /* skip */ }
          }
        }
      } catch {
        // Fallback
      }

      const wantsNewFont = op.fontFamily || op.fontStyle;
      let targetFont: FontName;
      if (wantsNewFont) {
        targetFont = { family: op.fontFamily ?? 'Inter', style: op.fontStyle ?? 'Regular' };
      } else if (fontsUsed.length === 1) {
        targetFont = fontsUsed[0];
      } else {
        targetFont = fontsUsed[0] ?? DEFAULT_FONT;
      }

      try {
        await figma.loadFontAsync(targetFont);
      } catch {
        await figma.loadFontAsync(DEFAULT_FONT);
        targetFont = DEFAULT_FONT;
      }

      node.fontName = targetFont;
      if (op.content != null && op.content !== '') {
        node.characters = op.content;
      }
      if (op.fontSize) node.fontSize = op.fontSize;
      if (op.fills) node.fills = op.fills as any;
      pushSummary(`Editado texto @"${node.name}"`, node);
    }
  }

  // ═══ SET_TEXT_STYLE ═══
  else if (op.type === 'SET_TEXT_STYLE') {
    const node = await figma.getNodeByIdAsync(op.nodeId) as TextNode | null;
    if (node && node.type === 'TEXT') {
      // Load fonts if changing font
      if (op.fontFamily || op.fontStyle) {
        const targetFont = { family: op.fontFamily ?? 'Inter', style: op.fontStyle ?? 'Regular' };
        try {
          await figma.loadFontAsync(targetFont);
          node.fontName = targetFont;
        } catch {
          // Keep existing font if new one fails
        }
      }

      if (op.fontSize) node.fontSize = op.fontSize;
      if (op.textAutoResize) node.textAutoResize = op.textAutoResize;
      if (op.textAlignHorizontal) node.textAlignHorizontal = op.textAlignHorizontal;
      if (op.textAlignVertical) node.textAlignVertical = op.textAlignVertical;
      if (op.lineHeight) node.lineHeight = op.lineHeight as LineHeight;
      if (op.letterSpacing) node.letterSpacing = op.letterSpacing as LetterSpacing;
      if (op.fills) node.fills = normalizeFills(op.fills) || [];

      pushSummary(`Estilizado texto @"${node.name}"`, node);
    }
  }

  // ═══ SET_OPACITY ═══
  else if (op.type === 'SET_OPACITY') {
    const node = await figma.getNodeByIdAsync(op.nodeId) as SceneNode | null;
    if (node && 'opacity' in node) {
      node.opacity = op.opacity;
      pushSummary(`Editado opacidade @"${node.name}"`, node);
    }
  }

  // ═══ APPLY_VARIABLE ═══
  else if (op.type === 'APPLY_VARIABLE') {
    const node = await figma.getNodeByIdAsync(op.nodeId) as SceneNode | null;
    if (node && figma.variables) {
      const variable = await figma.variables.getVariableByIdAsync(op.variableId);
      if (variable) {
        if (op.field === 'fills' || op.field === 'strokes') {
          const paintArray = (node as any)[op.field];
          if (paintArray && paintArray.length > 0) {
            const paintsCopy = [...paintArray];
            let targetPaint = paintsCopy[0];
            if (targetPaint.type !== 'SOLID') {
              targetPaint = { type: 'SOLID', color: { r: 0, g: 0, b: 0 }, opacity: 1 } as SolidPaint;
            }
            paintsCopy[0] = figma.variables.setBoundVariableForPaint(targetPaint, 'color', variable);
            (node as any)[op.field] = paintsCopy;
          }
        } else {
          if ('setBoundVariable' in node) {
            (node as any).setBoundVariable(op.field, variable);
          }
        }
      }
    }
  }

  // ═══ APPLY_STYLE ═══
  else if (op.type === 'APPLY_STYLE') {
    const node = await figma.getNodeByIdAsync(op.nodeId) as any;
    if (node) {
      if (op.styleType === 'FILL' && 'fillStyleId' in node) {
        if (typeof node.setFillStyleIdAsync === 'function') {
          await node.setFillStyleIdAsync(op.styleId);
        } else {
          node.fillStyleId = op.styleId;
        }
      } else if (op.styleType === 'TEXT' && 'textStyleId' in node) {
        if (typeof node.setTextStyleIdAsync === 'function') {
          await node.setTextStyleIdAsync(op.styleId);
        } else {
          node.textStyleId = op.styleId;
        }
      } else if (op.styleType === 'EFFECT' && 'effectStyleId' in node) {
        if (typeof node.setEffectStyleIdAsync === 'function') {
          await node.setEffectStyleIdAsync(op.styleId);
        } else {
          node.effectStyleId = op.styleId;
        }
      } else if (op.styleType === 'GRID' && 'gridStyleId' in node) {
        if (typeof node.setGridStyleIdAsync === 'function') {
          await node.setGridStyleIdAsync(op.styleId);
        } else {
          node.gridStyleId = op.styleId;
        }
      }
    }
  }

  // ═══ HIGH-FIDELITY MCP OPS ═══
  else if (op.type === 'GET_DESIGN_CONTEXT') {
    const nodeId = op.nodeId;
    const depth = op.depth || 5;
    let node: SceneNode | null = null;
    if (nodeId) node = (await figma.getNodeByIdAsync(nodeId)) as SceneNode;
    if (!node && figma.currentPage.selection.length > 0) node = figma.currentPage.selection[0];

    const context = node ? await serializeNode(node, 0, depth) : await serializeSelection();
    postToUI({ type: 'DESIGN_CONTEXT_RESULT', nodeId: node?.id || 'selection', context });
  }

  else if (op.type === 'GET_VARIABLE_DEFS') {
    const nodeId = op.nodeId;
    let nodes: readonly SceneNode[] = [];
    if (nodeId) {
      const n = await figma.getNodeByIdAsync(nodeId);
      if (n) nodes = [n as SceneNode];
    } else {
      nodes = figma.currentPage.selection;
    }

    const variables: any[] = [];
    const seen = new Set<string>();

    const collectFromNode = async (node: SceneNode) => {
      if ('boundVariables' in node && node.boundVariables) {
        for (const field in node.boundVariables) {
          const vars = (node.boundVariables as any)[field];
          const varArray = Array.isArray(vars) ? vars : [vars];
          for (const vRef of varArray) {
            if (vRef && vRef.id && !seen.has(vRef.id)) {
              seen.add(vRef.id);
              const v = await figma.variables.getVariableByIdAsync(vRef.id);
              if (v) variables.push({ id: v.id, name: v.name, type: v.resolvedType, valuesByMode: v.valuesByMode });
            }
          }
        }
      }
      if ('children' in node) {
        for (const child of (node as any).children) await collectFromNode(child);
      }
    };

    for (const n of nodes) await collectFromNode(n);
    postToUI({ type: 'VARIABLE_DEFS_RESULT', nodeId: nodeId || 'selection', variables });
  }

  else if (op.type === 'GET_SCREENSHOT') {
    const nodeId = op.nodeId;
    let node: SceneNode | null = null;
    if (nodeId) node = (await figma.getNodeByIdAsync(nodeId)) as SceneNode;
    if (!node && figma.currentPage.selection.length > 0) node = figma.currentPage.selection[0];

    if (node) {
      const bytes = await node.exportAsync({ format: 'JPG', constraint: { type: 'SCALE', value: 2 } });
      const base64 = figma.base64Encode(bytes);
      postToUI({ type: 'SCREENSHOT_RESULT', nodeId: node.id, base64: `data:image/jpeg;base64,${base64}` });
    }
  }

  else if (op.type === 'SEARCH_DESIGN_SYSTEM') {
    const query = op.query.toLowerCase();
    const results = { components: [] as any[], styles: [] as any[], variables: [] as any[] };

    const comps = figma.root.findAllWithCriteria({ types: ['COMPONENT', 'COMPONENT_SET'] });
    results.components = comps
      .filter(c => c.name.toLowerCase().includes(query))
      .slice(0, 20)
      .map(c => ({ id: c.id, name: c.name, key: (c as any).key }));

    const pStyles = await figma.getLocalPaintStylesAsync();
    const tStyles = await figma.getLocalTextStylesAsync();
    results.styles = [...pStyles, ...tStyles]
      .filter(s => s.name.toLowerCase().includes(query))
      .slice(0, 20)
      .map(s => ({ id: s.id, name: s.name, type: s.type }));

    if (figma.variables) {
      const vars = await figma.variables.getLocalVariablesAsync();
      results.variables = vars
        .filter(v => v.name.toLowerCase().includes(query))
        .slice(0, 20)
        .map(v => ({ id: v.id, name: v.name, type: v.resolvedType }));
    }

    postToUI({ type: 'SEARCH_DS_RESULT', results });
  }

  else if (op.type === 'GET_CODE_CONNECT_MAP') {
    const raw = figma.root.getPluginData('codeConnectMap');
    const mappings = raw ? JSON.parse(raw) : {};
    postToUI({ type: 'CODE_CONNECT_RESULT', mappings });
  }

  else if (op.type === 'ADD_CODE_CONNECT_MAP') {
    const raw = figma.root.getPluginData('codeConnectMap');
    const mappings = raw ? JSON.parse(raw) : {};
    mappings[op.nodeId] = { componentName: op.componentName, filePath: op.filePath };
    figma.root.setPluginData('codeConnectMap', JSON.stringify(mappings));
    pushSummary(`Mapeado @"${op.componentName}" para code connect`);
  }

  // ═══ GROUP_NODES ═══
  else if (op.type === 'GROUP_NODES') {
    const nodes: SceneNode[] = [];
    for (const id of op.nodeIds) {
      const n = await figma.getNodeByIdAsync(id);
      if (n && 'parent' in n) nodes.push(n as SceneNode);
    }
    if (nodes.length > 0) {
      const parent = nodes[0].parent as BaseNode & ChildrenMixin;
      const group = figma.group(nodes, parent);
      group.name = op.name;
      pushSummary(`Agrupado @"${op.name}"`, group);
    }
  }

  // ═══ UNGROUP ═══
  else if (op.type === 'UNGROUP') {
    const node = await figma.getNodeByIdAsync(op.nodeId) as SceneNode | null;
    if (node && 'children' in node) {
      const name = node.name;
      figma.ungroup(node as SceneNode & ChildrenMixin);
      pushSummary(`Desagrupado @"${name}"`);
    }
  }

  // ═══ DETACH_INSTANCE ═══
  else if (op.type === 'DETACH_INSTANCE') {
    const node = await figma.getNodeByIdAsync(op.nodeId) as InstanceNode | null;
    if (node && node.type === 'INSTANCE') {
      node.detachInstance();
      pushSummary(`Detached @"${node.name}"`, node);
    }
  }

  // ═══ CREATE_COMPONENT ═══
  else if (op.type === 'CREATE_COMPONENT') {
    const parent = await getParent(op.parentRef, op.parentNodeId);
    const comp = figma.createComponent();
    comp.name = op.props.name;
    const cw = op.props.width > 0 ? op.props.width : 100;
    const ch = op.props.height > 0 ? op.props.height : 100;
    comp.resize(cw, ch);

    if (op.props.description) comp.description = op.props.description;
    if (op.props.layoutMode && op.props.layoutMode !== 'NONE') {
      comp.layoutMode = op.props.layoutMode;
      comp.primaryAxisSizingMode = op.props.primaryAxisSizingMode ?? 'AUTO';
      comp.counterAxisSizingMode = op.props.counterAxisSizingMode ?? 'AUTO';
      comp.primaryAxisAlignItems = op.props.primaryAxisAlignItems ?? 'MIN';
      comp.counterAxisAlignItems = op.props.counterAxisAlignItems ?? 'MIN';
      comp.itemSpacing = op.props.itemSpacing ?? 0;
      comp.paddingTop = op.props.paddingTop ?? 0;
      comp.paddingRight = op.props.paddingRight ?? 0;
      comp.paddingBottom = op.props.paddingBottom ?? 0;
      comp.paddingLeft = op.props.paddingLeft ?? 0;
    }
    if (op.props.fills) comp.fills = normalizeFills(op.props.fills) || [];
    if (op.props.cornerRadius != null) comp.cornerRadius = op.props.cornerRadius;

    parent.appendChild(comp);
    if (op.props.layoutSizingHorizontal && parent !== figma.currentPage) {
      comp.layoutSizingHorizontal = op.props.layoutSizingHorizontal;
    }
    if (op.props.layoutSizingVertical && parent !== figma.currentPage) {
      comp.layoutSizingVertical = op.props.layoutSizingVertical;
    }
    if (op.ref) createdNodes.set(op.ref, comp);
    pushSummary(`Componente criado @"${comp.name}"`, comp);
  }

  // ═══ COMBINE_AS_VARIANTS ═══
  else if (op.type === 'COMBINE_AS_VARIANTS') {
    const components: ComponentNode[] = [];
    for (const ref of op.componentRefs) {
      const node = createdNodes.get(ref);
      if (node && node.type === 'COMPONENT') components.push(node as ComponentNode);
    }
    if (components.length >= 1) {
      const parent = components[0].parent as BaseNode & ChildrenMixin;
      const set = figma.combineAsVariants(components, parent);
      set.name = op.name;
      if (op.ref) createdNodes.set(op.ref, set);
      pushSummary(`Variantes combinadas @"${op.name}"`, set);
    }
  }

  // ═══ CREATE_SVG ═══
  else if (op.type === 'CREATE_SVG') {
    const parent = await getParent(op.parentRef, op.parentNodeId);
    try {
      const svgFrame = figma.createNodeFromSvg(op.svgString);
      if (op.name) svgFrame.name = op.name;
      if (op.width && op.height) svgFrame.resize(op.width, op.height);
      parent.appendChild(svgFrame);
      if (op.ref) createdNodes.set(op.ref, svgFrame);
      pushSummary(`SVG criado @"${op.name || 'svg'}"`, svgFrame);
    } catch (e) {
      postToUI({ type: 'ERROR', message: `Erro ao criar SVG: ${String(e)}` });
    }
  }

  // ═══ CREATE_LINE ═══
  else if (op.type === 'CREATE_LINE') {
    const parent = await getParent(op.parentRef, op.parentNodeId);
    const line = figma.createLine();
    line.name = op.props.name;
    line.resize(op.props.width > 0 ? op.props.width : 100, 1);
    if (op.props.strokes) line.strokes = op.props.strokes as any;
    if (op.props.strokeWeight != null) line.strokeWeight = op.props.strokeWeight;
    parent.appendChild(line);
    if (op.ref) createdNodes.set(op.ref, line);
    pushSummary(`Linha criada @"${line.name}"`, line);
  }

  // ═══ CREATE_POLYGON ═══
  else if (op.type === 'CREATE_POLYGON') {
    const parent = await getParent(op.parentRef, op.parentNodeId);
    const polygon = figma.createPolygon();
    polygon.name = op.props.name;
    polygon.pointCount = op.props.pointCount;
    polygon.resize(op.props.width > 0 ? op.props.width : 100, op.props.height > 0 ? op.props.height : 100);
    if (op.props.fills) polygon.fills = normalizeFills(op.props.fills) || [];
    parent.appendChild(polygon);
    if (op.ref) createdNodes.set(op.ref, polygon);
    pushSummary(`Polígono criado @"${polygon.name}"`, polygon);
  }

  // ═══ CREATE_STAR ═══
  else if (op.type === 'CREATE_STAR') {
    const parent = await getParent(op.parentRef, op.parentNodeId);
    const star = figma.createStar();
    star.name = op.props.name;
    star.pointCount = op.props.pointCount;
    star.innerRadius = op.props.innerRadius ?? 0.4;
    star.resize(op.props.width > 0 ? op.props.width : 100, op.props.height > 0 ? op.props.height : 100);
    if (op.props.fills) star.fills = normalizeFills(op.props.fills) || [];
    parent.appendChild(star);
    if (op.ref) createdNodes.set(op.ref, star);
    pushSummary(`Estrela criada @"${star.name}"`, star);
  }

  // ═══ SET_TEXT_RANGES ═══
  else if (op.type === 'SET_TEXT_RANGES') {
    const node = await figma.getNodeByIdAsync(op.nodeId) as TextNode | null;
    if (node && node.type === 'TEXT') {
      for (const range of op.ranges) {
        if (range.fontFamily || range.fontStyle) {
          const targetFont: FontName = {
            family: range.fontFamily ?? 'Inter',
            style: range.fontStyle ?? 'Regular'
          };
          try {
            await figma.loadFontAsync(targetFont);
            node.setRangeFontName(range.start, range.end, targetFont);
          } catch {
            // Skip font load errors
          }
        }
        if (range.fontSize != null) {
          node.setRangeFontSize(range.start, range.end, range.fontSize);
        }
        if (range.fills) {
          node.setRangeFills(range.start, range.end, range.fills as any);
        }
        if (range.textDecoration) {
          node.setRangeTextDecoration(range.start, range.end, range.textDecoration as any);
        }
        if (range.textCase && range.textCase !== 'ORIGINAL') {
          node.setRangeTextCase(range.start, range.end, range.textCase);
        }
        if (range.letterSpacing) {
          node.setRangeLetterSpacing(range.start, range.end, range.letterSpacing);
        }
        if (range.lineHeight) {
          node.setRangeLineHeight(range.start, range.end, range.lineHeight);
        }
      }
      pushSummary(`Formatação de texto aplicada @"${node.name}"`, node);
    }
  }

  // ═══ CLONE_NODE / DUPLICATE_NODE ═══
  else if (op.type === 'CLONE_NODE' || op.type === 'DUPLICATE_NODE') {
    const sourceName = op.type === 'CLONE_NODE' ? op.sourceName : undefined;
    const sourceScope = op.type === 'CLONE_NODE' ? op.sourceScope : undefined;

    if (!op.sourceNodeId && !sourceName) {
      postToUI({ type: 'ERROR', message: 'CLONE_NODE: sourceNodeId ou sourceName é obrigatório' });
      return;
    }

    let sourceNode: BaseNode | null = null;

    // Buscar por nome (mais robusto) ou por ID
    if (sourceName) {
      const scope = sourceScope === 'page' ? figma.currentPage : figma.root;
      sourceNode = scope.findOne(n => n.name === sourceName);
      if (!sourceNode) {
        postToUI({ type: 'ERROR', message: `CLONE_NODE: Nó com nome "${sourceName}" não encontrado` });
        return;
      }
    } else {
      sourceNode = await figma.getNodeByIdAsync(op.sourceNodeId!);
      if (!sourceNode) {
        postToUI({ type: 'ERROR', message: `CLONE_NODE: Nó "${op.sourceNodeId}" não encontrado` });
        return;
      }
    }

    if (typeof (sourceNode as any).clone !== 'function') {
      postToUI({ type: 'ERROR', message: `CLONE_NODE: Nó "${sourceNode.name}" não suporta clone (tipo: ${sourceNode.type})` });
      return;
    }

    const parent = await getParent(op.parentRef, op.parentNodeId);

    try {
      const cloned = (sourceNode as SceneNode).clone();
      if (op.overrides?.name) cloned.name = op.overrides.name;
      if (op.overrides?.width && 'resize' in cloned) {
        (cloned as any).resize(op.overrides.width, op.overrides.height || (cloned as any).height);
      }
      if (op.overrides?.fills && 'fills' in cloned) {
        (cloned as any).fills = op.overrides.fills as any;
      }

      parent.appendChild(cloned);
      if (op.ref) createdNodes.set(op.ref, cloned);

      // Text overrides
      if (op.textOverrides && Array.isArray(op.textOverrides)) {
        const findTextByName = (node: SceneNode, targetName: string): TextNode | null => {
          if (node.type === 'TEXT' && node.name === targetName) return node;
          if ('children' in node) {
            for (const child of (node as FrameNode).children) {
              const found = findTextByName(child, targetName);
              if (found) return found;
            }
          }
          return null;
        };

        for (const override of op.textOverrides) {
          const textNode = findTextByName(cloned, override.name);
          if (textNode) {
            const fontName = typeof textNode.fontName !== 'symbol' ? textNode.fontName : DEFAULT_FONT;
            try {
              await figma.loadFontAsync(fontName);
            } catch {
              await figma.loadFontAsync(DEFAULT_FONT);
            }
            textNode.characters = override.content;
            pushSummary(`Texto "${override.name}" → "${override.content.slice(0, 30)}..."`, textNode);
          }
        }
      }

      pushSummary(`Clonado @"${cloned.name}"`, cloned);
    } catch (e) {
      postToUI({ type: 'ERROR', message: `Clone falhou: ${String(e)}` });
    }
  }

  // ═══ REORDER_CHILD ═══
  else if (op.type === 'REORDER_CHILD') {
    const node = await figma.getNodeByIdAsync(op.nodeId) as any;
    const parent = await figma.getNodeByIdAsync(op.parentNodeId);
    if (node && parent && 'children' in parent) {
      const parentFrame = parent as BaseNode & ChildrenMixin;
      if (op.index >= 0 && op.index <= parentFrame.children.length) {
        try {
          if (node.parent !== parent) {
            node.remove();
          }
          parentFrame.insertChild(op.index, node as SceneNode);
          pushSummary(`Reordenado @"${node.name}"`, node);
        } catch (e) {
          postToUI({ type: 'ERROR', message: `Reordenamento falhou: ${String(e)}` });
        }
      }
    }
  }

  // ═══ SET_CONSTRAINTS ═══
  else if (op.type === 'SET_CONSTRAINTS') {
    const node = await figma.getNodeByIdAsync(op.nodeId);
    if (node && 'constraints' in node) {
      (node as any).constraints = {
        horizontal: op.horizontal,
        vertical: op.vertical,
      };
      pushSummary(`Constraints definidas @"${(node as any).name}"`, node as SceneNode);
    }
  }

  // ═══ SET_LAYOUT_GRID ═══
  else if (op.type === 'SET_LAYOUT_GRID') {
    const node = await figma.getNodeByIdAsync(op.nodeId);
    if (node && 'layoutGrids' in node) {
      (node as any).layoutGrids = op.grids.map((g: any) => ({
        pattern: g.pattern,
        alignment: g.alignment ?? 'MIN',
        count: g.count,
        gutterSize: g.gutterSize ?? 0,
        offset: g.offset ?? 0,
        sectionSize: g.sectionSize,
        visible: g.visible ?? true,
        color: g.color ?? { r: 0, g: 0, b: 0, a: 0.1 },
      }));
      pushSummary(`Grid definido @"${(node as any).name}"`, node as SceneNode);
    }
  }

  // ═══ CREATE_VARIABLE ═══
  else if (op.type === 'CREATE_VARIABLE') {
    if (figma.variables) {
      try {
        const collections = (figma.variables as any).getLocalVariableCollections?.() || [];
        let collection = collections.find((c: any) => c.name === op.collectionName);

        if (!collection) {
          collection = (figma.variables as any).createVariableCollection?.(op.collectionName);
        }

        if (collection) {
          const variable = (figma.variables as any).createVariable?.(op.name, collection.id, op.resolvedType);
          if (variable) {
            variable.setValueForMode(collection.defaultModeId, op.value);
            if (op.ref) createdNodes.set(op.ref, variable as any);
            pushSummary(`Variável criada: ${op.name}`);
          }
        }
      } catch (e) {
        postToUI({ type: 'ERROR', message: `Erro ao criar variável: ${String(e)}` });
      }
    }
  }

  // ═══ SET_BLEND_MODE ═══
  else if (op.type === 'SET_BLEND_MODE') {
    const node = await figma.getNodeByIdAsync(op.nodeId);
    if (node && 'blendMode' in node) {
      (node as any).blendMode = op.blendMode;
      pushSummary(`Blend mode definido @"${(node as any).name}"`, node as SceneNode);
    }
  }

  // ═══ SET_INDIVIDUAL_CORNERS ═══
  else if (op.type === 'SET_INDIVIDUAL_CORNERS') {
    const node = await figma.getNodeByIdAsync(op.nodeId);
    if (node && 'topLeftRadius' in node) {
      if (op.topLeftRadius != null) (node as any).topLeftRadius = op.topLeftRadius;
      if (op.topRightRadius != null) (node as any).topRightRadius = op.topRightRadius;
      if (op.bottomLeftRadius != null) (node as any).bottomLeftRadius = op.bottomLeftRadius;
      if (op.bottomRightRadius != null) (node as any).bottomRightRadius = op.bottomRightRadius;
      if (op.cornerSmoothing != null) (node as any).cornerSmoothing = op.cornerSmoothing;
      pushSummary(`Corners individuais definidos @"${(node as any).name}"`, node as SceneNode);
    }
  }

  // ═══ BOOLEAN_OPERATION ═══
  else if (op.type === 'BOOLEAN_OPERATION') {
    const nodes: SceneNode[] = [];
    for (const id of op.nodeIds || []) {
      const n = await figma.getNodeByIdAsync(id);
      if (n) nodes.push(n as SceneNode);
    }
    for (const ref of op.nodeRefs || []) {
      const n = createdNodes.get(ref);
      if (n) nodes.push(n as SceneNode);
    }

    if (nodes.length >= 2) {
      try {
        const parent = nodes[0].parent as BaseNode & ChildrenMixin;
        let result: BooleanOperationNode | undefined;

        switch (op.operation) {
          case 'UNION':
            result = figma.union(nodes, parent);
            break;
          case 'SUBTRACT':
            result = figma.subtract(nodes, parent);
            break;
          case 'INTERSECT':
            result = figma.intersect(nodes, parent);
            break;
          case 'EXCLUDE':
            result = figma.exclude(nodes, parent);
            break;
        }

        if (result) {
          if (op.name) result.name = op.name;
          if (op.ref) createdNodes.set(op.ref, result);
          pushSummary(`Operação booleana (${op.operation}) @"${op.name || 'result'}"`, result);
        }
      } catch (e) {
        postToUI({ type: 'ERROR', message: `Operação booleana falhou: ${String(e)}` });
      }
    }
  }

  // ═══ DELETE_NODE ═══
  else if (op.type === 'DELETE_NODE') {
    const node = await figma.getNodeByIdAsync(op.nodeId);
    if (node) {
      pushSummary(`Removido @"${node.name}"`);
      node.remove();
    }
  }
}

/**
 * Map effect definitions to Figma Effect objects
 */
function mapEffects(effects: any[]): Effect[] {
  return effects.map(e => {
    if (e.type === 'LAYER_BLUR' || e.type === 'BACKGROUND_BLUR') {
      return { type: e.type, radius: e.radius, visible: e.visible ?? true } as Effect;
    }
    return {
      type: e.type as 'DROP_SHADOW' | 'INNER_SHADOW',
      color: e.color ?? { r: 0, g: 0, b: 0, a: 0.25 },
      offset: e.offset ?? { x: 0, y: 4 },
      radius: e.radius,
      spread: e.spread ?? 0,
      visible: e.visible ?? true,
      blendMode: 'NORMAL' as BlendMode,
    } as Effect;
  });
}
