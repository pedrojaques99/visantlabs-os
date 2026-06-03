import { create } from 'zustand';

export type EditorTool = 'rect' | 'circle' | 'brush' | 'eraser';
export type EditorAction = 'inpaint' | 'expand' | 'remove-bg';
export type InpaintMode = 'replace' | 'remove' | 'retouch';

export type MaskOperation =
  | { type: 'rect'; x: number; y: number; w: number; h: number }
  | { type: 'circle'; cx: number; cy: number; rx: number; ry: number }
  | { type: 'brush'; points: number[][]; size: number }
  | { type: 'eraser'; points: number[][]; size: number };

export interface ExpandEdges {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface ImageEditorState {
  activeTool: EditorTool;
  activeAction: EditorAction;
  activeMode: InpaintMode;
  brushSize: number;

  maskOperations: MaskOperation[];
  maskUndoStack: MaskOperation[][];

  expandEdges: ExpandEdges;

  prompt: string;
  isGenerating: boolean;
  generatingStartTime: number | null;
  resultUrl: string | null;
  resultBase64: string | null;

  zoom: number;
  panOffset: { x: number; y: number };

  editHistory: Array<{ imageUrl: string; action: EditorAction }>;
  currentImageUrl: string;

  setActiveTool: (tool: EditorTool) => void;
  setActiveAction: (action: EditorAction) => void;
  setActiveMode: (mode: InpaintMode) => void;
  setBrushSize: (size: number) => void;

  addMaskOperation: (op: MaskOperation) => void;
  undoMask: () => void;
  clearMask: () => void;

  setExpandEdge: (edge: keyof ExpandEdges, value: number) => void;
  resetExpandEdges: () => void;

  setPrompt: (p: string) => void;
  setGenerating: (v: boolean) => void;
  setResult: (url: string | null, base64?: string | null) => void;

  setZoom: (z: number) => void;
  setPanOffset: (offset: { x: number; y: number }) => void;

  pushHistory: (imageUrl: string, action: EditorAction) => void;
  setCurrentImageUrl: (url: string) => void;

  reset: () => void;
}

const INITIAL_STATE = {
  activeTool: 'rect' as EditorTool,
  activeAction: 'inpaint' as EditorAction,
  activeMode: 'replace' as InpaintMode,
  brushSize: 24,
  maskOperations: [] as MaskOperation[],
  maskUndoStack: [] as MaskOperation[][],
  expandEdges: { top: 0, right: 0, bottom: 0, left: 0 },
  prompt: '',
  isGenerating: false,
  generatingStartTime: null as number | null,
  resultUrl: null as string | null,
  resultBase64: null as string | null,
  zoom: 1,
  panOffset: { x: 0, y: 0 },
  editHistory: [] as Array<{ imageUrl: string; action: EditorAction }>,
  currentImageUrl: '',
};

export const useImageEditorStore = create<ImageEditorState>((set, get) => ({
  ...INITIAL_STATE,

  setActiveTool: (tool) => set({ activeTool: tool }),
  setActiveAction: (action) => set({ activeAction: action }),
  setActiveMode: (mode) => set({ activeMode: mode }),
  setBrushSize: (size) => set({ brushSize: Math.max(2, Math.min(200, size)) }),

  addMaskOperation: (op) => set((s) => ({
    maskUndoStack: [...s.maskUndoStack, s.maskOperations],
    maskOperations: [...s.maskOperations, op],
  })),

  undoMask: () => set((s) => {
    if (s.maskUndoStack.length === 0) return s;
    const prev = s.maskUndoStack[s.maskUndoStack.length - 1];
    return {
      maskOperations: prev,
      maskUndoStack: s.maskUndoStack.slice(0, -1),
    };
  }),

  clearMask: () => set((s) => ({
    maskUndoStack: s.maskOperations.length > 0
      ? [...s.maskUndoStack, s.maskOperations]
      : s.maskUndoStack,
    maskOperations: [],
  })),

  setExpandEdge: (edge, value) => set((s) => ({
    expandEdges: { ...s.expandEdges, [edge]: Math.max(0, value) },
  })),

  resetExpandEdges: () => set({ expandEdges: { top: 0, right: 0, bottom: 0, left: 0 } }),

  setPrompt: (p) => set({ prompt: p }),
  setGenerating: (v) => set({ isGenerating: v, generatingStartTime: v ? Date.now() : null }),
  setResult: (url, base64) => set({ resultUrl: url, resultBase64: base64 ?? null }),

  setZoom: (z) => set({ zoom: Math.max(0.1, Math.min(5, z)) }),
  setPanOffset: (offset) => set({ panOffset: offset }),

  pushHistory: (imageUrl, action) => set((s) => ({
    editHistory: [...s.editHistory, { imageUrl, action }].slice(-20),
    currentImageUrl: imageUrl,
    maskOperations: [],
    maskUndoStack: [],
    expandEdges: { top: 0, right: 0, bottom: 0, left: 0 },
    prompt: '',
    resultUrl: null,
    resultBase64: null,
  })),

  setCurrentImageUrl: (url) => set({ currentImageUrl: url }),

  reset: () => set(INITIAL_STATE),
}));
