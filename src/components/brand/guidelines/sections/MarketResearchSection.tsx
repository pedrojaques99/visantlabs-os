import React, { useCallback } from 'react';
import { SectionBlock } from '../SectionBlock';
import { MicroTitle } from '@/components/ui/MicroTitle';
import { Textarea } from '@/components/ui/textarea';
import { Search } from 'lucide-react';
import type { BrandGuideline, BrandMarketResearch } from '@/lib/figma-types';

interface MarketResearchSectionProps {
  guideline: BrandGuideline;
  onUpdate: (data: Partial<BrandGuideline>) => void;
  span?: string;
}

const toLines = (arr?: string[]) => (arr || []).join('\n');
const fromLines = (text: string) => text.split('\n').map(s => s.trim()).filter(Boolean);

export const MarketResearchSection: React.FC<MarketResearchSectionProps> = ({ guideline, onUpdate, span }) => {
  const mr = guideline.strategy?.marketResearch || {};

  const persist = useCallback((next: BrandMarketResearch) => {
    onUpdate({ strategy: { ...guideline.strategy, marketResearch: next } });
  }, [onUpdate, guideline.strategy]);

  const update = (patch: Partial<BrandMarketResearch>) => {
    persist({ ...mr, ...patch });
  };

  return (
    <SectionBlock id="market_research" icon={<Search size={14} />} title="Pesquisa de Mercado" span={span as any}>
      <div className="space-y-4 py-1">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="space-y-1">
            <MicroTitle className="text-neutral-600">Concorrentes</MicroTitle>
            <Textarea
              value={toLines(mr.competitors)}
              onChange={(e) => update({ competitors: fromLines(e.target.value) })}
              className="border-white/[0.06] bg-transparent text-xs text-neutral-400 min-h-[80px] resize-none placeholder:text-neutral-700"
              placeholder={"Playtomic\nStrava\nFrontify"}
            />
          </div>
          <div className="space-y-1">
            <MicroTitle className="text-neutral-600">Gaps (o que entregam mal)</MicroTitle>
            <Textarea
              value={toLines(mr.gaps)}
              onChange={(e) => update({ gaps: fromLines(e.target.value) })}
              className="border-white/[0.06] bg-transparent text-xs text-neutral-400 min-h-[80px] resize-none placeholder:text-neutral-700"
              placeholder={"Sem DNA cultural\nUI fria e genérica"}
            />
          </div>
          <div className="space-y-1">
            <MicroTitle className="text-neutral-600">Oportunidades (território livre)</MicroTitle>
            <Textarea
              value={toLines(mr.opportunities)}
              onChange={(e) => update({ opportunities: fromLines(e.target.value) })}
              className="border-white/[0.06] bg-transparent text-xs text-neutral-400 min-h-[80px] resize-none placeholder:text-neutral-700"
              placeholder={"Cultura local\nComunidade ativa"}
            />
          </div>
        </div>

        <div className="space-y-1">
          <MicroTitle className="text-neutral-600">Notas adicionais</MicroTitle>
          <Textarea
            value={mr.notes || ''}
            onChange={(e) => update({ notes: e.target.value })}
            className="border-white/[0.06] bg-transparent text-xs text-neutral-400 min-h-[50px] resize-none placeholder:text-neutral-700"
            placeholder="Observações sobre o mercado..."
          />
        </div>
      </div>
    </SectionBlock>
  );
};
