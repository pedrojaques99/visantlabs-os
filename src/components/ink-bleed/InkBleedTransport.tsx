import React from 'react';
import { Maximize2, Pause, Play, ZoomIn, ZoomOut } from '@/lib/ui/icons';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/Tooltip';
import { useIsMobile } from '@/hooks/use-media-query';
import { useTranslation } from '@/hooks/useTranslation';
import { cn } from '@/lib/utils';
import { FORMATS } from '@/lib/ink-bleed/engine';
import { useInkBleedStore } from '@/stores/inkBleedStore';
import type { ArtworkViewport } from './InkBleedCanvas';

interface InkBleedTransportProps {
  viewport: ArtworkViewport;
  onTogglePlay: () => void;
}

/** Time and view controls: the one strip of chrome that lives over the artwork. */
export const InkBleedTransport: React.FC<InkBleedTransportProps> = ({ viewport, onTogglePlay }) => {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const progress = useInkBleedStore((s) => s.progress);
  const isPlaying = useInkBleedStore((s) => s.isPlaying);
  const duration = useInkBleedStore((s) => s.doc.motion.duration);
  const format = useInkBleedStore((s) => s.doc.format);
  const setProgress = useInkBleedStore((s) => s.setProgress);
  const setPlaying = useInkBleedStore((s) => s.setPlaying);
  const { width, height } = FORMATS[format];

  return (
    <div
      data-canvas-ui
      className={cn(
        'absolute left-1/2 -translate-x-1/2 z-10 flex items-center gap-3 rounded-full px-2 py-1.5 cursor-default',
        viewport.short ? '-bottom-7' : 'bottom-3',
        'w-[min(640px,calc(100%-24px))]',
        'border border-border bg-card shadow-lg'
      )}
    >
      <Tooltip content={t(isPlaying ? 'inkBleed.transport.pause' : 'inkBleed.transport.play')}>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 rounded-full [@media(pointer:coarse)]:h-11 [@media(pointer:coarse)]:w-11"
          aria-label={t(isPlaying ? 'inkBleed.transport.pause' : 'inkBleed.transport.play')}
          onClick={onTogglePlay}
        >
          {isPlaying ? <Pause size={15} /> : <Play size={15} />}
        </Button>
      </Tooltip>

      <input
        type="range"
        min={0}
        max={1}
        step={0.002}
        value={progress}
        aria-label={t('inkBleed.transport.timeline')}
        onChange={(e) => {
          setPlaying(false);
          setProgress(parseFloat(e.target.value));
        }}
        className="flex-1 min-w-0 h-1 bg-muted bg-clip-content rounded-full appearance-none cursor-pointer accent-foreground [@media(pointer:coarse)]:h-11 [@media(pointer:coarse)]:py-5"
      />

      <span className="shrink-0 text-2xs font-mono tabular-nums text-muted-foreground">
        {(progress * duration).toFixed(1)}s / {duration.toFixed(1)}s
      </span>

      {!isMobile && (
        <>
          <span className="hidden w-px h-4 bg-border shrink-0 xl:block" aria-hidden />
          <span className="hidden shrink-0 text-2xs font-mono tabular-nums text-muted-foreground xl:block">
            {width} × {height}
          </span>
          <div className="flex items-center shrink-0">
            <Tooltip content={t('inkBleed.transport.zoomOut')}>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-full text-muted-foreground [@media(pointer:coarse)]:h-11 [@media(pointer:coarse)]:w-11"
                aria-label={t('inkBleed.transport.zoomOut')}
                onClick={() => viewport.setZoom(viewport.zoom / 1.2)}
              >
                <ZoomOut size={13} />
              </Button>
            </Tooltip>
            <span className="w-9 text-center text-2xs font-mono tabular-nums text-muted-foreground">
              {Math.round(viewport.zoom * 100)}%
            </span>
            <Tooltip content={t('inkBleed.transport.zoomIn')}>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-full text-muted-foreground [@media(pointer:coarse)]:h-11 [@media(pointer:coarse)]:w-11"
                aria-label={t('inkBleed.transport.zoomIn')}
                onClick={() => viewport.setZoom(viewport.zoom * 1.2)}
              >
                <ZoomIn size={13} />
              </Button>
            </Tooltip>
            <Tooltip content={t('inkBleed.transport.fit')}>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-full text-muted-foreground [@media(pointer:coarse)]:h-11 [@media(pointer:coarse)]:w-11"
                aria-label={t('inkBleed.transport.fit')}
                onClick={viewport.fit}
              >
                <Maximize2 size={13} />
              </Button>
            </Tooltip>
          </div>
        </>
      )}
    </div>
  );
};
