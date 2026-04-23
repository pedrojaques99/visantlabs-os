import React, { useState, useCallback } from 'react';
import { useMockup } from './MockupContext';
import { VibeGrid } from './VibeGrid';
import { BrandGuidelineSelector } from './BrandGuidelineSelector';
import { useBrandGuidelines } from '@/hooks/queries/useBrandGuidelines';
import { getCombinedVibeConfig } from '@/constants/mockupVibes';
import { MicroTitle } from '../ui/MicroTitle';
import { useTranslation } from '@/hooks/useTranslation';
import { cn } from '@/lib/utils';
import { Gem, Diamond, ChevronRight, Settings2, MessageSquareText } from 'lucide-react';
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
  onGenerateOutputs: () => void;
  generateOutputsButtonRef?: React.RefObject<HTMLButtonElement>;
  authenticationRequiredMessage: string;
  isPromptReady?: boolean;
}

export const EssentialSidebar: React.FC<EssentialSidebarProps> = ({
  onSurpriseMe,
  onSwitchToExpert,
  isGeneratingPrompt,
  isGeneratingOutputs,
  isDiceAnimating,
  isSurpriseMeActive,
  onGenerateSmartPrompt,
  onGenerateOutputs,
  generateOutputsButtonRef,
  authenticationRequiredMessage,
  isPromptReady = false
}) => {
  const { t } = useTranslation();
  const { data: guidelines = [] } = useBrandGuidelines(true);
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
    selectedBrandGuideline,
  } = useMockup();

  const selectedBrandName = guidelines.find(g => g.id === selectedBrandGuideline)?.identity?.name;

  const {
    selectedVibeSegment, setSelectedVibeSegment,
    selectedVibeStyle, setSelectedVibeStyle
  } = useMockup();
  const [showAdvanced, setShowAdvanced] = useState(false);

  const updateTagsFromVibe = useCallback((segmentId: string | null, styleId: string | null) => {
    if (!segmentId || !styleId) return;

    const config = getCombinedVibeConfig(segmentId as any, styleId as any);

    setSelectedLocationTags(config.locationTags);
    setSelectedLightingTags(config.lightingTags);
    setSelectedAngleTags(config.angleTags);
    setSelectedEffectTags(config.effectTags);
    setSelectedMaterialTags(config.materialTags);
  }, [setSelectedTags, setSelectedLocationTags, setSelectedLightingTags, setSelectedAngleTags, setSelectedEffectTags, setSelectedMaterialTags]);

  const handleSelectSegment = useCallback((segmentId: any) => {
    setSelectedVibeSegment(segmentId);
    if (selectedVibeStyle) {
      updateTagsFromVibe(segmentId, selectedVibeStyle);
    }
  }, [selectedVibeStyle, setSelectedVibeSegment, updateTagsFromVibe]);

  const handleSelectStyle = useCallback((styleId: any) => {
    setSelectedVibeStyle(styleId);
    if (selectedVibeSegment) {
      updateTagsFromVibe(selectedVibeSegment, styleId);
    }
  }, [selectedVibeSegment, setSelectedVibeStyle, updateTagsFromVibe]);



  const [showInstructions, setShowInstructions] = useState(!!instructions);

  return (
    <div className="flex flex-col gap-6 sm:gap-8 lg:gap-10 animate-in fade-in slide-in-from-right-4 duration-700">
      {/* 1. BRAND SELECTION */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-neutral-900 border border-neutral-800/50 flex items-center justify-center shadow-inner">
            <Gem size={14} className={cn("transition-colors", selectedBrandGuideline ? "text-brand-cyan" : "text-neutral-600")} />
          </div>
          {selectedBrandName && (
            <MicroTitle className="text-neutral-400">
              {selectedBrandName}
            </MicroTitle>
          )}
        </div>
        <BrandGuidelineSelector variant="minimal" />
      </div>

      {/* 2. STYLE SECTION (VIBES) */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-neutral-900 border border-neutral-800/50 flex items-center justify-center">
              <Diamond size={16} className="text-brand-cyan" />
            </div>
            <MicroTitle className="text-neutral-200">
              {t('mockup.vibeSelect') || 'ESTILO DO MOCKUP'}
            </MicroTitle>
          </div>
          <button
            onClick={onSwitchToExpert}
            className="flex items-center gap-1 group text-[10px] font-mono text-neutral-600 hover:text-brand-cyan transition-colors uppercase tracking-widest"
          >
            {t('mockup.switchToExpert') || 'EXPERT'}
            <ChevronRight size={10} className="group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>
        <div className="px-0.5">
          <VibeGrid
            selectedSegment={selectedVibeSegment as any}
            selectedStyle={selectedVibeStyle as any}
            onSelectSegment={handleSelectSegment}
            onSelectStyle={handleSelectStyle}
          />
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between group/header">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-neutral-900 border border-neutral-800/50 flex items-center justify-center">
              <Diamond size={16} className={cn("transition-colors", showInstructions ? "text-brand-cyan" : "text-neutral-600")} />
            </div>
            <MicroTitle className={cn("transition-colors", showInstructions ? "text-neutral-200" : "text-neutral-500")}>
              {t('mockup.scenarioDetails') || 'DETALHES DO CENÁRIO'}
            </MicroTitle>
          </div>
          <button
            onClick={() => setShowInstructions(!showInstructions)}
            className={cn(
               "w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-300",
               showInstructions 
                 ? "bg-brand-cyan/20 border border-brand-cyan/30 text-brand-cyan" 
                 : "bg-neutral-900 border border-white/5 text-neutral-600 hover:text-neutral-400 hover:border-white/10"
            )}
            title={showInstructions ? t('common.hide') : t('common.show')}
          >
            <MessageSquareText size={14} className={cn("transition-transform duration-300", showInstructions && "scale-110")} />
          </button>
        </div>
        
        <AnimatePresence>
          {showInstructions && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="px-0.5 overflow-hidden"
            >
              <textarea
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder={t('mockup.scenarioPlaceholder') || 'Ex: No topo de uma montanha, iluminação de pôr do sol, estilo cinematográfico...'}
                className="w-full h-24 bg-neutral-950/40 border border-white/5 rounded-xl p-4 text-[11px] font-mono text-neutral-300 placeholder:text-neutral-600 focus:outline-none focus:border-brand-cyan/30 focus:bg-neutral-950/60 transition-all resize-none"
              />
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {/* 4. GENERATION ACTION (TOOLBAR MOVED TO SIDEBAR) */}
      <section className="pt-2 animate-fade-in-up stagger-5 space-y-4">
        <SurpriseMeControl
          onSurpriseMe={onSurpriseMe}
          isGeneratingPrompt={isGeneratingPrompt}
          isDiceAnimating={isDiceAnimating}
          isSurpriseMeMode={isSurpriseMeActive}
          setIsSurpriseMeMode={() => onSurpriseMe(!isSurpriseMeActive)}
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
          onGeneratePrompt={() => onGenerateSmartPrompt(autoGenerate)}
          onGenerateOutputs={onGenerateOutputs}
          isGenerateDisabled={(!selectedVibeSegment || !selectedVibeStyle) && !isSurpriseMeActive}
          isGeneratingOutputs={isGeneratingOutputs}
          isPromptReady={isPromptReady}
          variant="inline"
          hideSettings={true}
        />

        {/* 5. GENERATION SETTINGS (ACCORDION) */}
        <div className="pt-4 border-t border-white/5">
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-2 text-[10px] font-mono text-neutral-600 hover:text-neutral-400 transition-colors uppercase tracking-[0.1em] mx-auto group"
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
                transition={{ duration: 0.3 }}
                className="overflow-hidden"
              >
                <div className="pt-4">
                  <SurpriseMeControl
                    onSurpriseMe={onSurpriseMe}
                    isGeneratingPrompt={isGeneratingPrompt}
                    isDiceAnimating={isDiceAnimating}
                    isSurpriseMeMode={isSurpriseMeActive}
                    setIsSurpriseMeMode={() => onSurpriseMe(!isSurpriseMeActive)}
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
                    onGeneratePrompt={() => onGenerateSmartPrompt(autoGenerate)}
                    onGenerateOutputs={onGenerateOutputs}
                    isGenerateDisabled={(!selectedVibeSegment || !selectedVibeStyle) && !isSurpriseMeActive}
                    isGeneratingOutputs={isGeneratingOutputs}
                    isPromptReady={isPromptReady}
                    variant="inline"
                    hideActions={true}
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
