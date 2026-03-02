// Figma plugin sandbox — runs in QuickJS, no browser APIs

import type { UIMessage, FigmaOperation, SerializedContext, SerializedNode, ComponentInfo, ColorVariable, FontVariable, AvailableLayer } from '../../src/lib/figma-types';


function postToUI(msg: { type: string } & Record<string, unknown>) {
  figma.ui.postMessage(msg);
}

// ── Deep node serialization (Phase 3) ──

async function serializeNode(node: SceneNode, depth = 0): Promise<SerializedNode> {
  const base: SerializedNode = {
    id: node.id,
    type: node.type,
    name: node.name,
    width: 'width' in node ? (node as any).width : 0,
    height: 'height' in node ? (node as any).height : 0,
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
    base.fills = (node.fills as ReadonlyArray<Paint>).map((f: Paint) => ({
      type: f.type,
      color: f.type === 'SOLID' ? (f as SolidPaint).color : undefined,
      opacity: 'opacity' in f ? (f as SolidPaint).opacity : undefined,
    }));
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

  // Recursively serialize children (max 3 levels deep for performance)
  if ('children' in node && (node as any).children && depth < 3) {
    const children: SerializedNode[] = [];
    for (const child of (node as any).children as SceneNode[]) {
      children.push(await serializeNode(child, depth + 1));
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

// ── Apply Operations (21 types with ref/parentRef hierarchy) ──

async function applyOperations(ops: FigmaOperation[]) {
  const createdNodes = new Map<string, SceneNode>();
  const defaultFont: FontName = { family: 'Inter', style: 'Regular' };
  const summaryLines: string[] = [];

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
          frame.layoutWrap = op.props.layoutWrap ?? 'NO_WRAP';
          frame.paddingTop = op.props.paddingTop ?? 0;
          frame.paddingRight = op.props.paddingRight ?? 0;
          frame.paddingBottom = op.props.paddingBottom ?? 0;
          frame.paddingLeft = op.props.paddingLeft ?? 0;
        }

        if (op.props.fills) frame.fills = op.props.fills;
        if (op.props.cornerRadius != null) frame.cornerRadius = op.props.cornerRadius;
        if (op.props.cornerSmoothing != null) frame.cornerSmoothing = op.props.cornerSmoothing;
        if (op.props.clipsContent != null) frame.clipsContent = op.props.clipsContent;

        // Position at center if root, otherwise append to parent
        if (parent === figma.currentPage) {
          frame.x = figma.viewport.center.x - fw / 2;
          frame.y = figma.viewport.center.y - fh / 2;
        }
        parent.appendChild(frame);

        // Layout sizing (must be set AFTER appendChild)
        if (op.props.layoutSizingHorizontal && parent !== figma.currentPage) {
          frame.layoutSizingHorizontal = op.props.layoutSizingHorizontal;
        }
        if (op.props.layoutSizingVertical && parent !== figma.currentPage) {
          frame.layoutSizingVertical = op.props.layoutSizingVertical;
        }

        if (op.ref) createdNodes.set(op.ref, frame);
        summaryLines.push(`Criado @"${frame.name}"`);

        // ═══ CREATE_RECTANGLE ═══
      } else if (op.type === 'CREATE_RECTANGLE') {
        const parent = await getParent(op.parentRef, op.parentNodeId);
        const rect = figma.createRectangle();
        rect.name = op.props.name;
        rect.resize(op.props.width > 0 ? op.props.width : 100, op.props.height > 0 ? op.props.height : 100);
        if (op.props.fills) rect.fills = op.props.fills;
        if (op.props.cornerRadius != null) rect.cornerRadius = op.props.cornerRadius;
        if (op.props.strokes) rect.strokes = op.props.strokes;
        if (op.props.strokeWeight != null) rect.strokeWeight = op.props.strokeWeight;
        if (op.props.opacity != null) rect.opacity = op.props.opacity;
        parent.appendChild(rect);
        if (op.props.layoutSizingHorizontal && parent !== figma.currentPage) {
          rect.layoutSizingHorizontal = op.props.layoutSizingHorizontal;
        }
        if (op.props.layoutSizingVertical && parent !== figma.currentPage) {
          rect.layoutSizingVertical = op.props.layoutSizingVertical;
        }
        if (op.ref) createdNodes.set(op.ref, rect);
        summaryLines.push(`Criado @"${rect.name}"`);

        // ═══ CREATE_ELLIPSE ═══
      } else if (op.type === 'CREATE_ELLIPSE') {
        const parent = await getParent(op.parentRef, op.parentNodeId);
        const ellipse = figma.createEllipse();
        ellipse.name = op.props.name;
        ellipse.resize(op.props.width > 0 ? op.props.width : 100, op.props.height > 0 ? op.props.height : 100);
        if (op.props.fills) ellipse.fills = op.props.fills;
        parent.appendChild(ellipse);
        if (op.props.layoutSizingHorizontal && parent !== figma.currentPage) {
          ellipse.layoutSizingHorizontal = op.props.layoutSizingHorizontal;
        }
        if (op.props.layoutSizingVertical && parent !== figma.currentPage) {
          ellipse.layoutSizingVertical = op.props.layoutSizingVertical;
        }
        if (op.ref) createdNodes.set(op.ref, ellipse);
        summaryLines.push(`Criado @"${ellipse.name}"`);

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
        if (op.props.fills) text.fills = op.props.fills;
        if (op.props.textAlignHorizontal) text.textAlignHorizontal = op.props.textAlignHorizontal;
        if (op.props.textAlignVertical) text.textAlignVertical = op.props.textAlignVertical;
        if (op.props.textAutoResize) text.textAutoResize = op.props.textAutoResize;
        if (op.props.lineHeight) text.lineHeight = op.props.lineHeight;
        if (op.props.letterSpacing) text.letterSpacing = op.props.letterSpacing;

        parent.appendChild(text);
        if (op.props.layoutSizingHorizontal && parent !== figma.currentPage) {
          text.layoutSizingHorizontal = op.props.layoutSizingHorizontal;
        }
        if (op.props.layoutSizingVertical && parent !== figma.currentPage) {
          text.layoutSizingVertical = op.props.layoutSizingVertical;
        }
        if (op.ref) createdNodes.set(op.ref, text);
        summaryLines.push(`Criado @"${text.name}"`);

        // ═══ CREATE_COMPONENT_INSTANCE ═══
      } else if (op.type === 'CREATE_COMPONENT_INSTANCE') {
        const parent = await getParent(op.parentRef, op.parentNodeId);
        let component: ComponentNode | null = null;

        // Try to find locally first
        try {
          await figma.loadAllPagesAsync();
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
        summaryLines.push(`Criado @"${instance.name}"`);

        // ═══ SET_FILL ═══
      } else if (op.type === 'SET_FILL') {
        const node = await figma.getNodeByIdAsync(op.nodeId) as GeometryMixin | null;
        if (node && 'fills' in node) {
          node.fills = op.fills;
          summaryLines.push(`Editado fill @"${(node as any).name}"`);
        }

        // ═══ SET_STROKE ═══
      } else if (op.type === 'SET_STROKE') {
        const node = await figma.getNodeByIdAsync(op.nodeId) as GeometryMixin | null;
        if (node && 'strokes' in node) {
          node.strokes = op.strokes;
          if (op.strokeWeight != null) node.strokeWeight = op.strokeWeight;
          if (op.strokeAlign && 'strokeAlign' in node) {
            (node as any).strokeAlign = op.strokeAlign;
          }
          summaryLines.push(`Editado stroke @"${(node as any).name}"`);
        }

        // ═══ SET_CORNER_RADIUS ═══
      } else if (op.type === 'SET_CORNER_RADIUS') {
        const node = await figma.getNodeByIdAsync(op.nodeId) as any;
        if (node && 'cornerRadius' in node) {
          node.cornerRadius = op.cornerRadius;
          if (op.cornerSmoothing != null && 'cornerSmoothing' in node) {
            node.cornerSmoothing = op.cornerSmoothing;
          }
          summaryLines.push(`Editado radius @"${node.name}"`);
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
          summaryLines.push(`Editado effects @"${(node as any).name}"`);
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
          if (op.paddingTop != null) node.paddingTop = op.paddingTop;
          if (op.paddingRight != null) node.paddingRight = op.paddingRight;
          if (op.paddingBottom != null) node.paddingBottom = op.paddingBottom;
          if (op.paddingLeft != null) node.paddingLeft = op.paddingLeft;
          summaryLines.push(`Editado layout @"${node.name}"`);
        }

        // ═══ RESIZE ═══
      } else if (op.type === 'RESIZE') {
        const node = await figma.getNodeByIdAsync(op.nodeId) as SceneNode | null;
        if (node && 'resize' in node) {
          (node as any).resize(op.width, op.height);
          summaryLines.push(`Redimensionado @"${node.name}"`);
        }

        // ═══ MOVE ═══
      } else if (op.type === 'MOVE') {
        const node = await figma.getNodeByIdAsync(op.nodeId) as SceneNode | null;
        if (node) {
          node.x = op.x;
          node.y = op.y;
          summaryLines.push(`Movido @"${node.name}"`);
        }

        // ═══ RENAME ═══
      } else if (op.type === 'RENAME') {
        const node = await figma.getNodeByIdAsync(op.nodeId);
        if (node) {
          const oldName = node.name;
          node.name = op.name;
          summaryLines.push(`Renomeado @"${oldName}" → @"${op.name}"`);
        }

        // ═══ SET_TEXT_CONTENT ═══
      } else if (op.type === 'SET_TEXT_CONTENT') {
        const node = await figma.getNodeByIdAsync(op.nodeId) as TextNode | null;
        if (node && node.type === 'TEXT') {
          // Load ALL fonts currently used in the text node before modifying
          const len = node.characters.length;
          const fontsUsed: FontName[] = [];
          if (len > 0) {
            const seen = new Set<string>();
            for (let i = 0; i < len; i++) {
              const fn = node.getRangeFontName(i, i + 1) as FontName;
              const key = `${fn.family}::${fn.style}`;
              if (!seen.has(key)) {
                seen.add(key);
                fontsUsed.push(fn);
                try { await figma.loadFontAsync(fn); } catch (_e) { /* skip */ }
              }
            }
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
          node.characters = op.content;
          if (op.fontSize) node.fontSize = op.fontSize;
          if (op.fills) node.fills = op.fills;
          summaryLines.push(`Editado texto @"${node.name}"`);
        }

        // ═══ SET_OPACITY ═══
      } else if (op.type === 'SET_OPACITY') {
        const node = await figma.getNodeByIdAsync(op.nodeId) as SceneNode | null;
        if (node && 'opacity' in node) {
          node.opacity = op.opacity;
          summaryLines.push(`Editado opacidade @"${node.name}"`);
        }

        // ═══ APPLY_VARIABLE ═══
      } else if (op.type === 'APPLY_VARIABLE') {
        const node = await figma.getNodeByIdAsync(op.nodeId) as SceneNode | null;
        if (node && figma.variables) {
          const variable = await figma.variables.getVariableByIdAsync(op.variableId);
          if (variable) {
            if (op.field === 'fills' || op.field === 'strokes') {
              // For fills/strokes: use setBoundVariableForPaint
              const paintArray = (node as any)[op.field];
              if (paintArray && paintArray.length > 0) {
                const paintsCopy = JSON.parse(JSON.stringify(paintArray));
                paintsCopy[0] = figma.variables.setBoundVariableForPaint(
                  paintsCopy[0], 'color', variable
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
          summaryLines.push(`Agrupado @"${op.name}"`);
        }

        // ═══ UNGROUP ═══
      } else if (op.type === 'UNGROUP') {
        const node = await figma.getNodeByIdAsync(op.nodeId) as SceneNode | null;
        if (node && 'children' in node) {
          const name = node.name;
          figma.ungroup(node as SceneNode & ChildrenMixin);
          summaryLines.push(`Desagrupado @"${name}"`);
        }

        // ═══ DETACH_INSTANCE ═══
      } else if (op.type === 'DETACH_INSTANCE') {
        const node = await figma.getNodeByIdAsync(op.nodeId) as InstanceNode | null;
        if (node && node.type === 'INSTANCE') {
          node.detachInstance();
          summaryLines.push(`Detached @"${node.name}"`);
        }

        // ═══ DELETE_NODE ═══
      } else if (op.type === 'DELETE_NODE') {
        const node = await figma.getNodeByIdAsync(op.nodeId);
        if (node) {
          summaryLines.push(`Removido @"${node.name}"`);
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

  const summary = summaryLines.length > 0 ? summaryLines.join('\n') : undefined;
  postToUI({ type: 'OPERATIONS_DONE', count: ops.length, summary });
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
    await figma.loadAllPagesAsync();
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
              const val = imported.valuesByMode[Object.keys(imported.valuesByMode)[0]];
              if (typeof val === 'object' && 'r' in val) {
                const hex = rgbToHex((val as any).r, (val as any).g, (val as any).b);
                if (!seen.has(hex)) {
                  colors.push({ id: imported.id, name: `${col.name}/${libVar.name}`, value: hex });
                  seen.add(hex);
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
  if (msg.type === 'USE_SELECTION_AS_LOGO') {
    const comp = await getComponentFromSelection();
    postToUI({ type: 'SELECTION_AS_LOGO', component: comp });
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
    const [components, colors, fonts, selection] = await Promise.all([
      getComponentsInCurrentFile(),
      getColorVariablesFromFile(),
      getFontVariablesFromFile(),
      serializeSelection()
    ]);

    // Collect all context with user selections
    const availableLayers = getAvailableLayers();
    const context = {
      command: msg.command,
      selectedElements: selection.nodes,
      availableComponents: components,
      availableColorVariables: colors,
      availableFontVariables: fonts,
      availableLayers,
      selectedLogo: msg.logoComponent,
      selectedBrandFont: msg.brandFont,
      selectedBrandColors: msg.brandColors
    };

    // Send context to UI to make the API call
    postToUI({ type: 'CALL_API', context });
  } else if (msg.type === 'DELETE_SELECTION') {
    deleteSelection();
  } else if (msg.type === 'OPEN_EXTERNAL') {
    figma.openExternal(msg.url);
  } else if (msg.type === 'SAVE_API_KEY') {
    try {
      await figma.clientStorage.setAsync('userApiKey', msg.key);
      postToUI({ type: 'API_KEY_SAVED' });
    } catch (_e) {
      // clientStorage requires a plugin ID — skip silently in dev
      postToUI({ type: 'API_KEY_SAVED' });
    }
  } else if (msg.type === 'GET_API_KEY') {
    try {
      const key = await figma.clientStorage.getAsync('userApiKey');
      postToUI({ type: 'API_KEY_LOADED', key: key || '' });
    } catch (_e) {
      // clientStorage requires a plugin ID — skip silently in dev
      postToUI({ type: 'API_KEY_LOADED', key: '' });
    }
  }
};
