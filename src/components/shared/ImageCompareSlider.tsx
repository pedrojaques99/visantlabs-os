import React, { useCallback, useRef, useState } from 'react';
import { OverlayLabel } from '@/components/shared/OverlayLabel';

interface ImageCompareSliderProps {
  before: string;
  after: string;
  className?: string;
}

export const ImageCompareSlider: React.FC<ImageCompareSliderProps> = React.memo(
  ({ before, after, className }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [position, setPosition] = useState(50);
    const [isDragging, setIsDragging] = useState(false);

    const updatePosition = useCallback((clientX: number) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = ((clientX - rect.left) / rect.width) * 100;
      setPosition(Math.max(5, Math.min(95, x)));
    }, []);

    const handlePointerDown = useCallback(
      (e: React.PointerEvent) => {
        setIsDragging(true);
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        updatePosition(e.clientX);
      },
      [updatePosition]
    );

    const handlePointerMove = useCallback(
      (e: React.PointerEvent) => {
        if (!isDragging) return;
        updatePosition(e.clientX);
      },
      [isDragging, updatePosition]
    );

    const handlePointerUp = useCallback(() => {
      setIsDragging(false);
    }, []);

    return (
      <div
        ref={containerRef}
        className={`relative select-none overflow-hidden ${className || ''}`}
        style={{ cursor: 'col-resize' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        {/* After (full) */}
        <img
          src={after}
          alt="After"
          className="w-full h-auto max-h-[60vh] object-contain pointer-events-none"
          draggable={false}
        />

        {/* Before (clipped) */}
        <div
          className="absolute inset-0 overflow-hidden"
          style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
        >
          <img
            src={before}
            alt="Before"
            className="w-full h-auto max-h-[60vh] object-contain pointer-events-none"
            draggable={false}
          />
        </div>

        {/* Divider line */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-white/60 z-10 pointer-events-none"
          style={{ left: `${position}%` }}
        >
          <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-7 h-7 rounded-full bg-neutral-900/80 border-2 border-white/70 flex items-center justify-center backdrop-blur-sm">
            <div className="flex gap-0.5">
              <div className="w-0.5 h-3 bg-white/80 rounded-full" />
              <div className="w-0.5 h-3 bg-white/80 rounded-full" />
            </div>
          </div>
        </div>

        {/* Labels */}
        <OverlayLabel position="tl">Before</OverlayLabel>
        <OverlayLabel position="tr">After</OverlayLabel>
      </div>
    );
  }
);
ImageCompareSlider.displayName = 'ImageCompareSlider';
