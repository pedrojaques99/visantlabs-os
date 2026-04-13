import type {
  SerializedNode,
  FigmaOperation,
  UIMessage,
  PluginMessage,
  BrandGuideline,
  ColorVariable,
  FontVariable
} from '@/lib/figma-types';

export interface SelectionDetail {
  id: string;
  name: string;
  type: string;
  width?: number;
  height?: number;
  thumbnail?: string;
}

export interface LogoSlot {
  name: 'light' | 'dark' | 'accent';
  src?: string;
  loaded?: boolean;
}

export interface TypographySlot {
  name: 'primary' | 'secondary';
  fontFamily?: string;
  fontStyle?: string;
  fontSize?: number;
  lineHeight?: number;
  fontWeight?: number;
}

export interface Component {
  id: string;
  name: string;
  key: string;
  description?: string;
  thumbnail?: string;
  type?: string;
  folderPath?: string[];
}

export interface ColorEntry {
  role: string;
  hex: string;
  name?: string;
}

export interface DesignTokens {
  spacing?: Record<string, string>;
  radius?: Record<string, string>;
  shadows?: Record<string, string>;
  [key: string]: any;
}

export interface DesignSystem {
  name?: string;
  version?: string;
  tokens?: DesignTokens;
  format?: 'visant' | 'w3c' | 'figma-tokens';
}

export interface Credits {
  used: number;
  limit: number;
  resetDate?: string;
}

export interface Attachment {
  id: string;
  name: string;
  type: 'image' | 'file';
  size?: number;
  preview?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  attachments?: Attachment[];
  operations?: FigmaOperation[];
  thinking?: string;
  metadata?: Record<string, any>;
}

export interface PluginStore {
  // Selection & Canvas
  selectionDetails: SelectionDetail[];
  selectionThumb: string | null;

  // Brand
  logos: LogoSlot[];
  typography: TypographySlot[];
  selectedColors: Map<string, ColorEntry>;

  // Library
  allComponents: Component[];
  componentThumbs: Record<string, string>;
  expandedFolders: Set<string>;
  showFolders: boolean;

  // Chat
  chatHistory: ChatMessage[];
  sessionId: string;
  pendingAttachments: Attachment[];
  thinkMode: boolean;
  useBrand: boolean;
  scanPage: boolean;
  mode: 'simple' | 'advanced';

  // Auth
  authToken: string | null;
  authEmail: string | null;
  credits: Credits;
  canGenerate: boolean;

  // Brand Guidelines (v2)
  brandGuideline: BrandGuideline | null;
  designSystem: DesignSystem | null;
  designTokens: DesignTokens;
  linkedGuideline: string | null;
  savedGuidelineIds?: string[];

  // Image Generation
  selectedFrameSize: string;
  selectedResolution: string;
  selectedModel: string;

  // UI State
  activeView: 'main' | 'settings';
  activeTab: 'brand' | 'config' | 'dev';
  openPanel: string | null;
  toastMessage?: string;
  toastType?: 'success' | 'error' | 'info';

  // Actions
  updateSelection: (selection: SelectionDetail[]) => void;
  addChatMessage: (message: ChatMessage) => void;
  clearChatHistory: () => void;
  setAuthToken: (token: string | null) => void;
  setAuthEmail: (email: string | null) => void;
  updateCredits: (credits: Credits) => void;
  setThinkMode: (enabled: boolean) => void;
  setUseBrand: (enabled: boolean) => void;
  setScanPage: (enabled: boolean) => void;
  setActiveTab: (tab: 'brand' | 'config' | 'dev') => void;
  setActiveView: (view: 'main' | 'settings') => void;
  updateBrandLogo: (slot: 'light' | 'dark' | 'accent', src: string) => void;
  updateTypography: (slot: 'primary' | 'secondary', data: Partial<TypographySlot>) => void;
  addSelectedColor: (role: string, color: ColorEntry) => void;
  removeSelectedColor: (role: string) => void;
  setAllComponents: (components: Component[]) => void;
  toggleFolder: (folderPath: string) => void;
  setShowFolders: (show: boolean) => void;
  setBrandGuideline: (guideline: BrandGuideline | null) => void;
  setDesignSystem: (ds: DesignSystem | null) => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}
