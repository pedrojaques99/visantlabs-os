import React, { useCallback } from 'react';
import { SectionBlock } from '../SectionBlock';
import { Textarea } from '@/components/ui/textarea';
import { ShieldCheck } from 'lucide-react';
import type { BrandGuideline } from '@/lib/figma-types';

interface AccessibilitySectionProps {
  guideline: BrandGuideline;
  onUpdate: (data: Partial<BrandGuideline>) => void;
  span?: string;
}

export const AccessibilitySection: React.FC<AccessibilitySectionProps> = ({ guideline, onUpdate, span }) => {
  // No local state — draft is owned by GuidelineDetail via useBrandGuidelineDraft
  const text = guideline.guidelines?.accessibility || '';

  const persist = useCallback((value: string) => {
    onUpdate({ guidelines: { ...guideline.guidelines, accessibility: value } });
  }, [onUpdate, guideline.guidelines]);

  return (
    <SectionBlock id="accessibility" span={span as any} icon={<ShieldCheck size={14} />} title="Accessibility">
      <Textarea
        value={text}
        onChange={(e) => persist(e.target.value)}
        className="border-white/5 text-xs min-h-[100px] resize-none text-neutral-400 placeholder:text-neutral-700"
        placeholder="Accessibility guidelines and universal design standards..."
      />
    </SectionBlock>
  );
};
