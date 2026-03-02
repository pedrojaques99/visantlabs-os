// Shared types for Figma plugin — protocol contract between sandbox, UI, and backend

// ── Auxiliary types ──

export type SolidPaint = {
  type: 'SOLID';
  color: { r: number; g: number; b: number };
  opacity?: number;
};

export type FigmaEffect = {
  type: 'DROP_SHADOW' | 'INNER_SHADOW' | 'LAYER_BLUR' | 'BACKGROUND_BLUR';
  color?: { r: number; g: number; b: number; a: number };
  offset?: { x: number; y: number };
  radius: number;
  spread?: number;
  visible?: boolean;
};

export type RGBA = { r: number; g: number; b: number; a: number };

// ── Figma Operations (21 types) ──

export type FigmaOperation =
  // ═══ CREATION ═══
  | {
    type: 'CREATE_FRAME';
    ref?: string;
    parentRef?: string;
    props: {
      name: string;
      width: number;
      height: number;
      fills?: SolidPaint[];
      cornerRadius?: number;
      clipsContent?: boolean;
      layoutMode?: 'NONE' | 'HORIZONTAL' | 'VERTICAL';
      primaryAxisSizingMode?: 'FIXED' | 'AUTO';
      counterAxisSizingMode?: 'FIXED' | 'AUTO';
      layoutSizingHorizontal?: 'FIXED' | 'HUG' | 'FILL';
      layoutSizingVertical?: 'FIXED' | 'HUG' | 'FILL';
      primaryAxisAlignItems?: 'MIN' | 'MAX' | 'CENTER' | 'SPACE_BETWEEN';
      counterAxisAlignItems?: 'MIN' | 'MAX' | 'CENTER' | 'BASELINE';
      layoutWrap?: 'NO_WRAP' | 'WRAP';
      itemSpacing?: number;
      paddingTop?: number;
      paddingRight?: number;
      paddingBottom?: number;
      paddingLeft?: number;
    };
  }
  | {
    type: 'CREATE_RECTANGLE';
    ref?: string;
    parentRef?: string;
    props: {
      name: string;
      width: number;
      height: number;
      fills?: SolidPaint[];
      cornerRadius?: number;
      strokes?: SolidPaint[];
      strokeWeight?: number;
      opacity?: number;
      layoutSizingHorizontal?: 'FIXED' | 'FILL';
      layoutSizingVertical?: 'FIXED' | 'FILL';
    };
  }
  | {
    type: 'CREATE_ELLIPSE';
    ref?: string;
    parentRef?: string;
    props: {
      name: string;
      width: number;
      height: number;
      fills?: SolidPaint[];
    };
  }
  | {
    type: 'CREATE_TEXT';
    ref?: string;
    parentRef?: string;
    props: {
      name?: string;
      content: string;
      fontFamily?: string;
      fontStyle?: string;
      fontSize?: number;
      lineHeight?: { value: number; unit: 'PIXELS' | 'PERCENT' | 'AUTO' };
      letterSpacing?: { value: number; unit: 'PIXELS' | 'PERCENT' };
      textAlignHorizontal?: 'LEFT' | 'CENTER' | 'RIGHT' | 'JUSTIFIED';
      textAlignVertical?: 'TOP' | 'CENTER' | 'BOTTOM';
      textAutoResize?: 'NONE' | 'WIDTH_AND_HEIGHT' | 'HEIGHT' | 'TRUNCATE';
      fills?: SolidPaint[];
      textStyleId?: string;
      layoutSizingHorizontal?: 'FIXED' | 'HUG' | 'FILL';
      layoutSizingVertical?: 'FIXED' | 'HUG' | 'FILL';
    };
  }
  | {
    type: 'CREATE_COMPONENT_INSTANCE';
    ref?: string;
    parentRef?: string;
    componentKey: string;
    name?: string;
  }
  // ═══ EDIT EXISTING NODES ═══
  | {
    type: 'SET_FILL';
    nodeId: string;
    fills: SolidPaint[];
  }
  | {
    type: 'SET_STROKE';
    nodeId: string;
    strokes: SolidPaint[];
    strokeWeight?: number;
    strokeAlign?: 'CENTER' | 'INSIDE' | 'OUTSIDE';
  }
  | {
    type: 'SET_CORNER_RADIUS';
    nodeId: string;
    cornerRadius: number;
    cornerSmoothing?: number;
  }
  | {
    type: 'SET_EFFECTS';
    nodeId: string;
    effects: FigmaEffect[];
  }
  | {
    type: 'SET_AUTO_LAYOUT';
    nodeId: string;
    layoutMode: 'HORIZONTAL' | 'VERTICAL';
    primaryAxisSizingMode?: 'FIXED' | 'AUTO';
    counterAxisSizingMode?: 'FIXED' | 'AUTO';
    primaryAxisAlignItems?: 'MIN' | 'MAX' | 'CENTER' | 'SPACE_BETWEEN';
    counterAxisAlignItems?: 'MIN' | 'MAX' | 'CENTER' | 'BASELINE';
    layoutWrap?: 'NO_WRAP' | 'WRAP';
    itemSpacing?: number;
    paddingTop?: number;
    paddingRight?: number;
    paddingBottom?: number;
    paddingLeft?: number;
  }
  | {
    type: 'RESIZE';
    nodeId: string;
    width: number;
    height: number;
  }
  | {
    type: 'MOVE';
    nodeId: string;
    x: number;
    y: number;
  }
  | {
    type: 'RENAME';
    nodeId: string;
    name: string;
  }
  | {
    type: 'SET_TEXT_CONTENT';
    nodeId: string;
    content: string;
    fontFamily?: string;
    fontStyle?: string;
    fontSize?: number;
    fills?: SolidPaint[];
  }
  | {
    type: 'SET_OPACITY';
    nodeId: string;
    opacity: number;
  }
  // ═══ TOKENS / VARIABLES ═══
  | {
    type: 'APPLY_VARIABLE';
    nodeId: string;
    variableId: string;
    field: string;
  }
  | {
    type: 'APPLY_STYLE';
    nodeId: string;
    styleId: string;
    styleType: 'FILL' | 'TEXT' | 'EFFECT' | 'GRID';
  }
  // ═══ STRUCTURE ═══
  | { type: 'GROUP_NODES'; nodeIds: string[]; name: string }
  | { type: 'UNGROUP'; nodeId: string }
  | { type: 'DETACH_INSTANCE'; nodeId: string }
  | { type: 'DELETE_NODE'; nodeId: string };

// ── Serialized context ──

export type SerializedNode = {
  id: string;
  type: string;
  name: string;
  width: number;
  height: number;
  // Auto-layout
  layoutMode?: string;
  itemSpacing?: number;
  paddingTop?: number;
  paddingRight?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  primaryAxisAlignItems?: string;
  counterAxisAlignItems?: string;
  childCount?: number;
  // Appearance
  fills?: Array<{ type: string; color?: { r: number; g: number; b: number }; opacity?: number }>;
  cornerRadius?: number;
  // Text
  characters?: string;
  fontSize?: number;
  // Component
  componentKey?: string;
  componentName?: string;
  // Children (recursive)
  children?: SerializedNode[];
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

// ── UI → Sandbox messages ──

export type UIMessage =
  | { type: 'GET_CONTEXT' }
  | { type: 'USE_SELECTION_AS_LOGO' }
  | { type: 'APPLY_OPERATIONS'; payload: FigmaOperation[] }
  | { type: 'APPLY_OPERATIONS_FROM_API'; operations: FigmaOperation[] }
  | {
    type: 'GENERATE_WITH_CONTEXT';
    command: string;
    logoComponent?: { id: string; name: string; key?: string };
    brandFont?: { id: string; name: string };
    brandColors?: Array<{ name: string; value: string }>;
  }
  | { type: 'DELETE_SELECTION' }
  | { type: 'OPEN_EXTERNAL'; url: string }
  | { type: 'SAVE_API_KEY'; key: string }
  | { type: 'GET_API_KEY' };

// ── Sandbox → UI messages ──

export type PluginMessage =
  | { type: 'CONTEXT'; payload: SerializedContext }
  | { type: 'OPERATIONS_DONE'; count?: number }
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
  | { type: 'CALL_API'; context: Record<string, unknown> }
  | { type: 'API_KEY_SAVED' }
  | { type: 'API_KEY_LOADED'; key: string };
