import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { SectionBlock } from '../SectionBlock';
import { Textarea } from '@/components/ui/textarea';
import { MicroTitle } from '@/components/ui/MicroTitle';
import { Button } from '@/components/ui/button';
import { ShieldCheck, Plus } from 'lucide-react';
import type { BrandGuideline } from '@/lib/figma-types';

interface AccessibilitySectionProps {
  guideline: BrandGuideline;
  onUpdate: (data: Partial<BrandGuideline>) => void;
  span?: string;
}

export const AccessibilitySection: React.FC<AccessibilitySectionProps> = ({ guideline, onUpdate, span }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [text, setText] = useState(guideline.guidelines?.accessibility || '');

  useEffect(() => {
    setText(guideline.guidelines?.accessibility || '');
  }, [guideline.id]);

  const handleSave = () => {
    onUpdate({ guidelines: { ...guideline.guidelines, accessibility: text } });
    setIsEditing(false);
  };

  return (
    <SectionBlock
      id="accessibility"
      span={span as any}
      icon={<ShieldCheck size={14} />}
      title="Accessibility Core"
      isEditing={isEditing}
      onEdit={() => setIsEditing(true)}
      onSave={handleSave}
      onCancel={() => { setText(guideline.guidelines?.accessibility || ''); setIsEditing(false); }}
      expandedContent={guideline.guidelines?.accessibility ? (
        <div className="space-y-4">
          <div className="p-5 rounded-2xl bg-neutral-950/30 border border-white/[0.04]">
            <span className="text-[9px] font-mono text-brand-cyan/60 uppercase tracking-widest font-bold block mb-3">Compliance & Vision</span>
            <p className="text-[13px] text-neutral-300 leading-relaxed whitespace-pre-wrap">{guideline.guidelines.accessibility}</p>
          </div>
        </div>
      ) : undefined}
      actions={(
        <Button variant="ghost" size="icon" className="h-6 w-6 text-neutral-500 hover:text-white"
          onClick={() => {
            if (!isEditing) setIsEditing(true);
          }}>
          <Plus size={12} />
        </Button>
      )}
    >
      <div className="py-4">
        {isEditing ? (
          <div className="space-y-2 pt-2">
            <MicroTitle className="text-[9px] opacity-300 uppercase tracking-widest pl-1">Compliance & Vision</MicroTitle>
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="text-xs bg-neutral-900/50 border-white/5 min-h-[120px] focus:border-brand-cyan/20 p-4 leading-relaxed"
              placeholder="Accessibility guidelines and universal design standards..."
            />
          </div>
        ) : (
          <div className="space-y-1">
            <MicroTitle className="text-[9px] text-neutral-700 uppercase tracking-widest flex items-center gap-2">
              <div className="w-1 h-[1px] bg-neutral-800" />
              Compliance & Vision
            </MicroTitle>
            <p className="text-xs text-neutral-400 leading-relaxed pl-3  border-l border-white/5 max-w-2xl">
              {guideline.guidelines?.accessibility || "Universal design and accessibility standards applied across all brand touchpoints."}
            </p>
          </div>
        )}
      </div>
    </SectionBlock>
  );
};
