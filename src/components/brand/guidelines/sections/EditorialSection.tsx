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
              <MicroTitle className="text-[9px] opacity-40 uppercase tracking-widest pl-1">Voice Tone</MicroTitle>
              <Input
                {...form.register('voice')}
                className="text-xs h-9 bg-neutral-850 border-white/5 focus:border-brand-cyan/30"
                placeholder="Brand Personality..."
              />
            </div>
            <div className="space-y-1.5">
              <MicroTitle className="text-[9px] opacity-40 uppercase tracking-widest pl-1">Do's (one per line)</MicroTitle>
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
              <div className="relative group/voice overflow-hidden rounded-2xl bg-brand-cyan/[0.02] border border-brand-cyan/10 p-5 shadow-inner">
                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover/voice:opacity-20 transition-opacity">
                  <FileText size={40} />
                </div>
                <MicroTitle className="block mb-2 opacity-50 uppercase text-[8px] tracking-[0.2em] font-bold">Voice & Tone</MicroTitle>
                <p className="text-sm text-white/90 font-medium leading-relaxed italic pr-10">"{guideline.guidelines.voice}"</p>
              </div>
            )}
            <div className="grid grid-cols-1 gap-3 mt-4 px-1">
              <div className="flex items-center gap-4 mb-2">
                <span className="text-[10px] font-bold font-mono text-neutral-600 uppercase tracking-[0.3em] opacity-40">Best Practices</span>
                <div className="h-[1px] flex-1 bg-white/[0.02]" />
              </div>
              {guideline.guidelines?.dos && guideline.guidelines.dos.length > 0 ? (
                guideline.guidelines.dos.slice(0, 5).map((item: string, i: number) => (
                   <div key={i} className="text-[12px] text-neutral-400 flex items-start gap-4 bg-neutral-900/40 p-4 rounded-2xl border border-white/[0.03] hover:border-brand-cyan/20 hover:bg-neutral-900/60 transition-all duration-500 group/item shadow-sm">
                    <div className="w-6 h-6 rounded-full bg-brand-cyan/5 flex items-center justify-center shrink-0 border border-brand-cyan/10 group-hover/item:border-brand-cyan/30 transition-all shadow-inner">
                      <CheckCircle2 size={12} className="text-brand-cyan/70" />
                    </div>
                    <span className="leading-6 font-medium tracking-tight text-neutral-300 group-hover/item:text-white transition-colors">{item}</span>
                  </div>
                ))
              ) : (
                <div className="py-12 text-center opacity-5 italic text-[10px] font-mono tracking-widest uppercase border border-dashed border-white/5 rounded-3xl">Editorial Framework Pending</div>
              )}
            </div>
          </>
        )}
      </div>
    </SectionBlock>
  );
};
