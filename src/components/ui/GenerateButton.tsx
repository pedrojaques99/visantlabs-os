import React from 'react';
import { Pickaxe, RefreshCcw } from 'lucide-react';
import { GlitchLoader } from './GlitchLoader';
import { Button } from './button';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/hooks/useTranslation';

interface GenerateButtonProps {
  onClick: () => void;
  disabled: boolean;
  isGeneratingPrompt: boolean;
  isGenerating: boolean;
  isPromptReady: boolean;
  variant?: 'sidebar' | 'floating';
  /** When true with variant=floating, omits fixed positioning so it can sit inside a shared flex container */
  embed?: boolean;
  buttonRef?: React.RefObject<HTMLButtonElement>;
  creditsRequired?: number;
}

export const GenerateButton: React.FC<GenerateButtonProps> = ({
  onClick,
  disabled,
  isGeneratingPrompt,
  isGenerating,
  isPromptReady,
  variant = 'sidebar',
  embed = false,
  buttonRef,
  creditsRequired
}) => {
  const { t } = useTranslation();
  if (variant === 'floating') {
    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      // Only stop propagation to prevent event bubbling
      // Don't use preventDefault() to avoid passive listener issues
      e.stopPropagation();
      if (!disabled) {
        onClick();
      }
    };

    return (
      <Button
        onClick={handleClick}
        disabled={disabled}
        variant={embed ? "default" : "brand"}
        className={cn(
          !embed && "fixed bottom-4 md:bottom-8 right-4 md:right-8 mb-10 z-30",
          embed
            ? "h-12 px-4 py-2 gap-2 text-sm font-semibold bg-brand-cyan hover:bg-brand-cyan/90 text-black shadow-lg hover:shadow-xl transform active:scale-95"
            : "flex-col gap-0.5 md:gap-1 font-semibold py-2 md:py-3 px-4 md:px-6 text-xs md:text-sm shadow-2xl transform active:scale-95 animate-fade-in-up",
          "focus:ring-offset-[#0C0C0C]"
        )}
        aria-label={isGeneratingPrompt ? t('mockup.generatingPrompt') : isGenerating ? t('mockup.generatingOutputs') : isPromptReady ? t('mockup.generateOutputs') : t('mockup.generatePrompt')}
        title={isPromptReady ? t('mockup.generateOutputsShortcut') : t('mockup.generatePromptShortcut')}
      >
        {isGeneratingPrompt ? (
          <div className="flex items-center gap-2">
            <GlitchLoader size={12} className="md:w-[12px] md:h-[12px]" />
            <span className="hidden sm:inline">{t('mockup.generatingPrompt')}</span>
            <span className="sm:hidden">{t('mockup.generatingPromptShort')}</span>
          </div>
        ) : isGenerating ? (
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1">
              {[0, 1, 2].map((dot) => (
                <span
                  key={dot}
                  className="w-1.5 h-1.5 rounded-md bg-black/60 animate-pulse"
                  style={{ animationDelay: `${dot * 150}ms` }}
                />
              ))}
            </span>
            <span className="hidden sm:inline">{t('mockup.generatingOutputs')}</span>
            <span className="sm:hidden">{t('mockup.generatingOutputsShort')}</span>
          </div>
        ) : isPromptReady ? (
          <div className="flex flex-col items-center gap-0.5">
            <div className="flex items-center gap-1.5 md:gap-2">
              <span className="text-base">⛏️</span>
              <span className="hidden sm:inline">{t('mockup.generateOutputs')}</span>
              <span className="sm:hidden">{t('mockup.outputsShort')}</span>
            </div>
            {creditsRequired !== undefined && creditsRequired > 0 && (
              <span className="text-[10px] md:text-xs font-mono text-black/70">
                {creditsRequired} {creditsRequired === 1 ? t('mockup.creditUnitSingular') : t('mockup.creditUnitPlural')}
              </span>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <RefreshCcw size={embed ? 16 : 12} className={!embed ? "md:w-4 md:h-4" : undefined} />
            <span className="hidden sm:inline">{t('mockup.generatePrompt')}</span>
            <span className="sm:hidden">{t('mockup.promptShort')}</span>
          </div>
        )}
      </Button>
    );
  }

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    // Only stop propagation to prevent event bubbling
    // Don't use preventDefault() to avoid passive listener issues
    e.stopPropagation();
    if (!disabled) {
      onClick();
    }
  };

  return (
    <Button
      ref={buttonRef}
      onClick={handleClick}
      disabled={disabled}
      variant="brand"
      className={cn(
        "w-full flex-col gap-1 font-semibold py-3 px-6 text-md shadow-lg mt-4 transform active:scale-95",
        "focus:ring-offset-[#1A1A1A]"
      )}
      aria-label={isGeneratingPrompt ? t('mockup.generatingPrompt') : isGenerating ? t('mockup.generatingOutputs') : isPromptReady ? t('mockup.generateOutputs') : t('mockup.generatePrompt')}
      title={isPromptReady ? t('mockup.generateOutputsShortcut') : t('mockup.generatePromptShortcut')}
    >
      {isGeneratingPrompt ? (
        <div className="flex items-center gap-2">
          <GlitchLoader size={12} />
          <span>{t('mockup.generatingPrompt')}</span>
        </div>
      ) : isGenerating ? (
        <div className="flex items-center gap-2">
          <GlitchLoader size={12} />
          <span>{t('mockup.generatingOutputs')}</span>
        </div>
      ) : isPromptReady ? (
        <div className="flex items-center gap-2">
          <span className="text-base">⛏️</span>
          <span>{t('mockup.generateOutputs')}</span>
          {creditsRequired !== undefined && creditsRequired > 0 && (
            <span className="text-xs font-mono text-black/70">
              {creditsRequired} {creditsRequired === 1 ? t('mockup.creditUnitSingular') : t('mockup.creditUnitPlural')}
            </span>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <Pickaxe size={12} />
          <span>{t('mockup.generatePrompt')}</span>
        </div>
      )}
    </Button>
  );
};

