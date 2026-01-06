import React from 'react';
import { Textarea } from '../../../components/ui/textarea';
import { cn } from '../../../lib/utils';

interface DrawingTextRendererProps {
  text: string;
  textColor: string;
  fontSize: number;
  fontFamily: string;
  isEditing?: boolean;
  onTextChange?: (value: string) => void;
  onEditStart?: () => void;
  onEditEnd?: () => void;
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
}

export const DrawingTextRenderer: React.FC<DrawingTextRendererProps> = ({
  text,
  textColor,
  fontSize,
  fontFamily,
  isEditing = false,
  onTextChange,
  onEditStart,
  onEditEnd,
  placeholder = 'Click to edit text...',
  className,
  style,
}) => {
  const textStyle: React.CSSProperties = {
    color: textColor,
    fontSize: `${fontSize}px`,
    fontFamily,
    minHeight: '40px',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    ...style,
  };

  if (isEditing) {
    return (
      <Textarea
        value={text}
        onChange={(e) => {
          e.stopPropagation();
          onTextChange?.(e.target.value);
        }}
        onBlur={onEditEnd}
        onKeyDown={(e) => {
          // Allow Escape to cancel editing
          if (e.key === 'Escape') {
            e.stopPropagation();
            onEditEnd?.();
          }
          // Allow Enter to confirm (but don't prevent default to allow new lines with Shift+Enter)
          if (e.key === 'Enter' && !e.shiftKey) {
            // Optionally: uncomment to confirm on Enter
            // e.preventDefault();
            // onEditEnd?.();
          }
          e.stopPropagation();
        }}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        placeholder={placeholder}
        className={cn(
          'w-full h-full resize-none nodrag nopan bg-transparent border border-brand-cyan/50 rounded outline-none focus:ring-2 focus:ring-brand-cyan/50 focus:border-brand-cyan p-2 drawing-text-editor',
          className
        )}
        style={textStyle}
        autoFocus
      />
    );
  }

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        onEditStart?.();
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onEditStart?.();
      }}
      className={cn('w-full h-full p-2 cursor-text', className)}
      style={textStyle}
    >
      {text || (
        <span className="opacity-50">{placeholder}</span>
      )}
    </div>
  );
};

