import { useEffect, useSyncExternalStore } from 'react';

/**
 * Which chat nodes are currently shown in the side panel (ChatSidebar).
 *
 * The panel and the node render the SAME conversation on the same screen. When
 * the panel is open for a chat, the node hands its composer over to the panel
 * so there is one place to type, not two.
 */
const openCounts = new Map<string, number>();
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((l) => l());

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** Called by the side panel while it shows `nodeId`. */
export function useRegisterChatPanel(nodeId: string) {
  useEffect(() => {
    openCounts.set(nodeId, (openCounts.get(nodeId) ?? 0) + 1);
    emit();
    return () => {
      const next = (openCounts.get(nodeId) ?? 1) - 1;
      if (next <= 0) openCounts.delete(nodeId);
      else openCounts.set(nodeId, next);
      emit();
    };
  }, [nodeId]);
}

/** True while the side panel shows this chat node. */
export function useIsChatInPanel(nodeId: string) {
  return useSyncExternalStore(
    subscribe,
    () => openCounts.has(nodeId),
    () => false
  );
}
