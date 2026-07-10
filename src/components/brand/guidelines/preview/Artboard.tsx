/**
 * Artboard — a fixed-size design surface that scales to fit its container.
 *
 * The unified preview model: a mock is authored ONCE at a fixed design size (the same
 * px as its Figma template — 1080×1080, 1200×628, …) and scaled as a single unit via
 * `transform: scale()`, exactly like a Figma frame. No fluid reflow (no clamp/cqi), so
 * the DOM render and the Figma frame share ONE spec and match at any width.
 *
 * The inner fixed node (`exportRef`) is the export target — html-to-image captures it at
 * full design resolution, independent of the on-screen scale.
 */
import React, { useRef, useState, useLayoutEffect } from 'react';

/** Track a container's rendered width via ResizeObserver (SSR-safe, no deps). */
function useElementWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) setWidth(e.contentRect.width);
    });
    ro.observe(el);
    setWidth(el.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

interface ArtboardProps {
  /** Design width in px — matches the Figma frame. */
  w: number;
  /** Design height in px — matches the Figma frame. */
  h: number;
  className?: string;
  children: React.ReactNode;
  /** Forwarded to the fixed (unscaled) inner node — the export/capture target. */
  exportRef?: React.Ref<HTMLDivElement>;
}

export const Artboard: React.FC<ArtboardProps> = ({ w, h, className, children, exportRef }) => {
  const [fitRef, fitW] = useElementWidth<HTMLDivElement>();
  const scale = fitW > 0 ? fitW / w : 0;

  return (
    <div
      ref={fitRef}
      className={className}
      style={{ position: 'relative', width: '100%', aspectRatio: `${w} / ${h}`, overflow: 'hidden' }}
    >
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: w,
          height: h,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          // Hide until measured so we never flash the artboard at 1:1.
          visibility: scale > 0 ? 'visible' : 'hidden',
        }}
      >
        <div ref={exportRef} style={{ width: w, height: h, position: 'relative' }}>
          {children}
        </div>
      </div>
    </div>
  );
};
