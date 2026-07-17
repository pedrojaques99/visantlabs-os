/**
 * Gradient stop model + CSS builder.
 * Adapted from Pixel Point Toolcraft's gradient-control-utils (MIT,
 * Copyright (c) 2026 Pixel Point) — https://github.com/pixel-point/toolcraft
 * Positions here are normalized 0..1 (Toolcraft used "NN%" strings).
 */

export type GradientType = 'linear' | 'radial' | 'angular' | 'diamond';

export interface GradientStop {
  color: string; // #RRGGBB
  position: number; // 0..1
  opacity?: number; // 0..1, default 1
}

export const MAX_GRADIENT_STOPS = 8;
export const MIN_GRADIENT_STOPS = 2;

export const GRADIENT_TYPE_OPTIONS: { label: string; value: GradientType }[] = [
  { label: 'Linear', value: 'linear' },
  { label: 'Radial', value: 'radial' },
  { label: 'Angular', value: 'angular' },
  { label: 'Diamond', value: 'diamond' },
];

const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));

export function sortStops(stops: readonly GradientStop[]): GradientStop[] {
  return [...stops].sort((a, b) => a.position - b.position);
}

function stopCssColor(stop: GradientStop): string {
  const opacity = clamp(stop.opacity ?? 1);
  if (opacity >= 1) return stop.color;
  return `color-mix(in oklab, ${stop.color} ${Math.round(opacity * 100)}%, transparent)`;
}

function stopList(stops: readonly GradientStop[]): string {
  return sortStops(stops)
    .map((s) => `${stopCssColor(s)} ${Math.round(clamp(s.position) * 100)}%`)
    .join(', ');
}

export function getGradientCss(
  type: GradientType,
  stops: readonly GradientStop[],
  angle = 90
): string {
  const list = stopList(stops);
  const a = Number.isFinite(angle) ? Math.round(angle) : 90;
  switch (type) {
    case 'angular':
      return `conic-gradient(from ${a}deg at 50% 50%, ${list})`;
    case 'diamond':
      return `radial-gradient(closest-corner at 50% 50%, ${list})`;
    case 'radial':
      return `radial-gradient(circle at 50% 50%, ${list})`;
    case 'linear':
    default:
      return `linear-gradient(${a}deg, ${list})`;
  }
}

export function addStop(
  stops: readonly GradientStop[],
  position: number,
  fromStop?: GradientStop | null
): { stops: GradientStop[]; index: number } {
  const next: GradientStop = {
    color: fromStop?.color ?? '#D9D9D9',
    opacity: fromStop?.opacity ?? 1,
    position: clamp(position),
  };
  const sorted = sortStops([...stops, next]);
  return { stops: sorted, index: sorted.indexOf(next) };
}

export function removeStop(stops: readonly GradientStop[], index: number): GradientStop[] {
  if (stops.length <= MIN_GRADIENT_STOPS) return [...stops];
  return stops.filter((_, i) => i !== index);
}

export function updateStop(
  stops: readonly GradientStop[],
  index: number,
  patch: Partial<GradientStop>
): GradientStop[] {
  return stops.map((s, i) => (i === index ? { ...s, ...patch } : s));
}

export function reverseStops(stops: readonly GradientStop[]): GradientStop[] {
  return sortStops(stops.map((s) => ({ ...s, position: clamp(1 - s.position) })));
}

export function positionFromTrack(track: HTMLElement | null, clientX: number): number {
  const rect = track?.getBoundingClientRect();
  if (!rect) return 0;
  return clamp((clientX - rect.left) / rect.width);
}
