import { create } from 'zustand';

export type CompressItemStatus = 'queued' | 'processing' | 'done' | 'error';

export interface CompressItem {
  id: string;
  sourceUrl: string;
  fileName: string;
  originalSize: number;
  compressedSize: number;
  resultBase64: string;
  status: CompressItemStatus;
  error?: string;
}

export interface CompressState {
  items: CompressItem[];
  quality: number;
  maxDimension: number;
  outputFormat: 'jpeg' | 'png' | 'webp';
  isProcessing: boolean;

  addFiles: (files: { url: string; name: string; size: number }[]) => void;
  removeItem: (id: string) => void;
  updateItem: (id: string, patch: Partial<CompressItem>) => void;
  setQuality: (v: number) => void;
  setMaxDimension: (v: number) => void;
  setOutputFormat: (v: 'jpeg' | 'png' | 'webp') => void;
  setIsProcessing: (v: boolean) => void;
  reset: () => void;
}

let counter = 0;

export const useCompressStore = create<CompressState>()((set) => ({
  items: [],
  quality: 80,
  maxDimension: 2048,
  outputFormat: 'jpeg',
  isProcessing: false,

  addFiles: (files) =>
    set((s) => ({
      items: [
        ...s.items,
        ...files.map((f) => ({
          id: `comp-${++counter}`,
          sourceUrl: f.url,
          fileName: f.name,
          originalSize: f.size,
          compressedSize: 0,
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
  setQuality: (v) =>
    set((s) => ({
      quality: v,
      items: s.items.map((i) =>
        i.status === 'done' || i.status === 'error'
          ? {
              ...i,
              status: 'queued' as const,
              resultBase64: '',
              compressedSize: 0,
              error: undefined,
            }
          : i
      ),
    })),
  setMaxDimension: (v) =>
    set((s) => ({
      maxDimension: v,
      items: s.items.map((i) =>
        i.status === 'done' || i.status === 'error'
          ? {
              ...i,
              status: 'queued' as const,
              resultBase64: '',
              compressedSize: 0,
              error: undefined,
            }
          : i
      ),
    })),
  setOutputFormat: (v) =>
    set((s) => ({
      outputFormat: v,
      items: s.items.map((i) =>
        i.status === 'done' || i.status === 'error'
          ? {
              ...i,
              status: 'queued' as const,
              resultBase64: '',
              compressedSize: 0,
              error: undefined,
            }
          : i
      ),
    })),
  setIsProcessing: (v) => set({ isProcessing: v }),
  reset: () =>
    set((s) => {
      s.items.forEach((item) => {
        if (item.sourceUrl?.startsWith('blob:')) URL.revokeObjectURL(item.sourceUrl);
      });
      return {
        items: [],
        quality: 80,
        maxDimension: 2048,
        outputFormat: 'jpeg',
        isProcessing: false,
      };
    }),
}));
