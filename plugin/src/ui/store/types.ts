import type {
  SerializedNode,
  FigmaOperation,
  UIMessage,
  PluginMessage,
  BrandGuideline,
  ColorVariable,
  FontVariable,
} from '@/lib/figma-types';
import type { ToolCallRecord } from '@shared/types/chat';

export interface SelectionDetail {
  id: string;
  name: string;
  type: string;
  width?: number;
  height?: number;
  thumbnail?: string;
}

export interface LogoSlot {
  name: string;
  src?: string; // preview URL for <img> (thumbnailUrl ?? url)
  loaded?: boolean;
  id?: string; // server-side logo id
  source?: 'upload' | 'figma';
  url?: string; // uploaded media URL (svg/png/pdf)
  thumbnailUrl?: string; // rasterized preview
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

/** Tab destinations, plus 'sessions' (chat history, reached from the chat, not a tab). */
export type ActiveView = 'brand' | 'main' | 'tools' | 'profile' | 'sessions';

/** The tab bar, in the product's hierarchy: brand → chat → tools → user. */
export const TAB_VIEWS = ['brand', 'main', 'tools', 'profile'] as const;
export type TabView = (typeof TAB_VIEWS)[number];

/**
 * The limit is only real when we know it. Credits default to {used:0, limit:0} and a
 * logged-out user reports the same, so `used >= limit` alone would tell someone who never
 * signed in that they ran out — that's an auth state, not a limit. The server stays the
 * source of truth (it answers NO_CREDITS); this only decides when to stop asking.
 */
export function isOutOfCredits(credits: Credits | null | undefined): boolean {
  if (!credits || credits.limit <= 0) return false;
  return credits.used >= credits.limit;
}

export interface Attachment {
  id: string;
  name: string;
  type: 'image' | 'file';
  size?: number;
  preview?: string;
}

export interface SummaryItem {
  text: string;
  nodeId?: string;
  nodeName?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  attachments?: Attachment[];
  operations?: FigmaOperation[];
  summaryItems?: SummaryItem[];
  thinking?: string;
  metadata?: Record<string, any>;
  toolCalls?: ToolCallRecord[];
  generatedImageUrl?: string;
  isError?: boolean;
}

export type { ToolCallRecord };

export interface ChatSessionMeta {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
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

  // Chat
  chatHistory: ChatMessage[];
  sessionId: string;
  sessions: ChatSessionMeta[];
  sessionContext: { messageCount: number; tokenEstimate: number; contextLimit: number } | null;
  pendingAttachments: Attachment[];
  thinkMode: boolean;
  useBrand: boolean;
  scanPage: boolean;
  generateImage: boolean;
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
  colorScanResults: any | null;
  selectedFont: { family: string; style?: string; fontSize?: number; lineHeight?: number } | null;
  brandLintReport: any | null;
  extractSyncData: any | null;
  exportedImage: any | null;
  isGenerating: boolean;
  generatingStatus: string;
  matrixColors: { id: string; name: string; r: number; g: number; b: number; selected: boolean }[];

  // Internal: increments each time the brand state is hydrated from server.
  // Used by useBrandAutoSync to suppress echo writes.
  brandHydrationTick: number;
  brandHydrationAtMs: number;

  // UI State
  // Destinations, in the product's hierarchy: brand → chat → tools → user.
  // 'sessions' has no tab — it is chat history, reached from the chat itself.
  activeView: ActiveView;
  collapsed: boolean;
  openPanel: string | null;
  devMode: boolean;
  toastMessage?: string;
  toastType?: 'success' | 'error' | 'info' | 'warning';

  // Actions
  updateSelection: (selection: SelectionDetail[]) => void;
  addChatMessage: (message: ChatMessage) => void;
  clearChatHistory: () => void;
  newSession: () => void;
  switchSession: (id: string) => void;
  deleteSession: (id: string) => void;
  renameSession: (id: string, title: string) => void;
  setCollapsed: (collapsed: boolean) => void;
  setServerUrl: (url: string) => void;
  setAuthToken: (token: string | null) => void;
  setAuthEmail: (email: string | null) => void;
  updateCredits: (credits: Credits) => void;
  setThinkMode: (enabled: boolean) => void;
  setUseBrand: (enabled: boolean) => void;
  setScanPage: (enabled: boolean) => void;
  setActiveView: (view: ActiveView) => void;
  updateTypography: (slot: 'primary' | 'secondary', data: Partial<TypographySlot>) => void;
  addSelectedColor: (role: string, color: ColorEntry) => void;
  setAllComponents: (components: Component[]) => void;
  setBrandGuideline: (guideline: BrandGuideline | null) => void;
  setDesignSystem: (ds: DesignSystem | null) => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
  setUserInfo: (user: { id: string; name: string; photoUrl?: string }) => void;
  setMentionElements: (elements: any[]) => void;
  setApiKey: (key: string | null) => void;
  setAnthropicApiKey: (key: string | null) => void;
  setExtractSyncData: (data: any) => void;
  setExportedImage: (data: any) => void;
  setIsGenerating: (generating: boolean) => void;
  setGeneratingStatus: (status: string) => void;
  setMatrixColors: (
    colors: { id: string; name: string; r: number; g: number; b: number; selected: boolean }[]
  ) => void;
  toggleMatrixColor: (id: string) => void;
  addMatrixColor: (color: { id: string; name: string; r: number; g: number; b: number }) => void;
  toggleDevMode: () => void;
  addLogoSlot: (name: string) => void;
}
