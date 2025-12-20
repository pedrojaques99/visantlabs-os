/**
 * Copyright 2023 Vercel, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use client';

import { cn } from '../../lib/utils';
import { Loader2, Send, Square, X } from 'lucide-react';
import type {
  ComponentProps,
  HTMLAttributes,
  KeyboardEventHandler,
} from 'react';

export type PromptInputProps = HTMLAttributes<HTMLFormElement>;

export const PromptInput = ({ className, ...props }: PromptInputProps) => (
  <form
    className={cn(
      'w-full divide-y overflow-hidden rounded-xl border border-zinc-700/50 bg-black/30 backdrop-blur-sm shadow-sm',
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
        'min-h-[48px] max-h-[164px] bg-transparent text-zinc-200 placeholder-zinc-500',
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
    Icon = <Loader2 className="size-4 animate-spin" />;
  } else if (status === 'streaming') {
    Icon = <Square className="size-4" />;
  } else if (status === 'error') {
    Icon = <X className="size-4" />;
  }

  return (
    <button
      className={cn(
        'flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5',
        'bg-[#52ddeb] text-black font-medium text-sm',
        'hover:bg-[#52ddeb]/90 transition-colors',
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





