import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
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
  const [liveState, setLiveState] = useState<{
    draft: BrandGuideline;
    canUndo: boolean;
    canRedo: boolean;
  } | null>(null);

  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;

  const handleLiveUpdate = useCallback((state: { draft: BrandGuideline; canUndo: boolean; canRedo: boolean }) => {
    setLiveState(state);
  }, []);

  const liveMutation = useMutation(({ storage }, patch: Partial<BrandGuideline>) => {
    const liveGuideline = storage.get('guideline') as import('@liveblocks/client').LiveObject<Record<string, any>> | undefined;
    if (liveGuideline) {
      Object.entries(patch).forEach(([key, value]) => {
        liveGuideline.set(key, value as any);
      });
    }
    onSaveRef.current(patch);
  }, []);

  const updateDraft = useCallback((patch: Partial<BrandGuideline>) => {
    if (!liveState) return;
    liveMutation(patch);
  }, [liveState, liveMutation]);

  const { undo, redo } = useHistory();

  const ctx: BrandGuidelineEditorCtx = {
    draft: liveState?.draft ?? guideline,
    updateDraft,
    undo,
    redo,
    canUndo: liveState?.canUndo ?? false,
    canRedo: liveState?.canRedo ?? false,
    isDirty: liveState?.canUndo ?? false,
    isSaving: false,
  };

  return (
    <BrandGuidelineEditorContext.Provider value={ctx}>
      <React.Suspense fallback={null}>
        <LiveblocksStorageSyncer guideline={guideline} onUpdate={handleLiveUpdate} />
      </React.Suspense>
      {children}
    </BrandGuidelineEditorContext.Provider>
  );
};

const LiveblocksStorageSyncer: React.FC<{
  guideline: BrandGuideline;
  onUpdate: (state: { draft: BrandGuideline; canUndo: boolean; canRedo: boolean }) => void;
}> = ({ guideline, onUpdate }) => {
  const storedGuideline = useStorage((root) => root.guideline) as Record<string, any> | null;
  const { canUndo, canRedo } = useHistory();

  const syncStorage = useMutation(({ storage }, g: BrandGuideline) => {
    const liveGuideline = storage.get('guideline') as import('@liveblocks/client').LiveObject<Record<string, any>> | undefined;
    if (!liveGuideline) return;
    const fields = ['identity','logos','colors','typography','tags','media','tokens','guidelines',
      'strategy','gradients','shadows','motion','borders','validation','activeSections','orderedBlocks',
      'extraction','folder','isPublic','publicSlug','figmaFileUrl','figmaFileKey',
      'knowledgeFiles','colorThemes','figmaSyncedAt'] as const;
    for (const key of fields) {
      const incoming = (g as any)[key] ?? null;
      const current = liveGuideline.get(key);
      if (JSON.stringify(incoming) !== JSON.stringify(current)) {
        liveGuideline.set(key, incoming);
      }
    }
  }, []);

  const syncedKey = useRef<string>('');
  const storageReady = storedGuideline !== null;
  useEffect(() => {
    if (!storageReady) return;
    const updatedAt = typeof guideline.updatedAt === 'string' ? guideline.updatedAt : (guideline.updatedAt as any)?.toString() ?? '';
    const key = `${guideline.id}:${updatedAt}`;
    if (syncedKey.current !== key) {
      syncedKey.current = key;
      syncStorage(guideline);
    }
  }, [guideline.id, guideline.updatedAt, storageReady, syncStorage]); // eslint-disable-line react-hooks/exhaustive-deps

  const isCanUndo = typeof canUndo === 'function' ? canUndo() : canUndo;
  const isCanRedo = typeof canRedo === 'function' ? canRedo() : canRedo;

  useEffect(() => {
    if (storedGuideline === null) return;
    const merged = { ...guideline };
    for (const [key, value] of Object.entries(storedGuideline)) {
      if (value === null || value === undefined) continue;
      if (Array.isArray(value) && value.length === 0) continue;
      if (typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0) continue;
      (merged as any)[key] = value;
    }
    onUpdate({ draft: merged as BrandGuideline, canUndo: isCanUndo, canRedo: isCanRedo });
  }, [storedGuideline, guideline, isCanUndo, isCanRedo, onUpdate]);

  return null;
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
