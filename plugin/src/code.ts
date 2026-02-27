// Figma plugin sandbox — runs in QuickJS, no browser APIs

type UIMessage =
  | { type: 'GET_CONTEXT' }
  | { type: 'USE_SELECTION_AS_LOGO' }
  | { type: 'APPLY_OPERATIONS'; payload: FigmaOperation[] }
  | { type: 'APPLY_OPERATIONS_FROM_API'; operations: FigmaOperation[] }
  | { type: 'GENERATE_WITH_CONTEXT'; command: string; logoComponent?: { id: string; name: string }; brandFont?: { id: string; name: string }; brandColors?: Array<{ name: string; value: string }> }
  | { type: 'DELETE_SELECTION' }
  | { type: 'OPEN_EXTERNAL'; url: string }
  | { type: 'SAVE_API_KEY'; key: string }
  | { type: 'GET_API_KEY' };

type FigmaOperation =
  | { type: 'CREATE_FRAME'; props: { name: string; width: number; height: number; direction: 'HORIZONTAL' | 'VERTICAL'; gap: number; padding: number } }
  | { type: 'CREATE_TEXT'; props: { content: string; styleId?: string; fontSize?: number; color?: { r: number; g: number; b: number; a: number } } }
  | { type: 'CREATE_COMPONENT'; componentKey: string; x: number; y: number; name: string }
  | { type: 'SET_FILL'; nodeId: string; color: { r: number; g: number; b: number; a: number } }
  | { type: 'APPLY_STYLE'; nodeId: string; styleId: string; styleType: 'FILL' | 'TEXT' | 'EFFECT' | 'GRID' }
  | { type: 'APPLY_VARIABLE'; nodeId: string; variableId: string; property: string }
  | { type: 'GROUP_NODES'; nodeIds: string[]; name: string }
  | { type: 'DELETE_NODE'; nodeId: string };

type SerializedNode = { id: string; type: string; name: string; width: number; height: number };
type SerializedContext = { nodes: SerializedNode[]; styles: Record<string, string> };
type ComponentInfo = { id: string; name: string; key?: string; folderPath: string[]; thumbnail?: string };
type ColorVariable = { id: string; name: string; value?: string };
type FontVariable = { id: string; name: string };

function postToUI(msg: { type: string } & Record<string, unknown>) {
  figma.ui.postMessage(msg);
}

async function serializeSelection(): Promise<SerializedContext> {
  const nodes: SerializedNode[] = [];
  const selection = figma.currentPage.selection;
  const limit = 20;

  for (let i = 0; i < Math.min(selection.length, limit); i++) {
    const node = selection[i];
    if ('width' in node && 'height' in node) {
      nodes.push({
        id: node.id,
        type: node.type,
        name: node.name,
        width: node.width,
        height: node.height,
      });
    }
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

async function applyOperations(ops: FigmaOperation[]) {
  const defaultFont = { family: 'Inter', style: 'Regular' };

  for (const op of ops) {
    try {
      if (op.type === 'CREATE_FRAME') {
        const frame = figma.createFrame();
        frame.name = op.props.name;
        frame.resize(op.props.width, op.props.height);
        frame.layoutMode = op.props.direction;
        frame.primaryAxisSizingMode = 'AUTO';
        frame.counterAxisSizingMode = 'AUTO';
        frame.itemSpacing = op.props.gap;
        frame.paddingLeft = frame.paddingRight = frame.paddingTop = frame.paddingBottom = op.props.padding;
        frame.x = figma.viewport.center.x - op.props.width / 2;
        frame.y = figma.viewport.center.y - op.props.height / 2;
        figma.currentPage.appendChild(frame);
        figma.currentPage.selection = [frame];
      } else if (op.type === 'CREATE_TEXT') {
        await figma.loadFontAsync(defaultFont);
        const text = figma.createText();
        text.characters = op.props.content;
        if (op.props.fontSize) text.fontSize = op.props.fontSize;
        if (op.props.color) {
          text.fills = [{ type: 'SOLID', color: op.props.color }];
        }
        if (op.props.styleId) {
          try {
            text.textStyleId = op.props.styleId;
          } catch (_) { }
        }
        text.x = figma.viewport.center.x - 50;
        text.y = figma.viewport.center.y - 10;
        figma.currentPage.appendChild(text);
        figma.currentPage.selection = [text];
      } else if (op.type === 'SET_FILL') {
        const node = figma.getNodeById(op.nodeId) as GeometryMixin | null;
        if (node && 'fills' in node) {
          node.fills = [{ type: 'SOLID', color: op.color }];
        }
      } else if (op.type === 'DELETE_NODE') {
        const node = figma.getNodeById(op.nodeId);
        if (node) node.remove();
      } else if (op.type === 'GROUP_NODES') {
        const nodes: SceneNode[] = [];
        for (const id of op.nodeIds) {
          const n = figma.getNodeById(id);
          if (n && 'parent' in n) nodes.push(n as SceneNode);
        }
        if (nodes.length > 0) {
          const group = figma.group(nodes, figma.currentPage);
          group.name = op.name;
        }
      } else if (op.type === 'APPLY_STYLE') {
        const node = figma.getNodeById(op.nodeId);
        if (node) {
          if (op.styleType === 'FILL' && 'fillStyleId' in node) {
            node.fillStyleId = op.styleId;
          } else if (op.styleType === 'TEXT' && 'textStyleId' in node) {
            node.textStyleId = op.styleId;
          }
        }
      }
    } catch (err) {
      postToUI({ type: 'ERROR', message: String(err) });
      return;
    }
  }

  postToUI({ type: 'OPERATIONS_DONE' });
}

function deleteSelection() {
  const selection = figma.currentPage.selection;
  for (const node of selection) {
    node.remove();
  }
  postToUI({ type: 'OPERATIONS_DONE' });
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
  const BATCH = 5;
  for (let i = 0; i < components.length; i += BATCH) {
    const batch = components.slice(i, i + BATCH);
    await Promise.all(
      batch.map(async (comp) => {
        const node = figma.getNodeById(comp.id) as ComponentNode | ComponentSetNode | null;
        if (node) {
          const thumb = await exportThumbnail(node);
          if (thumb) postToUI({ type: 'COMPONENT_THUMBNAIL', componentId: comp.id, thumbnail: thumb });
        }
      })
    );
  }
}

async function getColorVariablesFromFile(): Promise<ColorVariable[]> {
  const colors: ColorVariable[] = [];

  try {
    if (!figma.variables || typeof figma.variables.getLocalVariablesAsync !== 'function') {
      console.log('[Plugin] Color variables API not available');
      return colors;
    }

    const allVariables = await figma.variables.getLocalVariablesAsync('COLOR');
    console.log('[Plugin] Total color variables:', allVariables.length);

    for (const variable of allVariables) {
      const value = variable.valuesByMode[Object.keys(variable.valuesByMode)[0]];
      let colorHex = '#ccc';
      if (typeof value === 'object' && 'r' in value) {
        const r = Math.round((value as any).r * 255);
        const g = Math.round((value as any).g * 255);
        const b = Math.round((value as any).b * 255);
        colorHex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
      }
      colors.push({
        id: variable.id,
        name: variable.name,
        value: colorHex
      });
    }
  } catch (e) {
    console.log('[Plugin] Error getting color variables:', e);
  }

  console.log('[Plugin] Total color variables found:', colors.length);
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

async function notifyContextChange() {
  const [components, colors, fonts] = await Promise.all([
    getComponentsInCurrentFile(),
    getColorVariablesFromFile(),
    getFontVariablesFromFile()
  ]);
  const selection = figma.currentPage.selection;

  figma.ui.postMessage({
    type: 'CONTEXT_UPDATED',
    selectedElements: selection.length,
    componentsCount: components.length,
    colorVariables: colors.length,
    fontVariables: fonts.length
  });
}

figma.showUI(__html__, { width: 420, height: 680, themeColors: true, title: 'Visant Copilot' });

// Notify when selection changes
figma.on('selectionchange', notifyContextChange);

function getComponentFromSelection(): ComponentInfo | null {
  const sel = figma.currentPage.selection;
  if (sel.length !== 1) return null;
  const node = sel[0];
  if (node.type === 'COMPONENT' || node.type === 'COMPONENT_SET') {
    return { id: node.id, name: node.name, key: node.key, folderPath: getFolderPath(node) };
  }
  if (node.type === 'INSTANCE' && node.mainComponent) {
    const main = node.mainComponent;
    return { id: main.id, name: main.name, key: main.key, folderPath: main.parent ? getFolderPath(main) : [] };
  }
  return null;
}

figma.ui.onmessage = async (msg: UIMessage) => {
  if (msg.type === 'USE_SELECTION_AS_LOGO') {
    const comp = getComponentFromSelection();
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

    // Send components first, then thumbnails in background
    setTimeout(() => {
      postToUI({ type: 'COMPONENTS_LOADED', components });
      exportComponentThumbnails(components).catch(() => { });
    }, 100);

    setTimeout(() => {
      postToUI({ type: 'FONT_VARIABLES_LOADED', fonts });
    }, 150);

    setTimeout(() => {
      postToUI({ type: 'COLOR_VARIABLES_LOADED', colors });
    }, 200);
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
    const context = {
      command: msg.command,
      selectedElements: selection.nodes,
      availableComponents: components,
      availableColorVariables: colors,
      availableFontVariables: fonts,
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
    await figma.clientStorage.setAsync('userApiKey', msg.key);
    postToUI({ type: 'API_KEY_SAVED' });
  } else if (msg.type === 'GET_API_KEY') {
    const key = await figma.clientStorage.getAsync('userApiKey');
    postToUI({ type: 'API_KEY_LOADED', key: key || '' });
  }
};
