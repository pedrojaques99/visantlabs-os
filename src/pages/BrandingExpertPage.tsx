import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { BrandingExpertChat } from '@/components/branding/BrandingExpertChat';
import { SEO } from '@/components/SEO';
import { useTheme } from '@/hooks/useTheme';
import { cn } from '@/lib/utils';

export const BrandingExpertPage: React.FC = () => {
    const { theme } = useTheme();
    const [searchParams] = useSearchParams();
    const projectId = searchParams.get('projectId') || undefined;

    return (
        <div className={cn("h-screen w-full flex flex-col overflow-hidden", theme === 'dark' ? 'bg-[#0C0C0C]' : 'bg-neutral-50')}>
            <SEO 
                title="Especialista em Branding | Visant Labs"
                description="Converse com nosso assistente especialista em estratégia e metodologia de branding."
            />
            
            <div className="flex-1 w-full h-full flex flex-col pt-16 md:p-8 md:pt-20 lg:p-12 lg:pt-24 overflow-hidden">
                <div className="flex-1 w-full max-w-6xl mx-auto h-full flex flex-col shadow-2xl md:rounded-2xl border border-white/5 bg-neutral-950/20 backdrop-blur-xl transition-all overflow-hidden">
                    <BrandingExpertChat 
                        mode="inline"
                        projectId={projectId}
                    />
                </div>
            </div>
        </div>
    );
};
