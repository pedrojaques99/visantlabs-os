import React, { createContext, useContext } from 'react';
import type { BrandGuideline } from '@/lib/figma-types';
import { useBrandGuidelineDraft } from '@/hooks/useBrandGuidelineDraft';
import {
  useStorage,
  useMutation,
  useHistory,
} from '@/config/liveblocks';
import { LiveObject } from '@liveblocks/client';

export interface BrandGuidelineEditorCtx {
  draft: BrandGuideline;
  updateDraft: (patch: Partial<BrandGuideline>) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  isDirty: boolean;
  isSaving: boolean;
}

const BrandGuidelineEditorContext = createContext<BrandGuidelineEditorCtx | null>(null);

export function useBrandGuidelineEditor(): BrandGuidelineEditorCtx {
  const ctx = useContext(BrandGuidelineEditorContext);
  if (!ctx) throw new Error('useBrandGuidelineEditor must be used inside BrandGuidelineEditorProvider');
  return ctx;
}

// ── Liveblocks provider (inside RoomProvider) ─────────────────────────────────

interface LiveblocksEditorProviderProps {
  guideline: BrandGuideline;
  onSave: (patch: Partial<BrandGuideline>) => void;
  children: React.ReactNode;
}

export const LiveblocksEditorProvider: React.FC<LiveblocksEditorProviderProps> = ({
  guideline,
  onSave,
  children,
}) => {
  const storedGuideline = useStorage((root) => root.guideline) as Record<string, any> | null;
  const { undo, redo, canUndo, canRedo } = useHistory();

  const updateDraft = useMutation(({ storage }, patch: Partial<BrandGuideline>) => {
    const liveGuideline = storage.get('guideline') as import('@liveblocks/client').LiveObject<Record<string, any>> | undefined;
    if (liveGuideline) {
      Object.entries(patch).forEach(([key, value]) => {
        liveGuideline.set(key, value as any);
      });
    }
    // Always persist to MongoDB — don't skip if Liveblocks storage isn't ready
    onSave(patch);
  }, [onSave]);

  const draft = storedGuideline
    ? ({ ...guideline, ...storedGuideline } as BrandGuideline)
    : guideline;

  const isCanUndo = typeof canUndo === 'function' ? canUndo() : canUndo;
  const isCanRedo = typeof canRedo === 'function' ? canRedo() : canRedo;

  const ctx: BrandGuidelineEditorCtx = {
    draft,
    updateDraft,
    undo,
    redo,
    canUndo: isCanUndo,
    canRedo: isCanRedo,
    isDirty: isCanUndo,
    isSaving: false,
  };

  return (
    <BrandGuidelineEditorContext.Provider value={ctx}>
      {children}
    </BrandGuidelineEditorContext.Provider>
  );
};

// ── Local (fallback) provider — no Liveblocks ────────────────────────────────

interface LocalEditorProviderProps {
  guideline: BrandGuideline;
  onSave: (patch: Partial<BrandGuideline>) => void;
  children: React.ReactNode;
}

export const LocalEditorProvider: React.FC<LocalEditorProviderProps> = ({
  guideline,
  onSave,
  children,
}) => {
  const editor = useBrandGuidelineDraft({ guideline, onSave });

  return (
    <BrandGuidelineEditorContext.Provider value={editor}>
      {children}
    </BrandGuidelineEditorContext.Provider>
  );
};
