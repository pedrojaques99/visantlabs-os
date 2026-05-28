import { create } from 'zustand';

export type ConvertStatus = 'queued' | 'processing' | 'done' | 'error';
export type InputFormat = 'png' | 'jpg' | 'webp' | 'svg' | 'gif' | 'bmp';
export type OutputFormat = 'png' | 'jpg' | 'webp' | 'pdf' | 'ico';

export interface ConvertItem {
  id: string;
  sourceUrl: string;
  fileName: string;
  inputFormat: InputFormat;
  originalSize: number;
  resultBlob: Blob | null;
  resultUrl: string;
  status: ConvertStatus;
  error?: string;
}

export interface ConverterState {
  items: ConvertItem[];
  outputFormat: OutputFormat;
  jpgQuality: number;
  isProcessing: boolean;

  addFiles: (files: File[]) => void;
  removeItem: (id: string) => void;
  updateItem: (id: string, patch: Partial<ConvertItem>) => void;
  setOutputFormat: (v: OutputFormat) => void;
  setJpgQuality: (v: number) => void;
  setIsProcessing: (v: boolean) => void;
  reset: () => void;
}

const FORMAT_MAP: Record<string, InputFormat> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
  'image/gif': 'gif',
  'image/bmp': 'bmp',
};

const EXT_MAP: Record<string, InputFormat> = {
  png: 'png',
  jpg: 'jpg',
  jpeg: 'jpg',
  webp: 'webp',
  svg: 'svg',
  gif: 'gif',
  bmp: 'bmp',
};

function detectFormat(file: File): InputFormat {
  if (FORMAT_MAP[file.type]) return FORMAT_MAP[file.type];
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  return EXT_MAP[ext] || 'png';
}

let counter = 0;

export const useConverterStore = create<ConverterState>()((set) => ({
  items: [],
  outputFormat: 'png',
  jpgQuality: 90,
  isProcessing: false,

  addFiles: (files) =>
    set((s) => ({
      items: [
        ...s.items,
        ...files.map((f) => ({
          id: `cv-${++counter}`,
          sourceUrl: URL.createObjectURL(f),
          fileName: f.name,
          inputFormat: detectFormat(f),
          originalSize: f.size,
          resultBlob: null,
          resultUrl: '',
          status: 'queued' as const,
        })),
      ],
    })),
  removeItem: (id) =>
    set((s) => {
      const item = s.items.find((i) => i.id === id);
      if (item?.sourceUrl?.startsWith('blob:')) URL.revokeObjectURL(item.sourceUrl);
      if (item?.resultUrl?.startsWith('blob:')) URL.revokeObjectURL(item.resultUrl);
      return { items: s.items.filter((i) => i.id !== id) };
    }),
  updateItem: (id, patch) =>
    set((s) => ({
      items: s.items.map((i) => (i.id === id ? { ...i, ...patch } : i)),
    })),
  setOutputFormat: (v) =>
    set((s) => ({
      outputFormat: v,
      items: s.items.map((i) =>
        i.status === 'done' || i.status === 'error'
          ? { ...i, status: 'queued' as const, resultBlob: null, resultUrl: '', error: undefined }
          : i,
      ),
    })),
  setJpgQuality: (v) => set({ jpgQuality: v }),
  setIsProcessing: (v) => set({ isProcessing: v }),
  reset: () =>
    set((s) => {
      s.items.forEach((item) => {
        if (item.sourceUrl?.startsWith('blob:')) URL.revokeObjectURL(item.sourceUrl);
        if (item.resultUrl?.startsWith('blob:')) URL.revokeObjectURL(item.resultUrl);
      });
      return { items: [], outputFormat: 'png', jpgQuality: 90, isProcessing: false };
    }),
}));
