import { create } from 'zustand';
import { createShaderSlice, type ShaderSlice } from './shaderSlice';

interface ShaderLabState {
  imageUrl: string;
  fileName: string;
  mediaType: 'image' | 'video';
  isExporting: boolean;
  zoom: number;
  panX: number;
  panY: number;
  historyIndex: number;
  historyLength: number;

  setImageUrl: (url: string, fileName: string, mediaType?: 'image' | 'video') => void;
  setIsExporting: (v: boolean) => void;
  setZoom: (z: number) => void;
  setPan: (x: number, y: number) => void;
  undo: () => void;
  redo: () => void;
  reset: () => void;
}

export const useShaderLabStore = create<ShaderLabState & ShaderSlice>()((set, get, api) => ({
  ...createShaderSlice(set as any, get as any, api as any),

  imageUrl: '',
  fileName: '',
  mediaType: 'image',
  isExporting: false,
  zoom: 1,
  panX: 0,
  panY: 0,
  historyIndex: -1,
  historyLength: 0,

  shaderEnabled: true,

  setImageUrl: (imageUrl, fileName, mediaType = 'image') => set({ imageUrl, fileName, mediaType }),
  setIsExporting: (isExporting) => set({ isExporting }),
  setZoom: (zoom) => set({ zoom }),
  setPan: (panX, panY) => set({ panX, panY }),
  undo: () => {},
  redo: () => {},
  reset: () => set({
    shaderEnabled: true,
    shaderType: 'halftone',
    shaderValues: {},
    zoom: 1,
    panX: 0,
    panY: 0,
  }),
}));
