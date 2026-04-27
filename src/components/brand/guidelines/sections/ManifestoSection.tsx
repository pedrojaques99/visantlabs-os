import React, { useCallback } from 'react';
import { SectionBlock } from '../SectionBlock';
import { Textarea } from '@/components/ui/textarea';
import { BookOpen } from 'lucide-react';
import type { BrandGuideline } from '@/lib/figma-types';

interface ManifestoSectionProps {
  guideline: BrandGuideline;
  onUpdate: (data: Partial<BrandGuideline>) => void;
  span?: string;
}

export const ManifestoSection: React.FC<ManifestoSectionProps> = ({ guideline, onUpdate, span }) => {
  // No local state — draft is owned by GuidelineDetail via useBrandGuidelineDraft
  const text = guideline.strategy?.manifesto || '';

  const persist = useCallback((value: string) => {
    onUpdate({ strategy: { ...guideline.strategy, manifesto: value } });
  }, [onUpdate, guideline.strategy]);

  return (
    <SectionBlock id="manifesto" icon={<BookOpen size={14} />} title="Manifesto" span={span as any}>
      <Textarea
        value={text}
        onChange={(e) => persist(e.target.value)}
        className="border-white/[0.06] bg-transparent text-sm text-neutral-300 leading-relaxed min-h-[120px] resize-none placeholder:text-neutral-700"
        placeholder="Brand manifesto..."
      />
    </SectionBlock>
  );
};
