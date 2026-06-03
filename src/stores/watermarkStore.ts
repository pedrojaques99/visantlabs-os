import { create } from 'zustand';

export type WatermarkType = 'text' | 'logo';
export type WatermarkPosition =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'center-left'
  | 'center'
  | 'center-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right'
  | 'tile';
export type WmItemStatus = 'queued' | 'processing' | 'done' | 'error';

export interface WatermarkItem {
  id: string;
  sourceUrl: string;
  fileName: string;
  resultBase64: string;
  status: WmItemStatus;
  error?: string;
}

export interface WatermarkState {
  items: WatermarkItem[];
  watermarkType: WatermarkType;
  text: string;
  logoUrl: string;
  position: WatermarkPosition;
  opacity: number;
  scale: number;
  rotation: number;
  color: string;
  isProcessing: boolean;

  addFiles: (files: { url: string; name: string }[]) => void;
  removeItem: (id: string) => void;
  updateItem: (id: string, patch: Partial<WatermarkItem>) => void;
  setWatermarkType: (v: WatermarkType) => void;
  setText: (v: string) => void;
  setLogoUrl: (v: string) => void;
  setPosition: (v: WatermarkPosition) => void;
  setOpacity: (v: number) => void;
  setScale: (v: number) => void;
  setRotation: (v: number) => void;
  setColor: (v: string) => void;
  setIsProcessing: (v: boolean) => void;
  reset: () => void;
}

let counter = 0;

export const useWatermarkStore = create<WatermarkState>()((set) => ({
  items: [],
  watermarkType: 'text',
  text: 'VISANT',
  logoUrl: '',
  position: 'bottom-right',
  opacity: 0.3,
  scale: 30,
  rotation: 0,
  color: '#ffffff',
  isProcessing: false,

  addFiles: (files) =>
    set((s) => ({
      items: [
        ...s.items,
        ...files.map((f) => ({
          id: `wm-${++counter}`,
          sourceUrl: f.url,
          fileName: f.name,
          resultBase64: '',
          status: 'queued' as const,
        })),
      ],
    })),
  removeItem: (id) =>
    set((s) => {
      const item = s.items.find((i) => i.id === id);
      if (item?.sourceUrl?.startsWith('blob:')) URL.revokeObjectURL(item.sourceUrl);
      return { items: s.items.filter((i) => i.id !== id) };
    }),
  updateItem: (id, patch) =>
    set((s) => ({
      items: s.items.map((i) => (i.id === id ? { ...i, ...patch } : i)),
    })),
  setWatermarkType: (v) => set({ watermarkType: v }),
  setText: (v) => set({ text: v }),
  setLogoUrl: (v) => set({ logoUrl: v }),
  setPosition: (v) => set({ position: v }),
  setOpacity: (v) => set({ opacity: v }),
  setScale: (v) => set({ scale: v }),
  setRotation: (v) => set({ rotation: v }),
  setColor: (v) => set({ color: v }),
  setIsProcessing: (v) => set({ isProcessing: v }),
  reset: () =>
    set((s) => {
      s.items.forEach((item) => {
        if (item.sourceUrl?.startsWith('blob:')) URL.revokeObjectURL(item.sourceUrl);
      });
      return {
        items: [],
        watermarkType: 'text',
        text: 'VISANT',
        logoUrl: '',
        position: 'bottom-right',
        opacity: 0.3,
        scale: 30,
        rotation: 0,
        color: '#ffffff',
        isProcessing: false,
      };
    }),
}));
