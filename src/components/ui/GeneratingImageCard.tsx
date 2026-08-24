// Colhido para o registry: `@visant/generating-tile` — a versão canônica vive lá.
// Correção que valha para outros projetos deve ir no registry primeiro.
import React, { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { glassSurface } from '@/lib/ui/glass';
import { GlitchPickaxe } from '@/components/ui/GlitchPickaxe';
import { PremiumGlitchLoader } from '@/components/ui/PremiumGlitchLoader';
import { TurbulenceField } from '@/components/ui/TurbulenceField';
import { useTranslation } from '@/hooks/useTranslation';
import { getTranslations } from '@/utils/localeUtils';

/**
 * GeneratingImageCard — the single, canonical "image is being generated" surface.
 *
 * Composes existing primitives (TurbulenceField + GlitchPickaxe + PremiumGlitchLoader)
 * into the loading card that was previously duplicated across MockupCard, ChatShell,
 * NodePlaceholder and the image-editor GeneratingOverlay. The animated brand-cyan fog
 * (TurbulenceField) entertains DURING generation; it is pure SVG so it scales to grids
 * of concurrent tiles without spawning WebGL contexts.
 *
 * Variants:
 *  - `tile`    → inline aspect-ratio tile (mockup grid, chat)
 *  - `inline`  → compact centered column, frame supplied by parent (canvas nodes)
 *  - `overlay` → floating glass panel over a dim backdrop (image editor, creative studio)
 */
type GeneratingImageVariant = 'tile' | 'inline' | 'overlay';
type GeneratingAspect = '1/1' | '16/9' | '4/3';

interface GeneratingImageCardProps {
  isLoading: boolean;
  variant?: GeneratingImageVariant;
  aspectRatio?: GeneratingAspect;
  /** rotating status words; defaults to locale-aware mockup.promptStatusMessages */
  steps?: readonly string[];
  /** shows a discreet Cancel button (overlay variant) */
  onCancel?: () => void;
  /** false when the parent already supplies the frame/aspect box (e.g. canvas nodes) */
  showFrame?: boolean;
  /** turbulence fog opacity (0–1) */
  intensity?: number;
  /** rendered when not loading (e.g. the finished image) */
  children?: React.ReactNode;
  className?: string;
}

const ASPECT_CLASS: Record<GeneratingAspect, string> = {
  '1/1': 'aspect-square',
  '16/9': 'aspect-[16/9]',
  '4/3': 'aspect-[4/3]',
};

const FALLBACK_STEPS = ['Criando', 'Desenhando', 'Refinando', 'Compondo', 'Lapidando'];

export function GeneratingImageCard({
  isLoading,
  variant = 'tile',
  aspectRatio,
  steps,
  onCancel,
  showFrame = true,
  intensity = 0.18,
  children,
  className,
}: GeneratingImageCardProps) {
  const { locale } = useTranslation();

  const resolvedSteps = useMemo(() => {
    if (steps && steps.length > 0) return steps;
    const translations = getTranslations(locale);
    return translations.mockup?.promptStatusMessages ?? FALLBACK_STEPS;
  }, [steps, locale]);

  if (!isLoading) return <>{children ?? null}</>;

  if (variant === 'overlay') {
    return (
      <div className={cn('absolute inset-0 z-10 flex items-center justify-center', className)}>
        <div className="absolute inset-0 bg-neutral-900/40 pointer-events-none" />
        <div className="relative flex flex-col items-center gap-3 overflow-hidden rounded-2xl border border-white/10 bg-neutral-900/80 p-6 backdrop-blur-xl">
          <TurbulenceField intensity={intensity} />
          <GlitchPickaxe size={28} className="relative z-10" />
          <PremiumGlitchLoader
            steps={resolvedSteps}
            color="var(--brand-cyan)"
            className="relative z-10"
          />
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="relative z-10 mt-1 rounded-lg border border-neutral-700 px-3 py-1 font-mono text-2xs text-neutral-500 transition-colors hover:border-neutral-500 hover:text-neutral-300"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    );
  }

  if (variant === 'inline') {
    return (
      <div
        className={cn(
          'relative flex w-full flex-col items-center justify-center gap-3 overflow-hidden',
          className
        )}
      >
        <TurbulenceField intensity={intensity} />
        <GlitchPickaxe className="relative z-10" />
        <PremiumGlitchLoader
          color="var(--brand-cyan)"
          steps={resolvedSteps}
          className="relative z-10 justify-center"
        />
      </div>
    );
  }

  // variant === 'tile'
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl',
        showFrame && glassSurface.tile,
        aspectRatio && ASPECT_CLASS[aspectRatio],
        className
      )}
    >
      <TurbulenceField intensity={intensity} />
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <GlitchPickaxe />
      </div>
      <div className="absolute bottom-4 left-1/2 w-[85%] max-w-[240px] -translate-x-1/2">
        <PremiumGlitchLoader color="var(--brand-cyan)" steps={resolvedSteps} />
      </div>
    </div>
  );
}
