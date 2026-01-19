import React from 'react';
import { Dices } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/hooks/useTranslation';
import { cn } from '@/lib/utils';

interface FloatingActionButtonsProps {
    isVisible: boolean;
    onSurpriseMe: () => void;
    isGeneratingPrompt: boolean;
    isGenerating: boolean;
    hasAnalyzed: boolean;
    /** Renders in the same container before Surpreenda-me (e.g. GERAR PROMPT) */
    generateButton?: React.ReactNode;
}

export const FloatingActionButtons: React.FC<FloatingActionButtonsProps> = ({
    isVisible,
    onSurpriseMe,
    isGeneratingPrompt,
    isGenerating,
    hasAnalyzed,
    generateButton,
}) => {
    const { t } = useTranslation();

    if (!isVisible) return null;

    const isDisabled = isGeneratingPrompt;

    return (
        <div
            className={cn(
                'fixed bottom-6 right-6 z-50 flex items-center gap-2 lg:hidden',
                'animate-in fade-in slide-in-from-bottom-4 duration-300'
            )}
        >
            {generateButton}
            {hasAnalyzed && (
                <Button
                    onClick={onSurpriseMe}
                    disabled={isDisabled}
                    variant="default"
                    className="h-12 px-4 bg-brand-cyan hover:bg-brand-cyan/90 text-black font-semibold text-sm shadow-lg hover:shadow-xl transition-all active:scale-95 disabled:opacity-50"
                    aria-label={t('mockup.floatingSurpriseMe')}
                    title={t('mockup.surpriseMeTooltip')}
                >
                    <Dices size={16} className="shrink-0" />
                    <span className="hidden sm:inline">{t('mockup.floatingSurpriseMe')}</span>
                </Button>
            )}
        </div>
    );
};
