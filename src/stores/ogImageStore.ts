import { create } from 'zustand';

export type OgTemplate = 'minimal' | 'gradient' | 'photo' | 'split';

export interface OgImageState {
  template: OgTemplate;
  title: string;
  subtitle: string;
  authorName: string;
  logoUrl: string;
  backgroundImageUrl: string;
  backgroundColor: string;
  accentColor: string;
  textColor: string;

  setTemplate: (v: OgTemplate) => void;
  setTitle: (v: string) => void;
  setSubtitle: (v: string) => void;
  setAuthorName: (v: string) => void;
  setLogoUrl: (v: string) => void;
  setBackgroundImageUrl: (v: string) => void;
  setBackgroundColor: (v: string) => void;
  setAccentColor: (v: string) => void;
  setTextColor: (v: string) => void;
  reset: () => void;
}

const DEFAULTS = {
  template: 'minimal' as OgTemplate,
  title: '',
  subtitle: '',
  authorName: '',
  logoUrl: '',
  backgroundImageUrl: '',
  backgroundColor: '#0a0a0a',
  accentColor: '#00e5ff',
  textColor: '#ffffff',
};

export const useOgImageStore = create<OgImageState>()((set) => ({
  ...DEFAULTS,

  setTemplate: (v) => set({ template: v }),
  setTitle: (v) => set({ title: v }),
  setSubtitle: (v) => set({ subtitle: v }),
  setAuthorName: (v) => set({ authorName: v }),
  setLogoUrl: (v) => set({ logoUrl: v }),
  setBackgroundImageUrl: (v) => set({ backgroundImageUrl: v }),
  setBackgroundColor: (v) => set({ backgroundColor: v }),
  setAccentColor: (v) => set({ accentColor: v }),
  setTextColor: (v) => set({ textColor: v }),
  reset: () => set({ ...DEFAULTS }),
}));
