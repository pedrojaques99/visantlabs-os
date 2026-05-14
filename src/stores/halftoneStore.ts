import { create } from 'zustand';
import { HALFTONE_DEFAULTS, type HalftoneSettings } from '@/components/halftone/HalftoneRenderer';

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

interface HalftoneState extends HalftoneSettings {
  imageUrl: string;
  fileName: string;
  panelVisible: boolean;
  activeTab: 'halftone' | 'color' | 'channels' | 'export';
  isExporting: boolean;

  setImageUrl: (url: string, fileName: string) => void;
  setPanelVisible: (v: boolean) => void;
  setActiveTab: (t: HalftoneState['activeTab']) => void;
  setIsExporting: (v: boolean) => void;
  updateSetting: <K extends keyof HalftoneSettings>(key: K, value: HalftoneSettings[K]) => void;
  applyPreset: (name: string) => void;
  resetSettings: () => void;
  getSettings: () => HalftoneSettings;
}

export const useHalftoneStore = create<HalftoneState>((set, get) => ({
  ...HALFTONE_DEFAULTS,
  imageUrl: '',
  fileName: '',
  panelVisible: true,
  activeTab: 'halftone',
  isExporting: false,

  setImageUrl: (imageUrl, fileName) => set({ imageUrl, fileName }),
  setPanelVisible: (panelVisible) => set({ panelVisible }),
  setActiveTab: (activeTab) => set({ activeTab }),
  setIsExporting: (isExporting) => set({ isExporting }),

  updateSetting: (key, value) => set({ [key]: value }),

  applyPreset: (name) => {
    const preset = HALFTONE_PRESETS[name];
    if (preset) set({ ...HALFTONE_DEFAULTS, ...preset });
  },

  resetSettings: () => set({ ...HALFTONE_DEFAULTS }),

  getSettings: () => {
    const state = get();
    const settings: HalftoneSettings = { ...HALFTONE_DEFAULTS };
    for (const key of Object.keys(HALFTONE_DEFAULTS) as (keyof HalftoneSettings)[]) {
      (settings as any)[key] = state[key];
    }
    return settings;
  },
}));
