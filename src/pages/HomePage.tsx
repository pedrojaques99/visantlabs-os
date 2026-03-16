import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '@/hooks/useTranslation';
import { PremiumButton } from '../components/ui/PremiumButton';
import { SEO } from '../components/SEO';
import { ExternalLink } from 'lucide-react';

export const HomePage: React.FC = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();

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
                </div>
            </div>
        </>
    );
};
