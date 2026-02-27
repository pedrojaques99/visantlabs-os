// Shared types for Figma plugin — protocol contract between sandbox, UI, and backend

export type RGBA = { r: number; g: number; b: number; a: number };

export type FigmaOperation =
  | {
      type: 'CREATE_FRAME';
      props: {
        name: string;
        width: number;
        height: number;
        direction: 'HORIZONTAL' | 'VERTICAL';
        gap: number;
        padding: number;
      };
    }
  | {
      type: 'CREATE_TEXT';
      props: {
        content: string;
        styleId?: string;
        fontSize?: number;
        color?: RGBA;
      };
    }
  | {
      type: 'CREATE_COMPONENT';
      componentKey: string;
      x: number;
      y: number;
      name: string;
    }
  | { type: 'SET_FILL'; nodeId: string; color: RGBA }
  | {
      type: 'APPLY_STYLE';
      nodeId: string;
      styleId: string;
      styleType: 'FILL' | 'TEXT' | 'EFFECT' | 'GRID';
    }
  | {
      type: 'APPLY_VARIABLE';
      nodeId: string;
      variableId: string;
      property: string;
    }
  | { type: 'GROUP_NODES'; nodeIds: string[]; name: string }
  | { type: 'DELETE_NODE'; nodeId: string };

export type SerializedNode = {
  id: string;
  type: string;
  name: string;
  width: number;
  height: number;
};

export type SerializedContext = {
  nodes: SerializedNode[];
  styles: Record<string, string>;
};

// UI → Sandbox messages
export type UIMessage =
  | { type: 'GET_CONTEXT' }
  | { type: 'APPLY_OPERATIONS'; payload: FigmaOperation[] }
  | { type: 'OPEN_EXTERNAL'; url: string };

// Sandbox → UI messages
export type PluginMessage =
  | { type: 'CONTEXT'; payload: SerializedContext }
  | { type: 'OPERATIONS_DONE' }
  | { type: 'ERROR'; message: string };
