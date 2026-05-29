import React from 'react';
import { type LucideIcon, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DropOverlay } from '@/components/ui/DropOverlay';

const MAX_WIDTH_MAP = {
  '4xl': 'max-w-4xl',
  '5xl': 'max-w-5xl',
  '6xl': 'max-w-6xl',
} as const;

export interface MiniToolShellProps {
  title: string;
  icon: LucideIcon;
  countLabel?: string;
  headerExtra?: React.ReactNode;
  onReset?: () => void;
  showReset?: boolean;
  maxWidth?: '4xl' | '5xl' | '6xl';
  dragDrop?: {
    onDrop: (e: React.DragEvent) => void;
    onDragOver: (e: React.DragEvent) => void;
    onDragLeave: (e: React.DragEvent) => void;
    isDragOver: boolean;
  };
  hideHeader?: boolean;
  className?: string;
  children: React.ReactNode;
}

export const MiniToolShell: React.FC<MiniToolShellProps> = ({
  title,
  icon: Icon,
  countLabel,
  headerExtra,
  onReset,
  showReset,
  maxWidth = '4xl',
  dragDrop,
  hideHeader = false,
  className,
  children,
}) => {
  const resetVisible = showReset ?? !!onReset;

  return (
    <div
      className={cn(
        'min-h-screen bg-background flex flex-col items-center p-4 sm:p-8 relative',
        className,
      )}
      {...(dragDrop && {
        onDrop: dragDrop.onDrop,
        onDragOver: dragDrop.onDragOver,
        onDragLeave: dragDrop.onDragLeave,
      })}
    >
      {dragDrop && <DropOverlay visible={dragDrop.isDragOver} />}

      <div className={cn('w-full space-y-6', MAX_WIDTH_MAP[maxWidth])}>
        {!hideHeader && (
          <div className="flex items-center gap-2">
            <Icon size={16} className="text-brand-cyan" />
            <h1 className="text-sm font-mono font-bold uppercase tracking-widest text-neutral-200">
              {title}
            </h1>
            {countLabel && (
              <span className="text-[10px] font-mono text-neutral-500 ml-2">
                {countLabel}
              </span>
            )}
            {headerExtra}
            {resetVisible && onReset && (
              <button
                onClick={onReset}
                className="ml-auto text-neutral-500 hover:text-neutral-300 transition-colors"
                title="Clear all"
              >
                <RotateCcw size={14} />
              </button>
            )}
          </div>
        )}
        {children}
      </div>
    </div>
  );
};
