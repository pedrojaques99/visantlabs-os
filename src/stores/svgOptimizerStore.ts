import { create } from 'zustand';
import { optimizeSvg, type SvgOptimizeOptions } from '@/utils/svgOptimizer';
import { tracePng, type TraceOptions, DEFAULT_TRACE_OPTIONS } from '@/services/svgPipeline';

export type ItemSource = 'svg' | 'png';
export type ItemStatus = 'idle' | 'tracing' | 'optimizing' | 'done' | 'error';

export interface SvgItem {
  id: string;
  fileName: string;
  source: ItemSource;
  originalFile?: File;
  originalSvg: string;
  optimizedSvg: string;
  originalSize: number;
  optimizedSize: number;
  savings: number;
  status: ItemStatus;
  error?: string;
  traceOptions: TraceOptions;
}

export interface SvgOptimizerState {
  items: SvgItem[];
  options: SvgOptimizeOptions;
  viewMode: 'preview' | 'edit' | 'code';
  selectedId: string | null;

  addSvgFiles: (files: { name: string; content: string }[]) => void;
  addPngFiles: (files: File[]) => void;
  retraceItem: (id: string, newOpts?: Partial<TraceOptions>) => void;
  updateItemSvg: (id: string, newSvg: string) => void;
  removeItem: (id: string) => void;
  setOption: <K extends keyof SvgOptimizeOptions>(key: K, value: SvgOptimizeOptions[K]) => void;
  reoptimizeAll: () => void;
  setViewMode: (v: 'preview' | 'edit' | 'code') => void;
  setSelectedId: (id: string | null) => void;
  reset: () => void;
}

let counter = 0;

function buildSvgItem(name: string, content: string, options: SvgOptimizeOptions): SvgItem {
  const result = optimizeSvg(content, options);
  return {
    id: `svg-${++counter}`,
    fileName: name,
    source: 'svg',
    originalSvg: content,
    optimizedSvg: result.optimized,
    originalSize: result.originalSize,
    optimizedSize: result.optimizedSize,
    savings: result.savings,
    status: 'done',
    traceOptions: { ...DEFAULT_TRACE_OPTIONS },
  };
}

function buildPngPlaceholder(file: File): SvgItem {
  return {
    id: `svg-${++counter}`,
    fileName: file.name,
    source: 'png',
    originalFile: file,
    originalSvg: '',
    optimizedSvg: '',
    originalSize: file.size,
    optimizedSize: 0,
    savings: 0,
    status: 'tracing',
    traceOptions: { ...DEFAULT_TRACE_OPTIONS },
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
  viewMode: 'preview',
  selectedId: null,

  addSvgFiles: (files) =>
    set((s) => {
      const newItems = files.map((f) => buildSvgItem(f.name, f.content, s.options));
      const allItems = [...s.items, ...newItems];
      return {
        items: allItems,
        selectedId: s.selectedId || newItems[0]?.id || null,
      };
    }),

  addPngFiles: (files) => {
    const placeholders = files.map((f) => buildPngPlaceholder(f));

    set((s) => ({
      items: [...s.items, ...placeholders],
      selectedId: s.selectedId || placeholders[0]?.id || null,
    }));

    for (const placeholder of placeholders) {
      const file = placeholder.originalFile!;
      const itemId = placeholder.id;
      tracePng(file, placeholder.traceOptions)
        .then((rawSvg) => {
          const current = get();
          if (!current.items.some(i => i.id === itemId)) return;
          const result = optimizeSvg(rawSvg, current.options);
          set((s) => ({
            items: s.items.map((item) =>
              item.id === itemId
                ? {
                    ...item,
                    originalSvg: rawSvg,
                    optimizedSvg: result.optimized,
                    optimizedSize: result.optimizedSize,
                    savings: result.savings,
                    status: 'done' as const,
                  }
                : item,
            ),
          }));
        })
        .catch((err) => {
          set((s) => ({
            items: s.items.map((item) =>
              item.id === itemId
                ? { ...item, status: 'error' as const, error: err.message }
                : item,
            ),
          }));
        });
    }
  },

  retraceItem: (id, newOpts) => {
    const item = get().items.find((i) => i.id === id);
    if (!item || item.source !== 'png' || !item.originalFile) return;

    const mergedOpts = { ...item.traceOptions, ...newOpts };

    set((s) => ({
      items: s.items.map((i) =>
        i.id === id ? { ...i, status: 'tracing' as const, traceOptions: mergedOpts, error: undefined } : i,
      ),
    }));

    tracePng(item.originalFile, mergedOpts)
      .then((rawSvg) => {
        const current = get();
        if (!current.items.some(i => i.id === id)) return;
        const result = optimizeSvg(rawSvg, current.options);
        set((s) => ({
          items: s.items.map((i) =>
            i.id === id
              ? {
                  ...i,
                  originalSvg: rawSvg,
                  optimizedSvg: result.optimized,
                  optimizedSize: result.optimizedSize,
                  savings: result.savings,
                  status: 'done' as const,
                }
              : i,
          ),
        }));
      })
      .catch((err) => {
        if (!get().items.some(i => i.id === id)) return;
        set((s) => ({
          items: s.items.map((i) =>
            i.id === id ? { ...i, status: 'error' as const, error: err.message } : i,
          ),
        }));
      });
  },

  removeItem: (id) =>
    set((s) => {
      const items = s.items.filter((i) => i.id !== id);
      return {
        items,
        selectedId: s.selectedId === id ? items[0]?.id || null : s.selectedId,
      };
    }),

  setOption: (key, value) => {
    set((s) => ({ options: { ...s.options, [key]: value } }));
    get().reoptimizeAll();
  },

  reoptimizeAll: () =>
    set((s) => ({
      items: s.items.map((item) => {
        if (item.status !== 'done' || !item.originalSvg) return item;
        const result = optimizeSvg(item.originalSvg, s.options);
        return {
          ...item,
          optimizedSvg: result.optimized,
          optimizedSize: result.optimizedSize,
          savings: result.savings,
        };
      }),
    })),

  updateItemSvg: (id, newSvg) =>
    set((s) => {
      const result = optimizeSvg(newSvg, s.options);
      return {
        items: s.items.map((item) => {
          if (item.id !== id) return item;
          const svgSize = new Blob([newSvg]).size;
          return {
            ...item,
            originalSvg: newSvg,
            optimizedSvg: result.optimized,
            originalSize: item.source === 'png' ? item.originalSize : svgSize,
            optimizedSize: result.optimizedSize,
            savings: item.source === 'png'
              ? (item.originalSize > 0 ? Math.round((1 - result.optimizedSize / item.originalSize) * 100) : 0)
              : result.savings,
          };
        }),
      };
    }),

  setViewMode: (v) => set({ viewMode: v }),
  setSelectedId: (id) => set({ selectedId: id }),
  reset: () => set({ items: [], options: { ...DEFAULT_OPTIONS }, viewMode: 'preview', selectedId: null }),
}));

// Backward compat alias
export const addFiles = (files: { name: string; content: string }[]) =>
  useSvgOptimizerStore.getState().addSvgFiles(files);
