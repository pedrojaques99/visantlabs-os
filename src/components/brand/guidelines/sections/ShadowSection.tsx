import React, { useCallback } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { SectionBlock } from '../SectionBlock';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { MicroTitle } from '@/components/ui/MicroTitle';
import { Layers2, Plus, Trash2 } from '@/lib/ui/icons';
import { cn } from '@/lib/utils';
import type { BrandGuideline, BrandGuidelineShadow } from '@/lib/figma-types';
import { buildShadowCss } from '@/utils/brand-css';
import { makeId } from '@/utils/id';

interface ShadowSectionProps {
  guideline: BrandGuideline;
  onUpdate: (data: Partial<BrandGuideline>) => void;
  span?: string;
}

type ShadowType = 'outer' | 'inner' | 'glow';

// EXCEÇÃO ao audit:design/hardcoded-hex-color: presets de DADO da marca (viram sombra salva no guideline), não cor de cromo.
const DEFAULT_SHADOWS: Omit<BrandGuidelineShadow, 'id'>[] = [
  { name: 'Micro', x: 0, y: 2, blur: 4, spread: 0, color: '#000000', opacity: 0.15, type: 'outer' },
  { name: 'Soft', x: 6, y: 6, blur: 17, spread: 0, color: '#6d6d6d', opacity: 0.15, type: 'outer' },
  { name: 'Glow', x: 0, y: 0, blur: 24, spread: 0, color: '#52DDEB', opacity: 0.35, type: 'glow' },
];

export const ShadowSection: React.FC<ShadowSectionProps> = ({ guideline, onUpdate, span }) => {
  const { t } = useTranslation();
  const items = guideline.shadows || [];

  const persist = useCallback(
    (next: BrandGuidelineShadow[]) => {
      onUpdate({ shadows: next.map((s) => ({ ...s, css: buildShadowCss(s) })) });
    },
    [onUpdate]
  );

  const update = (idx: number, patch: Partial<BrandGuidelineShadow>) => {
    const next = items.map((s, i) => (i === idx ? { ...s, ...patch } : s));
    persist(next);
  };

  const addShadow = () => {
    const next = [
      ...items,
      {
        id: makeId(),
        name: 'Shadow',
        x: 0,
        y: 4,
        blur: 12,
        spread: 0,
        color: '#000000',
        opacity: 0.2,
        type: 'outer' as ShadowType,
      },
    ];
    persist(next);
  };

  const removeShadow = (idx: number) => {
    const next = items.filter((_, i) => i !== idx);
    persist(next);
  };

  const seedDefaults = () => {
    const next = DEFAULT_SHADOWS.map((d) => ({ ...d, id: makeId() }));
    persist(next);
  };

  return (
    <SectionBlock
      id="shadows"
      icon={<Layers2 size={14} />}
      title={t('brandEditor.shadows')}
      span={span as any}
      actions={
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-muted-foreground hover:text-foreground"
          onClick={addShadow}
          aria-label={t('brandEditor.addShadow')}
        >
          <Plus size={12} />
        </Button>
      }
    >
      <div className="space-y-1.5 py-1">
        {items.length === 0 && (
          <div className="space-y-2">
            <p className="text-2xs text-muted-foreground/50">{t('brandEditor.noShadowsYet')}</p>
            <button
              type="button"
              onClick={seedDefaults}
              className="text-2xs font-mono text-muted-foreground/70 hover:text-muted-foreground transition-colors"
            >
              {t('brandEditor.seedDefaults')}
            </button>
          </div>
        )}
        {items.map((s, si) => (
          <div
            key={s.id}
            className="group/shadow border-b border-border last:border-0 overflow-hidden"
          >
            {/* Always visible */}
            <div className="flex items-center gap-2 p-2">
              <div
                className="w-8 h-8 rounded shrink-0 bg-muted border border-border"
                style={{ boxShadow: buildShadowCss(s) }}
              />
              <Input
                value={s.name}
                onChange={(e) => update(si, { name: e.target.value })}
                className="h-6 flex-1 bg-transparent border-none p-0 text-xs text-foreground focus-visible:ring-0 placeholder:text-muted-foreground/50"
                placeholder={t('brandEditor.shadowName')}
              />
              <span className="text-2xs font-mono text-muted-foreground/50 truncate max-w-[80px] hidden sm:block">
                {buildShadowCss(s)}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 text-muted-foreground/50 hover:text-destructive opacity-0 group-hover/shadow:opacity-100 transition-[color,background-color,border-color,box-shadow,opacity] shrink-0"
                onClick={() => removeShadow(si)}
                aria-label={t('common.remove')}
              >
                <Trash2 size={10} />
              </Button>
            </div>
            {/* Hover-reveal: detail controls */}
            <div className="hover-reveal group-hover/shadow:max-h-[300px] group-focus-within/shadow:max-h-[300px]">
              <div className="px-2 pb-2 space-y-2 border-t border-border pt-2">
                <div className="flex gap-1">
                  {(['outer', 'inner', 'glow'] as ShadowType[]).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => update(si, { type: t })}
                      className={cn(
                        'flex-1 h-6 rounded border text-2xs uppercase transition-[color,background-color,border-color,box-shadow]',
                        s.type === t
                          ? 'border-border-hover bg-muted text-foreground'
                          : 'border-border text-muted-foreground hover:border-border-hover'
                      )}
                    >
                      {t}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {[
                    { label: 'X', field: 'x' as const },
                    { label: 'Y', field: 'y' as const },
                    { label: t('brandEditor.blur'), field: 'blur' as const },
                    { label: t('brandEditor.spread'), field: 'spread' as const },
                  ].map(({ label, field }) => (
                    <div key={field} className="space-y-0.5">
                      <MicroTitle className="text-muted-foreground/50 text-2xs">{label}</MicroTitle>
                      <Input
                        type="number"
                        value={s[field]}
                        onChange={(e) => update(si, { [field]: Number(e.target.value) })}
                        className="h-6 border-border text-2xs font-mono text-center"
                      />
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative w-6 h-6 shrink-0">
                    <div
                      className="w-full h-full rounded border border-border"
                      style={{ backgroundColor: s.color }}
                    />
                    <input
                      type="color"
                      value={s.color}
                      onChange={(e) => update(si, { color: e.target.value })}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                  </div>
                  <span className="text-2xs font-mono text-muted-foreground/70 w-14">
                    {s.color}
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={s.opacity}
                    onChange={(e) => update(si, { opacity: Number(e.target.value) })}
                    className="flex-1 h-1 accent-foreground"
                  />
                  <span className="text-2xs font-mono text-muted-foreground/70 w-8 text-right">
                    {Math.round(s.opacity * 100)}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </SectionBlock>
  );
};
