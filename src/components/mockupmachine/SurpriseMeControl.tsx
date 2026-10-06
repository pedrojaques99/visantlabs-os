import React from 'react';
import { Thumb } from '@/components/ui/Thumb';
import { Dices, PenLine, Pickaxe } from '@/lib/ui/icons';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/hooks/useTranslation';
import { useTheme } from '@/hooks/useTheme';
import type { UploadedImage } from '@/types/types';
import { isSafeUrl } from '@/utils/imageUtils';
import { getCreditsRequired } from '@/utils/creditCalculator';
import { Tooltip } from '@/components/ui/Tooltip';
import { GlitchLoader } from '@/components/ui/GlitchLoader';
import { GlassPanel } from '../ui/GlassPanel';
import { Button } from '@/components/ui/button';
import { GenerationActionButton } from '@/components/shared/GenerationActionButton';
import { useMockup } from './MockupContext';

interface SurpriseMeControlProps {
  onSurpriseMe: (autoGenerate: boolean) => void;
  isGeneratingPrompt: boolean;
  isDiceAnimating: boolean;
  isSurpriseMeMode: boolean;
  setIsSurpriseMeMode: (value: boolean) => void;
  onGeneratePrompt?: () => void;
  onGenerateOutputs?: () => void;
  isGenerateDisabled?: boolean;
  isGeneratingOutputs?: boolean;
  isPromptReady?: boolean;
  variant?: 'inline' | 'sticky';
  uploadedImage?: UploadedImage | null;
}

export const SurpriseMeControl: React.FC<SurpriseMeControlProps> = ({
  onSurpriseMe,
  isGeneratingPrompt,
  isDiceAnimating,
  isSurpriseMeMode,
  setIsSurpriseMeMode,
  onGeneratePrompt,
  onGenerateOutputs,
  isGenerateDisabled,
  isGeneratingOutputs,
  isPromptReady,
  variant = 'sticky',
  uploadedImage = null,
}) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const dark = theme === 'dark';
  const isInline = variant === 'inline';

  const { autoGenerate, selectedModel, resolution, mockupCount, imageProvider } = useMockup();

  const promptDisabled = !!(isGeneratingPrompt || isGenerateDisabled);
  const outputsDisabled = !!(
    isGeneratingPrompt ||
    isGeneratingOutputs ||
    isGenerateDisabled ||
    !isPromptReady
  );
  const creditsOutputs =
    selectedModel && isPromptReady
      ? mockupCount * getCreditsRequired(selectedModel, resolution, imageProvider)
      : 0;
  const creditsSurpriseMe = selectedModel
    ? mockupCount * getCreditsRequired(selectedModel, resolution, imageProvider)
    : 0;

  const promptTooltip = () => {
    if (!promptDisabled) return t('mockup.generatePromptShortcut');
    if (isGeneratingPrompt) return t('mockup.generatingPrompt');
    return t('messages.completeSteps');
  };
  const outputsTooltip = () => {
    if (!outputsDisabled) {
      if (creditsOutputs > 0)
        return `${t('mockup.generateOutputs')} (${creditsOutputs} ${
          creditsOutputs === 1 ? t('mockup.creditUnitSingular') : t('mockup.creditUnitPlural')
        })`;
      return t('mockup.generateOutputsShortcut');
    }
    if (isGeneratingPrompt) return t('mockup.generatingPrompt');
    if (isGeneratingOutputs) return t('mockup.generatingOutputs');
    if (!isPromptReady && !autoGenerate) return t('mockup.generatePromptFirst');
    if (!isPromptReady && autoGenerate) return t('mockup.generateAll');
    return t('messages.completeSteps');
  };
  const surpriseTooltip = () => {
    const base = isSurpriseMeMode
      ? t('mockup.surpriseMeModeActiveTooltip')
      : t('mockup.surpriseMeTooltip');
    if (autoGenerate && creditsSurpriseMe > 0)
      return `${base} (${creditsSurpriseMe} ${
        creditsSurpriseMe === 1 ? t('mockup.creditUnitSingular') : t('mockup.creditUnitPlural')
      })`;
    return base;
  };

  const thumbSrc = uploadedImage
    ? uploadedImage.url ||
      (uploadedImage.base64 &&
      isSafeUrl(`data:${uploadedImage.mimeType};base64,${uploadedImage.base64}`)
        ? `data:${uploadedImage.mimeType};base64,${uploadedImage.base64}`
        : '')
    : '';

  const renderButton = (
    onClick: () => void,
    disabled: boolean,
    icon: React.ReactNode,
    isActive: boolean,
    tooltip: string,
    creditsCount?: number,
    label?: string,
    btnVariant?: 'default' | 'generatePrompt' | 'surpriseMe'
  ) => {
    const isPrompt = label === t('mockup.promptShort');
    const isGenerate = label === t('mockup.outputsShort');
    const isSurprise = btnVariant === 'surpriseMe';

    // The white "prompt" button stays bespoke — the shared CTA covers cyan +
    // ghost. Everything else (surprise, generate) is the shared component so the
    // mockup machine and the brand mockup dialog use the exact same button.
    if (isPrompt) {
      return (
        <Tooltip content={tooltip} position="top">
          <Button
            type="button"
            onClick={onClick}
            disabled={disabled}
            className={cn(
              'relative flex items-center justify-center rounded-xl border font-medium transition-[color,background-color,border-color,opacity,transform,filter] duration-300 h-12 md:h-14',
              label ? 'px-4 gap-2 md:px-5' : 'w-12 md:w-14',
              disabled
                ? 'bg-muted border-border text-muted-foreground opacity-40 cursor-not-allowed'
                : 'bg-foreground border-foreground text-background shadow-lg hover:opacity-90 active:scale-[0.98]'
            )}
          >
            <span className="flex shrink-0 items-center justify-center">{icon}</span>
            {label && <span className="text-xs font-medium">{label}</span>}
          </Button>
        </Tooltip>
      );
    }

    return (
      <Tooltip content={tooltip} position="top">
        <GenerationActionButton
          variant={isSurprise ? 'surprise' : isGenerate ? 'primary' : 'ghost'}
          size="lg"
          onClick={onClick}
          disabled={disabled}
          active={isSurprise && isActive}
          icon={icon}
          label={label}
          credits={creditsCount}
        />
      </Tooltip>
    );
  };

  const Wrapper = isInline ? 'div' : GlassPanel;
  const wrapperClass = cn(
    'transition-[color,background-color,border-color,opacity,transform,filter] duration-300 origin-center flex flex-col items-center mx-auto',
    'w-full sm:w-fit pointer-events-auto px-2 sm:px-0',
    !isInline && 'max-w-full'
  );

  return (
    <Wrapper className={wrapperClass}>
      <div className={cn('flex items-center gap-4 select-none relative w-full', 'justify-center')}>
        {/* Pool Director Mode Indicator */}
        {isSurpriseMeMode && (
          <div className="absolute -top-5 left-1/2 -translate-x-1/2 flex items-center gap-1.5 animate-fade-in">
            <span className="text-2xs font-medium text-foreground whitespace-nowrap">
              {t('mockup.surpriseMeModeActiveTooltip')}
            </span>
          </div>
        )}

        {/* 1. SURPRISE ME BUTTON */}
        <div className="flex items-center gap-1.5">
          {renderButton(
            () => onSurpriseMe(autoGenerate),
            isGeneratingPrompt || isDiceAnimating,
            <Dices
              size={18}
              className={cn(
                'md:w-5 md:h-5 transition-transform duration-700',
                isDiceAnimating && 'rotate-[360deg]'
              )}
            />,
            isSurpriseMeMode,
            surpriseTooltip(),
            autoGenerate ? creditsSurpriseMe : 0,
            t('mockup.surpriseMe'),
            'surpriseMe'
          )}
        </div>

        {!isSurpriseMeMode && (
          <>
            {/* Divider */}
            <div className="w-[1px] h-10 bg-muted mx-1" />

            {/* 2. MAIN GENERATION FLOW */}
            <div className="flex items-center gap-2">
              {autoGenerate ? (
                renderButton(
                  isPromptReady || autoGenerate
                    ? onGenerateOutputs || (() => {})
                    : onGeneratePrompt || (() => {}),
                  isPromptReady ? outputsDisabled : promptDisabled,
                  isGeneratingPrompt || isGeneratingOutputs ? (
                    <GlitchLoader
                      size={16}
                      color={isPromptReady ? 'black' : dark ? 'white' : 'black'}
                    />
                  ) : isPromptReady ? (
                    <Pickaxe size={18} className="fill-current" />
                  ) : (
                    <PenLine size={18} />
                  ),
                  !!isPromptReady,
                  isPromptReady ? outputsTooltip() : promptTooltip(),
                  isPromptReady ? creditsOutputs : 0,
                  t('mockup.outputsShort')
                )
              ) : (
                <>
                  {renderButton(
                    onGeneratePrompt || (() => {}),
                    promptDisabled,
                    isGeneratingPrompt ? (
                      <GlitchLoader size={16} color={dark ? 'white' : 'black'} />
                    ) : (
                      <PenLine size={18} />
                    ),
                    !!isPromptReady,
                    promptTooltip(),
                    undefined,
                    t('mockup.promptShort')
                  )}
                  {renderButton(
                    onGenerateOutputs || (() => {}),
                    outputsDisabled,
                    isGeneratingOutputs ? (
                      <GlitchLoader size={16} color="black" />
                    ) : (
                      <Pickaxe size={18} className="fill-current" />
                    ),
                    false,
                    outputsTooltip(),
                    creditsOutputs,
                    t('mockup.outputsShort')
                  )}
                </>
              )}
            </div>
          </>
        )}

        {/* Uploaded image thumb - only in collapsed (pool) mode */}
        {!isInline && isSurpriseMeMode && thumbSrc && (
          <div
            className="w-14 h-14 shrink-0 rounded-xl border border-border overflow-hidden bg-neutral-900/50"
            role="img"
            aria-label={t('mockup.uploadedDesignAlt')}
          >
            <Thumb src={thumbSrc} alt="" className="w-full h-full object-cover" />
          </div>
        )}
      </div>
    </Wrapper>
  );
};
