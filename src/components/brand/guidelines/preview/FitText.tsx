/**
 * FitText — shrink-to-fit headline text for fixed artboards.
 *
 * A fixed-size mock can't reflow, so long brand copy would either overflow or need an
 * ugly `…` cut. FitText binary-searches the largest font size at which the full text
 * still fits inside a fixed box (maxWidth × maxHeight), so headlines stay complete AND
 * never blow out the frame. Worst case (text longer than the box even at minFontSize)
 * clips cleanly via `overflow: hidden` — no ellipsis, no overflow.
 *
 * Measurement uses layout px (scrollHeight/scrollWidth), so it's correct even inside the
 * Artboard's `transform: scale()`.
 */
import React, { useLayoutEffect, useRef, useState } from 'react';

interface FitTextProps {
  children: string;
  maxFontSize: number;
  minFontSize?: number;
  /** Box bounds in design px (matches the Figma frame's available area). */
  maxWidth: number;
  maxHeight: number;
  lineHeight?: number;
  style?: React.CSSProperties;
}

export const FitText: React.FC<FitTextProps> = ({
  children,
  maxFontSize,
  minFontSize = 16,
  maxWidth,
  maxHeight,
  lineHeight = 1,
  style,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState(maxFontSize);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fitsAt = (px: number): boolean => {
      el.style.fontSize = `${px}px`;
      return el.scrollHeight <= maxHeight + 0.5 && el.scrollWidth <= maxWidth + 0.5;
    };
    let lo = minFontSize;
    let hi = maxFontSize;
    let best = minFontSize;
    // Binary search the largest size that fits (≤8 reflows).
    while (lo <= hi) {
      const mid = Math.floor((lo + hi) / 2);
      if (fitsAt(mid)) {
        best = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    el.style.fontSize = `${best}px`;
    setSize(best);
  }, [children, maxFontSize, minFontSize, maxWidth, maxHeight]);

  return (
    <div
      ref={ref}
      style={{
        width: maxWidth,
        maxHeight,
        overflow: 'hidden',
        fontSize: size,
        lineHeight,
        ...style,
      }}
    >
      {children}
    </div>
  );
};
