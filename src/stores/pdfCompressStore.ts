import { create } from 'zustand';

export type PdfItemStatus = 'queued' | 'processing' | 'done' | 'error';

export interface PdfItem {
  id: string;
  sourceUrl: string;
  fileName: string;
  originalSize: number;
  compressedSize: number;
  resultBase64: string;
  status: PdfItemStatus;
  error?: string;
}

export interface PdfCompressState {
  items: PdfItem[];
  preset: 'screen' | 'ebook' | 'printer' | 'prepress';
  isProcessing: boolean;

  addFiles: (files: { url: string; name: string; size: number }[]) => void;
  removeItem: (id: string) => void;
  updateItem: (id: string, patch: Partial<PdfItem>) => void;
  setPreset: (v: 'screen' | 'ebook' | 'printer' | 'prepress') => void;
  setIsProcessing: (v: boolean) => void;
  reset: () => void;
}

let counter = 0;

export const usePdfCompressStore = create<PdfCompressState>()((set) => ({
  items: [],
  preset: 'ebook',
  isProcessing: false,

  addFiles: (files) =>
    set((s) => ({
      items: [
        ...s.items,
        ...files.map((f) => ({
          id: `pdf-${++counter}`,
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

  setPreset: (preset) => set({ preset }),
  setIsProcessing: (isProcessing) => set({ isProcessing }),

  reset: () => {
    set((s) => {
      s.items.forEach((i) => {
        if (i.sourceUrl?.startsWith('blob:')) URL.revokeObjectURL(i.sourceUrl);
      });
      return { items: [], isProcessing: false };
    });
  },
}));
