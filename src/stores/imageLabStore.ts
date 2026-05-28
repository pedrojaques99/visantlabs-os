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

  effectOpacity: number;

  exportModalOpen: boolean;
  magicHandActive: boolean;

  videoIsPlaying: boolean;
  videoDuration: number;
  videoCurrentTime: number;

  setMode: (mode: ImageLabMode) => void;
  setSource: (url: string, fileName: string, mediaType?: 'image' | 'video') => void;
  clearSource: () => void;
  setVideoState: (isPlaying: boolean, duration: number, currentTime: number) => void;

  setCompareMode: (mode: CompareMode) => void;
  setShowOriginal: (show: boolean) => void;
  setSplitPosition: (pos: number) => void;

  setEffectOpacity: (opacity: number) => void;
  setExportModalOpen: (open: boolean) => void;
  setMagicHandActive: (active: boolean) => void;
}

export const useImageLabStore = create<ImageLabState>()((set) => ({
  mode: 'halftone',
  sourceUrl: '',
  sourceFileName: '',
  sourceMediaType: 'image',

  compareMode: 'off',
  showOriginal: false,
  splitPosition: 50,

  effectOpacity: 1,

  exportModalOpen: false,
  magicHandActive: false,

  videoIsPlaying: false,
  videoDuration: 0,
  videoCurrentTime: 0,

  setMode: (mode) => set({ mode }),
  setVideoState: (videoIsPlaying, videoDuration, videoCurrentTime) =>
    set({ videoIsPlaying, videoDuration, videoCurrentTime }),
  setSource: (sourceUrl, sourceFileName, sourceMediaType = 'image') =>
    set({ sourceUrl, sourceFileName, sourceMediaType }),
  clearSource: () => set({ sourceUrl: '', sourceFileName: '', sourceMediaType: 'image' }),

  setCompareMode: (compareMode) => set({ compareMode, showOriginal: false }),
  setShowOriginal: (showOriginal) => set({ showOriginal }),
  setSplitPosition: (splitPosition) => set({ splitPosition }),

  setEffectOpacity: (effectOpacity) => set({ effectOpacity }),
  setExportModalOpen: (exportModalOpen) => set({ exportModalOpen }),
  setMagicHandActive: (magicHandActive) => set({ magicHandActive }),
}));
