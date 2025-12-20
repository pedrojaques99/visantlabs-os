import React from 'react';
import { cn } from '../../../lib/utils';
import { NodeWarningIndicator } from './NodeWarningIndicator';

/**
 * NodeContainer - Base container for all React Flow nodes
 * 
 * Automatically applies default padding (--node-padding) unless overridden.
 * To override padding, include a padding class in className (e.g., "p-4", "p-6").
 * 
 * Spacing is centralized via CSS variables in index.css.
 * To change spacing globally, modify CSS variables instead of individual nodes.
 */
interface NodeContainerProps {
  selected: boolean;
  dragging: boolean;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  onContextMenu?: (e: React.MouseEvent) => void;
  containerRef?: React.RefObject<HTMLDivElement>;
  /** Warning message to display on the node (e.g., oversized content) */
  warning?: string;
}

export const NodeContainer: React.FC<NodeContainerProps> = ({
  selected,
  dragging,
  children,
  className,
  style,
  onContextMenu,
  containerRef,
  warning,
}) => {
  return (
    <div
      ref={containerRef}
      className={cn(
        dragging ? 'bg-[#0A0A0A]' : 'bg-[#0A0A0A]/80',
        // Keep all visual styles consistent during dragging
        'border rounded-xl relative node-container flex flex-col',
        'min-w-[140px] min-h-[140px] h-full overflow-hidden',
        // Border color - maintain border even when dragging
        selected ? 'border-[#52ddeb]' : warning ? 'border-zinc-600/40' : 'border-gray-700/30',
        dragging && 'pointer-events-none',
        dragging ? 'node-container-dragging' : 'node-container-static',
        // Apply default padding unless overridden by className - maintain padding during dragging
        !className?.includes('p-') && 'node-padding',
        // Smooth transitions for visual consistency
        'transition-all duration-200 ease-out',
        className
      )}
      style={style}
      onContextMenu={onContextMenu}
    >
      {/* Warning indicator for oversized content */}
      <NodeWarningIndicator warning={warning} />
      {children}
    </div>
  );
};
