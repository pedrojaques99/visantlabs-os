import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { temporal } from 'zundo';
import { createDocStorage } from '@/lib/ink-bleed/docStorage';
import { varyDoc } from '@/lib/ink-bleed/shuffle';
import { PRESETS, createDefaultDoc } from '@/lib/ink-bleed/presets';
import type {
  FormatId,
  InkDoc,
  InkLogo,
  InkPreset,
  InkSettings,
  InkSource,
  MotionSettings,
  PaperSettings,
  TypographySettings,
} from '@/lib/ink-bleed/types';

interface InkBleedState {
  doc: InkDoc;
  /** Never persisted: a mask can pass the localStorage quota. */
  logo: InkLogo | null;
  /** 0-1. A paused artwork at 1 shows the slider values exactly. */
  progress: number;
  isPlaying: boolean;
  /** The browser refused the autosave: the work stays on screen, but not after a reload. */
  saveBlocked: boolean;

  setDoc: (doc: InkDoc) => void;
  setInk: (patch: Partial<InkSettings>) => void;
  setPaper: (patch: Partial<PaperSettings>) => void;
  setTypography: (patch: Partial<TypographySettings>) => void;
  setMotion: (patch: Partial<MotionSettings>) => void;
  setFormat: (format: FormatId) => void;
  setSource: (source: InkSource) => void;
  setLogoScale: (logoScale: number) => void;
  setLogo: (logo: InkLogo | null) => void;
  newVariation: () => void;
  applyPreset: (preset: InkPreset) => void;
  varyPreset: (preset: InkPreset) => void;
  setBrandLocked: (brandLocked: boolean) => void;
  setProgress: (progress: number) => void;
  setPlaying: (isPlaying: boolean) => void;
  reset: () => void;
}

/** An upright phone fills more of its screen at 4:5, and it is the size of a post. */
function startingFormat(): FormatId {
  const phone = globalThis.matchMedia?.('(max-width: 767px) and (orientation: portrait)').matches;
  return phone ? '4:5' : '4:3';
}

/** A slider drag is one undo step: only the first change of a burst is recorded. */
function firstOfBurst<T>(save: (state: T) => void, waitMs: number) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return (state: T) => {
    if (timer === undefined) save(state);
    clearTimeout(timer);
    timer = setTimeout(() => {
      timer = undefined;
    }, waitMs);
  };
}

/** A style sets the print. What is the person's own (their text, their brand) stays. */
export function mergePreset(doc: InkDoc, preset: InkPreset): InkDoc {
  const isSample = PRESETS.some((p) => p.typography.text === doc.typography.text);
  const text = isSample ? preset.typography.text : doc.typography.text;
  if (!doc.brandLocked) {
    return {
      ...doc,
      presetId: preset.id,
      ink: preset.ink,
      paper: preset.paper,
      typography: { ...preset.typography, text },
    };
  }
  return {
    ...doc,
    presetId: preset.id,
    ink: { ...preset.ink, inkColor: doc.ink.inkColor },
    paper: { ...preset.paper, baseColor: doc.paper.baseColor },
    typography: {
      ...preset.typography,
      text: doc.typography.text,
      uppercase: doc.typography.uppercase,
      fontFamily: doc.typography.fontFamily,
      fontWeight: doc.typography.fontWeight,
    },
  };
}

const docStorage = createDocStorage({
  storage: () => localStorage,
  onSaveFailed: (error) => {
    console.warn('[ink-bleed] autosave failed', error);
    useInkBleedStore.setState({ saveBlocked: true });
  },
});

// The write waits for a pause in the edits, so the last edit is saved on the way out.
if (typeof window !== 'undefined') window.addEventListener('pagehide', docStorage.flush);

export const useInkBleedStore = create<InkBleedState>()(
  persist(
    temporal(
      (set) => ({
        doc: createDefaultDoc(startingFormat()),
        logo: null,
        progress: 1,
        isPlaying: false,
        saveBlocked: false,

        setDoc: (doc) => set({ doc }),
        setInk: (patch) =>
          set((s) => ({ doc: { ...s.doc, presetId: null, ink: { ...s.doc.ink, ...patch } } })),
        setPaper: (patch) =>
          set((s) => ({ doc: { ...s.doc, presetId: null, paper: { ...s.doc.paper, ...patch } } })),
        setTypography: (patch) =>
          set((s) => ({ doc: { ...s.doc, typography: { ...s.doc.typography, ...patch } } })),
        setMotion: (patch) =>
          set((s) => ({ doc: { ...s.doc, motion: { ...s.doc.motion, ...patch } } })),
        setFormat: (format) => set((s) => ({ doc: { ...s.doc, format } })),
        setSource: (source) => set((s) => ({ doc: { ...s.doc, source } })),
        setLogoScale: (logoScale) => set((s) => ({ doc: { ...s.doc, logoScale } })),
        setLogo: (logo) => set({ logo }),
        newVariation: () => set((s) => ({ doc: { ...s.doc, seed: (s.doc.seed + 137) % 1000 } })),
        applyPreset: (preset) =>
          set((s) => ({
            progress: 1,
            isPlaying: false,
            doc: mergePreset(s.doc, preset),
          })),
        // From the style itself, not the last roll: repeated clicks must not drift away from it.
        varyPreset: (preset) => set((s) => ({ doc: varyDoc(mergePreset(s.doc, preset)) })),
        setBrandLocked: (brandLocked) => set((s) => ({ doc: { ...s.doc, brandLocked } })),
        setProgress: (progress) => set({ progress }),
        setPlaying: (isPlaying) => set({ isPlaying }),
        reset: () =>
          set({
            doc: createDefaultDoc(startingFormat()),
            logo: null,
            progress: 1,
            isPlaying: false,
          }),
      }),
      {
        limit: 50,
        partialize: (s) => ({ doc: s.doc }),
        // Playback changes state 60 times a second and must not fill the history.
        equality: (a, b) => a.doc === b.doc,
        handleSet: (save) => firstOfBurst(save, 400),
      }
    ),
    {
      name: 'vsn-ink-bleed',
      version: 1,
      storage: docStorage,
      partialize: (s) => ({ doc: s.doc }),
      // The logo is not persisted, so a saved logo document would open empty.
      merge: (persisted, current) => {
        const doc = (persisted as { doc?: InkDoc } | undefined)?.doc;
        if (!doc) return current;
        const fresh = createDefaultDoc();
        return {
          ...current,
          doc: {
            ...fresh,
            ...doc,
            source: 'text',
            ink: { ...fresh.ink, ...doc.ink },
            paper: { ...fresh.paper, ...doc.paper },
          },
        };
      },
    }
  )
);
