import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Dropzone } from '@/components/ui/Dropzone';
import { useTranslation } from '@/hooks/useTranslation';
import { FORMATS, buildArtworkSvg, inkBlendMode } from '@/lib/ink-bleed/engine';
import { drawPaper, drawVeil } from '@/lib/ink-bleed/paper';
import { cn } from '@/lib/utils';
import { useInkBleedStore } from '@/stores/inkBleedStore';
import { InkBleedMinimap } from './InkBleedMinimap';

/** Preview resolution while something moves. Exports never use it. */
const DRAFT_SCALE = 0.5;
const DRAFT_SETTLE_MS = 180;
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 4;
// Keeps the artwork clear of the floating tools above it and the transport pill below.
const FIT_INSET = { x: 48, top: 56, bottom: 88 };

export function clampZoom(value: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));
}

export interface ArtworkViewport {
  containerRef: React.RefObject<HTMLDivElement | null>;
  zoom: number;
  pan: { x: number; y: number };
  setZoom: (zoom: number) => void;
  fit: () => void;
  /** Part of the artwork is out of view, so there is somewhere to move to. */
  canMove: boolean;
  /** Puts this point of the artwork in the middle of the view. Measured from its center. */
  moveTo: (x: number, y: number) => void;
  /** The part of the artwork in view, measured from its center. */
  visible: { x: number; y: number; width: number; height: number };
}

const limit = (value: number, max: number) => Math.min(max, Math.max(-max, value));

/** The artwork does not follow the mouse. It only moves when someone asks it to. */
export function useArtworkViewport(width: number, height: number): ArtworkViewport {
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoomState] = useState(0.7);
  const [focus, setFocus] = useState({ x: 0, y: 0 });
  const [size, setSize] = useState({ width: 0, height: 0 });
  const fitted = useRef(true);

  const availableW = Math.max(0, size.width - FIT_INSET.x * 2);
  const availableH = Math.max(0, size.height - FIT_INSET.top - FIT_INSET.bottom);
  // How far the view can travel before an edge of the artwork leaves the clear area.
  const roomX = Math.max(0, width * zoom - availableW) / 2 / zoom;
  const roomY = Math.max(0, height * zoom - availableH) / 2 / zoom;
  const focusX = limit(focus.x, roomX);
  const focusY = limit(focus.y, roomY);

  const fit = useCallback(() => {
    fitted.current = true;
    const el = containerRef.current;
    if (!el) return;
    const fitW = el.clientWidth - FIT_INSET.x * 2;
    const fitH = el.clientHeight - FIT_INSET.top - FIT_INSET.bottom;
    if (fitW <= 0 || fitH <= 0) return;
    setZoomState(clampZoom(Math.min(fitW / width, fitH / height, 1)));
    setFocus({ x: 0, y: 0 });
  }, [width, height]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => setSize({ width: el.clientWidth, height: el.clientHeight });
    measure();
    fit();
    const observer = new ResizeObserver(() => {
      measure();
      if (fitted.current) fit();
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [fit]);

  const setZoom = useCallback((value: number) => {
    fitted.current = false;
    setZoomState(clampZoom(value));
  }, []);

  const moveTo = useCallback(
    (x: number, y: number) => {
      fitted.current = false;
      setFocus({ x: limit(x, roomX), y: limit(y, roomY) });
    },
    [roomX, roomY]
  );

  const visibleW = zoom > 0 ? Math.min(width, availableW / zoom) : width;
  const visibleH = zoom > 0 ? Math.min(height, availableH / zoom) : height;

  return {
    containerRef,
    zoom,
    pan: {
      x: -focusX * zoom,
      y: (FIT_INSET.top - FIT_INSET.bottom) / 2 - focusY * zoom,
    },
    setZoom,
    fit,
    canMove: roomX > 0 || roomY > 0,
    moveTo,
    visible: {
      x: focusX - visibleW / 2,
      y: focusY - visibleH / 2,
      width: visibleW,
      height: visibleH,
    },
  };
}

interface InkBleedCanvasProps {
  viewport: ArtworkViewport;
  onLogoFiles: (files: FileList | File[]) => void;
}

export const InkBleedCanvas: React.FC<InkBleedCanvasProps> = ({ viewport, onLogoFiles }) => {
  const { t } = useTranslation();
  const doc = useInkBleedStore((s) => s.doc);
  const logo = useInkBleedStore((s) => s.logo);
  const progress = useInkBleedStore((s) => s.progress);
  const isPlaying = useInkBleedStore((s) => s.isPlaying);

  const { containerRef, zoom, pan, setZoom, canMove, moveTo } = viewport;
  const paperRef = useRef<HTMLCanvasElement>(null);
  const veilRef = useRef<HTMLCanvasElement>(null);

  const { width, height } = FORMATS[doc.format];
  const isTransparent = doc.paper.paperType === 'transparent';
  const awaitingLogo = doc.source === 'logo' && !logo;

  useEffect(() => {
    const ctx = paperRef.current?.getContext('2d');
    if (ctx) drawPaper(ctx, width, height, doc.paper, 1, doc.seed);
    const veil = veilRef.current?.getContext('2d');
    if (veil) {
      veil.clearRect(0, 0, width, height);
      drawVeil(veil, width, height, doc.paper, doc.seed);
    }
  }, [doc.paper, doc.seed, width, height]);

  const [settling, setSettling] = useState(false);
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    setSettling(true);
    const timer = setTimeout(() => setSettling(false), DRAFT_SETTLE_MS);
    return () => clearTimeout(timer);
  }, [doc, progress]);
  const previewScale = isPlaying || settling ? DRAFT_SCALE : 1;

  const artwork = useMemo(
    () =>
      awaitingLogo
        ? ''
        : buildArtworkSvg(doc, {
            filterId: 'ink-bleed-view',
            progress,
            logo,
            scale: previewScale,
          }),
    [doc, progress, logo, awaitingLogo, previewScale]
  );

  // React registers wheel as passive, which cannot stop the page from scrolling.
  const zoomRef = useRef(zoom);
  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setZoom(zoomRef.current * (e.deltaY < 0 ? 1.08 : 0.92));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [containerRef, setZoom]);

  const [modifierHeld, setModifierHeld] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => setModifierHeld(e.ctrlKey || e.metaKey);
    const onBlur = () => setModifierHeld(false);
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKey);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKey);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  const moveToClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!canMove || !(e.ctrlKey || e.metaKey)) return;
    const box = e.currentTarget.getBoundingClientRect();
    moveTo(
      (e.clientX - box.left - box.width / 2 - pan.x) / zoom,
      (e.clientY - box.top - box.height / 2 - pan.y) / zoom
    );
  };

  return (
    <div
      ref={containerRef}
      onClick={moveToClick}
      className={cn(
        'absolute inset-0 overflow-hidden select-none bg-background',
        canMove && modifierHeld && 'cursor-crosshair'
      )}
    >
      <div
        className="absolute left-1/2 top-1/2 outline outline-border"
        style={{
          outlineWidth: 1 / zoom,
          width,
          height,
          marginLeft: -width / 2,
          marginTop: -height / 2,
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
        }}
      >
        {/* EXCEÇÃO a tokens: o xadrez e o papel representam a ARTE, não o chrome do app. */}
        {isTransparent && (
          <div className="absolute inset-0 bg-[repeating-conic-gradient(#e5e5e5_0%_25%,#fafafa_0%_50%)] bg-[length:32px_32px]" />
        )}
        <canvas
          ref={paperRef}
          width={width}
          height={height}
          className="absolute inset-0 pointer-events-none"
        />
        <div
          className="absolute inset-0 pointer-events-none [&>svg]:h-full [&>svg]:w-full"
          data-testid="ink-bleed-artwork"
          style={{ mixBlendMode: inkBlendMode(doc) }}
          dangerouslySetInnerHTML={{ __html: artwork }}
        />
        <canvas
          ref={veilRef}
          width={width}
          height={height}
          className="absolute inset-0 pointer-events-none"
        />
      </div>

      {canMove && <InkBleedMinimap viewport={viewport} width={width} height={height} />}

      {awaitingLogo && (
        <div
          data-canvas-ui
          className="absolute inset-0 flex items-center justify-center p-6 pb-24 cursor-default pointer-events-none"
        >
          <div className="w-full max-w-sm pointer-events-auto">
            <Dropzone
              onFiles={onLogoFiles}
              accept="image/png,image/svg+xml,image/webp,image/jpeg"
              label={t('inkBleed.logo.drop')}
              dropTarget={false}
            />
          </div>
        </div>
      )}
    </div>
  );
};
