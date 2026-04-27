import React, { useCallback } from 'react';
import { SectionBlock } from '../SectionBlock';
import { Input } from '@/components/ui/input';
import { MicroTitle } from '@/components/ui/MicroTitle';
import { Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { BrandGuideline, BrandGuidelineMotion } from '@/lib/figma-types';

interface MotionSectionProps {
  guideline: BrandGuideline;
  onUpdate: (data: Partial<BrandGuideline>) => void;
  span?: string;
}

type Philosophy = 'minimal' | 'moderate' | 'expressive';

const PHILOSOPHY_OPTIONS: { value: Philosophy; label: string }[] = [
  { value: 'minimal', label: 'Minimal' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'expressive', label: 'Expressive' },
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
  // No local state — draft is owned by GuidelineDetail via useBrandGuidelineDraft
  const motion = guideline.motion || {};

  const persist = useCallback((next: BrandGuidelineMotion) => {
    onUpdate({ motion: next });
  }, [onUpdate]);

  const patch = (p: Partial<BrandGuidelineMotion>) => {
    persist({ ...motion, ...p });
  };

  const patchDuration = (key: keyof NonNullable<BrandGuidelineMotion['durations']>, val: number) => {
    persist({ ...motion, durations: { fast: 140, medium: 260, slow: 480, ...motion.durations, [key]: val } });
  };

  const isEmpty = !motion.easing && !motion.philosophy && !motion.durations;

  return (
    <SectionBlock id="motion" icon={<Zap size={14} />} title="Motion" span={span as any}>
      <div className="space-y-3 py-1 group/motion">
        {isEmpty && (
          <div className="space-y-2">
            <p className="text-[11px] text-neutral-700">No motion tokens yet.</p>
            <button type="button" onClick={() => persist(DEFAULT_MOTION)} className="text-[10px] font-mono text-neutral-600 hover:text-neutral-400 transition-colors">Seed defaults</button>
          </div>
        )}

        {/* Philosophy: always visible as compact pills */}
        <div className="space-y-1">
          <MicroTitle className="text-neutral-600">Philosophy</MicroTitle>
          <div className="flex gap-1">
            {PHILOSOPHY_OPTIONS.map(opt => (
              <button key={opt.value} type="button" onClick={() => patch({ philosophy: opt.value })}
                className={cn('flex-1 h-6 rounded border text-[9px] font-mono uppercase transition-all', motion.philosophy === opt.value ? 'border-white/20 bg-white/[0.06] text-neutral-200' : 'border-white/5 text-neutral-600 hover:border-white/10')}
              >{opt.label}</button>
            ))}
          </div>
        </div>

        {/* Durations: always visible, compact */}
        <div className="space-y-1">
          <MicroTitle className="text-neutral-600">Durations (ms)</MicroTitle>
          <div className="grid grid-cols-3 gap-1.5">
            {(['fast', 'medium', 'slow'] as const).map(key => (
              <div key={key} className="space-y-0.5">
                <MicroTitle className="text-neutral-700 text-[9px]">{key}</MicroTitle>
                <Input type="number" value={motion.durations?.[key] ?? DEFAULT_MOTION.durations![key]} onChange={e => patchDuration(key, Number(e.target.value))} className="h-6 border-white/5 text-[10px] font-mono text-center" />
              </div>
            ))}
          </div>
        </div>

        {/* Easing: hover-reveal preset buttons, always show input */}
        <div className="space-y-1">
          <MicroTitle className="text-neutral-600">Easing</MicroTitle>
          {/* Preset buttons hidden until hover */}
          <div className="max-h-0 overflow-hidden group-hover/motion:max-h-12 group-focus-within/motion:max-h-12 transition-[max-height] duration-150 ease-out mb-1">
            <div className="flex flex-wrap gap-1 pb-1">
              {EASING_PRESETS.map(p => (
                <button key={p.value} type="button" onClick={() => patch({ easing: p.value })}
                  className={cn('px-2 h-5 rounded border text-[9px] font-mono transition-all', motion.easing === p.value ? 'border-white/20 bg-white/[0.06] text-neutral-200' : 'border-white/5 text-neutral-600 hover:border-white/10')}
                >{p.label}</button>
              ))}
            </div>
          </div>
          <Input value={motion.easing || ''} onChange={e => patch({ easing: e.target.value })} className="h-7 border-white/5 text-[10px] font-mono text-neutral-400 placeholder:text-neutral-700" placeholder="cubic-bezier(x1, y1, x2, y2)" />
        </div>

        {/* Reduced motion: hover-reveal */}
        <div className="max-h-0 overflow-hidden group-hover/motion:max-h-12 group-focus-within/motion:max-h-12 transition-[max-height] duration-150 ease-out">
          <label className="flex items-center gap-2 cursor-pointer pt-1">
            <div onClick={() => patch({ respectsReducedMotion: !motion.respectsReducedMotion })}
              className={cn('w-7 h-3.5 rounded-full border transition-all cursor-pointer relative shrink-0', motion.respectsReducedMotion ? 'bg-white/10 border-white/20' : 'bg-white/[0.03] border-white/10')}
            >
              <div className={cn('absolute top-0.5 w-2.5 h-2.5 rounded-full transition-all bg-neutral-500', motion.respectsReducedMotion ? 'left-3.5 bg-neutral-300' : 'left-0.5')} />
            </div>
            <span className="text-[10px] font-mono text-neutral-500">prefers-reduced-motion</span>
          </label>
        </div>
      </div>
    </SectionBlock>
  );
};
