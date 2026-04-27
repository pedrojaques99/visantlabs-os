import React, { useCallback } from 'react';
import { SectionBlock } from '../SectionBlock';
import { Input } from '@/components/ui/input';
import { MicroTitle } from '@/components/ui/MicroTitle';
import { MessageSquare } from 'lucide-react';
import type { BrandGuideline } from '@/lib/figma-types';

interface MensagemCentralSectionProps {
  guideline: BrandGuideline;
  onUpdate: (data: Partial<BrandGuideline>) => void;
  span?: string;
}

type Parts = { produto: string; diferencial: string; eloEmocional: string };

const fromPositioning = (p?: string[]): Parts => ({
  produto: p?.[0] ?? '',
  diferencial: p?.[1] ?? '',
  eloEmocional: p?.[2] ?? '',
});

const toPositioning = (parts: Parts): string[] =>
  [parts.produto, parts.diferencial, parts.eloEmocional];

export const MensagemCentralSection: React.FC<MensagemCentralSectionProps> = ({ guideline, onUpdate, span }) => {
  // No local state — draft is owned by GuidelineDetail via useBrandGuidelineDraft
  const parts = fromPositioning(guideline.strategy?.positioning);

  const persist = useCallback((p: Parts) => {
    onUpdate({ strategy: { ...guideline.strategy, positioning: toPositioning(p) } });
  }, [onUpdate, guideline.strategy]);

  const update = (patch: Partial<Parts>) => {
    persist({ ...parts, ...patch });
  };

  const hasMessage = parts.produto || parts.diferencial || parts.eloEmocional;

  return (
    <SectionBlock id="mensagem_central" icon={<MessageSquare size={14} />} title="Mensagem Central" span={span as any}>
      <div className="space-y-4 py-1">
        {/* Fields */}
        <div className="space-y-2">
          <div className="space-y-1">
            <MicroTitle className="text-neutral-600">1. Produto</MicroTitle>
            <Input value={parts.produto} onChange={(e) => update({ produto: e.target.value })}
              className="h-7 border-white/[0.06] text-xs text-neutral-300 bg-transparent placeholder:text-neutral-700"
              placeholder="ex: ITSM para times enxutos de TI" />
          </div>
          <div className="space-y-1">
            <MicroTitle className="text-neutral-600">2. Diferencial</MicroTitle>
            <Input value={parts.diferencial} onChange={(e) => update({ diferencial: e.target.value })}
              className="h-7 border-white/[0.06] text-xs text-neutral-300 bg-transparent placeholder:text-neutral-700"
              placeholder="ex: conectar as ferramentas num fluxo único" />
          </div>
          <div className="space-y-1">
            <MicroTitle className="text-neutral-600">3. Elo Emocional</MicroTitle>
            <Input value={parts.eloEmocional} onChange={(e) => update({ eloEmocional: e.target.value })}
              className="h-7 border-white/[0.06] text-xs text-neutral-300 bg-transparent placeholder:text-neutral-700"
              placeholder="ex: alívio de ter o caos operacional sob controle" />
          </div>
        </div>

        {/* Composed preview */}
        {hasMessage && (
          <div className="pt-3 border-t border-white/[0.04]">
            <p className="text-[11px] text-neutral-600 font-mono mb-2">Preview</p>
            <p className="text-sm text-neutral-300 leading-relaxed">
              {parts.produto && <span className="font-semibold text-neutral-100">{parts.produto}</span>}
              {parts.produto && parts.diferencial && <span className="text-neutral-500"> com o diferencial de </span>}
              {parts.diferencial && <span className="font-semibold text-neutral-100">{parts.diferencial}</span>}
              {parts.diferencial && parts.eloEmocional && <span className="text-neutral-500"> que transmite o sentimento de </span>}
              {parts.eloEmocional && <span className="font-semibold text-neutral-100">{parts.eloEmocional}.</span>}
            </p>
          </div>
        )}
      </div>
    </SectionBlock>
  );
};
