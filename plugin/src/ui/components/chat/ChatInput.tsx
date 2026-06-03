import React, { useState, useRef, useEffect, useCallback } from 'react';
import { usePluginStore } from '../../store';
import { useMentions } from '../../hooks/useMentions';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, Paperclip, Zap, Scan, Image, X, Plus } from 'lucide-react';
import { MentionsDropdown } from './MentionsDropdown';
import { ModelSelector } from '@/components/shared/ModelSelector';
import type { Attachment } from '../../store/types';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'application/pdf'];

function fileToAttachment(file: File): Promise<Attachment | null> {
  return new Promise((resolve) => {
    if (file.size > MAX_FILE_SIZE) {
      usePluginStore.getState().showToast(`${file.name} exceeds 5MB limit`, 'error');
      return resolve(null);
    }
    if (!ACCEPTED_TYPES.some((t) => file.type.startsWith(t.split('/')[0]) || file.type === t)) {
      usePluginStore.getState().showToast(`${file.name}: unsupported format`, 'error');
      return resolve(null);
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      resolve({
        id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: file.name,
        type: file.type.startsWith('image/') ? 'image' : 'file',
        size: file.size,
        preview: base64,
      });
    };
    reader.readAsDataURL(file);
  });
}

async function addFiles(files: File[]) {
  const results = await Promise.all(files.map(fileToAttachment));
  const valid = results.filter(Boolean) as Attachment[];
  if (valid.length) {
    usePluginStore.setState((s) => ({
      pendingAttachments: [...s.pendingAttachments, ...valid],
    }));
  }
}

interface ChatInputProps {
  onSend: (content: string) => void;
}

export function ChatInput({ onSend }: ChatInputProps) {
  const [content, setContent] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);
  const {
    thinkMode,
    setThinkMode,
    useBrand,
    setUseBrand,
    scanPage,
    setScanPage,
    generateImage,
    pendingAttachments,
    brandGuideline,
    isGenerating,
    selectedModel,
  } = usePluginStore();

  const mentions = useMentions(textareaRef, setContent);

  const activeBrandName = brandGuideline?.name || brandGuideline?.identity?.name || 'Brand';
  const brandLogo = (
    brandGuideline?.logos?.find((l) => l.variant === 'icon' || l.variant === 'primary') ??
    brandGuideline?.logos?.[0]
  )?.url;

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
    addFiles(Array.from(e.target.files || []));
    e.target.value = '';
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length) addFiles(files);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.types.includes('Files')) setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDragging(false);
  }, []);

  // Paste images from clipboard
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      const imageFiles: File[] = [];
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          const file = items[i].getAsFile();
          if (file) imageFiles.push(file);
        }
      }
      if (imageFiles.length) {
        e.preventDefault();
        addFiles(imageFiles);
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []);

  const removeAttachment = (id: string) => {
    usePluginStore.setState((s) => ({
      pendingAttachments: s.pendingAttachments.filter((a) => a.id !== id),
    }));
  };

  // Close actions menu on outside click
  useEffect(() => {
    if (!showActions) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (actionsRef.current && !actionsRef.current.contains(e.target as Node)) {
        setShowActions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showActions]);

  const activeActionsCount = [scanPage, generateImage].filter(Boolean).length;

  return (
    <div
      ref={containerRef}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      className={`border-t border-border bg-card p-2.5 space-y-1.5 transition-colors ${
        isDragging ? 'bg-brand-cyan/5 border-brand-cyan/40' : ''
      }`}
    >
      {/* Toolbar — muted config row */}
      <div className="flex items-center gap-1.5 px-0.5">
        <ModelSelector
          selectedModel={selectedModel}
          onModelChange={(model) => usePluginStore.setState({ selectedModel: model })}
          type={generateImage ? 'image' : 'chat'}
          className="!bg-transparent border-white/5 hover:border-white/10 !px-1.5 !py-0 h-5 text-[10px] opacity-60 hover:opacity-100 transition-opacity"
        />

        <div className="w-px h-3 bg-border" />

        <button
          type="button"
          onClick={() => setThinkMode(!thinkMode)}
          className={`flex items-center gap-1 h-5 px-1.5 rounded text-[10px] font-medium transition-all ${
            thinkMode
              ? 'text-brand-cyan bg-brand-cyan/8'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Zap size={9} className={thinkMode ? 'text-brand-cyan' : ''} />
          Think
        </button>

        <button
          type="button"
          onClick={() => setUseBrand(!useBrand)}
          className={`flex items-center gap-1.5 h-5 px-1.5 rounded text-[10px] font-medium transition-all truncate max-w-[120px] ${
            useBrand
              ? 'text-brand-cyan bg-brand-cyan/8'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {useBrand && brandLogo ? (
            <img src={brandLogo} alt="" className="w-3 h-3 rounded-full object-contain shrink-0" />
          ) : (
            <span className="w-1.5 h-1.5 rounded-full bg-current shrink-0 opacity-50" />
          )}
          <span className="truncate">{useBrand ? activeBrandName : 'Brand'}</span>
        </button>
      </div>

      {/* Attachment Preview */}
      {pendingAttachments.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-0.5">
          {pendingAttachments.map((att) => (
            <div key={att.id} className="relative group">
              {att.type === 'image' && att.preview ? (
                <img
                  src={att.preview}
                  alt={att.name}
                  className="w-12 h-12 rounded object-cover border border-border"
                />
              ) : (
                <div className="w-12 h-12 rounded border border-border bg-muted flex items-center justify-center">
                  <Paperclip size={12} className="text-muted-foreground" />
                </div>
              )}
              <button
                type="button"
                onClick={() => removeAttachment(att.id)}
                className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X size={8} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input area */}
      <div className="relative rounded-lg border border-border bg-background/50 focus-within:border-brand-cyan/30 transition-colors">
        <Textarea
          ref={textareaRef}
          value={content}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder="Descreva o que deseja criar..."
          className="min-h-[36px] max-h-24 text-sm resize-none py-2 px-3 border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
          rows={1}
        />
        <MentionsDropdown
          isOpen={mentions.isOpen}
          items={mentions.items}
          selectedIndex={mentions.selectedIndex}
          onSelect={mentions.selectMention}
        />

        {/* Bottom bar inside textarea container */}
        <div className="flex items-center justify-between px-2 pb-1.5">
          <div className="flex items-center gap-0.5">
            {/* Actions menu (Scan, Image) */}
            <div ref={actionsRef} className="relative">
              <button
                type="button"
                onClick={() => setShowActions(!showActions)}
                className={`flex items-center justify-center h-7 w-7 rounded-md transition-colors ${
                  showActions || activeActionsCount > 0
                    ? 'text-brand-cyan bg-brand-cyan/8'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                <Plus size={16} />
                {activeActionsCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-brand-cyan text-black text-[8px] font-bold flex items-center justify-center">
                    {activeActionsCount}
                  </span>
                )}
              </button>

              {showActions && (
                <div className="absolute bottom-full left-0 mb-1 bg-popover border border-border rounded-lg shadow-lg py-1 min-w-[140px] z-50">
                  <button
                    type="button"
                    onClick={() => {
                      setScanPage(!scanPage);
                      setShowActions(false);
                    }}
                    className={`flex items-center gap-2 w-full px-3 py-1.5 text-xs transition-colors ${
                      scanPage ? 'text-brand-cyan' : 'text-foreground hover:bg-muted'
                    }`}
                  >
                    <Scan size={13} />
                    Scan page
                    {scanPage && <span className="ml-auto text-brand-cyan">✓</span>}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      usePluginStore.setState({ generateImage: !generateImage });
                      setShowActions(false);
                    }}
                    className={`flex items-center gap-2 w-full px-3 py-1.5 text-xs transition-colors ${
                      generateImage ? 'text-brand-cyan' : 'text-foreground hover:bg-muted'
                    }`}
                  >
                    <Image size={13} />
                    Generate image
                    {generateImage && <span className="ml-auto text-brand-cyan">✓</span>}
                  </button>
                </div>
              )}
            </div>

            <label htmlFor="file-input" className="cursor-pointer">
              <span className="flex items-center justify-center h-7 w-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                <Paperclip size={15} />
              </span>
            </label>
            <input
              id="file-input"
              type="file"
              multiple
              accept="image/png,image/jpeg,image/gif,image/webp,application/pdf"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>

          <Button
            onClick={handleSend}
            size="icon"
            className="h-7 w-7 rounded-lg bg-brand-cyan text-black hover:bg-brand-cyan/90"
            disabled={!content.trim() || isGenerating}
          >
            <Send size={14} />
          </Button>
        </div>
      </div>
    </div>
  );
}
