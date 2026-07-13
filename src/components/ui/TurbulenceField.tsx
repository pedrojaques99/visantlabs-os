import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * TurbulenceField — procedural organic-noise background for "generating" states.
 *
 * Pure SVG `feTurbulence` + slow `baseFrequency` animation → a soft, flowing
 * brand-cyan fog that entertains during long image generations. No WebGL context
 * (so it scales to any number of concurrent tiles), no per-frame JS.
 *
 * Colour follows `currentColor` (default: brand-cyan) so it inherits the theme
 * token. Respects `prefers-reduced-motion` by freezing the turbulence.
 */
interface TurbulenceFieldProps {
  /** overall alpha of the fog (0–1). Keep it subtle. */
  intensity?: number;
  /** CSS color for the fog; defaults to brand-cyan via currentColor. */
  color?: string;
  className?: string;
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduced(mq.matches);
    onChange();
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);
  return reduced;
}

export function TurbulenceField({
  intensity = 0.18,
  color = 'var(--brand-cyan)',
  className,
}: TurbulenceFieldProps) {
  // Unique filter id per instance so multiple fields don't collide in the DOM.
  const rawId = React.useId();
  const filterId = `turb-${rawId.replace(/[^a-zA-Z0-9]/g, '')}`;
  const reduced = usePrefersReducedMotion();

  return (
    <svg
      aria-hidden="true"
      className={cn('absolute inset-0 h-full w-full pointer-events-none', className)}
      style={{ color, opacity: intensity }}
      preserveAspectRatio="xMidYMid slice"
    >
      <filter id={filterId} x="0" y="0" width="100%" height="100%">
        <feTurbulence
          type="fractalNoise"
          baseFrequency="0.011 0.014"
          numOctaves={2}
          seed={7}
          stitchTiles="stitch"
          result="noise"
        >
          {!reduced && (
            <animate
              attributeName="baseFrequency"
              dur="14s"
              values="0.011 0.014;0.016 0.020;0.011 0.014"
              calcMode="spline"
              keyTimes="0;0.5;1"
              keySplines="0.4 0 0.2 1;0.4 0 0.2 1"
              repeatCount="indefinite"
            />
          )}
        </feTurbulence>
        {/* Tint the noise with the current color, using the noise alpha as a mask */}
        <feFlood floodColor="currentColor" result="tint" />
        <feComposite in="tint" in2="noise" operator="in" />
      </filter>
      <rect width="100%" height="100%" filter={`url(#${filterId})`} />
    </svg>
  );
}
