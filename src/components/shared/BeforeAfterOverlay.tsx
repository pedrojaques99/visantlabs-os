import React, { useCallback, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { useImageLabStore, type CompareMode } from '@/stores/imageLabStore';

interface BeforeAfterOverlayProps {
  sourceUrl: string;
}

export const BeforeAfterOverlay: React.FC<BeforeAfterOverlayProps> = React.memo(({ sourceUrl }) => {
  const { compareMode, showOriginal, splitPosition, setSplitPosition } = useImageLabStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    setSplitPosition(Math.max(5, Math.min(95, x)));
  }, [isDragging, setSplitPosition]);

  if (!sourceUrl) return null;

  if (compareMode === 'toggle' && showOriginal) {
    return (
      <div className="absolute inset-0 z-20 pointer-events-none">
        <img src={sourceUrl} alt="Original" className="w-full h-full object-contain" />
        <div className="absolute top-3 left-3 px-2 py-1 bg-black/70 rounded text-[9px] font-mono uppercase tracking-widest text-neutral-300">
          Original
        </div>
      </div>
    );
  }

  if (compareMode === 'split') {
    return (
      <div
        ref={containerRef}
        className="absolute inset-0 z-20 cursor-col-resize"
        onPointerDown={() => setIsDragging(true)}
        onPointerUp={() => setIsDragging(false)}
        onPointerLeave={() => setIsDragging(false)}
        onPointerMove={handlePointerMove}
      >
        <div
          className="absolute inset-0 overflow-hidden"
          style={{ clipPath: `inset(0 ${100 - splitPosition}% 0 0)` }}
        >
          <img src={sourceUrl} alt="Original" className="w-full h-full object-contain" />
        </div>
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-white/60 z-10"
          style={{ left: `${splitPosition}%` }}
        >
          <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-white/80 border-2 border-white flex items-center justify-center">
            <div className="flex gap-0.5">
              <div className="w-0.5 h-3 bg-neutral-800 rounded-full" />
              <div className="w-0.5 h-3 bg-neutral-800 rounded-full" />
            </div>
          </div>
        </div>
        <div className="absolute top-3 left-3 px-2 py-1 bg-black/70 rounded text-[9px] font-mono uppercase tracking-widest text-neutral-300">
          Original
        </div>
        <div className="absolute top-3 right-3 px-2 py-1 bg-black/70 rounded text-[9px] font-mono uppercase tracking-widest text-neutral-300">
          Processed
        </div>
      </div>
    );
  }

  return null;
});
BeforeAfterOverlay.displayName = 'BeforeAfterOverlay';
