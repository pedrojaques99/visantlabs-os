import { useReducer, useState, useCallback, useRef, useEffect } from 'react';
import type { BrandGuideline } from '@/lib/figma-types';

const MAX_HISTORY = 50;

interface DraftState {
  history: BrandGuideline[];
  current: BrandGuideline;
  future: BrandGuideline[];
}

type DraftAction =
  | { type: 'PATCH'; patch: Partial<BrandGuideline> }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'RESET'; guideline: BrandGuideline };

function draftReducer(state: DraftState, action: DraftAction): DraftState {
  switch (action.type) {
    case 'PATCH': {
      const next = { ...state.current, ...action.patch };
      const history = [...state.history, state.current].slice(-MAX_HISTORY);
      return { history, current: next, future: [] };
    }
    case 'UNDO': {
      if (state.history.length === 0) return state;
      const previous = state.history[state.history.length - 1];
      const history = state.history.slice(0, -1);
      const future = [state.current, ...state.future];
      return { history, current: previous, future };
    }
    case 'REDO': {
      if (state.future.length === 0) return state;
      const next = state.future[0];
      const future = state.future.slice(1);
      const history = [...state.history, state.current];
      return { history, current: next, future };
    }
    case 'RESET':
      return { history: [], current: action.guideline, future: [] };
  }
}

interface UseBrandGuidelineDraftOptions {
  guideline: BrandGuideline;
  onSave: (patch: Partial<BrandGuideline>) => void;
  debounceMs?: number;
}

export function useBrandGuidelineDraft({
  guideline,
  onSave,
  debounceMs = 800,
}: UseBrandGuidelineDraftOptions) {
  const [state, dispatch] = useReducer(draftReducer, {
    history: [],
    current: guideline,
    future: [],
  });

  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    dispatch({ type: 'RESET', guideline });
  // Reset when guideline changes from server (new ID or new updatedAt after external save)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guideline.id, guideline.updatedAt]);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingPatchRef = useRef<Partial<BrandGuideline> | null>(null);
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;

  useEffect(() => () => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      if (pendingPatchRef.current) {
        onSaveRef.current(pendingPatchRef.current);
        pendingPatchRef.current = null;
      }
    }
  }, []);

  const updateDraft = useCallback((patch: Partial<BrandGuideline>) => {
    dispatch({ type: 'PATCH', patch });
    if (debounceRef.current) clearTimeout(debounceRef.current);
    pendingPatchRef.current = patch;
    setIsSaving(true);
    debounceRef.current = setTimeout(() => {
      onSaveRef.current(patch);
      pendingPatchRef.current = null;
      setIsSaving(false);
    }, debounceMs);
  }, [debounceMs]);

  const undo = useCallback(() => dispatch({ type: 'UNDO' }), []);
  const redo = useCallback(() => dispatch({ type: 'REDO' }), []);

  return {
    draft: state.current,
    updateDraft,
    undo,
    redo,
    canUndo: state.history.length > 0,
    canRedo: state.future.length > 0,
    isDirty: state.history.length > 0,
    isSaving,
  };
}
