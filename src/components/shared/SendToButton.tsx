import React, { useState, useRef, useEffect } from 'react';
import { Send } from 'lucide-react';
import { cn } from '@/lib/utils';
import { pipelineApi, type AssetSource } from '@/services/pipelineApi';
import { toast } from 'sonner';

interface SendToButtonProps {
  source: AssetSource;
  imageUrl?: string;
  imageBase64?: string;
  mimeType?: string;
  label?: string;
  className?: string;
  /** Render as a NodeButton (canvas nodes) vs a plain icon button */
  variant?: 'node' | 'icon';
}

const TARGETS = [
  { label: 'Canvas', value: 'canvas' },
  { label: 'Mockup Machine', value: 'mockupmachine' },
] as const;

export const SendToButton: React.FC<SendToButtonProps> = ({
  source,
  imageUrl,
  imageBase64,
  mimeType,
  label,
  className,
  variant = 'icon',
}) => {
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const handleSend = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setSending(true);
    setOpen(false);
    try {
      await pipelineApi.send({ source, imageUrl, imageBase64, mimeType, label });
      toast.success('Sent to pipeline — open the destination tool to use it');
    } catch {
      toast.error('Failed to send asset');
    } finally {
      setSending(false);
    }
  };

  const toggleOpen = (e: React.MouseEvent) => {
    e.stopPropagation();
    setOpen((v) => !v);
  };

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <button
        onClick={toggleOpen}
        disabled={sending}
        title="Send to →"
        className={cn(
          'flex items-center gap-1 rounded-md transition-colors disabled:opacity-50',
          variant === 'node'
            ? 'p-1 bg-transparent hover:bg-neutral-900/40 text-neutral-400 hover:text-neutral-200'
            : 'p-1.5 bg-neutral-800/60 hover:bg-neutral-700/60 text-neutral-400 hover:text-neutral-200 border border-neutral-700/30'
        )}
      >
        <Send size={12} strokeWidth={2} />
        {variant === 'icon' && <span className="text-xs font-mono">Send to</span>}
      </button>

      {open && (
        <div className="absolute right-0 bottom-full mb-1 z-50 bg-neutral-900 border border-neutral-700/50 rounded-lg shadow-xl py-1 min-w-[140px]">
          {TARGETS.map((t) => (
            <button
              key={t.value}
              onClick={handleSend}
              className="w-full text-left px-3 py-1.5 text-xs font-mono text-neutral-300 hover:bg-neutral-800 hover:text-brand-cyan transition-colors"
            >
              {t.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
