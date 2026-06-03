import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { SvgAnalysis } from '@/components/grid-machine/SvgAnalyzer';

export interface GridMachineSettings {
  showAnchors: boolean;
  showHandles: boolean;
  showHLines: boolean;
  showVLines: boolean;
  showDiagonals: boolean;
  hLineSpacing: number;
  vLineSpacing: number;
  diagonalSpacing: number;
  showBaseGrid: boolean;
  showOutline: boolean;
  lineOpacity: number;
  pointSize: number;
  logoOpacity: number;
  lineColor: string;
  anchorColor: string;
  handleColor: string;
  bgMode: 'dark' | 'light';
  baseGridSpacing: number;
}

const DEFAULTS: GridMachineSettings = {
  showAnchors: true,
  showHandles: true,
  showHLines: true,
  showVLines: true,
  showDiagonals: true,
  hLineSpacing: 25,
  vLineSpacing: 30,
  diagonalSpacing: 30,
  showBaseGrid: false,
  showOutline: true,
  lineOpacity: 0.35,
  pointSize: 4,
  logoOpacity: 0.15,
  lineColor: '#00d4ff',
  anchorColor: '#00d4ff',
  handleColor: '#ffffff',
  bgMode: 'dark',
  baseGridSpacing: 20,
};

interface GridMachineState extends GridMachineSettings {
  svgContent: string;
  fileName: string;
  analysis: SvgAnalysis | null;
  panelVisible: boolean;
  isExporting: boolean;
  zoom: number;
  panX: number;
  panY: number;
  hiddenLines: Set<number>;
  hiddenHistory: number[];

  setSvg: (content: string, fileName: string) => void;
  setAnalysis: (a: SvgAnalysis) => void;
  setPanelVisible: (v: boolean) => void;
  setIsExporting: (v: boolean) => void;
  updateSetting: <K extends keyof GridMachineSettings>(
    key: K,
    value: GridMachineSettings[K]
  ) => void;
  setZoom: (z: number) => void;
  setPan: (x: number, y: number) => void;
  toggleHiddenLine: (index: number) => void;
  undoHideLine: () => void;
  resetSettings: () => void;
  clear: () => void;
}

export const useGridMachineStore = create<GridMachineState>()(
  persist(
    (set) => ({
      ...DEFAULTS,
      svgContent: '',
      fileName: '',
      analysis: null,
      panelVisible: true,
      isExporting: false,
      zoom: 1,
      panX: 0,
      panY: 0,
      hiddenLines: new Set<number>(),
      hiddenHistory: [],

      setSvg: (svgContent, fileName) =>
        set({ svgContent, fileName, hiddenLines: new Set(), hiddenHistory: [] }),
      setAnalysis: (analysis) => set({ analysis }),
      setPanelVisible: (panelVisible) => set({ panelVisible }),
      setIsExporting: (isExporting) => set({ isExporting }),
      updateSetting: (key, value) => set({ [key]: value }),
      setZoom: (zoom) => set({ zoom: Math.max(0.1, Math.min(10, zoom)) }),
      setPan: (panX, panY) => set({ panX, panY }),
      toggleHiddenLine: (index) =>
        set((state) => {
          const next = new Set(state.hiddenLines);
          if (next.has(index)) {
            next.delete(index);
            return { hiddenLines: next };
          }
          next.add(index);
          return { hiddenLines: next, hiddenHistory: [...state.hiddenHistory, index] };
        }),
      undoHideLine: () =>
        set((state) => {
          if (state.hiddenHistory.length === 0) return state;
          const history = [...state.hiddenHistory];
          const last = history.pop()!;
          const next = new Set(state.hiddenLines);
          next.delete(last);
          return { hiddenLines: next, hiddenHistory: history };
        }),
      resetSettings: () => set({ ...DEFAULTS, hiddenLines: new Set(), hiddenHistory: [] }),
      clear: () =>
        set({
          svgContent: '',
          fileName: '',
          analysis: null,
          zoom: 1,
          panX: 0,
          panY: 0,
          hiddenLines: new Set(),
          hiddenHistory: [],
          ...DEFAULTS,
        }),
    }),
    {
      name: 'vsn-grid-machine-cache',
      version: 1,
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        svgContent: state.svgContent,
        fileName: state.fileName,
        panelVisible: state.panelVisible,
        zoom: state.zoom,
        panX: state.panX,
        panY: state.panY,
        hiddenHistory: state.hiddenHistory,
        showAnchors: state.showAnchors,
        showHandles: state.showHandles,
        showHLines: state.showHLines,
        showVLines: state.showVLines,
        showDiagonals: state.showDiagonals,
        hLineSpacing: state.hLineSpacing,
        vLineSpacing: state.vLineSpacing,
        diagonalSpacing: state.diagonalSpacing,
        showBaseGrid: state.showBaseGrid,
        showOutline: state.showOutline,
        lineOpacity: state.lineOpacity,
        pointSize: state.pointSize,
        logoOpacity: state.logoOpacity,
        lineColor: state.lineColor,
        anchorColor: state.anchorColor,
        handleColor: state.handleColor,
        bgMode: state.bgMode,
        baseGridSpacing: state.baseGridSpacing,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        // Restore hiddenLines Set from hiddenHistory array
        state.hiddenLines = new Set(state.hiddenHistory);
        // Re-analyze SVG on rehydrate
        if (state.svgContent) {
          import('@/components/grid-machine/SvgAnalyzer').then(({ analyzeSvg }) => {
            const analysis = analyzeSvg(state.svgContent);
            useGridMachineStore.setState({ analysis });
          });
        }
      },
    }
  )
);
