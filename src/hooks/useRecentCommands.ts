import { useSyncExternalStore, useCallback } from 'react';

/**
 * MRU dos comandos escolhidos no Cmd+K — surface "Recentes" no topo do palette
 * (padrão Raycast/Superhuman: maior sinal primeiro). Espelha exatamente o store
 * de `usePinnedNav` (localStorage + `useSyncExternalStore` + evento próprio),
 * então é per-device e sincroniza entre abas. Guarda só os ids; a resolução pro
 * comando real acontece em `useShellCommands`.
 */
const KEY = 'vsn_recent_commands';
const EVENT = 'vsn_recent_changed';
const MAX = 8;

function read(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

let cache: string[] = read();

function write(ids: string[]) {
  cache = ids;
  if (typeof window !== 'undefined') {
    localStorage.setItem(KEY, JSON.stringify(ids));
    window.dispatchEvent(new Event(EVENT));
  }
}

function subscribe(cb: () => void) {
  const local = () => cb();
  const cross = () => {
    cache = read();
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
const getServerSnapshot = (): string[] => [];

export function useRecentCommands() {
  const ids = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  /** Move o id pro topo (dedup) e corta em MAX. */
  const record = useCallback((id: string) => {
    write([id, ...cache.filter((x) => x !== id)].slice(0, MAX));
  }, []);

  return { ids, record };
}
