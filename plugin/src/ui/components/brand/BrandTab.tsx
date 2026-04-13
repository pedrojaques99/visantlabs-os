import React from 'react';
import { BrandLogoSection } from './BrandLogoSection';
import { BrandTypographySection } from './BrandTypographySection';
import { BrandColorGrid } from './BrandColorGrid';
import { BrandGuidelineSection } from './BrandGuidelineSection';
import { DesignSystemSection } from './DesignSystemSection';
import { ComponentLibrarySection } from './ComponentLibrarySection';
import { BrandIntelligenceSection } from './BrandIntelligenceSection';
import { IllustratorExportSection } from '../illustrator/IllustratorExportSection';
import { Separator } from '@/components/ui/separator';

export function BrandTab() {
  return (
    <div className="space-y-6 pb-8">
      <BrandGuidelineSection />
      <Separator />

      <BrandIntelligenceSection />
      <Separator />

      <BrandLogoSection />
      <Separator />

      <BrandColorGrid />
      <Separator />

      <BrandTypographySection />
      <Separator />

      <DesignSystemSection />
      <Separator />

      <ComponentLibrarySection />
      <Separator />

      <IllustratorExportSection />
    </div>
  );
}
