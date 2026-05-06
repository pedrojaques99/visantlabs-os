import React, { useState, useRef, useEffect } from 'react';
import { usePluginStore } from '../../store';
import { useMentions } from '../../hooks/useMentions';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Send, Paperclip, Zap, Scan, X } from 'lucide-react';
import { MentionsDropdown } from './MentionsDropdown';
import type { Attachment } from '../../store/types';

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
    pendingAttachments,
    brandGuideline
  } = usePluginStore();

  const mentions = useMentions(textareaRef, setContent);

  const activeBrandName = brandGuideline?.name || brandGuideline?.identity?.name || 'Brand';
  const brandLogo = (brandGuideline?.logos?.find(l => l.variant === 'icon' || l.variant === 'primary') ?? brandGuideline?.logos?.[0])?.url;

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
    // Let mentions handle navigation/selection first
    if (mentions.isOpen) {
      mentions.handleKeyDown(e);
      if (e.defaultPrevented) return;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
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
    const maxSize = 5 * 1024 * 1024; // 5MB

    files.forEach((file) => {
      if (file.size > maxSize) {
        usePluginStore.getState().showToast(`${file.name} exceeds 5MB limit`, 'error');
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        const attachment: Attachment = {
          id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          name: file.name,
          type: file.type.startsWith('image/') ? 'image' : 'file',
          size: file.size,
          preview: base64,
        };
        usePluginStore.setState((s) => ({
          pendingAttachments: [...s.pendingAttachments, attachment],
        }));
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const removeAttachment = (id: string) => {
    usePluginStore.setState((s) => ({
      pendingAttachments: s.pendingAttachments.filter((a) => a.id !== id),
    }));
  };

  return (
    <div ref={containerRef} className="border-t border-border bg-card p-3 space-y-2">
      {/* Control Pills */}
      <div className="flex gap-2 flex-wrap items-center">
        <Button
          variant={thinkMode ? "default" : "secondary"}
          onClick={() => setThinkMode(!thinkMode)}
          className={`h-6 px-2.5 text-[10px] font-mono items-center gap-1 shrink-0 ${thinkMode ? 'bg-brand-cyan/10 text-brand-cyan hover:bg-brand-cyan/20 border border-brand-cyan/30' : ''}`}
        >
           <Zap size={10} />
           THINK
        </Button>

        <Button
          variant={useBrand ? "default" : "secondary"}
          onClick={() => setUseBrand(!useBrand)}
          className={`h-6 px-2.5 text-[10px] font-mono items-center gap-2 shrink-0 transition-all ${useBrand ? 'bg-brand-cyan/10 text-brand-cyan hover:bg-brand-cyan/20 border border-brand-cyan/30' : ''}`}
        >
           {useBrand && brandLogo && (
             <img src={brandLogo} alt="" className="w-3 h-3 rounded-full object-contain" />
           )}
           <span className="truncate max-w-[100px]">{useBrand ? activeBrandName : 'BRAND OFF'}</span>
        </Button>

         <Button
           variant={scanPage ? "default" : "secondary"}
           onClick={() => setScanPage(!scanPage)}
           className={`h-6 px-2.5 text-[10px] font-mono items-center gap-1 shrink-0 ${scanPage ? 'bg-brand-cyan/10 text-brand-cyan hover:bg-brand-cyan/20 border border-brand-cyan/30' : ''}`}
         >
           <Scan size={10} />
           SCAN
         </Button>
      </div>

       {/* Attachment Preview */}
       {pendingAttachments.length > 0 && (
         <div className="flex flex-wrap gap-2 pt-1">
           {pendingAttachments.map((att) => (
             <div key={att.id} className="relative group">
               {att.type === 'image' && att.preview ? (
                 <img
                   src={att.preview}
                   alt={att.name}
                   className="w-14 h-14 rounded-md object-cover border border-border"
                 />
               ) : (
                 <div className="w-14 h-14 rounded-md border border-border bg-muted flex items-center justify-center">
                   <Paperclip size={14} className="text-muted-foreground" />
                 </div>
               )}
               <button
                 type="button"
                 onClick={() => removeAttachment(att.id)}
                 className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
               >
                 <X size={10} />
               </button>
             </div>
           ))}
         </div>
       )}

      {/* Input Area - Horizontal Refactor */}
      <div className="flex items-end gap-2">
        <div className="flex-1 relative">
          <Textarea
            ref={textareaRef}
            value={content}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder="Descreva o que deseja criar..."
            className="flex-1 min-h-[36px] max-h-24 text-sm resize-none py-2 px-3 focus-visible:ring-brand-cyan/30"
            rows={1}
          />
          <MentionsDropdown
            isOpen={mentions.isOpen}
            items={mentions.items}
            selectedIndex={mentions.selectedIndex}
            onSelect={mentions.selectMention}
          />
        </div>

        <div className="flex items-center gap-1.5 mb-[2px]">
          <label htmlFor="file-input" className="cursor-pointer">
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" asChild>
              <span>
                <Paperclip size={16} />
              </span>
            </Button>
          </label>
          <input
            id="file-input"
            type="file"
            multiple
            accept="image/png,image/jpeg,image/gif,image/webp,application/pdf"
            onChange={handleFileSelect}
            className="hidden"
          />

          <Button
            onClick={handleSend}
            size="icon"
            className="h-8 w-8 bg-brand-cyan text-black hover:bg-brand-cyan/90 shadow-[0_0_15px_rgba(0,255,255,0.2)]"
            disabled={!content.trim()}
          >
            <Send size={16} />
          </Button>
        </div>
      </div>
    </div>

  );
}
