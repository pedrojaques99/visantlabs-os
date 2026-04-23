import type {
  SerializedNode,
  FigmaOperation,
  UIMessage,
  PluginMessage,
  BrandGuideline,
  ColorVariable,
  FontVariable
} from '@/lib/figma-types';
import type { ToolCallRecord } from '../../../../shared/types/chat';

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
  src?: string;                 // preview URL for <img> (thumbnailUrl ?? url)
  loaded?: boolean;
  id?: string;                  // server-side logo id
  source?: 'upload' | 'figma';
  url?: string;                 // uploaded media URL (svg/png/pdf)
  thumbnailUrl?: string;        // rasterized preview
  format?: string;
  figmaKey?: string;
  figmaFileKey?: string;
  figmaNodeId?: string;
  label?: string;
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
  toolCalls?: ToolCallRecord[];
}

export type { ToolCallRecord };

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

  // Server
  serverUrl: string;

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

  // Plugin features
  userInfo: { id: string; name: string; photoUrl?: string } | null;
  mentionElements: any[];
  apiKey: string | null;
  anthropicApiKey: string | null;
  showSmartScanModal: boolean;
  smartScanResults: any | null;
  selectedFont: { family: string; style?: string; fontSize?: number; lineHeight?: number } | null;
  brandLintReport: any | null;
  extractSyncData: any | null;
  exportedImage: any | null;
  isGenerating: boolean;

  // Internal: increments each time the brand state is hydrated from server.
  // Used by useBrandAutoSync to suppress echo writes.
  brandHydrationTick: number;
  brandHydrationAtMs: number;

  // UI State
  activeView: 'main' | 'settings';
  activeTab: 'brand' | 'config' | 'dev';
  openPanel: string | null;
  toastMessage?: string;
  toastType?: 'success' | 'error' | 'info' | 'warning';

  // Actions
  updateSelection: (selection: SelectionDetail[]) => void;
  addChatMessage: (message: ChatMessage) => void;
  clearChatHistory: () => void;
  setServerUrl: (url: string) => void;
  setAuthToken: (token: string | null) => void;
  setAuthEmail: (email: string | null) => void;
  updateCredits: (credits: Credits) => void;
  setThinkMode: (enabled: boolean) => void;
  setUseBrand: (enabled: boolean) => void;
  setScanPage: (enabled: boolean) => void;
  setActiveTab: (tab: 'brand' | 'config' | 'dev') => void;
  setActiveView: (view: 'main' | 'settings') => void;
  updateTypography: (slot: 'primary' | 'secondary', data: Partial<TypographySlot>) => void;
  addSelectedColor: (role: string, color: ColorEntry) => void;
  removeSelectedColor: (role: string) => void;
  setAllComponents: (components: Component[]) => void;
  toggleFolder: (folderPath: string) => void;
  setShowFolders: (show: boolean) => void;
  setBrandGuideline: (guideline: BrandGuideline | null) => void;
  setDesignSystem: (ds: DesignSystem | null) => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
  setUserInfo: (user: { id: string; name: string; photoUrl?: string }) => void;
  setMentionElements: (elements: any[]) => void;
  setApiKey: (key: string | null) => void;
  setAnthropicApiKey: (key: string | null) => void;
  setSmartScanModal: (show: boolean, results?: any) => void;
  setSelectedFont: (font: { family: string; style?: string } | null) => void;
  setBrandLintReport: (report: any) => void;
  setExtractSyncData: (data: any) => void;
  setExportedImage: (data: any) => void;
  setIsGenerating: (generating: boolean) => void;
}
