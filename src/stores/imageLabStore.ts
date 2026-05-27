import { create } from 'zustand';

export type ImageLabMode = 'halftone' | 'texture' | 'riso';

export type CompareMode = 'off' | 'toggle' | 'split';

interface ImageLabState {
  mode: ImageLabMode;
  sourceUrl: string;
  sourceFileName: string;
  sourceMediaType: 'image' | 'video';

  compareMode: CompareMode;
  showOriginal: boolean;
  splitPosition: number;

  exportModalOpen: boolean;

  setMode: (mode: ImageLabMode) => void;
  setSource: (url: string, fileName: string, mediaType?: 'image' | 'video') => void;
  clearSource: () => void;

  setCompareMode: (mode: CompareMode) => void;
  setShowOriginal: (show: boolean) => void;
  setSplitPosition: (pos: number) => void;

  setExportModalOpen: (open: boolean) => void;
}

export const useImageLabStore = create<ImageLabState>()((set) => ({
  mode: 'halftone',
  sourceUrl: '',
  sourceFileName: '',
  sourceMediaType: 'image',

  compareMode: 'off',
  showOriginal: false,
  splitPosition: 50,

  exportModalOpen: false,

  setMode: (mode) => set({ mode }),
  setSource: (sourceUrl, sourceFileName, sourceMediaType = 'image') =>
    set({ sourceUrl, sourceFileName, sourceMediaType }),
  clearSource: () => set({ sourceUrl: '', sourceFileName: '', sourceMediaType: 'image' }),

  setCompareMode: (compareMode) => set({ compareMode, showOriginal: false }),
  setShowOriginal: (showOriginal) => set({ showOriginal }),
  setSplitPosition: (splitPosition) => set({ splitPosition }),

  setExportModalOpen: (exportModalOpen) => set({ exportModalOpen }),
}));
