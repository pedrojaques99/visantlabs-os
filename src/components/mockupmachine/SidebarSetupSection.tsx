import React from 'react';
import { useTheme } from '@/hooks/useTheme';
import { useTranslation } from '@/hooks/useTranslation';
import { InputSection } from './InputSection';
import { useMockup } from './MockupContext';
import type { UploadedImage, DesignType } from '../../types/types';
import { GlitchLoader } from '../ui/GlitchLoader';
import { cn } from '@/lib/utils';
import { Plus, ArrowRight } from 'lucide-react';
import { Tooltip } from '@/components/ui/Tooltip';

interface SidebarSetupSectionProps {
    onImageUpload: (image: UploadedImage) => void;
    onReferenceImagesChange: (images: UploadedImage[]) => void;
    onStartOver: () => void;
    onDesignTypeChange: (type: DesignType) => void;
    onAnalyze: () => void;
}

export const SidebarSetupSection: React.FC<SidebarSetupSectionProps> = ({
    onImageUpload,
    onReferenceImagesChange,
    onStartOver,
    onDesignTypeChange,
    onAnalyze,
}) => {
    const { t } = useTranslation();
    const { theme } = useTheme();

    const {
        uploadedImage,
        referenceImages,
        designType,
        selectedModel,
        hasAnalyzed,
        isAnalyzing,
    } = useMockup();

    const handleScrollToSection = (sectionId: string) => {
        const section = document.getElementById(sectionId);
        if (section) {
            section.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };

    const canAnalyze = uploadedImage && designType && !hasAnalyzed;

    return (
        <div
            id="section-setup"
            className="transition-all duration-300 w-full flex flex-col min-h-full relative pb-24"
        >
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start w-full">
                {/* Left Column - Files/Uploads */}
                <div className="flex flex-col gap-4">
                    <InputSection
                        uploadedImage={uploadedImage}
                        referenceImages={referenceImages}
                        designType={designType}
                        selectedModel={selectedModel}
                        onImageUpload={onImageUpload}
                        onReferenceImagesChange={onReferenceImagesChange}
                        onStartOver={onStartOver}
                        hasAnalyzed={hasAnalyzed}
                        onDesignTypeChange={onDesignTypeChange}
                        onScrollToSection={handleScrollToSection}
                    />
                </div>

                {/* Right Column - Configuration */}
                <div className="flex flex-col gap-6">
                    {uploadedImage && (
                        <div className="flex flex-col gap-6 w-full items-start py-8 px-8 rounded-md border border-white/[0.05] backdrop-blur-xl animate-in fade-in slide-in-from-right-4 duration-500">
                            <div className="space-y-1">
                                <span className="text-[10px] font-mono uppercase tracking-[0.4em] text-brand-cyan font-bold block mb-2">
                                    {t('mockup.setup') || 'Configuração'}
                                </span>
                                <h4 className="text-xl font-mono text-white font-medium">
                                    {t('mockup.designTypeQuestion') || 'Isto é um logo ou layout?'}
                                </h4>
                                <p className="text-sm text-neutral-500 font-mono leading-relaxed">
                                    {t('mockup.designTypeDescription') || 'Selecione o tipo de imagem principal para otimizar os resultados da IA.'}
                                </p>
                            </div>

                            <div className="flex flex-col w-full gap-3">
                                <button
                                    onClick={() => onDesignTypeChange('logo')}
                                    className={cn(
                                        "w-full flex items-center justify-between px-6 py-5 text-sm font-mono rounded-md transition-all duration-300 border",
                                        designType === 'logo'
                                            ? "bg-brand-cyan border-brand-cyan text-black font-bold shadow-xl shadow-brand-cyan/20 translate-y-[-2px]"
                                            : "bg-neutral-900/50 border-white/5 text-neutral-400 hover:text-neutral-200 hover:border-white/10 hover:bg-white/5"
                                    )}
                                >
                                    <span>{t('mockup.typeLogo') || 'LOGO'}</span>
                                    {designType === 'logo' && <div className="w-2.5 h-2.5 rounded-full bg-black animate-pulse shadow-sm" />}
                                </button>
                                <button
                                    onClick={() => onDesignTypeChange('layout')}
                                    className={cn(
                                        "w-full flex items-center justify-between px-6 py-5 text-sm font-mono rounded-md transition-all duration-300 border",
                                        designType === 'layout'
                                            ? "bg-brand-cyan border-brand-cyan text-black font-bold shadow-xl shadow-brand-cyan/20 translate-y-[-2px]"
                                            : "bg-neutral-900/50 border-white/5 text-neutral-400 hover:text-neutral-200 hover:border-white/10 hover:bg-white/5"
                                    )}
                                >
                                    <span>{t('mockup.typeLayout') || 'LAYOUT / UI'}</span>
                                    {designType === 'layout' && <div className="w-2.5 h-2.5 rounded-full bg-black animate-pulse shadow-sm" />}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Sticky Bottom Footer - Full Width Action */}
            <div className="fixed bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-neutral-950 via-neutral-950/90 to-transparent z-40 lg:absolute lg:mt-8 lg:relative lg:bg-transparent lg:p-0">
                <button
                    onClick={onAnalyze}
                    disabled={!canAnalyze || isAnalyzing}
                    className={cn(
                        "w-full flex items-center justify-center gap-3 py-4 px-6 rounded-md font-mono text-base font-bold transition-all duration-500 group overflow-hidden relative border",
                        canAnalyze && !isAnalyzing
                            ? "bg-brand-cyan border-brand-cyan/50 text-black shadow-[0_10px_40px_rgba(var(--brand-cyan-rgb),0.2)] hover:scale-[1.01] active:scale-[0.99] hover:bg-brand-cyan/90"
                            : "bg-neutral-900/80 border-white/5 text-neutral-600 cursor-not-allowed opacity-50 shadow-none translate-y-0.5"
                    )}
                >
                    {isAnalyzing ? (
                        <>
                            <GlitchLoader size={18} color="black" />
                            <span className="animate-pulse tracking-widest text-sm">{t('mockup.analyzing') || 'ANALISANDO...'}</span>
                        </>
                    ) : (
                        <>
                            <span className="relative z-10 flex items-center gap-2 tracking-widest">
                                {t('mockup.continue') || 'CONTINUAR'}
                                <ArrowRight size={18} className="transition-transform duration-300 group-hover:translate-x-1" />
                            </span>
                            {canAnalyze && (
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-shimmer" />
                            )}
                        </>
                    )}
                </button>

                {!canAnalyze && !isAnalyzing && !hasAnalyzed && (
                    <p className="text-center mt-3 text-[9px] font-mono text-neutral-600 uppercase tracking-[0.3em] opacity-60">
                        {t('mockup.uploadRequired') || 'Upload necessário'}
                    </p>
                )}
            </div>
        </div>
    );
};
