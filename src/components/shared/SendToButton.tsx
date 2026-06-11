import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Send } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { pipelineApi, type AssetSource } from '@/services/pipelineApi';
import { getCompatibleTargets, type ToolDef } from '@/lib/toolRegistry';
import { toast } from 'sonner';

interface SendToButtonProps {
  source: AssetSource;
  /** MIME type of the output asset — used to resolve compatible targets */
  outputMime: string;
  imageUrl?: string;
  imageBase64?: string;
  mimeType?: string;
  label?: string;
  className?: string;
  /** Render as a NodeButton (canvas nodes) vs a plain icon button */
  variant?: 'node' | 'icon';
  /**
   * Lazy capture of the asset at click-time (e.g. snapshot a live canvas).
   * Resolved when the user picks a target; result is sent as `imageBase64`
   * (a full data URL). Takes precedence over the static `imageBase64`/`imageUrl`.
   */
  getImageBase64?: () => string | undefined | Promise<string | undefined>;
}

export const SendToButton: React.FC<SendToButtonProps> = ({
  source,
  outputMime,
  imageUrl,
  imageBase64,
  mimeType,
  label,
  className,
  variant = 'icon',
  getImageBase64,
}) => {
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const targets = useMemo(() => getCompatibleTargets(outputMime, source), [outputMime, source]);

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

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const handleSend = async (e: React.MouseEvent, target: ToolDef) => {
    e.stopPropagation();
    setSending(true);
    setOpen(false);
    try {
      const captured = getImageBase64 ? await getImageBase64() : undefined;
      const payloadBase64 = captured ?? imageBase64;
      if (!payloadBase64 && !imageUrl) {
        toast.error('Nothing to send yet');
        return;
      }
      await pipelineApi.send({
        source,
        imageUrl: captured ? undefined : imageUrl,
        imageBase64: payloadBase64,
        mimeType,
        label,
      });
      toast.success(`Opening ${target.name}…`);
      navigate(target.path);
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

  if (targets.length === 0) return null;

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
        <div className="absolute right-0 bottom-full mb-1 z-50 bg-neutral-900 border border-neutral-700/50 rounded-lg shadow-xl py-1 min-w-[160px] max-h-[240px] overflow-y-auto">
          {targets.map((t) => (
            <button
              key={t.id}
              onClick={(e) => handleSend(e, t)}
              className="w-full text-left px-3 py-1.5 text-xs font-mono text-neutral-300 hover:bg-neutral-800 hover:text-brand-cyan transition-colors flex items-center gap-2"
            >
              <t.icon size={12} className="shrink-0 opacity-60" />
              {t.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
