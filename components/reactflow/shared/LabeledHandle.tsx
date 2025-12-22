import React from 'react';
import { Handle, Position, type HandleProps } from '@xyflow/react';
import { cn } from '../../../lib/utils';

export type HandleType = 'image' | 'text' | 'strategy' | 'generic' | 'video';

interface LabeledHandleProps extends HandleProps {
  label?: string;
  labelClassName?: string;
  handleType?: HandleType;
}

export const LabeledHandle: React.FC<LabeledHandleProps> = ({
  label,
  labelClassName,
  className,
  position,
  style,
  id,
  handleType = 'generic',
  ...handleProps
}) => {
  const isLeft = position === Position.Left;
  const isRight = position === Position.Right;
  const isTop = position === Position.Top;
  const isBottom = position === Position.Bottom;

  // Extract top position from CSS class if no style is provided
  const getTopFromClass = (cls?: string): string | undefined => {
    if (!cls) return undefined;
    const match = cls.match(/handle-top-(\d+)/);
    if (match) {
      return `${match[1]}%`;
    }
    return undefined;
  };

  // Remove handle-top-* classes if style.top is provided (to avoid !important conflicts)
  const cleanClassName = style?.top
    ? className?.replace(/handle-top-\d+/g, '').trim() || undefined
    : className;

  const labelStyle: React.CSSProperties = {};
  if (style) {
    if (isLeft || isRight) {
      labelStyle.top = style.top || '50%';
    } else {
      labelStyle.left = style.left || '50%';
    }
  } else if (isLeft || isRight) {
    // If no style but has CSS class, extract position from class
    const topFromClass = getTopFromClass(className);
    if (topFromClass) {
      labelStyle.top = topFromClass;
    } else {
      labelStyle.top = '50%';
    }
  }

  // Use style as-is - React will apply it and CSS won't override explicit values
  const handleStyle: React.CSSProperties = style;

  return (
    <>
      <Handle
        {...handleProps}
        id={id}
        position={position}
        style={handleStyle}
        className={cn('node-handle labeled-handle', `handle-${handleType}`, cleanClassName)}
        data-handle-label={label}
        data-handle-type={handleType}
      />
      {label && (
        <div
          className={cn(
            'handle-label absolute text-[10px] font-mono text-zinc-400 whitespace-nowrap pointer-events-none z-50',
            'opacity-0 transition-opacity duration-200',
            'bg-zinc-900/90 px-1.5 py-0.5 rounded border border-zinc-700/50',
            isLeft && 'right-full mr-2',
            isRight && 'left-full ml-2',
            isTop && 'bottom-full mb-2',
            isBottom && 'top-full mt-2',
            labelClassName
          )}
          data-handle-id={id}
          style={{
            ...labelStyle,
            ...(isLeft || isRight
              ? { transform: 'translateY(-50%)' }
              : { transform: 'translateX(-50%)' }),
          }}
        >
          {label}
        </div>
      )}
    </>
  );
};
