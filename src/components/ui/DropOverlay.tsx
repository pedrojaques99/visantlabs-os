import React from 'react';
import { cn } from '@/lib/utils';

interface DropOverlayProps {
  visible: boolean;
  message?: string;
  className?: string;
}

export const DropOverlay: React.FC<DropOverlayProps> = ({
  visible,
  message = 'Drop file here',
  className,
}) => {
  if (!visible) return null;
  return (
    <div
      className={cn(
        'absolute inset-0 z-50 flex items-center justify-center bg-neutral-950/70 backdrop-blur-sm border-2 border-dashed border-neutral-600/50 pointer-events-none',
        className,
      )}
    >
      <span className="text-sm text-neutral-400 font-mono uppercase tracking-widest">
        {message}
      </span>
    </div>
  );
};
