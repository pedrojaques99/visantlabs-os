import { create } from 'zustand';
import type { BgRemovalMode, FocusRegion } from '@/utils/bgRemoval';

export type BgRemoveStatus = 'queued' | 'processing' | 'done' | 'error';

export interface BgRemoveItem {
  id: string;
  sourceUrl: string;
  fileName: string;
  resultBase64: string;
  status: BgRemoveStatus;
  error?: string;
  progressPhase?: string;
  progressValue?: number;
}

export interface BgRemoveState {
  items: BgRemoveItem[];
  mode: BgRemovalMode;
  threshold: number;
  feather: number;
  isProcessing: boolean;
  focusRegion: FocusRegion | null;

  addFiles: (files: { url: string; name: string }[]) => void;
  removeItem: (id: string) => void;
  updateItem: (id: string, patch: Partial<BgRemoveItem>) => void;
  setMode: (v: BgRemovalMode) => void;
  setThreshold: (v: number) => void;
  setFeather: (v: number) => void;
  setIsProcessing: (v: boolean) => void;
  setFocusRegion: (r: FocusRegion | null) => void;
  reset: () => void;
}

let counter = 0;

function requeueDone(items: BgRemoveItem[]): BgRemoveItem[] {
  return items.map((i) =>
    i.status === 'done' || i.status === 'error'
      ? { ...i, status: 'queued' as const, resultBase64: '', error: undefined, progressPhase: undefined, progressValue: undefined }
      : i,
  );
}

export const useBgRemoveStore = create<BgRemoveState>()((set) => ({
  items: [],
  mode: 'ai',
  threshold: 30,
  feather: 2,
  isProcessing: false,
  focusRegion: null,

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
  setMode: (v) => set((s) => ({ mode: v, items: requeueDone(s.items) })),
  setThreshold: (v) => set((s) => ({ threshold: v, items: requeueDone(s.items) })),
  setFeather: (v) => set((s) => ({ feather: v, items: requeueDone(s.items) })),
  setIsProcessing: (v) => set({ isProcessing: v }),
  setFocusRegion: (r) => set({ focusRegion: r }),
  reset: () =>
    set((s) => {
      s.items.forEach((item) => {
        if (item.sourceUrl?.startsWith('blob:')) URL.revokeObjectURL(item.sourceUrl);
      });
      return { items: [], mode: 'ai', threshold: 30, feather: 2, isProcessing: false, focusRegion: null };
    }),
}));
