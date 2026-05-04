import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { useDeleteGuideline, useIngestGuideline } from '@/hooks/queries/useBrandGuidelines';
import { motion } from 'framer-motion';
import { ClipboardCheck } from 'lucide-react';
import { toast } from 'sonner';
import { useHotkeys } from 'react-hotkeys-hook';
import type { BrandGuideline } from '@/lib/figma-types';
import { useBrandGuidelineEditor } from '@/contexts/BrandGuidelineEditorContext';

import {
  IdentitySection, ColorsSection, TypographySection, TagsSection,
  TokensSection, EditorialSection, AccessibilitySection, MediaSection,
  LogosSection, StrategySection, FigmaLinkSection, KnowledgeSection,
  GradientSection, ShadowSection, MotionSection, BorderSection,
  VoiceSection, PersonasSection,
  ManifestoSection, ArchetypesSection, MensagemCentralSection,
  ThemeSection, PillarsSection, MarketResearchSection, GraphicSystemSection,
} from './sections';
import { PreviewSection } from './preview/PreviewSection';
import { DesignSystemOutputSection } from './sections/DesignSystemOutputSection';
import { GuidelineExportBar } from './GuidelineExportBar';
import { SectionHideContext } from './SectionBlock';

interface GuidelineDetailProps {
  guideline: BrandGuideline;
  visibleSections: string[];
  onHideSection: (id: string) => void;
  onOpenWizard: () => void;
  onStartReview?: () => void;
}

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.3, ease: [0.25, 0.1, 0.25, 1] as const } },
};

export const GuidelineDetail: React.FC<GuidelineDetailProps> = ({
  guideline,
  visibleSections,
  onHideSection,
  onOpenWizard,
  onStartReview,
}) => {
  const { t } = useTranslation();
  const deleteMutation = useDeleteGuideline();
  const ingestMutation = useIngestGuideline();

  const [localMedia, setLocalMedia] = useState(guideline.media || []);
  const [localLogos, setLocalLogos] = useState(guideline.logos || []);

  const { draft, updateDraft, undo, redo, isDirty, isSaving } = useBrandGuidelineEditor();

  const mediaInitRef = useRef(true);
  const logosInitRef = useRef(true);

  React.useEffect(() => {
    setLocalMedia(guideline.media || []);
    setLocalLogos(guideline.logos || []);
    mediaInitRef.current = true;
    logosInitRef.current = true;
  }, [guideline.id]);

  useEffect(() => {
    if (mediaInitRef.current) { mediaInitRef.current = false; return; }
    updateDraft({ media: localMedia });
  }, [localMedia]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (logosInitRef.current) { logosInitRef.current = false; return; }
    updateDraft({ logos: localLogos });
  }, [localLogos]);

  const handleUpdate = updateDraft;

  useHotkeys('mod+z', (e) => { e.preventDefault(); undo(); }, { enableOnFormTags: true });
  useHotkeys('mod+shift+z', (e) => { e.preventDefault(); redo(); }, { enableOnFormTags: true });
  useHotkeys('mod+s', (e) => { e.preventDefault(); }, { enableOnFormTags: true });

  const handleReIngest = () => {
    if (!guideline.id || !guideline.identity?.website) return;
    toast.info(t('mockup.brandWizardExtracting'));
    ingestMutation.mutate({ id: guideline.id, payload: { source: 'url', url: guideline.identity.website } });
  };

  const handleDelete = () => {
    if (!guideline.id) return;
    deleteMutation.mutate(guideline.id);
  };

  const renderSection = (id: string) => {
    const g = draft;
    
    const halfWidthSections = new Set(['tags', 'figma', 'voice', 'archetypes', 'mensagem_central', 'pillars']);

    const getBaseSpan = (id: string): '6' | '12' | '8' | '4' => {
      if (id === 'identity') return '12';
      if (id === 'tags') return '4';
      if (halfWidthSections.has(id)) return '6';
      return '12';
    };

    // Auto-expand half-width sections to full when they'd be alone on a row
    const getSpan = (id: string): '6' | '12' | '8' | '4' => {
      const base = getBaseSpan(id);
      if (base !== '6' && base !== '4') return base;

      const idx = visibleSections.indexOf(id);
      if (idx === -1) return base;

      // Find neighbor: previous or next section that is also half-width
      const hasHalfNeighbor = (offset: number) => {
        const nId = visibleSections[idx + offset];
        return nId && (halfWidthSections.has(nId) || getBaseSpan(nId) === '4');
      };

      // Check if this section can pair with an adjacent half-width section
      const canPair = hasHalfNeighbor(-1) || hasHalfNeighbor(1);
      if (!canPair) return '12';
      return base;
    };

    const span = getSpan(id);

    switch (id) {
      case 'identity':
        return <IdentitySection key="identity" guideline={g} onUpdate={handleUpdate} onReIngest={guideline.identity?.website ? handleReIngest : undefined} onOpenWizard={onOpenWizard} onDelete={handleDelete} isDeleting={deleteMutation.isPending} span={span} />;
      case 'strategy':
        return <StrategySection key="strategy" guideline={g} onUpdate={handleUpdate} span={span} />;
      case 'logos':
        return <LogosSection key="logos" guideline={g} logos={localLogos} onLogosChange={setLocalLogos} span={span} />;
      case 'colors':
        return <ColorsSection key="colors" guideline={g} onUpdate={handleUpdate} span={span} />;
      case 'colorThemes':
        return <ThemeSection key="colorThemes" guideline={g} onUpdate={handleUpdate} span={span} />;
      case 'typography':
        return <TypographySection key="typography" guideline={g} onUpdate={handleUpdate} span={span} />;
      case 'tags':
        return <TagsSection key="tags" guideline={g} onUpdate={handleUpdate} span={span} />;
      case 'editorial':
        return <EditorialSection key="editorial" guideline={g} onUpdate={handleUpdate} span={span} />;
      case 'tokens':
        return <TokensSection key="tokens" guideline={g} onUpdate={handleUpdate} span={span} />;
      case 'accessibility':
        return <AccessibilitySection key="accessibility" guideline={g} onUpdate={handleUpdate} span={span} />;
      case 'media':
        return <MediaSection key="media" guidelineId={guideline.id!} media={localMedia} logos={localLogos} onMediaChange={setLocalMedia} onLogosChange={setLocalLogos} span={span} />;
      case 'figma':
        return <FigmaLinkSection key="figma" guideline={g} onUpdate={handleUpdate} span={span} />;
      case 'knowledge':
        return <KnowledgeSection key="knowledge" guideline={g} span={span} />;
      case 'gradients':
        return <GradientSection key="gradients" guideline={g} onUpdate={handleUpdate} span={span} />;
      case 'shadows':
        return <ShadowSection key="shadows" guideline={g} onUpdate={handleUpdate} span={span} />;
      case 'motion':
        return <MotionSection key="motion" guideline={g} onUpdate={handleUpdate} span={span} />;
      case 'borders':
        return <BorderSection key="borders" guideline={g} onUpdate={handleUpdate} span={span} />;
      case 'manifesto':
        return <ManifestoSection key="manifesto" guideline={g} onUpdate={handleUpdate} span={span} />;
      case 'archetypes':
        return <ArchetypesSection key="archetypes" guideline={g} onUpdate={handleUpdate} span={span} />;
      case 'mensagem_central':
        return <MensagemCentralSection key="mensagem_central" guideline={g} onUpdate={handleUpdate} span={span} />;
      case 'voice':
        return <VoiceSection key="voice" guideline={g} onUpdate={handleUpdate} span={span} />;
      case 'personas':
        return <PersonasSection key="personas" guideline={g} onUpdate={handleUpdate} span={span} />;
      case 'pillars':
        return <PillarsSection key="pillars" guideline={g} onUpdate={handleUpdate} span={span} />;
      case 'market_research':
        return <MarketResearchSection key="market_research" guideline={g} onUpdate={handleUpdate} span={span} />;
      case 'graphic_system':
        return <GraphicSystemSection key="graphic_system" guideline={g} onUpdate={handleUpdate} span={span} />;
      case 'preview':
        return <PreviewSection key="preview" guideline={g} span={span} />;
      case 'design-system-output':
        return <DesignSystemOutputSection key="design-system-output" guideline={g} span={span} />;
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <SectionHideContext.Provider value={onHideSection}>
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6"
        >
          {visibleSections.map(id => (
            <React.Fragment key={id}>
              {renderSection(id)}
            </React.Fragment>
          ))}
        </motion.div>
      </SectionHideContext.Provider>

      <div className="flex items-center justify-between pt-2">
        {(isDirty || isSaving) && (
          <span className="text-[10px] font-mono uppercase tracking-widest transition-colors text-neutral-600">
            {isSaving ? 'Salvando...' : '✓ Salvo'}
          </span>
        )}
        {onStartReview && (
          <button
            onClick={onStartReview}
            className="flex items-center gap-2 px-3 py-2 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:border-white/10 hover:bg-white/[0.04] transition-all group"
          >
            <ClipboardCheck size={13} className="text-neutral-600 group-hover:text-neutral-400 transition-colors" />
            <span className="text-[10px] font-mono text-neutral-600 group-hover:text-neutral-400 transition-colors uppercase tracking-widest">Review Design System</span>
          </button>
        )}
        <div className="ml-auto">
          <GuidelineExportBar guideline={guideline} />
        </div>
      </div>
    </div>
  );
};
