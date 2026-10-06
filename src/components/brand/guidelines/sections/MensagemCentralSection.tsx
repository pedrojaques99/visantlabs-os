import React, { useCallback } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { SectionBlock } from '../SectionBlock';
import { Input } from '@/components/ui/input';
import { MicroTitle } from '@/components/ui/MicroTitle';
import { AiFieldButton } from '../AiFieldButton';
import { MessageSquare } from '@/lib/ui/icons';
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

export const MensagemCentralSection: React.FC<MensagemCentralSectionProps> = ({
  guideline,
  onUpdate,
  span,
}) => {
  const { t } = useTranslation();
  const cm = readCoreMessage(guideline);

  const persist = useCallback(
    (next: BrandCoreMessage) => {
      onUpdate({
        strategy: {
          ...guideline.strategy,
          coreMessage: next,
          positioning: [next.product, next.differential, next.emotionalBond],
        },
      });
    },
    [onUpdate, guideline.strategy]
  );

  const update = (patch: Partial<BrandCoreMessage>) => {
    persist({ ...cm, ...patch });
  };

  const hasMessage = cm.product || cm.differential || cm.emotionalBond;

  const handleAiResult = useCallback(
    (patch: Record<string, any>) => {
      const c = patch.strategy?.coreMessage;
      if (!c) return;
      persist({ ...cm, ...c });
    },
    [persist, cm]
  );

  return (
    <SectionBlock
      id="mensagem_central"
      icon={<MessageSquare size={14} />}
      title={t('brandView.coreMessage')}
      span={span as any}
      actions={
        !hasMessage ? (
          <AiFieldButton
            guideline={guideline}
            section="strategy.coreMessage"
            onResult={handleAiResult}
          />
        ) : undefined
      }
    >
      <div className="space-y-4 py-1">
        <div className="space-y-2">
          <div className="space-y-1">
            <MicroTitle className="text-muted-foreground/70">
              1. {t('brandView.product')}
            </MicroTitle>
            <Input
              value={cm.product}
              onChange={(e) => update({ product: e.target.value })}
              className="h-7 border-border text-xs text-foreground bg-transparent placeholder:text-muted-foreground/50"
              placeholder={t('brandEditor.productPlaceholder')}
            />
          </div>
          <div className="space-y-1">
            <MicroTitle className="text-muted-foreground/70">
              2. {t('brandView.differential')}
            </MicroTitle>
            <Input
              value={cm.differential}
              onChange={(e) => update({ differential: e.target.value })}
              className="h-7 border-border text-xs text-foreground bg-transparent placeholder:text-muted-foreground/50"
              placeholder={t('brandEditor.differentialPlaceholder')}
            />
          </div>
          <div className="space-y-1">
            <MicroTitle className="text-muted-foreground/70">
              3. {t('brandView.emotionalBond')}
            </MicroTitle>
            <Input
              value={cm.emotionalBond}
              onChange={(e) => update({ emotionalBond: e.target.value })}
              className="h-7 border-border text-xs text-foreground bg-transparent placeholder:text-muted-foreground/50"
              placeholder={t('brandEditor.emotionalPlaceholder')}
            />
          </div>
        </div>

        {hasMessage && (
          <div className="pt-3 border-t border-border">
            <p className="text-2xs text-muted-foreground mb-2">{t('brandEditor.preview')}</p>
            <p className="text-sm text-foreground leading-relaxed">
              {cm.product && <span className="font-medium text-foreground">{cm.product}</span>}
              {cm.product && cm.differential && (
                <span className="text-muted-foreground"> {t('brandEditor.previewWith')} </span>
              )}
              {cm.differential && (
                <span className="font-medium text-foreground">{cm.differential}</span>
              )}
              {cm.differential && cm.emotionalBond && (
                <span className="text-muted-foreground"> {t('brandEditor.previewFeeling')} </span>
              )}
              {cm.emotionalBond && (
                <span className="font-medium text-foreground">{cm.emotionalBond}.</span>
              )}
            </p>
          </div>
        )}
      </div>
    </SectionBlock>
  );
};
