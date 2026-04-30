import React, { useState } from 'react';
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
} from './sections';
import { PreviewSection } from './preview/PreviewSection';
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
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
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

  React.useEffect(() => {
    setLocalMedia(guideline.media || []);
    setLocalLogos(guideline.logos || []);
  }, [guideline.id]);

  const { draft, updateDraft, undo, redo, isDirty, isSaving } = useBrandGuidelineEditor();

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
    switch (id) {
      case 'identity':
        return <IdentitySection key="identity" guideline={g} onUpdate={handleUpdate} onReIngest={guideline.identity?.website ? handleReIngest : undefined} onOpenWizard={onOpenWizard} onDelete={handleDelete} isDeleting={deleteMutation.isPending} span="full" />;
      case 'strategy':
        return <StrategySection key="strategy" guideline={g} onUpdate={handleUpdate} span="full" />;
      case 'logos':
        return <LogosSection key="logos" guideline={g} logos={localLogos} onLogosChange={setLocalLogos} span="1" />;
      case 'colors':
        return <ColorsSection key="colors" guideline={g} onUpdate={handleUpdate} span="1" />;
      case 'typography':
        return <TypographySection key="typography" guideline={g} onUpdate={handleUpdate} span="full" />;
      case 'tags':
        return <TagsSection key="tags" guideline={g} onUpdate={handleUpdate} span="1" />;
      case 'editorial':
        return <EditorialSection key="editorial" guideline={g} onUpdate={handleUpdate} span="full" />;
      case 'tokens':
        return <TokensSection key="tokens" guideline={g} onUpdate={handleUpdate} span="1" />;
      case 'accessibility':
        return <AccessibilitySection key="accessibility" guideline={g} onUpdate={handleUpdate} span="full" />;
      case 'media':
        return <MediaSection key="media" guidelineId={guideline.id!} media={localMedia} logos={localLogos} onMediaChange={setLocalMedia} onLogosChange={setLocalLogos} span="full" />;
      case 'figma':
        return <FigmaLinkSection key="figma" guideline={g} onUpdate={handleUpdate} span="1" />;
      case 'knowledge':
        return <KnowledgeSection key="knowledge" guideline={g} span="full" />;
      case 'gradients':
        return <GradientSection key="gradients" guideline={g} onUpdate={handleUpdate} span="1" />;
      case 'shadows':
        return <ShadowSection key="shadows" guideline={g} onUpdate={handleUpdate} span="1" />;
      case 'motion':
        return <MotionSection key="motion" guideline={g} onUpdate={handleUpdate} span="1" />;
      case 'borders':
        return <BorderSection key="borders" guideline={g} onUpdate={handleUpdate} span="1" />;
      case 'manifesto':
        return <ManifestoSection key="manifesto" guideline={g} onUpdate={handleUpdate} span="full" />;
      case 'archetypes':
        return <ArchetypesSection key="archetypes" guideline={g} onUpdate={handleUpdate} span="1" />;
      case 'mensagem_central':
        return <MensagemCentralSection key="mensagem_central" guideline={g} onUpdate={handleUpdate} span="1" />;
      case 'voice':
        return <VoiceSection key="voice" guideline={g} onUpdate={handleUpdate} span="1" />;
      case 'personas':
        return <PersonasSection key="personas" guideline={g} onUpdate={handleUpdate} span="full" />;
      case 'preview':
        return <PreviewSection key="preview" guideline={g} span="full" />;
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
          className="grid gap-6"
          style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 420px), 1fr))' }}
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
