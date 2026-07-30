import React, { useState, useRef, useMemo } from 'react';
import { Send } from '@/lib/ui/icons';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { pipelineApi, type AssetSource } from '@/services/pipelineApi';
import { getCompatibleTargets, getToolById, toolLabel, type ToolDef } from '@/lib/toolRegistry';
import { useClickOutside } from '@/hooks/useClickOutside';
import { useTranslation } from '@/hooks/useTranslation';
import { toast } from 'sonner';

/**
 * `source` is a pipeline provenance tag (`AssetSource`), NOT a tool id — the two
 * vocabularies only overlap by convention. `halftone`, `riso`, `texture-filter`
 * and `shaders` were standalone tools that got consolidated into modes of
 * `/image-lab`; their pages are gone but the provenance tags stayed (the backend
 * stores them, so renaming them would rewrite history). Without this map their
 * `excludeId` matched nothing and Image Lab offered itself as a "send to" target.
 *
 * Only sources whose tool id DIFFERS from the tag belong here; every other
 * source is passed through and validated against the registry below.
 */
const SOURCE_TO_TOOL_ID: Partial<Record<AssetSource, string>> = {
  halftone: 'image-lab',
  riso: 'image-lab',
  'texture-filter': 'image-lab',
  shaders: 'image-lab',
};

/**
 * Resolves the originating tool so it can be excluded from its own target list.
 * Returns `undefined` for a source with no registry counterpart (e.g. `extractor`,
 * `creative`) — an explicit "nothing to exclude", not a silent miss.
 */
function resolveSourceToolId(source: AssetSource): string | undefined {
  const id = SOURCE_TO_TOOL_ID[source] ?? source;
  if (getToolById(id)) return id;
  if (import.meta.env.DEV) {
    console.warn(
      `[SendToButton] source "${source}" has no tool in toolRegistry — the origin ` +
        `tool will not be excluded from its own targets. Add it to SOURCE_TO_TOOL_ID.`
    );
  }
  return undefined;
}

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
  const { t } = useTranslation();

  const targets = useMemo(
    () => getCompatibleTargets(outputMime, resolveSourceToolId(source)),
    [outputMime, source]
  );

  useClickOutside(containerRef, () => setOpen(false), { enabled: open });

  const handleSend = async (e: React.MouseEvent, target: ToolDef) => {
    e.stopPropagation();
    setSending(true);
    setOpen(false);
    try {
      const captured = getImageBase64 ? await getImageBase64() : undefined;
      const payloadBase64 = captured ?? imageBase64;
      if (!payloadBase64 && !imageUrl) {
        toast.error(t('pipeline.nothingToSend'));
        return;
      }
      await pipelineApi.send({
        source,
        imageUrl: captured ? undefined : imageUrl,
        imageBase64: payloadBase64,
        mimeType,
        label,
      });
      toast.success(t('pipeline.opening', { tool: toolLabel(target, t) }));
      navigate(target.path);
    } catch {
      toast.error(t('pipeline.sendFailed'));
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
        title={t('pipeline.sendTo')}
        className={cn(
          'flex items-center gap-1 rounded-md transition-colors disabled:opacity-50',
          variant === 'node'
            ? 'p-1 bg-transparent hover:bg-neutral-900/40 text-neutral-400 hover:text-neutral-200'
            : 'p-1.5 bg-neutral-800/60 hover:bg-neutral-700/60 text-neutral-400 hover:text-neutral-200 border border-neutral-700/30'
        )}
      >
        <Send size={12} strokeWidth={2} />
        {variant === 'icon' && <span className="text-xs font-mono">{t('pipeline.sendTo')}</span>}
      </button>

      {open && (
        <div className="absolute right-0 bottom-full mb-1 z-50 bg-neutral-900 border border-neutral-700/50 rounded-lg shadow-xl py-1 min-w-[160px] max-h-[240px] overflow-y-auto">
          {targets.map((target) => (
            <button
              key={target.id}
              onClick={(e) => handleSend(e, target)}
              className="w-full text-left px-3 py-1.5 text-xs font-mono text-neutral-300 hover:bg-neutral-800 hover:text-brand-cyan transition-colors flex items-center gap-2"
            >
              <target.icon size={12} className="shrink-0 opacity-60" />
              {toolLabel(target, t)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
