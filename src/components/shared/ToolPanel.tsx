import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { ChevronDown } from 'lucide-react';

export const ToolPanel: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <GlassPanel className={cn('h-full overflow-hidden flex flex-col', className)}>
    {children}
  </GlassPanel>
);

export const ToolPanelHeader: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="shrink-0 border-b border-neutral-800/50 px-4 py-3">
    {children}
  </div>
);

export const ToolPanelContent: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6 scrollbar-thin scrollbar-thumb-neutral-700 scrollbar-track-transparent">
    {children}
  </div>
);

export const ToolPanelSection: React.FC<{ title: string; children: React.ReactNode; className?: string }> = ({ title, children, className }) => (
  <div className={cn('space-y-3', className)}>
    <div className="sticky top-0 z-10 backdrop-blur-xl bg-neutral-950/80 -mx-4 px-4 py-1.5">
      <span className="text-[10px] font-mono uppercase tracking-widest text-neutral-500">{title}</span>
    </div>
    {children}
  </div>
);

export const ToolPanelDisclosure: React.FC<{
  label: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  badge?: React.ReactNode;
}> = ({ label, children, defaultOpen = false, badge }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-md border border-neutral-800/50 transition-all duration-200">
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          'w-full flex items-center justify-between text-left px-3 py-2.5 transition-all duration-200 rounded-md',
          'hover:bg-neutral-800/10 sticky top-0 z-10 backdrop-blur-xl bg-neutral-950/80',
          open && 'bg-neutral-800/20'
        )}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-[10px] font-mono uppercase tracking-widest text-neutral-500">{label}</span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {badge}
          <ChevronDown size={14} className={cn('text-neutral-500 transition-transform duration-200', open && 'rotate-180')} />
        </div>
      </button>
      {open && (
        <div className="px-3 pb-3 pt-1 animate-fade-in space-y-3">
          {children}
        </div>
      )}
    </div>
  );
};

export const ToolPanelDivider: React.FC = () => (
  <div className="h-px bg-neutral-800/50" />
);

export const ToolPanelActions: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="shrink-0 border-t border-neutral-800/50 px-4 py-3 space-y-2">
    {children}
  </div>
);

export const ToolPanelGrid: React.FC<{ children: React.ReactNode; cols?: 2 | 3 | 4 | 5 }> = ({ children, cols = 2 }) => (
  <div className={cn('grid gap-1.5', {
    'grid-cols-2': cols === 2,
    'grid-cols-3': cols === 3,
    'grid-cols-4': cols === 4,
    'grid-cols-5': cols === 5,
  })}>
    {children}
  </div>
);

export const ToolPanelChip: React.FC<{
  children: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
  className?: string;
}> = ({ children, active, onClick, className }) => (
  <button
    onClick={onClick}
    className={cn(
      'px-2.5 py-2 rounded-md text-[10px] font-mono uppercase tracking-wider transition-all duration-200 text-left border',
      active
        ? 'bg-white/10 text-white border-white/20'
        : 'bg-neutral-900/50 text-neutral-400 border-neutral-800/50 hover:bg-neutral-800/30 hover:text-neutral-200 hover:border-neutral-700/50',
      className
    )}
  >
    {children}
  </button>
);

export const ToolPanelRow: React.FC<{
  label: string;
  children: React.ReactNode;
}> = ({ label, children }) => (
  <div className="flex items-center justify-between py-1">
    <span className="text-[11px] text-neutral-400">{label}</span>
    {children}
  </div>
);
