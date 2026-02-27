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

export type ComponentInfo = {
  id: string;
  name: string;
  key?: string;
  folderPath: string[];
  thumbnail?: string;
};

export type ColorVariable = {
  id: string;
  name: string;
  value?: string;
};

export type FontVariable = {
  id: string;
  name: string;
};

// UI → Sandbox messages
export type UIMessage =
  | { type: 'GET_CONTEXT' }
  | { type: 'USE_SELECTION_AS_LOGO' }
  | { type: 'APPLY_OPERATIONS'; payload: FigmaOperation[] }
  | { type: 'APPLY_OPERATIONS_FROM_API'; operations: FigmaOperation[] }
  | {
    type: 'GENERATE_WITH_CONTEXT';
    command: string;
    logoComponent?: { id: string; name: string };
    brandFont?: { id: string; name: string };
    brandColors?: Array<{ name: string; value: string }>;
  }
  | { type: 'DELETE_SELECTION' }
  | { type: 'OPEN_EXTERNAL'; url: string }
  | { type: 'SAVE_API_KEY'; key: string }
  | { type: 'GET_API_KEY' };

// Sandbox → UI messages
export type PluginMessage =
  | { type: 'CONTEXT'; payload: SerializedContext }
  | { type: 'OPERATIONS_DONE' }
  | { type: 'ERROR'; message: string }
  | {
    type: 'CONTEXT_UPDATED';
    selectedElements: number;
    componentsCount: number;
    colorVariables: number;
    fontVariables: number;
  }
  | { type: 'COMPONENT_THUMBNAIL'; componentId: string; thumbnail: string }
  | { type: 'COMPONENTS_LOADED'; components: ComponentInfo[] }
  | { type: 'FONT_VARIABLES_LOADED'; fonts: FontVariable[] }
  | { type: 'COLOR_VARIABLES_LOADED'; colors: ColorVariable[] }
  | { type: 'SELECTION_AS_LOGO'; component: ComponentInfo | null }
  | { type: 'CALL_API'; context: any }
  | { type: 'API_KEY_SAVED' }
  | { type: 'API_KEY_LOADED'; key: string };
