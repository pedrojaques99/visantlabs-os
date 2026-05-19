import { create } from 'zustand';
import { createShaderSlice, type ShaderSlice } from './shaderSlice';
import { RISO_DEFAULTS, type RisoSettings, type InkLayer } from '@/components/riso/RisoRenderer';

interface RisoState extends Omit<RisoSettings, 'layers'> {
  layers: InkLayer[];
  imageUrl: string;
  fileName: string;
  panelVisible: boolean;
  activeTab: 'riso' | 'layers' | 'texture' | 'shader' | 'export';
  isExporting: boolean;
  isAnalyzing: boolean;

  setImageUrl: (url: string, fileName: string) => void;
  setPanelVisible: (v: boolean) => void;
  setActiveTab: (t: RisoState['activeTab']) => void;
  setIsExporting: (v: boolean) => void;
  setIsAnalyzing: (v: boolean) => void;
  setLayers: (layers: InkLayer[]) => void;
  updateLayer: (index: number, partial: Partial<InkLayer>) => void;
  updateSetting: <K extends keyof RisoSettings>(key: K, value: RisoSettings[K]) => void;
  resetSettings: () => void;
  getSettings: () => RisoSettings;
}

function hexToRgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
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

  setImageUrl: (imageUrl, fileName) => set({ imageUrl, fileName }),
  setPanelVisible: (panelVisible) => set({ panelVisible }),
  setActiveTab: (activeTab) => set({ activeTab }),
  setIsExporting: (isExporting) => set({ isExporting }),
  setIsAnalyzing: (isAnalyzing) => set({ isAnalyzing }),

  setLayers: (layers) => set({ layers }),

  updateLayer: (index, partial) => set((s) => {
    const layers = [...s.layers];
    if (partial.hex !== undefined) {
      partial.color = hexToRgb(partial.hex);
    }
    layers[index] = { ...layers[index], ...partial };
    return { layers };
  }),

  updateSetting: (key, value) => set({ [key]: value } as any),

  resetSettings: () => set({ ...RISO_DEFAULTS }),

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
    };
  },
}));
