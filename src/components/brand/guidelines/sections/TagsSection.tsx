import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { SectionBlock } from '../SectionBlock';
import { Textarea } from '@/components/ui/textarea';
import { MicroTitle } from '@/components/ui/MicroTitle';
import { Button } from '@/components/ui/button';
import { Tag, CircleAlert, Plus } from 'lucide-react';
import { motion } from 'framer-motion';
import type { BrandGuideline } from '@/lib/figma-types';

interface TagsSectionProps {
  guideline: BrandGuideline;
  onUpdate: (data: Partial<BrandGuideline>) => void;
  span?: string;
}

export const TagsSection: React.FC<TagsSectionProps> = ({ guideline, onUpdate, span }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [tagsJson, setTagsJson] = useState('');

  useEffect(() => {
    setTagsJson(JSON.stringify(guideline.tags || {}, null, 2));
  }, [guideline.id]);

  const handleSave = () => {
    try {
      const tags = JSON.parse(tagsJson);
      onUpdate({ tags });
      setIsEditing(false);
    } catch {
      // Invalid JSON, don't save
    }
  };

  return (
    <SectionBlock
      id="tags"
      icon={<Tag size={14} />}
      title="Strategy"
      isEditing={isEditing}
      onEdit={() => setIsEditing(true)}
      onSave={handleSave}
      onCancel={() => { setTagsJson(JSON.stringify(guideline.tags || {}, null, 2)); setIsEditing(false); }}
      span={span as any}
      actions={(
        <Button variant="ghost" size="icon" className="h-6 w-6 text-neutral-500 hover:text-white"
          onClick={() => {
            if (!isEditing) setIsEditing(true);
          }}>
          <Plus size={12} />
        </Button>
      )}
    >
      <div className="flex flex-col gap-4 py-2">
        {isEditing ? (
          <div className="w-full space-y-4 pt-2">
            <Textarea
              value={tagsJson}
              onChange={(e) => setTagsJson(e.target.value)}
              className="text-[10px] font-mono bg-neutral-850 border-white/5 min-h-[140px] focus:border-brand-cyan/20 transition-all"
              placeholder='{"Category": ["Value"]}'
            />
            <div className="flex items-center gap-2">
              <CircleAlert size={10} className="text-neutral-700" />
              <p className="text-[8px] text-neutral-700 font-mono uppercase tracking-widest leading-none">Format: JSON Object required</p>
            </div>
          </div>
        ) : (
          <div className="space-y-8 py-4 px-2">
            {guideline.tags && Object.entries(guideline.tags).length > 0 ? (
              Object.entries(guideline.tags).map(([cat, vals]: any) => (
                <div key={cat} className="space-y-4">
                  <div className="flex items-center gap-4">
                    <span className="text-[10px] font-bold font-mono text-brand-cyan/60 uppercase tracking-[0.3em] shrink-0">{cat}</span>
                    <div className="h-[1px] flex-1 bg-white/[0.03]" />
                  </div>
                  <div className="flex flex-wrap gap-2.5">
                    {vals.map((v: string, j: number) => (
                      <motion.span
                        key={`${cat}-${j}`}
                        whileHover={{ y: -2, backgroundColor: 'rgba(var(--brand-cyan-rgb), 0.08)', borderColor: 'rgba(var(--brand-cyan-rgb), 0.3)' }}
                        className="px-4 py-2 rounded-xl bg-neutral-900/40 border border-white/[0.03] text-[11px] text-neutral-300 transition-all cursor-default font-medium tracking-tight flex items-center gap-2.5 shadow-sm group/tag"
                      >
                        <div className="w-1.5 h-1.5 rounded-full bg-brand-cyan/30 group-hover/tag:bg-brand-cyan transition-colors" />
                        {v}
                      </motion.span>
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <div className="py-16 flex flex-col items-center justify-center opacity-5 gap-4 border border-dashed border-white/5 rounded-3xl">
                <Tag size={32} strokeWidth={1} />
                <p className="text-[10px] text-white font-bold font-mono uppercase tracking-[0.4em]">Strategy Pending</p>
              </div>
            )}
          </div>
        )}
      </div>
    </SectionBlock>
  );
};
