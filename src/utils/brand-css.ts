import type { BrandGuidelineGradient, BrandGuidelineShadow, BrandGuidelineBorder } from '@/lib/figma-types';

export function buildGradientCss(g: BrandGuidelineGradient): string {
  const stops = g.stops.map(s => `${s.color} ${s.position}%`).join(', ');
  return g.type === 'radial'
    ? `radial-gradient(circle, ${stops})`
    : `linear-gradient(${g.angle}deg, ${stops})`;
}

function hexToRgba(hex: string, opacity: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${opacity})`;
}

export function buildShadowCss(s: BrandGuidelineShadow): string {
  const inset = s.type === 'inner' ? 'inset ' : '';
  return `${inset}${s.x}px ${s.y}px ${s.blur}px ${s.spread}px ${hexToRgba(s.color, s.opacity)}`;
}

export function buildBorderCss(b: BrandGuidelineBorder): string {
  return `${b.width}px ${b.style} ${hexToRgba(b.color, b.opacity)}`;
}
