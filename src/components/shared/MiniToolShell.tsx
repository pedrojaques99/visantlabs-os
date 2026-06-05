import React from 'react';
import { type LucideIcon, RotateCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
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
  centered?: boolean;
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
  centered = false,
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
        centered && 'justify-center',
        className
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
          <motion.div
            className="flex items-center gap-2"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
          >
            <Icon size={16} className="text-brand-cyan" />
            <h1 className="text-sm font-mono font-bold uppercase tracking-widest text-neutral-200">
              {title}
            </h1>
            <AnimatePresence>
              {countLabel && (
                <motion.span
                  className="text-[10px] font-mono text-neutral-500 ml-2"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.2 }}
                >
                  {countLabel}
                </motion.span>
              )}
            </AnimatePresence>
            {headerExtra}
            <AnimatePresence>
              {resetVisible && onReset && (
                <motion.button
                  onClick={onReset}
                  className="ml-auto text-neutral-500 hover:text-neutral-300 transition-colors"
                  title="Clear all"
                  initial={{ opacity: 0, rotate: -90 }}
                  animate={{ opacity: 1, rotate: 0 }}
                  exit={{ opacity: 0, rotate: 90 }}
                  transition={{ duration: 0.25 }}
                  whileHover={{ rotate: -45 }}
                  whileTap={{ scale: 0.9 }}
                >
                  <RotateCcw size={14} />
                </motion.button>
              )}
            </AnimatePresence>
          </motion.div>
        )}
        {children}
      </div>
    </div>
  );
};
