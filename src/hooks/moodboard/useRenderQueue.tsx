import React, { createContext, useContext, useSyncExternalStore, useCallback } from 'react';
import { renderQueue } from '../../services/moodboard/renderQueue';
import { RenderComposition, RenderJob } from '../../types/moodboard';

interface RenderQueueContextValue {
  jobs: RenderJob[];
  enqueue: (composition: RenderComposition) => string;
  cancel: (id: string) => void;
  dismiss: (id: string) => void;
}

const RenderQueueContext = createContext<RenderQueueContextValue | null>(null);

export const RenderQueueProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const jobs = useSyncExternalStore(
    (cb) => renderQueue.subscribe(cb),
    () => renderQueue.getJobs()
  );
  const enqueue = useCallback((c: RenderComposition) => renderQueue.enqueue(c), []);
  const cancel = useCallback((id: string) => renderQueue.cancel(id), []);
  const dismiss = useCallback((id: string) => renderQueue.dismiss(id), []);

  return (
    <RenderQueueContext.Provider value={{ jobs, enqueue, cancel, dismiss }}>
      {children}
    </RenderQueueContext.Provider>
  );
};

export function useRenderQueue() {
  const ctx = useContext(RenderQueueContext);
  if (!ctx) throw new Error('useRenderQueue must be used within RenderQueueProvider');
  return ctx;
}
