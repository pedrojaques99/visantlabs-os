import React, { useState } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { useUpdateGuideline, useDeleteGuideline, useIngestGuideline } from '@/hooks/queries/useBrandGuidelines';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { motion } from 'framer-motion';
import { Layers, ClipboardCheck } from 'lucide-react';
import { toast } from 'sonner';
import type { BrandGuideline } from '@/lib/figma-types';

import { IdentitySection } from './sections/IdentitySection';
import { ColorsSection } from './sections/ColorsSection';
import { TypographySection } from './sections/TypographySection';
import { TagsSection } from './sections/TagsSection';
import { TokensSection } from './sections/TokensSection';
import { EditorialSection } from './sections/EditorialSection';
import { AccessibilitySection } from './sections/AccessibilitySection';
import { MediaSection } from './sections/MediaSection';
import { LogosSection } from './sections/LogosSection';
import { StrategySection } from './sections/StrategySection';
import { FigmaLinkSection } from './sections/FigmaLinkSection';
import { KnowledgeSection } from './sections/KnowledgeSection';
import { GradientSection } from './sections/GradientSection';
import { ShadowSection } from './sections/ShadowSection';
import { MotionSection } from './sections/MotionSection';
import { BorderSection } from './sections/BorderSection';
import { GuidelineExportBar } from './GuidelineExportBar';

interface GuidelineDetailProps {
  guideline: BrandGuideline;
  activeSections: string[];
  onOpenWizard: () => void;
  onStartReview?: () => void;
}

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

export const GuidelineDetail: React.FC<GuidelineDetailProps> = ({
  guideline,
  activeSections,
  onOpenWizard,
  onStartReview,
}) => {
  const { t } = useTranslation();
  const updateMutation = useUpdateGuideline();
  const deleteMutation = useDeleteGuideline();
  const ingestMutation = useIngestGuideline();

  // Local state for media (live updates without refetch)
  const [localMedia, setLocalMedia] = useState(guideline.media || []);
  const [localLogos, setLocalLogos] = useState(guideline.logos || []);

  // Sync local media/logos when guideline changes
  React.useEffect(() => {
    setLocalMedia(guideline.media || []);
    setLocalLogos(guideline.logos || []);
  }, [guideline.id]);

  // DnD
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const DEFAULT_BLOCKS = ['identity', 'strategy', 'logos', 'colors', 'typography', 'figma', 'tags', 'tokens', 'gradients', 'shadows', 'motion', 'borders', 'editorial', 'accessibility', 'media', 'knowledge'];

  const [orderedBlocks, setOrderedBlocks] = useState<string[]>(() => {
    const saved = localStorage.getItem('brand_guidelines_block_order');
    return guideline.orderedBlocks || (saved ? JSON.parse(saved) : DEFAULT_BLOCKS);
  });

  React.useEffect(() => {
    setOrderedBlocks(guideline.orderedBlocks || DEFAULT_BLOCKS);
  }, [guideline.id]);

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setOrderedBlocks((items) => {
        const oldIndex = items.indexOf(active.id);
        const newIndex = items.indexOf(over.id);
        const newOrder = arrayMove(items, oldIndex, newIndex);
        localStorage.setItem('brand_guidelines_block_order', JSON.stringify(newOrder));
        handleUpdate({ orderedBlocks: newOrder });
        return newOrder;
      });
    }
  };

  const handleUpdate = (patch: Partial<BrandGuideline>) => {
    if (!guideline.id) return;
    updateMutation.mutate({ id: guideline.id, data: patch });
  };

  const handleReIngest = () => {
    if (!guideline.id || !guideline.identity?.website) return;
    toast.info(t('mockup.brandWizardExtracting'));
    ingestMutation.mutate({ id: guideline.id, payload: { source: 'url', url: guideline.identity.website } });
  };

  const handleDelete = () => {
    if (!guideline.id) return;
    deleteMutation.mutate(guideline.id);
  };

  const renderSection = (blockId: string) => {
    if (!activeSections.includes(blockId)) return null;

    switch (blockId) {
      case 'identity':
        return (
          <IdentitySection
            key="identity"
            guideline={guideline}
            onUpdate={handleUpdate}
            onReIngest={guideline.identity?.website ? handleReIngest : undefined}
            onOpenWizard={onOpenWizard}
            onDelete={handleDelete}
            isDeleting={deleteMutation.isPending}
            span="full"
          />
        );
      case 'strategy':
        return <StrategySection key="strategy" guideline={guideline} onUpdate={handleUpdate} span="full" />;
      case 'logos':
        return <LogosSection key="logos" guideline={guideline} logos={localLogos} onLogosChange={setLocalLogos} span="1" />;
      case 'colors':
        return <ColorsSection key="colors" guideline={guideline} onUpdate={handleUpdate} span="1" />;
      case 'typography':
        return <TypographySection key="typography" guideline={guideline} onUpdate={handleUpdate} span="full" />;
      case 'tags':
        return <TagsSection key="tags" guideline={guideline} onUpdate={handleUpdate} span="1" />;
      case 'editorial':
        return <EditorialSection key="editorial" guideline={guideline} onUpdate={handleUpdate} span="full" />;
      case 'tokens':
        return <TokensSection key="tokens" guideline={guideline} onUpdate={handleUpdate} span="1" />;
      case 'accessibility':
        return <AccessibilitySection key="accessibility" guideline={guideline} onUpdate={handleUpdate} span="1" />;
      case 'media':
        return (
          <MediaSection
            key="media"
            guidelineId={guideline.id!}
            media={localMedia}
            logos={localLogos}
            onMediaChange={setLocalMedia}
            onLogosChange={setLocalLogos}
            span="full"
          />
        );
      case 'figma':
        return <FigmaLinkSection key="figma" guideline={guideline} onUpdate={handleUpdate} span="1" />;
      case 'knowledge':
        return <KnowledgeSection key="knowledge" guideline={guideline} span="full" />;
      case 'gradients':
        return <GradientSection key="gradients" guideline={guideline} onUpdate={handleUpdate} span="1" />;
      case 'shadows':
        return <ShadowSection key="shadows" guideline={guideline} onUpdate={handleUpdate} span="1" />;
      case 'motion':
        return <MotionSection key="motion" guideline={guideline} onUpdate={handleUpdate} span="1" />;
      case 'borders':
        return <BorderSection key="borders" guideline={guideline} onUpdate={handleUpdate} span="1" />;
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={orderedBlocks} strategy={rectSortingStrategy}>
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 lg:grid-cols-2 gap-8"
          >
            {orderedBlocks.map((blockId) => (
              <React.Fragment key={blockId}>
                {renderSection(blockId)}
              </React.Fragment>
            ))}
          </motion.div>
        </SortableContext>
      </DndContext>

      <div className="flex items-center justify-between pt-2">
        {onStartReview && (
          <button
            onClick={onStartReview}
            className="flex items-center gap-2 px-3 py-2 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:border-brand-cyan/20 hover:bg-brand-cyan/5 transition-all group"
          >
            <ClipboardCheck size={13} className="text-neutral-600 group-hover:text-brand-cyan transition-colors" />
            <span className="text-[10px] font-mono text-neutral-600 group-hover:text-brand-cyan transition-colors uppercase tracking-widest">Review Design System</span>
          </button>
        )}
        <div className="ml-auto">
          <GuidelineExportBar guideline={guideline} />
        </div>
      </div>
    </div>
  );
};
