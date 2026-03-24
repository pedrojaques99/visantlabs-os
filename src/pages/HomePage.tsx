import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '@/hooks/useTranslation';
import { useLayout } from '@/hooks/useLayout';
import { PremiumButton } from '../components/ui/PremiumButton';
import { GridDotsBackground } from '../components/ui/GridDotsBackground';
import { SEO } from '../components/SEO';
import { ExternalLink, Lock } from 'lucide-react';
import { VisantLogo3D } from '../components/3d/VisantLogo3D';

export const HomePage: React.FC = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { user } = useLayout();

    const isAdmin = user?.isAdmin === true;
    const isTester = user?.userCategory === 'tester' || user?.username === 'tester';
    const showInternalLinks = isAdmin || isTester;

    return (
        <>
            <SEO
                title={t('homepage.seoTitle') || 'MOCKUP MACHINE'}
                description={t('homepage.seoDescription') || 'Experimental Design Laboratory'}
            />

            <div className="fixed inset-0 bg-black flex flex-col items-center justify-center z-[10] overflow-hidden">
                {/* Background layers */}
                <GridDotsBackground opacity={0.05} spacing={30} color="#ffffff" />

                {/* Main Content */}
                <div className="relative z-20 flex flex-col items-center gap-4 px-4 text-center max-w-4xl">
                    {/* Minimal 3D Logo */}
                    <div className="w-80 h-80 md:w-[28rem] md:h-[28rem] relative flex items-center justify-center -mb-12">
                        <VisantLogo3D />
                    </div>

                    <div className="flex flex-col items-center gap-10 w-full max-w-sm">
                        <PremiumButton
                            onClick={() => navigate('/mockupmachine')}
                            className="h-14 px-12 text-sm border-white/20 hover:border-white/40 text-white transition-all bg-white/5 backdrop-blur-sm group"
                            icon={ExternalLink}
                        >
                            MOCKUP MACHINE® (ALPHA)
                        </PremiumButton>

                        <div className="flex items-center justify-center gap-10">
                            <button
                                onClick={() => navigate('/about')}
                                className="text-neutral-400 hover:text-white font-mono text-[10px] uppercase tracking-widest transition-all duration-300 cursor-pointer"
                            >
                                info
                            </button>

                            {showInternalLinks ? (
                                <div className="flex items-center gap-8">
                                    <button
                                        onClick={() => navigate('/canvas')}
                                        className="text-neutral-400 hover:text-brand-cyan font-mono text-[10px] uppercase tracking-widest transition-all duration-300 cursor-pointer"
                                    >
                                        canvas
                                    </button>
                                    <button
                                        onClick={() => navigate('/apps')}
                                        className="text-neutral-400 hover:text-brand-cyan font-mono text-[10px] uppercase tracking-widest transition-all duration-300 cursor-pointer"
                                    >
                                        apps
                                    </button>
                                    <button
                                        onClick={() => navigate('/brand-guidelines')}
                                        className="text-neutral-400 hover:text-brand-cyan font-mono text-[10px] uppercase tracking-widest transition-all duration-300 cursor-pointer"
                                    >
                                        core
                                    </button>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2 text-neutral-600 font-mono text-[10px] uppercase tracking-widest opacity-60 select-none">
                                    <Lock size={10} />
                                    <span>restricted</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

