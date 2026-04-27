import React, { useCallback } from 'react';
import { SectionBlock } from '../SectionBlock';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { MicroTitle } from '@/components/ui/MicroTitle';
import { Blend, Plus, Trash2 } from 'lucide-react';
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
const USAGE_LABELS: Record<GradientUsage, string> = { hero: 'Hero', decorative: 'Decorative', fill: 'Fill', overlay: 'Overlay' };

export const GradientSection: React.FC<GradientSectionProps> = ({ guideline, onUpdate, span }) => {
  // No local state — draft is owned by GuidelineDetail via useBrandGuidelineDraft
  const items = guideline.gradients || [];

  const persist = useCallback((next: BrandGuidelineGradient[]) => {
    onUpdate({ gradients: next.map(g => ({ ...g, css: buildGradientCss(g) })) });
  }, [onUpdate]);

  const updateItem = (idx: number, patch: Partial<BrandGuidelineGradient>) => {
    const next = items.map((g, i) => i === idx ? { ...g, ...patch } : g);
    persist(next);
  };

  const updateStop = (gi: number, si: number, field: 'color' | 'position', value: string | number) => {
    const next = items.map((g, i) => i !== gi ? g : { ...g, stops: g.stops.map((s, j) => j === si ? { ...s, [field]: value } : s) });
    persist(next);
  };

  const addStop = (gi: number) => {
    const next = items.map((g, i) => i !== gi ? g : { ...g, stops: [...g.stops, { color: '#ffffff', position: 50 }] });
    persist(next);
  };

  const removeStop = (gi: number, si: number) => {
    const next = items.map((g, i) => i !== gi ? g : { ...g, stops: g.stops.filter((_, j) => j !== si) });
    persist(next);
  };

  const addGradient = () => {
    const p = guideline.colors?.[0]?.hex || '#52DDEB';
    const s = guideline.colors?.[1]?.hex || '#1F7878';
    const next = [...items, { id: makeId(), name: 'New Gradient', type: 'linear' as const, angle: 135, stops: [{ color: p, position: 0 }, { color: s, position: 100 }], usage: 'decorative' as GradientUsage }];
    persist(next);
  };

  const removeGradient = (idx: number) => {
    const next = items.filter((_, i) => i !== idx);
    persist(next);
  };

  return (
    <SectionBlock id="gradients" icon={<Blend size={14} />} title="Gradients" span={span as any}
      actions={<Button variant="ghost" size="icon" className="h-6 w-6 text-neutral-500 hover:text-white" onClick={addGradient} aria-label="Add gradient"><Plus size={12} /></Button>}
    >
      <div className="space-y-2 py-1">
        {items.length === 0 && <p className="text-[11px] text-neutral-700 py-2">No gradients yet. Click + to add.</p>}
        {items.map((g, gi) => (
          <div key={g.id} className="group/grad border-b border-white/[0.04] last:border-0 overflow-hidden">
            {/* Always visible: preview + name */}
            <div className="flex items-center gap-2 p-2">
              <div className="w-10 h-6 rounded shrink-0 border border-white/5" style={{ background: buildGradientCss(g) }} />
              <Input value={g.name} onChange={e => updateItem(gi, { name: e.target.value })} className="h-6 flex-1 bg-transparent border-none p-0 text-xs text-neutral-300 focus-visible:ring-0 placeholder:text-neutral-700" placeholder="Gradient name" />
              <span className="text-[10px] font-mono text-neutral-700">{g.type} {g.type === 'linear' ? `${g.angle}°` : ''}</span>
              <Button variant="ghost" size="icon" className="h-5 w-5 text-neutral-800 hover:text-red-400 opacity-0 group-hover/grad:opacity-100 transition-all shrink-0" onClick={() => removeGradient(gi)} aria-label="Remove"><Trash2 size={10} /></Button>
            </div>
            {/* Hover-reveal: detail controls */}
            <div className="hover-reveal group-hover/grad:max-h-[400px] group-focus-within/grad:max-h-[400px]">
              <div className="pt-1 pb-2 space-y-2 border-t border-white/[0.04]">
                <div className="flex gap-2 pt-2">
                  {(['linear', 'radial'] as const).map(t => (
                    <button key={t} type="button" onClick={() => updateItem(gi, { type: t })}
                      className={cn('flex-1 h-6 rounded border text-[9px] font-mono uppercase transition-all', g.type === t ? 'border-white/20 bg-white/[0.06] text-neutral-200' : 'border-white/5 text-neutral-600 hover:border-white/10')}
                    >{t}</button>
                  ))}
                  {g.type === 'linear' && (
                    <Input type="number" value={g.angle} onChange={e => updateItem(gi, { angle: Number(e.target.value) })} className="h-6 w-14 border-white/5 text-[10px] font-mono text-center" min={0} max={360} />
                  )}
                </div>
                <div className="flex flex-wrap gap-1">
                  {(Object.keys(USAGE_LABELS) as GradientUsage[]).map(u => (
                    <button key={u} type="button" onClick={() => updateItem(gi, { usage: u })}
                      className={cn('px-2 h-5 rounded border text-[9px] font-mono transition-all', g.usage === u ? 'border-white/20 bg-white/[0.06] text-neutral-200' : 'border-white/5 text-neutral-600 hover:border-white/10')}
                    >{USAGE_LABELS[u]}</button>
                  ))}
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <MicroTitle className="text-neutral-700">Stops</MicroTitle>
                    <button type="button" onClick={() => addStop(gi)} className="text-[9px] font-mono text-neutral-700 hover:text-neutral-400 transition-colors">+ stop</button>
                  </div>
                  {g.stops.map((s, si) => (
                    <div key={si} className="flex items-center gap-1.5">
                      <div className="relative w-6 h-6 shrink-0">
                        <div className="w-full h-full rounded border border-white/10" style={{ backgroundColor: s.color }} />
                        <input type="color" value={s.color} onChange={e => updateStop(gi, si, 'color', e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer" />
                      </div>
                      <span className="text-[10px] font-mono text-neutral-600 w-14">{s.color}</span>
                      <input type="range" min={0} max={100} value={s.position} onChange={e => updateStop(gi, si, 'position', Number(e.target.value))} className="flex-1 h-1 accent-white" />
                      <span className="text-[10px] font-mono text-neutral-600 w-7 text-right">{s.position}%</span>
                      {g.stops.length > 2 && <button type="button" onClick={() => removeStop(gi, si)} className="text-neutral-700 hover:text-red-400 transition-colors"><Trash2 size={10} /></button>}
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
