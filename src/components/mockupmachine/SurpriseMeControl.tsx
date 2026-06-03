import React from 'react';
import { Dices, PenLine, Pickaxe } from 'lucide-react';
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
  const isLight = !dark;
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
    if (isGeneratingPrompt) return t('mockup.generatingPrompt') || 'Gerando prompt...';
    return (
      t('messages.selectDesignTypeFirst') ||
      t('messages.completeSteps') ||
      'Conclua o setup antes de gerar o prompt.'
    );
  };
  const outputsTooltip = () => {
    if (!outputsDisabled) {
      if (creditsOutputs > 0)
        return `${t('mockup.generateOutputs')} — ${creditsOutputs} ${
          creditsOutputs === 1 ? t('mockup.creditUnitSingular') : t('mockup.creditUnitPlural')
        }`;
      return t('mockup.generateOutputsShortcut');
    }
    if (isGeneratingPrompt) return t('mockup.generatingPrompt') || 'Gerando prompt...';
    if (isGeneratingOutputs) return t('mockup.generatingOutputs') || 'Gerando resultados...';
    if (!isPromptReady && !autoGenerate)
      return t('mockup.generatePromptFirst') || 'Gere um prompt primeiro.';
    if (!isPromptReady && autoGenerate)
      return t('mockup.generateAll') || 'Gere o prompt e as imagens em um clique.';
    return (
      t('messages.selectDesignTypeFirst') ||
      t('messages.completeSteps') ||
      t('mockup.insufficientCredits') ||
      'Conclua o setup ou verifique créditos.'
    );
  };
  const surpriseTooltip = () => {
    const base = isSurpriseMeMode
      ? t('mockup.surpriseMeModeActiveTooltip')
      : t('mockup.surpriseMeTooltip');
    if (autoGenerate && creditsSurpriseMe > 0)
      return `${base} — ${creditsSurpriseMe} ${
        creditsSurpriseMe === 1 ? t('mockup.creditUnitSingular') : t('mockup.creditUnitPlural')
      }`;
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
    const isPrimarySurprise = btnVariant === 'surpriseMe';
    const isPrimaryAction = isPrimarySurprise || isGenerate;

    const buttonContent = (
      <Button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={cn(
          'relative flex items-center justify-center rounded-xl border transition-all duration-300 font-bold',
          'focus:outline-none focus:ring-2 focus:ring-brand-cyan/50',
          'h-12 md:h-14 backdrop-blur-md',
          label
            ? 'flex-row px-3 md:px-5 gap-2 md:gap-2.5'
            : 'w-12 md:w-14 items-center justify-center',
          btnVariant === 'surpriseMe' && label && 'min-w-[120px] md:min-w-[140px]',
          !disabled && isPrompt
            ? 'bg-white border-white text-black shadow-lg hover:scale-[1.02] active:scale-[0.98] hover:bg-white/90'
            : !disabled && isPrimaryAction
            ? cn(
                'text-black',
                'shadow-xl hover:scale-[1.02] active:scale-[0.98] font-black',
                isPrimarySurprise
                  ? 'bg-brand-cyan border-brand-cyan/50 hover:bg-brand-cyan/90'
                  : isPromptReady || autoGenerate
                  ? 'bg-brand-cyan border-brand-cyan/50 hover:bg-brand-cyan/90 ring-2 ring-brand-cyan/20 ring-offset-2 ring-offset-black transition-shadow duration-500 shadow-[0_0_30px_rgba(var(--brand-cyan-rgb),0.15)]'
                  : 'bg-neutral-800 border-white/10 text-neutral-400 hover:text-white hover:bg-neutral-700',
                isPrimarySurprise &&
                  isActive &&
                  'ring-2 ring-brand-cyan ring-offset-2 ring-offset-black'
              )
            : !disabled && isActive
            ? 'bg-brand-cyan/20 border-brand-cyan/40 text-brand-cyan shadow-md'
            : isLight
            ? 'bg-neutral-100/80 border-neutral-300/50 hover:bg-neutral-200/50 hover:border-neutral-400/50 text-neutral-600 shadow-sm'
            : 'bg-neutral-900/80 border-neutral-800/50 hover:bg-neutral-800/60 hover:border-neutral-700/50 text-neutral-400 shadow-sm',
          disabled && 'opacity-20 cursor-not-allowed pointer-events-none'
        )}
      >
        <div
          className={cn(
            'flex items-center justify-center flex-shrink-0 transition-colors',
            !disabled && (isPrimaryAction || isPrompt || isActive)
              ? 'text-black'
              : 'group-hover:text-white'
          )}
        >
          {icon}
        </div>
        {label && (
          <span
            className={cn(
              'flex items-center gap-1.5 text-[10px] md:text-xs font-mono uppercase tracking-[0.12em] whitespace-nowrap text-center leading-tight transition-colors font-bold',
              !disabled && (isPrimaryAction || isPrompt || isActive)
                ? 'text-black'
                : dark
                ? 'text-neutral-400'
                : 'text-neutral-600'
            )}
          >
            {label}
            {creditsCount != null && creditsCount > 0 && (
              <span className="text-[10px] md:text-[11px] font-semibold opacity-90">
                {creditsCount} 💎
              </span>
            )}
          </span>
        )}
      </Button>
    );

    return (
      <Tooltip content={tooltip} position="top">
        {buttonContent}
      </Tooltip>
    );
  };

  const Wrapper = isInline ? 'div' : GlassPanel;
  const wrapperClass = cn(
    'transition-all duration-300 origin-center flex flex-col items-center mx-auto',
    'w-full sm:w-fit pointer-events-auto px-2 sm:px-0',
    !isInline && 'max-w-full'
  );

  return (
    <Wrapper className={wrapperClass}>
      <div className={cn('flex items-center gap-4 select-none relative w-full', 'justify-center')}>
        {/* Pool Director Mode Indicator */}
        {isSurpriseMeMode && (
          <div className="absolute -top-5 left-1/2 -translate-x-1/2 flex items-center gap-1.5 animate-fade-in">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-cyan animate-pool-dot-breathe inline-block" />
            <span className="text-[10px] font-mono font-bold text-brand-cyan tracking-[0.15em] uppercase whitespace-nowrap">
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
            t('mockup.surpriseMe') || 'Surprise Me',
            'surpriseMe'
          )}
        </div>

        {!isSurpriseMeMode && (
          <>
            {/* Divider */}
            <div className="w-[1px] h-10 bg-white/5 mx-1" />

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
                  t('mockup.outputsShort') || 'Gerar'
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
                    t('mockup.promptShort') || 'Prompt'
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
                    t('mockup.outputsShort') || 'Gerar'
                  )}
                </>
              )}
            </div>
          </>
        )}

        {/* Uploaded image thumb - only in collapsed (pool) mode */}
        {!isInline && isSurpriseMeMode && thumbSrc && (
          <div
            className="w-14 h-14 shrink-0 rounded-xl border border-white/10 overflow-hidden bg-neutral-900/50"
            role="img"
            aria-label={t('mockup.uploadedDesignAlt') || 'Design enviado'}
          >
            <img src={thumbSrc} alt="" className="w-full h-full object-cover" />
          </div>
        )}
      </div>
    </Wrapper>
  );
};
