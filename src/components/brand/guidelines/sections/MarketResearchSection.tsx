import React, { useCallback } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { SectionBlock } from '../SectionBlock';
import { MicroTitle } from '@/components/ui/MicroTitle';
import { Textarea } from '@/components/ui/textarea';
import { Search } from '@/lib/ui/icons';
import type { BrandGuideline, BrandMarketResearch } from '@/lib/figma-types';

interface MarketResearchSectionProps {
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

export const MarketResearchSection: React.FC<MarketResearchSectionProps> = ({
  guideline,
  onUpdate,
  span,
}) => {
  const { t } = useTranslation();
  const mr = guideline.strategy?.marketResearch || {};

  const persist = useCallback(
    (next: BrandMarketResearch) => {
      onUpdate({ strategy: { ...guideline.strategy, marketResearch: next } });
    },
    [onUpdate, guideline.strategy]
  );

  const update = (patch: Partial<BrandMarketResearch>) => {
    persist({ ...mr, ...patch });
  };

  return (
    <SectionBlock
      id="market_research"
      icon={<Search size={14} />}
      title={t('brandEditor.marketResearch')}
      span={span as any}
    >
      <div className="space-y-4 py-1">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="space-y-1">
            <MicroTitle className="text-muted-foreground/70">
              {t('brandEditor.competitors')}
            </MicroTitle>
            <Textarea
              value={toLines(mr.competitors)}
              onChange={(e) => update({ competitors: fromLines(e.target.value) })}
              className="border-border bg-transparent text-xs text-muted-foreground min-h-[80px] resize-none placeholder:text-muted-foreground/50"
              placeholder={t('brandEditor.competitorsPlaceholder')}
            />
          </div>
          <div className="space-y-1">
            <MicroTitle className="text-muted-foreground/70">{t('brandEditor.gaps')}</MicroTitle>
            <Textarea
              value={toLines(mr.gaps)}
              onChange={(e) => update({ gaps: fromLines(e.target.value) })}
              className="border-border bg-transparent text-xs text-muted-foreground min-h-[80px] resize-none placeholder:text-muted-foreground/50"
              placeholder={t('brandEditor.gapsPlaceholder')}
            />
          </div>
          <div className="space-y-1">
            <MicroTitle className="text-muted-foreground/70">
              {t('brandEditor.opportunities')}
            </MicroTitle>
            <Textarea
              value={toLines(mr.opportunities)}
              onChange={(e) => update({ opportunities: fromLines(e.target.value) })}
              className="border-border bg-transparent text-xs text-muted-foreground min-h-[80px] resize-none placeholder:text-muted-foreground/50"
              placeholder={t('brandEditor.opportunitiesPlaceholder')}
            />
          </div>
        </div>

        <div className="space-y-1">
          <MicroTitle className="text-muted-foreground/70">
            {t('brandEditor.extraNotes')}
          </MicroTitle>
          <Textarea
            value={mr.notes || ''}
            onChange={(e) => update({ notes: e.target.value })}
            className="border-border bg-transparent text-xs text-muted-foreground min-h-[50px] resize-none placeholder:text-muted-foreground/50"
            placeholder={t('brandEditor.marketNotesPlaceholder')}
          />
        </div>
      </div>
    </SectionBlock>
  );
};
