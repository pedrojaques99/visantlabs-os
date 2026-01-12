import React from 'react';
import type { DesignType, UploadedImage } from '../../types';
import { useTranslation } from '../../hooks/useTranslation';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';

interface DesignTypeSectionProps {
  designType: DesignType | null;
  onDesignTypeChange: (type: DesignType) => void;
  uploadedImage: UploadedImage | null;
  isImagelessMode: boolean;
  onScrollToSection: (sectionId: string) => void;
}

export const DesignTypeSection: React.FC<DesignTypeSectionProps> = ({
  designType,
  onDesignTypeChange,
  uploadedImage,
  isImagelessMode,
  onScrollToSection
}) => {
  const isComplete = !!designType;
  const { t } = useTranslation();

  return (
    <section className={isComplete ? 'pb-0' : ''}>
      <h2 className={`font-semibold font-mono uppercase tracking-widest mb-3 transition-all duration-300 ${isComplete ? 'text-[10px] text-zinc-600 mb-1' : 'text-sm text-zinc-400'}`}>
        {t('mockup.designType')}
      </h2>
      {!isComplete && (
        <p className="text-xs text-zinc-500 mb-3 font-mono">{t('mockup.designTypeComment')}</p>
      )}
      <div className="space-y-2">
        {designType !== 'blank' && (
          <div className="grid grid-cols-2 gap-2">
            <Button
              onClick={() => {
                onDesignTypeChange('logo');
                onScrollToSection('branding-section');
              }}
              disabled={isImagelessMode}
              variant="outline"
              className={cn(
                "w-full flex flex-col items-center justify-center gap-1 p-4 text-xs font-mono",
                designType === 'logo'
                  ? 'bg-brand-cyan/10 text-brand-cyan border-[brand-cyan]/40'
                  : 'bg-zinc-800/30 text-zinc-400 border-zinc-700/30 hover:border-zinc-600/50'
              )}
            >
              <span className="text-2xl">🖼️</span>
              <span className="font-semibold text-sm">{t('mockup.itsALogo')}</span>
            </Button>
            <Button
              onClick={() => {
                onDesignTypeChange('layout');
                onScrollToSection('branding-section');
              }}
              disabled={isImagelessMode}
              variant="outline"
              className={cn(
                "w-full flex flex-col items-center justify-center gap-1 p-4 text-xs font-mono",
                designType === 'layout'
                  ? 'bg-brand-cyan/10 text-brand-cyan border-[brand-cyan]/40'
                  : 'bg-zinc-800/30 text-zinc-400 border-zinc-700/30 hover:border-zinc-600/50'
              )}
            >
              <span className="text-2xl">🎨</span>
              <span className="font-semibold text-sm">{t('mockup.itsALayout')}</span>
            </Button>
          </div>
        )}
        {!uploadedImage && (
          <Button
            onClick={() => onDesignTypeChange('blank')}
            variant="outline"
            className={cn(
              "w-full flex items-center gap-2 px-3 py-2 text-xs font-mono",
              designType === 'blank'
                ? 'bg-brand-cyan/10 text-brand-cyan border-[brand-cyan]/40'
                : 'bg-zinc-800/30 text-zinc-400 border-zinc-700/30 hover:border-zinc-600/50'
            )}
          >
            <span className="text-lg">📄</span>
            <span className="font-semibold">{t('mockup.blankMockup')}</span>
          </Button>
        )}
      </div>
    </section>
  );
};


