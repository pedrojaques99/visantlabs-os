import React from 'react';
import { Button } from '@/components/ui/button';
import { Dices } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/hooks/useTranslation';
import { useTheme } from '@/hooks/useTheme';
import { GeminiModel, Resolution } from '@/types/types';
import { getCreditsRequired } from '@/utils/creditCalculator';

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
    showBackground = false
}) => {
    const { t } = useTranslation();
    const { theme } = useTheme();

    return (
        <div className={cn(
            "flex items-center gap-3 w-full justify-center", // Added justify-center to center content if container is wide
            showBackground && `h-full rounded-xl p-4 md:p-5 transition-all duration-200 ${theme === 'dark' ? 'bg-neutral-900/80' : 'bg-neutral-50/50'}`,
            containerClassName
        )}>
            <div className={cn("flex items-center gap-5", showBackground && "px-8 py-5 rounded-lg justify-center")}>
                <Button
                    onClick={() => onSurpriseMe(autoGenerate)}
                    disabled={isGeneratingPrompt}
                    variant="sidebarAction"
                    size="icon"
                    className={cn(
                        "w-16 h-16 flex-shrink-0 rounded-lg border shadow-sm transition-all duration-300", // Increased size to match top design (w-16 h-16)
                        isDiceAnimating && 'dice-button-clicked',
                        isSurpriseMeMode
                            ? "bg-brand-cyan/20 border-brand-cyan/50 text-brand-cyan hover:bg-brand-cyan/30 shadow-brand-cyan/20"
                            : theme === 'dark'
                                ? "bg-neutral-800/80 border-neutral-700 hover:border-neutral-500 text-neutral-300 hover:text-white shadow-black/30"
                                : "bg-white border-neutral-300 hover:border-neutral-400 text-neutral-700 hover:text-neutral-900 shadow-neutral-200/50"
                    )}
                    aria-label={t('mockup.surpriseMe')}
                    title={isSurpriseMeMode ? t('mockup.surpriseMeModeActiveTooltip') : t('mockup.surpriseMeTooltip')}
                >
                    <div className={cn("transition-transform duration-700 ease-out", isDiceAnimating && "rotate-[360deg]")}>
                        <Dices size={28} />
                    </div>
                </Button>

                <div className="flex flex-col gap-3 min-w-[140px] select-none">
                    {/* Auto Generate Toggle */}
                    <div
                        className="flex items-center gap-3 cursor-pointer group"
                        onClick={() => setAutoGenerate(!autoGenerate)}
                    >
                        <div className={cn(
                            "w-4 h-4 rounded-[4px] border flex items-center justify-center transition-all duration-200", // Slightly larger checkbox
                            autoGenerate
                                ? "bg-brand-cyan border-brand-cyan text-black"
                                : theme === 'dark'
                                    ? "bg-neutral-800 border-neutral-600 group-hover:border-neutral-500"
                                    : "bg-white border-neutral-300 group-hover:border-neutral-400"
                        )}>
                            {autoGenerate && (
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                            )}
                        </div>
                        <span className={cn(
                            "text-[10px] uppercase tracking-widest font-mono transition-colors",
                            theme === 'dark' ? "text-neutral-400 group-hover:text-neutral-200" : "text-neutral-600 group-hover:text-neutral-800"
                        )}>
                            {t('mockup.autoGenerate')}
                            {autoGenerate && selectedModel && (
                                <span className="ml-1 opacity-70">
                                    ({mockupCount * getCreditsRequired(selectedModel, resolution)} 💎)
                                </span>
                            )}
                        </span>
                    </div>

                    {/* Director Mode Toggle */}
                    <div
                        className="flex items-center gap-3 cursor-pointer group"
                        onClick={() => setIsSurpriseMeMode(!isSurpriseMeMode)}
                    >
                        <div className={cn(
                            "w-4 h-4 rounded-[4px] border flex items-center justify-center transition-all duration-200",
                            isSurpriseMeMode
                                ? "bg-brand-cyan border-brand-cyan text-black"
                                : theme === 'dark'
                                    ? "bg-neutral-800 border-neutral-600 group-hover:border-neutral-500"
                                    : "bg-white border-neutral-300 group-hover:border-neutral-400"
                        )}>
                            {isSurpriseMeMode && (
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                            )}
                        </div>
                        <span className={cn(
                            "text-[10px] uppercase tracking-widest font-mono transition-colors",
                            theme === 'dark' ? "text-neutral-400 group-hover:text-neutral-200" : "text-neutral-600 group-hover:text-neutral-800"
                        )}>
                            {t('mockup.surpriseMeMode')}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};
