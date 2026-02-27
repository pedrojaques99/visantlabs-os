import React from 'react';
import type { DesignType, UploadedImage } from '@/types/types';
import { useTranslation } from '@/hooks/useTranslation';
import { useTheme } from '@/hooks/useTheme';
import { Button } from '@/components/ui/button';
import { cn, sectionTitleClass } from '@/lib/utils';

interface DesignTypeSectionProps {
  designType: DesignType | null;
  onDesignTypeChange: (type: DesignType) => void;
  uploadedImage: UploadedImage | null;
  onScrollToSection: (sectionId: string) => void;
}

export const DesignTypeSection: React.FC<DesignTypeSectionProps> = ({
  designType,
  onDesignTypeChange,
  uploadedImage,
  onScrollToSection
}) => {
  const isComplete = !!designType;
  const { t } = useTranslation();
  const { theme } = useTheme();

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className={cn(sectionTitleClass(theme === 'dark'), 'transition-all duration-300')}>
          {t('mockup.designType')}
        </h2>
      </div>
      {!isComplete && (
        <p className="text-xs text-neutral-500 mb-3 font-mono">{t('mockup.designTypeComment')}</p>
      )}
      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <Button
            onClick={() => {
              onDesignTypeChange('logo');
              onScrollToSection('branding-section');
            }}
            variant="outline"
            className={cn(
              "w-full h-full flex flex-col items-center justify-center gap-1 p-4 text-xs font-mono transition-all",
              designType === 'logo'
                ? 'bg-brand-cyan/10 text-brand-cyan border-brand-cyan/40 shadow-sm'
                : 'bg-neutral-800/30 text-neutral-400 border-neutral-700/30 hover:border-neutral-600/50 hover:bg-neutral-800/40'
            )}
          >
            <span className="text-sm">🖼️</span>
            <span className="font-semibold text-sm">{t('mockup.itsALogo')}</span>
          </Button>
          <Button
            onClick={() => {
              onDesignTypeChange('layout');
              onScrollToSection('branding-section');
            }}
            variant="outline"
            className={cn(
              "w-full h-full flex flex-col items-center justify-center gap-1 p-4 text-xs font-mono transition-all",
              designType === 'layout'
                ? 'bg-brand-cyan/10 text-brand-cyan border-brand-cyan/40 shadow-sm'
                : 'bg-neutral-800/30 text-neutral-400 border-neutral-700/30 hover:border-neutral-600/50 hover:bg-neutral-800/40'
            )}
          >
            <span className="text-sm">🎨</span>
            <span className="font-semibold text-sm">{t('mockup.itsALayout')}</span>
          </Button>
        </div>

      </div>
    </section>
  );
};


