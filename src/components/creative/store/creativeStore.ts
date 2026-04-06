import { create } from 'zustand';
import type {
  CreativeFormat,
  CreativeLayer,
  CreativeLayerData,
  CreativeOverlay,
  CreativeStatus,
} from './creativeTypes';
import type { GeminiModel, SeedreamModel, ImageProvider, Resolution } from '@/types/types';
import { GEMINI_MODELS } from '@/constants/geminiModels';

interface CreativeStore {
  // Setup
  brandId: string | null;
  prompt: string;
  format: CreativeFormat;
  backgroundMode: 'ai' | 'upload';
  uploadedBackgroundUrl: string | null;
  modelId: GeminiModel | SeedreamModel | string;
  provider: ImageProvider;
  resolution: Resolution;

  // Editor
  status: CreativeStatus;
  backgroundUrl: string | null;
  overlay: CreativeOverlay | null;
  layers: CreativeLayer[];
  selectedLayerId: string | null;

  // Setup actions
  setBrandId: (id: string | null) => void;
  setPrompt: (p: string) => void;
  setFormat: (f: CreativeFormat) => void;
  setBackgroundMode: (m: 'ai' | 'upload') => void;
  setUploadedBackgroundUrl: (url: string | null) => void;
  setModel: (modelId: GeminiModel | SeedreamModel, provider: ImageProvider) => void;
  setResolution: (r: Resolution) => void;

  // Editor actions
  setStatus: (s: CreativeStatus) => void;
  hydrateFromAI: (payload: {
    backgroundUrl: string;
    overlay: CreativeOverlay | null;
    layers: CreativeLayerData[];
  }) => void;
  selectLayer: (id: string | null) => void;
  updateLayer: (id: string, updates: Partial<CreativeLayerData>) => void;
  updateLayerMeta: (id: string, updates: Partial<Pick<CreativeLayer, 'visible' | 'zIndex'>>) => void;
  addLayer: (data: CreativeLayerData) => void;
  removeLayer: (id: string) => void;
  reset: () => void;
}

let layerCounter = 0;
const nextLayerId = () => `layer_${Date.now()}_${++layerCounter}`;

export const useCreativeStore = create<CreativeStore>((set) => ({
  brandId: null,
  prompt: '',
  format: '1:1',
  backgroundMode: 'ai',
  uploadedBackgroundUrl: null,
  modelId: GEMINI_MODELS.NB2,
  provider: 'gemini',
  resolution: '2K',

  status: 'setup',
  backgroundUrl: null,
  overlay: null,
  layers: [],
  selectedLayerId: null,

  setBrandId: (brandId) => set({ brandId }),
  setPrompt: (prompt) => set({ prompt }),
  setFormat: (format) => set({ format }),
  setBackgroundMode: (backgroundMode) => set({ backgroundMode }),
  setUploadedBackgroundUrl: (uploadedBackgroundUrl) => set({ uploadedBackgroundUrl }),
  setModel: (modelId, provider) => set({ modelId, provider }),
  setResolution: (resolution) => set({ resolution }),

  setStatus: (status) => set({ status }),

  hydrateFromAI: ({ backgroundUrl, overlay, layers }) =>
    set({
      backgroundUrl,
      overlay,
      layers: layers.map((data, i) => ({
        id: nextLayerId(),
        visible: true,
        zIndex: i + 1,
        data,
      })),
      status: 'editing',
      selectedLayerId: null,
    }),

  selectLayer: (selectedLayerId) => set({ selectedLayerId }),

  updateLayer: (id, updates) =>
    set((state) => ({
      layers: state.layers.map((l) =>
        l.id === id ? { ...l, data: { ...l.data, ...updates } as CreativeLayerData } : l
      ),
    })),

  updateLayerMeta: (id, updates) =>
    set((state) => ({
      layers: state.layers.map((l) => (l.id === id ? { ...l, ...updates } : l)),
    })),

  addLayer: (data) =>
    set((state) => ({
      layers: [
        ...state.layers,
        {
          id: nextLayerId(),
          visible: true,
          zIndex: state.layers.length + 1,
          data,
        },
      ],
    })),

  removeLayer: (id) =>
    set((state) => ({
      layers: state.layers.filter((l) => l.id !== id),
      selectedLayerId: state.selectedLayerId === id ? null : state.selectedLayerId,
    })),

  reset: () =>
    set({
      brandId: null,
      prompt: '',
      format: '1:1',
      backgroundMode: 'ai',
      uploadedBackgroundUrl: null,
      modelId: GEMINI_MODELS.NB2,
      provider: 'gemini',
      resolution: '2K',
      status: 'setup',
      backgroundUrl: null,
      overlay: null,
      layers: [],
      selectedLayerId: null,
    }),
}));
