import React from 'react';
import type { AspectRatio } from '@/types/types';

export const AspectRatioIcon: React.FC<{ ratio: AspectRatio }> = ({ ratio }) => {
  const commonProps = { className: "w-4 h-4 text-inherit", fill: "currentColor" };
  const [width, height] = ratio.split(':').map(Number);
  const viewBoxAspect = width / height;
  const viewBoxWidth = Math.max(width, 16);
  const viewBoxHeight = viewBoxWidth / viewBoxAspect;

  // For ultra-wide or tall ratios, normalize to fit viewBox
  const normalizedWidth = viewBoxWidth > 21 ? 21 : viewBoxWidth;
  const normalizedHeight = viewBoxHeight > 16 ? 16 : viewBoxHeight;

  if (ratio === '16:9') return <svg viewBox="0 0 16 9" {...commonProps}><rect width="16" height="9" rx="1" /></svg>;
  if (ratio === '4:3') return <svg viewBox="0 0 4 3" {...commonProps}><rect width="4" height="3" rx="0.5" /></svg>;
  if (ratio === '1:1') return <svg viewBox="0 0 1 1" {...commonProps}><rect width="1" height="1" rx="0.1" /></svg>;
  // For other ratios, generate a generic rectangle
  return <svg viewBox={`0 0 ${normalizedWidth} ${normalizedHeight}`} {...commonProps}><rect width={normalizedWidth} height={normalizedHeight} rx="0.5" /></svg>;
};


