import React, { useCallback } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { SectionBlock } from '../SectionBlock';
import { Input } from '@/components/ui/input';
import { MicroTitle } from '@/components/ui/MicroTitle';
import { Zap } from '@/lib/ui/icons';
import { cn } from '@/lib/utils';
import type { BrandGuideline, BrandGuidelineMotion } from '@/lib/figma-types';

interface MotionSectionProps {
  guideline: BrandGuideline;
  onUpdate: (data: Partial<BrandGuideline>) => void;
  span?: string;
}

type Philosophy = 'minimal' | 'moderate' | 'expressive';

const PHILOSOPHY_OPTIONS: { value: Philosophy; label: string }[] = [
  { value: 'minimal', label: 'brandEditor.philosophyMinimal' },
  { value: 'moderate', label: 'brandEditor.philosophyModerate' },
  { value: 'expressive', label: 'brandEditor.philosophyExpressive' },
];

const EASING_PRESETS = [
  { label: 'Ease Out', value: 'cubic-bezier(0.16, 1, 0.3, 1)' },
  { label: 'Ease In Out', value: 'cubic-bezier(0.4, 0, 0.2, 1)' },
  { label: 'Snappy', value: 'cubic-bezier(0.2, 0.7, 0.2, 1)' },
  { label: 'Linear', value: 'linear' },
];

const DEFAULT_MOTION: BrandGuidelineMotion = {
  easing: 'cubic-bezier(0.2, 0.7, 0.2, 1)',
  durations: { fast: 140, medium: 260, slow: 480 },
  philosophy: 'minimal',
  respectsReducedMotion: true,
};

export const MotionSection: React.FC<MotionSectionProps> = ({ guideline, onUpdate, span }) => {
  const { t } = useTranslation();
  const motion = guideline.motion || {};

  const persist = useCallback(
    (next: BrandGuidelineMotion) => {
      onUpdate({ motion: next });
    },
    [onUpdate]
  );

  const patch = (p: Partial<BrandGuidelineMotion>) => {
    persist({ ...motion, ...p });
  };

  const patchDuration = (
    key: keyof NonNullable<BrandGuidelineMotion['durations']>,
    val: number
  ) => {
    persist({
      ...motion,
      durations: { fast: 140, medium: 260, slow: 480, ...motion.durations, [key]: val },
    });
  };

  const isEmpty = !motion.easing && !motion.philosophy && !motion.durations;

  return (
    <SectionBlock
      id="motion"
      icon={<Zap size={14} />}
      title={t('brandEditor.motion')}
      span={span as any}
    >
      <div className="space-y-3 py-1 group/motion">
        {isEmpty && (
          <div className="space-y-2">
            <p className="text-2xs text-muted-foreground/50">{t('brandEditor.noMotionYet')}</p>
            <button
              type="button"
              onClick={() => persist(DEFAULT_MOTION)}
              className="text-2xs font-mono text-muted-foreground/70 hover:text-muted-foreground transition-colors"
            >
              {t('brandEditor.seedDefaults')}
            </button>
          </div>
        )}

        {/* Philosophy: always visible as compact pills */}
        <div className="space-y-1">
          <MicroTitle className="text-muted-foreground/70">
            {t('brandEditor.philosophy')}
          </MicroTitle>
          <div className="flex gap-1">
            {PHILOSOPHY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => patch({ philosophy: opt.value })}
                className={cn(
                  'flex-1 h-6 rounded border text-2xs uppercase transition-colors',
                  motion.philosophy === opt.value
                    ? 'border-border-hover bg-muted text-foreground'
                    : 'border-border text-muted-foreground hover:border-border-hover'
                )}
              >
                {t(opt.label)}
              </button>
            ))}
          </div>
        </div>

        {/* Durations: always visible, compact */}
        <div className="space-y-1">
          <MicroTitle className="text-muted-foreground/70">{t('brandEditor.durations')}</MicroTitle>
          <div className="grid grid-cols-3 gap-1.5">
            {(['fast', 'medium', 'slow'] as const).map((key) => (
              <div key={key} className="space-y-0.5">
                <MicroTitle className="text-muted-foreground/50 text-2xs">{key}</MicroTitle>
                <Input
                  type="number"
                  value={motion.durations?.[key] ?? DEFAULT_MOTION.durations![key]}
                  onChange={(e) => patchDuration(key, Number(e.target.value))}
                  className="h-6 border-border text-2xs font-mono text-center"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Easing: hover-reveal preset buttons, always show input */}
        <div className="space-y-1">
          <MicroTitle className="text-muted-foreground/70">Easing</MicroTitle>
          {/* Preset buttons hidden until hover */}
          <div className="max-h-0 overflow-hidden group-hover/motion:max-h-12 group-focus-within/motion:max-h-12 transition-[max-height] duration-150 ease-out mb-1">
            <div className="flex flex-wrap gap-1 pb-1">
              {EASING_PRESETS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => patch({ easing: p.value })}
                  className={cn(
                    'px-2 h-5 rounded border text-2xs font-mono transition-colors',
                    motion.easing === p.value
                      ? 'border-border-hover bg-muted text-foreground'
                      : 'border-border text-muted-foreground hover:border-border-hover'
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <Input
            value={motion.easing || ''}
            onChange={(e) => patch({ easing: e.target.value })}
            className="h-7 border-border text-2xs font-mono text-muted-foreground placeholder:text-muted-foreground/50"
            placeholder="cubic-bezier(x1, y1, x2, y2)"
          />
        </div>

        {/* Reduced motion: hover-reveal */}
        <div className="max-h-0 overflow-hidden group-hover/motion:max-h-12 group-focus-within/motion:max-h-12 transition-[max-height] duration-150 ease-out">
          <label className="flex items-center gap-2 cursor-pointer pt-1">
            <button
              type="button"
              onClick={() => patch({ respectsReducedMotion: !motion.respectsReducedMotion })}
              className={cn(
                'w-7 h-3.5 rounded-full border transition-colors cursor-pointer relative shrink-0',
                motion.respectsReducedMotion
                  ? 'bg-accent border-border-hover'
                  : 'bg-muted border-border'
              )}
              aria-label={t('brandEditor.toggleReducedMotion')}
            >
              <div
                className={cn(
                  'absolute top-0.5 w-2.5 h-2.5 rounded-full transition-[left,background-color] bg-muted-foreground',
                  motion.respectsReducedMotion ? 'left-3.5 bg-foreground' : 'left-0.5'
                )}
              />
            </button>
            <span className="text-2xs font-mono text-muted-foreground">prefers-reduced-motion</span>
          </label>
        </div>
      </div>
    </SectionBlock>
  );
};
