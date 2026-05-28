import { create } from 'zustand';

export interface PaletteColor {
  hex: string;
  locked: boolean;
}

export interface ColorPaletteState {
  imageUrl: string;
  fileName: string;
  colors: PaletteColor[];
  maxColors: number;
  isExtracting: boolean;

  setImage(url: string, name: string): void;
  setColors(colors: PaletteColor[]): void;
  toggleLock(index: number): void;
  removeColor(index: number): void;
  addColor(hex: string): void;
  updateColor(index: number, hex: string): void;
  setMaxColors(v: number): void;
  setIsExtracting(v: boolean): void;
  reset(): void;
}

export const useColorPaletteStore = create<ColorPaletteState>()((set) => ({
  imageUrl: '',
  fileName: '',
  colors: [],
  maxColors: 6,
  isExtracting: false,

  setImage: (url, name) => set({ imageUrl: url, fileName: name }),
  setColors: (colors) => set({ colors }),
  toggleLock: (index) =>
    set((s) => ({
      colors: s.colors.map((c, i) => (i === index ? { ...c, locked: !c.locked } : c)),
    })),
  removeColor: (index) =>
    set((s) => ({
      colors: s.colors.filter((_, i) => i !== index),
    })),
  addColor: (hex) =>
    set((s) => ({
      colors: [...s.colors, { hex, locked: false }],
    })),
  updateColor: (index, hex) =>
    set((s) => ({
      colors: s.colors.map((c, i) => (i === index ? { ...c, hex } : c)),
    })),
  setMaxColors: (v) => set({ maxColors: v }),
  setIsExtracting: (v) => set({ isExtracting: v }),
  reset: () => set({ imageUrl: '', fileName: '', colors: [], maxColors: 6, isExtracting: false }),
}));
