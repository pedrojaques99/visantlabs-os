import React, { type ReactNode } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface AppShellMobileSheetProps {
  open: boolean;
  onToggle: () => void;
  label?: string;
  /** Expanded height — default '45%' */
  height?: string;
  children: ReactNode;
  className?: string;
}

export const AppShellMobileSheet: React.FC<AppShellMobileSheetProps> = ({
  open,
  onToggle,
  label = 'Controls',
  height = '45%',
  children,
  className,
}) => (
  <div
    className={cn(
      'absolute left-0 right-0 bottom-0 z-20 transition-transform duration-300 ease-out',
      className,
    )}
    style={{ height: open ? height : 48 }}
  >
    <button
      onClick={onToggle}
      className="w-full flex items-center justify-center gap-1.5 h-[48px] bg-neutral-900/90 backdrop-blur-xl border-t border-white/[0.06] text-neutral-400 active:bg-neutral-800/90"
    >
      {open ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
      <span className="text-[11px] uppercase tracking-widest">{label}</span>
    </button>
    {open && (
      <div className="h-[calc(100%-48px)] bg-neutral-950/95 backdrop-blur-xl overflow-y-auto scrollbar-none">
        {children}
      </div>
    )}
  </div>
);
