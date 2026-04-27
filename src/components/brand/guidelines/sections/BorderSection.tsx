import React, { useCallback } from 'react';
import { SectionBlock } from '../SectionBlock';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { MicroTitle } from '@/components/ui/MicroTitle';
import { Frame, Plus, Trash2 } from 'lucide-react';
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
  { name: 'Emphasis', width: 1.5, style: 'solid', color: '#ffffff', opacity: 0.3, role: 'emphasis' },
  { name: 'Divider', width: 1, style: 'solid', color: '#ffffff', opacity: 0.03, role: 'divider' },
];

export const BorderSection: React.FC<BorderSectionProps> = ({ guideline, onUpdate, span }) => {
  // No local state — draft is owned by GuidelineDetail via useBrandGuidelineDraft
  const items = guideline.borders || [];

  const persist = useCallback((next: BrandGuidelineBorder[]) => {
    onUpdate({ borders: next.map(b => ({ ...b, css: buildBorderCss(b) })) });
  }, [onUpdate]);

  const update = (idx: number, patch: Partial<BrandGuidelineBorder>) => {
    const next = items.map((b, i) => i === idx ? { ...b, ...patch } : b);
    persist(next);
  };

  const addBorder = () => {
    const next = [...items, { id: makeId(), name: 'Border', width: 1, style: 'solid' as BorderStyle, color: '#ffffff', opacity: 0.1, role: 'default' as BorderRole }];
    persist(next);
  };

  const removeBorder = (idx: number) => {
    const next = items.filter((_, i) => i !== idx);
    persist(next);
  };

  const seedDefaults = () => {
    const next = DEFAULT_BORDERS.map(d => ({ ...d, id: makeId() }));
    persist(next);
  };

  return (
    <SectionBlock id="borders" icon={<Frame size={14} />} title="Borders" span={span as any}
      actions={<Button variant="ghost" size="icon" className="h-6 w-6 text-neutral-500 hover:text-white" onClick={addBorder} aria-label="Add border"><Plus size={12} /></Button>}
    >
      <div className="space-y-1.5 py-1">
        {items.length === 0 && (
          <div className="space-y-2">
            <p className="text-[11px] text-neutral-700">No borders yet.</p>
            <button type="button" onClick={seedDefaults} className="text-[10px] font-mono text-neutral-600 hover:text-neutral-400 transition-colors">Seed defaults</button>
          </div>
        )}
        {items.map((b, bi) => (
          <div key={b.id} className="group/border border-b border-white/[0.04] last:border-0 overflow-hidden">
            {/* Always visible */}
            <div className="flex items-center gap-2 p-2">
              <div className="w-10 h-6 rounded shrink-0 bg-neutral-900" style={{ border: buildBorderCss(b) }} />
              <Input value={b.name} onChange={e => update(bi, { name: e.target.value })} className="h-6 flex-1 bg-transparent border-none p-0 text-xs text-neutral-300 focus-visible:ring-0 placeholder:text-neutral-700" placeholder="Border name" />
              <span className="text-[9px] font-mono text-neutral-700">{b.width}px {b.style}</span>
              <Button variant="ghost" size="icon" className="h-5 w-5 text-neutral-800 hover:text-red-400 opacity-0 group-hover/border:opacity-100 transition-all shrink-0" onClick={() => removeBorder(bi)} aria-label="Remove"><Trash2 size={10} /></Button>
            </div>
            {/* Hover-reveal */}
            <div className="hover-reveal group-hover/border:max-h-[200px] group-focus-within/border:max-h-[200px]">
              <div className="px-2 pb-2 space-y-2 border-t border-white/[0.04] pt-2">
                <div className="flex gap-1">
                  {(['solid', 'dashed', 'dotted'] as BorderStyle[]).map(s => (
                    <button key={s} type="button" onClick={() => update(bi, { style: s })}
                      className={cn('flex-1 h-6 rounded border text-[9px] font-mono uppercase transition-all', b.style === s ? 'border-white/20 bg-white/[0.06] text-neutral-200' : 'border-white/5 text-neutral-600 hover:border-white/10')}
                    >{s}</button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative w-6 h-6 shrink-0">
                    <div className="w-full h-full rounded border border-white/10" style={{ backgroundColor: b.color }} />
                    <input type="color" value={b.color} onChange={e => update(bi, { color: e.target.value })} className="absolute inset-0 opacity-0 cursor-pointer" />
                  </div>
                  <div className="space-y-0.5 w-16">
                    <MicroTitle className="text-neutral-700 text-[9px]">Width</MicroTitle>
                    <Input type="number" step="0.5" min="0.5" value={b.width} onChange={e => update(bi, { width: Number(e.target.value) })} className="h-6 border-white/5 text-[10px] font-mono text-center" />
                  </div>
                  <div className="flex-1 space-y-0.5">
                    <MicroTitle className="text-neutral-700 text-[9px]">Opacity</MicroTitle>
                    <input type="range" min={0} max={1} step={0.01} value={b.opacity} onChange={e => update(bi, { opacity: Number(e.target.value) })} className="w-full h-1 accent-white" />
                  </div>
                  <span className="text-[10px] font-mono text-neutral-600 w-8 text-right">{Math.round(b.opacity * 100)}%</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {(['default', 'emphasis', 'scaffold', 'divider'] as BorderRole[]).map(r => (
                    <button key={r} type="button" onClick={() => update(bi, { role: r })}
                      className={cn('px-2 h-5 rounded border text-[9px] font-mono transition-all', b.role === r ? 'border-white/20 bg-white/[0.06] text-neutral-200' : 'border-white/5 text-neutral-600 hover:border-white/10')}
                    >{r}</button>
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
