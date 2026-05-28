import { create } from 'zustand';
import { createShaderSlice, type ShaderSlice } from './shaderSlice';
import { RISO_DEFAULTS, type RisoSettings, type InkLayer, type DitherMode, type HalftoneShape } from '@/components/riso/RisoRenderer';
import { hexToRgb } from '@/utils/colorUtils';

interface RisoState extends Omit<RisoSettings, 'layers' | 'soloLayer'> {
  layers: InkLayer[];
  imageUrl: string;
  fileName: string;
  panelVisible: boolean;
  activeTab: 'riso' | 'layers' | 'texture' | 'shader' | 'export';
  isExporting: boolean;
  isAnalyzing: boolean;

  zoom: number;
  panX: number;
  panY: number;
  soloLayer: number;

  settingsHistory: RisoSettings[];
  historyIndex: number;

  mediaType: 'image' | 'video';

  setImageUrl: (url: string, fileName: string, mediaType?: 'image' | 'video') => void;
  setPanelVisible: (v: boolean) => void;
  setActiveTab: (t: RisoState['activeTab']) => void;
  setIsExporting: (v: boolean) => void;
  setIsAnalyzing: (v: boolean) => void;
  setLayers: (layers: InkLayer[]) => void;
  updateLayer: (index: number, partial: Partial<InkLayer>) => void;
  updateSetting: <K extends keyof RisoSettings>(key: K, value: RisoSettings[K]) => void;
  resetSettings: () => void;
  getSettings: () => RisoSettings;

  setZoom: (z: number) => void;
  setPan: (x: number, y: number) => void;
  setSoloLayer: (i: number) => void;

  pushHistory: () => void;
  undo: () => void;
  redo: () => void;
}

const MAX_HISTORY = 30;

function snapshotSettings(s: RisoState): RisoSettings {
  return {
    layers: s.layers.map(l => ({ ...l })),
    frequency: s.frequency,
    dotSize: s.dotSize,
    contrast: s.contrast,
    lightness: s.lightness,
    paperColor: s.paperColor,
    paperNoise: s.paperNoise,
    inkNoise: s.inkNoise,
    inkDropout: s.inkDropout,
    misregistration: s.misregistration,
    edgeBleed: s.edgeBleed,
    colorCount: s.colorCount,
    ditherMode: s.ditherMode,
    halftoneShape: s.halftoneShape,
  };
}

function applySnapshot(snap: RisoSettings): Partial<RisoState> {
  return {
    layers: snap.layers.map(l => ({ ...l })),
    frequency: snap.frequency,
    dotSize: snap.dotSize,
    contrast: snap.contrast,
    lightness: snap.lightness,
    paperColor: snap.paperColor,
    paperNoise: snap.paperNoise,
    inkNoise: snap.inkNoise,
    inkDropout: snap.inkDropout,
    misregistration: snap.misregistration,
    edgeBleed: snap.edgeBleed,
    colorCount: snap.colorCount,
    ditherMode: snap.ditherMode,
    halftoneShape: snap.halftoneShape,
  };
}

export const useRisoStore = create<RisoState & ShaderSlice>()((set, get, api) => ({
  ...createShaderSlice(set as any, get as any, api as any),
  ...RISO_DEFAULTS,
  imageUrl: '',
  fileName: '',
  panelVisible: true,
  activeTab: 'riso',
  isExporting: false,
  isAnalyzing: false,

  zoom: 1,
  panX: 0,
  panY: 0,
  soloLayer: -1,

  settingsHistory: [],
  historyIndex: -1,

  mediaType: 'image' as const,

  setImageUrl: (imageUrl, fileName, mediaType) => set({ imageUrl, fileName, mediaType: mediaType || 'image' }),
  setPanelVisible: (panelVisible) => set({ panelVisible }),
  setActiveTab: (activeTab) => set({ activeTab }),
  setIsExporting: (isExporting) => set({ isExporting }),
  setIsAnalyzing: (isAnalyzing) => set({ isAnalyzing }),

  setLayers: (layers) => {
    get().pushHistory();
    set({ layers });
  },

  updateLayer: (index, partial) => {
    get().pushHistory();
    set((s) => {
      const layers = [...s.layers];
      if (partial.hex !== undefined) {
        partial.color = hexToRgb(partial.hex);
      }
      layers[index] = { ...layers[index], ...partial };
      return { layers };
    });
  },

  updateSetting: (key, value) => {
    get().pushHistory();
    set({ [key]: value } as any);
  },

  resetSettings: () => set({ ...RISO_DEFAULTS, settingsHistory: [], historyIndex: -1 }),

  getSettings: () => {
    const s = get();
    return {
      layers: s.layers,
      frequency: s.frequency,
      dotSize: s.dotSize,
      contrast: s.contrast,
      lightness: s.lightness,
      paperColor: s.paperColor,
      paperNoise: s.paperNoise,
      inkNoise: s.inkNoise,
      inkDropout: s.inkDropout,
      misregistration: s.misregistration,
      edgeBleed: s.edgeBleed,
      colorCount: s.colorCount,
      soloLayer: s.soloLayer,
      ditherMode: s.ditherMode,
      halftoneShape: s.halftoneShape,
    };
  },

  setZoom: (z) => set({ zoom: Math.max(0.1, Math.min(10, z)) }),
  setPan: (panX, panY) => set({ panX, panY }),
  setSoloLayer: (i) => set((s) => ({ soloLayer: s.soloLayer === i ? -1 : i })),

  pushHistory: () => set((s) => {
    const snap = snapshotSettings(s as any);
    const trimmed = s.settingsHistory.slice(0, s.historyIndex + 1);
    const history = [...trimmed, snap].slice(-MAX_HISTORY);
    return { settingsHistory: history, historyIndex: history.length - 1 };
  }),

  undo: () => set((s) => {
    if (s.historyIndex < 0) return {};
    const snap = s.settingsHistory[s.historyIndex];
    return { ...applySnapshot(snap), historyIndex: s.historyIndex - 1 };
  }),

  redo: () => set((s) => {
    if (s.historyIndex >= s.settingsHistory.length - 1) return {};
    const nextIndex = s.historyIndex + 1;
    const snap = s.settingsHistory[nextIndex];
    return { ...applySnapshot(snap), historyIndex: nextIndex };
  }),
}));
