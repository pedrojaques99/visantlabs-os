import React, { useCallback } from 'react';
import { SectionBlock } from '../SectionBlock';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { GoogleFontPicker } from '@/components/ui/GoogleFontPicker';
import { Type, Plus, Trash2 } from 'lucide-react';
import type { BrandGuideline } from '@/lib/figma-types';

interface TypographySectionProps {
  guideline: BrandGuideline;
  onUpdate: (data: Partial<BrandGuideline>) => void;
  span?: string;
}

type FontEntry = {
  family: string; role: string; style: string; size: number;
  lineHeight?: number; letterSpacing?: string; weights?: number[];
};

const normalize = (raw: any[]): FontEntry[] =>
  raw.map((t) => ({
    family: t.family || t.fontFamily || '',
    role: t.role || t.name || 'Body',
    style: t.style || t.fontStyle || 'Regular',
    size: t.size || t.fontSize || 16,
    lineHeight: t.lineHeight,
    letterSpacing: t.letterSpacing,
    weights: t.weights,
  }));

export const TypographySection: React.FC<TypographySectionProps> = ({ guideline, onUpdate, span }) => {
  const local = normalize(guideline.typography || []);

  const persist = useCallback((fonts: FontEntry[]) => {
    onUpdate({ typography: fonts });
  }, [onUpdate]);

  const updateFont = (i: number, patch: Partial<FontEntry>) => {
    const next = local.map((f, idx) => idx === i ? { ...f, ...patch } : f);
    persist(next);
  };

  const addFont = () => {
    const next = [...local, { family: 'Inter', role: '', style: 'Regular', size: 16 }];
    persist(next);
  };

  const removeFont = (i: number) => {
    const next = local.filter((_, idx) => idx !== i);
    persist(next);
  };

  const brandFonts = [...new Set(local.map((f) => f.family).filter(Boolean))];

  return (
    <SectionBlock
      id="typography"
      icon={<Type size={14} />}
      title="Typography"
      span={span as any}
      actions={(
        <Button variant="ghost" size="icon" className="h-6 w-6 text-neutral-500 hover:text-white" onClick={addFont} aria-label="Add font">
          <Plus size={12} />
        </Button>
      )}
    >
      <div className="space-y-3 py-1">
        {local.length === 0 && (
          <p className="text-[11px] text-neutral-700 py-2">No fonts yet. Click + to add.</p>
        )}
        {local.map((f, i) => (
          <div key={i} className="flex gap-3 items-start py-2.5 border-b border-white/[0.04] last:border-0 group/font">
            {/* Preview */}
            <div className="w-8 h-8 shrink-0 flex items-center justify-center rounded bg-neutral-900/60">
              <span className="text-base font-bold text-neutral-400" style={{ fontFamily: f.family }}>Aa</span>
            </div>
            {/* Fields */}
            <div className="flex-1 min-w-0 space-y-1.5">
              <div className="flex gap-1.5">
                <GoogleFontPicker
                  value={f.family}
                  onChange={(val) => updateFont(i, { family: val })}
                  brandFonts={brandFonts}
                />
                <Input value={f.role} onChange={(e) => updateFont(i, { role: e.target.value })} className="h-7 border-white/5 text-xs w-28" placeholder="Role (e.g. Heading)" />
              </div>
              <div className="flex gap-1.5">
                <Input value={f.style} onChange={(e) => updateFont(i, { style: e.target.value })} className="h-7 border-white/5 text-xs w-24" placeholder="Style" />
                <Input value={f.size} type="number" onChange={(e) => updateFont(i, { size: Number(e.target.value) })} className="h-7 border-white/5 text-xs w-16" placeholder="px" />
                <Input value={f.lineHeight ?? ''} type="number" step="0.1" onChange={(e) => updateFont(i, { lineHeight: Number(e.target.value) || undefined })} className="h-7 border-white/5 text-xs w-16" placeholder="lh" />
                <Input value={f.letterSpacing ?? ''} onChange={(e) => updateFont(i, { letterSpacing: e.target.value || undefined })} className="h-7 border-white/5 text-xs w-20" placeholder="ls" />
              </div>
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-neutral-700 hover:text-red-400 opacity-0 group-hover/font:opacity-100 transition-all shrink-0" onClick={() => removeFont(i)} aria-label="Remove font">
              <Trash2 size={11} />
            </Button>
          </div>
        ))}
      </div>
    </SectionBlock>
  );
};
