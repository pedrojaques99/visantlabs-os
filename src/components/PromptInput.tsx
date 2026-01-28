import React, { useRef, useEffect } from 'react';
import { Textarea } from './ui/textarea';
import { cn } from '../lib/utils';

interface PromptInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  textareaRef?: React.RefObject<HTMLTextAreaElement>;
}

export const PromptInput: React.FC<PromptInputProps> = ({
  value,
  onChange,
  onSubmit,
  placeholder = 'Type your message...',
  disabled = false,
  className,
  textareaRef: externalTextareaRef,
}) => {
  const internalTextareaRef = useRef<HTMLTextAreaElement>(null);
  const textareaRef = externalTextareaRef || internalTextareaRef;

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [value]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim() && !disabled) {
      onSubmit(value.trim());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <form onSubmit={handleSubmit} className={cn('w-full', className)}>
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        className="min-h-[80px] max-h-[300px] resize-none w-full nodrag nopan"
        rows={3}
      />
    </form>
  );
};

