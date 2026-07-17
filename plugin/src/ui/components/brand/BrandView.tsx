import React from 'react';
import { BrandTab } from './BrandTab';

/**
 * What the brand *is*: guideline, logos, colours, typography, design system, components.
 *
 * It used to live three clicks deep inside "Settings", filed next to the language toggle —
 * the product's own input, classified as a preference. This is that tab, promoted.
 *
 * Acting on the canvas *with* the brand (intelligence, colour cleanup, logo matrix) is not
 * here — those change the canvas, so they're tools, under Tools › On-brand.
 */
export function BrandView() {
  return (
    <div className="flex-1 min-h-0 overflow-y-auto p-4">
      <BrandTab />
    </div>
  );
}
