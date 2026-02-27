'use client';

import { cn } from '@/lib/utils';
import { Send, Square, X } from 'lucide-react';
import { GlitchLoader } from '@/components/ui/GlitchLoader';
import type {
  ComponentProps,
  HTMLAttributes,
  KeyboardEventHandler,
} from 'react';

export type PromptInputProps = HTMLAttributes<HTMLFormElement>;

export const PromptInput = ({ className, ...props }: PromptInputProps) => (
  <form
    className={cn(
      'w-full divide-y overflow-hidden rounded-xl border border-neutral-700/50 bg-neutral-950/30 backdrop-blur-sm shadow-sm',
      className
    )}
    {...props}
  />
);

export type PromptInputTextareaProps = ComponentProps<'textarea'> & {
  minHeight?: number;
  maxHeight?: number;
};

export const PromptInputTextarea = ({
  onChange,
  className,
  placeholder = 'Describe what you want to change...',
  minHeight = 48,
  maxHeight = 164,
  ...props
}: PromptInputTextareaProps) => {
  const handleKeyDown: KeyboardEventHandler<HTMLTextAreaElement> = (e) => {
    if (e.key === 'Enter') {
      if (e.shiftKey) {
        // Allow newline
        return;
      }
      // Submit on Enter (without Shift)
      e.preventDefault();
      const form = e.currentTarget.form;
      if (form) {
        form.requestSubmit();
      }
    }
  };

  return (
    <textarea
      className={cn(
        'w-full resize-y rounded-none border-none p-3 shadow-none outline-none ring-0',
        'min-h-[48px] max-h-[164px] bg-transparent text-neutral-200 placeholder-neutral-500',
        'focus-visible:ring-0 focus:outline-none',
        className
      )}
      name="message"
      onChange={(e) => {
        // Auto-resize
        e.currentTarget.style.height = 'auto';
        const newHeight = Math.min(Math.max(e.currentTarget.scrollHeight, minHeight), maxHeight);
        e.currentTarget.style.height = `${newHeight}px`;
        onChange?.(e);
      }}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      style={{ minHeight: `${minHeight}px`, maxHeight: `${maxHeight}px` }}
      {...props}
    />
  );
};

export type PromptInputToolbarProps = HTMLAttributes<HTMLDivElement>;

export const PromptInputToolbar = ({
  className,
  ...props
}: PromptInputToolbarProps) => (
  <div
    className={cn('flex items-center justify-end p-2', className)}
    {...props}
  />
);

export type PromptInputSubmitProps = ComponentProps<'button'> & {
  status?: 'submitted' | 'streaming' | 'ready' | 'error';
};

export const PromptInputSubmit = ({
  className,
  status = 'ready',
  children,
  disabled,
  ...props
}: PromptInputSubmitProps) => {
  let Icon = <Send className="size-4" />;
  if (status === 'submitted') {
    Icon = <GlitchLoader size={16} />;
  } else if (status === 'streaming') {
    Icon = <Square className="size-4" />;
  } else if (status === 'error') {
    Icon = <X className="size-4" />;
  }

  return (
    <button
      className={cn(
        'flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5',
        'bg-brand-cyan text-black font-medium text-sm',
        'hover:bg-brand-cyan/90 transition-colors',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        className
      )}
      type="submit"
      disabled={disabled || status === 'submitted' || status === 'streaming'}
      {...props}
    >
      {children ?? Icon}
    </button>
  );
};





