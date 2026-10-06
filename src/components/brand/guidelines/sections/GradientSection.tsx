import React, { useCallback } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { SectionBlock } from '../SectionBlock';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { MicroTitle } from '@/components/ui/MicroTitle';
import { Blend, Plus, Trash2 } from '@/lib/ui/icons';
import { cn } from '@/lib/utils';
import type { BrandGuideline, BrandGuidelineGradient } from '@/lib/figma-types';
import { buildGradientCss } from '@/utils/brand-css';
import { makeId } from '@/utils/id';

interface GradientSectionProps {
  guideline: BrandGuideline;
  onUpdate: (data: Partial<BrandGuideline>) => void;
  span?: string;
}

type GradientUsage = 'hero' | 'decorative' | 'fill' | 'overlay';
const USAGE_LABELS: Record<GradientUsage, string> = {
  hero: 'brandEditor.usageHero',
  decorative: 'brandEditor.usageDecorative',
  fill: 'brandEditor.usageFill',
  overlay: 'brandEditor.usageOverlay',
};

export const GradientSection: React.FC<GradientSectionProps> = ({ guideline, onUpdate, span }) => {
  const { t } = useTranslation();
  const items = guideline.gradients || [];

  const persist = useCallback(
    (next: BrandGuidelineGradient[]) => {
      onUpdate({ gradients: next.map((g) => ({ ...g, css: buildGradientCss(g) })) });
    },
    [onUpdate]
  );

  const updateItem = (idx: number, patch: Partial<BrandGuidelineGradient>) => {
    const next = items.map((g, i) => (i === idx ? { ...g, ...patch } : g));
    persist(next);
  };

  const updateStop = (
    gi: number,
    si: number,
    field: 'color' | 'position',
    value: string | number
  ) => {
    const next = items.map((g, i) =>
      i !== gi
        ? g
        : { ...g, stops: g.stops.map((s, j) => (j === si ? { ...s, [field]: value } : s)) }
    );
    persist(next);
  };

  const addStop = (gi: number) => {
    const next = items.map((g, i) =>
      i !== gi ? g : { ...g, stops: [...g.stops, { color: '#ffffff', position: 50 }] }
    );
    persist(next);
  };

  const removeStop = (gi: number, si: number) => {
    const next = items.map((g, i) =>
      i !== gi ? g : { ...g, stops: g.stops.filter((_, j) => j !== si) }
    );
    persist(next);
  };

  const addGradient = () => {
    // EXCEÇÃO ao audit:design/hardcoded-hex-color: semente de DADO da marca (vira stop salvo no guideline), não cor de cromo.
    const p = guideline.colors?.[0]?.hex || '#52DDEB';
    const s = guideline.colors?.[1]?.hex || '#1F7878';
    const next = [
      ...items,
      {
        id: makeId(),
        name: 'New Gradient',
        type: 'linear' as const,
        angle: 135,
        stops: [
          { color: p, position: 0 },
          { color: s, position: 100 },
        ],
        usage: 'decorative' as GradientUsage,
      },
    ];
    persist(next);
  };

  const removeGradient = (idx: number) => {
    const next = items.filter((_, i) => i !== idx);
    persist(next);
  };

  return (
    <SectionBlock
      id="gradients"
      icon={<Blend size={14} />}
      title={t('brandEditor.gradients')}
      span={span as any}
      actions={
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-muted-foreground hover:text-foreground"
          onClick={addGradient}
          aria-label={t('brandEditor.addGradient')}
        >
          <Plus size={12} />
        </Button>
      }
    >
      <div className="space-y-2 py-1">
        {items.length === 0 && (
          <p className="text-2xs text-muted-foreground/50 py-2">
            {t('brandEditor.noGradientsAdd')}
          </p>
        )}
        {items.map((g, gi) => (
          <div
            key={g.id}
            className="group/grad border-b border-border last:border-0 overflow-hidden"
          >
            {/* Always visible: preview + name */}
            <div className="flex items-center gap-2 p-2">
              <div
                className="w-10 h-6 rounded shrink-0 border border-border"
                style={{ background: buildGradientCss(g) }}
              />
              <Input
                value={g.name}
                onChange={(e) => updateItem(gi, { name: e.target.value })}
                className="h-6 flex-1 bg-transparent border-none p-0 text-xs text-foreground focus-visible:ring-0 placeholder:text-muted-foreground/50"
                placeholder={t('brandEditor.gradientName')}
              />
              <span className="text-2xs font-mono text-muted-foreground/50">
                {g.type} {g.type === 'linear' ? `${g.angle}°` : ''}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 text-muted-foreground/50 hover:text-destructive opacity-0 group-hover/grad:opacity-100 transition-[color,background-color,border-color,opacity] shrink-0"
                onClick={() => removeGradient(gi)}
                aria-label={t('common.remove')}
              >
                <Trash2 size={10} />
              </Button>
            </div>
            {/* Hover-reveal: detail controls */}
            <div className="hover-reveal group-hover/grad:max-h-[400px] group-focus-within/grad:max-h-[400px]">
              <div className="pt-1 pb-2 space-y-2 border-t border-border">
                <div className="flex gap-2 pt-2">
                  {(['linear', 'radial'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => updateItem(gi, { type: t })}
                      className={cn(
                        'flex-1 h-6 rounded border text-2xs uppercase transition-colors',
                        g.type === t
                          ? 'border-border-hover bg-muted text-foreground'
                          : 'border-border text-muted-foreground hover:border-border-hover'
                      )}
                    >
                      {t}
                    </button>
                  ))}
                  {g.type === 'linear' && (
                    <Input
                      type="number"
                      value={g.angle}
                      onChange={(e) => updateItem(gi, { angle: Number(e.target.value) })}
                      className="h-6 w-14 border-border text-2xs font-mono text-center"
                      min={0}
                      max={360}
                    />
                  )}
                </div>
                <div className="flex flex-wrap gap-1">
                  {(Object.keys(USAGE_LABELS) as GradientUsage[]).map((u) => (
                    <button
                      key={u}
                      type="button"
                      onClick={() => updateItem(gi, { usage: u })}
                      className={cn(
                        'px-2 h-5 rounded border text-2xs font-mono transition-colors',
                        g.usage === u
                          ? 'border-border-hover bg-muted text-foreground'
                          : 'border-border text-muted-foreground hover:border-border-hover'
                      )}
                    >
                      {t(USAGE_LABELS[u])}
                    </button>
                  ))}
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <MicroTitle className="text-muted-foreground/50">
                      {t('brandEditor.stops')}
                    </MicroTitle>
                    <button
                      type="button"
                      onClick={() => addStop(gi)}
                      className="text-2xs font-mono text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                    >
                      + stop
                    </button>
                  </div>
                  {g.stops.map((s, si) => (
                    <div key={si} className="flex items-center gap-1.5">
                      <div className="relative w-6 h-6 shrink-0">
                        <div
                          className="w-full h-full rounded border border-border"
                          style={{ backgroundColor: s.color }}
                        />
                        <input
                          type="color"
                          value={s.color}
                          onChange={(e) => updateStop(gi, si, 'color', e.target.value)}
                          className="absolute inset-0 opacity-0 cursor-pointer"
                        />
                      </div>
                      <span className="text-2xs font-mono text-muted-foreground/70 w-14">
                        {s.color}
                      </span>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={s.position}
                        onChange={(e) => updateStop(gi, si, 'position', Number(e.target.value))}
                        className="flex-1 h-1 accent-foreground"
                      />
                      <span className="text-2xs font-mono text-muted-foreground/70 w-7 text-right">
                        {s.position}%
                      </span>
                      {g.stops.length > 2 && (
                        <button
                          type="button"
                          onClick={() => removeStop(gi, si)}
                          className="text-muted-foreground/50 hover:text-destructive transition-colors"
                        >
                          <Trash2 size={10} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </SectionBlock>
  );
};
