import { create } from 'zustand';
import { HALFTONE_DEFAULTS, type HalftoneSettings } from '@/components/halftone/HalftoneRenderer';
import { createShaderSlice, type ShaderSlice } from './shaderSlice';

export const BLEND_MODES = [
  { id: 0, label: 'Subtractive (CMYK)' },
  { id: 1, label: 'Additive' },
  { id: 2, label: 'Normal' },
] as const;

export const HALFTONE_PRESETS: Record<string, Partial<HalftoneSettings>> = {
  'Classic Print': { ...HALFTONE_DEFAULTS },
  'Newsprint': { frequency: 45, dotSize: 1.0, roughness: 3.0, fuzz: 0.15, paperNoise: 0.3, inkNoise: 0.8, contrast: 1.2, paperColor: '#ede6d6' },
  'Pop Art': { frequency: 30, dotSize: 1.0, roughness: 0, fuzz: 0, paperNoise: 0, inkNoise: 0, contrast: 1.5, blendMode: 0, paperColor: '#ffffff' },
  'Risograph': { frequency: 60, dotSize: 0.9, roughness: 1.5, fuzz: 0.2, paperNoise: 0.15, inkNoise: 0.5, randomness: 0.3, paperColor: '#f5f0e0' },
  'Duotone BW': { frequency: 70, dotSize: 1.0, showCyan: false, showMagenta: false, showYellow: false, showBlack: true, paperColor: '#ffffff', blackAlpha: 1.0 },
  'Neon Screen': { frequency: 50, dotSize: 0.8, blendMode: 1, paperColor: '#0a0a0a', paperAlpha: 1.0, cyanInk: '#00ffcc', magentaInk: '#ff00aa', yellowInk: '#ffee00' },
};

const MAX_HISTORY = 30;

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

  setImageUrl: (url: string, fileName: string) => void;
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
  undo: () => void;
  redo: () => void;
}

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

  setImageUrl: (imageUrl, fileName) => set({ imageUrl, fileName }),
  setPanelVisible: (panelVisible) => set({ panelVisible }),
  setActiveTab: (activeTab) => set({ activeTab }),
  setIsExporting: (isExporting) => set({ isExporting }),

  updateSetting: (key, value) => {
    get().pushHistory();
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

  pushHistory: () => set((s) => {
    const snap = snapshotSettings(s.getSettings());
    const trimmed = s.settingsHistory.slice(0, s.historyIndex + 1);
    const history = [...trimmed, snap].slice(-MAX_HISTORY);
    return { settingsHistory: history, historyIndex: history.length - 1 };
  }),

  undo: () => set((s) => {
    if (s.historyIndex < 0) return {};
    const snap = s.settingsHistory[s.historyIndex];
    return { ...snap, historyIndex: s.historyIndex - 1 };
  }),

  redo: () => set((s) => {
    if (s.historyIndex >= s.settingsHistory.length - 1) return {};
    const nextIndex = s.historyIndex + 1;
    const snap = s.settingsHistory[nextIndex];
    return { ...snap, historyIndex: nextIndex };
  }),
}));
