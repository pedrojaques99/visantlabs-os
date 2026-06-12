import React from 'react';
import { cn } from '@/lib/utils';

const positionStyles = {
  tl: 'top-2 left-2',
  tr: 'top-2 right-2',
  bl: 'bottom-2 left-2',
  br: 'bottom-2 right-2',
} as const;

export interface OverlayLabelProps {
  position?: keyof typeof positionStyles;
  className?: string;
  children: React.ReactNode;
}

/**
 * SSoT for the small floating caption rendered over an image (before/after,
 * original/processed, etc.). Normalizes the padding/opacity/color drift that
 * was duplicated across BeforeAfterOverlay and ImageCompareSlider.
 */
export const OverlayLabel: React.FC<OverlayLabelProps> = ({
  position = 'tl',
  className,
  children,
}) => (
  <div
    className={cn(
      'absolute z-10 px-2 py-0.5 rounded bg-black/60 text-[10px] font-mono uppercase tracking-widest text-neutral-300 pointer-events-none',
      positionStyles[position],
      className
    )}
  >
    {children}
  </div>
);
