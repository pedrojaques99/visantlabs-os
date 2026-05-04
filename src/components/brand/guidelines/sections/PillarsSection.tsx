import React, { useCallback } from 'react';
import { SectionBlock } from '../SectionBlock';
import { Input } from '@/components/ui/input';
import { MicroTitle } from '@/components/ui/MicroTitle';
import { Button } from '@/components/ui/button';
import { Shield, Plus, Trash2 } from 'lucide-react';
import type { BrandGuideline, BrandPillar } from '@/lib/figma-types';

interface PillarsSectionProps {
  guideline: BrandGuideline;
  onUpdate: (data: Partial<BrandGuideline>) => void;
  span?: string;
}

export const PillarsSection: React.FC<PillarsSectionProps> = ({ guideline, onUpdate, span }) => {
  const pillars = guideline.strategy?.pillars || [];

  const persist = useCallback((next: BrandPillar[]) => {
    onUpdate({ strategy: { ...guideline.strategy, pillars: next } });
  }, [onUpdate, guideline.strategy]);

  const set = (i: number, patch: Partial<BrandPillar>) =>
    persist(pillars.map((p, idx) => idx === i ? { ...p, ...patch } : p));
  const add = () => persist([...pillars, { value: '', description: '' }]);
  const remove = (i: number) => persist(pillars.filter((_, idx) => idx !== i));

  return (
    <SectionBlock id="pillars" icon={<Shield size={14} />} title="Pilares" span={span as any}
      actions={
        pillars.length < 5 ? (
          <Button variant="ghost" size="icon" className="h-5 w-5" onClick={add} aria-label="Add pillar">
            <Plus size={11} />
          </Button>
        ) : undefined
      }
    >
      <div className="space-y-3 py-1">
        {pillars.length === 0 && (
          <p className="text-[11px] text-neutral-700 py-2">Nenhum pilar definido. Click + para adicionar.</p>
        )}
        {pillars.map((p, i) => (
          <div key={i} className="group/pillar flex items-start gap-3 border-b border-white/[0.04] last:border-0 pb-3 last:pb-0">
            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-white/[0.04] text-neutral-500 text-[10px] font-bold shrink-0 mt-0.5">
              {i + 1}
            </div>
            <div className="flex-1 space-y-1.5">
              <Input
                value={p.value}
                onChange={(e) => set(i, { value: e.target.value })}
                className="h-7 bg-transparent border-white/[0.06] text-sm font-semibold text-neutral-200 placeholder:text-neutral-700"
                placeholder="Ex: Pertencimento"
              />
              <Input
                value={p.description}
                onChange={(e) => set(i, { description: e.target.value })}
                className="h-7 bg-transparent border-white/[0.06] text-xs text-neutral-400 placeholder:text-neutral-700"
                placeholder="Porque esse pilar importa..."
              />
            </div>
            <Button
              variant="ghost" size="icon"
              className="h-6 w-6 text-neutral-700 hover:text-red-400 opacity-0 group-hover/pillar:opacity-100 transition-all shrink-0"
              onClick={() => remove(i)} aria-label="Remove"
            >
              <Trash2 size={10} />
            </Button>
          </div>
        ))}
      </div>
    </SectionBlock>
  );
};
