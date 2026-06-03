import { create } from 'zustand';

export type UpscaleItemStatus = 'queued' | 'processing' | 'done' | 'error';

export interface UpscaleItem {
  id: string;
  sourceUrl: string;
  fileName: string;
  resultBase64: string;
  status: UpscaleItemStatus;
  error?: string;
}

export interface UpscaleState {
  items: UpscaleItem[];
  scaleFactor: number;
  sharpening: number;
  isProcessing: boolean;

  addFiles: (files: { url: string; name: string }[]) => void;
  removeItem: (id: string) => void;
  updateItem: (id: string, patch: Partial<UpscaleItem>) => void;
  setScaleFactor: (v: number) => void;
  setSharpening: (v: number) => void;
  setIsProcessing: (v: boolean) => void;
  reset: () => void;
}

let counter = 0;

export const useUpscaleStore = create<UpscaleState>()((set) => ({
  items: [],
  scaleFactor: 2,
  sharpening: 0.3,
  isProcessing: false,

  addFiles: (files) =>
    set((s) => ({
      items: [
        ...s.items,
        ...files.map((f) => ({
          id: `up-${++counter}`,
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
  setScaleFactor: (v) =>
    set((s) => ({
      scaleFactor: v,
      items: s.items.map((i) =>
        i.status === 'done' || i.status === 'error'
          ? { ...i, status: 'queued' as const, resultBase64: '', error: undefined }
          : i
      ),
    })),
  setSharpening: (v) => set({ sharpening: v }),
  setIsProcessing: (v) => set({ isProcessing: v }),
  reset: () =>
    set((s) => {
      s.items.forEach((item) => {
        if (item.sourceUrl?.startsWith('blob:')) URL.revokeObjectURL(item.sourceUrl);
      });
      return { items: [], scaleFactor: 2, sharpening: 0.3, isProcessing: false };
    }),
}));
