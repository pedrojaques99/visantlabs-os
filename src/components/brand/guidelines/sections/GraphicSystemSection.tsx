import React, { useCallback } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { SectionBlock } from '../SectionBlock';
import { MicroTitle } from '@/components/ui/MicroTitle';
import { Textarea } from '@/components/ui/textarea';
import { Shapes } from '@/lib/ui/icons';
import type { BrandGuideline, BrandGraphicSystem } from '@/lib/figma-types';

interface GraphicSystemSectionProps {
  guideline: BrandGuideline;
  onUpdate: (data: Partial<BrandGuideline>) => void;
  span?: string;
}

const toLines = (arr?: string[]) => (arr || []).join('\n');
const fromLines = (text: string) =>
  text
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);

export const GraphicSystemSection: React.FC<GraphicSystemSectionProps> = ({
  guideline,
  onUpdate,
  span,
}) => {
  const { t } = useTranslation();
  const gs = guideline.strategy?.graphicSystem || {};

  const persist = useCallback(
    (next: BrandGraphicSystem) => {
      onUpdate({ strategy: { ...guideline.strategy, graphicSystem: next } });
    },
    [onUpdate, guideline.strategy]
  );

  const update = (patch: Partial<BrandGraphicSystem>) => {
    persist({ ...gs, ...patch });
  };

  return (
    <SectionBlock
      id="graphic_system"
      icon={<Shapes size={14} />}
      title={t('brandEditor.graphicSystem')}
      span={span as any}
    >
      <div className="space-y-4 py-1">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1">
            <MicroTitle className="text-muted-foreground/70">{t('brandEditor.patterns')}</MicroTitle>
            <Textarea
              value={toLines(gs.patterns)}
              onChange={(e) => update({ patterns: fromLines(e.target.value) })}
              className="border-border bg-transparent text-xs text-muted-foreground min-h-[70px] resize-none placeholder:text-muted-foreground/50"
              placeholder={t('brandEditor.patternsPlaceholder')}
            />
          </div>
          <div className="space-y-1">
            <MicroTitle className="text-muted-foreground/70">{t('brandEditor.graphics')}</MicroTitle>
            <Textarea
              value={toLines(gs.grafisms)}
              onChange={(e) => update({ grafisms: fromLines(e.target.value) })}
              className="border-border bg-transparent text-xs text-muted-foreground min-h-[70px] resize-none placeholder:text-muted-foreground/50"
              placeholder={t('brandEditor.graphicsPlaceholder')}
            />
          </div>
          <div className="space-y-1">
            <MicroTitle className="text-muted-foreground/70">{t('brandEditor.imageRules')}</MicroTitle>
            <Textarea
              value={toLines(gs.imageRules)}
              onChange={(e) => update({ imageRules: fromLines(e.target.value) })}
              className="border-border bg-transparent text-xs text-muted-foreground min-h-[70px] resize-none placeholder:text-muted-foreground/50"
              placeholder={t('brandEditor.imageRulesPlaceholder')}
            />
          </div>
          <div className="space-y-1">
            <MicroTitle className="text-muted-foreground/70">{t('brandEditor.editorialGrid')}</MicroTitle>
            <Textarea
              value={gs.editorialGrid || ''}
              onChange={(e) => update({ editorialGrid: e.target.value })}
              className="border-border bg-transparent text-xs text-muted-foreground min-h-[70px] resize-none placeholder:text-muted-foreground/50"
              placeholder={t('brandEditor.editorialGridPlaceholder')}
            />
          </div>
        </div>
      </div>
    </SectionBlock>
  );
};
