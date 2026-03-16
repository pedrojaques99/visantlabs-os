// Shared types for Figma plugin — protocol contract between sandbox, UI, and backend

// ── Auxiliary types ──

export type SolidPaint = {
  type: 'SOLID';
  color: { r: number; g: number; b: number };
  opacity?: number;
};

export type GradientStop = {
  position: number; // 0-1
  color: { r: number; g: number; b: number };
};

export type GradientPaint = {
  type: 'GRADIENT_LINEAR' | 'GRADIENT_RADIAL' | 'GRADIENT_ANGULAR' | 'GRADIENT_DIAMOND';
  gradientStops: GradientStop[];
  gradientTransform: [[number, number, number], [number, number, number]];
  opacity?: number;
};

export type ImagePaint = {
  type: 'IMAGE';
  imageUrl?: string; // URL for createImageAsync
  imageHash?: string; // hash directly if already exists
  scaleMode?: 'FILL' | 'FIT' | 'CROP' | 'TILE';
  opacity?: number;
};

export type FigmaPaint = SolidPaint | GradientPaint | ImagePaint;

export type FigmaEffect = {
  type: 'DROP_SHADOW' | 'INNER_SHADOW' | 'LAYER_BLUR' | 'BACKGROUND_BLUR';
  color?: { r: number; g: number; b: number; a: number };
  offset?: { x: number; y: number };
  radius: number;
  spread?: number;
  visible?: boolean;
};

export type RGBA = { r: number; g: number; b: number; a: number };

// ── Figma Operations (38 types) ──

export type FigmaOperation =
  // ═══ CREATION ═══
  | {
    type: 'CREATE_FRAME';
    ref?: string;
    parentRef?: string;
    parentNodeId?: string;
    props: {
      name: string;
      width: number;
      height: number;
      x?: number;
      y?: number;
      rotation?: number;
      opacity?: number;
      fills?: FigmaPaint[];
      strokes?: FigmaPaint[];
      strokeWeight?: number;
      cornerRadius?: number;
      cornerSmoothing?: number;
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
      counterAxisSpacing?: number;
      paddingTop?: number;
      paddingRight?: number;
      paddingBottom?: number;
      paddingLeft?: number;
      strokesIncludedInLayout?: boolean;
      minWidth?: number;
      maxWidth?: number;
      minHeight?: number;
      maxHeight?: number;
    };
  }
  | {
    type: 'CREATE_RECTANGLE';
    ref?: string;
    parentRef?: string;
    parentNodeId?: string;
    props: {
      name: string;
      width: number;
      height: number;
      x?: number;
      y?: number;
      rotation?: number;
      fills?: FigmaPaint[];
      cornerRadius?: number;
      strokes?: FigmaPaint[];
      strokeWeight?: number;
      opacity?: number;
      effects?: FigmaEffect[];
      constraints?: { horizontal: string; vertical: string };
      layoutSizingHorizontal?: 'FIXED' | 'FILL';
      layoutSizingVertical?: 'FIXED' | 'FILL';
    };
  }
  | {
    type: 'CREATE_ELLIPSE';
    ref?: string;
    parentRef?: string;
    parentNodeId?: string;
    props: {
      name: string;
      width: number;
      height: number;
      x?: number;
      y?: number;
      rotation?: number;
      fills?: FigmaPaint[];
      strokes?: FigmaPaint[];
      strokeWeight?: number;
      opacity?: number;
      effects?: FigmaEffect[];
      constraints?: { horizontal: string; vertical: string };
      layoutSizingHorizontal?: 'FIXED' | 'FILL';
      layoutSizingVertical?: 'FIXED' | 'FILL';
    };
  }
  | {
    type: 'CREATE_TEXT';
    ref?: string;
    parentRef?: string;
    parentNodeId?: string;
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
      textDecoration?: 'NONE' | 'UNDERLINE' | 'STRIKETHROUGH';
      textCase?: 'ORIGINAL' | 'UPPER' | 'LOWER' | 'TITLE';
      paragraphSpacing?: number;
      fills?: FigmaPaint[];
      textStyleId?: string;
      x?: number;
      y?: number;
      rotation?: number;
      opacity?: number;
      layoutSizingHorizontal?: 'FIXED' | 'HUG' | 'FILL';
      layoutSizingVertical?: 'FIXED' | 'HUG' | 'FILL';
    };
  }
  | {
    type: 'CREATE_COMPONENT_INSTANCE';
    ref?: string;
    parentRef?: string;
    parentNodeId?: string;
    componentKey: string;
    name?: string;
  }
  // ═══ FASE 2: Advanced Creation ═══
  | {
    type: 'CREATE_COMPONENT';
    ref?: string;
    parentRef?: string;
    parentNodeId?: string;
    props: {
      name: string;
      width: number;
      height: number;
      description?: string;
      fills?: FigmaPaint[];
      cornerRadius?: number;
      layoutMode?: 'NONE' | 'HORIZONTAL' | 'VERTICAL';
      primaryAxisSizingMode?: 'FIXED' | 'AUTO';
      counterAxisSizingMode?: 'FIXED' | 'AUTO';
      primaryAxisAlignItems?: 'MIN' | 'MAX' | 'CENTER' | 'SPACE_BETWEEN';
      counterAxisAlignItems?: 'MIN' | 'MAX' | 'CENTER' | 'BASELINE';
      itemSpacing?: number;
      paddingTop?: number;
      paddingRight?: number;
      paddingBottom?: number;
      paddingLeft?: number;
      layoutSizingHorizontal?: 'FIXED' | 'HUG' | 'FILL';
      layoutSizingVertical?: 'FIXED' | 'HUG' | 'FILL';
    };
  }
  | {
    type: 'COMBINE_AS_VARIANTS';
    ref?: string;
    componentRefs: string[];
    name: string;
  }
  | {
    type: 'CREATE_SVG';
    ref?: string;
    parentRef?: string;
    parentNodeId?: string;
    svgString: string;
    name?: string;
    width?: number;
    height?: number;
  }
  | {
    type: 'CREATE_LINE';
    ref?: string;
    parentRef?: string;
    parentNodeId?: string;
    props: { name: string; width: number; strokes?: FigmaPaint[]; strokeWeight?: number };
  }
  | {
    type: 'CREATE_POLYGON';
    ref?: string;
    parentRef?: string;
    parentNodeId?: string;
    props: { name: string; width: number; height: number; pointCount: number; fills?: FigmaPaint[] };
  }
  | {
    type: 'CREATE_STAR';
    ref?: string;
    parentRef?: string;
    parentNodeId?: string;
    props: { name: string; width: number; height: number; pointCount: number; fills?: FigmaPaint[]; innerRadius?: number };
  }
  | {
    type: 'SET_TEXT_RANGES';
    nodeId: string;
    ranges: Array<{
      start: number;
      end: number;
      fontFamily?: string;
      fontStyle?: string;
      fontSize?: number;
      fills?: FigmaPaint[];
      textDecoration?: 'NONE' | 'UNDERLINE' | 'STRIKETHROUGH';
      textCase?: 'ORIGINAL' | 'UPPER' | 'LOWER' | 'TITLE';
      letterSpacing?: { value: number; unit: 'PIXELS' | 'PERCENT' };
      lineHeight?: { value: number; unit: 'PIXELS' | 'PERCENT' | 'AUTO' };
    }>;
  }
  // ═══ EDIT EXISTING NODES ═══
  | {
    type: 'SET_FILL';
    nodeId: string;
    fills: FigmaPaint[];
  }
  | {
    type: 'SET_STROKE';
    nodeId: string;
    strokes: FigmaPaint[];
    strokeWeight?: number;
    strokeAlign?: 'CENTER' | 'INSIDE' | 'OUTSIDE';
  }
  | {
    type: 'SET_IMAGE_FILL';
    nodeId?: string;
    ref?: string;
    imageUrl: string;
    scaleMode?: 'FILL' | 'FIT' | 'CROP' | 'TILE';
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
    counterAxisSpacing?: number;
    paddingTop?: number;
    paddingRight?: number;
    paddingBottom?: number;
    paddingLeft?: number;
    strokesIncludedInLayout?: boolean;
    layoutSizingHorizontal?: 'FIXED' | 'HUG' | 'FILL';
    layoutSizingVertical?: 'FIXED' | 'HUG' | 'FILL';
  }
  | {
    type: 'RESIZE';
    nodeId: string;
    width: number;
    height: number;
  }
  | {
    type: 'MOVE';
    nodeId?: string;
    ref?: string;
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
    fills?: FigmaPaint[];
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
  | { type: 'DELETE_NODE'; nodeId: string }
  // ═══ FASE 4: Polish & Advanced Features ═══
  | {
    type: 'CLONE_NODE';
    ref?: string;
    sourceNodeId: string;
    parentRef?: string;
    parentNodeId?: string;
    overrides?: {
      name?: string;
      fills?: FigmaPaint[];
      width?: number;
      height?: number;
    };
  }
  | {
    type: 'DUPLICATE_NODE';
    ref?: string;
    sourceNodeId: string;
    parentRef?: string;
    parentNodeId?: string;
    overrides?: {
      name?: string;
      fills?: FigmaPaint[];
      width?: number;
      height?: number;
    };
  }
  | {
    type: 'REORDER_CHILD';
    nodeId: string;
    parentNodeId: string;
    index: number;
  }
  | {
    type: 'SET_CONSTRAINTS';
    nodeId: string;
    horizontal: 'MIN' | 'CENTER' | 'MAX' | 'STRETCH' | 'SCALE';
    vertical: 'MIN' | 'CENTER' | 'MAX' | 'STRETCH' | 'SCALE';
  }
  | {
    type: 'SET_LAYOUT_GRID';
    nodeId: string;
    grids: Array<{
      pattern: 'COLUMNS' | 'ROWS' | 'GRID';
      alignment?: 'MIN' | 'MAX' | 'STRETCH' | 'CENTER';
      count?: number;
      gutterSize?: number;
      sectionSize?: number;
      offset?: number;
      color?: { r: number; g: number; b: number; a: number };
      visible?: boolean;
    }>;
  }
  | {
    type: 'CREATE_VARIABLE';
    ref?: string;
    collectionName: string;
    name: string;
    resolvedType: 'COLOR' | 'FLOAT' | 'STRING' | 'BOOLEAN';
    value: any;
  }
  | {
    type: 'SET_BLEND_MODE';
    nodeId: string;
    blendMode:
    | 'NORMAL'
    | 'MULTIPLY'
    | 'SCREEN'
    | 'OVERLAY'
    | 'DARKEN'
    | 'LIGHTEN'
    | 'COLOR_DODGE'
    | 'COLOR_BURN'
    | 'HARD_LIGHT'
    | 'SOFT_LIGHT'
    | 'DIFFERENCE'
    | 'EXCLUSION'
    | 'HUE'
    | 'SATURATION'
    | 'COLOR'
    | 'LUMINOSITY';
  }
  | {
    type: 'SET_INDIVIDUAL_CORNERS';
    nodeId: string;
    topLeftRadius?: number;
    topRightRadius?: number;
    bottomLeftRadius?: number;
    bottomRightRadius?: number;
    cornerSmoothing?: number;
  }
  | {
    type: 'BOOLEAN_OPERATION';
    ref?: string;
    operation: 'UNION' | 'SUBTRACT' | 'INTERSECT' | 'EXCLUDE';
    nodeIds?: string[];
    nodeRefs?: string[];
    name?: string;
  };

// ── Serialized context ──

export type SerializedNode = {
  id: string;
  type: string;
  name: string;
  width: number;
  height: number;
  x?: number;
  y?: number;
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
  strokes?: Array<{ type: string; color?: { r: number; g: number; b: number }; opacity?: number }>;
  strokeWeight?: number;
  cornerRadius?: number;
  effects?: Array<{ type: string; radius?: number; color?: { r: number; g: number; b: number; a: number }; offset?: { x: number; y: number } }>;
  opacity?: number;
  constraints?: { horizontal: string; vertical: string };
  // Layout sizing (for children of auto-layout)
  layoutSizingHorizontal?: string;
  layoutSizingVertical?: string;
  // Text
  characters?: string;
  fontSize?: number;
  // Component
  componentKey?: string;
  componentName?: string;
  // Children (recursive, up to depth 5)
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

export type AvailableLayer = {
  id: string;
  name: string;
  type: string;
};

// ── Brand Guideline preset (V2) ──
export interface BrandGuidelineColor {
  hex: string
  name: string
  role?: string
}

export interface BrandGuidelineTypography {
  family: string
  style?: string
  role: string
  size?: number
  lineHeight?: number
}
export interface BrandArchetype {
  name: string
  role?: 'primary' | 'secondary'
  description: string
  image?: string
  examples?: string[]
}

export interface BrandPersona {
  name: string
  age?: number
  occupation?: string
  traits?: string[]
  bio?: string
  desires?: string[]
  painPoints?: string[]
  image?: string
}

export interface BrandToneOfVoiceValue {
  title: string
  description: string
  example: string
}

export interface BrandGuideline {
  id?: string
  userId?: string
  name?: string
  tagline?: string
  description?: string
  identity?: {
    name?: string
    website?: string
    instagram?: string
    linkedin?: string
    portfolio?: string
    x?: string
    tagline?: string
    description?: string
  }
  logos?: Array<{
    id: string
    url: string
    variant: 'primary' | 'dark' | 'light' | 'icon' | 'custom'
    label?: string
  }>
  colors?: BrandGuidelineColor[]
  typography?: BrandGuidelineTypography[]
  tags?: Record<string, string[]>
  media?: Array<{
    id: string
    url: string
    type: 'image' | 'pdf'
    label?: string
  }>
  tokens?: {
    spacing?: Record<string, number>
    radius?: Record<string, number>
    shadows?: Record<string, { x: number; y: number; blur: number; spread: number; color: string; opacity: number }>
    components?: Record<string, any>
  }
  guidelines?: {
    voice?: string
    dos?: string[]
    donts?: string[]
    imagery?: string
    accessibility?: string
  }
  strategy?: {
    manifesto?: string
    positioning?: string[]
    archetypes?: BrandArchetype[]
    personas?: BrandPersona[]
    voiceValues?: BrandToneOfVoiceValue[]
  }
  _extraction?: {
    sources: Array<{ type: 'url' | 'pdf' | 'image' | 'json' | 'manual'; ref?: string; date: string }>
    completeness: number
  }
  extraction?: { // Keep this for backend compatibility if it uses "extraction"
    sources: Array<{ type: 'url' | 'pdf' | 'image' | 'json' | 'manual'; ref?: string; date: string }>
    completeness: number
  }
  updatedAt?: string
  orderedBlocks?: string[]
  activeSections?: string[]
  // Public sharing
  publicSlug?: string
  isPublic?: boolean
}

// ── UI → Sandbox messages ──

export type UIMessage =
  | { type: 'GET_CONTEXT' }
  | { type: 'USE_SELECTION_AS_LOGO' }
  | { type: 'APPLY_OPERATIONS'; payload: FigmaOperation[] }
  | { type: 'APPLY_OPERATIONS_FROM_API'; operations: FigmaOperation[] }
  | {
    type: 'GENERATE_WITH_CONTEXT';
    command: string;
    scanPage?: boolean;
    logoComponent?: { id: string; name: string; key?: string };
    brandFont?: { id: string; name: string };
    brandColors?: Array<{ name: string; value: string }>;
  }
  | { type: 'DELETE_SELECTION' }
  | { type: 'OPEN_EXTERNAL'; url: string }
  | { type: 'SAVE_API_KEY'; key: string }
  | { type: 'GET_API_KEY' }
  | { type: 'SAVE_ANTHROPIC_KEY'; key: string }
  | { type: 'GET_ANTHROPIC_KEY' }
  // Guideline presets
  | { type: 'GET_GUIDELINES' }
  | { type: 'SAVE_GUIDELINE'; guideline: BrandGuideline }
  | { type: 'DELETE_GUIDELINE'; id: string }
  | { type: 'SELECT_AND_ZOOM'; nodeId: string }
  // Image generation
  | { type: 'PASTE_GENERATED_IMAGE'; imageData: string; prompt: string; width?: number; height?: number; isUrl?: boolean }
  // Mentions
  | { type: 'GET_ELEMENTS_FOR_MENTIONS' }
  // Agent / WebSocket messages
  | { type: 'AGENT_OPS'; operations: FigmaOperation[]; opId: string }
  | { type: 'INIT_WS' }
  | { type: 'REPORT_SELECTION' }
  // Auth
  | { type: 'SAVE_AUTH_TOKEN'; token: string }
  | { type: 'GET_AUTH_TOKEN' }
  // Design System
  | { type: 'GET_DESIGN_SYSTEM' }
  | { type: 'SAVE_DESIGN_SYSTEM'; designSystem: any }
  // Brand Guidelines V2
  | { type: 'GET_BRAND_GUIDELINE' }
  | { type: 'SAVE_BRAND_GUIDELINE'; selectedId: string | null; guideline: string | null }
  // Undo
  | { type: 'UNDO_LAST_BATCH' };

// ── Sandbox → UI messages ──

export type PluginMessage =
  | { type: 'CONTEXT'; payload: SerializedContext }
  | { type: 'OPERATIONS_DONE'; count?: number; summary?: string }
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
  | { type: 'API_KEY_LOADED'; key: string }
  | { type: 'ANTHROPIC_KEY_SAVED' }
  | { type: 'ANTHROPIC_KEY_LOADED'; key: string }
  // Guideline presets
  | { type: 'GUIDELINES_LOADED'; guidelines: BrandGuideline[] }
  | { type: 'GUIDELINE_SAVED'; guidelines: BrandGuideline[]; savedId: string }
  // Brand Guidelines V2
  | { type: 'BRAND_GUIDELINE_LOADED'; selectedId: string | null; guideline: string | null }
  | { type: 'BRAND_GUIDELINE_SAVED' };
