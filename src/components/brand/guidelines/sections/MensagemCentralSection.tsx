import React, { useCallback } from 'react';
import { SectionBlock } from '../SectionBlock';
import { Input } from '@/components/ui/input';
import { MicroTitle } from '@/components/ui/MicroTitle';
import { MessageSquare } from 'lucide-react';
import type { BrandGuideline, BrandCoreMessage } from '@/lib/figma-types';

interface MensagemCentralSectionProps {
  guideline: BrandGuideline;
  onUpdate: (data: Partial<BrandGuideline>) => void;
  span?: string;
}

const readCoreMessage = (g: BrandGuideline): BrandCoreMessage => {
  const cm = g.strategy?.coreMessage;
  if (cm?.product || cm?.differential || cm?.emotionalBond) return cm;
  const p = g.strategy?.positioning;
  return { product: p?.[0] ?? '', differential: p?.[1] ?? '', emotionalBond: p?.[2] ?? '' };
};

export const MensagemCentralSection: React.FC<MensagemCentralSectionProps> = ({ guideline, onUpdate, span }) => {
  const cm = readCoreMessage(guideline);

  const persist = useCallback((next: BrandCoreMessage) => {
    onUpdate({
      strategy: {
        ...guideline.strategy,
        coreMessage: next,
        positioning: [next.product, next.differential, next.emotionalBond],
      },
    });
  }, [onUpdate, guideline.strategy]);

  const update = (patch: Partial<BrandCoreMessage>) => {
    persist({ ...cm, ...patch });
  };

  const hasMessage = cm.product || cm.differential || cm.emotionalBond;

  return (
    <SectionBlock id="mensagem_central" icon={<MessageSquare size={14} />} title="Mensagem Central" span={span as any}>
      <div className="space-y-4 py-1">
        <div className="space-y-2">
          <div className="space-y-1">
            <MicroTitle className="text-neutral-600">1. Produto</MicroTitle>
            <Input value={cm.product} onChange={(e) => update({ product: e.target.value })}
              className="h-7 border-white/[0.06] text-xs text-neutral-300 bg-transparent placeholder:text-neutral-700"
              placeholder="ex: ITSM para times enxutos de TI" />
          </div>
          <div className="space-y-1">
            <MicroTitle className="text-neutral-600">2. Diferencial</MicroTitle>
            <Input value={cm.differential} onChange={(e) => update({ differential: e.target.value })}
              className="h-7 border-white/[0.06] text-xs text-neutral-300 bg-transparent placeholder:text-neutral-700"
              placeholder="ex: conectar as ferramentas num fluxo único" />
          </div>
          <div className="space-y-1">
            <MicroTitle className="text-neutral-600">3. Elo Emocional</MicroTitle>
            <Input value={cm.emotionalBond} onChange={(e) => update({ emotionalBond: e.target.value })}
              className="h-7 border-white/[0.06] text-xs text-neutral-300 bg-transparent placeholder:text-neutral-700"
              placeholder="ex: alívio de ter o caos operacional sob controle" />
          </div>
        </div>

        {hasMessage && (
          <div className="pt-3 border-t border-white/[0.04]">
            <p className="text-[11px] text-neutral-600 font-mono mb-2">Preview</p>
            <p className="text-sm text-neutral-300 leading-relaxed">
              {cm.product && <span className="font-semibold text-neutral-100">{cm.product}</span>}
              {cm.product && cm.differential && <span className="text-neutral-500"> com o diferencial de </span>}
              {cm.differential && <span className="font-semibold text-neutral-100">{cm.differential}</span>}
              {cm.differential && cm.emotionalBond && <span className="text-neutral-500"> que transmite o sentimento de </span>}
              {cm.emotionalBond && <span className="font-semibold text-neutral-100">{cm.emotionalBond}.</span>}
            </p>
          </div>
        )}
      </div>
    </SectionBlock>
  );
};
