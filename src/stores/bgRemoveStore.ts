import { create } from 'zustand';

export type BgRemoveStatus = 'queued' | 'processing' | 'done' | 'error';

export interface BgRemoveItem {
  id: string;
  sourceUrl: string;
  fileName: string;
  resultBase64: string;
  status: BgRemoveStatus;
  error?: string;
}

export interface BgRemoveState {
  items: BgRemoveItem[];
  threshold: number; // 0-100, default 30
  feather: number; // 0-10, default 2
  isProcessing: boolean;

  addFiles: (files: { url: string; name: string }[]) => void;
  removeItem: (id: string) => void;
  updateItem: (id: string, patch: Partial<BgRemoveItem>) => void;
  setThreshold: (v: number) => void;
  setFeather: (v: number) => void;
  setIsProcessing: (v: boolean) => void;
  reset: () => void;
}

let counter = 0;

export const useBgRemoveStore = create<BgRemoveState>()((set) => ({
  items: [],
  threshold: 30,
  feather: 2,
  isProcessing: false,

  addFiles: (files) =>
    set((s) => ({
      items: [
        ...s.items,
        ...files.map((f) => ({
          id: `bgr-${++counter}`,
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
  setThreshold: (v) =>
    set((s) => ({
      threshold: v,
      items: s.items.map((i) =>
        i.status === 'done' || i.status === 'error'
          ? { ...i, status: 'queued' as const, resultBase64: '', error: undefined }
          : i,
      ),
    })),
  setFeather: (v) =>
    set((s) => ({
      feather: v,
      items: s.items.map((i) =>
        i.status === 'done' || i.status === 'error'
          ? { ...i, status: 'queued' as const, resultBase64: '', error: undefined }
          : i,
      ),
    })),
  setIsProcessing: (v) => set({ isProcessing: v }),
  reset: () =>
    set((s) => {
      s.items.forEach((item) => {
        if (item.sourceUrl?.startsWith('blob:')) URL.revokeObjectURL(item.sourceUrl);
      });
      return { items: [], threshold: 30, feather: 2, isProcessing: false };
    }),
}));
