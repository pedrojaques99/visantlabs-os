import React from 'react';
import {
  Pickaxe,
  Lock,
  RotateCw,
  BarChart3,
  Users,
  Target,
  Lightbulb,
  Building2,
  Images,
  Scale,
  Palette,
  Shapes,
  User,
  Sparkles,
  LayoutGrid,
  Crown,
  BookOpen,
  PenLine,
  Diamond,
  Gem,
  FileText,
  type IconComponent,
} from '@/lib/ui/icons';
import { useTranslation } from '@/hooks/useTranslation';
import { getBrandingStepCredits } from '@/utils/creditCalculator';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

const SECTION_ICONS: Record<number, IconComponent> = {
  1: BarChart3,
  2: Users,
  3: Target,
  4: Lightbulb,
  5: Building2,
  6: Images,
  7: Scale,
  8: Palette,
  9: Shapes,
  10: User,
  11: Sparkles,
  12: LayoutGrid,
  13: Crown,
  101: Target,
  102: BarChart3,
  103: User,
  104: Crown,
  105: BookOpen,
  106: Scale,
  107: Palette,
  108: PenLine,
  109: Diamond,
  110: Gem,
};

// ──────────────────────────────────────────────────────────────────────────
// Errored-steps store (module-level, subscribable)
// A failed generation must NOT look like a never-attempted step. The generate
// result is handled far away in BrandingMachinePage, and this tile is rendered
// through intermediary components that don't forward per-step props — so the
// error signal travels via this tiny external store instead of prop drilling.
// ──────────────────────────────────────────────────────────────────────────
const erroredSteps = new Set<number>();
const erroredListeners = new Set<() => void>();

const emitErrored = () => {
  erroredListeners.forEach((listener) => listener());
};

/** Flag or unflag a step as having failed its last generation attempt. */
export const markStepErrored = (stepNumber: number, errored: boolean): void => {
  const has = erroredSteps.has(stepNumber);
  if (errored) {
    if (has) return;
    erroredSteps.add(stepNumber);
  } else {
    if (!has) return;
    erroredSteps.delete(stepNumber);
  }
  emitErrored();
};

/** Clear all error flags — call when switching projects or starting fresh. */
export const clearErroredSteps = (): void => {
  if (erroredSteps.size === 0) return;
  erroredSteps.clear();
  emitErrored();
};

const subscribeErrored = (listener: () => void): (() => void) => {
  erroredListeners.add(listener);
  return () => {
    erroredListeners.delete(listener);
  };
};

/** Subscribe to whether a given step's last generation attempt failed. */
export const useStepErrored = (stepNumber: number): boolean =>
  React.useSyncExternalStore(
    subscribeErrored,
    () => erroredSteps.has(stepNumber),
    () => false
  );

interface EmptySectionCardProps {
  stepNumber: number;
  stepTitle: string;
  onGenerate: () => void;
  isGenerating?: boolean;
  isBlocked?: boolean;
  missingDependencies?: number[];
  steps?: Array<{ id: number; title: string }>;
}

export const EmptySectionCard: React.FC<EmptySectionCardProps> = ({
  stepNumber,
  stepTitle,
  onGenerate,
  isGenerating = false,
  isBlocked = false,
  missingDependencies = [],
  steps = [],
}) => {
  const { t } = useTranslation();
  const creditsRequired = getBrandingStepCredits(stepNumber);
  const SectionIcon = SECTION_ICONS[stepNumber] ?? FileText;
  const errored = useStepErrored(stepNumber);
  // A failed generation gets a distinct error+retry look; blocked/generating take precedence.
  const showError = errored && !isBlocked && !isGenerating;

  const getMissingDepsText = () => {
    if (missingDependencies.length === 0) return '';
    const depTitles = missingDependencies
      .map((dep) => steps.find((s) => s.id === dep)?.title || `Step ${dep}`)
      .join(', ');
    return depTitles;
  };

  return (
    <GlassPanel
      asChild
      className={cn(
        'aspect-square border-2 active:scale-[0.98] transition-[border-color,background-color,opacity,transform] duration-200 relative flex flex-col items-center justify-center gap-3 w-full',
        showError
          ? 'border-destructive/40 hover:border-destructive/60 hover:bg-destructive/5 cursor-pointer group'
          : isBlocked
            ? // Blocked = missing deps. Clickable so the click routes into the dep-generation flow.
              'opacity-80 cursor-pointer border-destructive/20 hover:border-destructive/40'
            : 'border-border hover:border-border-hover hover:bg-accent cursor-pointer group',
        isGenerating && 'opacity-50 cursor-not-allowed'
      )}
      padding="none"
    >
      <Button
        variant="ghost"
        onClick={(e) => {
          e.stopPropagation();
          // Always fire onGenerate: for a blocked step this routes into the
          // dependency-generation flow (generateStep resolves missing deps via
          // the confirmation modal); for an errored step it retries.
          onGenerate();
        }}
        disabled={isGenerating}
        title={
          showError
            ? t('branding.sectionFailedTitle')
            : isBlocked
              ? `${t('branding.requires')}: ${getMissingDepsText()}`
              : undefined
        }
      >
        {/* Section icon */}
        <SectionIcon
          size={32}
          className={cn(
            'transition-colors duration-200',
            isBlocked ? 'text-muted-foreground/50' : 'text-muted-foreground group-hover:text-foreground'
          )}
        />

        {/* Label */}
        <h3 className="font-medium font-manrope text-xs md:text-sm text-center leading-tight max-w-full truncate px-2 text-foreground">
          {stepTitle}
        </h3>

        {/* Error Retry Badge */}
        {showError && (
          <div className="absolute top-3 right-3 px-2 py-1 border rounded-md flex items-center gap-1.5 bg-destructive/10 border-destructive/30 text-destructive">
            <RotateCw size={12} />
            <span className="text-xs font-medium">{t('common.retry')}</span>
          </div>
        )}

        {/* Credits Badge - Pilula style */}
        {!isBlocked && !showError && (
          <div className="absolute top-3 right-3 px-2 py-1 border rounded-md flex items-center gap-1.5 transition-colors duration-200 bg-muted border-border-hover group-hover:bg-accent">
            <Pickaxe size={12} className="text-muted-foreground" />
            <span className="text-xs font-medium tabular-nums text-foreground">
              {creditsRequired}
            </span>
          </div>
        )}

        {/* Blocked Badge */}
        {isBlocked && (
          <div className="absolute top-3 right-3 px-2 py-1 border rounded-md flex items-center gap-1.5 bg-destructive/10 border-destructive/30 text-destructive">
            <Lock size={12} />
            <span className="text-xs font-medium">{t('branding.blocked')}</span>
          </div>
        )}

        {/* Loading overlay */}
        {isGenerating && (
          <div className="absolute inset-0 rounded-xl flex items-center justify-center z-10 bg-background/80">
            <div className="w-6 h-6 border-2 rounded-md animate-spin border-border-hover border-t-foreground" />
          </div>
        )}
      </Button>
    </GlassPanel>
  );
};
