import React, { useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface InlineEditableProps {
  value: string;
  onCommit: (value: string) => void;
  /** When false, renders plain read-only text. */
  editable?: boolean;
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'p' | 'span' | 'div';
  className?: string;
  placeholder?: string;
  /** Allow newlines (Enter); otherwise Enter commits + blurs. */
  multiline?: boolean;
}

/**
 * Hybrid inline text editor — looks exactly like the surrounding text when
 * read-only, becomes click-to-edit (contentEditable) when `editable`. Commits on
 * blur / Enter (single-line), reverts on Escape. Used for prose fields in the
 * brand view; structured data (colors, logos, etc.) stays in the section editors.
 */
export const InlineEditable: React.FC<InlineEditableProps> = ({
  value,
  onCommit,
  editable = false,
  as: Tag = 'span',
  className,
  placeholder,
  multiline = false,
}) => {
  const ref = useRef<HTMLElement>(null);

  // Keep DOM text in sync with the prop only when not actively editing — avoids
  // caret jumps while typing.
  useEffect(() => {
    const el = ref.current;
    if (el && document.activeElement !== el && el.innerText !== (value || '')) {
      el.innerText = value || '';
    }
  }, [value, editable]);

  if (!editable) {
    return <Tag className={className}>{value || placeholder}</Tag>;
  }

  const commit = () => {
    const text = (ref.current?.innerText ?? '').replace(/\n+$/, '');
    const next = multiline ? text : text.trim();
    if (next !== (value || '')) onCommit(next);
  };

  return (
    <Tag
      ref={ref as React.RefObject<any>}
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      aria-label={placeholder}
      tabIndex={0}
      onBlur={commit}
      onKeyDown={(e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !multiline) {
          e.preventDefault();
          (e.currentTarget as HTMLElement).blur();
        } else if (e.key === 'Escape') {
          if (ref.current) ref.current.innerText = value || '';
          (e.currentTarget as HTMLElement).blur();
        }
      }}
      data-placeholder={placeholder}
      className={cn(
        'outline-none cursor-text rounded-md transition-all -mx-1 px-1',
        'hover:bg-[var(--brand-text)]/[0.04]',
        'focus:bg-[var(--brand-text)]/[0.05] focus:ring-2 focus:ring-[var(--accent)]/40',
        'empty:before:content-[attr(data-placeholder)] empty:before:opacity-30',
        className
      )}
    >
      {value}
    </Tag>
  );
};
