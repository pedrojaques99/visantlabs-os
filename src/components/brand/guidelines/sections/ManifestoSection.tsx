import React, { useCallback } from 'react';
import { SectionBlock } from '../SectionBlock';
import { Textarea } from '@/components/ui/textarea';
import { MicroTitle } from '@/components/ui/MicroTitle';
import { BookOpen } from 'lucide-react';
import type { BrandGuideline, BrandManifesto } from '@/lib/figma-types';

interface ManifestoSectionProps {
  guideline: BrandGuideline;
  onUpdate: (data: Partial<BrandGuideline>) => void;
  span?: string;
}

const readManifesto = (g: BrandGuideline): BrandManifesto => {
  const m = g.strategy?.manifesto;
  if (!m) return {};
  if (typeof m === 'string') return { full: m };
  return m;
};

const toStorable = (m: BrandManifesto): BrandManifesto | string => {
  if (m.provocation || m.tension || m.promise) return m;
  return m.full ?? '';
};

export const ManifestoSection: React.FC<ManifestoSectionProps> = ({ guideline, onUpdate, span }) => {
  const manifesto = readManifesto(guideline);

  const persist = useCallback((next: BrandManifesto) => {
    onUpdate({ strategy: { ...guideline.strategy, manifesto: toStorable(next) } });
  }, [onUpdate, guideline.strategy]);

  const update = (patch: Partial<BrandManifesto>) => {
    persist({ ...manifesto, ...patch });
  };

  const hasStructured = manifesto.provocation || manifesto.tension || manifesto.promise;

  return (
    <SectionBlock id="manifesto" icon={<BookOpen size={14} />} title="Manifesto" span={span as any}>
      <div className="space-y-4 py-1">
        <div className="space-y-3">
          <div className="space-y-1">
            <MicroTitle className="text-neutral-600">1. Provocação</MicroTitle>
            <Textarea
              value={manifesto.provocation || ''}
              onChange={(e) => update({ provocation: e.target.value })}
              className="border-white/[0.06] bg-transparent text-sm text-neutral-300 leading-relaxed min-h-[60px] resize-none placeholder:text-neutral-700"
              placeholder="Pergunta ou imagem que o leitor reconhece..."
            />
          </div>
          <div className="space-y-1">
            <MicroTitle className="text-neutral-600">2. Tensão</MicroTitle>
            <Textarea
              value={manifesto.tension || ''}
              onChange={(e) => update({ tension: e.target.value })}
              className="border-white/[0.06] bg-transparent text-sm text-neutral-300 leading-relaxed min-h-[60px] resize-none placeholder:text-neutral-700"
              placeholder="O problema, a frustração, o incômodo que a marca resolve..."
            />
          </div>
          <div className="space-y-1">
            <MicroTitle className="text-neutral-600">3. Promessa</MicroTitle>
            <Textarea
              value={manifesto.promise || ''}
              onChange={(e) => update({ promise: e.target.value })}
              className="border-white/[0.06] bg-transparent text-sm text-neutral-300 leading-relaxed min-h-[60px] resize-none placeholder:text-neutral-700"
              placeholder="O que a marca faz, com quem, para quê. Frase de impacto final..."
            />
          </div>
        </div>

        <div className="space-y-1">
          <MicroTitle className="text-neutral-600">{hasStructured ? 'Texto completo (opcional)' : 'Texto livre'}</MicroTitle>
          <Textarea
            value={manifesto.full || ''}
            onChange={(e) => update({ full: e.target.value })}
            className="border-white/[0.06] bg-transparent text-sm text-neutral-300 leading-relaxed min-h-[100px] resize-none placeholder:text-neutral-700"
            placeholder="Brand manifesto completo..."
          />
        </div>
      </div>
    </SectionBlock>
  );
};
