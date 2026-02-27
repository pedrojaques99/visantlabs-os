import React from 'react';
import { cn } from '@/lib/utils';

interface NodeActionBarProps {
  selected: boolean;
  getZoom: () => number;
  children: React.ReactNode;
  className?: string;
}

export const NodeActionBar: React.FC<NodeActionBarProps> = ({
  selected,
  getZoom,
  children,
  className,
}) => {
  const zoom = getZoom();
  const scale = Math.min(1 / zoom, 3); // Limita o scale máximo a 3x

  return (
    <div
      className={cn(
        'absolute left-1/2 top-full flex items-center justify-center node-gap-sm transition-opacity duration-200 z-50',
        selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
        className
      )}
      style={{
        transform: `translateX(-50%) scale(${scale})`,
        transformOrigin: 'top center',
        marginTop: 'var(--node-margin)'
      }}
    >
      {children}
    </div>
  );
};
