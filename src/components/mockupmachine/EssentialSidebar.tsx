import React, { useState, useCallback } from 'react';
import { useMockup } from './MockupContext';
import { VibeGrid } from './VibeGrid';
import { MOCKUP_VIBES } from '@/constants/mockupVibes';
import { BrandGuidelineSelector } from './BrandGuidelineSelector';
import { MicroTitle } from '../ui/MicroTitle';
import { useTranslation } from '@/hooks/useTranslation';
import { cn } from '@/lib/utils';
import { Gem, Wand2, ChevronRight, Zap, Settings2, Diamond } from 'lucide-react';
import { toast } from 'sonner';
import { SurpriseMeControl } from './SurpriseMeControl';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassPanel } from '../ui/GlassPanel';
import { PremiumButton } from '../ui/PremiumButton';

interface EssentialSidebarProps {
  onSurpriseMe: (autoGenerate: boolean) => void;
  onSwitchToExpert: () => void;
  isGeneratingPrompt: boolean;
  isGeneratingOutputs: boolean;
  isDiceAnimating: boolean;
  isSurpriseMeActive: boolean;
  onGenerateSmartPrompt: (generateOutputs?: boolean) => Promise<void>;
  generateOutputsButtonRef?: React.RefObject<HTMLButtonElement>;
  authenticationRequiredMessage: string;
}

export const EssentialSidebar: React.FC<EssentialSidebarProps> = ({
  onSurpriseMe,
  onSwitchToExpert,
  isGeneratingPrompt,
  isGeneratingOutputs,
  isDiceAnimating,
  isSurpriseMeActive,
  onGenerateSmartPrompt,
  generateOutputsButtonRef,
  authenticationRequiredMessage
}) => {
  const { t } = useTranslation();
  const {
    setSelectedTags,
    setSelectedLocationTags,
    setSelectedLightingTags,
    setSelectedAngleTags,
    setSelectedEffectTags,
    setSelectedMaterialTags,
    uploadedImage,
    mockupCount,
    setMockupCount,
    resolution,
    setResolution,
    selectedModel,
    setSelectedModel,
    imageProvider,
    setImageProvider,
    aspectRatio,
    setAspectRatio,
    autoGenerate,
    setAutoGenerate,
    setIsSurpriseMeMode,
    isSurpriseMeMode,
    instructions,
    setInstructions,
  } = useMockup();

  const [selectedVibeId, setSelectedVibeId] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleSelectVibe = useCallback((vibeId: string) => {
    setSelectedVibeId(vibeId);
    const vibe = MOCKUP_VIBES.find(v => v.id === vibeId);
    if (vibe) {
      // Inject tags silently
      setSelectedTags(vibe.config.categoryTags);
      setSelectedLocationTags(vibe.config.locationTags);
      setSelectedLightingTags(vibe.config.lightingTags);
      setSelectedAngleTags(vibe.config.angleTags);
      setSelectedEffectTags(vibe.config.effectTags);
      setSelectedMaterialTags(vibe.config.materialTags);
    }
  }, [setSelectedTags, setSelectedLocationTags, setSelectedLightingTags, setSelectedAngleTags, setSelectedEffectTags, setSelectedMaterialTags]);

  const handleGenerate = async () => {
    if (!selectedVibeId) {
      toast.error(t('mockup.selectVibe') || 'Selecione um estilo antes de gerar.');
      return;
    }

    // Directly trigger smart prompt generation (which then triggers image generation if true is passed)
    onGenerateSmartPrompt(true);
  };

  const isBusy = isGeneratingPrompt || isGeneratingOutputs || isDiceAnimating;

  return (
    <div className="flex flex-col gap-10 animate-in fade-in slide-in-from-right-4 duration-700">
      {/* 1. BRAND SECTION */}
      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-neutral-900 border border-neutral-800/50 flex items-center justify-center">
            <Gem size={16} className="text-brand-cyan" />
          </div>
          <MicroTitle className="text-neutral-200">
            {t('mockup.brandContext') || 'IDENTIDADE DA MARCA'}
          </MicroTitle>
        </div>
        <GlassPanel padding="sm" className="bg-neutral-950/20 border-white/5">
          <BrandGuidelineSelector />
        </GlassPanel>
      </section>

      {/* 2. STYLE SECTION (VIBES) */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-neutral-900 border border-neutral-800/50 flex items-center justify-center">
              <Wand2 size={16} className="text-brand-cyan" />
            </div>
            <MicroTitle className="text-neutral-200">
              {t('mockup.vibeSelect') || 'ESTILO DO MOCKUP'}
            </MicroTitle>
          </div>
          <button 
            onClick={onSwitchToExpert}
            className="flex items-center gap-1 group text-[9px] font-mono text-neutral-600 hover:text-brand-cyan transition-colors uppercase tracking-widest"
          >
            {t('mockup.switchToExpert') || 'EXPERT'}
            <ChevronRight size={10} className="group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>
        <div className="px-0.5">
          <VibeGrid 
            selectedVibeId={selectedVibeId} 
            onSelectVibe={handleSelectVibe} 
          />
        </div>
      </section>

      {/* 3. PROMPT/INSTRUCTIONS SECTION */}
      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-neutral-900 border border-neutral-800/50 flex items-center justify-center">
            <Diamond size={16} className="text-brand-cyan/80" />
          </div>
          <MicroTitle className="text-neutral-200">
            {t('mockup.scenarioDetails') || 'DETALHES DO CENÁRIO'}
          </MicroTitle>
        </div>
        <div className="px-0.5">
          <textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder={t('mockup.scenarioPlaceholder') || 'Ex: No topo de uma montanha, iluminação de pôr do sol, estilo cinematográfico...'}
            className="w-full h-24 bg-neutral-950/40 border border-white/5 rounded-xl p-4 text-[11px] font-mono text-neutral-300 placeholder:text-neutral-600 focus:outline-none focus:border-brand-cyan/30 focus:bg-neutral-950/60 transition-all resize-none"
          />
        </div>
      </section>

      {/* 4. GENERATION ACTION */}
      <section className="space-y-6 pt-2">
        <div className="relative group">
          <AnimatePresence>
            {selectedVibeId && !isBusy && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute -inset-1 bg-brand-cyan/20 rounded-2xl blur-xl group-hover:bg-brand-cyan/30 transition-all duration-700" 
              />
            )}
          </AnimatePresence>
          
          <PremiumButton
            onClick={handleGenerate}
            isLoading={isBusy}
            disabled={!selectedVibeId}
            icon={Zap}
            className={cn(
              "h-18 rounded-2xl",
              !selectedVibeId && "grayscale opacity-50"
            )}
          >
            {t('mockup.generateResults') || 'GERAR MOCKUPS'}
          </PremiumButton>
        </div>

        {/* 4. ADVANCED SETTINGS TOGGLE */}
        <div className="pt-4 border-t border-white/5">
            <button 
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-2 text-[10px] font-mono text-neutral-600 hover:text-neutral-400 transition-colors uppercase tracking-[0.2em] mx-auto group"
            >
                <Settings2 size={12} className={cn("transition-transform duration-500", showAdvanced && "rotate-180")} />
                {showAdvanced ? 'Recolher Ajustes' : 'Ajustes de Geração'}
            </button>

            <AnimatePresence>
                {showAdvanced && (
                    <motion.div 
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="pt-6">
                            <SurpriseMeControl 
                                onSurpriseMe={onSurpriseMe}
                                isGeneratingPrompt={isGeneratingPrompt}
                                isDiceAnimating={isDiceAnimating}
                                isSurpriseMeMode={isSurpriseMeMode}
                                setIsSurpriseMeMode={setIsSurpriseMeMode}
                                autoGenerate={autoGenerate}
                                setAutoGenerate={setAutoGenerate}
                                selectedModel={selectedModel}
                                setSelectedModel={setSelectedModel}
                                imageProvider={imageProvider}
                                setImageProvider={setImageProvider}
                                mockupCount={mockupCount}
                                setMockupCount={setMockupCount}
                                resolution={resolution}
                                setResolution={setResolution}
                                aspectRatio={aspectRatio}
                                setAspectRatio={setAspectRatio}
                                uploadedImage={uploadedImage}
                                variant="inline"
                            />
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
      </section>
      
    </div>
  );
};
