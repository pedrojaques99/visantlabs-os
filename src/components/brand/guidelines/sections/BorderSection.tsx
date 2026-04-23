import React, { useState, useEffect } from 'react';
import { SectionBlock } from '../SectionBlock';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { MicroTitle } from '@/components/ui/MicroTitle';
import { Frame, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { BrandGuideline, BrandGuidelineBorder } from '@/lib/figma-types';

interface BorderSectionProps {
  guideline: BrandGuideline;
  onUpdate: (data: Partial<BrandGuideline>) => void;
  span?: string;
}

type BorderStyle = 'solid' | 'dashed' | 'dotted';
type BorderRole = 'default' | 'emphasis' | 'scaffold' | 'divider';

const STYLE_OPTIONS: BorderStyle[] = ['solid', 'dashed', 'dotted'];
const ROLE_OPTIONS: { value: BorderRole; label: string }[] = [
  { value: 'default', label: 'Default' },
  { value: 'emphasis', label: 'Emphasis' },
  { value: 'scaffold', label: 'Scaffold' },
  { value: 'divider', label: 'Divider' },
];

function buildCss(b: BrandGuidelineBorder): string {
  const hex = b.color.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const bv = parseInt(hex.substring(4, 6), 16);
  return `${b.width}px ${b.style} rgba(${r}, ${g}, ${bv}, ${b.opacity})`;
}

function makeId() {
  return Math.random().toString(36).slice(2, 9);
}

const DEFAULT_BORDERS: Omit<BrandGuidelineBorder, 'id'>[] = [
  { name: 'Default Dark', width: 1, style: 'solid', color: '#ffffff', opacity: 0.1, role: 'default' },
  { name: 'Emphasis', width: 1.5, style: 'solid', color: '#52DDEB', opacity: 0.4, role: 'emphasis' },
  { name: 'Divider', width: 1, style: 'solid', color: '#ffffff', opacity: 0.03, role: 'divider' },
];

export const BorderSection: React.FC<BorderSectionProps> = ({ guideline, onUpdate, span }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [items, setItems] = useState<BrandGuidelineBorder[]>([]);

  useEffect(() => {
    setItems(guideline.borders || []);
  }, [guideline.id]);

  const handleSave = () => {
    onUpdate({ borders: items.map(b => ({ ...b, css: buildCss(b) })) });
    setIsEditing(false);
  };

  const addBorder = () => {
    setItems(prev => [...prev, { id: makeId(), name: 'Border', width: 1, style: 'solid', color: '#ffffff', opacity: 0.1, role: 'default' }]);
    if (!isEditing) setIsEditing(true);
  };

  const update = (idx: number, patch: Partial<BrandGuidelineBorder>) => {
    setItems(prev => prev.map((b, i) => i === idx ? { ...b, ...patch } : b));
  };

  const seedDefaults = () => { setItems(DEFAULT_BORDERS.map(d => ({ ...d, id: makeId() }))); setIsEditing(true); };

  const preview = guideline.borders || [];

  return (
    <SectionBlock
      id="borders"
      icon={<Frame size={14} className="text-brand-cyan" />}
      title="Borders"
      isEditing={isEditing}
      onEdit={() => setIsEditing(true)}
      onSave={handleSave}
      onCancel={() => { setItems(guideline.borders || []); setIsEditing(false); }}
      span={span as any}
      actions={(
        <Button variant="ghost" size="icon" aria-label="Add border" className="h-6 w-6 text-neutral-500 hover:text-white" onClick={addBorder}>
          <Plus size={12} />
        </Button>
      )}
    >
      <div className="space-y-4 py-2">
        {isEditing ? (
          <div className="space-y-4">
            {items.map((b, bi) => (
              <div key={b.id} className="rounded-2xl border border-white/[0.04] bg-white/[0.01] p-4 space-y-4 group/border relative">
                {/* Preview */}
                <div className="h-8 w-full rounded-lg bg-neutral-900" style={{ border: buildCss(b) }} />

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <MicroTitle className="text-[10px] opacity-40 uppercase pl-1 tracking-widest">Name</MicroTitle>
                    <Input
                      value={b.name}
                      onChange={e => update(bi, { name: e.target.value })}
                      className="bg-neutral-950/80 border-white/5 text-[11px] font-mono text-white h-8 rounded-xl focus:border-brand-cyan/30"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <MicroTitle className="text-[10px] opacity-40 uppercase pl-1 tracking-widest">Role</MicroTitle>
                    <div className="flex gap-1 flex-wrap">
                      {ROLE_OPTIONS.map(r => (
                        <button key={r.value} type="button" onClick={() => update(bi, { role: r.value })}
                          className={cn(
                            'px-2 py-1 rounded-md border text-[9px] font-mono uppercase tracking-wide transition-all',
                            b.role === r.value ? 'border-brand-cyan/40 bg-brand-cyan/10 text-brand-cyan' : 'border-white/5 bg-white/[0.02] text-neutral-600'
                          )}
                        >{r.label}</button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <MicroTitle className="text-[10px] opacity-40 uppercase pl-1 tracking-widest">Style</MicroTitle>
                    <div className="flex gap-1">
                      {STYLE_OPTIONS.map(s => (
                        <button key={s} type="button" onClick={() => update(bi, { style: s })}
                          className={cn(
                            'flex-1 h-7 rounded-lg border text-[9px] font-mono uppercase tracking-wide transition-all',
                            b.style === s ? 'border-brand-cyan/40 bg-brand-cyan/10 text-brand-cyan' : 'border-white/5 bg-white/[0.02] text-neutral-600'
                          )}
                        >{s}</button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <MicroTitle className="text-[10px] opacity-40 uppercase pl-1 tracking-widest">Width (px)</MicroTitle>
                    <Input
                      type="number" step="0.5" min="0.5"
                      value={b.width}
                      onChange={e => update(bi, { width: Number(e.target.value) })}
                      className="bg-neutral-950/80 border-white/5 text-[10px] font-mono text-white h-8 rounded-xl focus:border-brand-cyan/30 text-center"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <MicroTitle className="text-[10px] opacity-40 uppercase pl-1 tracking-widest">Opacity</MicroTitle>
                    <Input
                      type="number" step="0.01" min="0" max="1"
                      value={b.opacity}
                      onChange={e => update(bi, { opacity: Number(e.target.value) })}
                      className="bg-neutral-950/80 border-white/5 text-[10px] font-mono text-white h-8 rounded-xl focus:border-brand-cyan/30 text-center"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={b.color}
                    onChange={e => update(bi, { color: e.target.value })}
                    className="w-8 h-8 rounded-lg border border-white/10 bg-transparent cursor-pointer"
                  />
                  <span className="text-[10px] font-mono text-neutral-500">{b.color}</span>
                  <span className="text-[9px] font-mono text-neutral-700 ml-auto">{buildCss(b)}</span>
                </div>

                <Button
                  variant="ghost" size="icon" type="button"
                  className="absolute top-2 right-2 h-6 w-6 text-neutral-700 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover/border:opacity-100 transition-all"
                  onClick={() => setItems(prev => prev.filter((_, i) => i !== bi))}
                >
                  <Trash2 size={11} />
                </Button>
              </div>
            ))}

            <div className="flex gap-2">
              <Button variant="outline" type="button" onClick={addBorder}
                className="flex-1 h-10 border-dashed border-white/10 hover:border-brand-cyan/30 bg-transparent text-neutral-500 hover:text-brand-cyan group transition-all rounded-2xl"
              >
                <Plus size={14} className="mr-2" />
                <span className="text-[10px] font-mono uppercase tracking-widest">Add Border</span>
              </Button>
              {items.length === 0 && (
                <Button variant="outline" type="button" onClick={seedDefaults}
                  className="h-10 px-4 border-dashed border-brand-cyan/20 hover:border-brand-cyan/40 bg-transparent text-brand-cyan/50 hover:text-brand-cyan transition-all rounded-2xl"
                >
                  <span className="text-[10px] font-mono uppercase tracking-widest">Seed Defaults</span>
                </Button>
              )}
            </div>
          </div>
        ) : (
          preview.length > 0 ? (
            <div className="space-y-2">
              {preview.map(b => (
                <button type="button" key={b.id} aria-label="Editar border" className="flex items-center gap-4 p-3 rounded-xl bg-white/[0.01] border border-white/[0.03] hover:border-brand-cyan/20 transition-all cursor-pointer text-left w-full" onClick={() => setIsEditing(true)}>
                  <div className="w-10 h-8 rounded-lg bg-neutral-900 shrink-0" style={{ border: b.css || buildCss(b) }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-neutral-300 font-medium">{b.name}</p>
                    <p className="text-[9px] font-mono text-neutral-600 truncate">{b.css || buildCss(b)}</p>
                  </div>
                  <span className="text-[9px] font-mono text-neutral-700 uppercase">{b.role}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="py-10 text-center space-y-3">
              <p className="text-[10px] font-mono tracking-widest uppercase border border-dashed border-white/5 opacity-30 rounded-2xl py-8">No Borders Defined</p>
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
