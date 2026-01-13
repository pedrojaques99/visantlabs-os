import React from 'react';
import { Menu, Wand2, Dices } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/hooks/useTranslation';
import { cn } from '@/lib/utils';

interface FloatingActionButtonsProps {
    isVisible: boolean;
    onSurpriseMe: () => void;
    isGeneratingPrompt: boolean;
    isGenerating: boolean;
    hasAnalyzed: boolean;
}

export const FloatingActionButtons: React.FC<FloatingActionButtonsProps> = ({
    isVisible,
    onSurpriseMe,
    isGeneratingPrompt,
    isGenerating,
    hasAnalyzed,
}) => {
    const { t } = useTranslation();

    if (!isVisible) return null;

    const isDisabled = isGenerating || isGeneratingPrompt;

    return (
        <div
            className={cn(
                'fixed bottom-6 right-6 z-50 flex gap-2 lg:hidden',
                'animate-in fade-in slide-in-from-bottom-4 duration-300'
            )}
        >
            {/* Surprise Me Button - Only show after analysis */}
            {hasAnalyzed && (
                <Button
                    onClick={onSurpriseMe}
                    disabled={isDisabled}
                    variant="default"
                    size="lg"
                    className="h-14 px-4 bg-brand-cyan hover:bg-brand-cyan/90 text-black font-semibold shadow-lg hover:shadow-xl transition-all disabled:opacity-50"
                    aria-label={t('mockup.floatingSurpriseMe')}
                    title={t('mockup.surpriseMeTooltip')}
                >
                    <Dices size={20} />
                    <span className="ml-2 hidden sm:inline">{t('mockup.floatingSurpriseMe')}</span>
                </Button>
            )}
        </div>
    );
};
