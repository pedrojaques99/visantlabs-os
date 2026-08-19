import React from 'react';
import { Pickaxe, Lock, AlertTriangle, RotateCw } from '@/lib/ui/icons';
import { useTranslation } from '@/hooks/useTranslation';
import { useTheme } from '@/hooks/useTheme';
import { getBrandingStepCredits } from '@/utils/creditCalculator';
import { getSectionEmoji } from '@/utils/brandingHelpers';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

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
  const { theme } = useTheme();
  const creditsRequired = getBrandingStepCredits(stepNumber);
  const emoji = getSectionEmoji(stepNumber);
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
        'aspect-square border-2 active:scale-[0.98] transition-all duration-200 relative flex flex-col items-center justify-center gap-3 w-full',
        showError
          ? 'border-destructive/40 hover:border-destructive/60 hover:bg-destructive/5 cursor-pointer group'
          : isBlocked
            ? // Blocked = missing deps. Clickable so the click routes into the dep-generation flow.
              'opacity-80 cursor-pointer border-destructive/20 hover:border-destructive/40'
            : 'border-white/10 hover:border-white/20 hover:bg-white/5 cursor-pointer group',
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
            ? 'Generation failed — click to try again'
            : isBlocked
              ? `Bloqueado: requer ${getMissingDepsText()}`
              : undefined
        }
      >
        {/* Error Icon Overlay */}
        {showError && (
          <div
            className={`absolute top-2 left-2 p-1.5 rounded-md ${
              theme === 'dark' ? 'bg-destructive/20' : 'bg-destructive'
            }`}
          >
            <AlertTriangle
              className={`h-3 w-3 ${theme === 'dark' ? 'text-destructive' : 'text-destructive'}`}
            />
          </div>
        )}

        {/* Blocked Icon Overlay */}
        {isBlocked && !showError && (
          <div
            className={`absolute top-2 left-2 p-1.5 rounded-md ${
              theme === 'dark' ? 'bg-destructive/20' : 'bg-destructive'
            }`}
          >
            <Lock
              className={`h-3 w-3 ${theme === 'dark' ? 'text-destructive' : 'text-destructive'}`}
            />
          </div>
        )}

        {/* Emoji Icon */}
        <div
          className={`text-3xl md:text-4xl filter transition-[color,background-color,border-color,opacity,filter] duration-200 ${
            isBlocked ? 'grayscale opacity-50' : 'grayscale group-hover:grayscale-0'
          }`}
        >
          {emoji}
        </div>

        {/* Label */}
        <h3
          className={`font-semibold font-manrope text-xs md:text-sm text-center leading-tight max-w-full truncate px-2 ${
            theme === 'dark' ? 'text-white' : 'text-neutral-800'
          }`}
        >
          {stepTitle}
        </h3>

        {/* Error Retry Badge */}
        {showError && (
          <div
            className={`absolute top-3 right-3 px-2 py-1 border rounded-md flex items-center gap-1.5 ${
              theme === 'dark'
                ? 'bg-destructive/20 border-destructive/30'
                : 'bg-destructive border-destructive'
            }`}
          >
            <RotateCw
              size={12}
              className={theme === 'dark' ? 'text-destructive' : 'text-destructive'}
            />
            <span
              className={`text-xs font-mono font-semibold ${
                theme === 'dark' ? 'text-destructive' : 'text-destructive'
              }`}
            >
              Retry
            </span>
          </div>
        )}

        {/* Credits Badge - Pilula style */}
        {!isBlocked && !showError && (
          <div
            className={`absolute top-3 right-3 px-2 py-1 border rounded-md flex items-center gap-1.5 transition-colors duration-200 ${
              theme === 'dark'
                ? 'bg-white/10 border-white/20 group-hover:bg-white/15'
                : 'bg-neutral-200 border-neutral-300 group-hover:bg-neutral-300'
            }`}
          >
            <Pickaxe
              size={12}
              className={theme === 'dark' ? 'text-white/80' : 'text-neutral-700'}
            />
            <span
              className={`text-xs font-mono font-semibold ${
                theme === 'dark' ? 'text-white/90' : 'text-neutral-800'
              }`}
            >
              {creditsRequired}
            </span>
          </div>
        )}

        {/* Blocked Badge */}
        {isBlocked && (
          <div
            className={`absolute top-3 right-3 px-2 py-1 border rounded-md flex items-center gap-1.5 ${
              theme === 'dark'
                ? 'bg-destructive/20 border-destructive/30'
                : 'bg-destructive border-destructive'
            }`}
          >
            <Lock
              size={12}
              className={theme === 'dark' ? 'text-destructive' : 'text-destructive'}
            />
            <span
              className={`text-xs font-mono font-semibold ${
                theme === 'dark' ? 'text-destructive' : 'text-destructive'
              }`}
            >
              Bloqueado
            </span>
          </div>
        )}

        {/* Loading overlay */}
        {isGenerating && (
          <div
            className={`absolute inset-0 rounded-xl flex items-center justify-center z-10 ${
              theme === 'dark' ? 'bg-neutral-950/80' : 'bg-white/90'
            }`}
          >
            <div
              className={`w-6 h-6 border-2 rounded-md animate-spin ${
                theme === 'dark'
                  ? 'border-white/30 border-t-white'
                  : 'border-neutral-400 border-t-neutral-600'
              }`}
            />
          </div>
        )}
      </Button>
    </GlassPanel>
  );
};
