// Figma plugin sandbox — runs in QuickJS, no browser APIs

type UIMessage =
  | { type: 'GET_CONTEXT' }
  | { type: 'APPLY_OPERATIONS'; payload: FigmaOperation[] }
  | { type: 'OPEN_EXTERNAL'; url: string };

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

function postToUI(msg: { type: string; payload?: SerializedContext; message?: string }) {
  figma.ui.postMessage(msg);
}

function serializeSelection(): SerializedContext {
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
  const paintStyles = figma.getLocalPaintStyles();
  const textStyles = figma.getLocalTextStyles();
  for (const s of paintStyles) styles[s.id] = `PAINT:${s.name}`;
  for (const s of textStyles) styles[s.id] = `TEXT:${s.name}`;

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
          } catch (_) {}
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

figma.showUI(__html__, { width: 400, height: 640, themeColors: true, title: 'Visant Copilot' });

figma.ui.onmessage = async (msg: UIMessage) => {
  if (msg.type === 'GET_CONTEXT') {
    postToUI({ type: 'CONTEXT', payload: serializeSelection() });
  } else if (msg.type === 'APPLY_OPERATIONS') {
    await applyOperations(msg.payload);
  } else if (msg.type === 'OPEN_EXTERNAL') {
    figma.openExternal(msg.url);
  }
};
