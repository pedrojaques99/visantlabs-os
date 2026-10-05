/**
 * BrandOverviewBento — compact "snapshot" of a brand for the Overview tab.
 *
 * Replaces the old behavior of stacking all 12 sections at full size. Shows a
 * bento grid of the brand core + visual identity (manifesto, logo, colors,
 * type, a live mockup teaser, asset mosaic) — each tile a glance, with a
 * "view full" affordance that jumps to the matching detail tab.
 *
 * Reuses design-system primitives (GlassPanel, MicroTitle) + the BrandMocks
 * renderers; introduces no new UI primitives. Themes off the brand CSS vars
 * (`--accent`, `--brand-surface`, `--brand-text`) set by PublicBrandGuideline.
 */
import React, { useCallback } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight } from '@/lib/ui/icons';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { MicroTitle } from '@/components/ui/MicroTitle';
import { copyToClipboard } from '@/utils/clipboard';
import { useTranslation } from '@/hooks/useTranslation';
import { hoverReveal } from '@/lib/ui/hoverReveal';
import { Thumb } from '@/components/ui/Thumb';
import type { BrandGuideline } from '@/lib/figma-types';
import type { MockTokens } from './mockTokens';
import { WebsiteHeroMock, InstagramFeedMock } from './BrandMocks';

interface BrandOverviewBentoProps {
  guideline: BrandGuideline;
  tokens: MockTokens;
  /** Jump to a detail tab id (e.g. 'colors', 'strategy', 'logos', 'preview'). */
  onOpenTab: (tabId: string) => void;
}

const tileMotion = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 },
};

// ── Tile shell ────────────────────────────────────────────────────────────────

const Tile: React.FC<{
  label: string;
  onView?: () => void;
  viewLabel?: string;
  className?: string;
  children: React.ReactNode;
}> = ({ label, onView, viewLabel, className, children }) => (
  <motion.div variants={tileMotion} className={cn('min-w-0', className)}>
    <GlassPanel
      padding="md"
      className="group h-full bg-[var(--brand-surface)]/20 border-[var(--brand-text)]/10 overflow-hidden hover:border-[var(--brand-text)]/20 transition-colors"
    >
      <div className="flex items-center justify-between mb-5">
        <MicroTitle className="text-[var(--brand-text)]/50">{label}</MicroTitle>
        {onView && (
          <button
            type="button"
            onClick={onView}
            className={cn(
              'flex items-center gap-1 text-xs text-[var(--brand-text)]/60 hover:text-[var(--brand-text)] focus:outline-none',
              hoverReveal
            )}
          >
            {viewLabel}
            <ArrowRight size={11} />
          </button>
        )}
      </div>
      <div className="flex-1 min-h-0">{children}</div>
    </GlassPanel>
  </motion.div>
);

// ── Component ───────────────────────────────────────────────────────────────

export const BrandOverviewBento: React.FC<BrandOverviewBentoProps> = ({
  guideline,
  tokens,
  onOpenTab,
}) => {
  const { t } = useTranslation();
  const copyHex = useCallback(
    (hex: string) => {
      copyToClipboard(hex);
      toast.success(t('brandView.copied', { hex }));
    },
    [t]
  );

  const statement = tokens.manifestoFirstLine || tokens.description || tokens.tagline || '';
  const palette = tokens.palette.filter((c) => c.hex);
  const fonts = guideline.typography || [];
  const mediaImages = (guideline.media || [])
    .filter((m) => m.type === 'image' && m.url)
    .map((m) => m.url);

  const hasManifesto = !!statement;
  const hasLogo = !!tokens.primaryLogo?.url || !!tokens.name;
  const hasColors = palette.length > 0;
  const hasType = fonts.length > 0;
  const hasAssets = mediaImages.length > 0;

  // Mockups tile widens to fill the last row when there's no Assets partner.
  const mockupsSpan = hasAssets ? 'md:col-span-4' : 'md:col-span-6';

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      className="grid grid-cols-1 md:grid-cols-6 gap-4 md:gap-5 auto-rows-auto items-stretch"
    >
      {/* Manifesto — wide editorial statement */}
      {hasManifesto && (
        <Tile
          label={t('brandView.manifesto')}
          onView={() => onOpenTab('strategy')}
          viewLabel={t('brandView.viewAll')}
          className="md:col-span-4"
        >
          <blockquote
            className="text-2xl md:text-[2rem] font-light leading-[1.25] tracking-tight text-[var(--brand-text)]/85 line-clamp-5"
            style={{ fontFamily: tokens.headingFamily }}
          >
            &ldquo;{statement}&rdquo;
          </blockquote>
          {tokens.tagline && tokens.tagline !== statement && (
            <p className="mt-5 text-sm text-[var(--brand-text)]/60">{tokens.tagline}</p>
          )}
        </Tile>
      )}

      {/* Logo — primary lockup */}
      {hasLogo && (
        <Tile
          label={t('brandView.logo')}
          onView={() => onOpenTab('logos')}
          viewLabel={t('brandView.viewAll')}
          className="md:col-span-2"
        >
          <div className="h-full min-h-[140px] rounded-2xl bg-[var(--brand-surface)]/40 border border-[var(--brand-text)]/5 flex items-center justify-center p-6">
            {tokens.primaryLogo?.url ? (
              <Thumb
                src={tokens.primaryLogo.url}
                alt={tokens.name}
                className="max-h-24 max-w-full object-contain"
                loading="lazy"
              />
            ) : (
              <span
                className="text-3xl font-semibold tracking-tight text-[var(--brand-text)]/90 text-center"
                style={{ fontFamily: tokens.headingFamily }}
              >
                {tokens.name}
              </span>
            )}
          </div>
        </Tile>
      )}

      {/* Colors — palette swatches, click to copy */}
      {hasColors && (
        <Tile
          label={t('brandView.colors')}
          onView={() => onOpenTab('colors')}
          viewLabel={t('brandView.viewAll')}
          className="md:col-span-3"
        >
          <div className="flex flex-wrap gap-2.5">
            {palette.slice(0, 10).map((c, i) => (
              <button
                key={`${c.hex}-${i}`}
                type="button"
                onClick={() => copyHex(c.hex)}
                title={`${c.name || ''} ${c.hex}`.trim()}
                aria-label={[t('brandView.copyHex', { hex: c.hex }), c.name]
                  .filter(Boolean)
                  .join(', ')}
                className="group/swatch flex flex-col items-center gap-1.5"
              >
                <span
                  className="w-11 h-11 rounded-xl border border-[var(--brand-text)]/10 transition-colors group-hover/swatch:border-[var(--brand-text)]/40"
                  style={{ backgroundColor: c.hex }}
                />
                {/* EXCEÇÃO ao ruido-scan/mono-uppercase: hex é valor técnico. */}
                <span className="text-2xs font-mono uppercase text-[var(--brand-text)]/60 opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover/swatch:opacity-100 group-focus-visible/swatch:opacity-100 transition-opacity">
                  {c.hex.replace('#', '')}
                </span>
              </button>
            ))}
          </div>
        </Tile>
      )}

      {/* Typography — Aa specimen + families */}
      {hasType && (
        <Tile
          label={t('brandView.typography')}
          onView={() => onOpenTab('typography')}
          viewLabel={t('brandView.viewAll')}
          className="md:col-span-3"
        >
          <div className="flex items-center gap-6">
            <span
              className="text-6xl md:text-7xl font-semibold tracking-tighter text-[var(--brand-text)]/90 leading-none shrink-0"
              style={{ fontFamily: tokens.headingFamily }}
            >
              Aa
            </span>
            <div className="min-w-0 space-y-3">
              {fonts.slice(0, 3).map((f, i) => (
                <div key={i} className="min-w-0">
                  <p
                    className="text-base font-medium text-[var(--brand-text)]/90 truncate"
                    style={{ fontFamily: f.family }}
                  >
                    {f.family}
                  </p>
                  <span className="text-xs text-[var(--brand-text)]/60">{f.role}</span>
                </div>
              ))}
            </div>
          </div>
        </Tile>
      )}

      {/* Mockups — live preview teaser → Preview tab */}
      <Tile
        label={t('brandView.mockups')}
        onView={() => onOpenTab('preview')}
        viewLabel={t('brandView.viewAll')}
        className={mockupsSpan}
      >
        <button
          type="button"
          onClick={() => onOpenTab('preview')}
          aria-label={t('brandView.mockups')}
          className="block w-full rounded-2xl overflow-hidden border border-[var(--brand-text)]/8 transition-colors hover:border-[var(--brand-text)]/25 focus:outline-none focus:ring-1 focus:ring-[var(--accent)]/40"
        >
          {hasAssets ? (
            <WebsiteHeroMock tokens={tokens} />
          ) : (
            <div className="max-w-[340px] mx-auto">
              <InstagramFeedMock tokens={tokens} />
            </div>
          )}
        </button>
      </Tile>

      {/* Assets — media mosaic */}
      {hasAssets && (
        <Tile
          label={t('brandView.media')}
          onView={() => onOpenTab('media')}
          viewLabel={t('brandView.viewAll')}
          className="md:col-span-2"
        >
          <div className="grid grid-cols-2 gap-2">
            {mediaImages.slice(0, 4).map((url, i) => (
              <div
                key={i}
                className="relative aspect-square rounded-xl overflow-hidden border border-[var(--brand-text)]/5 bg-[var(--brand-surface)]/40"
              >
                <Thumb src={url} alt="" className="w-full h-full object-cover" loading="lazy" />
                {i === 3 && mediaImages.length > 4 && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/55 text-white text-sm font-medium">
                    +{mediaImages.length - 4}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Tile>
      )}
    </motion.div>
  );
};
