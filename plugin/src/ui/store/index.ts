import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type {
  PluginStore,
  ChatMessage,
  ChatSessionMeta,
  SelectionDetail,
  ColorEntry,
  Component,
  DesignTokens,
} from './types';
import { GEMINI_MODELS } from '@/constants/geminiModels';
import { DEFAULT_API_BASE_URL, joinApiUrl, normalizeBaseUrl } from '../apiBase';

export const usePluginStore = create<PluginStore>()(
  immer((set) => ({
    // Selection & Canvas
    selectionDetails: [],
    fileId: null,
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
    sessions: [],
    sessionContext: null,
    pendingAttachments: [],
    thinkMode: false,
    useBrand: true,
    scanPage: false,
    generateImage: false,
    mode: 'simple',

    // Server — SSoT for the API base URL (see ../apiBase.ts)
    serverUrl: DEFAULT_API_BASE_URL,

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
    collapsed: false,
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
        state.sessionId = newSessionId();
        state.sessionContext = null;
      });
      scheduleChatPersist();
    },

    // Archive the current session (if it has messages) and start a blank one,
    // keeping previous sessions navigable — the primary "New conversation" action.
    newSession: () => {
      flushChatPersist();
      set((state) => {
        state.chatHistory = [];
        state.sessionId = newSessionId();
        state.sessionContext = null;
        state.activeView = 'main';
      });
      // Persist the fresh (empty) active-session pointer so a reload restores it.
      persistActiveSessionPointer();
    },

    switchSession: (id) => {
      const state = usePluginStore.getState();
      if (id === state.sessionId) {
        set((s) => {
          s.activeView = 'main';
        });
        return;
      }
      flushChatPersist();
      void loadSession(id);
    },

    deleteSession: (id) => {
      const state = usePluginStore.getState();
      const isActive = id === state.sessionId;
      const remaining = state.sessions.filter((s) => s.id !== id);
      set((s) => {
        s.sessions = remaining;
      });
      if (_client) {
        _client.request('storage.delete', { key: sessionKey(id) }).catch(() => {});
        _client
          .request('storage.set', { key: SESSIONS_INDEX_KEY, value: JSON.stringify(remaining) })
          .catch(() => {});
      }
      if (isActive) {
        set((s) => {
          s.chatHistory = [];
          s.sessionId = newSessionId();
          s.sessionContext = null;
        });
        persistActiveSessionPointer();
      }
    },

    renameSession: (id, title) => {
      const clean = title.trim().slice(0, 80) || 'Nova conversa';
      const sessions = usePluginStore
        .getState()
        .sessions.map((s) => (s.id === id ? { ...s, title: clean } : s));
      set((s) => {
        s.sessions = sessions;
      });
      if (_client) {
        _client
          .request('storage.set', { key: SESSIONS_INDEX_KEY, value: JSON.stringify(sessions) })
          .catch(() => {});
      }
    },

    setCollapsed: (collapsed) =>
      set((state) => {
        state.collapsed = collapsed;
      }),

    setServerUrl: (url) =>
      set((state) => {
        state.serverUrl = normalizeBaseUrl(url);
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

const CHAT_STORAGE_KEY = 'chatHistory'; // active-session messages (fast boot cache)
const SESSION_ID_KEY = 'chatSessionId'; // active-session id
const SESSIONS_INDEX_KEY = 'chatSessions'; // ChatSessionMeta[] index of all sessions
const MAX_SESSIONS = 20; // cap stored sessions (clientStorage quota safety)

const sessionKey = (id: string) => `chatSession:${id}`;

function newSessionId(): string {
  return (
    crypto.randomUUID?.() ??
    (() => {
      const buf = new Uint8Array(16);
      crypto.getRandomValues(buf);
      return Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('');
    })()
  );
}

let persistTimer: ReturnType<typeof setTimeout> | null = null;
type RpcClient = { request: (op: any, params: any) => Promise<any> };

let _client: RpcClient | null = null;

export function setChatPersistClient(client: RpcClient) {
  _client = client;
}

/** Trim + strip messages down to the persisted shape (last 50). */
function serializeMessages(chatHistory: ChatMessage[]) {
  return chatHistory
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
}

function deriveTitle(chatHistory: ChatMessage[]): string {
  const firstUser = chatHistory.find((m) => m.role === 'user');
  const text = (firstUser?.content ?? '').trim().replace(/\s+/g, ' ');
  return text ? text.slice(0, 48) : 'Nova conversa';
}

/** Upsert the active session into the in-memory + persisted index. */
function upsertActiveInIndex(sessionId: string, chatHistory: ChatMessage[]): ChatSessionMeta[] {
  const existing = usePluginStore.getState().sessions;
  const prev = existing.find((s) => s.id === sessionId);
  const entry: ChatSessionMeta = {
    id: sessionId,
    title: deriveTitle(chatHistory),
    createdAt: prev?.createdAt ?? Date.now(),
    updatedAt: Date.now(),
    messageCount: chatHistory.length,
  };
  const next = [entry, ...existing.filter((s) => s.id !== sessionId)]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, MAX_SESSIONS);
  usePluginStore.setState({ sessions: next });
  return next;
}

/** Write the active session (messages + pointer + index). No-op without a client. */
function doPersist() {
  if (!_client) return;
  const { chatHistory, sessionId } = usePluginStore.getState();
  const toSave = serializeMessages(chatHistory);
  const payload = JSON.stringify(toSave);

  _client.request('storage.set', { key: CHAT_STORAGE_KEY, value: payload }).catch(() => {});
  _client.request('storage.set', { key: SESSION_ID_KEY, value: sessionId }).catch(() => {});

  if (chatHistory.length > 0) {
    _client.request('storage.set', { key: sessionKey(sessionId), value: payload }).catch(() => {});
    const index = upsertActiveInIndex(sessionId, chatHistory);
    _client
      .request('storage.set', { key: SESSIONS_INDEX_KEY, value: JSON.stringify(index) })
      .catch(() => {});
  }
}

function scheduleChatPersist() {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(doPersist, 1500);
}

/** Flush any pending debounced write immediately (used before switching sessions). */
export function flushChatPersist() {
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
  doPersist();
}

/** Persist just the active-session pointer + fast-boot cache (for empty new sessions). */
function persistActiveSessionPointer() {
  if (!_client) return;
  const { sessionId } = usePluginStore.getState();
  _client.request('storage.set', { key: SESSION_ID_KEY, value: sessionId }).catch(() => {});
  _client.request('storage.set', { key: CHAT_STORAGE_KEY, value: '[]' }).catch(() => {});
}

function fetchServerSessionContext(sid: string) {
  const { serverUrl, authToken } = usePluginStore.getState();
  fetch(joinApiUrl(serverUrl, `/plugin/session/${sid}/messages`), {
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

/** Load a stored session by id and make it the active one. */
async function loadSession(id: string) {
  if (!_client) return;
  try {
    const { value } = await _client.request('storage.get', { key: sessionKey(id) });
    const messages = value ? JSON.parse(value as string) : [];
    usePluginStore.setState({
      sessionId: id,
      chatHistory: Array.isArray(messages) ? messages : [],
      sessionContext: null,
      activeView: 'main',
    });
    // Make this the active session in the fast-boot cache too.
    _client.request('storage.set', { key: SESSION_ID_KEY, value: id }).catch(() => {});
    _client
      .request('storage.set', {
        key: CHAT_STORAGE_KEY,
        value: JSON.stringify(serializeMessages(usePluginStore.getState().chatHistory)),
      })
      .catch(() => {});
    fetchServerSessionContext(id);
  } catch {
    /* corrupt/missing session */
  }
}

/** Load the sessions index; synthesize an entry for a pre-existing active session. */
export async function loadSessions(client: RpcClient) {
  try {
    const { value } = await client.request('storage.get', { key: SESSIONS_INDEX_KEY });
    let sessions: ChatSessionMeta[] = [];
    if (value) {
      const parsed = JSON.parse(value as string);
      if (Array.isArray(parsed)) sessions = parsed;
    }
    // Migration: a pre-existing chat has no index entry yet — synthesize one.
    const { sessionId, chatHistory } = usePluginStore.getState();
    if (chatHistory.length > 0 && !sessions.some((s) => s.id === sessionId)) {
      sessions = [
        {
          id: sessionId,
          title: deriveTitle(chatHistory),
          createdAt: Date.now(),
          updatedAt: Date.now(),
          messageCount: chatHistory.length,
        },
        ...sessions,
      ];
      client
        .request('storage.set', { key: SESSIONS_INDEX_KEY, value: JSON.stringify(sessions) })
        .catch(() => {});
    }
    usePluginStore.setState({ sessions: sessions.sort((a, b) => b.updatedAt - a.updatedAt) });
  } catch {
    /* first run, no sessions */
  }
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

    // Populate the sessions index (after history is restored, for migration).
    await loadSessions(client);

    // Fetch server-side session context (non-blocking)
    const sid = usePluginStore.getState().sessionId;
    if (sid) fetchServerSessionContext(sid);
  } catch {
    /* first run, no history */
  }
}

export type { PluginStore } from './types';
