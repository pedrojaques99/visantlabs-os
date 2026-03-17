import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '@/hooks/useTranslation';
import { useLayout } from '@/hooks/useLayout';
import { PremiumButton } from '../components/ui/PremiumButton';
import { SEO } from '../components/SEO';
import { ExternalLink } from 'lucide-react';

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
                title={t('homepage.seoTitle')}
                description={t('homepage.seoDescription')}
            />
            <div className="fixed inset-0 bg-black flex flex-col items-center justify-center z-[10]">
                <div className="flex flex-col items-center gap-6 px-4 text-center">
                    <PremiumButton
                        onClick={() => navigate('/mockupmachine')}
                        className="h-16 text-lg"
                        icon={ExternalLink}
                    >
                        MOCKUP MACHINE
                    </PremiumButton>

                    <button
                        onClick={() => navigate('/about')}
                        className="text-neutral-600 hover:text-neutral-400 font-mono text-[10px] uppercase transition-colors duration-300"
                    >
                        about
                    </button>

                    {showInternalLinks && (
                        <div className="flex flex-col items-center gap-3 mt-4 pt-4 border-t border-neutral-900">
                            <button
                                onClick={() => navigate('/canvas')}
                                className="text-neutral-600 hover:text-neutral-400 font-mono text-[10px] uppercase transition-colors duration-300"
                            >
                                canvas
                            </button>
                            <button
                                onClick={() => navigate('/apps')}
                                className="text-neutral-600 hover:text-neutral-400 font-mono text-[10px] uppercase transition-colors duration-300"
                            >
                                apps
                            </button>
                            <button
                                onClick={() => navigate('/brand-guidelines')}
                                className="text-neutral-600 hover:text-neutral-400 font-mono text-[10px] uppercase transition-colors duration-300"
                            >
                                brand guidelines
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
};
