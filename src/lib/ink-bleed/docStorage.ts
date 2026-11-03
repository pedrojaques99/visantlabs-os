/**
 * Saves the document to the browser. The persist middleware calls setItem on every
 * state change, and playback changes state on every frame, so this only writes when
 * the document itself changed. A full or blocked storage never reaches the caller:
 * losing the autosave must not stop the tool.
 */
import type { PersistStorage, StorageValue } from 'zustand/middleware';
import type { InkDoc } from './types';

export interface PersistedInk {
  doc: InkDoc;
}

interface DocStorageOptions {
  storage: () => Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
  /** Called once, on the first write that fails. */
  onSaveFailed: (error: unknown) => void;
  waitMs?: number;
}

export function createDocStorage({
  storage,
  onSaveFailed,
  waitMs = 400,
}: DocStorageOptions): PersistStorage<PersistedInk> & { flush: () => void } {
  let lastDoc: InkDoc | null = null;
  let pending: { name: string; value: StorageValue<PersistedInk> } | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let reported = false;

  const flush = () => {
    clearTimeout(timer);
    if (!pending) return;
    const { name, value } = pending;
    pending = null;
    try {
      storage().setItem(name, JSON.stringify(value));
    } catch (error) {
      if (reported) return;
      reported = true;
      onSaveFailed(error);
    }
  };

  return {
    flush,
    getItem: (name) => {
      try {
        const raw = storage().getItem(name);
        return raw ? (JSON.parse(raw) as StorageValue<PersistedInk>) : null;
      } catch {
        return null;
      }
    },
    setItem: (name, value) => {
      if (value.state.doc === lastDoc) return;
      lastDoc = value.state.doc;
      pending = { name, value };
      clearTimeout(timer);
      timer = setTimeout(flush, waitMs);
    },
    removeItem: (name) => {
      pending = null;
      clearTimeout(timer);
      try {
        storage().removeItem(name);
      } catch {
        // Nothing to remove from a storage we cannot reach.
      }
    },
  };
}
