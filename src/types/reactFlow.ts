import type { Node, Edge } from '@xyflow/react';
import type { Mockup } from '../services/mockupApi';
import type { GeminiModel, Resolution, AspectRatio, DesignType, UploadedImage, GenerationMode } from './types';
import type { SubscriptionStatus } from '../services/subscriptionService';

// Base node data interface
export interface BaseNodeData {
  label?: string;
  onDelete?: (nodeId: string) => void;
  onDeleteNode?: (nodeId: string) => void;
  onDuplicate?: (nodeId: string) => void;
  onResize?: (nodeId: string, width: number, height: number) => void;
  /** Warning message for oversized/large content that can't be saved */
  oversizedWarning?: string;
  [key: string]: unknown;
}

// Image Node - displays existing mockups
export interface ImageNodeData extends BaseNodeData {
  type: 'image';
  mockup: Mockup;
  isGenerating?: boolean;
  description?: string; // AI-generated visual description
  isDescribing?: boolean; // Loading state for description generation
  imageScale?: number; // Scale factor for the image (0.25 to 2.0, default 1.0)
  imageWidth?: number; // Natural width of the image in pixels
  imageHeight?: number; // Natural height of the image in pixels
  userMockups?: Mockup[]; // User's custom mockups for brand kit selection
  onView?: (mockup: Mockup) => void;
  onEdit?: (mockup: Mockup) => void;
  onUpload?: (nodeId: string, imageBase64: string) => void;
  onResize?: (nodeId: string, width: number, height: number) => void;
  onUpdateData?: (nodeId: string, newData: Partial<ImageNodeData>) => void;
  onBrandKit?: (nodeId: string, presetIds: string[]) => void;
  addTextNode?: (customPosition?: { x: number; y: number }, initialText?: string, isFlowPosition?: boolean) => string | undefined;
}

// Merge Node - combines connected images
export interface MergeNodeData extends BaseNodeData {
  type: 'merge';
  prompt?: string;
  model?: GeminiModel;
  isLoading?: boolean;
  isGeneratingPrompt?: boolean;
  resultImageBase64?: string;
  resultImageUrl?: string; // R2 URL for result image
  imageWidth?: number; // Natural width of the image in pixels
  imageHeight?: number; // Natural height of the image in pixels
  connectedImages?: string[];
  onGenerate?: (nodeId: string, connectedImages: string[], prompt: string, model?: GeminiModel) => Promise<void>;
  onGeneratePrompt?: (nodeId: string, images: string[]) => Promise<void>;
  onUpdateData?: (nodeId: string, newData: Partial<MergeNodeData>) => void;
  onResize?: (nodeId: string, width: number, height: number) => void;
}

// Edit Node - edits image with MockupMachinePage configs
export interface EditNodeData extends BaseNodeData {
  type: 'edit';
  model?: GeminiModel;
  resolution?: Resolution;
  aspectRatio?: AspectRatio;
  designType?: DesignType;
  tags?: string[];
  brandingTags?: string[];
  locationTags?: string[];
  angleTags?: string[];
  lightingTags?: string[];
  effectTags?: string[];
  selectedColors?: string[];
  generateText?: boolean;
  withHuman?: boolean;
  negativePrompt?: string;
  additionalPrompt?: string;
  isLoading?: boolean;
  isGeneratingPrompt?: boolean;
  resultImageBase64?: string;
  resultImageUrl?: string; // R2 URL for result image
  onApply?: (nodeId: string, imageBase64: string, config: EditNodeData) => Promise<void>;

  // Additional fields for full Mockup Machine integration
  uploadedImage?: UploadedImage | null;
  referenceImage?: UploadedImage | null;
  referenceImages?: UploadedImage[];
  isImagelessMode?: boolean;
  promptPreview?: string;
  isSmartPromptActive?: boolean;
  isPromptManuallyEdited?: boolean;
  isPromptReady?: boolean;
  suggestedTags?: string[];
  isAnalyzing?: boolean;
  isAllCategoriesOpen?: boolean;
  isAdvancedOpen?: boolean;
  promptSuggestions?: string[];
  isSuggestingPrompts?: boolean;
  customBrandingInput?: string;
  customCategoryInput?: string;
  customLocationInput?: string;
  customAngleInput?: string;
  customLightingInput?: string;
  customEffectInput?: string;
  colorInput?: string;
  isValidColor?: boolean;
  mockupCount?: number;

  // Handlers
  onUpdateData?: (nodeId: string, newData: Partial<EditNodeData>) => void;
  onGenerateSmartPrompt?: (nodeId: string) => Promise<void>;
  onSuggestPrompts?: (nodeId: string) => Promise<void>;
  subscriptionStatus?: SubscriptionStatus | null;
}

// Upscale Node - increases image resolution using AI
export interface UpscaleNodeData extends BaseNodeData {
  type: 'upscale';
  targetResolution?: Resolution;
  isLoading?: boolean;
  resultImageBase64?: string;
  resultImageUrl?: string; // R2 URL for result image
  connectedImage?: string; // Base64 or URL of connected image
  onUpscale?: (nodeId: string, imageBase64: string, resolution: Resolution) => Promise<void>;
  onUpdateData?: (nodeId: string, newData: Partial<UpscaleNodeData>) => void;
}

// Upscale Bicubic Node - increases image resolution using bicubic shader
export interface UpscaleBicubicNodeData extends BaseNodeData {
  type: 'upscaleBicubic';
  isLoading?: boolean;
  resultImageBase64?: string;
  resultImageUrl?: string; // R2 URL for result image
  resultVideoBase64?: string; // Base64 for result video
  resultVideoUrl?: string; // R2 URL for result video
  connectedImage?: string; // Base64 or URL of connected image or video
  scaleFactor?: number; // Scale factor (2.0, 3.0, 4.0, etc.), default 2.0
  sharpening?: number; // Sharpening intensity (0.0 to 1.0), default 0.3 - compensates for bicubic smoothing
  imageWidth?: number; // Natural width of the image/video in pixels
  imageHeight?: number; // Natural height of the image/video in pixels
  onApply?: (nodeId: string, imageBase64: string) => Promise<void>;
  onUpdateData?: (nodeId: string, newData: Partial<UpscaleBicubicNodeData>) => void;
  onView?: (imageUrl: string) => void;
  onBrandKit?: (nodeId: string, presetIds: string[]) => void;
  onResize?: (nodeId: string, width: number, height: number) => void;
  userMockups?: Mockup[];
  savedMockupId?: string | null;
  isLiked?: boolean;
  description?: string;
  isDescribing?: boolean;
  addTextNode?: (customPosition?: { x: number; y: number }, initialText?: string, isFlowPosition?: boolean) => string | undefined;
}

// Mockup Node - generates mockups with presets
export interface MockupNodeData extends BaseNodeData {
  type: 'mockup';
  selectedPreset?: string; // MockupPresetType
  isLoading?: boolean;
  resultImageBase64?: string;
  resultImageUrl?: string; // R2 URL for result image
  imageWidth?: number; // Natural width of the image in pixels
  imageHeight?: number; // Natural height of the image in pixels
  connectedImage?: string; // Base64 da imagem conectada (legacy, mantido para compatibilidade)
  // BrandCore connection data
  connectedLogo?: string; // Base64 do logo conectado do BrandCore
  connectedIdentity?: string; // Base64 ou URL da identity conectada do BrandCore (PDF ou PNG)
  connectedTextDirection?: string; // Direcionamento textual do BrandCore (mockupPrompt)
  connectedStrategyData?: StrategyNodeData['strategyData']; // Dados estratégicos do BrandCore (opcional)
  selectedColors?: string[]; // Color palette
  colorInput?: string; // Color input value
  isValidColor?: boolean; // Color input validation
  withHuman?: boolean; // Include human interaction
  customPrompt?: string; // Custom editable prompt (optional)
  model?: GeminiModel; // Model for generation
  resolution?: Resolution; // Resolution for generation
  aspectRatio?: AspectRatio; // Aspect ratio for generation
  onGenerate?: (nodeId: string, imageBase64: string, presetId: string, selectedColors?: string[], withHuman?: boolean, customPrompt?: string, model?: GeminiModel, resolution?: Resolution, aspectRatio?: AspectRatio) => Promise<void>;
  onUpdateData?: (nodeId: string, newData: Partial<MockupNodeData>) => void;
  onAddMockupNode?: () => void;
  onResize?: (nodeId: string, width: number, height: number) => void;
}

// Angle Node - recreates image with different camera angles
export interface AngleNodeData extends BaseNodeData {
  type: 'angle';
  selectedAngle?: string; // AnglePresetType
  isLoading?: boolean;
  resultImageBase64?: string;
  resultImageUrl?: string; // R2 URL for result image
  connectedImage?: string; // Base64 da imagem conectada
  onGenerate?: (nodeId: string, imageBase64: string, angleId: string) => Promise<void>;
  onUpdateData?: (nodeId: string, newData: Partial<AngleNodeData>) => void;
}

// Texture Node - applies texture and 3D style presets
export interface TextureNodeData extends BaseNodeData {
  type: 'texture';
  selectedPreset?: string; // TexturePresetType
  isLoading?: boolean;
  resultImageBase64?: string;
  resultImageUrl?: string; // R2 URL for result image
  connectedImage?: string; // Base64 da imagem conectada
  onGenerate?: (nodeId: string, imageBase64: string, presetId: string) => Promise<void>;
  onUpdateData?: (nodeId: string, newData: Partial<TextureNodeData>) => void;
}

// Ambience Node - applies background/environment presets
export interface AmbienceNodeData extends BaseNodeData {
  type: 'ambience';
  selectedPreset?: string; // AmbiencePresetType
  isLoading?: boolean;
  resultImageBase64?: string;
  resultImageUrl?: string; // R2 URL for result image
  connectedImage?: string; // Base64 da imagem conectada
  onGenerate?: (nodeId: string, imageBase64: string, presetId: string) => Promise<void>;
  onUpdateData?: (nodeId: string, newData: Partial<AmbienceNodeData>) => void;
}

// Luminance Node - applies light setup presets
export interface LuminanceNodeData extends BaseNodeData {
  type: 'luminance';
  selectedPreset?: string; // LuminancePresetType
  isLoading?: boolean;
  resultImageBase64?: string;
  resultImageUrl?: string; // R2 URL for result image
  connectedImage?: string; // Base64 da imagem conectada
  onGenerate?: (nodeId: string, imageBase64: string, presetId: string) => Promise<void>;
  onUpdateData?: (nodeId: string, newData: Partial<LuminanceNodeData>) => void;
}

// Shader Node - applies GLSL shader effects to images
export interface ShaderNodeData extends BaseNodeData {
  type: 'shader';
  isLoading?: boolean;
  resultImageBase64?: string;
  resultImageUrl?: string; // R2 URL for result image
  resultVideoBase64?: string; // Base64 for result video
  resultVideoUrl?: string; // R2 URL for result video
  imageWidth?: number; // Natural width of the image/video in pixels
  imageHeight?: number; // Natural height of the image/video in pixels
  connectedImage?: string; // Base64 or URL of connected image or video
  // Shader type selection
  shaderType?: 'halftone' | 'vhs' | 'ascii' | 'matrixDither' | 'dither' | 'duotone'; // Type of shader effect, default 'halftone'
  halftoneVariant?: 'ellipse' | 'square' | 'lines'; // Variant for halftone shader, default 'ellipse'
  borderSize?: number; // Border size in pixels (0 to 20, default 0)
  // Halftone shader settings
  dotSize?: number; // Dot size (0.1 to 20.0, default 5.0)
  angle?: number; // Rotation angle in degrees (0 to 360, default 0.0)
  contrast?: number; // Contrast (0.0 to 2.0, default 1.0)
  spacing?: number; // Spacing between dots/lines (0.5 to 5.0, default 2.0)
  halftoneThreshold?: number; // Threshold for halftone effect (0.0 to 1.0, default 1.0)
  halftoneInvert?: number; // Invert colors (0.0 = normal, 1.0 = inverted, default 0.0)
  // VHS shader settings
  tapeWaveIntensity?: number; // Tape wave intensity (0.0 to 2.0, default 1.0)
  tapeCreaseIntensity?: number; // Tape crease intensity (0.0 to 2.0, default 1.0)
  switchingNoiseIntensity?: number; // Switching noise intensity (0.0 to 2.0, default 1.0)
  bloomIntensity?: number; // Bloom intensity (0.0 to 2.0, default 1.0)
  acBeatIntensity?: number; // AC beat intensity (0.0 to 2.0, default 1.0)
  // ASCII shader settings
  asciiCharSize?: number; // Character cell size in pixels (2 to 32, default 8.0)
  asciiContrast?: number; // Contrast adjustment (0.1 to 3.0, default 1.0)
  asciiBrightness?: number; // Brightness offset (-0.5 to 0.5, default 0.0)
  asciiCharSet?: number; // Character set: 0=Blocks, 1=Dots, 2=Lines, 3=Classic, 4=Matrix, 5=Braille
  asciiColored?: number; // 0=Grayscale, 1=Colored (uses original colors)
  asciiInvert?: number; // 0=Normal, 1=Inverted
  // Matrix Dither shader settings
  matrixSize?: number; // Bayer matrix size (2, 4, or 8, default 4)
  bias?: number; // Threshold bias adjustment (-1.0 to 1.0, default 0.0)
  // Dither shader settings
  ditherSize?: number; // Pixel size for dithering (1 to 16, default 4)
  ditherContrast?: number; // Contrast adjustment (0.1 to 3.0, default 1.5)
  offset?: number; // Luminosity offset (-0.5 to 0.5, default 0.0)
  bitDepth?: number; // Color bit depth (1 to 8, default 4)
  palette?: number; // Color palette: 0=Monochrome, 1=Gameboy, 2=CRT Amber, 3=CRT Green, 4=Sepia
  // Duotone shader settings
  duotoneShadowColor?: [number, number, number]; // RGB for shadows (0-1 each), default [0.1, 0.0, 0.2]
  duotoneHighlightColor?: [number, number, number]; // RGB for highlights (0-1 each), default [0.3, 0.9, 0.9]
  duotoneIntensity?: number; // Effect intensity (0.0 to 1.0, default 1.0)
  duotoneContrast?: number; // Luminosity contrast (0.5 to 2.0, default 1.0)
  duotoneBrightness?: number; // Brightness offset (-0.5 to 0.5, default 0.0)
  onApply?: (nodeId: string, imageBase64: string) => Promise<void>;
  onUpdateData?: (nodeId: string, newData: Partial<ShaderNodeData>) => void;
  onViewFullscreen?: (imageUrl: string | null, imageBase64?: string | null, sliders?: Array<{
    label: string;
    value: number;
    min: number;
    max: number;
    step?: number;
    onChange: (value: number) => void;
    formatValue?: (value: number) => string;
  }>) => void;
}

// Prompt Node - generates images from text prompts
export interface PromptNodeData extends BaseNodeData {
  type: 'prompt';
  prompt: string;
  model?: GeminiModel;
  aspectRatio?: AspectRatio; // Aspect ratio for image generation (Pro model only)
  resolution?: Resolution; // Resolution for image generation (Pro model only)
  isLoading?: boolean;
  resultImageBase64?: string;
  resultImageUrl?: string; // R2 URL for result image
  connectedImage1?: string; // First optional connected image (input-1)
  connectedImage2?: string; // Second optional connected image (input-2)
  connectedImage3?: string; // Third optional connected image (input-3) - 4K only
  connectedImage4?: string; // Fourth optional connected image (input-4) - 4K only
  connectedBrandIdentity?: BrandIdentity; // Brand identity from connected BrandNode (legacy)
  // BrandCore connection data
  connectedLogo?: string; // Base64 do logo conectado do BrandCore
  connectedIdentity?: string; // Base64 ou URL da identity conectada do BrandCore
  connectedIdentityType?: 'pdf' | 'png'; // Type of connected identity file
  connectedTextDirection?: string; // Direcionamento textual do BrandCore (compositionPrompt, stylePrompt)
  connectedText?: string; // Texto do TextNode conectado (sincronização em tempo real)
  pdfPageReference?: string; // Reference to specific page/section of PDF (e.g., "Page 3" or "Color section")
  promptSuggestions?: string[]; // AI-generated prompt suggestions
  isSuggestingPrompts?: boolean; // Loading state for prompt suggestions
  onGenerate?: (nodeId: string, prompt: string, connectedImages?: string[], model?: GeminiModel) => Promise<void>;
  onSuggestPrompts?: (nodeId: string, prompt: string) => Promise<void>; // Generate prompt suggestions
  onSavePrompt?: (prompt: string) => void; // Opens save prompt modal
  onUpdateData?: (nodeId: string, newData: Partial<PromptNodeData>) => void;
  onRemoveEdge?: (nodeId: string, targetHandle: 'input-1' | 'input-2' | 'input-3' | 'input-4') => void;
  onResize?: (nodeId: string, width: number, height: number) => void;
}

// Output Node - displays result images and videos from flow nodes
export interface OutputNodeData extends BaseNodeData {
  type: 'output';
  resultImageUrl?: string; // R2 URL for result image
  resultImageBase64?: string; // Base64 fallback for image
  resultVideoUrl?: string; // R2 URL for result video
  resultVideoBase64?: string; // Base64 fallback for video
  imageWidth?: number; // Natural width of the image/video in pixels
  imageHeight?: number; // Natural height of the image/video in pixels
  sourceNodeId?: string; // ID of the source node that generated this image/video
  isLoading?: boolean; // Loading state for skeleton display
  savedMockupId?: string | null; // ID of saved mockup if saved to collection
  isLiked?: boolean; // Whether the image is saved as favorite
  description?: string; // AI-generated visual description
  isDescribing?: boolean; // Loading state for description generation
  userMockups?: Mockup[]; // User's custom mockups for brand kit selection
  onView?: (imageUrl: string) => void;
  onEdit?: (imageUrl: string) => void;
  onBrandKit?: (nodeId: string, presetIds: string[]) => void;
  onResize?: (nodeId: string, width: number, height: number) => void;
  onUpdateData?: (nodeId: string, newData: Partial<OutputNodeData>) => void;
  addTextNode?: (customPosition?: { x: number; y: number }, initialText?: string, isFlowPosition?: boolean) => string | undefined;
}

// Brand Identity extracted from logo and PDF
export interface BrandIdentity {
  logo: {
    colors: string[]; // Hex codes
    style: string;
    elements: string[];
  };
  colors: {
    primary: string[];
    secondary: string[];
    accent: string[];
  };
  typography: {
    primary: string;
    secondary?: string;
    weights: string[];
  };
  composition: {
    style: string;
    grid: string;
    spacing: string;
  };
  personality: {
    tone: string;
    feeling: string;
    values: string[];
  };
  visualElements: string[];
}

// Logo Node - specialized node for logo upload
export interface LogoNodeData extends BaseNodeData {
  type: 'logo';
  logoBase64?: string;
  logoImageUrl?: string;
  imageWidth?: number; // Natural width of the image in pixels
  imageHeight?: number; // Natural height of the image in pixels
  onUploadLogo?: (nodeId: string, imageBase64: string) => void;
  onUpdateData?: (nodeId: string, newData: Partial<LogoNodeData>) => void;
}

// PDF Node - specialized node for identity guide PDF upload
export interface PDFNodeData extends BaseNodeData {
  type: 'pdf';
  pdfBase64?: string;
  pdfUrl?: string;
  pdfBase64Timestamp?: number; // Timestamp when pdfBase64 was created
  fileName?: string;
  onUploadPdf?: (nodeId: string, pdfBase64: string) => void;
  onUpdateData?: (nodeId: string, newData: Partial<PDFNodeData>) => void;
}

// Video Input Node - specialized node for video upload
export interface VideoInputNodeData extends BaseNodeData {
  type: 'videoInput';
  uploadedVideo?: string; // Base64 or URL of uploaded video
  uploadedVideoUrl?: string; // URL do R2 para vídeo enviado
  imageWidth?: number; // Natural width of the video in pixels
  imageHeight?: number; // Natural height of the video in pixels
  onUploadVideo?: (nodeId: string, videoData: string | File) => Promise<void>;
  onUpdateData?: (nodeId: string, newData: Partial<VideoInputNodeData>) => void;
}

// Strategy Node - generates strategic branding data (persona, archetypes, etc.)
export interface StrategyNodeData extends BaseNodeData {
  type: 'strategy';
  strategyType?: 'persona' | 'archetypes' | 'marketResearch' | 'all';
  prompt?: string; // Brand description prompt
  strategyData?: {
    persona?: {
      demographics: string;
      desires: string[];
      pains: string[];
    };
    archetypes?: {
      primary: {
        id: number;
        title: string;
        description: string;
        examples: string[];
      };
      secondary: {
        id: number;
        title: string;
        description: string;
        examples: string[];
      };
      reasoning: string;
    };
    marketResearch?: string | {
      mercadoNicho: string;
      publicoAlvo: string;
      posicionamento: string;
      insights: string;
    };
    competitors?: string[] | Array<{ name: string; url?: string }>;
    references?: string[];
    swot?: {
      strengths: string[];
      weaknesses: string[];
      opportunities: string[];
      threats: string[];
    };
    colorPalettes?: Array<{
      name: string;
      colors: string[];
      psychology: string;
    }>;
    visualElements?: string[];
    mockupIdeas?: string[];
    moodboard?: {
      summary: string;
      visualDirection: string;
      keyElements: string[];
    };
  };
  isGenerating?: boolean;
  generatingStep?: string; // Deprecated: use generatingSteps instead
  generatingSteps?: string[]; // Array of section types currently being generated
  projectId?: string; // ID do projeto de branding na database (para sincronização)
  name?: string; // Project name
  expandedSections?: Record<string, boolean>; // Persist expanded/collapsed state of sections
  onGenerate?: (nodeId: string, strategyType: string, prompt?: string) => Promise<void>;
  onGenerateSection?: (nodeId: string, sectionType: string) => Promise<void>;
  onGenerateAll?: (nodeId: string) => Promise<void>;
  onInitialAnalysis?: (nodeId: string, prompt?: string) => Promise<void>; // Initial analysis - only generates Market Research
  onCancelGeneration?: (nodeId: string, sectionType?: string) => void; // Cancel generation for specific section or all
  onGeneratePDF?: (nodeId: string) => void;
  onSave?: (nodeId: string) => Promise<string | undefined>; // Returns projectId
  onUpdateData?: (nodeId: string, newData: Partial<StrategyNodeData>) => void;
  onOpenProjectModal?: (nodeId: string) => void; // Opens project selection modal
  onResize?: (nodeId: string, width: number, height: number) => void;
}

// Brand Core - central catalyst node that translates connected nodes into prompts
export interface BrandCoreData extends BaseNodeData {
  type: 'brandCore';

  // Connected data (updated automatically via edges)
  connectedLogo?: string; // base64 do logo conectado
  connectedPdf?: string; // base64 do PDF conectado
  connectedImage?: string; // base64 da imagem conectada (identity guide PNG)
  connectedStrategies?: Array<{
    nodeId: string;
    strategyType: string;
    data: StrategyNodeData['strategyData'];
  }>;

  // Direct upload support (when not connected via handles)
  uploadedLogo?: string; // base64 do logo feito upload direto
  uploadedIdentity?: string; // base64 do identity guide feito upload direto (fallback)
  uploadedIdentityUrl?: string; // URL do R2 para identity guide (PDF) feito upload direto
  uploadedIdentityType?: 'pdf' | 'png'; // tipo do identity guide feito upload direto

  // BrandIdentity extracted (when has logo + identity)
  brandIdentity?: BrandIdentity;
  isAnalyzing?: boolean;

  // Generated prompts
  visualPrompts?: {
    mockupPrompt?: string; // Prompt otimizado para mockups
    compositionPrompt?: string; // Prompt para composição
    stylePrompt?: string; // Prompt para estilo visual
  };
  strategicPrompts?: {
    consolidated?: StrategyNodeData['strategyData']; // Dados estratégicos consolidados
  };

  isGeneratingPrompts?: boolean;

  // Handlers
  onAnalyze?: (nodeId: string, logoBase64: string, identityBase64: string, identityType: 'pdf' | 'png') => Promise<void>;
  onCancelAnalyze?: (nodeId: string) => void;
  onGenerateVisualPrompts?: (nodeId: string) => Promise<void>;
  onGenerateStrategicPrompts?: (nodeId: string) => Promise<void>;
  onUpdateData?: (nodeId: string, newData: Partial<BrandCoreData>) => void;
  onUploadPdfToR2?: (nodeId: string, pdfBase64: string) => Promise<string>; // Upload PDF direto para R2
}

// Video Node - generates videos from text prompts and/or images using Veo 3
export interface VideoNodeData extends BaseNodeData {
  type: 'video';
  prompt?: string;
  negativePrompt?: string;
  model?: string; // Video model (e.g., 'veo-3.1-generate-preview')
  mode?: GenerationMode;
  aspectRatio?: AspectRatio;
  resolution?: Resolution;
  duration?: string; // e.g., '5s', '10s'
  isLoading?: boolean;

  // Connected handles (synced from edges)
  connectedText?: string;
  connectedImage1?: string;
  connectedImage2?: string;
  connectedImage3?: string;
  connectedImage4?: string;
  connectedVideo?: string; // For extend mode

  // Media inputs (Direct uploads)
  startFrame?: string; // Base64 or URL
  endFrame?: string; // Base64 or URL
  referenceImages?: string[]; // Array of Base64 or URL strings
  inputVideo?: string; // Base64 or URL for extension
  inputVideoObject?: any; // To store the video object for file reference if needed

  isLooping?: boolean;
  imageWidth?: number;
  imageHeight?: number;

  // Generated video support
  resultVideoUrl?: string; // R2 URL for generated video
  resultVideoBase64?: string; // Base64 fallback for generated video

  // Handlers
  onGenerate?: (params: GenerateVideoParams) => Promise<void>;
  onUpdateData?: (nodeId: string, newData: Partial<VideoNodeData>) => void;
}

export interface GenerateVideoParams {
  nodeId: string;
  prompt: string;
  model: string;
  aspectRatio: string;
  resolution: string;
  duration?: string;
  mode: GenerationMode;
  startFrame?: { file?: File; base64?: string; url?: string } | null;
  endFrame?: { file?: File; base64?: string; url?: string } | null;
  referenceImages?: Array<{ file?: File; base64?: string; url?: string }>;
  inputVideo?: { file?: File; base64?: string; url?: string } | null;
  inputVideoObject?: any;
  isLooping?: boolean;
  negativePrompt?: string;
}

// Brand Node - extracts brand identity from logo and PDF/PNG (legacy, kept for compatibility)
export interface BrandNodeData extends BaseNodeData {
  type: 'brand';
  logoImage?: string; // base64 ou URL
  logoBase64?: string; // base64 do logo
  identityPdfUrl?: string; // URL do PDF (R2)
  identityPdfBase64?: string; // base64 do PDF ou PNG
  identityPdfBase64Timestamp?: number; // Timestamp when identityPdfBase64 was created
  identityImageUrl?: string; // URL da imagem de identidade (R2)
  identityImageBase64?: string; // base64 da imagem de identidade
  identityFileType?: 'pdf' | 'png'; // Tipo do arquivo de identidade
  brandIdentity?: BrandIdentity; // Dados extraídos
  isLoading?: boolean;
  isAnalyzing?: boolean;
  // Connected data (updated automatically via edges)
  connectedLogo?: string; // base64 do logo conectado de ImageNode
  connectedIdentity?: string; // base64 ou URL da identity conectada (PDF ou imagem)
  connectedIdentityType?: 'pdf' | 'png'; // tipo do arquivo de identity conectado
  onAnalyze?: (nodeId: string, logoBase64: string, identityBase64: string, identityType: 'pdf' | 'png') => Promise<void>;
  onUploadLogo?: (nodeId: string, imageBase64: string) => void;
  onUploadPdf?: (nodeId: string, pdfBase64: string) => void;
  onUploadIdentity?: (nodeId: string, fileBase64: string, fileType: 'pdf' | 'png') => void;
  onUpdateData?: (nodeId: string, newData: Partial<BrandNodeData>) => void;
}

// Color Extractor Node - extracts colors from images
export interface ColorExtractorNodeData extends BaseNodeData {
  type: 'colorExtractor';
  imageBase64?: string; // uploaded image
  connectedImage?: string; // connected image from ImageNode
  imageWidth?: number; // Natural width of the image in pixels
  imageHeight?: number; // Natural height of the image in pixels
  extractedColors?: string[]; // array of hex colors (max 10)
  isExtracting?: boolean; // loading state
  onExtract?: (nodeId: string, imageBase64: string, shouldRandomize?: boolean) => Promise<void>;
  onRegenerateOne?: (nodeId: string, imageBase64: string, index: number) => Promise<void>;
  onUpload?: (nodeId: string, imageBase64: string) => void;
  onUpdateData?: (nodeId: string, newData: Partial<ColorExtractorNodeData>) => void;
}

// Text Node - simple text node for displaying and editing text (can connect to PromptNode)
export interface TextNodeData extends BaseNodeData {
  type: 'text';
  text: string;
  onUpdateData?: (nodeId: string, newData: Partial<TextNodeData>) => void;
}

// Chat Node - conversational AI chat with context support (images, text, strategy)
export interface ChatNodeData extends BaseNodeData {
  type: 'chat';

  // Conversation history
  messages?: Array<{
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
    contextUsed?: {
      hasImages: boolean;
      hasStrategyData: boolean;
      hasTextContext: boolean;
    };
  }>;

  // User message counter (for credit calculation: 1 credit every 4 messages)
  userMessageCount?: number;

  // State
  isLoading?: boolean;
  model?: GeminiModel; // 'gemini-2.5-flash' (text only)
  systemPrompt?: string; // Custom system prompt for personalizing agent personality

  // Context inputs (via edges)
  connectedImage1?: string;
  connectedImage2?: string;
  connectedImage3?: string;
  connectedImage4?: string;
  connectedText?: string; // TextNode connection
  connectedStrategyData?: StrategyNodeData['strategyData']; // StrategyNode connection

  // Callbacks
  onSendMessage?: (
    nodeId: string,
    message: string,
    context: {
      images?: string[];
      text?: string;
      strategyData?: StrategyNodeData['strategyData'];
    }
  ) => Promise<void>;

  onUpdateData?: (nodeId: string, newData: Partial<ChatNodeData>) => void;
  onClearHistory?: (nodeId: string) => void;
  onAddPromptNode?: (nodeId: string, prompt: string) => void;
  onRemoveEdge?: (nodeId: string, targetHandle: 'input-1' | 'input-2' | 'input-3' | 'input-4' | 'text-input' | 'strategy-input') => void;
  onResize?: (nodeId: string, width: number, height: number) => void;
  onOpenSidebar?: (nodeId: string) => void;

  // Advanced node creation and editing callbacks
  onCreateNode?: (
    chatNodeId: string,
    nodeType: FlowNodeType,
    initialData?: Partial<FlowNodeData>,
    connectToChat?: boolean
  ) => string | undefined;

  onEditConnectedNode?: (
    targetNodeId: string,
    updates: Partial<FlowNodeData>
  ) => void;

  // Callback to create an ImageNode with uploaded media
  onAttachMedia?: (
    chatNodeId: string,
    imageBase64: string,
    mimeType: string
  ) => string | undefined;

  // Get list of connected node IDs for editing
  connectedNodeIds?: string[];
}

// Union type for all node data
export type FlowNodeData = ImageNodeData | MergeNodeData | EditNodeData | UpscaleNodeData | UpscaleBicubicNodeData | MockupNodeData | OutputNodeData | PromptNodeData | BrandNodeData | AngleNodeData | LogoNodeData | PDFNodeData | StrategyNodeData | BrandCoreData | VideoNodeData | VideoInputNodeData | TextureNodeData | AmbienceNodeData | LuminanceNodeData | ShaderNodeData | ColorExtractorNodeData | TextNodeData | ChatNodeData;

// Custom node types
export type FlowNodeType = 'image' | 'merge' | 'edit' | 'upscale' | 'mockup' | 'output' | 'prompt' | 'brand' | 'angle' | 'logo' | 'pdf' | 'strategy' | 'brandCore' | 'video' | 'videoInput' | 'texture' | 'ambience' | 'luminance' | 'shader' | 'colorExtractor' | 'text' | 'chat';

// Extended Node type with our custom data
export type FlowNode = Node<FlowNodeData>;

// Extended Edge type
export type FlowEdge = Edge;

// Position storage for persistence
export interface NodePosition {
  x: number;
  y: number;
}

export interface SavedFlowState {
  nodePositions: Record<string, NodePosition>;
  edges: FlowEdge[];
}

