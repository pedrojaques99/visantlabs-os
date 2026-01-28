import React from 'react';
import { Button } from '@/components/ui/button';
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

const iconBtnBase =
    'w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 flex-shrink-0 rounded-lg border shadow-sm transition-all duration-300';
const iconBtnNeutral = (dark: boolean) =>
    dark
        ? 'bg-neutral-800/80 border-neutral-700 hover:border-neutral-500 text-neutral-300 hover:text-white shadow-black/30'
        : 'bg-white border-neutral-300 hover:border-neutral-400 text-neutral-700 hover:text-neutral-900 shadow-neutral-200/50';
const iconBtnCyan =
    'bg-brand-cyan/20 border-brand-cyan/50 text-brand-cyan hover:bg-brand-cyan/30 shadow-brand-cyan/20';
const labelMono = (dark: boolean) =>
    cn(
        'text-[10px] font-mono tracking-wide opacity-60',
        dark ? 'text-neutral-400' : 'text-neutral-500'
    );
const hoverLabel = (dark: boolean, hasBadge: boolean = false) =>
    cn(
        'absolute left-1/2 -translate-x-1/2 text-[8px] font-mono uppercase tracking-wider whitespace-nowrap transition-all duration-200',
        hasBadge ? 'bottom-6' : 'bottom-1',
        'opacity-0 group-hover:opacity-50 pointer-events-none',
        dark ? 'text-neutral-300' : 'text-neutral-600'
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

    const wrap = (child: React.ReactNode, tooltip: string) => (
        <Tooltip content={tooltip} position="top">
            {child}
        </Tooltip>
    );

    return (
        <div
            className={cn(
                'w-full',
                showBackground && `rounded-xl p-4 md:p-5 transition-all duration-200 ${dark ? 'bg-neutral-900/80' : 'bg-neutral-50/50'}`,
                containerClassName
            )}
        >
            <div
                className="flex flex-nowrap items-center gap-3 sm:gap-4 justify-center w-full select-none py-2"
                style={{ width: '100%' }}
            >
                {showGenerateButtons && onGeneratePrompt &&
                    wrap(
                        <Button
                            type="button"
                            onClick={onGeneratePrompt}
                            disabled={promptDisabled}
                            variant="sidebarAction"
                            size="icon"
                            className={cn(iconBtnBase, iconBtnNeutral(dark), 'group relative')}
                            aria-label={t('mockup.generatePrompt')}
                        >
                            <PenLine size={24} />
                            <span className={hoverLabel(dark)}>{t('mockup.generatePrompt')}</span>
                        </Button>,
                        promptTooltip()
                    )}

                {showGenerateButtons && onGenerateOutputs && isPromptReady &&
                    wrap(
                        <Button
                            type="button"
                            onClick={onGenerateOutputs}
                            disabled={outputsDisabled}
                            variant="sidebarAction"
                            size="icon"
                            className={cn(iconBtnBase, 'relative group', iconBtnCyan)}
                            aria-label={t('mockup.generateOutputs')}
                        >
                            <Pickaxe size={24} />
                            {creditsOutputs > 0 && (
                                <Badge
                                    variant="outline"
                                    className={cn(
                                        'absolute bottom-1 left-1/2 -translate-x-1/2 rounded-full px-1.5 py-0 text-[9px] font-mono leading-none border shrink-0 bg-transparent border-0 border-none border-transparent',
                                        dark ? 'text-neutral-300' : 'text-neutral-600'
                                    )}
                                >
                                    {creditsOutputs} 💎
                                </Badge>
                            )}
                            <span className={hoverLabel(dark, creditsOutputs > 0)}>{t('mockup.generateOutputs')}</span>
                        </Button>,
                        outputsTooltip()
                    )}

                {wrap(
                    <Button
                        type="button"
                        onClick={() => onSurpriseMe(autoGenerate)}
                        disabled={isGeneratingPrompt}
                        variant="sidebarAction"
                        size="icon"
                        className={cn(
                            iconBtnBase,
                            'relative group',
                            isDiceAnimating && 'dice-button-clicked',
                            isSurpriseMeMode ? iconBtnCyan : iconBtnNeutral(dark)
                        )}
                        aria-label={t('mockup.surpriseMe')}
                    >
                        <div
                            className={cn(
                                'transition-transform duration-700 ease-out',
                                isDiceAnimating && 'rotate-[360deg]'
                            )}
                        >
                            <Dices size={24} />
                        </div>
                        {autoGenerate && creditsSurpriseMe > 0 && (
                            <Badge
                                variant="outline"
                                className={cn(
                                    'absolute bottom-1 left-1/2 -translate-x-1/2 rounded-full px-1.5 py-0 text-[9px] font-mono leading-none border shrink-0 bg-transparent border-0 border-none border-transparent',
                                    dark ? 'text-neutral-300' : 'text-neutral-600'
                                )}
                            >
                                {creditsSurpriseMe} 💎
                            </Badge>
                        )}
                        <span className={hoverLabel(dark, autoGenerate && creditsSurpriseMe > 0)}>{t('mockup.floatingSurpriseMe')}</span>
                    </Button>,
                    surpriseTooltip()
                )}

                <div className="flex flex-col gap-2 min-w-[140px] sm:min-w-[160px]">
                    <ToggleRow checked={autoGenerate} onClick={() => setAutoGenerate(!autoGenerate)} label={t('mockup.autoGenerate')} dark={dark} tooltip={t('mockup.autoGenerateTooltip')} />
                    <ToggleRow checked={isSurpriseMeMode} onClick={() => setIsSurpriseMeMode(!isSurpriseMeMode)} label={t('mockup.surpriseMeMode')} dark={dark} />
                </div>
            </div>
        </div>
    );
};
