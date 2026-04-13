import React from 'react';
import { BrandLogoSection } from './BrandLogoSection';
import { BrandTypographySection } from './BrandTypographySection';
import { BrandColorGrid } from './BrandColorGrid';
import { BrandGuidelineSection } from './BrandGuidelineSection';
import { DesignSystemSection } from './DesignSystemSection';
import { ComponentLibrarySection } from './ComponentLibrarySection';
import { Separator } from '@/components/ui/separator';

export function BrandTab() {
  return (
    <div className="space-y-6 pb-8">
      <BrandLogoSection />
      <Separator />

      <BrandTypographySection />
      <Separator />

      <BrandColorGrid />
      <Separator />

      <DesignSystemSection />
      <Separator />

      <BrandGuidelineSection />
      <Separator />

      <ComponentLibrarySection />
    </div>
  );
}
