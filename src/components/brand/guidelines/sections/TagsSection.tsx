import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { SectionBlock } from '../SectionBlock';
import { Textarea } from '@/components/ui/textarea';
import { MicroTitle } from '@/components/ui/MicroTitle';
import { Tag, CircleAlert } from 'lucide-react';
import { motion } from 'framer-motion';
import type { BrandGuideline } from '@/lib/figma-types';

interface TagsSectionProps {
  guideline: BrandGuideline;
  onUpdate: (data: Partial<BrandGuideline>) => void;
}

export const TagsSection: React.FC<TagsSectionProps> = ({ guideline, onUpdate }) => {
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
          <div className="space-y-4">
            {guideline.tags && Object.entries(guideline.tags).length > 0 ? (
              Object.entries(guideline.tags).map(([cat, vals]: any) => (
                <div key={cat} className="space-y-2">
                  <div className="flex items-center gap-2 px-1">
                    <span className="text-[8px] font-mono text-neutral-700 uppercase tracking-widest font-bold opacity-50">{cat}</span>
                    <div className="h-[1px] flex-1 bg-white/[0.02]" />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {vals.map((v: string, j: number) => (
                      <motion.span
                        key={`${cat}-${j}`}
                        whileHover={{ scale: 1.05, backgroundColor: 'rgba(var(--brand-cyan-rgb), 0.1)' }}
                        className="px-2.5 py-1 rounded-md bg-white/[0.03] border border-white/5 text-[10px] text-neutral-400 hover:text-brand-cyan hover:border-brand-cyan/30 transition-all cursor-default font-mono flex items-center gap-1.5 shadow-sm"
                      >
                        <div className="w-1 h-1 rounded-full bg-brand-cyan/40" />
                        {v}
                      </motion.span>
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <div className="py-12 flex flex-col items-center justify-center opacity-10 gap-2 border border-dashed border-white/5 rounded-2xl">
                <Tag size={20} strokeWidth={1} />
                <p className="text-[10px] text-neutral-900 italic font-mono uppercase tracking-widest">No Strategy Assets</p>
              </div>
            )}
          </div>
        )}
      </div>
    </SectionBlock>
  );
};
