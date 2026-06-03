import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type {
  PluginStore,
  ChatMessage,
  SelectionDetail,
  ColorEntry,
  Component,
  DesignTokens,
} from './types';
import { GEMINI_MODELS } from '@/constants/geminiModels';

export const usePluginStore = create<PluginStore>()(
  immer((set) => ({
    // Selection & Canvas
    selectionDetails: [],
    selectionThumb: null,

    // Brand
    logos: [
      { name: 'light', src: undefined, loaded: false },
      { name: 'dark', src: undefined, loaded: false },
      { name: 'accent', src: undefined, loaded: false },
    ],
    typography: [
      { name: 'primary', fontFamily: undefined },
      { name: 'secondary', fontFamily: undefined },
    ],
    selectedColors: new Map(),

    // Library
    allComponents: [],
    componentThumbs: {},

    // Chat
    chatHistory: [],
    sessionId:
      crypto.randomUUID?.() ??
      (([1e7] as any) + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, (c: string) =>
        (
          Number(c) ^
          (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (Number(c) / 4)))
        ).toString(16)
      ),
    sessionContext: null,
    pendingAttachments: [],
    thinkMode: false,
    useBrand: true,
    scanPage: false,
    generateImage: false,
    mode: 'simple',

    // Server
    serverUrl:
      (typeof window !== 'undefined' && (window as any).__VISANT_API_URL__) ||
      'https://api.visantlabs.com',

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
    colorScanResults: null,
    selectedFont: null,
    brandLintReport: null,
    extractSyncData: null,
    exportedImage: null,
    isGenerating: false,
    generatingStatus: '',
    matrixColors: [],

    brandHydrationTick: 0,
    brandHydrationAtMs: 0,

    // Image Generation
    selectedFrameSize: 'fullscreen',
    selectedResolution: '1x',
    selectedModel: GEMINI_MODELS.FLASH_3_5,

    // UI State
    activeView: 'main',
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
        state.sessionId =
          crypto.randomUUID?.() ??
          (() => {
            const buf = new Uint8Array(16);
            crypto.getRandomValues(buf);
            return Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('');
          })();
        state.sessionContext = null;
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

    setAllComponents: (components) =>
      set((state) => {
        state.allComponents = components;
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
      set((state) => {
        state.userInfo = user;
      }),

    setMentionElements: (elements) =>
      set((state) => {
        state.mentionElements = elements;
      }),

    setApiKey: (key) =>
      set((state) => {
        state.apiKey = key;
      }),

    setAnthropicApiKey: (key) =>
      set((state) => {
        state.anthropicApiKey = key;
      }),

    setExtractSyncData: (data) =>
      set((state) => {
        state.extractSyncData = data;
      }),

    setExportedImage: (data) =>
      set((state) => {
        state.exportedImage = data;
      }),

    setIsGenerating: (generating) =>
      set((state) => {
        state.isGenerating = generating;
      }),

    setGeneratingStatus: (status) =>
      set((state) => {
        state.generatingStatus = status;
      }),

    setMatrixColors: (colors) =>
      set((state) => {
        state.matrixColors = colors;
      }),

    toggleMatrixColor: (id) =>
      set((state) => {
        const c = state.matrixColors.find((c) => c.id === id);
        if (c) c.selected = !c.selected;
      }),

    addMatrixColor: (color) =>
      set((state) => {
        state.matrixColors.push({ ...color, selected: true });
      }),

    toggleDevMode: () =>
      set((state) => {
        state.devMode = !state.devMode;
      }),

    addLogoSlot: (name: string) =>
      set((state) => {
        if (!state.logos.some((l) => l.name === name)) {
          state.logos.push({ name, src: undefined, loaded: false });
        }
      }),
  }))
);

// ── Chat persistence via figma.clientStorage (through postMessage RPC) ──

const CHAT_STORAGE_KEY = 'chatHistory';
const SESSION_ID_KEY = 'chatSessionId';
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
    const { chatHistory, sessionId } = usePluginStore.getState();
    const toSave = chatHistory
      .slice(-50)
      .map(
        ({
          id,
          role,
          content,
          timestamp,
          operations,
          toolCalls,
          summaryItems,
          isError,
          metadata,
        }) => ({
          id,
          role,
          content,
          timestamp,
          operations,
          toolCalls,
          summaryItems,
          isError,
          metadata,
        })
      );
    _client
      .request('storage.set', { key: CHAT_STORAGE_KEY, value: JSON.stringify(toSave) })
      .catch(() => {});
    _client.request('storage.set', { key: SESSION_ID_KEY, value: sessionId }).catch(() => {});
  }, 1500);
}

export async function loadChatHistory(client: RpcClient) {
  try {
    // Restore sessionId first
    const sessionResult = await client.request('storage.get', { key: SESSION_ID_KEY });
    if (sessionResult?.value && typeof sessionResult.value === 'string') {
      usePluginStore.setState({ sessionId: sessionResult.value });
    }

    // Restore local chat history
    const { value } = await client.request('storage.get', { key: CHAT_STORAGE_KEY });
    if (value) {
      const messages = JSON.parse(value as string);
      if (Array.isArray(messages) && messages.length > 0) {
        usePluginStore.setState({ chatHistory: messages });
      }
    }

    // Fetch server-side session context (non-blocking)
    const sid = usePluginStore.getState().sessionId;
    if (sid) {
      const { serverUrl, authToken } = usePluginStore.getState();
      fetch(`${serverUrl}/api/plugin/session/${sid}/messages`, {
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data?.sessionContext) {
            usePluginStore.setState({ sessionContext: data.sessionContext });
          }
        })
        .catch(() => {});
    }
  } catch {
    /* first run, no history */
  }
}

export type { PluginStore } from './types';
