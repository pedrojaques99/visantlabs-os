// Shared types for Figma plugin — protocol contract between sandbox, UI, and backend

// ── Auxiliary types ──

export type SolidPaint = {
  type: 'SOLID';
  color: { r: number; g: number; b: number };
  opacity?: number;
  variableId?: string; // Support for Figma Variables
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

// ── Template Scanning ──

export interface TemplateSpec {
  id: string;
  name: string;
  width: number;
  height: number;
  childCount: number;
}

// ── Figma Operations (39 types) ──

export type FigmaOperation =
  // ═══ PAGE CREATION ═══
  | {
    type: 'CREATE_PAGE';
    ref?: string;
    props: {
      name: string;
    };
  }
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
      autoPosition?: 'right' | 'below' | 'grid';  // Posiciona automaticamente
      positionGap?: number;  // Gap entre frames (default: 100)
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
      lineHeight?: string | { value: number; unit: 'PIXELS' | 'PERCENT' | 'AUTO' };
      letterSpacing?: string | { value: number; unit: 'PIXELS' | 'PERCENT' };
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
    width?: number;
    height?: number;
    x?: number;
    y?: number;
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
      x?: number;
      y?: number;
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
    x?: number;
    y?: number;
    opacity?: number;
  }
  | {
    type: 'CREATE_ICON';
    ref?: string;
    parentRef?: string;
    parentNodeId?: string;
    props: {
      icon: string; // e.g. "mdi:home", "lucide:check"
      size?: number;
      color?: FigmaPaint[];
      x?: number;
      y?: number;
      name?: string;
      opacity?: number;
    };
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
    type: 'SET_TEXT_STYLE';
    nodeId: string;
    fontSize?: number;
    fontFamily?: string;
    fontStyle?: string;
    textAutoResize?: 'NONE' | 'WIDTH_AND_HEIGHT' | 'HEIGHT' | 'TRUNCATE';
    textAlignHorizontal?: 'LEFT' | 'CENTER' | 'RIGHT' | 'JUSTIFIED';
    textAlignVertical?: 'TOP' | 'CENTER' | 'BOTTOM';
    lineHeight?: { value: number; unit: 'PIXELS' | 'PERCENT' | 'AUTO' };
    letterSpacing?: { value: number; unit: 'PIXELS' | 'PERCENT' };
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
  | { type: 'SELECT_AND_ZOOM'; nodeId: string }
  | { type: 'CREATE_STICKY_PROMPT'; prompt: string; name: string }
  | { type: 'UNDO_LAST_BATCH' }
  | { type: 'RECOLOR_NODE'; ref?: string; nodeId?: string; props: { fills: FigmaPaint[] } }
  // ═══ FASE 4: Polish & Advanced Features ═══
  | {
    type: 'CLONE_NODE';
    ref?: string;
    sourceNodeId?: string;        // Clone por ID
    sourceName?: string;          // OU clone por nome (mais robusto)
    sourceScope?: 'page' | 'file'; // Onde buscar (default: 'file')
    parentRef?: string;
    parentNodeId?: string;
    props: {
      name?: string;
      fills?: FigmaPaint[];
      width?: number;
      height?: number;
      layoutSizingHorizontal?: 'FIXED' | 'HUG' | 'FILL';
      layoutSizingVertical?: 'FIXED' | 'HUG' | 'FILL';
      isMask?: boolean;
      opacity?: number;
    };
    textOverrides?: Array<{ name: string; content: string }>;
  }
  | {
    type: 'DUPLICATE_NODE';
    ref?: string;
    sourceNodeId: string;
    parentRef?: string;
    parentNodeId?: string;
    props?: {
      name?: string;
      fills?: FigmaPaint[];
      width?: number;
      height?: number;
      layoutSizingHorizontal?: 'FIXED' | 'HUG' | 'FILL';
      layoutSizingVertical?: 'FIXED' | 'HUG' | 'FILL';
      opacity?: number;
    };
    textOverrides?: Array<{ name: string; content: string }>;
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
    type: 'CREATE_COLOR_VARIABLES_FROM_SELECTION';
    ref?: string;
    collectionName?: string;
  }
  | {
    type: 'BIND_NEAREST_COLOR_VARIABLES';
    ref?: string;
    threshold?: number;
    scope?: 'selection' | 'page';
    collectionName?: string;
  }
  | {
    type: 'REQUEST_SCAN';
    reason?: string;
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
  }
  // ═══ HIGH-FIDELITY MCP ═══
  | { type: 'GET_DESIGN_CONTEXT'; nodeId?: string; depth?: number }
  | { type: 'GET_VARIABLE_DEFS'; nodeId?: string }
  | { type: 'GET_SCREENSHOT'; nodeId?: string }
  | { type: 'SEARCH_DESIGN_SYSTEM'; query: string }
  | { type: 'GET_CODE_CONNECT_MAP' }
  | { type: 'ADD_CODE_CONNECT_MAP'; nodeId: string; componentName: string; filePath: string }
  | { type: 'GET_AGENT_COMPONENTS' }
  // ═══ AGENT LIBRARY SCAFFOLD ═══
  | {
    type: 'SCAFFOLD_AGENT_LIBRARY';
    brand: {
      name: string;
      primary: { r: number; g: number; b: number };
      secondary?: { r: number; g: number; b: number };
      background: { r: number; g: number; b: number };
      text: { r: number; g: number; b: number };
      fontFamily: string;
      fontStyle?: string;
    };
  };

// ── Serialized context ──

export type SerializedFill = {
  type: string;
  color?: { r: number; g: number; b: number };
  opacity?: number;
  imageHash?: string | null;
  scaleMode?: string;
};

export type SerializedStroke = {
  type: string;
  color?: { r: number; g: number; b: number };
  opacity?: number;
};

export type SerializedEffect = {
  type: string;
  radius?: number;
  color?: { r: number; g: number; b: number; a: number };
  offset?: { x: number; y: number };
};

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
  fills?: SerializedFill[];
  strokes?: SerializedStroke[];
  strokeWeight?: number;
  cornerRadius?: number;
  effects?: SerializedEffect[];
  opacity?: number;
  constraints?: { horizontal: string; vertical: string };
  // Layout sizing (for children of auto-layout)
  layoutSizingHorizontal?: string;
  layoutSizingVertical?: string;
  // Text
  characters?: string;
  fontSize?: number;
  fontFamily?: string;
  fontStyle?: string;
  textAlignHorizontal?: string;
  textAlignVertical?: string;
  textAutoResize?: string;
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

// Contexto enriquecido para AI (inclui assets reutilizáveis)
export type EnrichedContext = SerializedContext & {
  templates?: Array<{
    id: string;
    name: string;
    width: number;
    height: number;
    textSlots?: string[];  // nomes dos text layers editáveis
  }>;
  reusableAssets?: Array<{
    id: string;
    name: string;
    type: 'background' | 'logo' | 'element' | 'component';
    width?: number;
    height?: number;
  }>;
  pages?: Array<{
    id: string;
    name: string;
    frameCount: number;
  }>;
  components?: Array<{
    id: string;
    name: string;
    key?: string;
  }>;
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
  family?: string;
  style?: string;
  fontSize?: number;
  lineHeight?: number;
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
  cmyk?: { c: number; m: number; y: number; k: number }
}

export interface BrandGuidelineTypography {
  family: string
  style?: string
  role: string
  size?: number
  lineHeight?: number
  letterSpacing?: string
  weights?: number[]
  availableStyles?: string[]
}

export interface BrandGuidelineGradient {
  id: string
  name: string
  type: 'linear' | 'radial'
  angle: number
  stops: { color: string; position: number }[]
  usage: 'hero' | 'decorative' | 'fill' | 'overlay'
  css?: string
}

export interface BrandGuidelineShadow {
  id: string
  name: string
  x: number
  y: number
  blur: number
  spread: number
  color: string
  opacity: number
  type: 'outer' | 'inner' | 'glow'
  css?: string
}

export interface BrandGuidelineMotion {
  easing?: string
  durations?: { fast: number; medium: number; slow: number }
  philosophy?: 'minimal' | 'moderate' | 'expressive'
  respectsReducedMotion?: boolean
}

export interface BrandGuidelineBorder {
  id: string
  name: string
  width: number
  style: 'solid' | 'dashed' | 'dotted'
  color: string
  opacity: number
  role: 'default' | 'emphasis' | 'scaffold' | 'divider'
  css?: string
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

export interface BrandPillar {
  value: string
  description: string
}

export interface BrandCoreMessage {
  product: string
  differential: string
  emotionalBond: string
}

export interface BrandManifesto {
  provocation?: string
  tension?: string
  promise?: string
  full?: string
}

export interface BrandMarketResearch {
  competitors?: string[]
  gaps?: string[]
  opportunities?: string[]
  notes?: string
}

export interface BrandGraphicSystem {
  patterns?: string[]
  grafisms?: string[]
  imageRules?: string[]
  editorialGrid?: string
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
    variant: 'primary' | 'dark' | 'light' | 'icon' | 'accent' | 'custom'
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
    category?: 'background' | 'graphic' | 'stock' | 'product' | 'texture' | 'other'
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
    person?: 'first' | 'second' | 'third'
    emojiPolicy?: 'none' | 'informal' | 'free'
    casingRules?: string[]
  }
  gradients?: BrandGuidelineGradient[]
  shadows?: BrandGuidelineShadow[]
  motion?: BrandGuidelineMotion
  borders?: BrandGuidelineBorder[]
  validation?: Record<string, 'pending' | 'approved' | 'needs_work'>
  strategy?: {
    manifesto?: string | BrandManifesto
    positioning?: string[]
    coreMessage?: BrandCoreMessage
    pillars?: BrandPillar[]
    archetypes?: BrandArchetype[]
    personas?: BrandPersona[]
    voiceValues?: BrandToneOfVoiceValue[]
    marketResearch?: BrandMarketResearch
    graphicSystem?: BrandGraphicSystem
  }
  _extraction?: {
    sources: Array<{ type: 'url' | 'pdf' | 'image' | 'images' | 'json' | 'manual' | 'branding_machine'; ref?: string; date: string }>
    completeness: number
  }
  extraction?: { // Keep this for backend compatibility if it uses "extraction"
    sources: Array<{ type: 'url' | 'pdf' | 'image' | 'images' | 'json' | 'manual' | 'branding_machine'; ref?: string; date: string }>
    completeness: number
  }

  updatedAt?: string
  orderedBlocks?: string[]
  activeSections?: string[]
  // Knowledge base (files ingested via admin chat, feeds RAG for this brand)
  knowledgeFiles?: Array<{
    id: string
    fileName: string
    source: 'pdf' | 'image' | 'url' | 'text'
    vectorIds: string[]
    addedByUserId: string
    addedAt: string
  }>
  // Organization
  folder?: string
  // Public sharing
  publicSlug?: string
  isPublic?: boolean
  // Figma Integration
  figmaFileUrl?: string
  figmaFileKey?: string
  figmaSyncedAt?: string
  /** User-defined color schemes — explicit bg/text/primary/accent combos for AI generation */
  colorThemes?: BrandColorTheme[]
}

export interface BrandColorTheme {
  id: string
  name: string
  bg: string
  text: string
  primary: string
  accent: string
}

// ── Agent Component System ──

export interface AgentComponentMetadata {
  intents: string[];      // @agent:intent values
  slots: string[];        // @agent:slots values
  formats: string[];      // @agent:format values
  requires: string[];     // @agent:requires values
}

export interface AgentComponent {
  id: string;
  key: string;
  name: string;           // "Post/Promotional"
  category: string;       // "Posts"
  type: string;           // "Promotional"
  metadata: AgentComponentMetadata;
  width: number;
  height: number;
  thumbnail?: string;
}

export interface LayoutIntent {
  type: 'post' | 'card' | 'header' | 'story' | 'slide' | 'custom';
  subtype?: string;       // "promotional", "testimonial", etc.
  content: {
    title?: string;
    subtitle?: string;
    body?: string;
    cta?: string;
    discount?: string;
    image?: string;       // URL or "placeholder"
  };
  format?: string;        // "instagram-feed", "linkedin-post", etc.
}

export interface LayoutResult {
  operations: FigmaOperation[];
  strategy: 'reuse_component' | 'clone_template' | 'create_from_scratch';
  usedAsset?: { type: 'component' | 'template'; id: string; name: string };
}

// ── UI → Sandbox messages ──

export type UIMessage =
  | { type: 'GET_CONTEXT' }
  | { type: 'GET_ENRICHED_CONTEXT' }
  | { type: 'USE_SELECTION_AS_LOGO' }
  | { type: 'USE_SELECTION_AS_FONT' }
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
  | { type: 'OPEN_EXTERNAL_URL'; url: string }
  | { type: 'SAVE_API_KEY'; key: string }
  | { type: 'GET_API_KEY' }
  | { type: 'SAVE_ANTHROPIC_KEY'; key: string }
  | { type: 'GET_ANTHROPIC_KEY' }
  // Guideline presets
  | { type: 'GET_GUIDELINES' }
  | { type: 'SAVE_GUIDELINE'; guideline: BrandGuideline }
  | { type: 'DELETE_GUIDELINE'; id: string }
  | { type: 'SELECT_AND_ZOOM'; nodeId: string }
  | { type: 'CREATE_STICKY_PROMPT'; prompt: string; name: string }
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
  // Brand Guideline Auto-load (from Canvas)
  | { type: 'LINK_GUIDELINE'; guidelineId: string; autoLoad?: boolean }
  // Undo
  | { type: 'UNDO_LAST_BATCH' }
  // Template Scanning
  | { type: 'GET_TEMPLATES'; requestId?: string }
  // Agent Components
  | { type: 'GET_AGENT_COMPONENTS' }
  // Local Brand Config
  | { type: 'SAVE_LOCAL_BRAND_CONFIG'; config: any }
  | { type: 'GET_LOCAL_BRAND_CONFIG' }
  // Capture component
  | { type: 'CAPTURE_COMPONENT_SELECTION' }
  // Agent Library Scaffold
  | {
    type: 'SCAFFOLD_AGENT_LIBRARY';
    brand: {
      name: string;
      primary: { r: number; g: number; b: number };
      secondary?: { r: number; g: number; b: number };
      background: { r: number; g: number; b: number };
      text: { r: number; g: number; b: number };
      fontFamily: string;
      fontStyle?: string;
    };
  }
  // Figma Sync
  | { type: 'EXTRACT_FOR_SYNC' }
  | { type: 'PUSH_TO_FIGMA'; guideline: BrandGuideline }
  | { type: 'SMART_SCAN_SELECTION' }
  | { type: 'EXPORT_NODE_IMAGE'; nodeId: string; format: 'SVG' | 'PNG' }
  // Brand Intelligence & Operations
  | { type: 'APPLY_BRAND_GUIDELINES'; brand: any }
  | { type: 'VARY_SELECTION_COLORS'; brandColors?: string[] }
  | { type: 'SELECTION_TO_SLICES' }
  | { type: 'BRAND_LINT'; brand?: any }
  | { type: 'BRAND_LINT_FOCUS'; nodeId: string }
  | { type: 'BRAND_LINT_FIX'; brand?: any }
  | { type: 'RESPONSIVE_MULTIPLY'; formats?: Array<{ id: string; label: string; width: number; height: number }> }
  // Grid / Others
  | { type: 'GENERATE_BRAND_GRID'; sections?: any }
  | { type: 'GENERATE_SOCIAL_FRAMES'; brandColors?: string[] }
  // Export & Illustrator
  | { type: 'ILLUSTRATOR_EXPORT' }
  | { type: 'COPY_ILLUSTRATOR_CODE' }
  | { type: 'IMPORT_SELECTION_COMPONENTS' }
  | { type: 'GET_SELECTION_FILL' }
  | { type: 'GET_COMPONENT_THUMBNAILS'; componentIds?: string[] };

// ── Sandbox → UI messages ──

export type PluginMessage =
  | { type: 'CONTEXT'; payload: SerializedContext }
  | { type: 'ENRICHED_CONTEXT'; payload: EnrichedContext }
  | { type: 'OPERATIONS_DONE'; count?: number; summary?: string }
  | { type: 'OP_PROGRESS'; current: number; total: number; opType: string; opName: string; status: 'applying' | 'done' | 'error'; error?: string }
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
  | { type: 'BRAND_GUIDELINE_SAVED' }
  // Brand Guideline selection notification (to Canvas)
  | { type: 'GUIDELINE_SELECTED'; guidelineId: string }
  // High-Fidelity MCP Results
  | { type: 'DESIGN_CONTEXT_RESULT'; nodeId: string; context: any }
  | { type: 'VARIABLE_DEFS_RESULT'; nodeId: string; variables: any }
  | { type: 'SCREENSHOT_RESULT'; nodeId: string; base64: string }
  | { type: 'SEARCH_DS_RESULT'; results: any }
  | { type: 'CODE_CONNECT_RESULT'; mappings: any }
  // Template Scanning
  | { type: 'TEMPLATES_RESULT'; requestId?: string; templates: TemplateSpec[] }
  // Agent Components
  | { type: 'AGENT_COMPONENTS_RESULT'; components: any[] }
  // Agent Library Scaffold
  | { type: 'SCAFFOLD_COMPLETE'; message: string; components: Array<{ name: string; key: string }> }
  // Figma Sync
  | { type: 'EXTRACT_FOR_SYNC_RESULT'; data: any }
  | { type: 'EXTRACT_FOR_SYNC_ERROR'; error: string }
  | { type: 'PUSH_TO_FIGMA_RESULT'; created: number; updated: number }
  | { type: 'PUSH_TO_FIGMA_ERROR'; error: string }
  | { type: 'SMART_SCAN_RESULT'; items: any[]; error?: string }
  | { type: 'EXPORT_NODE_IMAGE_RESULT'; nodeId: string; data?: string; format?: string; error?: string };
