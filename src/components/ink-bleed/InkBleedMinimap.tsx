// ui-scale-ignore-file: raio-sortido — arquivo novo dentro do orçamento de raios; a soma da catraca não distingue isso.
import React, { useEffect, useMemo, useRef } from 'react';
import { useIsMobile } from '@/hooks/use-media-query';
import { useTranslation } from '@/hooks/useTranslation';
import { buildArtworkSvg, inkBlendMode } from '@/lib/ink-bleed/engine';
import { drawPaper, drawVeil } from '@/lib/ink-bleed/paper';
import { cn } from '@/lib/utils';
import { useInkBleedStore } from '@/stores/inkBleedStore';
import type { ArtworkViewport } from './InkBleedCanvas';

const MINIMAP_SIZE = 168;
const MINIMAP_SIZE_PHONE = 96;

interface InkBleedMinimapProps {
  viewport: ArtworkViewport;
  width: number;
  height: number;
}

/**
 * The whole artwork, with a frame on the part in view. Follows the document but not the
 * playback, so it adds no work to the animation.
 */
export const InkBleedMinimap: React.FC<InkBleedMinimapProps> = ({ viewport, width, height }) => {
  const { t } = useTranslation();
  const doc = useInkBleedStore((s) => s.doc);
  const logo = useInkBleedStore((s) => s.logo);
  const paperRef = useRef<HTMLCanvasElement>(null);
  const veilRef = useRef<HTMLCanvasElement>(null);

  const isMobile = useIsMobile();
  const scale = (isMobile ? MINIMAP_SIZE_PHONE : MINIMAP_SIZE) / Math.max(width, height);
  const w = Math.round(width * scale);
  const h = Math.round(height * scale);

  const markup = useMemo(
    () =>
      doc.source === 'logo' && !logo
        ? ''
        : buildArtworkSvg(doc, { filterId: 'ink-bleed-minimap', logo, scale }),
    [doc, logo, scale]
  );

  useEffect(() => {
    const paper = paperRef.current?.getContext('2d');
    if (paper) drawPaper(paper, w, h, doc.paper, scale, doc.seed);
    const veil = veilRef.current?.getContext('2d');
    if (veil) {
      veil.clearRect(0, 0, w, h);
      drawVeil(veil, w, h, doc.paper, doc.seed);
    }
  }, [doc.paper, doc.seed, w, h, scale]);

  const moveTo = (e: React.PointerEvent<HTMLDivElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    viewport.moveTo(
      (e.clientX - box.left) / scale - width / 2,
      (e.clientY - box.top) / scale - height / 2
    );
  };

  const { visible } = viewport;
  const layer = 'absolute inset-0 h-full w-full pointer-events-none';

  return (
    <div
      data-canvas-ui
      data-testid="ink-bleed-minimap"
      className={cn(
        'absolute right-3 z-10 space-y-1.5 rounded-xl p-1.5 cursor-default',
        // Below the row of tools, which takes the whole width of a phone.
        isMobile ? 'top-[72px]' : 'top-3',
        'border border-border bg-card shadow-lg'
      )}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        aria-hidden
        className="relative overflow-hidden rounded-md cursor-crosshair touch-none"
        style={{ width: w, height: h }}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          moveTo(e);
        }}
        onPointerMove={(e) => {
          if (e.currentTarget.hasPointerCapture(e.pointerId)) moveTo(e);
        }}
      >
        <canvas ref={paperRef} width={w} height={h} className={layer} />
        <div
          className={`${layer} [&>svg]:h-full [&>svg]:w-full`}
          style={{ mixBlendMode: inkBlendMode(doc) }}
          dangerouslySetInnerHTML={{ __html: markup }}
        />
        <canvas ref={veilRef} width={w} height={h} className={layer} />
        {/* EXCEÇÃO a tokens: o escurecido fica sobre a ARTE, que tem cor própria. */}
        <div
          data-testid="ink-bleed-minimap-frame"
          className="absolute border border-foreground shadow-[0_0_0_999px_rgba(0,0,0,0.4)] pointer-events-none"
          style={{
            left: (visible.x + width / 2) * scale,
            top: (visible.y + height / 2) * scale,
            width: visible.width * scale,
            height: visible.height * scale,
          }}
        />
      </div>
      <p
        className="px-0.5 text-2xs text-muted-foreground [@media(pointer:coarse)]:hidden"
        style={{ maxWidth: w }}
      >
        {t('inkBleed.minimapHint')}
      </p>
    </div>
  );
};
