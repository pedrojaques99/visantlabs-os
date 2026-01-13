import React, { useEffect, useMemo, useState } from 'react';
import { GlitchLoader } from './GlitchLoader';
import { useTranslation } from '@/hooks/useTranslation';
import { useTheme } from '@/hooks/useTheme';
import { getTranslations } from '@/utils/localeUtils';
import { InteractiveASCII } from './InteractiveASCII';

interface AnalyzingImageOverlayProps {
    isVisible: boolean;
}

export const AnalyzingImageOverlay: React.FC<AnalyzingImageOverlayProps> = ({ isVisible }) => {
    const { locale, t } = useTranslation();
    const { theme } = useTheme();

    const statusMessages = useMemo(() => {
        const translations = getTranslations(locale);
        return translations.mockup?.analysisStatusMessages ?? [
            'scanning colors and contrast',
            'identifying visual style',
            'detecting categories',
            'optimizing suggestions'
        ];
    }, [locale]);

    const [messageIndex, setMessageIndex] = useState(0);

    useEffect(() => {
        if (!isVisible) {
            setMessageIndex(0);
            return;
        }

        const intervalId = setInterval(() => {
            setMessageIndex((prev) => (prev + 1) % statusMessages.length);
        }, 2500);

        return () => clearInterval(intervalId);
    }, [isVisible, statusMessages]);

    if (!isVisible) return null;

    return (
        <div className={`fixed inset-0 z-50 flex items-center justify-center animate-fade-in ${theme === 'dark' ? 'bg-black/70' : 'bg-white/70'
            }`}>
            {/* Compact Retro Container */}
            <div className={`relative w-80 mx-4 animate-fade-in border-2 bg-card ${theme === 'dark' ? 'border-zinc-800/50' : 'border-zinc-300/50'
                }`}
                style={{
                    boxShadow: theme === 'dark'
                        ? '0 0 20px rgba(82, 221, 235, 0.1), inset 0 0 30px rgba(0, 0, 0, 0.3)'
                        : '0 0 20px rgba(82, 221, 235, 0.15), inset 0 0 30px rgba(255, 255, 255, 0.5)'
                }}>



                {/* ASCII Background */}
                <div className="absolute inset-0 opacity-15 pointer-events-none overflow-hidden">
                    <InteractiveASCII
                        isDarkMode={theme === 'dark'}
                        fullHeight={true}
                        className="scale-50"
                        color="#52ddeb"
                    />
                </div>

                {/* Content */}
                <div className="relative p-6 flex flex-col items-center gap-3">
                    {/* Compact Header */}
                    <div className="flex items-center gap-3">
                        <GlitchLoader size={16} />
                        <span className="text-sm font-redhatmono font-bold uppercase tracking-widest text-brand-cyan">
                            {t('mockup.analyzingImage')}
                        </span>
                    </div>

                    {/* Status Message */}
                    <div className="h-4 w-full">
                        <div
                            key={messageIndex}
                            className="text-xs font-redhatmono text-center uppercase tracking-wide animate-fade-in text-muted-foreground"
                        >
                            {statusMessages[messageIndex]}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
