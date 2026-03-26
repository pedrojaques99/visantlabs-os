import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Loader2, Paperclip } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useTranslation } from '@/hooks/useTranslation';
import { ModelSelector } from '../ModelSelector';

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

  return (
    <div className={cn("group w-full flex flex-col gap-1.5", className)}>
      <div className={cn(
        "relative flex flex-col w-full rounded-xl transition-all duration-300",
        "bg-white/5 border border-white/10 focus-within:border-white/20 focus-within:bg-white/10",
        disabled && "opacity-50 grayscale cursor-not-allowed"
      )}>
        
        {/* Toolbar Top - Subtle */}
        {(showModelSelector && selectedModel && onModelChange) && (
          <div className="flex items-center px-2 py-1.5 border-b border-white/5">
            <ModelSelector 
              selectedModel={selectedModel} 
              onModelChange={onModelChange} 
              className="!min-w-[120px]"
            />
          </div>
        )}

        {/* Input Area */}
        <div className="flex items-end p-2 gap-2">
          <Textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled || isLoading || isIngesting}
            className={cn(
              "flex-1 min-h-[44px] resize-none bg-transparent border-none focus:ring-0 p-2 text-sm",
              "placeholder:text-white/20 text-white/90 scrollbar-none"
            )}
            style={{ height: `${minHeight}px` }}
          />

          <div className="flex items-center gap-1.5 mb-1">
            {showAttach && onAttachClick && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-white/30 hover:text-white hover:bg-white/5"
                onClick={onAttachClick}
                disabled={isLoading || isIngesting}
              >
                <Paperclip size={18} />
              </Button>
            )}

            <Button
              onClick={onSend}
              disabled={disabled || (!value.trim() && !isIngesting) || isLoading || isIngesting}
              className={cn(
                "h-8 w-8 rounded-lg shadow-xl transition-all duration-300",
                "bg-white/10 hover:bg-white text-white hover:text-black",
                (!value.trim() && !isIngesting) && "opacity-0 scale-90 translate-x-2 pointer-events-none"
              )}
            >
              {isLoading || isIngesting ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Send size={16} />
              )}
            </Button>
          </div>
        </div>
      </div>
      
      {/* Disclaimer sutil */}
      <div className="px-4 text-[9px] uppercase tracking-widest text-white/10 font-mono text-center">
        Powered by Gemini • Visant Labs OS
      </div>
    </div>
  );
};
