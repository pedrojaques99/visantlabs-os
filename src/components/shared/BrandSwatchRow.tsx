import React from 'react';
import { cn } from '@/lib/utils';
import { useActiveBrandSafe } from '@/contexts/ActiveBrandContext';
import { useTranslation } from '@/hooks/useTranslation';

/** Hex colors of the currently active brand guideline (empty when none). */
export function useBrandColorPresets(): string[] {
  const ctx = useActiveBrandSafe();
  const colors = ctx?.activeBrand?.colors;
  if (!colors?.length) return [];
  const hexes = colors
    .map((c) => (typeof c === 'string' ? c : c?.hex))
    .filter((h): h is string => typeof h === 'string' && /^#?[0-9a-fA-F]{3,8}$/.test(h))
    .map((h) => (h.startsWith('#') ? h : `#${h}`));
  return [...new Set(hexes.map((h) => h.toUpperCase()))].slice(0, 12);
}

/**
 * One-click "make this on-brand" button: maps the active brand's palette onto
 * an effect's channels/layers. Renders nothing without an active brand. This is
 * the brand-as-INPUT wedge in miniature — guideline colors drive the output.
 */
export const ApplyBrandButton: React.FC<{
  onApply: (colors: string[]) => void;
  className?: string;
}> = ({ onApply, className }) => {
  const { t } = useTranslation();
  const presets = useBrandColorPresets();
  if (!presets.length) return null;
  return (
    <button
      type="button"
      onClick={() => onApply(presets)}
      title={presets.join(' · ')}
      className={cn(
        'flex items-center gap-1.5 text-2xs uppercase tracking-wider text-neutral-500 hover:text-foreground transition-colors',
        className
      )}
    >
      <span className="flex -space-x-1">
        {presets.slice(0, 4).map((c, i) => (
          <span
            key={`${c}-${i}`}
            className="w-2.5 h-2.5 rounded-full border border-neutral-950"
            style={{ backgroundColor: c }}
          />
        ))}
      </span>
      {t('common.applyBrand')}
    </button>
  );
};

/**
 * Quick-pick row of the active brand's colors. Renders nothing when there is no
 * active brand, so it's safe to drop into any color control. Reads
 * ActiveBrandContext directly (safe outside a provider) so pickers pull brand
 * colors automatically — no prop drilling.
 */
export const BrandSwatchRow: React.FC<{
  onPick: (hex: string) => void;
  current?: string;
  className?: string;
}> = ({ onPick, current, className }) => {
  const { t } = useTranslation();
  const presets = useBrandColorPresets();
  if (!presets.length) return null;
  return (
    <div className={cn('space-y-1', className)}>
      <span className="text-3xs uppercase tracking-widest text-neutral-600">
        {t('common.brand')}
      </span>
      <div className="flex gap-1.5 flex-wrap">
        {presets.map((c, i) => (
          <button
            key={`${c}-${i}`}
            type="button"
            title={c}
            aria-label={`Brand color ${c}`}
            onClick={(e) => {
              e.stopPropagation();
              onPick(c);
            }}
            className={cn(
              'w-5 h-5 rounded-full border transition-all hover:scale-110',
              current?.toLowerCase() === c.toLowerCase()
                ? 'border-white/40 ring-1 ring-white/20'
                : 'border-white/10 hover:border-white/20'
            )}
            style={{ backgroundColor: c }}
          />
        ))}
      </div>
    </div>
  );
};
