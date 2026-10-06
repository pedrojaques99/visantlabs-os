import React, { useCallback } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { SectionBlock } from '../SectionBlock';
import { Textarea } from '@/components/ui/textarea';
import { ShieldCheck } from '@/lib/ui/icons';
import type { BrandGuideline } from '@/lib/figma-types';

interface AccessibilitySectionProps {
  guideline: BrandGuideline;
  onUpdate: (data: Partial<BrandGuideline>) => void;
  span?: string;
}

export const AccessibilitySection: React.FC<AccessibilitySectionProps> = ({
  guideline,
  onUpdate,
  span,
}) => {
  const { t } = useTranslation();
  const text = guideline.guidelines?.accessibility || '';

  const persist = useCallback(
    (value: string) => {
      onUpdate({ guidelines: { ...guideline.guidelines, accessibility: value } });
    },
    [onUpdate, guideline.guidelines]
  );

  return (
    <SectionBlock
      id="accessibility"
      span={span as any}
      icon={<ShieldCheck size={14} />}
      title={t('brandEditor.accessibility')}
    >
      <Textarea
        value={text}
        onChange={(e) => persist(e.target.value)}
        className="border-border text-xs min-h-[100px] resize-none text-muted-foreground placeholder:text-muted-foreground/50"
        placeholder={t('brandEditor.accessibilityPlaceholder')}
      />
    </SectionBlock>
  );
};
