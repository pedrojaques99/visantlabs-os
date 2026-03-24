import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Select } from '@/components/ui/select';
import { Dices, PenLine, Pickaxe, Check, Settings, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/hooks/useTranslation';
import { useTheme } from '@/hooks/useTheme';
import type { GeminiModel, Resolution, ImageProvider, UploadedImage, AspectRatio } from '@/types/types';
import { isSafeUrl } from '@/utils/imageUtils';
import { getCreditsRequired } from '@/utils/creditCalculator';
import { Tooltip } from '@/components/ui/Tooltip';
import { GlitchLoader } from '@/components/ui/GlitchLoader';
import type { ComponentProps } from 'react';
import { GEMINI_MODELS } from '@/constants/geminiModels';
import { MicroTitle } from '../ui/MicroTitle';
import { GlassPanel } from '../ui/GlassPanel';
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'


interface SurpriseMeControlProps {
    onSurpriseMe: (autoGenerate: boolean) => void;
    isGeneratingPrompt: boolean;
    isDiceAnimating: boolean;
    isSurpriseMeMode: boolean;
    setIsSurpriseMeMode: (value: boolean) => void;
    autoGenerate: boolean;
    setAutoGenerate: (value: boolean) => void;
    selectedModel: GeminiModel | null;
    setSelectedModel: (model: GeminiModel | null) => void;
    imageProvider?: ImageProvider;
    setImageProvider?: (provider: ImageProvider) => void;
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
    variant?: 'inline' | 'sticky';
    /** Thumbnail of uploaded design - shown in collapsed (pool) mode */
    uploadedImage?: UploadedImage | null;
    setMockupCount?: (count: number) => void;
    setResolution?: (resolution: Resolution) => void;
    aspectRatio?: AspectRatio;
    setAspectRatio?: (ratio: AspectRatio) => void;
}

const buttonLabel = (dark: boolean, isActive?: boolean) =>
    cn(
        'text-[10px] font-mono uppercase  whitespace-nowrap text-center leading-tight',
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
    setSelectedModel,
    imageProvider,
    setImageProvider,
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
    variant = 'sticky',
    uploadedImage = null,
    setMockupCount,
    setResolution,
    aspectRatio,
    setAspectRatio,
}) => {
    const { t } = useTranslation();
    const { theme } = useTheme();
    const dark = theme === 'dark';

    const promptDisabled = !!(isGeneratingPrompt || isGenerateDisabled);
    const outputsDisabled = !!(isGeneratingPrompt || isGeneratingOutputs || isGenerateDisabled || !isPromptReady);
    const creditsOutputs =
        selectedModel && isPromptReady ? mockupCount * getCreditsRequired(selectedModel, resolution, imageProvider) : 0;
    const creditsSurpriseMe = selectedModel ? mockupCount * getCreditsRequired(selectedModel, resolution, imageProvider) : 0;

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
        if (!isPromptReady && !autoGenerate) return t('mockup.generatePromptFirst') || 'Gere um prompt primeiro.';
        if (!isPromptReady && autoGenerate) return t('mockup.generateAll') || 'Gere o prompt e as imagens em um clique.';
        return t('messages.selectDesignTypeFirst') || t('messages.completeSteps') || t('mockup.insufficientCredits') || 'Conclua o setup ou verifique créditos.';
    };
    const surpriseTooltip = () => {
        const base = isSurpriseMeMode ? t('mockup.surpriseMeModeActiveTooltip') : t('mockup.surpriseMeTooltip');
        // Only show credits cost if autoGenerate is enabled (will generate images)
        if (autoGenerate && creditsSurpriseMe > 0)
            return `${base} — ${creditsSurpriseMe} ${creditsSurpriseMe === 1 ? t('mockup.creditUnitSingular') : t('mockup.creditUnitPlural')}`;
        return base;
    };

    const isInline = variant === 'inline';
    const isFixedBottom = containerClassName?.includes('rounded-b-none');
    const isLight = !dark;

    const thumbSrc = uploadedImage
        ? (uploadedImage.url || (uploadedImage.base64 && isSafeUrl(`data:${uploadedImage.mimeType};base64,${uploadedImage.base64}`) ? `data:${uploadedImage.mimeType};base64,${uploadedImage.base64}` : ''))
        : '';

    const renderButton = (
        onClick: () => void,
        disabled: boolean,
        icon: React.ReactNode,
        isActive: boolean,
        tooltip: string,
        creditsCount?: number,
        label?: string,
        variant?: 'default' | 'generatePrompt' | 'surpriseMe'
    ) => {
        const isPrompt = label === t('mockup.promptShort');
        const isGenerate = label === t('mockup.outputsShort');
        const isPrimarySurprise = variant === 'surpriseMe';
        const isPrimaryAction = isPrimarySurprise || isGenerate;

        const buttonContent = (
            <Button
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

                        : // Primary state (Brand Cyan) - Vivid shadow
                        !disabled && isPrimaryAction
                            ? cn(
                                'text-black',
                                'shadow-[0_8px_30px_rgba(var(--brand-cyan-rgb),0.25)] hover:scale-[1.02] active:scale-[0.98] font-black',
                                isPrimarySurprise
                                    ? 'bg-brand-cyan border-brand-cyan/50 hover:bg-brand-cyan/90'
                                    : 'bg-brand-cyan border-brand-cyan/50 hover:bg-brand-cyan/90',
                                isPrimarySurprise && isActive && 'ring-2 ring-brand-cyan ring-offset-2 ring-offset-black'
                            )

                            : // Active state (Non-primary)
                            !disabled && isActive
                                ? 'bg-brand-cyan/20 border-brand-cyan/40 text-brand-cyan shadow-[0_0_20px_rgba(var(--brand-cyan-rgb),0.2)]'

                                : // Secondary/Default state (Glass) - Subtle shadow
                                isLight
                                    ? 'bg-neutral-100/80 border-neutral-300/50 hover:bg-neutral-200/50 hover:border-neutral-400/50 text-neutral-600 shadow-sm'
                                    : 'bg-neutral-900/80 border-neutral-800/50 hover:bg-neutral-800/60 hover:border-neutral-700/50 text-neutral-400 shadow-sm',

                    disabled && 'opacity-300 cursor-not-allowed grayscale-[0.8] border-white/5 bg-neutral-950/20'
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
                        'flex items-center gap-1.5 text-xs font-mono uppercase tracking-[0.12em] whitespace-nowrap text-center leading-tight transition-colors font-bold',
                        !disabled && (isPrimaryAction || isPrompt || isActive) ? 'text-black' : (dark ? 'text-neutral-400' : 'text-neutral-600')
                    )}>
                        {label}
                        {creditsCount != null && creditsCount > 0 && (
                            <span className="text-[11px] font-semibold opacity-90">
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

    // Check if tags are selected to enable the button
    const hasTagsSelected = !isGenerateDisabled;

    // State for local settings menu
    const [showSettings, setShowSettings] = React.useState(false);
    return (
        <GlassPanel
            className={cn(
                'transition-all duration-300 origin-center flex flex-col items-center mx-auto',
                'scale-80 md:scale-100 pointer-events-auto',
                isInline ? 'w-full bg-transparent border-0 shadow-none backdrop-blur-0' : 'w-fit max-w-full'
            )}
        >
            <div
                className={cn(
                    "flex items-center gap-2 select-none relative w-full",
                    isInline ? 'justify-center text-center' : 'justify-between'
                )}
            >
                {/* Pool Director Mode Indicator */}
                {isSurpriseMeMode && (
                    <div className="absolute -top-5 left-1/2 -translate-x-1/2 flex items-center gap-1.5 animate-fade-in">
                        <span className="h-1.5 w-1.5 rounded-full bg-brand-cyan animate-pool-dot-breathe inline-block" />
                        <span className="text-[9px] font-mono font-bold text-brand-cyan tracking-[0.15em] uppercase whitespace-nowrap">
                            {t('mockup.surpriseMeModeActiveTooltip')}
                        </span>
                    </div>
                )}

                {/* 1. SURPRISE ME BUTTON */}
                <div className="flex items-center gap-1.5">
                    {renderButton(
                        () => onSurpriseMe(autoGenerate),
                        isGeneratingPrompt || isGeneratingOutputs || isDiceAnimating,
                        <Dices size={20} className={cn("transition-transform duration-700", isDiceAnimating && "rotate-[360deg]")} />,
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
                                /* Unified GENERATE Button (when autoGenerate is true) */
                                renderButton(
                                    (isPromptReady || autoGenerate) ? (onGenerateOutputs || (() => { })) : (onGeneratePrompt || (() => { })),
                                    isPromptReady ? outputsDisabled : promptDisabled,
                                    isGeneratingPrompt || isGeneratingOutputs ? (
                                        <GlitchLoader size={16} color={isPromptReady ? "black" : (dark ? "white" : "black")} />
                                    ) : (
                                        isPromptReady ? <Pickaxe size={18} /> : <PenLine size={18} />
                                    ),
                                    !!isPromptReady,
                                    isPromptReady ? outputsTooltip() : promptTooltip(),
                                    isPromptReady ? creditsOutputs : 0,
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
                                        undefined,
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
                                        creditsOutputs,
                                        t('mockup.outputsShort') || "Gerar"
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

                {/* Settings Toggle Button - hidden in inline mode */}
                {!isInline && <div className="relative ml-1">
                    <Tooltip content={t('mockup.aiSettings') || "Configurações de geração"} position="top">
                        <Button variant="ghost" onClick={() => setShowSettings(!showSettings)}
                            className={cn(
                                "flex items-center justify-center w-14 h-14 rounded-xl border transition-all duration-200",
                                showSettings
                                    ? "bg-brand-cyan/20 border-brand-cyan/40 text-brand-cyan"
                                    : "bg-neutral-900/50 border-white/5 text-neutral-500 hover:bg-neutral-800 hover:text-neutral-300"
                            )}
                        >
                            <Settings size={20} className={cn("transition-transform duration-300", showSettings && "rotate-90")} />
                        </Button>
                    </Tooltip>

                    {/* Settings Feedback/Menu Overlay */}
                    {showSettings && (
                        <div className="absolute bottom-full right-0 mb-3 w-72 p-4 rounded-xl bg-neutral-900/95 border border-white/10 backdrop-blur-xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] animate-in fade-in slide-in-from-bottom-2 duration-200 z-[110]">
                            <div className="space-y-5">
                                <div className="space-y-3 pb-4 border-b border-white/5">
                                    <div className="flex items-center justify-between">
                                        <MicroTitle as="h5" className="font-bold flex items-center gap-2">
                                            <Sparkles size={12} className="text-brand-cyan" />
                                            {t('mockup.aiSettings') || 'MODELO & AJUSTES'}
                                        </MicroTitle>
                                        {selectedModel && (
                                            <Badge variant="outline" className="text-[9px] h-5 px-1.5 border-white/10 text-neutral-400 font-mono">
                                                {getCreditsRequired(selectedModel, resolution)} 💎 / img
                                            </Badge>
                                        )}
                                    </div>

                                    <div className="space-y-1">
                                        <MicroTitle as="span" className="text-[9px] ml-1">Modelo de IA</MicroTitle>
                                        <Select
                                            value={imageProvider === 'seedream' ? 'seedream-4.5' : 'gemini-pro'}
                                            onChange={(val) => {
                                                if (val === 'seedream-4.5') {
                                                    if (setImageProvider) setImageProvider('seedream');
                                                } else {
                                                    if (setImageProvider) setImageProvider('gemini');
                                                    if (setSelectedModel) setSelectedModel(GEMINI_MODELS.PRO);
                                                }
                                            }}
                                            options={[
                                                { value: 'gemini-pro', label: 'Gemini Pro' },
                                                { value: 'seedream-4.5', label: 'Seedream 4.5' }
                                            ]}
                                            className="w-full bg-black/40 border-white/10 text-[11px]"
                                            variant="default"
                                            loading={isGeneratingPrompt || isGeneratingOutputs}
                                        />
                                    </div>

                                    {setResolution && (
                                        <div className="space-y-1">
                                            <MicroTitle as="span" className="text-[9px] ml-1">Resolução / Qualidade</MicroTitle>
                                            <div className="flex gap-1.5 h-[32px]">
                                                {(imageProvider === 'gemini' ? ['HD', '1K', '2K', '4K'] : ['2K', '4K']).map((res) => (
                                                    <Button variant="ghost" key={res}
                                                        onClick={() => setResolution(res as Resolution)}
                                                        className={cn(
                                                            "flex-1 text-[10px] font-mono rounded border transition-all",
                                                            resolution === res ? "bg-brand-cyan/20 text-brand-cyan border-brand-cyan/40" : "bg-neutral-800/30 text-neutral-500 border-neutral-700/50 hover:border-neutral-600 hover:text-neutral-300"
                                                        )}
                                                    >
                                                        {res}
                                                    </Button>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {setMockupCount && (
                                        <div className="space-y-1">
                                            <MicroTitle as="span" className="text-[9px] ml-1">Nº Imagens (Outputs)</MicroTitle>
                                            <div className="relative flex items-center">
                                                <Input
                                                    type="number"
                                                    min={1}
                                                    max={4}
                                                    value={mockupCount}
                                                    onChange={(e) => setMockupCount(Math.min(Math.max(parseInt(e.target.value) || 1, 1), 4))}
                                                    className="w-full h-[32px] pl-2 pr-6 bg-neutral-800/50 border border-neutral-700/50 rounded text-xs font-mono text-neutral-200 focus:outline-none focus:border-brand-cyan/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                />
                                                <div className="absolute right-1 flex flex-col h-[80%] my-auto justify-center space-y-[1px] border-neutral-700/50 border-l pl-0.5">
                                                    <Button variant="ghost" type="button"
                                                        onClick={() => setMockupCount(Math.min(mockupCount + 1, 4))}
                                                        className="flex items-center justify-center p-0.5 rounded-sm hover:bg-neutral-700/50 text-neutral-500 hover:text-neutral-200 transition-colors"
                                                    >
                                                        <ChevronUp size={10} />
                                                    </Button>
                                                    <Button variant="ghost" type="button"
                                                        onClick={() => setMockupCount(Math.max(mockupCount - 1, 1))}
                                                        className="flex items-center justify-center p-0.5 rounded-sm hover:bg-neutral-700/50 text-neutral-500 hover:text-neutral-200 transition-colors"
                                                    >
                                                        <ChevronDown size={10} />
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {aspectRatio && setAspectRatio && (
                                        <div className="space-y-1">
                                            <div className="flex justify-between items-center ml-1">
                                                <MicroTitle as="span" className="text-[9px]">Proporção</MicroTitle>
                                                <span className="text-[8px] font-mono text-neutral-500">{aspectRatio}</span>
                                            </div>
                                            <div className="grid grid-cols-5 gap-1.5">
                                                {['1:1', '9:16', '16:9', '4:3', '3:4'].map(ratio => (
                                                    <Button variant="ghost" key={ratio}
                                                        onClick={() => setAspectRatio(ratio as AspectRatio)}
                                                        className={cn(
                                                            "flex flex-col items-center justify-center py-1 rounded-sm border transition-all",
                                                            aspectRatio === ratio ? "bg-brand-cyan/10 text-brand-cyan border-brand-cyan/40" : "bg-neutral-800/30 text-neutral-500 border-neutral-700/50 hover:border-neutral-600 hover:text-neutral-300"
                                                        )}
                                                    >
                                                        <span className="text-[9px] font-mono">{ratio}</span>
                                                    </Button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
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
                    )}
                </div>}
            </div>
        </GlassPanel>
    );
};
