import React from 'react';
import { useFigmaMessages } from '../../hooks/useFigmaMessages';
import { BrandSection } from './BrandSection';
import { BrandIntelligenceSection } from './BrandIntelligenceSection';
import { ColorCleanupSection } from './ColorCleanupSection';
import { BrandMatrixSection } from './BrandMatrixSection';
import { BrainCircuit, Paintbrush } from 'lucide-react';

export function BrandOperationsSection() {
  useFigmaMessages();

  return (
    <div className="space-y-3 p-1">
      <BrandSection
        title="Intelligence"
        icon={BrainCircuit}
        badge="AI"
        description="Import, strategy extraction, and smart scan"
        collapsible
        defaultOpen={true}
      >
        <BrandIntelligenceSection />
      </BrandSection>

      <BrandSection
        title="Color Cleanup"
        icon={Paintbrush}
        description="Find and bind hardcoded colors to variables"
        collapsible
        defaultOpen={false}
      >
        <ColorCleanupSection />
      </BrandSection>

      <BrandMatrixSection />
    </div>
  );
}
