import React, { useState, useRef, useEffect } from 'react';
import { usePluginStore } from '../../store';
import { useMentions } from '../../hooks/useMentions';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, Paperclip, Zap, Scan } from 'lucide-react';
import { MentionsDropdown } from './MentionsDropdown';

interface ChatInputProps {
  onSend: (content: string) => void;
}

export function ChatInput({ onSend }: ChatInputProps) {
  const [content, setContent] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const {
    thinkMode,
    setThinkMode,
    useBrand,
    setUseBrand,
    scanPage,
    setScanPage,
    pendingAttachments
  } = usePluginStore();

  const mentions = useMentions(textareaRef);

  const handleSend = () => {
    if (content.trim()) {
      onSend(content);
      setContent('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.focus();
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    mentions.handleKeyDown(e);
  };

  const handleInput = (e: React.FormEvent<HTMLTextAreaElement>) => {
    const textarea = e.currentTarget;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
    setContent(textarea.value);
    mentions.checkForMention();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.forEach((file) => {
      // Handle file attachment
      const reader = new FileReader();
      reader.onload = (event) => {
        // Store attachment in store
      };
      reader.readAsDataURL(file);
    });
  };

  return (
    <div ref={containerRef} className="border-t border-border bg-card p-4 space-y-3">
      {/* Control Pills */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setThinkMode(!thinkMode)}
          className={`text-xs h-6 px-3 rounded font-mono flex items-center gap-1 transition ${
            thinkMode
              ? 'bg-brand-cyan/10 text-brand-cyan border border-brand-cyan/30'
              : 'bg-muted hover:bg-muted/80 text-muted-foreground'
          }`}
        >
          <Zap size={12} />
          Think Mode
        </button>

        <button
          onClick={() => setUseBrand(!useBrand)}
          className={`text-xs h-6 px-3 rounded font-mono flex items-center gap-1 transition ${
            useBrand
              ? 'bg-brand-cyan/10 text-brand-cyan border border-brand-cyan/30'
              : 'bg-muted hover:bg-muted/80 text-muted-foreground'
          }`}
        >
          Brand
        </button>

        <button
          onClick={() => setScanPage(!scanPage)}
          className={`text-xs h-6 px-3 rounded font-mono flex items-center gap-1 transition ${
            scanPage
              ? 'bg-brand-cyan/10 text-brand-cyan border border-brand-cyan/30'
              : 'bg-muted hover:bg-muted/80 text-muted-foreground'
          }`}
        >
          <Scan size={12} />
          Scan Page
        </button>
      </div>

      {/* Attachment Preview */}
      {pendingAttachments.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {pendingAttachments.map((att) => (
            <div
              key={att.id}
              className="flex items-center gap-2 bg-muted border border-border rounded px-2 py-1 text-xs text-muted-foreground"
            >
              <span className="truncate">{att.name}</span>
            </div>
          ))}
        </div>
      )}

      {/* Input Area */}
      <div className="relative flex gap-2">
        <div className="flex-1 relative">
          <Textarea
            ref={textareaRef}
            value={content}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder="Descreva o que deseja criar... (Shift+Enter para quebra de linha)"
            className="flex-1 max-h-24 text-sm resize-none"
            rows={1}
          />
          <MentionsDropdown
            isOpen={mentions.isOpen}
            items={mentions.items}
            selectedIndex={mentions.selectedIndex}
            onSelect={mentions.selectMention}
          />
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="file-input" className="cursor-pointer">
            <Button variant="ghost" size="icon" className="h-10 w-10" asChild>
              <span>
                <Paperclip size={16} />
              </span>
            </Button>
          </label>
          <input
            id="file-input"
            type="file"
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />

          <Button
            onClick={handleSend}
            size="icon"
            className="h-10 w-10 bg-brand-cyan text-black hover:bg-brand-cyan/90"
            disabled={!content.trim()}
          >
            <Send size={16} />
          </Button>
        </div>
      </div>
    </div>
  );
}
