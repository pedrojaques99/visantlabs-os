import React from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { useFigmaMessages } from '../../hooks/useFigmaMessages';
import { BrandSection } from './BrandSection';
import { BrandIntelligenceSection } from './BrandIntelligenceSection';
import { ColorCleanupSection } from './ColorCleanupSection';
import { BrandMatrixSection } from './BrandMatrixSection';
import { BrainCircuit, Paintbrush } from 'lucide-react';

export function BrandOperationsSection() {
  const { t } = useTranslation();
  useFigmaMessages();

  return (
    <div className="space-y-3 p-1">
      <BrandSection
        title={t('plugin.brand.operations.intelligenceTitle')}
        icon={BrainCircuit}
        badge={t('plugin.brand.operations.intelligenceBadge')}
        description={t('plugin.brand.operations.intelligenceDescription')}
        collapsible
        defaultOpen={true}
      >
        <BrandIntelligenceSection />
      </BrandSection>

      <BrandSection
        title={t('plugin.brand.operations.colorCleanupTitle')}
        icon={Paintbrush}
        description={t('plugin.brand.operations.colorCleanupDescription')}
        collapsible
        defaultOpen={false}
      >
        <ColorCleanupSection />
      </BrandSection>

      <BrandMatrixSection />
    </div>
  );
}
