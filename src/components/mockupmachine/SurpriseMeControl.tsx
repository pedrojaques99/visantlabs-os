import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Dices, PenLine, Pickaxe, Check, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/hooks/useTranslation';
import { useTheme } from '@/hooks/useTheme';
import { GeminiModel, Resolution } from '@/types/types';
import { getCreditsRequired } from '@/utils/creditCalculator';
import { Tooltip } from '@/components/ui/Tooltip';
import { GlitchLoader } from '@/components/ui/GlitchLoader';

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
        'w-4 h-4 rounded-md border flex items-center justify-center transition-all duration-200',
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
        const isPrompt = label === t('mockup.promptShort');
        const isGenerate = label === t('mockup.outputsShort');
        const isPrimarySurprise = variant === 'surpriseMe';
        const isPrimaryAction = isPrimarySurprise || isGenerate;

        const buttonContent = (
            <button
                type="button"
                onClick={onClick}
                disabled={disabled}
                className={cn(
                    'relative flex items-center justify-center rounded-xl border transition-all duration-300 font-bold',
                    'focus:outline-none focus:ring-2 focus:ring-brand-cyan/50',
                    'h-14 backdrop-blur-md',
                    label ? 'flex-row px-5 gap-2.5' : 'w-14 items-center justify-center',
                    variant === 'surpriseMe' && label && 'min-w-[140px]',

                    // White state (for Prompt) - Modern subtle shadow
                    !disabled && isPrompt
                        ? 'bg-white border-white text-black shadow-[0_8px_30px_rgb(0,0,0,0.12)] hover:scale-[1.02] active:scale-[0.98] hover:bg-white/90'

                        : // Active state (Non-primary)
                        !disabled && isActive
                            ? 'bg-brand-cyan/20 border-brand-cyan/40 text-brand-cyan shadow-[0_0_20px_rgba(var(--brand-cyan-rgb),0.2)]'

                            : // Primary state (Brand Cyan) - Vivid shadow
                            !disabled && isPrimaryAction
                                ? cn(
                                    'text-black shadow-[0_8px_30px_rgba(var(--brand-cyan-rgb),0.25)] hover:scale-[1.02] active:scale-[0.98] font-black',
                                    isPrimarySurprise
                                        ? 'bg-gradient-to-br from-brand-cyan to-foreground border-brand-cyan/50 hover:opacity-90'
                                        : 'bg-brand-cyan border-brand-cyan/50 hover:bg-brand-cyan/90',
                                    isPrimarySurprise && isActive && 'ring-2 ring-brand-cyan ring-offset-2 ring-offset-black'
                                )

                                : // Secondary/Default state (Glass) - Subtle shadow
                                isLight
                                    ? 'bg-neutral-100/80 border-neutral-300/50 hover:bg-neutral-200/50 hover:border-neutral-400/50 text-neutral-600 shadow-sm'
                                    : 'bg-neutral-900/80 border-neutral-800/50 hover:bg-neutral-800/60 hover:border-neutral-700/50 text-neutral-400 shadow-sm',

                    disabled && 'opacity-40 cursor-not-allowed grayscale-[0.8] border-white/5 bg-neutral-950/20'
                )}
            >
                <div className={cn(
                    "flex items-center justify-center flex-shrink-0 transition-colors",
                    !disabled && (isPrimaryAction || isPrompt || isActive) ? "text-black" : "group-hover:text-white"
                )}>
                    {icon}
                </div>
                {label && (
                    <span className={cn(
                        'text-[11px] font-mono uppercase tracking-[0.12em] whitespace-nowrap text-center leading-tight transition-colors font-bold',
                        !disabled && (isPrimaryAction || isPrompt || isActive) ? 'text-black' : (dark ? 'text-neutral-400' : 'text-neutral-600')
                    )}>
                        {label}
                    </span>
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

    // Check if tags are selected to enable the button
    const hasTagsSelected = !isGenerateDisabled;

    // State for local settings menu
    const [showSettings, setShowSettings] = React.useState(false);

    return (
        <div
            className={cn(
                'w-fit bg-transparent transition-all duration-500',
                showBackground && !isFixedBottom && `pt-4`,
                showBackground && !isFixedBottom && 'px-5 md:px-6',
                showBackground && isFixedBottom && 'pt-4 !pb-4 px-4 md:px-5 rounded-t-xl',
                isSurpriseMeMode && 'drop-shadow-[0_0_15px_rgba(var(--brand-cyan-rgb),0.3)]',
                containerClassName
            )}
        >
            <div
                className={cn(
                    "flex flex-nowrap items-center gap-2 justify-center select-none bg-transparent relative",
                    isFixedBottom ? 'pt-2 pb-3' : 'pt-2 pb-3'
                )}
            >
                {/* 1. SURPRISE ME BUTTON - Now separated again */}
                <div className="flex items-center gap-1.5">
                    {renderButton(
                        () => onSurpriseMe(autoGenerate),
                        isGeneratingPrompt || isGeneratingOutputs || isDiceAnimating,
                        <Dices size={20} className={cn("transition-transform duration-700", isDiceAnimating && "rotate-[360deg]")} />,
                        isSurpriseMeMode,
                        surpriseTooltip(),
                        autoGenerate && creditsSurpriseMe > 0 && (
                            <div className="absolute -top-1.5 -right-1.5 z-20 animate-in zoom-in duration-300">
                                <Badge
                                    variant="outline"
                                    className="rounded-full px-1.5 py-0.5 text-[8px] font-mono leading-none border-white/10 bg-neutral-900 text-neutral-300 shadow-xl"
                                >
                                    {creditsSurpriseMe} 💎
                                </Badge>
                            </div>
                        ),
                        undefined,
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
                                /* Unified GENERATE Button (when autoGenerate is true) */
                                renderButton(
                                    isPromptReady ? (onGenerateOutputs || (() => { })) : (onGeneratePrompt || (() => { })),
                                    isPromptReady ? outputsDisabled : promptDisabled,
                                    isGeneratingPrompt || isGeneratingOutputs ? (
                                        <GlitchLoader size={16} color={isPromptReady ? "black" : (dark ? "white" : "black")} />
                                    ) : (
                                        isPromptReady ? <Pickaxe size={18} /> : <PenLine size={18} />
                                    ),
                                    !!isPromptReady,
                                    isPromptReady ? outputsTooltip() : promptTooltip(),
                                    isPromptReady && creditsOutputs > 0 && (
                                        <div className="absolute -top-1.5 -right-1.5 z-20 animate-in zoom-in duration-300">
                                            <Badge
                                                variant="outline"
                                                className="rounded-full px-1.5 py-0.5 text-[8px] font-mono leading-none border-white/10 bg-neutral-900 text-neutral-300 shadow-xl"
                                            >
                                                {creditsOutputs} 💎
                                            </Badge>
                                        </div>
                                    ),
                                    t('mockup.outputsShort') || "Gerar"
                                )
                            ) : (
                                /* Separate Buttons (when autoGenerate is false) */
                                <>
                                    {/* Generate Prompt Button */}
                                    {renderButton(
                                        onGeneratePrompt || (() => { }),
                                        promptDisabled,
                                        isGeneratingPrompt ? (
                                            <GlitchLoader size={16} color={isPromptReady ? "black" : (dark ? "white" : "black")} />
                                        ) : (
                                            <PenLine size={18} />
                                        ),
                                        !!isPromptReady,
                                        promptTooltip(),
                                        null,
                                        t('mockup.promptShort') || "Prompt"
                                    )}

                                    {/* Generate Results Button */}
                                    {renderButton(
                                        onGenerateOutputs || (() => { }),
                                        outputsDisabled,
                                        isGeneratingOutputs ? (
                                            <GlitchLoader size={16} color={dark ? "white" : "black"} />
                                        ) : (
                                            <Pickaxe size={18} />
                                        ),
                                        false,
                                        outputsTooltip(),
                                        creditsOutputs > 0 && (
                                            <div className="absolute -top-1.5 -right-1.5 z-20 animate-in zoom-in duration-300">
                                                <Badge
                                                    variant="outline"
                                                    className="rounded-full px-1.5 py-0.5 text-[8px] font-mono leading-none border-white/10 bg-neutral-900 text-neutral-300 shadow-xl"
                                                >
                                                    {creditsOutputs} 💎
                                                </Badge>
                                            </div>
                                        ),
                                        t('mockup.outputsShort') || "Gerar"
                                    )}
                                </>
                            )}
                        </div>
                    </>
                )}

                {/* Settings Toggle Button */}
                <div className="relative ml-1">
                    <Tooltip content={t('mockup.aiSettings') || "Configurações de geração"} position="top">
                        <button
                            onClick={() => setShowSettings(!showSettings)}
                            className={cn(
                                "flex items-center justify-center w-14 h-14 rounded-xl border transition-all duration-200",
                                showSettings
                                    ? "bg-brand-cyan/20 border-brand-cyan/40 text-brand-cyan"
                                    : "bg-neutral-900/50 border-white/5 text-neutral-500 hover:bg-neutral-800 hover:text-neutral-300"
                            )}
                        >
                            <Settings size={20} className={cn("transition-transform duration-500", showSettings && "rotate-90")} />
                        </button>
                    </Tooltip>

                    {/* Settings Feedback/Menu Overlay */}
                    {showSettings && (
                        <div className="absolute bottom-full right-0 mb-3 w-64 p-4 rounded-md bg-neutral-900/95 border border-white/10 backdrop-blur-xl shadow-2xl animate-in fade-in slide-in-from-bottom-2 duration-200 z-50">
                            <div className="space-y-4">
                                <div className="space-y-1 pb-2 border-b border-white/5">
                                    <h5 className="text-[10px] font-mono uppercase tracking-widest text-neutral-500 font-bold">
                                        {t('mockup.aiSettings') || 'Ajustes de IA'}
                                    </h5>
                                </div>

                                <ToggleRow
                                    checked={autoGenerate}
                                    onClick={() => setAutoGenerate(!autoGenerate)}
                                    label={t('mockup.autoGenerateLabel') || 'Auto-Gerar Mockups'}
                                    dark={dark}
                                    tooltip={t('mockup.autoGenerateDescription') || 'Gera automaticamente após criar o prompt'}
                                />

                                <ToggleRow
                                    checked={isSurpriseMeMode}
                                    onClick={() => setIsSurpriseMeMode(!isSurpriseMeMode)}
                                    label={t('mockup.directorModeLabel') || 'Modo Diretor'}
                                    dark={dark}
                                    tooltip={t('mockup.directorModeDescription') || 'Selecione e defina quais tags poderão ser escolhidas ao gerar'}
                                />

                                <div className="pt-2 text-[9px] font-mono text-neutral-600 leading-tight">
                                    {autoGenerate
                                        ? (t('mockup.autoGenerateActive') || 'Imagens serão geradas instantaneamente.')
                                        : (t('mockup.autoGenerateInactive') || 'Gera apenas o prompt para sua revisão.')}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
