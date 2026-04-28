import React, { createContext, useContext, useEffect, useRef } from 'react';
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

  const syncStorage = useMutation(({ storage }, g: BrandGuideline) => {
    const liveGuideline = storage.get('guideline') as import('@liveblocks/client').LiveObject<Record<string, any>> | undefined;
    if (!liveGuideline) return;
    // Overwrite all fields with the authoritative server data
    const fields = ['identity','logos','colors','typography','tags','media','tokens','guidelines',
      'strategy','gradients','shadows','motion','borders','validation','activeSections','orderedBlocks',
      'extraction','folder','isPublic','publicSlug','figmaFileUrl','figmaFileKey'] as const;
    for (const key of fields) {
      liveGuideline.set(key, (g as any)[key] ?? null);
    }
  }, []);

  // Sync Liveblocks storage to server data when storage is ready AND when updatedAt changes.
  // storedGuideline is null until Liveblocks storage finishes loading — never call mutation before that.
  const syncedKey = useRef<string>('');
  useEffect(() => {
    if (storedGuideline === null) return; // storage not ready yet
    const updatedAt = typeof guideline.updatedAt === 'string' ? guideline.updatedAt : (guideline.updatedAt as any)?.toString() ?? '';
    const key = `${guideline.id}:${updatedAt}`;
    if (syncedKey.current !== key) {
      syncedKey.current = key;
      syncStorage(guideline);
    }
  // storedGuideline in deps so this re-runs when storage loads for the first time
  }, [guideline.id, guideline.updatedAt, storedGuideline === null]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Merge: Liveblocks storage overrides server data only when it has real content.
  // Empty arrays [] and null/undefined are treated as "unset" — server data wins.
  const draft = storedGuideline
    ? (() => {
        const merged = { ...guideline };
        for (const [key, value] of Object.entries(storedGuideline)) {
          if (value === null || value === undefined) continue;
          if (Array.isArray(value) && value.length === 0) continue;
          if (typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0) continue;
          (merged as any)[key] = value;
        }
        return merged as BrandGuideline;
      })()
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
