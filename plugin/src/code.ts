/// <reference types="@figma/plugin-typings" />
// Figma plugin sandbox — runs in QuickJS, no browser APIs

import type { UIMessage, FigmaOperation, SerializedContext, SerializedNode, SerializedFill, ComponentInfo, ColorVariable, FontVariable, AvailableLayer } from '../../src/lib/figma-types';


function postToUI(msg: { type: string } & Record<string, unknown>) {
  figma.ui.postMessage(msg);
}

// ── Deep node serialization (Phase 3) ──

async function serializeNode(node: SceneNode, depth = 0, maxDepth = 5): Promise<SerializedNode> {
  const base: SerializedNode = {
    id: node.id,
    type: node.type,
    name: node.name,
    width: 'width' in node ? (node as any).width : 0,
    height: 'height' in node ? (node as any).height : 0,
    x: 'x' in node ? (node as any).x : undefined,
    y: 'y' in node ? (node as any).y : undefined,
  };

  // Auto-layout info
  if (node.type === 'FRAME' || node.type === 'COMPONENT' || node.type === 'COMPONENT_SET') {
    const frame = node as FrameNode;
    base.layoutMode = frame.layoutMode;
    base.itemSpacing = frame.itemSpacing;
    base.paddingTop = frame.paddingTop;
    base.paddingRight = frame.paddingRight;
    base.paddingBottom = frame.paddingBottom;
    base.paddingLeft = frame.paddingLeft;
    base.primaryAxisAlignItems = frame.primaryAxisAlignItems;
    base.counterAxisAlignItems = frame.counterAxisAlignItems;
    base.childCount = frame.children.length;
  }

  // Fills
  if ('fills' in node && Array.isArray(node.fills)) {
    base.fills = (node.fills as ReadonlyArray<Paint>).map((f: Paint) => {
      const fill: SerializedFill = {
        type: f.type,
        opacity: 'opacity' in f ? (f as SolidPaint).opacity : undefined,
      };
      if (f.type === 'SOLID') {
        fill.color = (f as SolidPaint).color;
      } else if (f.type === 'IMAGE') {
        // Capture image hash so LLM knows there's an image (even if can't recreate)
        fill.imageHash = (f as ImagePaint).imageHash;
        fill.scaleMode = (f as ImagePaint).scaleMode;
      }
      return fill;
    });
  }

  // Fix 1.5: Strokes
  if ('strokes' in node && Array.isArray(node.strokes) && (node.strokes as any).length > 0) {
    base.strokes = (node.strokes as ReadonlyArray<Paint>).map((s: Paint) => ({
      type: s.type,
      color: s.type === 'SOLID' ? (s as SolidPaint).color : undefined,
      opacity: 'opacity' in s ? (s as SolidPaint).opacity : undefined,
    }));
    if ('strokeWeight' in node) base.strokeWeight = (node as any).strokeWeight;
  }

  // Fix 1.5: Effects
  if ('effects' in node && Array.isArray((node as any).effects) && (node as any).effects.length > 0) {
    base.effects = (node as any).effects.map((e: Effect) => ({
      type: e.type,
      radius: 'radius' in e ? e.radius : undefined,
      color: 'color' in e ? e.color : undefined,
      offset: 'offset' in e ? e.offset : undefined,
    }));
  }

  // Fix 1.5: Opacity
  if ('opacity' in node && (node as any).opacity !== 1) {
    base.opacity = (node as any).opacity;
  }

  // Fix 1.5: Constraints (non-auto-layout)
  if ('constraints' in node) {
    base.constraints = (node as any).constraints;
  }

  // Fix 1.5: layoutSizing (for children of auto-layout)
  if ('layoutSizingHorizontal' in node) {
    base.layoutSizingHorizontal = (node as any).layoutSizingHorizontal;
    base.layoutSizingVertical = (node as any).layoutSizingVertical;
  }

  // Corner radius
  if ('cornerRadius' in node && typeof (node as any).cornerRadius === 'number') {
    base.cornerRadius = (node as any).cornerRadius;
  }

  // Text content
  if (node.type === 'TEXT') {
    base.characters = node.characters;
    if (typeof node.fontSize === 'number') {
      base.fontSize = node.fontSize;
    }
    // Capture font info (critical for template reproduction)
    if (typeof node.fontName !== 'symbol') {
      base.fontFamily = node.fontName.family;
      base.fontStyle = node.fontName.style;
    }
    if (node.textAlignHorizontal) base.textAlignHorizontal = node.textAlignHorizontal;
    if (node.textAlignVertical) base.textAlignVertical = node.textAlignVertical;
    if (node.textAutoResize) base.textAutoResize = node.textAutoResize;
  }

  // Instance info — must use async API with documentAccess: dynamic-page
  if (node.type === 'INSTANCE') {
    try {
      const mainComp = await node.getMainComponentAsync();
      if (mainComp) {
        base.componentKey = mainComp.key;
        base.componentName = mainComp.name;
      }
    } catch (_e) {
      // Component may not be accessible
    }
  }

  // Fix 1.5: Recursively serialize children (respects maxDepth for page vs selection)
  if ('children' in node && (node as any).children && depth < maxDepth) {
    const children: SerializedNode[] = [];
    for (const child of (node as any).children as SceneNode[]) {
      children.push(await serializeNode(child, depth + 1, maxDepth));
    }
    base.children = children;
  }

  return base;
}

async function serializeSelection(): Promise<SerializedContext> {
  const nodes: SerializedNode[] = [];
  const selection = figma.currentPage.selection;
  const limit = 20;

  for (let i = 0; i < Math.min(selection.length, limit); i++) {
    nodes.push(await serializeNode(selection[i]));
  }

  const styles: Record<string, string> = {};
  try {
    const paintStyles = await figma.getLocalPaintStylesAsync();
    const textStyles = await figma.getLocalTextStylesAsync();
    for (const s of paintStyles) styles[s.id] = `PAINT:${s.name}`;
    for (const s of textStyles) styles[s.id] = `TEXT:${s.name}`;
  } catch (e) {
    // Styles might not be available, continue without them
  }

  return { nodes, styles };
}

async function serializePage(): Promise<SerializedContext> {
  const nodes: SerializedNode[] = [];
  const pageChildren = figma.currentPage.children;
  const limit = 50;
  const maxDepth = 2; // shallower than selection to keep payload manageable

  for (let i = 0; i < Math.min(pageChildren.length, limit); i++) {
    nodes.push(await serializeNode(pageChildren[i], 0, maxDepth));
  }

  const styles: Record<string, string> = {};
  try {
    const paintStyles = await figma.getLocalPaintStylesAsync();
    const textStyles = await figma.getLocalTextStylesAsync();
    for (const s of paintStyles) styles[s.id] = `PAINT:${s.name}`;
    for (const s of textStyles) styles[s.id] = `TEXT:${s.name}`;
  } catch (e) {
    // Styles might not be available
  }

  return { nodes, styles };
}

// ── Collect referenceable layers for @"name" syntax ──

function getAvailableLayers(): AvailableLayer[] {
  const layers: AvailableLayer[] = [];
  const seen = new Set<string>();
  const MAX = 80;

  function addLayer(node: SceneNode) {
    if (seen.has(node.id) || layers.length >= MAX) return;
    seen.add(node.id);
    layers.push({ id: node.id, name: node.name, type: node.type });
  }

  // Selected nodes + their direct children
  const selection = figma.currentPage.selection;
  for (const node of selection) {
    addLayer(node);
    if ('children' in node) {
      for (const child of (node as FrameNode).children) {
        addLayer(child);
      }
    }
  }

  // Top-level nodes on current page
  for (const node of figma.currentPage.children) {
    addLayer(node);
  }

  return layers;
}

/**
 * Collect all elements for mentions autocomplete
 * Gathers layers, frames, components, and variables
 */
function getElementsForMentions() {
  const elements = {
    layers: [] as any[],
    frames: [] as any[],
    components: [] as any[],
    variables: [] as any[]
  };

  const seenIds = new Set<string>();

  function addElement(node: SceneNode, category: 'layers' | 'frames' | 'components') {
    if (seenIds.has(node.id) || elements[category].length >= 50) return;
    seenIds.add(node.id);
    elements[category].push({ id: node.id, name: node.name });
  }

  // Traverse current page: selected + top-level + their children
  const selection = figma.currentPage.selection;

  // Add selected nodes
  for (const node of selection) {
    if (node.type === 'COMPONENT' || node.type === 'COMPONENT_SET') {
      addElement(node, 'components');
    } else if (node.type === 'FRAME' || node.type === 'SECTION') {
      addElement(node, 'frames');
    } else {
      addElement(node, 'layers');
    }

    // Add direct children
    if ('children' in node) {
      for (const child of (node as FrameNode).children) {
        if (child.type === 'COMPONENT' || child.type === 'COMPONENT_SET') {
          addElement(child, 'components');
        } else if (child.type === 'FRAME' || child.type === 'SECTION') {
          addElement(child, 'frames');
        } else {
          addElement(child, 'layers');
        }
      }
    }
  }

  // Add top-level nodes
  for (const node of figma.currentPage.children) {
    if (node.type === 'COMPONENT' || node.type === 'COMPONENT_SET') {
      addElement(node, 'components');
    } else if (node.type === 'FRAME' || node.type === 'SECTION') {
      addElement(node, 'frames');
    } else {
      addElement(node, 'layers');
    }
  }

  // Variables (color + font)
  try {
    const allVariables = (figma.variables as any)?.getAll?.() || [];
    for (const v of allVariables) {
      if (elements.variables.length >= 30) break;
      elements.variables.push({ id: v.id, name: v.name });
    }
  } catch (_e) {
    // Variables API may not be available
  }

  return elements;
}

// ── Apply Operations (21+ types with ref/parentRef hierarchy) ──

// Fix 1.2: Session-level cache for loadAllPagesAsync (performance)
let pagesLoaded = false;

async function ensurePagesLoaded() {
  if (!pagesLoaded) {
    await figma.loadAllPagesAsync();
    pagesLoaded = true;
  }
}

// ── Undo (Official Figma API: commitUndo + triggerUndo) ──
// figma.commitUndo() saves a checkpoint before each operation batch.
// figma.triggerUndo() reverts to the last checkpoint.
// This handles ALL properties natively — no manual snapshot needed.

let canUndo = false;

async function applyOperations(ops: FigmaOperation[]) {
  // Create a native Figma undo checkpoint before applying operations
  figma.commitUndo();
  canUndo = true;

  // Reset page cache per batch to ensure fresh state if called multiple times
  pagesLoaded = false;

  const createdNodes = new Map<string, SceneNode>();
  const defaultFont: FontName = { family: 'Inter', style: 'Regular' };
  const summaryLines: string[] = [];
  const summaryItems: Array<{ text: string; nodeId?: string; nodeName?: string }> = [];

  // Helper: push to both summaryLines and summaryItems with optional node reference
  function pushSummary(text: string, node?: SceneNode | BaseNode | null) {
    summaryLines.push(text);
    summaryItems.push({
      text,
      nodeId: node && 'id' in node ? node.id : undefined,
      nodeName: node && 'name' in node ? (node as any).name : undefined,
    });
  }

  async function getParent(parentRef?: string, parentNodeId?: string): Promise<BaseNode & ChildrenMixin> {
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


  for (const op of ops) {
    console.log('[OPERATION]', op.type, JSON.stringify(op).slice(0, 200));
    try {

      // ═══ CREATE_FRAME ═══
      if (op.type === 'CREATE_FRAME') {
        const parent = await getParent(op.parentRef, op.parentNodeId);
        const frame = figma.createFrame();
        frame.name = op.props.name;
        const fw = op.props.width > 0 ? op.props.width : 100;
        const fh = op.props.height > 0 ? op.props.height : 100;
        frame.resize(fw, fh);

        // Auto-layout
        if (op.props.layoutMode && op.props.layoutMode !== 'NONE') {
          frame.layoutMode = op.props.layoutMode;
          frame.primaryAxisSizingMode = op.props.primaryAxisSizingMode ?? 'AUTO';
          frame.counterAxisSizingMode = op.props.counterAxisSizingMode ?? 'AUTO';
          frame.primaryAxisAlignItems = op.props.primaryAxisAlignItems ?? 'MIN';
          frame.counterAxisAlignItems = op.props.counterAxisAlignItems ?? 'MIN';
          frame.itemSpacing = op.props.itemSpacing ?? 0;
          if (op.props.counterAxisSpacing != null && 'counterAxisSpacing' in frame) {
            (frame as any).counterAxisSpacing = op.props.counterAxisSpacing;
          }
          frame.layoutWrap = op.props.layoutWrap ?? 'NO_WRAP';
          frame.paddingTop = op.props.paddingTop ?? 0;
          frame.paddingRight = op.props.paddingRight ?? 0;
          frame.paddingBottom = op.props.paddingBottom ?? 0;
          frame.paddingLeft = op.props.paddingLeft ?? 0;
          if (op.props.strokesIncludedInLayout != null && 'strokesIncludedInLayout' in frame) {
            (frame as any).strokesIncludedInLayout = op.props.strokesIncludedInLayout;
          }
          if (op.props.minWidth != null && 'minWidth' in frame) (frame as any).minWidth = op.props.minWidth;
          if (op.props.maxWidth != null && 'maxWidth' in frame) (frame as any).maxWidth = op.props.maxWidth;
          if (op.props.minHeight != null && 'minHeight' in frame) (frame as any).minHeight = op.props.minHeight;
          if (op.props.maxHeight != null && 'maxHeight' in frame) (frame as any).maxHeight = op.props.maxHeight;
        }

        if (op.props.fills) frame.fills = op.props.fills as any;
        if (op.props.cornerRadius != null) frame.cornerRadius = op.props.cornerRadius;
        if (op.props.cornerSmoothing != null) frame.cornerSmoothing = op.props.cornerSmoothing;
        if (op.props.clipsContent != null) frame.clipsContent = op.props.clipsContent;

        // Strokes
        if (op.props.strokes) frame.strokes = op.props.strokes as any;
        if (op.props.strokeWeight != null) frame.strokeWeight = op.props.strokeWeight;
        if (op.props.opacity != null) frame.opacity = op.props.opacity;

        // Position at center if root, otherwise append to parent
        if (parent === figma.currentPage) {
          frame.x = figma.viewport.center.x - fw / 2;
          frame.y = figma.viewport.center.y - fh / 2;
        }
        parent.appendChild(frame);

        // Absolute position & rotation (set AFTER appendChild for correct parent-relative coords)
        if (parent !== figma.currentPage) {
          if (op.props.x != null) frame.x = op.props.x;
          if (op.props.y != null) frame.y = op.props.y;
        }
        if (op.props.rotation != null) frame.rotation = op.props.rotation;

        // Layout sizing (must be set AFTER appendChild)
        if (op.props.layoutSizingHorizontal && parent !== figma.currentPage) {
          frame.layoutSizingHorizontal = op.props.layoutSizingHorizontal;
        }
        if (op.props.layoutSizingVertical && parent !== figma.currentPage) {
          frame.layoutSizingVertical = op.props.layoutSizingVertical;
        }

        if (op.ref) createdNodes.set(op.ref, frame);
        pushSummary(`Criado @"${frame.name}"`, frame);

        // ═══ CREATE_RECTANGLE ═══
      } else if (op.type === 'CREATE_RECTANGLE') {
        const parent = await getParent(op.parentRef, op.parentNodeId);
        const rect = figma.createRectangle();
        rect.name = op.props.name;
        rect.resize(op.props.width > 0 ? op.props.width : 100, op.props.height > 0 ? op.props.height : 100);
        if (op.props.fills) rect.fills = op.props.fills as any;
        if (op.props.cornerRadius != null) rect.cornerRadius = op.props.cornerRadius;
        if (op.props.strokes) rect.strokes = op.props.strokes as any;
        if (op.props.strokeWeight != null) rect.strokeWeight = op.props.strokeWeight;
        if (op.props.opacity != null) rect.opacity = op.props.opacity;
        if (op.props.effects) rect.effects = op.props.effects.map(e => {
          if (e.type === 'LAYER_BLUR' || e.type === 'BACKGROUND_BLUR') {
            return { type: e.type, radius: e.radius, visible: e.visible ?? true } as Effect;
          }
          return { type: e.type as 'DROP_SHADOW' | 'INNER_SHADOW', color: e.color ?? { r: 0, g: 0, b: 0, a: 0.25 }, offset: e.offset ?? { x: 0, y: 4 }, radius: e.radius, spread: e.spread ?? 0, visible: e.visible ?? true, blendMode: 'NORMAL' as BlendMode } as Effect;
        });
        if (op.props.constraints && 'constraints' in rect) (rect as any).constraints = op.props.constraints;
        parent.appendChild(rect);

        // Absolute position & rotation (set AFTER appendChild)
        if (op.props.x != null) rect.x = op.props.x;
        if (op.props.y != null) rect.y = op.props.y;
        if (op.props.rotation != null) rect.rotation = op.props.rotation;

        if (op.props.layoutSizingHorizontal && parent !== figma.currentPage) {
          rect.layoutSizingHorizontal = op.props.layoutSizingHorizontal;
        }
        if (op.props.layoutSizingVertical && parent !== figma.currentPage) {
          rect.layoutSizingVertical = op.props.layoutSizingVertical;
        }
        if (op.ref) createdNodes.set(op.ref, rect);
        pushSummary(`Criado @"${rect.name}"`, rect);

        // ═══ CREATE_ELLIPSE ═══
      } else if (op.type === 'CREATE_ELLIPSE') {
        const parent = await getParent(op.parentRef, op.parentNodeId);
        const ellipse = figma.createEllipse();
        ellipse.name = op.props.name;
        ellipse.resize(op.props.width > 0 ? op.props.width : 100, op.props.height > 0 ? op.props.height : 100);
        if (op.props.fills) ellipse.fills = op.props.fills as any;
        if (op.props.strokes) ellipse.strokes = op.props.strokes as any;
        if (op.props.strokeWeight != null) ellipse.strokeWeight = op.props.strokeWeight;
        if (op.props.opacity != null) ellipse.opacity = op.props.opacity;
        if (op.props.effects) ellipse.effects = op.props.effects.map(e => {
          if (e.type === 'LAYER_BLUR' || e.type === 'BACKGROUND_BLUR') {
            return { type: e.type, radius: e.radius, visible: e.visible ?? true } as Effect;
          }
          return { type: e.type as 'DROP_SHADOW' | 'INNER_SHADOW', color: e.color ?? { r: 0, g: 0, b: 0, a: 0.25 }, offset: e.offset ?? { x: 0, y: 4 }, radius: e.radius, spread: e.spread ?? 0, visible: e.visible ?? true, blendMode: 'NORMAL' as BlendMode } as Effect;
        });
        if (op.props.constraints && 'constraints' in ellipse) (ellipse as any).constraints = op.props.constraints;
        parent.appendChild(ellipse);

        // Absolute position & rotation (set AFTER appendChild)
        if (op.props.x != null) ellipse.x = op.props.x;
        if (op.props.y != null) ellipse.y = op.props.y;
        if (op.props.rotation != null) ellipse.rotation = op.props.rotation;

        if (op.props.layoutSizingHorizontal && parent !== figma.currentPage) {
          ellipse.layoutSizingHorizontal = op.props.layoutSizingHorizontal;
        }
        if (op.props.layoutSizingVertical && parent !== figma.currentPage) {
          ellipse.layoutSizingVertical = op.props.layoutSizingVertical;
        }
        if (op.ref) createdNodes.set(op.ref, ellipse);
        pushSummary(`Criado @"${ellipse.name}"`, ellipse);

        // ═══ CREATE_TEXT ═══
      } else if (op.type === 'CREATE_TEXT') {
        const fontFamily = op.props.fontFamily ?? 'Inter';
        const fontStyle = op.props.fontStyle ?? 'Regular';
        try {
          await figma.loadFontAsync({ family: fontFamily, style: fontStyle });
        } catch (_e) {
          // Fallback to Inter Regular if requested font is not available
          await figma.loadFontAsync(defaultFont);
        }

        const parent = await getParent(op.parentRef, op.parentNodeId);
        const text = figma.createText();
        try {
          text.fontName = { family: fontFamily, style: fontStyle };
        } catch (_e) {
          text.fontName = defaultFont;
        }
        text.characters = op.props.content;
        if (op.props.name) text.name = op.props.name;
        if (op.props.fontSize) text.fontSize = op.props.fontSize;
        if (op.props.fills) text.fills = op.props.fills as any;
        if (op.props.textAlignHorizontal) text.textAlignHorizontal = op.props.textAlignHorizontal;
        if (op.props.textAlignVertical) text.textAlignVertical = op.props.textAlignVertical;
        if (op.props.textAutoResize) text.textAutoResize = op.props.textAutoResize;
        if (op.props.textDecoration && op.props.textDecoration !== 'NONE') {
          text.textDecoration = op.props.textDecoration;
        }
        if (op.props.textCase && op.props.textCase !== 'ORIGINAL') {
          text.textCase = op.props.textCase;
        }
        if (op.props.lineHeight) text.lineHeight = op.props.lineHeight;
        if (op.props.letterSpacing) text.letterSpacing = op.props.letterSpacing;
        if (op.props.paragraphSpacing != null) text.paragraphSpacing = op.props.paragraphSpacing;

        if (op.props.opacity != null) text.opacity = op.props.opacity;

        parent.appendChild(text);

        // Absolute position & rotation (set AFTER appendChild)
        if (op.props.x != null) text.x = op.props.x;
        if (op.props.y != null) text.y = op.props.y;
        if (op.props.rotation != null) text.rotation = op.props.rotation;

        if (op.props.layoutSizingHorizontal && parent !== figma.currentPage) {
          text.layoutSizingHorizontal = op.props.layoutSizingHorizontal;
        }
        if (op.props.layoutSizingVertical && parent !== figma.currentPage) {
          text.layoutSizingVertical = op.props.layoutSizingVertical;
        }
        if (op.ref) createdNodes.set(op.ref, text);
        pushSummary(`Criado @"${text.name}"`, text);

        // ═══ CREATE_COMPONENT_INSTANCE ═══
      } else if (op.type === 'CREATE_COMPONENT_INSTANCE') {
        const parent = await getParent(op.parentRef, op.parentNodeId);
        let component: ComponentNode | null = null;

        // Try to find locally first (Fix 1.2: use cached ensurePagesLoaded)
        try {
          await ensurePagesLoaded();
          const allComps = figma.root.findAllWithCriteria({ types: ['COMPONENT'] });
          component = allComps.find(c => c.key === op.componentKey) || null;
        } catch (_e) {
          // Continue to try import
        }

        if (!component) {
          try {
            component = await figma.importComponentByKeyAsync(op.componentKey);
          } catch (_e) {
            postToUI({ type: 'ERROR', message: `Componente não encontrado: ${op.componentKey}` });
            continue;
          }
        }

        const instance = component.createInstance();
        if (op.name) instance.name = op.name;
        parent.appendChild(instance);
        if (op.ref) createdNodes.set(op.ref, instance);
        pushSummary(`Criado @"${instance.name}"`, instance);

        // ═══ SET_FILL ═══
      } else if (op.type === 'SET_FILL') {
        const node = await figma.getNodeByIdAsync(op.nodeId) as GeometryMixin | null;
        if (node && 'fills' in node) {
          node.fills = op.fills as any;
          pushSummary(`Editado fill @"${(node as any).name}"`, node as SceneNode);
        }

        // ═══ SET_STROKE ═══
      } else if (op.type === 'SET_STROKE') {
        const node = await figma.getNodeByIdAsync(op.nodeId) as GeometryMixin | null;
        if (node && 'strokes' in node) {
          node.strokes = op.strokes as any;
          if (op.strokeWeight != null) node.strokeWeight = op.strokeWeight;
          if (op.strokeAlign && 'strokeAlign' in node) {
            (node as any).strokeAlign = op.strokeAlign;
          }
          pushSummary(`Editado stroke @"${(node as any).name}"`, node as SceneNode);
        }

        // ═══ SET_IMAGE_FILL (Fix 1.4) ═══
      } else if (op.type === 'SET_IMAGE_FILL') {
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

        // ═══ SET_CORNER_RADIUS ═══
      } else if (op.type === 'SET_CORNER_RADIUS') {
        const node = await figma.getNodeByIdAsync(op.nodeId) as any;
        if (node && 'cornerRadius' in node) {
          node.cornerRadius = op.cornerRadius;
          if (op.cornerSmoothing != null && 'cornerSmoothing' in node) {
            node.cornerSmoothing = op.cornerSmoothing;
          }
          pushSummary(`Editado radius @"${node.name}"`, node as SceneNode);
        }

        // ═══ SET_EFFECTS ═══
      } else if (op.type === 'SET_EFFECTS') {
        const node = await figma.getNodeByIdAsync(op.nodeId) as BlendMixin | null;
        if (node && 'effects' in node) {
          node.effects = op.effects.map(e => {
            if (e.type === 'LAYER_BLUR' || e.type === 'BACKGROUND_BLUR') {
              return {
                type: e.type,
                radius: e.radius,
                visible: e.visible ?? true,
              } as Effect;
            }
            // DROP_SHADOW / INNER_SHADOW
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
          pushSummary(`Editado effects @"${(node as any).name}"`, node as SceneNode);
        }

        // ═══ SET_AUTO_LAYOUT ═══
      } else if (op.type === 'SET_AUTO_LAYOUT') {
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

        // ═══ RESIZE ═══
      } else if (op.type === 'RESIZE') {
        const node = await figma.getNodeByIdAsync(op.nodeId) as SceneNode | null;
        if (node && 'resize' in node) {
          (node as any).resize(op.width, op.height);
          pushSummary(`Redimensionado @"${node.name}"`, node);
        }

        // ═══ MOVE ═══
      } else if (op.type === 'MOVE') {
        // Support both nodeId (existing node) and ref (node created in this response)
        const node = (op.ref ? createdNodes.get(op.ref) : null) as SceneNode | null
          ?? (op.nodeId ? await figma.getNodeByIdAsync(op.nodeId) as SceneNode | null : null);
        if (node) {
          node.x = op.x;
          node.y = op.y;
          pushSummary(`Movido @"${node.name}"`, node);
        }

        // ═══ RENAME ═══
      } else if (op.type === 'RENAME') {
        const node = await figma.getNodeByIdAsync(op.nodeId);
        if (node) {
          const oldName = node.name;
          node.name = op.name;
          pushSummary(`Renomeado @"${oldName}" → @"${op.name}"`, node);
        }

        // ═══ SET_TEXT_CONTENT ═══
      } else if (op.type === 'SET_TEXT_CONTENT') {
        const node = await figma.getNodeByIdAsync(op.nodeId) as TextNode | null;
        if (node && node.type === 'TEXT') {
          // Fix 1.1: Load fonts using getStyledTextSegments (O(segments) instead of O(n))
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
                try { await figma.loadFontAsync(fn); } catch (_e) { /* skip */ }
              }
            }
          } catch (_e) {
            // Fallback: if getStyledTextSegments not available, just load default
          }

          // Determine target font: use specified, or preserve existing, or fallback
          const wantsNewFont = op.fontFamily || op.fontStyle;
          let targetFont: FontName;
          if (wantsNewFont) {
            targetFont = { family: op.fontFamily ?? 'Inter', style: op.fontStyle ?? 'Regular' };
          } else if (fontsUsed.length === 1) {
            targetFont = fontsUsed[0];
          } else {
            // Mixed fonts or empty — keep first used or default
            targetFont = fontsUsed[0] ?? defaultFont;
          }

          try {
            await figma.loadFontAsync(targetFont);
          } catch (_e) {
            await figma.loadFontAsync(defaultFont);
            targetFont = defaultFont;
          }

          // Set font BEFORE characters (Figma best practice)
          node.fontName = targetFont;
          if (op.content != null && op.content !== '') {
            node.characters = op.content;
          }
          if (op.fontSize) node.fontSize = op.fontSize;
          if (op.fills) node.fills = op.fills as any;
          pushSummary(`Editado texto @"${node.name}"`, node);
        }

        // ═══ SET_OPACITY ═══
      } else if (op.type === 'SET_OPACITY') {
        const node = await figma.getNodeByIdAsync(op.nodeId) as SceneNode | null;
        if (node && 'opacity' in node) {
          node.opacity = op.opacity;
          pushSummary(`Editado opacidade @"${node.name}"`, node);
        }

        // ═══ APPLY_VARIABLE ═══
      } else if (op.type === 'APPLY_VARIABLE') {
        const node = await figma.getNodeByIdAsync(op.nodeId) as SceneNode | null;
        if (node && figma.variables) {
          const variable = await figma.variables.getVariableByIdAsync(op.variableId);
          if (variable) {
            if (op.field === 'fills' || op.field === 'strokes') {
              // For fills/strokes: use setBoundVariableForPaint (only works with SolidPaint per Figma API)
              const paintArray = (node as any)[op.field];
              if (paintArray && paintArray.length > 0) {
                const paintsCopy = [...paintArray];
                let targetPaint = paintsCopy[0];
                // setBoundVariableForPaint only accepts SolidPaint — convert if needed
                if (targetPaint.type !== 'SOLID') {
                  targetPaint = { type: 'SOLID', color: { r: 0, g: 0, b: 0 }, opacity: 1 } as SolidPaint;
                }
                paintsCopy[0] = figma.variables.setBoundVariableForPaint(
                  targetPaint, 'color', variable
                );
                (node as any)[op.field] = paintsCopy;
              }
            } else {
              // For simple fields (width, height, itemSpacing, padding, etc.)
              if ('setBoundVariable' in node) {
                (node as any).setBoundVariable(op.field, variable);
              }
            }
          }
        }

        // ═══ APPLY_STYLE ═══
      } else if (op.type === 'APPLY_STYLE') {
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
            if (typeof (node as any).setEffectStyleIdAsync === 'function') {
              await (node as any).setEffectStyleIdAsync(op.styleId);
            } else {
              (node as any).effectStyleId = op.styleId;
            }
          } else if (op.styleType === 'GRID' && 'gridStyleId' in node) {
            if (typeof (node as any).setGridStyleIdAsync === 'function') {
              await (node as any).setGridStyleIdAsync(op.styleId);
            } else {
              (node as any).gridStyleId = op.styleId;
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

      } else if (op.type === 'GET_VARIABLE_DEFS') {
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

      } else if (op.type === 'GET_SCREENSHOT') {
        const nodeId = op.nodeId;
        let node: SceneNode | null = null;
        if (nodeId) node = (await figma.getNodeByIdAsync(nodeId)) as SceneNode;
        if (!node && figma.currentPage.selection.length > 0) node = figma.currentPage.selection[0];

        if (node) {
          const bytes = await node.exportAsync({ format: 'JPG', constraint: { type: 'SCALE', value: 2 } });
          const base64 = figma.base64Encode(bytes);
          postToUI({ type: 'SCREENSHOT_RESULT', nodeId: node.id, base64: `data:image/jpeg;base64,${base64}` });
        }

      } else if (op.type === 'SEARCH_DESIGN_SYSTEM') {
        const query = op.query.toLowerCase();
        const results = { components: [] as any[], styles: [] as any[], variables: [] as any[] };

        // Search components
        const comps = figma.root.findAllWithCriteria({ types: ['COMPONENT', 'COMPONENT_SET'] });
        results.components = comps
          .filter(c => c.name.toLowerCase().includes(query))
          .slice(0, 20)
          .map(c => ({ id: c.id, name: c.name, key: (c as any).key }));

        // Search styles
        const pStyles = await figma.getLocalPaintStylesAsync();
        const tStyles = await figma.getLocalTextStylesAsync();
        results.styles = [...pStyles, ...tStyles]
          .filter(s => s.name.toLowerCase().includes(query))
          .slice(0, 20)
          .map(s => ({ id: s.id, name: s.name, type: s.type }));

        // Search variables
        if (figma.variables) {
          const vars = await figma.variables.getLocalVariablesAsync();
          results.variables = vars
            .filter(v => v.name.toLowerCase().includes(query))
            .slice(0, 20)
            .map(v => ({ id: v.id, name: v.name, type: v.resolvedType }));
        }

        postToUI({ type: 'SEARCH_DS_RESULT', results });

      } else if (op.type === 'GET_CODE_CONNECT_MAP') {
        const raw = figma.root.getPluginData('codeConnectMap');
        const mappings = raw ? JSON.parse(raw) : {};
        postToUI({ type: 'CODE_CONNECT_RESULT', mappings });

      } else if (op.type === 'ADD_CODE_CONNECT_MAP') {
        const raw = figma.root.getPluginData('codeConnectMap');
        const mappings = raw ? JSON.parse(raw) : {};
        mappings[op.nodeId] = { componentName: op.componentName, filePath: op.filePath };
        figma.root.setPluginData('codeConnectMap', JSON.stringify(mappings));
        pushSummary(`Mapeado @"${op.componentName}" para code connect`);

        // ═══ GROUP_NODES ═══
      } else if (op.type === 'GROUP_NODES') {
        const nodes: SceneNode[] = [];
        for (const id of op.nodeIds) {
          const n = await figma.getNodeByIdAsync(id);
          if (n && 'parent' in n) nodes.push(n as SceneNode);
        }
        if (nodes.length > 0) {
          // figma.group requires all nodes share the same parent
          const parent = nodes[0].parent as BaseNode & ChildrenMixin;
          const group = figma.group(nodes, parent);
          group.name = op.name;
          pushSummary(`Agrupado @"${op.name}"`, group);
        }

        // ═══ UNGROUP ═══
      } else if (op.type === 'UNGROUP') {
        const node = await figma.getNodeByIdAsync(op.nodeId) as SceneNode | null;
        if (node && 'children' in node) {
          const name = node.name;
          figma.ungroup(node as SceneNode & ChildrenMixin);
          pushSummary(`Desagrupado @"${name}"`);
        }

        // ═══ DETACH_INSTANCE ═══
      } else if (op.type === 'DETACH_INSTANCE') {
        const node = await figma.getNodeByIdAsync(op.nodeId) as InstanceNode | null;
        if (node && node.type === 'INSTANCE') {
          node.detachInstance();
          pushSummary(`Detached @"${node.name}"`, node);
        }

        // ═══ FASE 2: CREATE_COMPONENT ═══
      } else if (op.type === 'CREATE_COMPONENT') {
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
        if (op.props.fills) comp.fills = op.props.fills as any;
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

        // ═══ FASE 2: COMBINE_AS_VARIANTS ═══
      } else if (op.type === 'COMBINE_AS_VARIANTS') {
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

        // ═══ FASE 2: CREATE_SVG ═══
      } else if (op.type === 'CREATE_SVG') {
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

        // ═══ FASE 2: CREATE_LINE ═══
      } else if (op.type === 'CREATE_LINE') {
        const parent = await getParent(op.parentRef, op.parentNodeId);
        const line = figma.createLine();
        line.name = op.props.name;
        line.resize(op.props.width > 0 ? op.props.width : 100, 1);
        if (op.props.strokes) line.strokes = op.props.strokes as any;
        if (op.props.strokeWeight != null) line.strokeWeight = op.props.strokeWeight;
        parent.appendChild(line);
        if (op.ref) createdNodes.set(op.ref, line);
        pushSummary(`Linha criada @"${line.name}"`, line);

        // ═══ FASE 2: CREATE_POLYGON ═══
      } else if (op.type === 'CREATE_POLYGON') {
        const parent = await getParent(op.parentRef, op.parentNodeId);
        const polygon = figma.createPolygon();
        polygon.name = op.props.name;
        polygon.pointCount = op.props.pointCount;
        polygon.resize(op.props.width > 0 ? op.props.width : 100, op.props.height > 0 ? op.props.height : 100);
        if (op.props.fills) polygon.fills = op.props.fills as any;
        parent.appendChild(polygon);
        if (op.ref) createdNodes.set(op.ref, polygon);
        pushSummary(`Polígono criado @"${polygon.name}"`, polygon);

        // ═══ FASE 2: CREATE_STAR ═══
      } else if (op.type === 'CREATE_STAR') {
        const parent = await getParent(op.parentRef, op.parentNodeId);
        const star = figma.createStar();
        star.name = op.props.name;
        star.pointCount = op.props.pointCount;
        star.innerRadius = op.props.innerRadius ?? 0.4;
        star.resize(op.props.width > 0 ? op.props.width : 100, op.props.height > 0 ? op.props.height : 100);
        if (op.props.fills) star.fills = op.props.fills as any;
        parent.appendChild(star);
        if (op.ref) createdNodes.set(op.ref, star);
        pushSummary(`Estrela criada @"${star.name}"`, star);

        // ═══ FASE 2: SET_TEXT_RANGES ═══
      } else if (op.type === 'SET_TEXT_RANGES') {
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
              } catch (_e) {
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
              node.setRangeTextDecoration(range.start, range.end,
                range.textDecoration === 'NONE' ? 'NONE' :
                  range.textDecoration === 'UNDERLINE' ? 'UNDERLINE' :
                    'STRIKETHROUGH'
              );
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

        // ═══ FASE 4: CLONE_NODE / DUPLICATE_NODE ═══
      } else if (op.type === 'CLONE_NODE' || op.type === 'DUPLICATE_NODE') {
        console.log('[CLONE_NODE] sourceNodeId:', op.sourceNodeId);

        if (!op.sourceNodeId) {
          postToUI({ type: 'ERROR', message: 'CLONE_NODE: sourceNodeId é obrigatório' });
          continue;
        }

        const sourceNode = await figma.getNodeByIdAsync(op.sourceNodeId);
        console.log('[CLONE_NODE] sourceNode found:', !!sourceNode, sourceNode?.type);

        if (!sourceNode) {
          postToUI({ type: 'ERROR', message: `CLONE_NODE: Nó "${op.sourceNodeId}" não encontrado` });
          continue;
        }

        if (typeof (sourceNode as any).clone !== 'function') {
          postToUI({ type: 'ERROR', message: `CLONE_NODE: Nó "${sourceNode.name}" não suporta clone (tipo: ${sourceNode.type})` });
          continue;
        }

        const parent = await getParent(op.parentRef, op.parentNodeId);

        try {
          const cloned = (sourceNode as SceneNode).clone();
          console.log('[CLONE_NODE] Cloned successfully:', cloned.id, cloned.name);

          if (op.overrides?.name) cloned.name = op.overrides.name;
          if (op.overrides?.width && 'resize' in cloned) {
            (cloned as any).resize(op.overrides.width, op.overrides.height || (cloned as any).height);
          }
          if (op.overrides?.fills && 'fills' in cloned) {
            (cloned as any).fills = op.overrides.fills as any;
          }

          parent.appendChild(cloned);
          if (op.ref) createdNodes.set(op.ref, cloned);

          // ═══ TEXT OVERRIDES: Change text content by layer name ═══
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
                // Load font before changing text
                const fontName = typeof textNode.fontName !== 'symbol' ? textNode.fontName : { family: 'Inter', style: 'Regular' };
                try {
                  await figma.loadFontAsync(fontName);
                } catch (_e) {
                  await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });
                }
                textNode.characters = override.content;
                pushSummary(`Texto "${override.name}" → "${override.content.slice(0, 30)}..."`, textNode);
              }
            }
          }

          pushSummary(`Clonado @"${cloned.name}"`, cloned);
        } catch (e) {
          console.error('[CLONE_NODE] Error:', e);
          postToUI({ type: 'ERROR', message: `Clone falhou: ${String(e)}` });
        }

        // ═══ FASE 4: REORDER_CHILD ═══
      } else if (op.type === 'REORDER_CHILD') {
        const node = await figma.getNodeByIdAsync(op.nodeId) as any;
        const parent = await figma.getNodeByIdAsync(op.parentNodeId);
        if (node && parent && 'children' in parent) {
          const parentFrame = parent as BaseNode & ChildrenMixin;
          if (op.index >= 0 && op.index <= parentFrame.children.length) {
            // insertChild requires node to already be a child; remove first if needed
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

        // ═══ FASE 4: SET_CONSTRAINTS ═══
      } else if (op.type === 'SET_CONSTRAINTS') {
        const node = await figma.getNodeByIdAsync(op.nodeId);
        if (node && 'constraints' in node) {
          (node as any).constraints = {
            horizontal: op.horizontal,
            vertical: op.vertical,
          };
          pushSummary(`Constraints definidas @"${(node as any).name}"`, node as SceneNode);
        }

        // ═══ FASE 4: SET_LAYOUT_GRID ═══
      } else if (op.type === 'SET_LAYOUT_GRID') {
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

        // ═══ FASE 4: CREATE_VARIABLE ═══
      } else if (op.type === 'CREATE_VARIABLE') {
        if (figma.variables) {
          try {
            // getLocalVariableCollections is synchronous; no await needed
            const collections = (figma.variables as any).getLocalVariableCollections?.() || [];
            let collection = collections.find(
              (c: any) => c.name === op.collectionName
            );

            if (!collection) {
              collection = (figma.variables as any).createVariableCollection?.(op.collectionName);
            }

            if (collection) {
              // Correct API: createVariable(name, collectionId, resolvedType)
              const variable = (figma.variables as any).createVariable?.(
                op.name,
                collection.id,
                op.resolvedType
              );
              if (variable) {
                // Set value using the collection's default mode
                variable.setValueForMode(collection.defaultModeId, op.value);
                if (op.ref) createdNodes.set(op.ref, variable as any);
                summaryLines.push(`Variável criada: ${op.name}`);
              }
            }
          } catch (e) {
            postToUI({ type: 'ERROR', message: `Erro ao criar variável: ${String(e)}` });
          }
        }

        // ═══ FASE 4: SET_BLEND_MODE ═══
      } else if (op.type === 'SET_BLEND_MODE') {
        const node = await figma.getNodeByIdAsync(op.nodeId);
        if (node && 'blendMode' in node) {
          (node as any).blendMode = op.blendMode;
          pushSummary(`Blend mode definido @"${(node as any).name}"`, node as SceneNode);
        }

        // ═══ FASE 4: SET_INDIVIDUAL_CORNERS ═══
      } else if (op.type === 'SET_INDIVIDUAL_CORNERS') {
        const node = await figma.getNodeByIdAsync(op.nodeId);
        if (node && 'topLeftRadius' in node) {
          if (op.topLeftRadius != null) (node as any).topLeftRadius = op.topLeftRadius;
          if (op.topRightRadius != null) (node as any).topRightRadius = op.topRightRadius;
          if (op.bottomLeftRadius != null) (node as any).bottomLeftRadius = op.bottomLeftRadius;
          if (op.bottomRightRadius != null) (node as any).bottomRightRadius = op.bottomRightRadius;
          if (op.cornerSmoothing != null) (node as any).cornerSmoothing = op.cornerSmoothing;
          pushSummary(`Corners individuais definidos @"${(node as any).name}"`, node as SceneNode);
        }

        // ═══ FASE 4: BOOLEAN_OPERATION ═══
      } else if (op.type === 'BOOLEAN_OPERATION') {
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

            // Use correct Figma API methods: union, subtract, intersect, exclude
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

        // ═══ DELETE_NODE ═══
      } else if (op.type === 'DELETE_NODE') {
        const node = await figma.getNodeByIdAsync(op.nodeId);
        if (node) {
          pushSummary(`Removido @"${node.name}"`);
          node.remove();
        }
      }
    } catch (err) {
      postToUI({ type: 'ERROR', message: `Op ${op.type}: ${String(err)}` });
    }
  }

  // Select root nodes created and zoom to view
  const rootNodes = [...createdNodes.values()].filter(
    n => n.parent === figma.currentPage
  );
  if (rootNodes.length > 0) {
    figma.currentPage.selection = rootNodes;
    figma.viewport.scrollAndZoomIntoView(rootNodes);
  }

  // Build ref → nodeId mapping for chat memory
  const nodeIdMap: Record<string, { nodeId: string; name: string }> = {};
  for (const [ref, node] of createdNodes) {
    nodeIdMap[ref] = { nodeId: node.id, name: node.name };
  }

  const summary = summaryLines.length > 0 ? summaryLines.join('\n') : undefined;
  postToUI({ type: 'OPERATIONS_DONE', count: ops.length, summary, summaryItems, canUndo, nodeIdMap });
}

/**
 * Paste generated image to canvas as a frame with image fill
 */
async function pasteGeneratedImage(imageData: string, prompt: string, width: number = 800, height: number = 450, isUrl: boolean = false) {
  try {
    // Get or create a frame to hold the image
    const page = figma.currentPage;

    // Create a frame for the image with dynamic dimensions
    const frame = figma.createFrame();
    frame.name = `Generated: ${prompt.substring(0, 30)}...`;
    frame.resize(width, height);

    // Position it near the center of the current viewport
    frame.x = page.selection.length > 0
      ? (page.selection[0] as any).x + 50
      : 0;
    frame.y = page.selection.length > 0
      ? (page.selection[0] as any).y + 50
      : 0;

    // Create a rectangle to hold the image
    const rectangle = figma.createRectangle();
    rectangle.resize(width, height);
    rectangle.fills = [];
    frame.appendChild(rectangle);

    // Apply image fill using SET_IMAGE_FILL operation logic
    let bytes: Uint8Array;

    if (isUrl) {
      // Fetch image from URL (e.g., from R2)
      try {
        const response = await fetch(imageData);
        if (!response.ok) throw new Error(`Failed to fetch image: ${response.statusText}`);
        const arrayBuffer = await response.arrayBuffer();
        bytes = new Uint8Array(arrayBuffer);
      } catch (fetchError) {
        console.error('Failed to fetch image URL, falling back to base64:', fetchError);
        // Fallback: treat as base64
        const imageBase64 = imageData.includes(',')
          ? imageData.split(',')[1]
          : imageData;
        bytes = figma.base64Decode(imageBase64);
      }
    } else {
      // Handle base64 data
      const imageBase64 = imageData.includes(',')
        ? imageData.split(',')[1]
        : imageData;
      bytes = figma.base64Decode(imageBase64);
    }

    const imageHash = figma.createImage(bytes).hash;

    // Set the fill
    rectangle.fills = [{
      type: 'IMAGE',
      scaleMode: 'FILL',
      imageHash: imageHash as string,
    } as any];

    // Select the frame and notify
    page.selection = [frame];
    figma.viewport.scrollAndZoomIntoView([frame]);

    postToUI({
      type: 'IMAGE_PASTED',
      message: '✨ Imagem colada no canvas!',
      nodeId: frame.id
    });
  } catch (error) {
    console.error('[PasteImage] Error:', error);
    postToUI({
      type: 'IMAGE_PASTE_ERROR',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

function deleteSelection() {
  const selection = figma.currentPage.selection;
  for (const node of selection) {
    node.remove();
  }
  postToUI({ type: 'OPERATIONS_DONE', count: selection.length });
}

function getFolderPath(node: BaseNode): string[] {
  const path: string[] = [];
  let current: BaseNode | null = node.parent;
  while (current && current.type !== 'PAGE') {
    path.unshift(current.name);
    current = current.parent;
  }
  if (current && current.type === 'PAGE') {
    path.unshift(current.name);
  }
  return path;
}

async function exportThumbnail(node: ComponentNode | ComponentSetNode): Promise<string | undefined> {
  try {
    const bytes = await node.exportAsync({
      format: 'PNG',
      constraint: { type: 'HEIGHT', value: 64 }
    });
    const b64 = figma.base64Encode(bytes);
    return `data:image/png;base64,${b64}`;
  } catch (_e) {
    return undefined;
  }
}

async function getComponentsInCurrentFile(): Promise<ComponentInfo[]> {
  const components: ComponentInfo[] = [];

  try {
    // Use cached pages loading to avoid redundant async calls
    await ensurePagesLoaded();
    const nodes = figma.root.findAllWithCriteria({ types: ['COMPONENT', 'COMPONENT_SET'] });
    const seen = new Set<string>();
    for (const node of nodes) {
      if (!seen.has(node.id)) {
        seen.add(node.id);
        components.push({
          id: node.id,
          name: node.name,
          key: node.key,
          folderPath: getFolderPath(node)
        });
      }
    }
  } catch (e) {
    console.log('[Plugin] Error finding components:', e);
  }

  return components;
}

async function exportComponentThumbnails(components: ComponentInfo[]): Promise<void> {
  const BATCH = 12;
  for (let i = 0; i < components.length; i += BATCH) {
    const batch = components.slice(i, i + BATCH);
    await Promise.all(
      batch.map(async (comp) => {
        const node = await figma.getNodeByIdAsync(comp.id) as ComponentNode | ComponentSetNode | null;
        if (node) {
          const thumb = await exportThumbnail(node);
          if (thumb) postToUI({ type: 'COMPONENT_THUMBNAIL', componentId: comp.id, thumbnail: thumb });
        }
      })
    );
  }
}

function rgbToHex(r: number, g: number, b: number): string {
  const ri = Math.round(r * 255);
  const gi = Math.round(g * 255);
  const bi = Math.round(b * 255);
  return `#${ri.toString(16).padStart(2, '0')}${gi.toString(16).padStart(2, '0')}${bi.toString(16).padStart(2, '0')}`;
}

async function getColorVariablesFromFile(): Promise<ColorVariable[]> {
  const colors: ColorVariable[] = [];
  const seen = new Set<string>();

  // ── 1. Local color variables ──
  try {
    if (figma.variables && typeof figma.variables.getLocalVariablesAsync === 'function') {
      const allVariables = await figma.variables.getLocalVariablesAsync('COLOR');
      for (const variable of allVariables) {
        const value = variable.valuesByMode[Object.keys(variable.valuesByMode)[0]];
        let colorHex = '#ccc';
        if (typeof value === 'object' && 'r' in value) {
          colorHex = rgbToHex((value as any).r, (value as any).g, (value as any).b);
        }
        colors.push({ id: variable.id, name: variable.name, value: colorHex });
        seen.add(colorHex);
      }
    }
  } catch (e) {
    console.log('[Plugin] Error getting color variables:', e);
  }

  // ── 2. Local paint styles ──
  try {
    const paintStyles = await figma.getLocalPaintStylesAsync();
    for (const style of paintStyles) {
      const paint = style.paints[0];
      if (paint?.type === 'SOLID' && paint.color) {
        const hex = rgbToHex(paint.color.r, paint.color.g, paint.color.b);
        if (!seen.has(hex)) {
          colors.push({ id: style.id, name: style.name, value: hex });
          seen.add(hex);
        }
      }
    }
  } catch (e) {
    console.log('[Plugin] Error getting paint styles:', e);
  }

  // ── 3. Library color variables (requires teamlibrary permission) ──
  try {
    if (figma.teamLibrary && typeof figma.teamLibrary.getAvailableLibraryVariableCollectionsAsync === 'function') {
      const collections = await figma.teamLibrary.getAvailableLibraryVariableCollectionsAsync();
      for (const col of collections) {
        const libVars = await figma.teamLibrary.getVariablesInLibraryCollectionAsync(col.key);
        for (const libVar of libVars) {
          if (libVar.resolvedType === 'COLOR') {
            // Import to get actual value — Figma only exposes name/key on LibraryVariable
            try {
              const imported = await figma.variables.importVariableByKeyAsync(libVar.key);
              // Validate imported variable structure
              if (imported && imported.valuesByMode && typeof imported.valuesByMode === 'object') {
                const modeId = Object.keys(imported.valuesByMode)[0];
                const val = imported.valuesByMode[modeId];
                if (typeof val === 'object' && val !== null && 'r' in val && 'g' in val && 'b' in val) {
                  const hex = rgbToHex((val as any).r, (val as any).g, (val as any).b);
                  if (!seen.has(hex)) {
                    colors.push({ id: imported.id, name: `${col.name}/${libVar.name}`, value: hex });
                    seen.add(hex);
                  }
                }
              }
            } catch (_e) {
              // Import may fail for some variables — skip
            }
          }
        }
      }
    }
  } catch (e) {
    console.log('[Plugin] Error getting library color variables:', e);
  }

  // ── 4. Colors from current selection ──
  try {
    const selection = figma.currentPage.selection;
    for (const node of selection) {
      if ('fills' in node && Array.isArray(node.fills)) {
        for (const fill of node.fills as ReadonlyArray<Paint>) {
          if (fill.type === 'SOLID' && (fill as SolidPaint).color) {
            const c = (fill as SolidPaint).color;
            const hex = rgbToHex(c.r, c.g, c.b);
            if (!seen.has(hex)) {
              colors.push({ id: `sel:${node.id}:fill`, name: `${node.name} (fill)`, value: hex });
              seen.add(hex);
            }
          }
        }
      }
      if ('strokes' in node && Array.isArray(node.strokes)) {
        for (const stroke of node.strokes as ReadonlyArray<Paint>) {
          if (stroke.type === 'SOLID' && (stroke as SolidPaint).color) {
            const c = (stroke as SolidPaint).color;
            const hex = rgbToHex(c.r, c.g, c.b);
            if (!seen.has(hex)) {
              colors.push({ id: `sel:${node.id}:stroke`, name: `${node.name} (stroke)`, value: hex });
              seen.add(hex);
            }
          }
        }
      }
    }
  } catch (e) {
    console.log('[Plugin] Error extracting selection colors:', e);
  }

  console.log('[Plugin] Total colors found:', colors.length);
  return colors;
}

async function getFontVariablesFromFile(): Promise<FontVariable[]> {
  const fonts: FontVariable[] = [];

  try {
    if (!figma.variables || typeof figma.variables.getLocalVariablesAsync !== 'function') {
      console.log('[Plugin] Font variables API not available');
      return fonts;
    }

    const allVariables = await figma.variables.getLocalVariablesAsync('STRING');
    for (const variable of allVariables) {
      const nameLower = variable.name.toLowerCase();
      if (nameLower.includes('font') || nameLower.includes('typeface') || nameLower.includes('typography')) {
        fonts.push({
          id: variable.id,
          name: variable.name
        });
      }
    }
  } catch (e) {
    console.log('[Plugin] Error getting font variables:', e);
  }

  console.log('[Plugin] Total font variables found:', fonts.length);
  return fonts;
}

async function getAvailableFontFamilies(): Promise<string[]> {
  try {
    const fonts = await figma.listAvailableFontsAsync();
    const families = new Set<string>();
    for (const f of fonts) {
      families.add(f.fontName.family);
    }
    return [...families].sort();
  } catch (_e) {
    return [];
  }
}

async function notifyContextChange() {
  const [components, colors, fonts] = await Promise.all([
    getComponentsInCurrentFile(),
    getColorVariablesFromFile(),
    getFontVariablesFromFile()
  ]);
  const selection = figma.currentPage.selection;

  // Build detailed selection info for UI
  const selectionDetails: Array<{ id: string; name: string; type: string }> = [];
  for (const node of selection) {
    selectionDetails.push({ id: node.id, name: node.name, type: node.type });
  }

  figma.ui.postMessage({
    type: 'CONTEXT_UPDATED',
    selectedElements: selection.length,
    componentsCount: components.length,
    colorVariables: colors.length,
    fontVariables: fonts.length,
    selectionDetails
  });

  // Export thumbnail for single selection
  if (selection.length === 1) {
    const node = selection[0];
    try {
      const bytes = await node.exportAsync({
        format: 'PNG',
        constraint: { type: 'HEIGHT', value: 48 }
      });
      const b64 = figma.base64Encode(bytes);
      figma.ui.postMessage({
        type: 'SELECTION_THUMBNAIL',
        nodeId: node.id,
        thumbnail: `data:image/png;base64,${b64}`
      });
    } catch (_e) {
      // Some nodes can't be exported, that's fine
    }
  }
}

figma.showUI(__html__, { width: 420, height: 680, themeColors: true, title: 'Visant Copilot' });

// Notify when selection changes
figma.on('selectionchange', notifyContextChange);

async function getComponentFromSelection(): Promise<ComponentInfo | null> {
  const sel = figma.currentPage.selection;
  if (sel.length !== 1) return null;
  const node = sel[0];
  if (node.type === 'COMPONENT' || node.type === 'COMPONENT_SET') {
    return { id: node.id, name: node.name, key: node.key, folderPath: getFolderPath(node) };
  }
  if (node.type === 'INSTANCE') {
    try {
      const main = await node.getMainComponentAsync();
      if (main) {
        return { id: main.id, name: main.name, key: main.key, folderPath: main.parent ? getFolderPath(main) : [] };
      }
    } catch (_e) {
      // Component may not be accessible
    }
  }
  return null;
}

figma.ui.onmessage = async (msg: UIMessage) => {
  // ── Agent Operations (WebSocket from server) ──
  if (msg.type === 'AGENT_OPS') {
    try {
      const { operations, opId } = msg as any;
      await applyOperations(operations);

      // Send ACK back to UI (which forwards to server via WebSocket)
      postToUI({
        type: 'OPERATION_ACK',
        opId,
        success: true,
        appliedCount: operations.length,
      });

      console.log(`[Agent] Applied ${operations.length} operations (opId=${opId})`);
    } catch (err) {
      const { opId } = msg as any;
      const errorMsg = err instanceof Error ? err.message : String(err);

      // Send error back to UI
      postToUI({
        type: 'OPERATION_ERROR',
        opId,
        error: errorMsg,
      });

      console.error(`[Agent] Operation failed (opId=${opId}):`, err);
    }
    return;
  }

  // ── WebSocket initialization (from UI) ──
  if (msg.type === 'INIT_WS') {
    // UI will handle WebSocket connection, just log for now
    console.log('[Plugin] WebSocket initialization message received');
    return;
  }

  // ── Undo last batch of operations (official Figma API) ──
  if (msg.type === 'UNDO_LAST_BATCH') {
    if (canUndo) {
      figma.triggerUndo();
      canUndo = false;
      postToUI({
        type: 'UNDO_RESULT',
        success: true,
        message: '↩️ Última operação desfeita com sucesso.',
        canUndo: false
      });
    } else {
      postToUI({
        type: 'UNDO_RESULT',
        success: false,
        message: 'Nenhuma operação para desfazer.',
        canUndo: false
      });
    }
    return;
  }

  // ── Selection change notification (to server) ──
  if (msg.type === 'REPORT_SELECTION') {
    const selection = figma.currentPage.selection;
    const nodes = selection.map((n) => ({
      name: n.name,
      id: n.id,
      type: n.type,
    }));

    postToUI({
      type: 'SELECTION_CHANGED',
      nodes,
    });
    return;
  }

  if (msg.type === 'USE_SELECTION_AS_LOGO') {
    const comp = await getComponentFromSelection();
    postToUI({ type: 'SELECTION_AS_LOGO', component: comp });
    return;
  }

  // ── Get elements for mentions autocomplete in chat ──
  if (msg.type === 'GET_ELEMENTS_FOR_MENTIONS') {
    const elements = getElementsForMentions();
    postToUI({ type: 'ELEMENTS_FOR_MENTIONS', ...elements });
    return;
  }

  // ── Get templates (frames with [Template] prefix) ──
  if (msg.type === 'GET_TEMPLATES') {
    const templates = figma.currentPage.findAll(node =>
      node.type === 'FRAME' && node.name.startsWith('[Template]')
    ) as FrameNode[];

    const result = templates.map(t => {
      // Find all text nodes in template (editable layers)
      const textLayers: { id: string; name: string; characters: string; fontFamily?: string; fontStyle?: string; fontSize?: number }[] = [];
      const findTextNodes = (node: SceneNode) => {
        if (node.type === 'TEXT') {
          const textNode = node as TextNode;
          const fontName = typeof textNode.fontName !== 'symbol' ? textNode.fontName : null;
          textLayers.push({
            id: textNode.id,
            name: textNode.name,
            characters: textNode.characters,
            fontFamily: fontName?.family,
            fontStyle: fontName?.style,
            fontSize: typeof textNode.fontSize === 'number' ? textNode.fontSize : undefined,
          });
        }
        if ('children' in node) {
          for (const child of (node as FrameNode).children) {
            findTextNodes(child);
          }
        }
      };
      for (const child of t.children) {
        findTextNodes(child);
      }

      // Check if template has images
      let hasImages = false;
      const checkForImages = (node: SceneNode) => {
        if ('fills' in node && Array.isArray(node.fills)) {
          for (const fill of node.fills as Paint[]) {
            if (fill.type === 'IMAGE') {
              hasImages = true;
              return;
            }
          }
        }
        if ('children' in node) {
          for (const child of (node as FrameNode).children) {
            if (hasImages) return;
            checkForImages(child);
          }
        }
      };
      checkForImages(t);

      return {
        id: t.id,
        name: t.name.replace(/^\[Template\]\s*/, ''),
        width: Math.round(t.width),
        height: Math.round(t.height),
        childCount: t.children?.length || 0,
        textLayers,
        hasImages,
      };
    });

    postToUI({
      type: 'TEMPLATES_RESULT',
      requestId: (msg as any).requestId,
      templates: result,
    });
    return;
  }

  // ── Get agent components ([Agent] pages or [Component] prefix) ──
  if (msg.type === 'GET_AGENT_COMPONENTS') {
    const components: any[] = [];

    // First, look for [Agent] pages
    const agentPages = figma.root.children.filter(
      page => page.name.toLowerCase().startsWith('[agent]')
    );

    // Scan agent pages for components
    for (const page of agentPages) {
      const pageComps = page.findAllWithCriteria({ types: ['COMPONENT', 'COMPONENT_SET'] });
      for (const comp of pageComps) {
        components.push({
          id: comp.id,
          key: (comp as ComponentNode).key || comp.id,
          name: comp.name,
          description: (comp as ComponentNode).description || '',
          width: comp.width,
          height: comp.height,
        });
      }
    }

    // Also scan all pages for [Component] prefixed nodes
    for (const page of figma.root.children) {
      if (agentPages.includes(page)) continue; // Already scanned

      const prefixedComps = page.findAllWithCriteria({ types: ['COMPONENT', 'COMPONENT_SET'] })
        .filter(n => n.name.toLowerCase().startsWith('[component]'));

      for (const comp of prefixedComps) {
        // Avoid duplicates
        if (!components.some(c => c.id === comp.id)) {
          components.push({
            id: comp.id,
            key: (comp as ComponentNode).key || comp.id,
            name: comp.name,
            description: (comp as ComponentNode).description || '',
            width: comp.width,
            height: comp.height,
          });
        }
      }
    }

    postToUI({ type: 'AGENT_COMPONENTS_RESULT', components });
    return;
  }

  // ── Select and zoom to a node by ID (clickable node chips in chat) ──
  if (msg.type === 'SELECT_AND_ZOOM') {
    try {
      const node = await figma.getNodeByIdAsync((msg as any).nodeId);
      if (node && 'parent' in node) {
        figma.currentPage.selection = [node as SceneNode];
        figma.viewport.scrollAndZoomIntoView([node as SceneNode]);
      }
    } catch (_e) {
      // Node may have been deleted
    }
    return;
  }
  if (msg.type === 'GET_CONTEXT') {
    const [components, colors, fonts] = await Promise.all([
      getComponentsInCurrentFile(),
      getColorVariablesFromFile(),
      getFontVariablesFromFile()
    ]);
    const selection = figma.currentPage.selection;

    // Send context updated
    postToUI({
      type: 'CONTEXT_UPDATED',
      selectedElements: selection.length,
      componentsCount: components.length,
      colorVariables: colors.length,
      fontVariables: fonts.length
    });

    // Send data to UI immediately, then thumbnails and fonts in background
    postToUI({ type: 'COMPONENTS_LOADED', components });
    postToUI({ type: 'FONT_VARIABLES_LOADED', fonts });
    postToUI({ type: 'COLOR_VARIABLES_LOADED', colors });
    exportComponentThumbnails(components).catch(() => { });
    getAvailableFontFamilies().then(families => {
      postToUI({ type: 'AVAILABLE_FONTS_LOADED', families });
    }).catch(() => { });
  } else if (msg.type === 'APPLY_OPERATIONS') {
    await applyOperations(msg.payload);
  } else if (msg.type === 'APPLY_OPERATIONS_FROM_API') {
    await applyOperations(msg.operations);
  } else if (msg.type === 'GENERATE_WITH_CONTEXT') {
    const useScanPage = !!(msg as any).scanPage;
    const [components, colors, fonts, contextData] = await Promise.all([
      getComponentsInCurrentFile(),
      getColorVariablesFromFile(),
      getFontVariablesFromFile(),
      useScanPage ? serializePage() : serializeSelection()
    ]);

    // Collect all context with user selections
    const availableLayers = getAvailableLayers();
    const context = {
      command: msg.command,
      fileId: figma.fileKey || 'local_file',
      selectedElements: contextData.nodes,
      scanPage: useScanPage,
      availableComponents: components,
      availableColorVariables: colors,
      availableFontVariables: fonts,
      availableLayers,
      selectedLogo: msg.logoComponent,
      brandLogos: (msg as any).brandLogos || null,
      selectedBrandFont: msg.brandFont,
      brandFonts: (msg as any).brandFonts || null,
      selectedBrandColors: msg.brandColors,
      designSystem: (msg as any).designSystem || null,
      thinkMode: (msg as any).thinkMode || false,
      mentions: (msg as any).mentions || [],
      attachments: (msg as any).attachments || []
    };

    // Send context to UI to make the API call
    postToUI({ type: 'CALL_API', context });
  } else if (msg.type === 'PASTE_GENERATED_IMAGE') {
    await pasteGeneratedImage(msg.imageData, msg.prompt, msg.width || 800, msg.height || 450, msg.isUrl || false);
  } else if (msg.type === 'DELETE_SELECTION') {
    deleteSelection();
  } else if (msg.type === 'OPEN_EXTERNAL') {
    figma.openExternal(msg.url);
  } else if (msg.type === 'SAVE_API_KEY') {
    try {
      await figma.clientStorage.setAsync('userApiKey', msg.key);
      postToUI({ type: 'API_KEY_SAVED' });
    } catch (_e) {
      postToUI({ type: 'API_KEY_SAVED' });
    }
  } else if (msg.type === 'GET_API_KEY') {
    try {
      const key = await figma.clientStorage.getAsync('userApiKey');
      postToUI({ type: 'API_KEY_LOADED', key: key || '' });
    } catch (_e) {
      postToUI({ type: 'API_KEY_LOADED', key: '' });
    }
  } else if (msg.type === 'SAVE_ANTHROPIC_KEY') {
    try {
      await figma.clientStorage.setAsync('anthropicApiKey', msg.key);
      postToUI({ type: 'ANTHROPIC_KEY_SAVED' });
    } catch (_e) {
      postToUI({ type: 'ANTHROPIC_KEY_SAVED' });
    }
  } else if (msg.type === 'GET_ANTHROPIC_KEY') {
    try {
      const key = await figma.clientStorage.getAsync('anthropicApiKey');
      postToUI({ type: 'ANTHROPIC_KEY_LOADED', key: key || '' });
    } catch (_e) {
      postToUI({ type: 'ANTHROPIC_KEY_LOADED', key: '' });
    }

    // ── Auth Token (persisted in clientStorage — per machine) ──
  } else if (msg.type === 'SAVE_AUTH_TOKEN') {
    try {
      await figma.clientStorage.setAsync('authToken', (msg as any).token || '');
      postToUI({ type: 'AUTH_TOKEN_SAVED' });
    } catch (_e) {
      postToUI({ type: 'AUTH_TOKEN_SAVED' });
    }
  } else if (msg.type === 'GET_AUTH_TOKEN') {
    try {
      const token = await figma.clientStorage.getAsync('authToken');
      postToUI({ type: 'AUTH_TOKEN_LOADED', token: token || '' });
    } catch (_e) {
      postToUI({ type: 'AUTH_TOKEN_LOADED', token: '' });
    }

    // ── Brand Guideline Presets (stored in document via setPluginData — syncs with Figma Cloud) ──
  } else if (msg.type === 'GET_GUIDELINES') {
    try {
      const raw = figma.root.getPluginData('brandGuidelines');
      const guidelines = raw ? JSON.parse(raw) : [];
      postToUI({ type: 'GUIDELINES_LOADED', guidelines });
    } catch (_e) {
      postToUI({ type: 'GUIDELINES_LOADED', guidelines: [] });
    }

  } else if (msg.type === 'SAVE_GUIDELINE') {
    try {
      const raw = figma.root.getPluginData('brandGuidelines');
      const guidelines: unknown[] = raw ? JSON.parse(raw) : [];
      const incoming = msg.guideline;
      const idx = guidelines.findIndex((g: any) => g.id === incoming.id);
      if (idx >= 0) guidelines[idx] = incoming;
      else guidelines.push(incoming);
      figma.root.setPluginData('brandGuidelines', JSON.stringify(guidelines));
      postToUI({ type: 'GUIDELINE_SAVED', guidelines, savedId: incoming.id });
    } catch (_e) {
      postToUI({ type: 'GUIDELINE_SAVED', guidelines: [msg.guideline], savedId: msg.guideline.id });
    }

  } else if (msg.type === 'DELETE_GUIDELINE') {
    try {
      const raw = figma.root.getPluginData('brandGuidelines');
      const guidelines: unknown[] = raw ? JSON.parse(raw) : [];
      const updated = guidelines.filter((g: any) => g.id !== msg.id);
      figma.root.setPluginData('brandGuidelines', JSON.stringify(updated));
      postToUI({ type: 'GUIDELINES_LOADED', guidelines: updated });
    } catch (_e) {
      postToUI({ type: 'GUIDELINES_LOADED', guidelines: [] });
    }

    // ── Design System (stored in document via setPluginData — syncs with Figma Cloud) ──
  } else if (msg.type === 'GET_DESIGN_SYSTEM') {
    try {
      const raw = figma.root.getPluginData('visantDesignSystem');
      const designSystem = raw ? JSON.parse(raw) : null;
      postToUI({ type: 'DESIGN_SYSTEM_LOADED', designSystem });
    } catch (_e) {
      postToUI({ type: 'DESIGN_SYSTEM_LOADED', designSystem: null });
    }

  } else if (msg.type === 'SAVE_DESIGN_SYSTEM') {
    try {
      const designSystem = msg.designSystem || null;
      if (designSystem) {
        figma.root.setPluginData('visantDesignSystem', JSON.stringify(designSystem));
      } else {
        figma.root.setPluginData('visantDesignSystem', '');
      }
      postToUI({ type: 'DESIGN_SYSTEM_SAVED', designSystem });
    } catch (_e) {
      postToUI({ type: 'DESIGN_SYSTEM_SAVED', designSystem: null });
    }

  } else if (msg.type === 'GET_BRAND_GUIDELINE') {
    const selectedId = figma.root.getPluginData('brandGuidelineSelectedId')
    const cached = figma.root.getPluginData('brandGuidelineCache')
    postToUI({
      type: 'BRAND_GUIDELINE_LOADED',
      selectedId: selectedId || null,
      guideline: cached || null,
    })

  } else if (msg.type === 'SAVE_BRAND_GUIDELINE') {
    const { selectedId, guideline } = msg
    figma.root.setPluginData('brandGuidelineSelectedId', selectedId || '')
    figma.root.setPluginData('brandGuidelineCache', guideline || '')
    postToUI({ type: 'BRAND_GUIDELINE_SAVED' })

  } else if (msg.type === 'LINK_GUIDELINE') {
    // Auto-load brand guideline from Canvas project
    const { guidelineId, autoLoad } = msg as { guidelineId: string; autoLoad?: boolean }
    if (guidelineId) {
      // Store the linked guideline ID
      figma.root.setPluginData('brandGuidelineSelectedId', guidelineId)
      // Notify UI to fetch and activate the guideline
      postToUI({
        type: 'BRAND_GUIDELINE_LOADED',
        selectedId: guidelineId,
        guideline: null, // UI will fetch fresh from server
        autoLoad: autoLoad ?? true,
      })
    }
  }
};
