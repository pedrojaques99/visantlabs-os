import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '@/hooks/useTranslation';
import { useTheme } from '@/hooks/useTheme';
import { GridDotsBackground } from '../components/ui/GridDotsBackground';
import { InteractiveASCII } from '../components/ui/InteractiveASCII';
import { SEO } from '../components/SEO';
import { UploadCloud } from 'lucide-react';

export const HomePage: React.FC = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { theme } = useTheme();

    return (
        <>
            <SEO
                title={t('homepage.seoTitle')}
                description={t('homepage.seoDescription')}
            />
            <div
                className={`welcome-screen relative min-h-[calc(100vh-80px)] flex items-center justify-center p-6 overflow-hidden pt-16 md:pt-20 transition-all duration-300 ${
                    theme === 'dark' ? 'bg-background' : 'bg-[#F5F5F5]'
                }`}
            >
                <div className="absolute inset-0 z-0">
                    <GridDotsBackground opacity={theme === 'dark' ? 0.02 : 0.05} />
                    <InteractiveASCII
                        isDarkMode={theme === 'dark'}
                        fullHeight={true}
                        color="#52ddeb"
                        className="welcome-ascii-bg"
                    />
                </div>

                <div className="relative z-10 max-w-2xl w-full text-center space-y-8">
                    <div className="space-y-4">
                        <h1
                            className={`text-2xl md:text-3xl font-bold font-mono tracking-wide ${
                                theme === 'dark' ? 'text-neutral-200' : 'text-neutral-800'
                            }`}
                        >
                            {t('homepage.heroTitle')}
                        </h1>
                        <h3
                            className={`text-lg md:text-xl font-mono ${
                                theme === 'dark' ? 'text-neutral-400' : 'text-neutral-600'
                            }`}
                        >
                            {t('homepage.heroSubtitle')}
                        </h3>
                    </div>

                    <div className="flex flex-col gap-4 justify-center items-center">
                        <button
                            onClick={() => navigate('/mockupmachine?action=upload')}
                            className="inline-flex flex-col items-center gap-1 bg-brand-cyan/80 hover:bg-brand-cyan disabled:bg-neutral-700 disabled:text-neutral-500 disabled:cursor-not-allowed cursor-pointer text-black font-bold py-5 px-12 rounded-md transition-all duration-300 font-mono shadow-lg shadow-brand-cyan/20"
                        >
                            <div className="flex items-center gap-3">
                                <UploadCloud size={22} className="md:w-8 md:h-8" />
                                <span className="text-sm md:text-base">
                                    {t('homepage.sendImage')}
                                </span>
                            </div>
                        </button>
                        <span className="text-[10px] md:text-xs font-normal opacity-70 hover:opacity-100">
                            {t('homepage.goToMockupMachine')}
                        </span>
                    </div>
                </div>
            </div>
        </>
    );
};
