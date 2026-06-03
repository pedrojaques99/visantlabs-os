import { create } from 'zustand';

export const FAVICON_SIZES = [16, 32, 48, 64, 128, 180, 192, 512] as const;

export interface GeneratedIcon {
  size: number;
  blob: Blob | null;
  url: string;
}

export interface FaviconState {
  sourceUrl: string;
  fileName: string;
  backgroundColor: string;
  borderRadius: number;
  padding: number;
  generatedIcons: GeneratedIcon[];
  isGenerating: boolean;

  setSource: (url: string, name: string) => void;
  setBackgroundColor: (v: string) => void;
  setBorderRadius: (v: number) => void;
  setPadding: (v: number) => void;
  setGeneratedIcons: (icons: GeneratedIcon[]) => void;
  setIsGenerating: (v: boolean) => void;
  reset: () => void;
}

const INITIAL: Pick<
  FaviconState,
  | 'sourceUrl'
  | 'fileName'
  | 'backgroundColor'
  | 'borderRadius'
  | 'padding'
  | 'generatedIcons'
  | 'isGenerating'
> = {
  sourceUrl: '',
  fileName: '',
  backgroundColor: 'transparent',
  borderRadius: 0,
  padding: 5,
  generatedIcons: [],
  isGenerating: false,
};

export const useFaviconStore = create<FaviconState>()((set) => ({
  ...INITIAL,

  setSource: (url, name) => set({ sourceUrl: url, fileName: name, generatedIcons: [] }),
  setBackgroundColor: (v) => set({ backgroundColor: v }),
  setBorderRadius: (v) => set({ borderRadius: v }),
  setPadding: (v) => set({ padding: v }),
  setGeneratedIcons: (icons) => set({ generatedIcons: icons }),
  setIsGenerating: (v) => set({ isGenerating: v }),
  reset: () =>
    set((s) => {
      if (s.sourceUrl?.startsWith('blob:')) URL.revokeObjectURL(s.sourceUrl);
      s.generatedIcons.forEach((icon) => {
        if (icon.url?.startsWith('blob:')) URL.revokeObjectURL(icon.url);
      });
      return { ...INITIAL };
    }),
}));
