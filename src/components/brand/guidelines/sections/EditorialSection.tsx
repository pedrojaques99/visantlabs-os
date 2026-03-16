import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { editorialSchema } from '@/schemas/brandGuideline.schema';
import { SectionBlock } from '../SectionBlock';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { MicroTitle } from '@/components/ui/MicroTitle';
import { Button } from '@/components/ui/button';
import { FileText, CheckCircle2, Plus } from 'lucide-react';
import type { BrandGuideline } from '@/lib/figma-types';

interface EditorialSectionProps {
  guideline: BrandGuideline;
  onUpdate: (data: Partial<BrandGuideline>) => void;
  span?: string;
}

export const EditorialSection: React.FC<EditorialSectionProps> = ({ guideline, onUpdate, span }) => {
  const [isEditing, setIsEditing] = useState(false);
  const form = useForm({
    resolver: zodResolver(editorialSchema),
    defaultValues: {
      voice: guideline.guidelines?.voice || '',
      dos: guideline.guidelines?.dos || [],
      accessibility: guideline.guidelines?.accessibility || '',
    },
  });
  const [dosText, setDosText] = useState('');

  useEffect(() => {
    const g = guideline.guidelines || {};
    form.reset({ voice: g.voice || '', dos: g.dos || [], accessibility: g.accessibility || '' });
    setDosText((g.dos || []).join('\n'));
  }, [guideline.id]);

  const handleSave = () => {
    const voice = form.getValues('voice');
    const accessibility = form.getValues('accessibility');
    const dos = dosText.split('\n').filter(l => l.trim() !== '');
    onUpdate({ guidelines: { ...guideline.guidelines, voice, dos, accessibility } });
    setIsEditing(false);
  };

  return (
    <SectionBlock
      id="editorial"
      icon={<FileText size={14} />}
      title="Editorial"
      isEditing={isEditing}
      onEdit={() => setIsEditing(true)}
      onSave={handleSave}
      onCancel={() => { form.reset(); setDosText((guideline.guidelines?.dos || []).join('\n')); setIsEditing(false); }}
      span={span as any}
      expandedContent={(guideline.guidelines?.voice || (guideline.guidelines?.dos && guideline.guidelines.dos.length > 0)) ? (
        <div className="space-y-6">
          {guideline.guidelines?.voice && (
            <div className="p-5 rounded-2xl bg-brand-cyan/[0.03] border border-brand-cyan/10">
              <span className="text-[9px] font-mono text-brand-cyan/60 uppercase font-bold block mb-2">Voice & Tone</span>
              <p className="text-[14px] text-white/90 font-medium leading-relaxed italic">"{guideline.guidelines.voice}"</p>
            </div>
          )}
          {guideline.guidelines?.dos && guideline.guidelines.dos.length > 0 && (
            <div className="space-y-3">
              <span className="text-[10px] font-mono text-brand-cyan/60 uppercase font-bold">Best Practices</span>
              <div className="space-y-2">
                {guideline.guidelines.dos.map((item: string, i: number) => (
                  <div key={i} className="text-[12px] text-neutral-300 flex items-start gap-3 p-4 rounded-xl border border-white/[0.04] hover:border-brand-cyan/20 transition-all">
                    <CheckCircle2 size={16} className="text-brand-cyan/50 shrink-0 mt-0.5" />
                    <span className="leading-relaxed font-medium">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
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
      <div className="space-y-6 py-2">
        {isEditing ? (
          <div className="space-y-5">
            <div className="space-y-1.5">
              <MicroTitle className="text-[9px] opacity-40 uppercase pl-1">Voice Tone</MicroTitle>
              <Input
                {...form.register('voice')}
                className="text-xs h-9 bg-neutral-850 border-white/5 focus:border-brand-cyan/30"
                placeholder="Brand Personality..."
              />
            </div>
            <div className="space-y-1.5">
              <MicroTitle className="text-[9px] opacity-40 uppercase pl-1">Do's (one per line)</MicroTitle>
              <Textarea
                value={dosText}
                onChange={(e) => setDosText(e.target.value)}
                className="text-xs bg-neutral-850 border-white/5 min-h-[100px] focus:border-brand-cyan/30"
                placeholder="Positive guidelines..."
              />
            </div>
          </div>
        ) : (
          <>
            {guideline.guidelines?.voice && (
              <div className="relative group/voice overflow-hidden rounded-xl bg-brand-cyan/[0.02] border border-brand-cyan/10 p-4">
                <MicroTitle className="block mb-1.5 opacity-50 uppercase text-[8px] font-bold">Voice & Tone</MicroTitle>
                <p className="text-[12px] text-white/90 font-medium leading-relaxed italic">"{guideline.guidelines.voice}"</p>
              </div>
            )}
            <div className="space-y-2 mt-3">
              <div className="flex items-center gap-3 mb-1">
                <span className="text-[9px] font-bold font-mono text-neutral-600 uppercase opacity-40">Best Practices</span>
                <div className="h-[1px] flex-1 bg-white/[0.02]" />
              </div>
              {guideline.guidelines?.dos && guideline.guidelines.dos.length > 0 ? (
                guideline.guidelines.dos.map((item: string, i: number) => (
                  <div key={i} className="text-[11px] text-neutral-400 flex items-start gap-3 p-3 rounded-xl border border-white/[0.03] hover:border-brand-cyan/20 hover:bg-white/[0.01] transition-all duration-300 group/item">
                    <CheckCircle2 size={14} className="text-brand-cyan/50 shrink-0 mt-0.5" />
                    <span className="leading-5 font-medium tracking-tight text-neutral-300 group-hover/item:text-white transition-colors">{item}</span>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center opacity-5 italic text-[10px] font-mono uppercase border border-dashed border-white/5 rounded-2xl">Editorial Framework Pending</div>
              )}
            </div>
          </>
        )}
      </div>
    </SectionBlock>
  );
};
