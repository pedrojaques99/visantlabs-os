import React, { useState, useCallback } from 'react';
import { useMockup } from './MockupContext';
import { VibeGrid } from './VibeGrid';
import { MOCKUP_VIBES } from '@/constants/mockupVibes';
import { BrandGuidelineSelector } from './BrandGuidelineSelector';
import { GlassPanel } from '../ui/GlassPanel';
import { MicroTitle } from '../ui/MicroTitle';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/hooks/useTranslation';
import { cn } from '@/lib/utils';
import { Pickaxe, Settings, Sparkles, Wand2, ChevronRight, SlidersHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import { Tooltip } from '@/components/ui/Tooltip';
import { SurpriseMeControl } from './SurpriseMeControl';

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
    isSurpriseMeMode
  } = useMockup();

  const [selectedVibeId, setSelectedVibeId] = useState<string | null>(null);

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
    <div className="flex flex-col gap-6 animate-in fade-in duration-500">
      {/* 1. BRAND SECTION */}
      <section className="space-y-3">
        <MicroTitle className="flex items-center gap-2">
          <Sparkles size={14} className="text-brand-cyan" />
          {t('mockup.brandContext') || 'SUA MARCA & DESIGN'}
        </MicroTitle>
        <BrandGuidelineSelector />
      </section>

      {/* 2. STYLE SECTION (VIBES) */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <MicroTitle className="flex items-center gap-2">
            <Wand2 size={14} className="text-brand-cyan" />
            {t('mockup.vibeSelect') || 'ESCOLHA O ESTILO (VIBE)'}
          </MicroTitle>
          <button 
            onClick={onSwitchToExpert}
            className="text-[10px] font-mono text-neutral-500 hover:text-brand-cyan transition-colors uppercase tracking-widest flex items-center gap-1 group"
          >
            {t('mockup.switchToExpert') || 'EXPERT MODE'}
            <ChevronRight size={10} className="group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>
        <VibeGrid 
          selectedVibeId={selectedVibeId} 
          onSelectVibe={handleSelectVibe} 
        />
      </section>

      {/* 3. GENERATION ACTION */}
      <section className="pt-2 space-y-4">
        <Button
          onClick={handleGenerate}
          disabled={isBusy || !selectedVibeId}
          className={cn(
            "w-full h-16 rounded-2xl flex items-center justify-center gap-3 transition-all duration-300",
            "bg-brand-cyan text-black font-black uppercase tracking-[0.2em] text-sm shadow-[0_10px_40px_rgba(var(--brand-cyan-rgb),0.3)]",
            "hover:scale-[1.02] active:scale-[0.98] hover:shadow-[0_15px_50px_rgba(var(--brand-cyan-rgb),0.4)]",
            (isBusy || !selectedVibeId) && "opacity-50 grayscale"
          )}
        >
          <Pickaxe size={20} strokeWidth={3} />
          {t('mockup.generateResults') || 'GERAR MOCKUPS'}
        </Button>

        {/* 4. ADVANCED DRAWER / SETTINGS UI REUSE */}
        <div className="flex justify-center">
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
      </section>
      
      <div className="text-center">
        <p className="text-[10px] text-neutral-600 font-mono italic tracking-tight">
          {t('mockup.essentialModeFootnote') || 'Essential mode usa presets otimizados para velocidade e qualidade profissional.'}
        </p>
      </div>
    </div>
  );
};
