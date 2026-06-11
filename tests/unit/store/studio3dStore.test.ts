/**
 * Studio3D store — unit tests for the fragile points hardened in Phase 2.
 *
 * Covers:
 *  - undo/redo reliability (Phase 2.4 — no history debounce; every rapid change
 *    is recorded and undo restores the correct prior state)
 *  - setModelUrl revokes the previous blob URL (Phase 2.1 — no leaked object URLs)
 *  - persist partialize excludes transient/ref fields
 *
 * The store imports browser globals (sessionStorage, URL.*) at module-eval time
 * via zustand persist + zundo. We stub them BEFORE importing the store so it can
 * be evaluated in the node test environment.
 */
import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';

// ─── Browser-global stubs (must exist before the store module is imported) ───

const memoryStore = new Map<string, string>();
vi.stubGlobal('sessionStorage', {
  getItem: (k: string) => (memoryStore.has(k) ? memoryStore.get(k)! : null),
  setItem: (k: string, v: string) => void memoryStore.set(k, v),
  removeItem: (k: string) => void memoryStore.delete(k),
  clear: () => memoryStore.clear(),
});

const revokeSpy = vi.fn();
// node's global URL lacks createObjectURL/revokeObjectURL — add them.
(globalThis as any).URL.createObjectURL = vi.fn(() => 'blob:fake-' + Math.random());
(globalThis as any).URL.revokeObjectURL = revokeSpy;

// authService (imported transitively) reaches for import.meta.env — harmless in
// node (optional chaining), no stub needed.

const { useStudio3DStore } = await import('@/stores/studio3dStore');

// Snapshot the pristine default state so each test starts clean.
const DEFAULT_STATE = useStudio3DStore.getState();

function resetStore() {
  useStudio3DStore.setState(DEFAULT_STATE, true);
  useStudio3DStore.temporal.getState().clear();
}

describe('studio3dStore', () => {
  beforeEach(() => {
    resetStore();
    revokeSpy.mockClear();
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  // ─── Undo / redo (Phase 2.4) ───────────────────────────────────────────────

  describe('undo/redo', () => {
    it('records every rapid change in history (no debounce drop)', () => {
      const store = useStudio3DStore.getState();
      const temporal = useStudio3DStore.temporal.getState();

      // Three rapid, distinct changes in the same tick.
      store.setText('A');
      store.setText('AB');
      store.setText('ABC');

      const past = useStudio3DStore.temporal.getState().pastStates;
      // Each change should produce a history entry — none collapsed away.
      expect(past.length).toBeGreaterThanOrEqual(3);
      expect(useStudio3DStore.getState().text).toBe('ABC');
    });

    it('undo restores the immediately-prior state', () => {
      const store = useStudio3DStore.getState();

      store.setText('first');
      store.setText('second');
      expect(useStudio3DStore.getState().text).toBe('second');

      useStudio3DStore.temporal.getState().undo();
      expect(useStudio3DStore.getState().text).toBe('first');

      useStudio3DStore.temporal.getState().undo();
      // Back to the original (empty) text from default state.
      expect(useStudio3DStore.getState().text).toBe(DEFAULT_STATE.text);
    });

    it('redo re-applies an undone change', () => {
      const store = useStudio3DStore.getState();
      store.setText('one');
      store.setText('two');

      useStudio3DStore.temporal.getState().undo();
      expect(useStudio3DStore.getState().text).toBe('one');

      useStudio3DStore.temporal.getState().redo();
      expect(useStudio3DStore.getState().text).toBe('two');
    });

    it('a new change after undo clears the redo stack', () => {
      const store = useStudio3DStore.getState();
      store.setText('x');
      store.setText('y');

      useStudio3DStore.temporal.getState().undo(); // back to 'x'
      expect(useStudio3DStore.temporal.getState().futureStates.length).toBeGreaterThan(0);

      store.setText('z'); // new branch
      expect(useStudio3DStore.getState().text).toBe('z');
      expect(useStudio3DStore.temporal.getState().futureStates.length).toBe(0);
    });
  });

  // ─── setModelUrl blob revocation (Phase 2.1) ───────────────────────────────

  describe('setModelUrl', () => {
    it('revokes the previous blob URL when replacing it', () => {
      const store = useStudio3DStore.getState();

      store.setModelUrl('blob:first', 'a.glb');
      expect(useStudio3DStore.getState().modelUrl).toBe('blob:first');
      expect(revokeSpy).not.toHaveBeenCalled();

      store.setModelUrl('blob:second', 'b.glb');
      expect(revokeSpy).toHaveBeenCalledWith('blob:first');
      expect(useStudio3DStore.getState().modelUrl).toBe('blob:second');
    });

    it('does not revoke non-blob (http) previous URLs', () => {
      const store = useStudio3DStore.getState();
      store.setModelUrl('https://cdn/model.glb', 'a.glb');
      store.setModelUrl('blob:next', 'b.glb');
      expect(revokeSpy).not.toHaveBeenCalled();
    });

    it('does not revoke when the URL is unchanged', () => {
      const store = useStudio3DStore.getState();
      store.setModelUrl('blob:same', 'a.glb');
      store.setModelUrl('blob:same', 'a.glb');
      expect(revokeSpy).not.toHaveBeenCalled();
    });

    it('switches inputMode to model', () => {
      useStudio3DStore.getState().setModelUrl('blob:m', 'm.glb');
      expect(useStudio3DStore.getState().inputMode).toBe('model');
    });
  });

  // ─── persist partialize ────────────────────────────────────────────────────

  describe('persist partialize', () => {
    it('excludes transient/ref fields from the persisted session payload', () => {
      // Drive a state change so persist writes to our memory sessionStorage.
      useStudio3DStore.getState().setText('persist-me');

      const raw = memoryStore.get('vsn-studio3d-session');
      expect(raw).toBeTruthy();
      const persisted = JSON.parse(raw!).state;

      // Transient fields must NOT be persisted.
      for (const k of [
        '_cameraControlsRef',
        '_cameraInfo',
        'isLoading',
        'isExporting',
        'exportProgress',
        'resetKey',
        'showStats',
        'modelUrl',
        'customHdriUrl',
        'backgroundImageUrl',
      ]) {
        expect(persisted).not.toHaveProperty(k);
      }
      // Tracked design state IS persisted.
      expect(persisted).toHaveProperty('text', 'persist-me');
    });
  });
});
