/// <reference types="@figma/plugin-typings" />

import type { FigmaOperation } from '../../../src/lib/figma-types';
import { postToUI } from '../utils/postMessage';
import { ensurePagesLoaded, setPagesLoaded, setCanUndo, DEFAULT_FONT } from '../state';
import { serializeNode, serializeSelection } from '../utils/serialize';
import { colorDistance } from '../utils/colors';

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
/**
 * Applies Figma variables to a set of fills if variableId is present
 */
async function applyVariablesToFills(fills: Paint[]): Promise<Paint[]> {
  if (!figma.variables) {
    // Cleanup variableId even if variables API is not available
    return fills.map(f => {
      const copy = { ...f };
      delete (copy as any).variableId;
      return copy;
    });
  }
  
  const results: Paint[] = [];
  for (const fill of fills) {
    const variableId = (fill as any).variableId;
    const cleanFill = { ...fill };
    delete (cleanFill as any).variableId;
    
    if (fill.type === 'SOLID' && variableId) {
      try {
        const variable = await figma.variables.getVariableByIdAsync(variableId);
        if (variable) {
          results.push(figma.variables.setBoundVariableForPaint(cleanFill as SolidPaint, 'color', variable));
          continue;
        }
      } catch (err) {
        console.warn(`Failed to apply variable ${variableId} to fill:`, err);
      }
    }
    results.push(cleanFill as Paint);
  }
  return results;
}

function normalizeFills(fills: any): Paint[] | undefined {
  if (!fills || !Array.isArray(fills)) return undefined;

  const validTypes = ['SOLID', 'GRADIENT_LINEAR', 'GRADIENT_RADIAL', 'GRADIENT_ANGULAR', 'GRADIENT_DIAMOND', 'IMAGE', 'VIDEO'];

  return fills.map((fill: any) => {
    // Already valid format
    if (fill.type && validTypes.includes(fill.type)) {
      // Ensure color is in correct format { r, g, b }
      if (fill.type === 'SOLID' && fill.color) {
        const fullColor = normalizeColor(fill.color);
        const { a, ...rgbColor } = fullColor;
        return { 
          ...fill, 
          color: rgbColor,
          opacity: a ?? fill.opacity ?? 1
        };
      }
      
      // Handle Gradients (which often lack position or transform from AI)
      if (fill.type.startsWith('GRADIENT_')) {
        if (!fill.gradientStops) return null;
        
        fill.gradientStops = fill.gradientStops.map((stop: any) => {
          const colorObj = stop.color || stop;
          const normalizedColor = normalizeColor(colorObj);
          return {
            color: {
              r: normalizedColor.r,
              g: normalizedColor.g,
              b: normalizedColor.b,
              a: (colorObj as any).a ?? 1
            },
            position: stop.position ?? stop.offset ?? 0
          };
        });

        if (!fill.gradientTransform) {
          // Default: top-to-bottom identity-ish matrix
          fill.gradientTransform = [[1, 0, 0], [0, 1, 0]];
        }
      }

      // Handle Image detection from AI (which won't have a hash)
      if (fill.type === 'IMAGE' && !fill.imageHash) {
        return {
          type: 'SOLID',
          color: { r: 0.9, g: 0.92, b: 0.95 },
          opacity: 1
        } as SolidPaint;
      }
      
      return fill;
    }

    // Convert hex string or invalid format to SOLID
    let colorInput = fill;
    if (fill.color) colorInput = fill.color;
    else if (fill.hex) colorInput = fill.hex;
    else if (fill.r !== undefined) colorInput = fill;

    const fullColor = normalizeColor(colorInput);
    const { a, ...rgbColor } = fullColor;

    return {
      type: 'SOLID' as const,
      color: rgbColor,
      opacity: a ?? (typeof fill === 'object' ? fill.opacity : 1) ?? 1,
      variableId: (typeof fill === 'object' ? fill.variableId : undefined)
    };
  }).filter(Boolean) as Paint[];
}

/**
 * Normalize color to Figma format { r, g, b } with values 0-1
 */
function normalizeColor(color: any): RGB & { a?: number } {
  if (!color) return { r: 0, g: 0, b: 0 };

  let r = 0, g = 0, b = 0, a = color.a ?? 1;

  if (typeof color === 'string') {
    const rgb = hexToRgb(color);
    r = rgb.r; g = rgb.g; b = rgb.b;
  } else if (typeof color.r === 'number') {
    const factor = (color.r > 1 || color.g > 1 || color.b > 1) ? 255 : 1;
    r = color.r / factor;
    g = color.g / factor;
    b = color.b / factor;
  }

  const result: RGB & { a?: number } = {
    r: Math.max(0, Math.min(1, r)),
    g: Math.max(0, Math.min(1, g)),
    b: Math.max(0, Math.min(1, b))
  };
  
  if (color.a !== undefined || typeof color === 'string') {
    result.a = Math.max(0, Math.min(1, a));
  }
  
  return result;
}

/**
 * Robustly normalize to RGBA for effects and other properties that require it
 */
function normalizeRGBA(color: any): RGBA {
  const c = normalizeColor(color);
  return {
    r: c.r,
    g: c.g,
    b: c.b,
    a: (color && typeof color === 'object' && color.a !== undefined) ? color.a : (c.a ?? 1)
  };
}

/**
 * Parse line height from various formats
 */
function parseLineHeight(lh: any): LineHeight {
  if (typeof lh === 'number') return { value: lh, unit: 'PIXELS' };
  if (typeof lh === 'string') {
    const clean = lh.trim().toUpperCase();
    if (clean === 'AUTO') return { unit: 'AUTO' };
    if (clean.endsWith('%')) {
      const val = parseFloat(clean);
      if (!isNaN(val)) return { value: val, unit: 'PERCENT' };
    }
    const val = parseFloat(clean);
    if (!isNaN(val)) return { value: val, unit: 'PIXELS' };
  }
  return lh as LineHeight;
}

/**
 * Parse letter spacing from various formats
 */
function parseLetterSpacing(ls: any): LetterSpacing {
  if (typeof ls === 'number') return { value: ls, unit: 'PIXELS' };
  if (typeof ls === 'string') {
    const clean = ls.trim().toUpperCase();
    if (clean.endsWith('%')) {
      const val = parseFloat(clean);
      if (!isNaN(val)) return { value: val, unit: 'PERCENT' };
    }
    const val = parseFloat(clean);
    if (!isNaN(val)) return { value: val, unit: 'PIXELS' };
  }
  return ls as LetterSpacing;
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
  // Snapshot selection before processing — user may deselect during async ops
  const snapshotSelection: readonly SceneNode[] = [...figma.currentPage.selection];

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
    // debug only: console.debug('[OPERATION]', op.type);

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
      await processOperation(op, { createdNodes, createdPages, pushSummary, getParent, snapshotSelection });

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
  const telemetry = auditCreatedNodes(rootNodes);
  postToUI({ type: 'OPERATIONS_DONE', count: ops.length, summary, summaryItems, canUndo: true, nodeIdMap, telemetry });
}

// ─── Telemetry: static audit of generated tree ───────────────────────────────
// Cheap, deterministic checks. No LLM. Catches the recurring "FIXED where it
// should be HUG / clipping / structural white frame" classes of error so we
// can refine the prompt with data instead of screenshots.
interface AuditViolation { node: string; rule: string; detail?: string }
interface AuditReport {
  rootCount: number;
  nodeCount: number;
  violations: AuditViolation[];
  stats: { fixed: number; hug: number; fill: number; whiteFrames: number; textNodes: number };
}

function auditCreatedNodes(roots: SceneNode[]): AuditReport {
  const violations: AuditViolation[] = [];
  const stats = { fixed: 0, hug: 0, fill: 0, whiteFrames: 0, textNodes: 0 };
  let nodeCount = 0;

  function isWhiteSolid(fill: Paint): boolean {
    if (fill.type !== 'SOLID' || fill.visible === false) return false;
    const c = (fill as SolidPaint).color;
    return c.r > 0.97 && c.g > 0.97 && c.b > 0.97;
  }

  function walk(node: SceneNode, depth: number) {
    nodeCount++;
    const anyNode = node as any;

    // Sizing tally
    if ('layoutSizingHorizontal' in anyNode) {
      const h = anyNode.layoutSizingHorizontal;
      if (h === 'FIXED') stats.fixed++;
      else if (h === 'HUG') stats.hug++;
      else if (h === 'FILL') stats.fill++;
    }

    // TEXT clipping / FIXED-on-text
    if (node.type === 'TEXT') {
      stats.textNodes++;
      const t = node as TextNode;
      if (t.textTruncation === 'ENDING') {
        violations.push({ node: t.name, rule: 'text-truncated' });
      }
      if (anyNode.layoutSizingHorizontal === 'FIXED' && anyNode.layoutSizingVertical === 'FIXED') {
        violations.push({ node: t.name, rule: 'text-double-fixed' });
      }
    }

    // FRAME checks
    if (node.type === 'FRAME' || node.type === 'COMPONENT' || node.type === 'INSTANCE') {
      const f = node as FrameNode;

      // Auto-layout child should default to HUG, not FIXED
      const parent = node.parent as any;
      const inAutoLayout = parent && 'layoutMode' in parent && parent.layoutMode && parent.layoutMode !== 'NONE';
      if (inAutoLayout && depth > 0) {
        if (anyNode.layoutSizingVertical === 'FIXED' && f.layoutMode && f.layoutMode !== 'NONE') {
          violations.push({ node: f.name, rule: 'should-be-hug-vertical' });
        }
      }

      // Structural white frame: solid white fill on a non-root grouping container
      if (depth > 0 && Array.isArray(f.fills) && f.fills.length > 0) {
        const hasWhite = (f.fills as Paint[]).some(isWhiteSolid);
        if (hasWhite && f.children && f.children.length > 0) {
          stats.whiteFrames++;
          violations.push({ node: f.name, rule: 'structural-white-frame' });
        }
      }

      // Children overflow parent box (simple bounds check)
      if (f.children) {
        for (const child of f.children) {
          if ('width' in child && 'x' in child) {
            if (child.x + child.width > f.width + 0.5 || child.y + child.height > f.height + 0.5) {
              violations.push({ node: child.name, rule: 'overflows-parent', detail: f.name });
              break; // one per frame is enough
            }
          }
        }
      }
    }

    if ('children' in node) {
      for (const child of (node as any).children as SceneNode[]) walk(child, depth + 1);
    }
  }

  for (const r of roots) walk(r, 0);
  return { rootCount: roots.length, nodeCount, violations, stats };
}

interface OperationContext {
  createdNodes: Map<string, SceneNode>;
  createdPages: Map<string, PageNode>;
  pushSummary: (text: string, node?: SceneNode | BaseNode | null) => void;
  getParent: (parentRef?: string, parentNodeId?: string) => Promise<BaseNode & ChildrenMixin>;
  snapshotSelection: readonly SceneNode[];
}

async function processOperation(op: FigmaOperation, ctx: OperationContext) {
  const { createdNodes, createdPages, pushSummary, getParent, snapshotSelection } = ctx;

  // Resiliency: prioritize op.props but fallback to op root for flat JSON objects
  const rawOp = op as any;
  const props = rawOp.props || rawOp;

  /**
   * Helper to apply common positioning and layout props to a node
   */
  const applyCommonProps = (node: SceneNode, p: any, parent: BaseNode & ChildrenMixin) => {
    const anyNode = node as any;
    const parentIsAutoLayout = 'layoutMode' in parent && (parent as any).layoutMode !== 'NONE';

    // Handle Absolute Positioning in Auto Layout
    if (parentIsAutoLayout && p.layoutPositioning === 'ABSOLUTE' && 'layoutPositioning' in anyNode) {
      anyNode.layoutPositioning = 'ABSOLUTE';
    }

    // Handle X, Y (only if not governed by Auto Layout)
    const governsLayout = parentIsAutoLayout && (!('layoutPositioning' in anyNode) || anyNode.layoutPositioning !== 'ABSOLUTE');
    if (!governsLayout) {
      if (p.x !== undefined) anyNode.x = p.x;
      if (p.y !== undefined) anyNode.y = p.y;
    }

    if (p.rotation !== undefined) anyNode.rotation = p.rotation;
    if (p.opacity !== undefined) anyNode.opacity = p.opacity;
    if (p.blendMode && 'blendMode' in anyNode) anyNode.blendMode = p.blendMode;
    if (p.visible !== undefined) anyNode.visible = p.visible;
    
    // Explicit sizing for absolute/free elements
    if (!governsLayout) {
      if (p.width > 0 && p.height > 0) anyNode.resize(p.width, p.height);
    }
  };

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
    frame.fills = []; // Começa transparente por padrão
    frame.name = props.name || 'Frame';
    const fw = props.width > 0 ? props.width : 100;
    const fh = props.height > 0 ? props.height : 100;
    frame.resize(fw, fh);

    // Auto-layout
    if (props.layoutMode && props.layoutMode !== 'NONE') {
      frame.layoutMode = props.layoutMode;
      frame.primaryAxisSizingMode = props.primaryAxisSizingMode ?? 'FIXED';
      frame.counterAxisSizingMode = props.counterAxisSizingMode ?? 'FIXED';
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

    if (props.fills) {
      const normalized = normalizeFills(props.fills) || [];
      frame.fills = await applyVariablesToFills(normalized);
    }
    if (props.cornerRadius != null) frame.cornerRadius = props.cornerRadius;
    if (props.cornerSmoothing != null) frame.cornerSmoothing = props.cornerSmoothing;
    if (props.clipsContent != null) frame.clipsContent = props.clipsContent;
    if (props.strokes) {
      const normalized = normalizeFills(props.strokes) || [];
      frame.strokes = await applyVariablesToFills(normalized);
    }
    if (props.strokeWeight != null) frame.strokeWeight = props.strokeWeight;
    if (props.opacity != null) frame.opacity = props.opacity;
    if (props.effects) frame.effects = mapEffects(props.effects);

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
          const cols = props.gridCols || 4;
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
      const parentIsAutoLayout = 'layoutMode' in parent && (parent as any).layoutMode !== 'NONE';
      if (parentIsAutoLayout) {
        if (props.layoutSizingHorizontal) frame.layoutSizingHorizontal = props.layoutSizingHorizontal;
        if (props.layoutSizingVertical) frame.layoutSizingVertical = props.layoutSizingVertical;
      }
    }

    applyCommonProps(frame, props, parent);

    if (op.ref) createdNodes.set(op.ref, frame);
    pushSummary(`Criado @"${frame.name}"`, frame);
  }

  // ═══ CREATE_RECTANGLE ═══
  else if (op.type === 'CREATE_RECTANGLE') {
    const parent = await getParent(op.parentRef, op.parentNodeId);
    const rect = figma.createRectangle();
    rect.fills = []; // Começa transparente por padrão
    rect.name = props.name || 'Retângulo';
    rect.resize(props.width > 0 ? props.width : 100, props.height > 0 ? props.height : 100);
    if (props.fills) {
      const normalized = normalizeFills(props.fills) || [];
      rect.fills = await applyVariablesToFills(normalized);
    }
    if (props.cornerRadius != null) rect.cornerRadius = props.cornerRadius;
    if (props.strokes) {
      const normalized = normalizeFills(props.strokes) || [];
      rect.strokes = await applyVariablesToFills(normalized);
    }
    if (props.strokeWeight != null) rect.strokeWeight = props.strokeWeight;
    if (props.opacity != null) rect.opacity = props.opacity;
    if (props.effects) rect.effects = mapEffects(props.effects);
    if (props.constraints && 'constraints' in rect) (rect as any).constraints = props.constraints;
    parent.appendChild(rect);

    if (parent !== figma.currentPage && parent.type !== 'PAGE') {
      const parentIsAutoLayout = 'layoutMode' in parent && (parent as any).layoutMode !== 'NONE';
      if (parentIsAutoLayout) {
        if (props.layoutSizingHorizontal) rect.layoutSizingHorizontal = props.layoutSizingHorizontal;
        if (props.layoutSizingVertical) rect.layoutSizingVertical = props.layoutSizingVertical;
      }
    }

    applyCommonProps(rect, props, parent);

    if (op.ref) createdNodes.set(op.ref, rect);
    pushSummary(`Criado @"${rect.name}"`, rect);
  }

  // ═══ CREATE_ELLIPSE ═══
  else if (op.type === 'CREATE_ELLIPSE') {
    const parent = await getParent(op.parentRef, op.parentNodeId);
    const ellipse = figma.createEllipse();
    ellipse.fills = []; // Começa transparente por padrão
    ellipse.name = props.name || 'Elipse';
    ellipse.resize(props.width > 0 ? props.width : 100, props.height > 0 ? props.height : 100);
    if (props.fills) {
      const normalized = normalizeFills(props.fills) || [];
      ellipse.fills = await applyVariablesToFills(normalized);
    }
    if (props.strokes) {
      const normalized = normalizeFills(props.strokes) || [];
      ellipse.strokes = await applyVariablesToFills(normalized);
    }
    if (props.strokeWeight != null) ellipse.strokeWeight = props.strokeWeight;
    if (props.opacity != null) ellipse.opacity = props.opacity;
    if (props.effects) ellipse.effects = mapEffects(props.effects);
    if (props.constraints && 'constraints' in ellipse) (ellipse as any).constraints = props.constraints;
    parent.appendChild(ellipse);

    if (parent !== figma.currentPage && parent.type !== 'PAGE') {
      const parentIsAutoLayout = 'layoutMode' in parent && (parent as any).layoutMode !== 'NONE';
      if (parentIsAutoLayout) {
        if (props.layoutSizingHorizontal) ellipse.layoutSizingHorizontal = props.layoutSizingHorizontal;
        if (props.layoutSizingVertical) ellipse.layoutSizingVertical = props.layoutSizingVertical;
      }
    }

    applyCommonProps(ellipse, props, parent);

    if (op.ref) createdNodes.set(op.ref, ellipse);
    pushSummary(`Criado @"${ellipse.name}"`, ellipse);
  }

  // ═══ CREATE_TEXT ═══
  else if (op.type === 'CREATE_TEXT') {
    let fontStyle = props.fontStyle;
    if (!fontStyle && props.fontWeight) {
      const weight = props.fontWeight;
      if (weight <= 100) fontStyle = 'Thin';
      else if (weight <= 200) fontStyle = 'Extra Light';
      else if (weight <= 300) fontStyle = 'Light';
      else if (weight <= 400) fontStyle = 'Regular';
      else if (weight <= 500) fontStyle = 'Medium';
      else if (weight <= 600) fontStyle = 'Semi Bold';
      else if (weight <= 700) fontStyle = 'Bold';
      else if (weight <= 800) fontStyle = 'Extra Bold';
      else fontStyle = 'Black';
    }
    if (!fontStyle) fontStyle = 'Regular';

    const fontFamily = props.fontFamily ?? 'Inter';
    
    try {
      await figma.loadFontAsync({ family: fontFamily, style: fontStyle });
    } catch {
      // Fallback to Regular if specific weight style is not found
      try {
        await figma.loadFontAsync({ family: fontFamily, style: 'Regular' });
        fontStyle = 'Regular';
      } catch {
        await figma.loadFontAsync(DEFAULT_FONT);
        fontStyle = DEFAULT_FONT.style;
      }
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
    if (props.fills) {
      const normalized = normalizeFills(props.fills) || [];
      text.fills = await applyVariablesToFills(normalized);
    }
    if (props.textAlignHorizontal) text.textAlignHorizontal = props.textAlignHorizontal;
    if (props.textAlignVertical) text.textAlignVertical = props.textAlignVertical;
    if (props.textAutoResize) text.textAutoResize = props.textAutoResize;
    if (props.textDecoration && props.textDecoration !== 'NONE') {
      text.textDecoration = props.textDecoration;
    }
    if (props.textCase && props.textCase !== 'ORIGINAL') {
      text.textCase = props.textCase;
    }
    if (props.lineHeight) {
      text.lineHeight = parseLineHeight(props.lineHeight);
    }
    if (props.letterSpacing) {
      text.letterSpacing = parseLetterSpacing(props.letterSpacing);
    }
    if (props.paragraphSpacing != null) text.paragraphSpacing = props.paragraphSpacing;
    if (props.opacity != null) text.opacity = props.opacity;

    parent.appendChild(text);
    if (parent !== figma.currentPage && parent.type !== 'PAGE') {
      const parentIsAutoLayout = 'layoutMode' in parent && (parent as any).layoutMode !== 'NONE';
      if (parentIsAutoLayout) {
        if (props.layoutSizingHorizontal) text.layoutSizingHorizontal = props.layoutSizingHorizontal;
        text.layoutSizingVertical = props.layoutSizingVertical || 'HUG';
      }
    }

    applyCommonProps(text, props, parent);

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
    
    // Position & Size if provided
    if (op.width != null && op.height != null) instance.resize(op.width, op.height);
    if (op.x != null) instance.x = op.x;
    if (op.y != null) instance.y = op.y;
    
    const parentIsAutoLayout = 'layoutMode' in parent && parent.layoutMode !== 'NONE';
    if (parentIsAutoLayout) {
      if (props.layoutSizingHorizontal) instance.layoutSizingHorizontal = props.layoutSizingHorizontal;
      if (props.layoutSizingVertical) instance.layoutSizingVertical = props.layoutSizingVertical;
    }

    applyCommonProps(instance, props, parent);
    
    if (op.ref) createdNodes.set(op.ref, instance);
    pushSummary(`Instância de @"${instance.name}" criada`, instance);
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
      const parent = node.parent;
      if (parent && 'layoutMode' in parent && (parent as any).layoutMode !== 'NONE') {
        if (op.layoutSizingHorizontal && 'layoutSizingHorizontal' in node) {
          (node as any).layoutSizingHorizontal = op.layoutSizingHorizontal;
        }
        if (op.layoutSizingVertical && 'layoutSizingVertical' in node) {
          (node as any).layoutSizingVertical = op.layoutSizingVertical;
        }
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
      if (op.lineHeight) {
        node.lineHeight = parseLineHeight(op.lineHeight);
      }
      if (op.letterSpacing) {
        node.letterSpacing = parseLetterSpacing(op.letterSpacing);
      }
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
    if (!node && snapshotSelection.length > 0) node = snapshotSelection[0];

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
      nodes = snapshotSelection;
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
    if (!node && snapshotSelection.length > 0) node = snapshotSelection[0];

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

    if (parent !== figma.currentPage && parent.type !== 'PAGE') {
      const parentIsAutoLayout = 'layoutMode' in parent && parent.layoutMode !== 'NONE';
      
      if (!parentIsAutoLayout) {
        // Assume non-AL parent expects coordinates
        if (op.props.x != null) comp.x = op.props.x;
        if (op.props.y != null) comp.y = op.props.y;
      }

      if (parentIsAutoLayout) {
        if (op.props.layoutSizingHorizontal) comp.layoutSizingHorizontal = op.props.layoutSizingHorizontal;
        if (op.props.layoutSizingVertical) comp.layoutSizingVertical = op.props.layoutSizingVertical;
      }
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
      
      // Position
      if (op.x != null) svgFrame.x = op.x;
      if (op.y != null) svgFrame.y = op.y;
      if (op.opacity != null) svgFrame.opacity = op.opacity;

      parent.appendChild(svgFrame);
      if (op.ref) createdNodes.set(op.ref, svgFrame);
      pushSummary(`SVG criado @"${op.name || 'svg'}"`, svgFrame);
    } catch (e) {
      postToUI({ type: 'ERROR', message: `Erro ao criar SVG: ${String(e)}` });
    }
  }

  // ═══ CREATE_ICON ═══
  else if (op.type === 'CREATE_ICON') {
    const parent = await getParent(op.parentRef, op.parentNodeId);
    const { icon, size = 24, color, x = 0, y = 0, name, opacity = 1 } = op.props;
    
    // Parse prefix and name from e.g. "mdi:home"
    const parts = icon.split(':');
    const prefix = parts.length > 1 ? parts[0] : 'mdi';
    const iconName = parts.length > 1 ? parts[1] : parts[0];
    
    try {
      // Fetch SVG from Iconify API
      const url = `https://api.iconify.design/${prefix}/${iconName}.svg`;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Status ${response.status}`);
      const svgString = await response.text();
      
      const iconNode = figma.createNodeFromSvg(svgString);
      iconNode.name = name || `Icon: ${icon}`;
      iconNode.resize(size, size);
      iconNode.x = x;
      iconNode.y = y;
      iconNode.opacity = opacity;
      
      // Apply color to paths if provided
      if (color) {
        const fills = normalizeFills(color) || [];
        const figmaFills = await applyVariablesToFills(fills);
        await recolorRecursive(iconNode, figmaFills);
      }
      
      parent.appendChild(iconNode);
      if (op.ref) createdNodes.set(op.ref, iconNode);
      pushSummary(`Ícone criado @"${icon}"`, iconNode);
      
    } catch (e) {
      console.warn(`Failed to fetch icon ${icon}:`, e);
      // Fallback: create a placeholder circle
      const placeholder = figma.createEllipse();
      placeholder.name = `Missing Icon: ${icon}`;
      placeholder.resize(size, size);
      placeholder.x = x;
      placeholder.y = y;
      placeholder.fills = [{ type: 'SOLID', color: { r: 1, g: 0.5, b: 0.5 }, opacity: 0.2 }];
      placeholder.strokes = [{ type: 'SOLID', color: { r: 1, g: 0, b: 0 } }];
      parent.appendChild(placeholder);
      if (op.ref) createdNodes.set(op.ref, placeholder);
      pushSummary(`Err: Ícone não encontrado @"${icon}"`, placeholder);
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
      if (props.name) cloned.name = props.name;
      if (props.width && 'resize' in cloned) {
        (cloned as any).resize(props.width, props.height || (cloned as any).height);
      }
      if (props.fills && 'fills' in cloned) {
        // Use normalizeFills to handle different formats
        const normalized = normalizeFills(props.fills);
        if (normalized) (cloned as any).fills = await applyVariablesToFills(normalized);
      }
      if (props.isMask != null && 'isMask' in cloned) {
        (cloned as any).isMask = props.isMask;
      }
      if (props.opacity != null && 'opacity' in cloned) {
        (cloned as any).opacity = props.opacity;
      }

      parent.appendChild(cloned);
      
      const parentIsAutoLayout = 'layoutMode' in parent && parent.layoutMode !== 'NONE';
      if (parentIsAutoLayout) {
        const sizingH = props.layoutSizingHorizontal;
        const sizingV = props.layoutSizingVertical;
        if (sizingH) (cloned as any).layoutSizingHorizontal = sizingH;
        if (sizingV) (cloned as any).layoutSizingVertical = sizingV;
      }

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
        const collections = await figma.variables.getLocalVariableCollectionsAsync();
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

  // ═══ CREATE_COLOR_VARIABLES_FROM_SELECTION ═══
  else if (op.type === 'CREATE_COLOR_VARIABLES_FROM_SELECTION') {
    if (figma.variables) {
      try {
        const selection = snapshotSelection;
        if (selection.length === 0) {
          pushSummary('Nenhum elemento selecionado');
          return;
        }

        const collectionName = op.collectionName || 'Colors';
        const collections = await figma.variables.getLocalVariableCollectionsAsync();
        let collection = collections.find((c: any) => c.name === collectionName);
        if (!collection) {
          collection = (figma.variables as any).createVariableCollection?.(collectionName);
        }
        if (!collection) return;

        let created = 0;
        for (const node of selection) {
          if (!('fills' in node)) continue;
          const fills = (node as GeometryMixin).fills;
          if (!Array.isArray(fills) || fills.length === 0) continue;

          const solidFill = fills.find((f: Paint) => f.type === 'SOLID' && f.visible !== false) as SolidPaint | undefined;
          if (!solidFill) continue;

          const varName = node.name.replace(/[^a-zA-Z0-9\s\-_\/]/g, '').trim() || `color-${created}`;
          const variable = (figma.variables as any).createVariable?.(varName, collection.id, 'COLOR');
          if (variable) {
            variable.setValueForMode(collection.defaultModeId, {
              r: solidFill.color.r,
              g: solidFill.color.g,
              b: solidFill.color.b,
              a: solidFill.opacity ?? 1
            });
            created++;
            pushSummary(`Variável criada: ${varName}`, node);
          }
        }

        if (created === 0) {
          pushSummary('Nenhuma cor sólida encontrada na seleção');
        }
      } catch (e) {
        postToUI({ type: 'ERROR', message: `Erro ao criar variáveis: ${String(e)}` });
      }
    }
  }

  // ═══ BIND_NEAREST_COLOR_VARIABLES ═══
  else if (op.type === 'BIND_NEAREST_COLOR_VARIABLES') {
    if (figma.variables) {
      try {
        const threshold = op.threshold ?? 0.05;
        const roots = op.scope === 'page'
          ? [...figma.currentPage.children]
          : [...snapshotSelection];

        if (roots.length === 0) {
          pushSummary('Nenhum elemento para processar');
          return;
        }

        const allVars = await figma.variables.getLocalVariablesAsync('COLOR');
        const palette: { variable: Variable; rgb: { r: number; g: number; b: number } }[] = [];

        for (const v of allVars) {
          if (op.collectionName) {
            const coll = await figma.variables.getVariableCollectionByIdAsync(v.variableCollectionId);
            if (coll?.name !== op.collectionName) continue;
          }
          const modeId = Object.keys(v.valuesByMode)[0];
          const val = v.valuesByMode[modeId];
          if (typeof val === 'object' && val !== null && 'r' in val) {
            palette.push({ variable: v, rgb: val as { r: number; g: number; b: number } });
          }
        }

        if (palette.length === 0) {
          pushSummary('Nenhuma variável de cor encontrada');
          return;
        }

        let bound = 0;
        let skipped = 0;

        async function bindNode(node: SceneNode) {
          if ('fills' in node) {
            const fills = (node as GeometryMixin).fills as Paint[];
            if (Array.isArray(fills)) {
              const newFills = [...fills];
              let changed = false;
              for (let i = 0; i < newFills.length; i++) {
                const fill = newFills[i];
                if (fill.type !== 'SOLID' || fill.visible === false) continue;
                if ((fill as any).boundVariables?.color) { skipped++; continue; }
                const { r, g, b } = (fill as SolidPaint).color;
                let bestDist = Infinity;
                let bestVar: Variable | null = null;
                for (const p of palette) {
                  const dist = colorDistance({ r, g, b }, p.rgb);
                  if (dist < bestDist) { bestDist = dist; bestVar = p.variable; }
                }
                if (bestVar && bestDist <= threshold) {
                  newFills[i] = figma.variables.setBoundVariableForPaint(fill as SolidPaint, 'color', bestVar);
                  changed = true;
                  bound++;
                } else {
                  skipped++;
                }
              }
              if (changed) (node as GeometryMixin).fills = newFills;
            }
          }

          if ('strokes' in node) {
            const strokes = (node as GeometryMixin).strokes as Paint[];
            if (Array.isArray(strokes)) {
              const newStrokes = [...strokes];
              let changed = false;
              for (let i = 0; i < newStrokes.length; i++) {
                const stroke = newStrokes[i];
                if (stroke.type !== 'SOLID' || stroke.visible === false) continue;
                if ((stroke as any).boundVariables?.color) { skipped++; continue; }
                const { r, g, b } = (stroke as SolidPaint).color;
                let bestDist = Infinity;
                let bestVar: Variable | null = null;
                for (const p of palette) {
                  const dist = colorDistance({ r, g, b }, p.rgb);
                  if (dist < bestDist) { bestDist = dist; bestVar = p.variable; }
                }
                if (bestVar && bestDist <= threshold) {
                  newStrokes[i] = figma.variables.setBoundVariableForPaint(stroke as SolidPaint, 'color', bestVar);
                  changed = true;
                  bound++;
                } else {
                  skipped++;
                }
              }
              if (changed) (node as GeometryMixin).strokes = newStrokes;
            }
          }

          if ('children' in node) {
            for (const child of (node as any).children) {
              await bindNode(child as SceneNode);
            }
          }
        }

        for (const root of roots) await bindNode(root as SceneNode);
        pushSummary(`Vinculou ${bound} cores a variáveis (${skipped} ignoradas, threshold: ${threshold})`);
      } catch (e) {
        postToUI({ type: 'ERROR', message: `Erro ao vincular variáveis: ${String(e)}` });
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

  // ═══ RECOLOR_NODE ═══
  else if (op.type === 'RECOLOR_NODE') {
    const node = (op.ref ? createdNodes.get(op.ref) : null)
      ?? (op.nodeId ? await figma.getNodeByIdAsync(op.nodeId) : null);
    
    if (node) {
      const normalizedFills = normalizeFills(props.fills) || [];
      const fills = await applyVariablesToFills(normalizedFills);
      await recolorRecursive(node, fills);
      pushSummary(`Recoloring @"${(node as any).name}" recursivamente`, node as SceneNode);
    }
  }
}

/**
 * Recursively changes the fill color of all vector and text nodes within a tree.
 */
async function recolorRecursive(node: BaseNode, fills: Paint[]) {
  // Check if node has fills and is a graphic/text type
  if ('fills' in node && (
     node.type === 'VECTOR' || 
     node.type === 'TEXT' || 
     node.type === 'STAR' || 
     node.type === 'LINE' || 
     node.type === 'ELLIPSE' || 
     node.type === 'RECTANGLE' || 
     node.type === 'POLYGON' || 
     node.type === 'BOOLEAN_OPERATION'
  )) {
    // For text, we must load the font first
    if (node.type === 'TEXT') {
      const font = (node as TextNode).fontName;
      if (font && typeof font !== 'symbol') {
        try {
          await figma.loadFontAsync(font);
        } catch (e) {
          console.warn('Failed to load font for recoloring:', font);
        }
      }
    }
    try {
      (node as any).fills = fills;
    } catch (e) {
      console.warn(`Failed to set fill for node type ${node.type}:`, e);
    }
  }
  
  if ('children' in node) {
    for (const child of node.children) {
      await recolorRecursive(child, fills);
    }
  }
}

/**
 * Map effect definitions to Figma Effect objects
 */
function mapEffects(effects: any[]): Effect[] {
  if (!effects || !Array.isArray(effects)) return [];
  
  return effects.map(e => {
    if (!e || typeof e !== 'object') return null;

    if (e.type === 'LAYER_BLUR' || e.type === 'BACKGROUND_BLUR') {
      return { 
        type: e.type, 
        radius: typeof e.radius === 'number' ? e.radius : 4, 
        visible: e.visible ?? true 
      } as Effect;
    }
    
    return {
      type: (e.type === 'DROP_SHADOW' || e.type === 'INNER_SHADOW') ? e.type : 'DROP_SHADOW',
      color: normalizeRGBA(e.color),
      offset: e.offset ?? { x: 0, y: 4 },
      radius: typeof e.radius === 'number' ? e.radius : 10,
      spread: e.spread ?? 0,
      visible: e.visible ?? true,
      blendMode: e.blendMode ?? 'NORMAL',
    } as Effect;
  }).filter(Boolean) as Effect[];
}
