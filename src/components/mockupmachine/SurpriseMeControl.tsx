import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Dices, PenLine, Pickaxe, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/hooks/useTranslation';
import { useTheme } from '@/hooks/useTheme';
import { GeminiModel, Resolution } from '@/types/types';
import { getCreditsRequired } from '@/utils/creditCalculator';
import { Tooltip } from '@/components/ui/Tooltip';

interface SurpriseMeControlProps {
    onSurpriseMe: (autoGenerate: boolean) => void;
    isGeneratingPrompt: boolean;
    isDiceAnimating: boolean;
    isSurpriseMeMode: boolean;
    setIsSurpriseMeMode: (value: boolean) => void;
    autoGenerate: boolean;
    setAutoGenerate: (value: boolean) => void;
    selectedModel: GeminiModel | null;
    mockupCount: number;
    resolution: Resolution;
    containerClassName?: string;
    showBackground?: boolean;
    onGeneratePrompt?: () => void;
    onGenerateOutputs?: () => void;
    isGenerateDisabled?: boolean;
    isGeneratingOutputs?: boolean;
    isPromptReady?: boolean;
    showGenerateButtons?: boolean;
}

const buttonLabel = (dark: boolean, isActive?: boolean) =>
    cn(
        'text-[10px] font-mono uppercase tracking-wider whitespace-nowrap text-center leading-tight',
        isActive ? 'text-white' : (dark ? 'text-neutral-400' : 'text-neutral-600')
    );
const toggleLabel = (dark: boolean) =>
    cn(
        'text-[10px] uppercase tracking-widest font-mono transition-colors',
        dark ? 'text-neutral-400 group-hover:text-neutral-200' : 'text-neutral-600 group-hover:text-neutral-800'
    );
const toggleBox = (checked: boolean, dark: boolean) =>
    cn(
        'w-4 h-4 rounded-[4px] border flex items-center justify-center transition-all duration-200',
        checked
            ? 'bg-brand-cyan border-brand-cyan text-black'
            : dark
              ? 'bg-neutral-800 border-neutral-600 group-hover:border-neutral-500'
              : 'bg-white border-neutral-300 group-hover:border-neutral-400'
    );

function ToggleRow({
    checked,
    onClick,
    label,
    dark,
    tooltip,
}: {
    checked: boolean;
    onClick: () => void;
    label: string;
    dark: boolean;
    tooltip?: string;
}) {
    const content = (
        <div
            className="flex items-center gap-3 cursor-pointer group"
            onClick={onClick}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
                if (e.key !== 'Enter' && e.key !== ' ') return;
                e.preventDefault();
                onClick();
            }}
            aria-pressed={checked}
        >
            <div className={toggleBox(checked, dark)}>{checked && <Check className="h-3 w-3" strokeWidth={3} />}</div>
            <span className={toggleLabel(dark)}>{label}</span>
        </div>
    );

    if (tooltip) {
        return (
            <Tooltip content={tooltip} position="top">
                {content}
            </Tooltip>
        );
    }

    return content;
}

export const SurpriseMeControl: React.FC<SurpriseMeControlProps> = ({
    onSurpriseMe,
    isGeneratingPrompt,
    isDiceAnimating,
    isSurpriseMeMode,
    setIsSurpriseMeMode,
    autoGenerate,
    setAutoGenerate,
    selectedModel,
    mockupCount,
    resolution,
    containerClassName,
    showBackground = false,
    onGeneratePrompt,
    onGenerateOutputs,
    isGenerateDisabled,
    isGeneratingOutputs,
    isPromptReady,
    showGenerateButtons = true,
}) => {
    const { t } = useTranslation();
    const { theme } = useTheme();
    const dark = theme === 'dark';

    const promptDisabled = !!(isGeneratingPrompt || isGenerateDisabled);
    const outputsDisabled = !!(isGeneratingPrompt || isGeneratingOutputs || isGenerateDisabled || !isPromptReady);
    const creditsOutputs =
        selectedModel && isPromptReady ? mockupCount * getCreditsRequired(selectedModel, resolution) : 0;
    const creditsSurpriseMe = selectedModel ? mockupCount * getCreditsRequired(selectedModel, resolution) : 0;

    const promptTooltip = () => {
        if (!promptDisabled) return t('mockup.generatePromptShortcut');
        if (isGeneratingPrompt) return t('mockup.generatingPrompt') || 'Gerando prompt...';
        return t('messages.selectDesignTypeFirst') || t('messages.completeSteps') || 'Conclua o setup antes de gerar o prompt.';
    };
    const outputsTooltip = () => {
        if (!outputsDisabled) {
            if (creditsOutputs > 0)
                return `${t('mockup.generateOutputs')} — ${creditsOutputs} ${creditsOutputs === 1 ? t('mockup.creditUnitSingular') : t('mockup.creditUnitPlural')}`;
            return t('mockup.generateOutputsShortcut');
        }
        if (isGeneratingPrompt) return t('mockup.generatingPrompt') || 'Gerando prompt...';
        if (isGeneratingOutputs) return t('mockup.generatingOutputs') || 'Gerando resultados...';
        if (!isPromptReady) return t('mockup.generatePromptFirst') || 'Gere um prompt primeiro.';
        return t('messages.selectDesignTypeFirst') || t('messages.completeSteps') || t('mockup.insufficientCredits') || 'Conclua o setup ou verifique créditos.';
    };
    const surpriseTooltip = () => {
        const base = isSurpriseMeMode ? t('mockup.surpriseMeModeActiveTooltip') : t('mockup.surpriseMeTooltip');
        // Only show credits cost if autoGenerate is enabled (will generate images)
        if (autoGenerate && creditsSurpriseMe > 0)
            return `${base} — ${creditsSurpriseMe} ${creditsSurpriseMe === 1 ? t('mockup.creditUnitSingular') : t('mockup.creditUnitPlural')}`;
        return base;
    };

    const isFixedBottom = containerClassName?.includes('rounded-b-none');
    const isLight = !dark;

    const renderButton = (
        onClick: () => void,
        disabled: boolean,
        icon: React.ReactNode,
        isActive: boolean,
        tooltip: string,
        badge?: React.ReactNode,
        label?: string,
        variant?: 'default' | 'generatePrompt' | 'surpriseMe'
    ) => {
        const buttonContent = (
            <button
                type="button"
                onClick={onClick}
                disabled={disabled}
                className={cn(
                    'relative flex items-center justify-center rounded-lg border transition-colors duration-150 font-bold hover:opacity-80',
                    'focus:outline-none focus:ring-1 focus:ring-brand-cyan/50',
                    variant === 'generatePrompt' ? 'flex-row h-14 px-4 py-2 gap-1.5' :
                    variant === 'surpriseMe' ? 'flex-row h-14 px-4 py-2 gap-1.5' :
                    label ? 'flex-col w-16 h-14 px-2.5 py-2 gap-0.5' : 'w-9 h-9',
                    'backdrop-blur-md',
                    isActive
                        ? 'bg-brand-cyan/10 border-brand-cyan/50'
                        : isLight
                          ? 'bg-neutral-100/80 border-neutral-300/50 hover:bg-neutral-200/50 hover:border-neutral-400/50'
                          : 'bg-neutral-900/80 border-neutral-800/50 hover:bg-neutral-800/60 hover:border-neutral-700/50',
                    disabled && 'opacity-50 cursor-not-allowed'
                )}
                style={{
                    color: isActive ? 'var(--brand-cyan)' : (isLight ? '#525252' : '#a3a3a3'),
                }}
                onMouseEnter={(e) => {
                    if (!disabled && !isActive) {
                        e.currentTarget.style.color = isLight ? '#171717' : '#e5e5e5';
                    }
                }}
                onMouseLeave={(e) => {
                    if (!disabled && !isActive) {
                        e.currentTarget.style.color = isLight ? '#525252' : '#a3a3a3';
                    }
                }}
            >
                <div className="flex items-center justify-center flex-shrink-0">
                    {icon}
                </div>
                {label && (
                    <span className={buttonLabel(dark, isActive)}>{label}</span>
                )}
                {badge}
            </button>
        );

        return (
            <Tooltip content={tooltip} position="top">
                {buttonContent}
            </Tooltip>
        );
    };

    return (
        <div
            className={cn(
                'w-fit bg-transparent',
                showBackground && !isFixedBottom && `pt-4 transition-all duration-200`,
                showBackground && !isFixedBottom && 'px-5 md:px-6',
                showBackground && isFixedBottom && 'pt-4 !pb-4 px-4 md:px-5 rounded-t-xl transition-all duration-200',
                containerClassName
            )}
        >
            <div
                className={cn(
                    "flex flex-nowrap items-start gap-1.5 justify-center select-none bg-transparent",
                    isFixedBottom ? 'pt-2 pb-3' : 'pt-2 pb-3'
                )}
            >
                {showGenerateButtons && onGeneratePrompt &&
                    renderButton(
                        onGeneratePrompt,
                        promptDisabled,
                        <PenLine size={16} strokeWidth={2} />,
                        false,
                        promptTooltip(),
                        undefined,
                        t('mockup.generatePrompt'),
                        'generatePrompt'
                    )
                }

                {showGenerateButtons && onGenerateOutputs && isPromptReady &&
                    renderButton(
                        onGenerateOutputs,
                        outputsDisabled,
                        <Pickaxe size={16} strokeWidth={2} />,
                        true,
                        outputsTooltip(),
                        creditsOutputs > 0 ? (
                            <Badge
                                variant="outline"
                                className={cn(
                                    'absolute -top-1 -right-1 rounded-full px-1 py-0 text-[8px] font-mono leading-none border shrink-0',
                                    dark ? 'bg-neutral-900 border-neutral-700 text-neutral-300' : 'bg-white border-neutral-300 text-neutral-700'
                                )}
                            >
                                {creditsOutputs} 💎
                            </Badge>
                        ) : undefined,
                        t('mockup.generateOutputs'),
                        'generatePrompt'
                    )
                }

                {renderButton(
                    () => onSurpriseMe(autoGenerate),
                    isGeneratingPrompt,
                    <div
                        className={cn(
                            'transition-transform duration-700 ease-out',
                            isDiceAnimating && 'rotate-[360deg]'
                        )}
                    >
                        <Dices size={16} strokeWidth={2} />
                    </div>,
                    isSurpriseMeMode,
                    surpriseTooltip(),
                    autoGenerate && creditsSurpriseMe > 0 ? (
                        <Badge
                            variant="outline"
                            className={cn(
                                'absolute -top-1 -right-1 rounded-full px-1 py-0 text-[8px] font-mono leading-none border shrink-0',
                                dark ? 'bg-neutral-900/90 border-neutral-700 text-neutral-300' : 'bg-white border-neutral-300 text-neutral-700'
                            )}
                        >
                            {creditsSurpriseMe} 💎
                        </Badge>
                    ) : undefined,
                    t('mockup.floatingSurpriseMe'),
                    'surpriseMe'
                )}

                <div className="flex flex-col gap-1.5 min-w-[120px] sm:min-w-[140px] self-stretch justify-center py-2 px-3 bg-neutral-900/90 rounded-lg">
                    <ToggleRow checked={autoGenerate} onClick={() => setAutoGenerate(!autoGenerate)} label={t('mockup.autoGenerate')} dark={dark} tooltip={t('mockup.autoGenerateTooltip')} />
                    <ToggleRow checked={isSurpriseMeMode} onClick={() => setIsSurpriseMeMode(!isSurpriseMeMode)} label={t('mockup.surpriseMeMode')} dark={dark} />
                </div>
            </div>
        </div>
    );
};
