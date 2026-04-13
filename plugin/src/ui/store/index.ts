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

    // Auth
    authToken: null,
    authEmail: null,
    credits: { used: 0, limit: 10 },
    canGenerate: true,

    // Brand Guidelines
    brandGuideline: null,
    designSystem: null,
    designTokens: {},
    linkedGuideline: null,
    savedGuidelineIds: [],

    // Image Generation
    selectedFrameSize: 'fullscreen',
    selectedResolution: '1x',
    selectedModel: 'gemini-2.5-flash',

    // UI State
    activeView: 'main',
    activeTab: 'brand',
    openPanel: null,
    toastMessage: undefined,
    toastType: undefined,

    // Actions
    updateSelection: (selection) =>
      set((state) => {
        state.selectionDetails = selection;
      }),

    addChatMessage: (message) =>
      set((state) => {
        state.chatHistory.push(message);
      }),

    clearChatHistory: () =>
      set((state) => {
        state.chatHistory = [];
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

    updateBrandLogo: (slot, src) =>
      set((state) => {
        const logo = state.logos.find((l) => l.name === slot);
        if (logo) {
          logo.src = src;
          logo.loaded = true;
        }
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
        state.selectedColors.set(role, color);
      }),

    removeSelectedColor: (role) =>
      set((state) => {
        state.selectedColors.delete(role);
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
      })
  }))
);

export type { PluginStore } from './types';
