import { create } from 'zustand';
import { HALFTONE_DEFAULTS, type HalftoneSettings } from '@/components/halftone/HalftoneRenderer';
import { createShaderSlice, type ShaderSlice } from './shaderSlice';
import { HALFTONE_PRESETS_DATA } from '../../shared/imagelab/presets';

export const BLEND_MODES = [
  { id: 0, label: 'Subtractive (CMYK)' },
  { id: 1, label: 'Additive' },
  { id: 2, label: 'Normal' },
] as const;

// Single source of truth: shared/imagelab/presets.ts (also consumed server-side).
// 'Classic Print' is {} there — applyPreset spreads HALFTONE_DEFAULTS first, so
// it resolves to pure defaults exactly as before.
export const HALFTONE_PRESETS: Record<
  string,
  Partial<HalftoneSettings>
> = HALFTONE_PRESETS_DATA as Record<string, Partial<HalftoneSettings>>;

const MAX_HISTORY = 30;
const HISTORY_DEBOUNCE_MS = 400;

function snapshotSettings(s: HalftoneSettings): HalftoneSettings {
  return { ...s };
}

interface HalftoneState extends HalftoneSettings {
  imageUrl: string;
  fileName: string;
  panelVisible: boolean;
  activeTab: 'halftone' | 'color' | 'channels' | 'shader' | 'export';
  isExporting: boolean;

  zoom: number;
  panX: number;
  panY: number;

  settingsHistory: HalftoneSettings[];
  historyIndex: number;

  mediaType: 'image' | 'video';

  setImageUrl: (url: string, fileName: string, mediaType?: 'image' | 'video') => void;
  setPanelVisible: (v: boolean) => void;
  setActiveTab: (t: HalftoneState['activeTab']) => void;
  setIsExporting: (v: boolean) => void;
  updateSetting: <K extends keyof HalftoneSettings>(key: K, value: HalftoneSettings[K]) => void;
  applyPreset: (name: string) => void;
  resetSettings: () => void;
  getSettings: () => HalftoneSettings;

  setZoom: (z: number) => void;
  setPan: (x: number, y: number) => void;

  pushHistory: () => void;
  debouncedPushHistory: () => void;
  undo: () => void;
  redo: () => void;
}

let _htPendingSnap: HalftoneSettings | null = null;
let _htDebounceTimer: ReturnType<typeof setTimeout> | undefined;

export const useHalftoneStore = create<HalftoneState & ShaderSlice>()((set, get, api) => ({
  ...createShaderSlice(set as any, get as any, api as any),
  ...HALFTONE_DEFAULTS,
  imageUrl: '',
  fileName: '',
  panelVisible: true,
  activeTab: 'halftone',
  isExporting: false,

  zoom: 1,
  panX: 0,
  panY: 0,

  settingsHistory: [],
  historyIndex: -1,

  mediaType: 'image' as const,

  setImageUrl: (imageUrl, fileName, mediaType) =>
    set({ imageUrl, fileName, mediaType: mediaType || 'image' }),
  setPanelVisible: (panelVisible) => set({ panelVisible }),
  setActiveTab: (activeTab) => set({ activeTab }),
  setIsExporting: (isExporting) => set({ isExporting }),

  updateSetting: (key, value) => {
    get().debouncedPushHistory();
    set({ [key]: value });
  },

  applyPreset: (name) => {
    const preset = HALFTONE_PRESETS[name];
    if (preset) {
      get().pushHistory();
      set({ ...HALFTONE_DEFAULTS, ...preset });
    }
  },

  resetSettings: () => set({ ...HALFTONE_DEFAULTS, settingsHistory: [], historyIndex: -1 }),

  getSettings: () => {
    const state = get();
    const settings: HalftoneSettings = { ...HALFTONE_DEFAULTS };
    for (const key of Object.keys(HALFTONE_DEFAULTS) as (keyof HalftoneSettings)[]) {
      (settings as any)[key] = state[key];
    }
    return settings;
  },

  setZoom: (z) => set({ zoom: Math.max(0.1, Math.min(10, z)) }),
  setPan: (panX, panY) => set({ panX, panY }),

  pushHistory: () =>
    set((s) => {
      const snap = snapshotSettings(s.getSettings());
      const trimmed = s.settingsHistory.slice(0, s.historyIndex + 1);
      const history = [...trimmed, snap].slice(-MAX_HISTORY);
      return { settingsHistory: history, historyIndex: history.length - 1 };
    }),

  debouncedPushHistory: () => {
    if (!_htPendingSnap) {
      _htPendingSnap = snapshotSettings(get().getSettings());
    }
    clearTimeout(_htDebounceTimer);
    _htDebounceTimer = setTimeout(() => {
      if (_htPendingSnap) {
        set((s) => {
          const trimmed = s.settingsHistory.slice(0, s.historyIndex + 1);
          const history = [...trimmed, _htPendingSnap!].slice(-MAX_HISTORY);
          _htPendingSnap = null;
          return { settingsHistory: history, historyIndex: history.length - 1 };
        });
      }
    }, HISTORY_DEBOUNCE_MS);
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
}));
