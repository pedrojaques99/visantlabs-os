import { create } from 'zustand';
import { createShaderSlice, type ShaderSlice } from './shaderSlice';
import type { ShaderType } from '@/utils/shaders/shaderRegistry';

interface ShaderSnapshot {
  shaderEnabled: boolean;
  shaderType: ShaderType;
  shaderValues: Record<string, any>;
}

const MAX_HISTORY = 30;
const HISTORY_DEBOUNCE_MS = 400;

interface ShaderLabState {
  imageUrl: string;
  fileName: string;
  mediaType: 'image' | 'video';
  isExporting: boolean;
  zoom: number;
  panX: number;
  panY: number;
  historyIndex: number;
  historyLength: number;
  settingsHistory: ShaderSnapshot[];

  setImageUrl: (url: string, fileName: string, mediaType?: 'image' | 'video') => void;
  setIsExporting: (v: boolean) => void;
  setZoom: (z: number) => void;
  setPan: (x: number, y: number) => void;
  undo: () => void;
  redo: () => void;
  reset: () => void;
}

let _shPendingSnap: ShaderSnapshot | null = null;
let _shDebounceTimer: ReturnType<typeof setTimeout> | undefined;

function snapshotShader(s: ShaderSlice): ShaderSnapshot {
  return {
    shaderEnabled: s.shaderEnabled,
    shaderType: s.shaderType,
    shaderValues: { ...s.shaderValues },
  };
}

export const useShaderLabStore = create<ShaderLabState & ShaderSlice>()((set, get, api) => ({
  ...createShaderSlice(set as any, get as any, api as any),

  imageUrl: '',
  fileName: '',
  mediaType: 'image',
  isExporting: false,
  zoom: 1,
  panX: 0,
  panY: 0,
  historyIndex: -1,
  historyLength: 0,
  settingsHistory: [],

  shaderEnabled: true,

  setImageUrl: (imageUrl, fileName, mediaType = 'image') => set({ imageUrl, fileName, mediaType }),
  setIsExporting: (isExporting) => set({ isExporting }),
  setZoom: (zoom) => set({ zoom }),
  setPan: (panX, panY) => set({ panX, panY }),

  setShaderValue: (key, value) => {
    if (!_shPendingSnap) _shPendingSnap = snapshotShader(get());
    clearTimeout(_shDebounceTimer);
    _shDebounceTimer = setTimeout(() => {
      if (_shPendingSnap) {
        set((s) => {
          const trimmed = s.settingsHistory.slice(0, s.historyIndex + 1);
          const history = [...trimmed, _shPendingSnap!].slice(-MAX_HISTORY);
          _shPendingSnap = null;
          return {
            settingsHistory: history,
            historyIndex: history.length - 1,
            historyLength: history.length,
          };
        });
      }
    }, HISTORY_DEBOUNCE_MS);
    set((s) => ({ shaderValues: { ...s.shaderValues, [key]: value } }));
  },

  setShaderType: (t) => {
    const snap = snapshotShader(get());
    set((s) => {
      const trimmed = s.settingsHistory.slice(0, s.historyIndex + 1);
      const history = [...trimmed, snap].slice(-MAX_HISTORY);
      return {
        shaderType: t,
        shaderValues: {},
        settingsHistory: history,
        historyIndex: history.length - 1,
        historyLength: history.length,
      };
    });
  },

  undo: () =>
    set((s) => {
      if (s.historyIndex < 0) return {};
      const snap = s.settingsHistory[s.historyIndex];
      return { ...snap, historyIndex: s.historyIndex - 1 };
    }),

  redo: () =>
    set((s) => {
      if (s.historyIndex >= s.settingsHistory.length - 1) return {};
      const nextIndex = s.historyIndex + 1;
      const snap = s.settingsHistory[nextIndex];
      return { ...snap, historyIndex: nextIndex };
    }),

  reset: () =>
    set({
      shaderEnabled: true,
      shaderType: 'halftone',
      shaderValues: {},
      settingsHistory: [],
      historyIndex: -1,
      historyLength: 0,
      zoom: 1,
      panX: 0,
      panY: 0,
    }),
}));
