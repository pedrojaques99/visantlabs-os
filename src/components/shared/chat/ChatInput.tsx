import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Paperclip } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useTranslation } from '@/hooks/useTranslation';
import { ModelSelector } from '../ModelSelector';

import { GlitchLoader } from '@/components/ui/GlitchLoader'
interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  isLoading?: boolean;
  isIngesting?: boolean;
  placeholder?: string;
  onAttachClick?: () => void;
  showAttach?: boolean;
  minHeight?: number;
  maxHeight?: number;
  className?: string;
  disabled?: boolean;
  selectedModel?: string;
  onModelChange?: (model: string) => void;
  showModelSelector?: boolean;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  value,
  onChange,
  onSend,
  isLoading = false,
  isIngesting = false,
  placeholder = "Digite sua mensagem...",
  onAttachClick,
  showAttach = false,
  minHeight = 44,
  maxHeight = 200,
  className,
  disabled = false,
  selectedModel,
  onModelChange,
  showModelSelector = false,
}) => {
  const { t } = useTranslation();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      const newHeight = Math.max(textarea.scrollHeight, minHeight);
      textarea.style.height = `${Math.min(newHeight, maxHeight)}px`;
    }
  }, [minHeight, maxHeight]);

  useEffect(() => {
    adjustHeight();
  }, [value, adjustHeight]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  const hasModelSelector = showModelSelector && selectedModel && onModelChange;

  return (
    <div className={cn("group w-full flex flex-col gap-1.5", className)}>
      <div className={cn(
        "relative flex flex-col w-full rounded-2xl transition-all duration-300",
        "bg-white/5 border border-white/10 focus-within:border-white/20 focus-within:bg-white/10",
        disabled && "opacity-50 grayscale cursor-not-allowed"
      )}>
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled || isLoading || isIngesting}
          className={cn(
            "flex-1 min-h-[44px] resize-none bg-transparent border-none outline-none focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 px-4 py-3 text-sm",
            "placeholder:text-white/20 text-white/90 scrollbar-none"
          )}
          style={{ height: `${minHeight}px` }}
        />

        {/* Bottom action row — attach (left) + model + send (right) */}
        <div className="flex items-center justify-between px-2 pb-2 gap-2">
          <div className="flex items-center">
            {showAttach && onAttachClick && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-white/30 hover:text-white hover:bg-white/5"
                onClick={onAttachClick}
                disabled={isLoading || isIngesting}
                aria-label="Anexar arquivo"
              >
                <Paperclip size={18} />
              </Button>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {hasModelSelector && (
              <ModelSelector
                selectedModel={selectedModel!}
                onModelChange={onModelChange!}
                className="!min-w-[120px]"
              />
            )}

            <Button
              onClick={onSend}
              disabled={disabled || (!value.trim() && !isIngesting) || isLoading || isIngesting}
              className={cn(
                "h-8 w-8 rounded-lg shadow-xl transition-all duration-300",
                "bg-white/10 hover:bg-white text-white hover:text-black",
                (!value.trim() && !isIngesting) && "opacity-0 scale-90 translate-x-2 pointer-events-none"
              )}
              aria-label="Enviar"
            >
              {isLoading || isIngesting ? (
                <GlitchLoader size={16} />
              ) : (
                <Send size={16} />
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Disclaimer sutil */}
      <div className="px-4 text-xs text-white/20 text-center">
        Powered by Gemini · Visant Labs OS
      </div>
    </div>
  );
};
