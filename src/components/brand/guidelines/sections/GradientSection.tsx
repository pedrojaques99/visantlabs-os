import React, { useState, useEffect } from 'react';
import { SectionBlock } from '../SectionBlock';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { MicroTitle } from '@/components/ui/MicroTitle';
import { Blend, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { BrandGuideline, BrandGuidelineGradient } from '@/lib/figma-types';

interface GradientSectionProps {
  guideline: BrandGuideline;
  onUpdate: (data: Partial<BrandGuideline>) => void;
  span?: string;
}

type GradientUsage = 'hero' | 'decorative' | 'fill' | 'overlay';
const USAGE_LABELS: Record<GradientUsage, string> = {
  hero: 'Hero',
  decorative: 'Decorative',
  fill: 'Fill',
  overlay: 'Overlay',
};

function buildCss(g: BrandGuidelineGradient): string {
  const stops = g.stops.map(s => `${s.color} ${s.position}%`).join(', ');
  if (g.type === 'radial') return `radial-gradient(circle, ${stops})`;
  return `linear-gradient(${g.angle}deg, ${stops})`;
}

function makeId() {
  return Math.random().toString(36).slice(2, 9);
}

export const GradientSection: React.FC<GradientSectionProps> = ({ guideline, onUpdate, span }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [items, setItems] = useState<BrandGuidelineGradient[]>([]);

  useEffect(() => {
    setItems(guideline.gradients || []);
  }, [guideline.id]);

  const handleSave = () => {
    const updated = items.map(g => ({ ...g, css: buildCss(g) }));
    onUpdate({ gradients: updated });
    setIsEditing(false);
  };

  const addGradient = () => {
    const primaryHex = guideline.colors?.[0]?.hex || '#52DDEB';
    const secondaryHex = guideline.colors?.[1]?.hex || '#1F7878';
    setItems(prev => [...prev, {
      id: makeId(),
      name: 'New Gradient',
      type: 'linear',
      angle: 135,
      stops: [{ color: primaryHex, position: 0 }, { color: secondaryHex, position: 100 }],
      usage: 'decorative',
    }]);
    if (!isEditing) setIsEditing(true);
  };

  const updateItem = (idx: number, patch: Partial<BrandGuidelineGradient>) => {
    setItems(prev => prev.map((g, i) => i === idx ? { ...g, ...patch } : g));
  };

  const updateStop = (gradIdx: number, stopIdx: number, field: 'color' | 'position', value: string | number) => {
    setItems(prev => prev.map((g, i) => {
      if (i !== gradIdx) return g;
      const stops = g.stops.map((s, j) => j === stopIdx ? { ...s, [field]: value } : s);
      return { ...g, stops };
    }));
  };

  const addStop = (gradIdx: number) => {
    setItems(prev => prev.map((g, i) => i === gradIdx
      ? { ...g, stops: [...g.stops, { color: '#ffffff', position: 50 }] }
      : g
    ));
  };

  const removeStop = (gradIdx: number, stopIdx: number) => {
    setItems(prev => prev.map((g, i) => i === gradIdx
      ? { ...g, stops: g.stops.filter((_, j) => j !== stopIdx) }
      : g
    ));
  };

  const previewItems = guideline.gradients || [];

  return (
    <SectionBlock
      id="gradients"
      icon={<Blend size={14} className="text-brand-cyan" />}
      title="Gradients"
      isEditing={isEditing}
      onEdit={() => setIsEditing(true)}
      onSave={handleSave}
      onCancel={() => { setItems(guideline.gradients || []); setIsEditing(false); }}
      span={span as any}
      actions={(
        <Button variant="ghost" size="icon" aria-label="Add gradient" className="h-6 w-6 text-neutral-500 hover:text-white" onClick={addGradient}>
          <Plus size={12} />
        </Button>
      )}
    >
      <div className="space-y-4 py-2">
        {isEditing ? (
          <div className="space-y-6">
            {items.map((g, gi) => (
              <div key={g.id} className="rounded-2xl border border-white/[0.04] bg-white/[0.01] p-4 space-y-4 group/grad relative">
                {/* Preview bar */}
                <div
                  className="h-14 w-full rounded-xl border border-white/5"
                  style={{ background: buildCss(g) }}
                />

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <MicroTitle className="text-[10px] opacity-40 uppercase pl-1 tracking-widest">Name</MicroTitle>
                    <Input
                      value={g.name}
                      onChange={e => updateItem(gi, { name: e.target.value })}
                      className="bg-neutral-950/80 border-white/5 text-[11px] font-mono text-white h-9 rounded-xl focus:border-brand-cyan/30"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <MicroTitle className="text-[10px] opacity-40 uppercase pl-1 tracking-widest">Usage</MicroTitle>
                    <div className="flex gap-1 flex-wrap">
                      {(Object.keys(USAGE_LABELS) as GradientUsage[]).map(u => (
                        <button
                          key={u}
                          type="button"
                          onClick={() => updateItem(gi, { usage: u })}
                          className={cn(
                            'px-2 py-1 rounded-md border text-[9px] font-mono uppercase tracking-wider transition-all',
                            g.usage === u
                              ? 'border-brand-cyan/40 bg-brand-cyan/10 text-brand-cyan'
                              : 'border-white/5 bg-white/[0.02] text-neutral-600 hover:border-white/10'
                          )}
                        >
                          {USAGE_LABELS[u]}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="space-y-1.5 flex-1">
                    <MicroTitle className="text-[10px] opacity-40 uppercase pl-1 tracking-widest">Type</MicroTitle>
                    <div className="flex gap-1">
                      {(['linear', 'radial'] as const).map(t => (
                        <button key={t} type="button" onClick={() => updateItem(gi, { type: t })}
                          className={cn(
                            'flex-1 h-8 rounded-lg border text-[10px] font-mono uppercase tracking-wider transition-all',
                            g.type === t ? 'border-brand-cyan/40 bg-brand-cyan/10 text-brand-cyan' : 'border-white/5 bg-white/[0.02] text-neutral-500'
                          )}
                        >{t}</button>
                      ))}
                    </div>
                  </div>
                  {g.type === 'linear' && (
                    <div className="space-y-1.5 w-24">
                      <MicroTitle className="text-[10px] opacity-40 uppercase pl-1 tracking-widest">Angle</MicroTitle>
                      <Input
                        type="number"
                        value={g.angle}
                        onChange={e => updateItem(gi, { angle: Number(e.target.value) })}
                        className="bg-neutral-950/80 border-white/5 text-[11px] font-mono text-white h-9 rounded-xl focus:border-brand-cyan/30"
                        min={0} max={360}
                      />
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between px-1">
                    <MicroTitle className="text-[10px] opacity-40 uppercase tracking-widest">Stops</MicroTitle>
                    <button type="button" onClick={() => addStop(gi)} className="text-[9px] font-mono text-neutral-600 hover:text-brand-cyan transition-colors">+ add stop</button>
                  </div>
                  {g.stops.map((s, si) => (
                    <div key={si} className="flex items-center gap-2">
                      <input
                        type="color"
                        value={s.color}
                        onChange={e => updateStop(gi, si, 'color', e.target.value)}
                        className="w-8 h-8 rounded-lg border border-white/10 bg-transparent cursor-pointer"
                      />
                      <span className="text-[10px] font-mono text-neutral-500 w-16">{s.color}</span>
                      <input
                        type="range"
                        min={0} max={100}
                        value={s.position}
                        onChange={e => updateStop(gi, si, 'position', Number(e.target.value))}
                        className="flex-1 accent-brand-cyan h-1"
                      />
                      <span className="text-[10px] font-mono text-neutral-600 w-8 text-right">{s.position}%</span>
                      {g.stops.length > 2 && (
                        <button type="button" onClick={() => removeStop(gi, si)} className="text-neutral-700 hover:text-red-400 transition-colors">
                          <Trash2 size={11} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <Button
                  variant="ghost" size="icon" type="button"
                  className="absolute top-2 right-2 h-6 w-6 text-neutral-700 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover/grad:opacity-100 transition-all"
                  onClick={() => setItems(prev => prev.filter((_, i) => i !== gi))}
                >
                  <Trash2 size={11} />
                </Button>
              </div>
            ))}

            <Button
              variant="outline" type="button" onClick={addGradient}
              className="w-full h-10 border-dashed border-white/10 hover:border-brand-cyan/30 bg-transparent text-neutral-500 hover:text-brand-cyan group transition-all rounded-2xl"
            >
              <Plus size={14} className="mr-2 group-hover:scale-125 transition-transform" />
              <span className="text-[10px] font-mono uppercase tracking-widest">Add Gradient</span>
            </Button>
          </div>
        ) : (
          previewItems.length > 0 ? (
            <div className="grid grid-cols-2 gap-3">
              {previewItems.map(g => (
                <button type="button" key={g.id} aria-label="Editar gradient" className="group/gp rounded-xl overflow-hidden border border-white/[0.04] cursor-pointer hover:border-brand-cyan/20 transition-all text-left" onClick={() => setIsEditing(true)}>
                  <div className="h-16" style={{ background: g.css || buildCss(g) }} />
                  <div className="p-2 bg-white/[0.02]">
                    <p className="text-[10px] font-mono text-neutral-400 truncate">{g.name}</p>
                    <p className="text-[9px] font-mono text-neutral-700 uppercase tracking-wider">{g.usage}</p>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="py-10 text-center text-[10px] font-mono tracking-widest uppercase border border-dashed border-white/5 opacity-30 rounded-2xl">No Gradients Defined</div>
          )
        )}
      </div>
    </SectionBlock>
  );
};
