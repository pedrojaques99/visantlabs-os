import React, { useCallback } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { SectionBlock } from '../SectionBlock';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { MicroTitle } from '@/components/ui/MicroTitle';
import { Frame, Plus, Trash2 } from '@/lib/ui/icons';
import { cn } from '@/lib/utils';
import type { BrandGuideline, BrandGuidelineBorder } from '@/lib/figma-types';
import { buildBorderCss } from '@/utils/brand-css';
import { makeId } from '@/utils/id';

interface BorderSectionProps {
  guideline: BrandGuideline;
  onUpdate: (data: Partial<BrandGuideline>) => void;
  span?: string;
}

type BorderStyle = 'solid' | 'dashed' | 'dotted';
type BorderRole = 'default' | 'emphasis' | 'scaffold' | 'divider';

const DEFAULT_BORDERS: Omit<BrandGuidelineBorder, 'id'>[] = [
  { name: 'Default', width: 1, style: 'solid', color: '#ffffff', opacity: 0.1, role: 'default' },
  {
    name: 'Emphasis',
    width: 1.5,
    style: 'solid',
    color: '#ffffff',
    opacity: 0.3,
    role: 'emphasis',
  },
  { name: 'Divider', width: 1, style: 'solid', color: '#ffffff', opacity: 0.03, role: 'divider' },
];

export const BorderSection: React.FC<BorderSectionProps> = ({ guideline, onUpdate, span }) => {
  const { t } = useTranslation();
  const items = guideline.borders || [];

  const persist = useCallback(
    (next: BrandGuidelineBorder[]) => {
      onUpdate({ borders: next.map((b) => ({ ...b, css: buildBorderCss(b) })) });
    },
    [onUpdate]
  );

  const update = (idx: number, patch: Partial<BrandGuidelineBorder>) => {
    const next = items.map((b, i) => (i === idx ? { ...b, ...patch } : b));
    persist(next);
  };

  const addBorder = () => {
    const next = [
      ...items,
      {
        id: makeId(),
        name: 'Border',
        width: 1,
        style: 'solid' as BorderStyle,
        color: '#ffffff',
        opacity: 0.1,
        role: 'default' as BorderRole,
      },
    ];
    persist(next);
  };

  const removeBorder = (idx: number) => {
    const next = items.filter((_, i) => i !== idx);
    persist(next);
  };

  const seedDefaults = () => {
    const next = DEFAULT_BORDERS.map((d) => ({ ...d, id: makeId() }));
    persist(next);
  };

  return (
    <SectionBlock
      id="borders"
      icon={<Frame size={14} />}
      title={t('brandEditor.borders')}
      span={span as any}
      actions={
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-muted-foreground hover:text-foreground"
          onClick={addBorder}
          aria-label={t('brandEditor.addBorder')}
        >
          <Plus size={12} />
        </Button>
      }
    >
      <div className="space-y-1.5 py-1">
        {items.length === 0 && (
          <div className="space-y-2">
            <p className="text-2xs text-muted-foreground/50">{t('brandEditor.noBordersYet')}</p>
            <button
              type="button"
              onClick={seedDefaults}
              className="text-2xs font-mono text-muted-foreground/70 hover:text-muted-foreground transition-colors"
            >
              {t('brandEditor.seedDefaults')}
            </button>
          </div>
        )}
        {items.map((b, bi) => (
          <div
            key={b.id}
            className="group/border border-b border-border last:border-0 overflow-hidden"
          >
            {/* Always visible */}
            <div className="flex items-center gap-2 p-2">
              <div
                className="w-10 h-6 rounded shrink-0 bg-card"
                style={{ border: buildBorderCss(b) }}
              />
              <Input
                value={b.name}
                onChange={(e) => update(bi, { name: e.target.value })}
                className="h-6 flex-1 bg-transparent border-none p-0 text-xs text-foreground focus-visible:ring-0 placeholder:text-muted-foreground/50"
                placeholder={t('brandEditor.borderName')}
              />
              <span className="text-2xs font-mono text-muted-foreground/50">
                {b.width}px {b.style}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 text-muted-foreground/50 hover:text-destructive opacity-0 group-hover/border:opacity-100 transition-[color,background-color,border-color,opacity] shrink-0"
                onClick={() => removeBorder(bi)}
                aria-label={t('common.remove')}
              >
                <Trash2 size={10} />
              </Button>
            </div>
            {/* Hover-reveal */}
            <div className="hover-reveal group-hover/border:max-h-[200px] group-focus-within/border:max-h-[200px]">
              <div className="px-2 pb-2 space-y-2 border-t border-border pt-2">
                <div className="flex gap-1">
                  {(['solid', 'dashed', 'dotted'] as BorderStyle[]).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => update(bi, { style: s })}
                      className={cn(
                        'flex-1 h-6 rounded border text-2xs uppercase transition-colors',
                        b.style === s
                          ? 'border-border-hover bg-muted text-foreground'
                          : 'border-border text-muted-foreground hover:border-border-hover'
                      )}
                    >
                      {s}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative w-6 h-6 shrink-0">
                    <div
                      className="w-full h-full rounded border border-border"
                      style={{ backgroundColor: b.color }}
                    />
                    <input
                      type="color"
                      value={b.color}
                      onChange={(e) => update(bi, { color: e.target.value })}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                  </div>
                  <div className="space-y-0.5 w-16">
                    <MicroTitle className="text-muted-foreground/50 text-2xs">{t('brandEditor.width')}</MicroTitle>
                    <Input
                      type="number"
                      step="0.5"
                      min="0.5"
                      value={b.width}
                      onChange={(e) => update(bi, { width: Number(e.target.value) })}
                      className="h-6 border-border text-2xs font-mono text-center"
                    />
                  </div>
                  <div className="flex-1 space-y-0.5">
                    <MicroTitle className="text-muted-foreground/50 text-2xs">{t('brandEditor.opacity')}</MicroTitle>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.01}
                      value={b.opacity}
                      onChange={(e) => update(bi, { opacity: Number(e.target.value) })}
                      className="w-full h-1 accent-foreground"
                    />
                  </div>
                  <span className="text-2xs font-mono text-muted-foreground/70 w-8 text-right">
                    {Math.round(b.opacity * 100)}%
                  </span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {(['default', 'emphasis', 'scaffold', 'divider'] as BorderRole[]).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => update(bi, { role: r })}
                      className={cn(
                        'px-2 h-5 rounded border text-2xs font-mono transition-colors',
                        b.role === r
                          ? 'border-border-hover bg-muted text-foreground'
                          : 'border-border text-muted-foreground hover:border-border-hover'
                      )}
                    >
                      {r}
                    </button>
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
