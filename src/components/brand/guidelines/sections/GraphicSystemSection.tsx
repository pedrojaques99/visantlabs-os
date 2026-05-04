import React, { useCallback } from 'react';
import { SectionBlock } from '../SectionBlock';
import { MicroTitle } from '@/components/ui/MicroTitle';
import { Textarea } from '@/components/ui/textarea';
import { Shapes } from 'lucide-react';
import type { BrandGuideline, BrandGraphicSystem } from '@/lib/figma-types';

interface GraphicSystemSectionProps {
  guideline: BrandGuideline;
  onUpdate: (data: Partial<BrandGuideline>) => void;
  span?: string;
}

const toLines = (arr?: string[]) => (arr || []).join('\n');
const fromLines = (text: string) => text.split('\n').map(s => s.trim()).filter(Boolean);

export const GraphicSystemSection: React.FC<GraphicSystemSectionProps> = ({ guideline, onUpdate, span }) => {
  const gs = guideline.strategy?.graphicSystem || {};

  const persist = useCallback((next: BrandGraphicSystem) => {
    onUpdate({ strategy: { ...guideline.strategy, graphicSystem: next } });
  }, [onUpdate, guideline.strategy]);

  const update = (patch: Partial<BrandGraphicSystem>) => {
    persist({ ...gs, ...patch });
  };

  return (
    <SectionBlock id="graphic_system" icon={<Shapes size={14} />} title="Sistema Gráfico" span={span as any}>
      <div className="space-y-4 py-1">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1">
            <MicroTitle className="text-neutral-600">Patterns</MicroTitle>
            <Textarea
              value={toLines(gs.patterns)}
              onChange={(e) => update({ patterns: fromLines(e.target.value) })}
              className="border-white/[0.06] bg-transparent text-xs text-neutral-400 min-h-[70px] resize-none placeholder:text-neutral-700"
              placeholder={"Lines de quadra\nPatterns orbitais\nTexturas geométricas"}
            />
          </div>
          <div className="space-y-1">
            <MicroTitle className="text-neutral-600">Grafismos</MicroTitle>
            <Textarea
              value={toLines(gs.grafisms)}
              onChange={(e) => update({ grafisms: fromLines(e.target.value) })}
              className="border-white/[0.06] bg-transparent text-xs text-neutral-400 min-h-[70px] resize-none placeholder:text-neutral-700"
              placeholder={"Elipses sobrepostas\nFormas com DNA da marca"}
            />
          </div>
          <div className="space-y-1">
            <MicroTitle className="text-neutral-600">Regras de Imagem</MicroTitle>
            <Textarea
              value={toLines(gs.imageRules)}
              onChange={(e) => update({ imageRules: fromLines(e.target.value) })}
              className="border-white/[0.06] bg-transparent text-xs text-neutral-400 min-h-[70px] resize-none placeholder:text-neutral-700"
              placeholder={"Fotografia sempre com filtro quente\nCortes em diagonal\nSem fundos brancos puros"}
            />
          </div>
          <div className="space-y-1">
            <MicroTitle className="text-neutral-600">Grid Editorial</MicroTitle>
            <Textarea
              value={gs.editorialGrid || ''}
              onChange={(e) => update({ editorialGrid: e.target.value })}
              className="border-white/[0.06] bg-transparent text-xs text-neutral-400 min-h-[70px] resize-none placeholder:text-neutral-700"
              placeholder="Malha que organiza posts, páginas, apresentações..."
            />
          </div>
        </div>
      </div>
    </SectionBlock>
  );
};
