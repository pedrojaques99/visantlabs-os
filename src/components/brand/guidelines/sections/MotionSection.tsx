import React, { useState, useEffect } from 'react';
import { SectionBlock } from '../SectionBlock';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
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

const PHILOSOPHY_OPTIONS: { value: Philosophy; label: string; desc: string }[] = [
  { value: 'minimal', label: 'Minimal', desc: 'opacity & translate only' },
  { value: 'moderate', label: 'Moderate', desc: 'transforms + scale' },
  { value: 'expressive', label: 'Expressive', desc: 'spring, bounce' },
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
  const [isEditing, setIsEditing] = useState(false);
  const [motion, setMotion] = useState<BrandGuidelineMotion>(guideline.motion || {});

  useEffect(() => {
    setMotion(guideline.motion || {});
  }, [guideline.id]);

  const handleSave = () => {
    onUpdate({ motion });
    setIsEditing(false);
  };

  const patch = (p: Partial<BrandGuidelineMotion>) => setMotion(prev => ({ ...prev, ...p }));
  const patchDuration = (key: keyof NonNullable<BrandGuidelineMotion['durations']>, val: number) => {
    setMotion(prev => ({ ...prev, durations: { fast: 140, medium: 260, slow: 480, ...prev.durations, [key]: val } }));
  };

  const seedDefaults = () => { setMotion(DEFAULT_MOTION); setIsEditing(true); };

  const hasData = guideline.motion && (guideline.motion.easing || guideline.motion.durations || guideline.motion.philosophy);

  return (
    <SectionBlock
      id="motion"
      icon={<Zap size={14} className="text-brand-cyan" />}
      title="Motion"
      isEditing={isEditing}
      onEdit={() => setIsEditing(true)}
      onSave={handleSave}
      onCancel={() => { setMotion(guideline.motion || {}); setIsEditing(false); }}
      span={span as any}
    >
      <div className="space-y-4 py-2">
        {isEditing ? (
          <div className="space-y-5">
            {/* Philosophy */}
            <div className="space-y-2">
              <MicroTitle className="text-[10px] opacity-40 uppercase pl-1 tracking-widest">Philosophy</MicroTitle>
              <div className="grid grid-cols-3 gap-2">
                {PHILOSOPHY_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => patch({ philosophy: opt.value })}
                    className={cn(
                      'p-3 rounded-xl border text-left transition-all',
                      motion.philosophy === opt.value
                        ? 'border-brand-cyan/40 bg-brand-cyan/10'
                        : 'border-white/5 bg-white/[0.02] hover:border-white/10'
                    )}
                  >
                    <p className={cn('text-[10px] font-mono font-bold uppercase tracking-wider', motion.philosophy === opt.value ? 'text-brand-cyan' : 'text-neutral-400')}>{opt.label}</p>
                    <p className="text-[9px] text-neutral-600 mt-0.5">{opt.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Easing */}
            <div className="space-y-2">
              <MicroTitle className="text-[10px] opacity-40 uppercase pl-1 tracking-widest">Easing Curve</MicroTitle>
              <div className="flex gap-1 flex-wrap mb-2">
                {EASING_PRESETS.map(p => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => patch({ easing: p.value })}
                    className={cn(
                      'px-2 py-1 rounded-md border text-[9px] font-mono tracking-wide transition-all',
                      motion.easing === p.value ? 'border-brand-cyan/40 bg-brand-cyan/10 text-brand-cyan' : 'border-white/5 bg-white/[0.02] text-neutral-600 hover:border-white/10'
                    )}
                  >{p.label}</button>
                ))}
              </div>
              <Input
                value={motion.easing || ''}
                onChange={e => patch({ easing: e.target.value })}
                className="bg-neutral-950/80 border-white/5 text-[10px] font-mono text-white h-9 rounded-xl focus:border-brand-cyan/30"
                placeholder="cubic-bezier(x1, y1, x2, y2)"
              />
            </div>

            {/* Durations */}
            <div className="space-y-2">
              <MicroTitle className="text-[10px] opacity-40 uppercase pl-1 tracking-widest">Duration Scale (ms)</MicroTitle>
              <div className="grid grid-cols-3 gap-3">
                {(['fast', 'medium', 'slow'] as const).map(key => (
                  <div key={key} className="space-y-1">
                    <MicroTitle className="text-[9px] opacity-30 uppercase pl-0.5 tracking-widest">{key}</MicroTitle>
                    <Input
                      type="number"
                      value={motion.durations?.[key] ?? DEFAULT_MOTION.durations![key]}
                      onChange={e => patchDuration(key, Number(e.target.value))}
                      className="bg-neutral-950/80 border-white/5 text-[10px] font-mono text-white h-9 rounded-xl focus:border-brand-cyan/30 text-center"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Reduced Motion */}
            <label className="flex items-center gap-3 cursor-pointer group/rm">
              <div
                onClick={() => patch({ respectsReducedMotion: !motion.respectsReducedMotion })}
                className={cn(
                  'w-8 h-4 rounded-full border transition-all cursor-pointer relative',
                  motion.respectsReducedMotion ? 'bg-brand-cyan/30 border-brand-cyan/40' : 'bg-white/[0.03] border-white/10'
                )}
              >
                <div className={cn('absolute top-0.5 w-3 h-3 rounded-full transition-all', motion.respectsReducedMotion ? 'left-4 bg-brand-cyan' : 'left-0.5 bg-neutral-600')} />
              </div>
              <span className="text-[11px] text-neutral-400 group-hover/rm:text-white transition-colors">Respects <code className="font-mono text-[10px] bg-white/5 px-1 rounded">prefers-reduced-motion</code></span>
            </label>

            {!hasData && (
              <Button variant="outline" type="button" onClick={seedDefaults}
                className="w-full h-9 border-dashed border-brand-cyan/20 hover:border-brand-cyan/40 bg-transparent text-brand-cyan/50 hover:text-brand-cyan transition-all rounded-xl"
              >
                <span className="text-[10px] font-mono uppercase tracking-widest">Seed Default Tokens</span>
              </Button>
            )}
          </div>
        ) : (
          hasData ? (
            <button type="button" aria-label="Editar motion" className="space-y-4 cursor-pointer text-left w-full" onClick={() => setIsEditing(true)}>
              {guideline.motion?.philosophy && (
                <div className="flex items-center gap-2">
                  <span className="px-2 py-1 rounded-md bg-brand-cyan/10 border border-brand-cyan/20 text-[10px] font-mono text-brand-cyan uppercase tracking-widest">
                    {guideline.motion.philosophy}
                  </span>
                  {guideline.motion.respectsReducedMotion && (
                    <span className="px-2 py-1 rounded-md bg-white/[0.03] border border-white/10 text-[10px] font-mono text-neutral-500">reduced-motion ✓</span>
                  )}
                </div>
              )}
              {guideline.motion?.easing && (
                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.03]">
                  <p className="text-[9px] font-mono text-neutral-600 uppercase tracking-widest mb-1">Easing</p>
                  <p className="text-[11px] font-mono text-neutral-300">{guideline.motion.easing}</p>
                </div>
              )}
              {guideline.motion?.durations && (
                <div className="grid grid-cols-3 gap-2">
                  {(['fast', 'medium', 'slow'] as const).map(k => (
                    <div key={k} className="p-2 rounded-xl bg-white/[0.02] border border-white/[0.03] text-center">
                      <p className="text-[9px] font-mono text-neutral-600 uppercase tracking-widest">{k}</p>
                      <p className="text-[12px] font-mono text-white font-bold">{guideline.motion!.durations![k]}ms</p>
                    </div>
                  ))}
                </div>
              )}
            </button>
          ) : (
            <div className="py-10 text-center space-y-3">
              <p className="text-[10px] font-mono tracking-widest uppercase border border-dashed border-white/5 opacity-30 rounded-2xl py-8">No Motion Tokens</p>
              <Button variant="outline" size="sm" onClick={seedDefaults}
                className="border-brand-cyan/20 text-brand-cyan/60 hover:text-brand-cyan hover:border-brand-cyan/40 transition-all text-[10px] font-mono uppercase tracking-widest"
              >
                Seed Defaults
              </Button>
            </div>
          )
        )}
      </div>
    </SectionBlock>
  );
};
