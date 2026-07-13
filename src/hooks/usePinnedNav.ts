import { useSyncExternalStore, useCallback } from 'react';

/**
 * Itens fixados ("starred", estilo Figma) que o usuário fixa no rail para
 * acesso rápido — apps ou marcas. Persistido em localStorage e sincronizado
 * entre componentes/abas via useSyncExternalStore. Plano APP-SHELL (pinned nav).
 *
 * Follow-up: espelhar no backend (por-usuário) quando quiser cross-device; hoje
 * é per-device, igual ao "last-used" do launcher.
 */
export interface PinnedItem {
  type: 'app' | 'brand';
  id: string;
  label: string;
  /** Rota interna (/x) ou URL externa (http…). */
  to: string;
  /** Nome de ícone lucide (para apps). Marcas usam avatar/letra. */
  icon?: string;
}

const KEY = 'vsn_pinned_nav';
const EVENT = 'vsn_pinned_changed';

function read(): PinnedItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

let cache: PinnedItem[] = read();

function write(items: PinnedItem[]) {
  cache = items;
  if (typeof window !== 'undefined') {
    localStorage.setItem(KEY, JSON.stringify(items));
    window.dispatchEvent(new Event(EVENT));
  }
}

const same = (a: PinnedItem, type: PinnedItem['type'], id: string) => a.type === type && a.id === id;

function subscribe(cb: () => void) {
  const local = () => cb(); // evento próprio: cache já está fresco (write o atualizou)
  const cross = () => {
    cache = read(); // mudança em outra aba: recarrega do storage
    cb();
  };
  window.addEventListener(EVENT, local);
  window.addEventListener('storage', cross);
  return () => {
    window.removeEventListener(EVENT, local);
    window.removeEventListener('storage', cross);
  };
}

const getSnapshot = () => cache;
const getServerSnapshot = (): PinnedItem[] => [];

export function usePinnedNav() {
  const items = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const isPinned = useCallback(
    (type: PinnedItem['type'], id: string) => items.some((i) => same(i, type, id)),
    [items]
  );

  const toggle = useCallback((item: PinnedItem) => {
    const exists = cache.some((i) => same(i, item.type, item.id));
    write(exists ? cache.filter((i) => !same(i, item.type, item.id)) : [...cache, item]);
  }, []);

  const unpin = useCallback((type: PinnedItem['type'], id: string) => {
    write(cache.filter((i) => !same(i, type, id)));
  }, []);

  return { items, isPinned, toggle, unpin };
}
