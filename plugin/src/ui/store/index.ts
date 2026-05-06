import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { PluginStore, ChatMessage, SelectionDetail, ColorEntry, Component, DesignTokens } from './types';

export const usePluginStore = create<PluginStore>()(
  immer((set) => ({
    // Selection & Canvas
    selectionDetails: [],
    selectionThumb: null,

    // Brand
    logos: [
      { name: 'light', src: undefined, loaded: false },
      { name: 'dark', src: undefined, loaded: false },
      { name: 'accent', src: undefined, loaded: false }
    ],
    typography: [
      { name: 'primary', fontFamily: undefined },
      { name: 'secondary', fontFamily: undefined }
    ],
    selectedColors: new Map(),

    // Library
    allComponents: [],
    componentThumbs: {},
    expandedFolders: new Set(),
    showFolders: false,

    // Chat
    chatHistory: [],
    sessionId: '',
    pendingAttachments: [],
    thinkMode: false,
    useBrand: true,
    scanPage: false,
    mode: 'simple',

    // Server
    serverUrl: (typeof window !== 'undefined' && (window as any).__VISANT_API_URL__) || 'https://api.visantlabs.com',

    // Auth
    authToken: null,
    authEmail: null,
    credits: { used: 0, limit: 0 },
    canGenerate: true,

    // Brand Guidelines
    brandGuideline: null,
    designSystem: null,
    designTokens: {},
    linkedGuideline: null,
    savedGuidelineIds: [],

    // Plugin features
    userInfo: null,
    mentionElements: [],
    apiKey: null,
    anthropicApiKey: null,
    showSmartScanModal: false,
    smartScanResults: null,
    selectedFont: null,
    brandLintReport: null,
    extractSyncData: null,
    exportedImage: null,
    isGenerating: false,

    brandHydrationTick: 0,
    brandHydrationAtMs: 0,

    // Image Generation
    selectedFrameSize: 'fullscreen',
    selectedResolution: '1x',
    selectedModel: 'gemini-2.5-flash',

    // UI State
    activeView: 'main',
    activeTab: 'brand',
    openPanel: null,
    devMode: false,
    toastMessage: undefined,
    toastType: undefined,

    // Actions
    updateSelection: (selection) =>
      set((state) => {
        state.selectionDetails = selection;
      }),

    addChatMessage: (message) => {
      set((state) => {
        state.chatHistory.push(message);
        if (state.chatHistory.length > 100) {
          state.chatHistory = state.chatHistory.slice(-80);
        }
      });
      scheduleChatPersist();
    },

    clearChatHistory: () => {
      set((state) => {
        state.chatHistory = [];
      });
      scheduleChatPersist();
    },

    setServerUrl: (url) =>
      set((state) => {
        state.serverUrl = url.replace(/\/$/, '');
      }),

    setAuthToken: (token) =>
      set((state) => {
        state.authToken = token;
      }),

    setAuthEmail: (email) =>
      set((state) => {
        state.authEmail = email;
      }),

    updateCredits: (credits) =>
      set((state) => {
        state.credits = credits;
        state.canGenerate = credits.used < credits.limit;
      }),

    setThinkMode: (enabled) =>
      set((state) => {
        state.thinkMode = enabled;
      }),

    setUseBrand: (enabled) =>
      set((state) => {
        state.useBrand = enabled;
      }),

    setScanPage: (enabled) =>
      set((state) => {
        state.scanPage = enabled;
      }),

    setActiveTab: (tab) =>
      set((state) => {
        state.activeTab = tab;
      }),

    setActiveView: (view) =>
      set((state) => {
        state.activeView = view;
      }),

    updateTypography: (slot, data) =>
      set((state) => {
        const typo = state.typography.find((t) => t.name === slot);
        if (typo) {
          Object.assign(typo, data);
        }
      }),

    addSelectedColor: (role, color) =>
      set((state) => {
        const newMap = new Map(state.selectedColors);
        newMap.set(role, color);
        state.selectedColors = newMap as any; // Cast as any if TS gets confused with proxies
      }),

    removeSelectedColor: (role) =>
      set((state) => {
        const newMap = new Map(state.selectedColors);
        newMap.delete(role);
        state.selectedColors = newMap as any;
      }),

    setAllComponents: (components) =>
      set((state) => {
        state.allComponents = components;
      }),

    toggleFolder: (folderPath) =>
      set((state) => {
        if (state.expandedFolders.has(folderPath)) {
          state.expandedFolders.delete(folderPath);
        } else {
          state.expandedFolders.add(folderPath);
        }
      }),

    setShowFolders: (show) =>
      set((state) => {
        state.showFolders = show;
      }),

    setBrandGuideline: (guideline) =>
      set((state) => {
        state.brandGuideline = guideline;
      }),

    setDesignSystem: (ds) =>
      set((state) => {
        state.designSystem = ds;
      }),

    showToast: (message, type = 'info') =>
      set((state) => {
        state.toastMessage = message;
        state.toastType = type;
        setTimeout(() => {
          set((s) => {
            s.toastMessage = undefined;
          });
        }, 3000);
      }),

    setUserInfo: (user) =>
      set((state) => { state.userInfo = user; }),

    setMentionElements: (elements) =>
      set((state) => { state.mentionElements = elements; }),

    setApiKey: (key) =>
      set((state) => { state.apiKey = key; }),

    setAnthropicApiKey: (key) =>
      set((state) => { state.anthropicApiKey = key; }),

    setSmartScanModal: (show, results) =>
      set((state) => {
        state.showSmartScanModal = show;
        if (results !== undefined) state.smartScanResults = results;
      }),

    setSelectedFont: (font) =>
      set((state) => { state.selectedFont = font; }),

    setBrandLintReport: (report) =>
      set((state) => { state.brandLintReport = report; }),

    setExtractSyncData: (data) =>
      set((state) => { state.extractSyncData = data; }),

    setExportedImage: (data) =>
      set((state) => { state.exportedImage = data; }),

    setIsGenerating: (generating) =>
      set((state) => { state.isGenerating = generating; }),

    toggleDevMode: () =>
      set((state) => { state.devMode = !state.devMode; })
  }))
);

// ── Chat persistence via figma.clientStorage (through postMessage RPC) ──

const CHAT_STORAGE_KEY = 'chatHistory';
let persistTimer: ReturnType<typeof setTimeout> | null = null;
type RpcClient = { request: (op: any, params: any) => Promise<any> };

let _client: RpcClient | null = null;

export function setChatPersistClient(client: RpcClient) {
  _client = client;
}

function scheduleChatPersist() {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    if (!_client) return;
    const history = usePluginStore.getState().chatHistory;
    const toSave = history.slice(-50).map(({ id, role, content, timestamp }) => ({ id, role, content, timestamp }));
    _client.request('storage.set', { key: CHAT_STORAGE_KEY, value: JSON.stringify(toSave) }).catch(() => {});
  }, 1500);
}

export async function loadChatHistory(client: RpcClient) {
  try {
    const { value } = await client.request('storage.get', { key: CHAT_STORAGE_KEY });
    if (value) {
      const messages = JSON.parse(value as string);
      if (Array.isArray(messages) && messages.length > 0) {
        usePluginStore.setState({ chatHistory: messages });
      }
    }
  } catch { /* first run, no history */ }
}

export type { PluginStore } from './types';
