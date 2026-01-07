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
  /** Callback for double-click on resize handles to fit content */
  onFitToContent?: () => void;
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
  onFitToContent,
}) => {
  const handleDoubleClick = (e: React.MouseEvent) => {
    // Check if the target is a resize handle
    const target = e.target as HTMLElement;
    const isResizeHandle =
      target.classList.contains('react-flow__resize-control') ||
      target.classList.contains('react-flow__handle-resize') ||
      target.closest('.react-flow__resize-control') !== null;

    if (isResizeHandle && onFitToContent) {
      e.stopPropagation();
      onFitToContent();
    }
  };

  return (
    <div
      ref={containerRef}
      onDoubleClick={handleDoubleClick}
      className={cn(
        dragging ? 'bg-[#0A0A0A]' : 'bg-[#0A0A0A]/80',
        // Keep all visual styles consistent during dragging
        'border rounded-xl relative node-container flex flex-col',
        'min-w-[140px] min-h-[140px] min-h-full rounded-xl',
        // Border color - maintain border even when dragging
        selected ? 'border-[brand-cyan]' : warning ? 'border-zinc-600/40' : 'border-gray-700/30',
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
