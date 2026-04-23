import React, { useState, useEffect } from 'react';
import { SectionBlock } from '../SectionBlock';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { MicroTitle } from '@/components/ui/MicroTitle';
import { Layers2, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { BrandGuideline, BrandGuidelineShadow } from '@/lib/figma-types';

interface ShadowSectionProps {
  guideline: BrandGuideline;
  onUpdate: (data: Partial<BrandGuideline>) => void;
  span?: string;
}

type ShadowType = 'outer' | 'inner' | 'glow';
const TYPE_LABELS: Record<ShadowType, string> = { outer: 'Outer', inner: 'Inner', glow: 'Glow' };

function buildCss(s: BrandGuidelineShadow): string {
  const rgba = hexToRgba(s.color, s.opacity);
  const inset = s.type === 'inner' ? 'inset ' : '';
  return `${inset}${s.x}px ${s.y}px ${s.blur}px ${s.spread}px ${rgba}`;
}

function hexToRgba(hex: string, opacity: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

function makeId() {
  return Math.random().toString(36).slice(2, 9);
}

const DEFAULT_SHADOWS: Omit<BrandGuidelineShadow, 'id'>[] = [
  { name: 'Micro', x: 0, y: 2, blur: 4, spread: 0, color: '#000000', opacity: 0.15, type: 'outer' },
  { name: 'Soft', x: 6, y: 6, blur: 17, spread: 0, color: '#6d6d6d', opacity: 0.15, type: 'outer' },
  { name: 'Glow', x: 0, y: 0, blur: 24, spread: 0, color: '#52DDEB', opacity: 0.35, type: 'glow' },
];

export const ShadowSection: React.FC<ShadowSectionProps> = ({ guideline, onUpdate, span }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [items, setItems] = useState<BrandGuidelineShadow[]>([]);

  useEffect(() => {
    setItems(guideline.shadows || []);
  }, [guideline.id]);

  const handleSave = () => {
    onUpdate({ shadows: items.map(s => ({ ...s, css: buildCss(s) })) });
    setIsEditing(false);
  };

  const addShadow = () => {
    setItems(prev => [...prev, { id: makeId(), name: 'Shadow', x: 0, y: 4, blur: 12, spread: 0, color: '#000000', opacity: 0.2, type: 'outer' }]);
    if (!isEditing) setIsEditing(true);
  };

  const update = (idx: number, patch: Partial<BrandGuidelineShadow>) => {
    setItems(prev => prev.map((s, i) => i === idx ? { ...s, ...patch } : s));
  };

  const seedDefaults = () => {
    setItems(DEFAULT_SHADOWS.map(d => ({ ...d, id: makeId() })));
    setIsEditing(true);
  };

  const preview = guideline.shadows || [];

  return (
    <SectionBlock
      id="shadows"
      icon={<Layers2 size={14} className="text-brand-cyan" />}
      title="Shadows"
      isEditing={isEditing}
      onEdit={() => setIsEditing(true)}
      onSave={handleSave}
      onCancel={() => { setItems(guideline.shadows || []); setIsEditing(false); }}
      span={span as any}
      actions={(
        <Button variant="ghost" size="icon" aria-label="Add shadow" className="h-6 w-6 text-neutral-500 hover:text-white" onClick={addShadow}>
          <Plus size={12} />
        </Button>
      )}
    >
      <div className="space-y-4 py-2">
        {isEditing ? (
          <div className="space-y-4">
            {items.map((s, si) => (
              <div key={s.id} className="rounded-2xl border border-white/[0.04] bg-white/[0.01] p-4 space-y-4 group/shadow relative">
                {/* Live preview */}
                <div className="flex items-center gap-4">
                  <div
                    className="w-12 h-12 rounded-xl bg-neutral-800 border border-white/5 shrink-0"
                    style={{ boxShadow: buildCss(s) }}
                  />
                  <div className="flex-1 space-y-1">
                    <Input
                      value={s.name}
                      onChange={e => update(si, { name: e.target.value })}
                      className="bg-neutral-950/80 border-white/5 text-[11px] font-mono text-white h-8 rounded-xl focus:border-brand-cyan/30"
                      placeholder="Shadow name"
                    />
                    <p className="text-[9px] font-mono text-neutral-600 pl-1">{buildCss(s)}</p>
                  </div>
                </div>

                <div className="flex gap-1">
                  {(Object.keys(TYPE_LABELS) as ShadowType[]).map(t => (
                    <button key={t} type="button" onClick={() => update(si, { type: t })}
                      className={cn(
                        'flex-1 h-7 rounded-lg border text-[9px] font-mono uppercase tracking-wider transition-all',
                        s.type === t ? 'border-brand-cyan/40 bg-brand-cyan/10 text-brand-cyan' : 'border-white/5 bg-white/[0.02] text-neutral-600'
                      )}
                    >{TYPE_LABELS[t]}</button>
                  ))}
                </div>

                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: 'X', field: 'x' as const },
                    { label: 'Y', field: 'y' as const },
                    { label: 'Blur', field: 'blur' as const },
                    { label: 'Spread', field: 'spread' as const },
                  ].map(({ label, field }) => (
                    <div key={field} className="space-y-1">
                      <MicroTitle className="text-[9px] opacity-30 uppercase pl-0.5 tracking-widest">{label}</MicroTitle>
                      <Input
                        type="number"
                        value={s[field]}
                        onChange={e => update(si, { [field]: Number(e.target.value) })}
                        className="bg-neutral-950/80 border-white/5 text-[10px] font-mono text-white h-8 rounded-xl focus:border-brand-cyan/30 text-center"
                      />
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={s.color}
                    onChange={e => update(si, { color: e.target.value })}
                    className="w-8 h-8 rounded-lg border border-white/10 bg-transparent cursor-pointer"
                  />
                  <span className="text-[10px] font-mono text-neutral-500 w-16">{s.color}</span>
                  <div className="flex-1 space-y-1">
                    <MicroTitle className="text-[9px] opacity-30 uppercase tracking-widest">Opacity</MicroTitle>
                    <input
                      type="range" min={0} max={1} step={0.01}
                      value={s.opacity}
                      onChange={e => update(si, { opacity: Number(e.target.value) })}
                      className="w-full accent-brand-cyan h-1"
                    />
                  </div>
                  <span className="text-[10px] font-mono text-neutral-600 w-8">{Math.round(s.opacity * 100)}%</span>
                </div>

                <Button
                  variant="ghost" size="icon" type="button"
                  className="absolute top-2 right-2 h-6 w-6 text-neutral-700 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover/shadow:opacity-100 transition-all"
                  onClick={() => setItems(prev => prev.filter((_, i) => i !== si))}
                >
                  <Trash2 size={11} />
                </Button>
              </div>
            ))}

            <div className="flex gap-2">
              <Button
                variant="outline" type="button" onClick={addShadow}
                className="flex-1 h-10 border-dashed border-white/10 hover:border-brand-cyan/30 bg-transparent text-neutral-500 hover:text-brand-cyan group transition-all rounded-2xl"
              >
                <Plus size={14} className="mr-2" />
                <span className="text-[10px] font-mono uppercase tracking-widest">Add Shadow</span>
              </Button>
              {items.length === 0 && (
                <Button
                  variant="outline" type="button" onClick={seedDefaults}
                  className="h-10 px-4 border-dashed border-brand-cyan/20 hover:border-brand-cyan/40 bg-transparent text-brand-cyan/50 hover:text-brand-cyan group transition-all rounded-2xl"
                >
                  <span className="text-[10px] font-mono uppercase tracking-widest">Seed Defaults</span>
                </Button>
              )}
            </div>
          </div>
        ) : (
          preview.length > 0 ? (
            <div className="space-y-2">
              {preview.map(s => (
                <button type="button" key={s.id} aria-label="Editar shadow" className="flex items-center gap-4 p-3 rounded-xl bg-white/[0.01] border border-white/[0.03] hover:border-brand-cyan/20 transition-all cursor-pointer group/row text-left w-full" onClick={() => setIsEditing(true)}>
                  <div
                    className="w-10 h-10 rounded-lg bg-neutral-800 border border-white/5 shrink-0"
                    style={{ boxShadow: s.css || buildCss(s) }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-neutral-300 font-medium">{s.name}</p>
                    <p className="text-[9px] font-mono text-neutral-600 truncate">{s.css || buildCss(s)}</p>
                  </div>
                  <span className="text-[9px] font-mono text-neutral-700 uppercase">{s.type}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="py-10 text-center text-[10px] font-mono tracking-widest uppercase border border-dashed border-white/5 opacity-30 rounded-2xl">No Shadows Defined</div>
          )
        )}
      </div>
    </SectionBlock>
  );
};
