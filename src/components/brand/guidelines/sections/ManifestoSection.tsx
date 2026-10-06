import React, { useCallback } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { SectionBlock } from '../SectionBlock';
import { Textarea } from '@/components/ui/textarea';
import { MicroTitle } from '@/components/ui/MicroTitle';
import { AiFieldButton } from '../AiFieldButton';
import { BookOpen } from '@/lib/ui/icons';
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

export const ManifestoSection: React.FC<ManifestoSectionProps> = ({
  guideline,
  onUpdate,
  span,
}) => {
  const { t } = useTranslation();
  const manifesto = readManifesto(guideline);

  const persist = useCallback(
    (next: BrandManifesto) => {
      onUpdate({ strategy: { ...guideline.strategy, manifesto: toStorable(next) } });
    },
    [onUpdate, guideline.strategy]
  );

  const update = (patch: Partial<BrandManifesto>) => {
    persist({ ...manifesto, ...patch });
  };

  const hasStructured = manifesto.provocation || manifesto.tension || manifesto.promise;
  const isEmpty =
    !manifesto.provocation && !manifesto.tension && !manifesto.promise && !manifesto.full;

  const handleAiResult = useCallback(
    (patch: Record<string, any>) => {
      const m = patch.strategy?.manifesto;
      if (!m) return;
      if (typeof m === 'string') persist({ ...manifesto, full: m });
      else persist({ ...manifesto, ...m });
    },
    [persist, manifesto]
  );

  return (
    <SectionBlock
      id="manifesto"
      icon={<BookOpen size={14} />}
      title={t('brandView.manifesto')}
      span={span as any}
      actions={
        isEmpty ? (
          <AiFieldButton
            guideline={guideline}
            section="strategy.manifesto"
            onResult={handleAiResult}
          />
        ) : undefined
      }
    >
      <div className="space-y-4 py-1">
        <div className="space-y-3">
          <div className="space-y-1">
            <MicroTitle className="text-muted-foreground/70">
              1. {t('brandView.provocation')}
            </MicroTitle>
            <Textarea
              value={manifesto.provocation || ''}
              onChange={(e) => update({ provocation: e.target.value })}
              className="border-border bg-transparent text-sm text-foreground leading-relaxed min-h-[60px] resize-none placeholder:text-muted-foreground/50"
              placeholder={t('brandEditor.provocationPlaceholder')}
            />
          </div>
          <div className="space-y-1">
            <MicroTitle className="text-muted-foreground/70">
              2. {t('brandView.tension')}
            </MicroTitle>
            <Textarea
              value={manifesto.tension || ''}
              onChange={(e) => update({ tension: e.target.value })}
              className="border-border bg-transparent text-sm text-foreground leading-relaxed min-h-[60px] resize-none placeholder:text-muted-foreground/50"
              placeholder={t('brandEditor.tensionPlaceholder')}
            />
          </div>
          <div className="space-y-1">
            <MicroTitle className="text-muted-foreground/70">
              3. {t('brandView.promise')}
            </MicroTitle>
            <Textarea
              value={manifesto.promise || ''}
              onChange={(e) => update({ promise: e.target.value })}
              className="border-border bg-transparent text-sm text-foreground leading-relaxed min-h-[60px] resize-none placeholder:text-muted-foreground/50"
              placeholder={t('brandEditor.promisePlaceholder')}
            />
          </div>
        </div>

        <div className="space-y-1">
          <MicroTitle className="text-muted-foreground/70">
            {hasStructured
              ? t('brandEditor.manifestoFullOptional')
              : t('brandEditor.manifestoFree')}
          </MicroTitle>
          <Textarea
            value={manifesto.full || ''}
            onChange={(e) => update({ full: e.target.value })}
            className="border-border bg-transparent text-sm text-foreground leading-relaxed min-h-[100px] resize-none placeholder:text-muted-foreground/50"
            placeholder={t('brandView.manifestoPlaceholder')}
          />
        </div>
      </div>
    </SectionBlock>
  );
};
