import React from 'react';
import { cn } from '@/lib/utils';

export interface AppShellProps {
  children: React.ReactNode;
  className?: string;
}

export const AppShell: React.FC<AppShellProps> = ({ children, className }) => (
  <div className={cn('fixed inset-0 top-10 md:top-14 bg-neutral-950 overflow-hidden select-none pb-[env(safe-area-inset-bottom)]', className)} style={{ zIndex: 40 }}>
    {children}
  </div>
);

export const AppShellTopBar: React.FC<{ left?: React.ReactNode; center?: React.ReactNode; right?: React.ReactNode; className?: string }> = ({ left, center, right, className }) => (
  <div className={cn('absolute top-0 left-0 right-0 flex items-center justify-between px-2 sm:px-3 py-2 z-10', className)}>
    <div className="flex items-center gap-0.5 sm:gap-1">{left}</div>
    <div className="flex items-center gap-0.5 sm:gap-1">{center}</div>
    <div className="flex items-center gap-0.5 sm:gap-1">{right}</div>
  </div>
);

export const AppShellPanel: React.FC<{
  children: React.ReactNode;
  side?: 'left' | 'right';
  visible?: boolean;
  width?: number;
  className?: string;
}> = ({ children, side = 'right', visible = true, width = 300, className }) => (
  <div className={cn(
    'absolute top-3 bottom-12 z-10 transition-all duration-300',
    side === 'right' ? 'right-3' : 'left-3',
    visible ? 'translate-x-0 opacity-100' : 'opacity-0 pointer-events-none',
    className,
  )} style={{
    width,
    ...(!visible ? { transform: `translateX(${side === 'right' ? width + 20 : -(width + 20)}px)` } : undefined),
  }}>
    {children}
  </div>
);

export const AppShellStatusBar: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <div className={cn('absolute bottom-3 left-1/2 -translate-x-1/2 z-10', className)}>
    <div className="flex items-center gap-3 px-4 py-1.5 rounded-full bg-neutral-900/70 backdrop-blur-xl border border-neutral-800 text-[10px] text-neutral-600">
      {children}
    </div>
  </div>
);
