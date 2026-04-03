import React from 'react';
import { cn } from '@/lib/utils';
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

  // Extract opacity from style prop if provided, otherwise use default
  const customOpacity = style?.opacity;
  const { opacity: _, ...styleWithoutOpacity } = style || {};

  return (
    <div
      ref={containerRef}
      onDoubleClick={handleDoubleClick}
      className={cn(
        // Keep all visual styles consistent during dragging
        'border border-white/8 rounded-2xl relative node-container flex flex-col backdrop-blur-xl',
        'min-w-[200px] h-fit rounded-2xl',
        // Default gap and space-y if not overridden
        'gap-[var(--node-gap)]',
        // Border color - maintain border even when dragging
        selected ? 'border-brand-cyan shadow-[0_0_15px_rgba(var(--brand-cyan-rgb),0.1)]' : warning ? 'border-neutral-600/40' : 'border-gray-700/30',
        dragging && 'pointer-events-none',
        dragging ? 'node-container-dragging' : 'node-container-static',
        // Apply default padding unless overridden by className - maintain padding during dragging
        !className?.includes('p-') && 'node-padding',
        // Smooth transitions for visual consistency
        'transition-all duration-200 ease-out',
        className
      )}
      style={{
        // Use CSS custom property for background color (set by CanvasFlow)
        // Falls back to neutral-950 if not available
        backgroundColor: dragging 
          ? 'var(--node-bg-color-dragging, #0a0a0a)' 
          : 'var(--node-bg-color, #0a0a0a)',
        // Use opacity from style prop if provided, otherwise use default
        opacity: customOpacity !== undefined ? customOpacity : 1,
        // Pass through text color variables for button/textarea contrast
        '--node-text-color': 'var(--node-text-color, #e5e7eb)',
        '--node-text-color-muted': 'var(--node-text-color-muted, #d1d5db)',        '--node-text-color-subtle': 'var(--node-text-color-subtle, #9ca3af)',
        // Spread style prop (without opacity) to allow other overrides
        ...styleWithoutOpacity,
      } as React.CSSProperties}
      onContextMenu={onContextMenu}
    >
      {/* Warning indicator for oversized content */}
      <NodeWarningIndicator warning={warning} />
      {children}
    </div>
  );
};
