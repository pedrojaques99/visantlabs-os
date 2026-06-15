import { create } from 'zustand';
import { createShaderSlice, type ShaderSlice } from './shaderSlice';
import { getProceduralTexture } from '@/utils/proceduralTextures';
import { TEXTURE_PRESETS_DATA } from '../../shared/imagelab/presets';

export type TextureBlendMode =
  | 'multiply'
  | 'screen'
  | 'overlay'
  | 'soft-light'
  | 'hard-light'
  | 'color-burn'
  | 'color-dodge';

export const BLEND_MODES: { id: TextureBlendMode; label: string }[] = [
  { id: 'multiply', label: 'Multiply' },
  { id: 'screen', label: 'Screen' },
  { id: 'overlay', label: 'Overlay' },
  { id: 'soft-light', label: 'Soft Light' },
  { id: 'hard-light', label: 'Hard Light' },
  { id: 'color-burn', label: 'Color Burn' },
  { id: 'color-dodge', label: 'Color Dodge' },
];

export interface TexturePreset {
  name: string;
  src: string;
  thumbnail?: string;
}

export const TEXTURE_PRESETS: TexturePreset[] = [
  { name: 'Visant Grid', src: '/textures/visant-grid.svg' },
  { name: 'Film Grain', src: '__procedural__' },
  { name: 'Paper', src: '__procedural__' },
  { name: 'Canvas Weave', src: '__procedural__' },
  { name: 'Dust & Scratches', src: '__procedural__' },
  { name: 'Concrete', src: '__procedural__' },
  { name: 'Diagonal Lines', src: '__procedural__' },
  { name: 'Crosshatch', src: '__procedural__' },
  { name: 'Soft Noise', src: '__procedural__' },
  { name: 'Halftone Dots', src: '__procedural__' },
];

// Single source of truth: shared/imagelab/presets.ts (also consumed server-side).
export const FILTER_PRESETS: Record<
  string,
  Partial<TextureFilterSettings>
> = TEXTURE_PRESETS_DATA as Record<string, Partial<TextureFilterSettings>>;

export interface TextureFilterSettings {
  opacity: number;
  scale: number;
  blendMode: TextureBlendMode;
  textureColor: string;
  useOriginalColor: boolean;
  rotation: number;
  offsetX: number;
  offsetY: number;
  tileMode: boolean;
  tileGapX: number;
  tileGapY: number;
  maskMode: boolean;
  maskInvert: boolean;
}

export const TEXTURE_FILTER_DEFAULTS: TextureFilterSettings = {
  opacity: 0.6,
  scale: 1.0,
  blendMode: 'multiply',
  textureColor: '#FF6038',
  useOriginalColor: true,
  rotation: 0,
  offsetX: 0,
  offsetY: 0,
  tileMode: true,
  tileGapX: 0,
  tileGapY: 0,
  maskMode: false,
  maskInvert: false,
};

const MAX_HISTORY = 30;
const HISTORY_DEBOUNCE_MS = 400;

function snapshotSettings(s: TextureFilterSettings): TextureFilterSettings {
  return { ...s };
}

interface TextureFilterState extends TextureFilterSettings {
  imageUrl: string;
  fileName: string;
  textureSrc: string;
  textureName: string;
  panelVisible: boolean;
  isExporting: boolean;
  mediaType: 'image' | 'video';

  zoom: number;
  panX: number;
  panY: number;

  settingsHistory: TextureFilterSettings[];
  historyIndex: number;

  setImageUrl: (url: string, fileName: string, type?: 'image' | 'video') => void;
  setTexture: (src: string, name: string) => void;
  setPanelVisible: (v: boolean) => void;
  setIsExporting: (v: boolean) => void;
  updateSetting: <K extends keyof TextureFilterSettings>(
    key: K,
    value: TextureFilterSettings[K]
  ) => void;
  applyPreset: (preset: TexturePreset) => void;
  resetSettings: () => void;
  getSettings: () => TextureFilterSettings;

  setZoom: (z: number) => void;
  setPan: (x: number, y: number) => void;

  pushHistory: () => void;
  debouncedPushHistory: () => void;
  undo: () => void;
  redo: () => void;
}

let _tfPendingSnap: TextureFilterSettings | null = null;
let _tfDebounceTimer: ReturnType<typeof setTimeout> | undefined;

export const useTextureFilterStore = create<TextureFilterState & ShaderSlice>()(
  (set, get, api) => ({
    ...createShaderSlice(set as any, get as any, api as any),
    ...TEXTURE_FILTER_DEFAULTS,
    imageUrl: '',
    fileName: '',
    textureSrc: TEXTURE_PRESETS[0].src,
    textureName: TEXTURE_PRESETS[0].name,
    panelVisible: true,
    isExporting: false,
    mediaType: 'image',

    zoom: 1,
    panX: 0,
    panY: 0,

    settingsHistory: [],
    historyIndex: -1,

    setImageUrl: (imageUrl, fileName, type) =>
      set({ imageUrl, fileName, mediaType: type || 'image' }),
    setTexture: (textureSrc, textureName) => set({ textureSrc, textureName }),
    setPanelVisible: (panelVisible) => set({ panelVisible }),
    setIsExporting: (isExporting) => set({ isExporting }),

    updateSetting: (key, value) => {
      get().debouncedPushHistory();
      set({ [key]: value });
    },

    applyPreset: (preset) => {
      const src =
        preset.src === '__procedural__'
          ? getProceduralTexture(preset.name) || preset.src
          : preset.src;
      set({ textureSrc: src, textureName: preset.name });
    },

    resetSettings: () => set({ ...TEXTURE_FILTER_DEFAULTS, settingsHistory: [], historyIndex: -1 }),

    getSettings: () => {
      const state = get();
      const settings: TextureFilterSettings = { ...TEXTURE_FILTER_DEFAULTS };
      for (const key of Object.keys(TEXTURE_FILTER_DEFAULTS) as (keyof TextureFilterSettings)[]) {
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
      if (!_tfPendingSnap) {
        _tfPendingSnap = snapshotSettings(get().getSettings());
      }
      clearTimeout(_tfDebounceTimer);
      _tfDebounceTimer = setTimeout(() => {
        if (_tfPendingSnap) {
          set((s) => {
            const trimmed = s.settingsHistory.slice(0, s.historyIndex + 1);
            const history = [...trimmed, _tfPendingSnap!].slice(-MAX_HISTORY);
            _tfPendingSnap = null;
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
  })
);
