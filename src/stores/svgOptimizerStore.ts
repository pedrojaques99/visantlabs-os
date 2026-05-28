import { create } from 'zustand';
import { optimizeSvg, type SvgOptimizeOptions } from '@/utils/svgOptimizer';

export interface SvgItem {
  id: string;
  fileName: string;
  originalSvg: string;
  optimizedSvg: string;
  originalSize: number;
  optimizedSize: number;
  savings: number;
}

export interface SvgOptimizerState {
  items: SvgItem[];
  options: SvgOptimizeOptions;
  showCode: boolean;
  selectedId: string | null;

  addFiles: (files: { name: string; content: string }[]) => void;
  removeItem: (id: string) => void;
  setOption: <K extends keyof SvgOptimizeOptions>(key: K, value: SvgOptimizeOptions[K]) => void;
  reoptimizeAll: () => void;
  setShowCode: (v: boolean) => void;
  setSelectedId: (id: string | null) => void;
  reset: () => void;
}

let counter = 0;

function buildItem(name: string, content: string, options: SvgOptimizeOptions): SvgItem {
  const result = optimizeSvg(content, options);
  return {
    id: `svg-${++counter}`,
    fileName: name,
    originalSvg: content,
    optimizedSvg: result.optimized,
    originalSize: result.originalSize,
    optimizedSize: result.optimizedSize,
    savings: result.savings,
  };
}

const DEFAULT_OPTIONS: SvgOptimizeOptions = {
  removeComments: true,
  removeMetadata: true,
  removeEditorData: true,
  removeEmptyGroups: true,
  minifyPaths: true,
  removeHiddenElements: true,
  prettify: false,
};

export const useSvgOptimizerStore = create<SvgOptimizerState>()((set, get) => ({
  items: [],
  options: { ...DEFAULT_OPTIONS },
  showCode: false,
  selectedId: null,

  addFiles: (files) =>
    set((s) => {
      const newItems = files.map((f) => buildItem(f.name, f.content, s.options));
      const allItems = [...s.items, ...newItems];
      return {
        items: allItems,
        selectedId: s.selectedId || newItems[0]?.id || null,
      };
    }),

  removeItem: (id) =>
    set((s) => {
      const items = s.items.filter((i) => i.id !== id);
      return {
        items,
        selectedId: s.selectedId === id ? (items[0]?.id || null) : s.selectedId,
      };
    }),

  setOption: (key, value) => {
    set((s) => ({ options: { ...s.options, [key]: value } }));
    get().reoptimizeAll();
  },

  reoptimizeAll: () =>
    set((s) => ({
      items: s.items.map((item) => {
        const result = optimizeSvg(item.originalSvg, s.options);
        return {
          ...item,
          optimizedSvg: result.optimized,
          optimizedSize: result.optimizedSize,
          savings: result.savings,
        };
      }),
    })),

  setShowCode: (v) => set({ showCode: v }),
  setSelectedId: (id) => set({ selectedId: id }),
  reset: () => set({ items: [], options: { ...DEFAULT_OPTIONS }, showCode: false, selectedId: null }),
}));
