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
import { cn } from '@/lib/utils';
import type { BrandGuideline } from '@/lib/figma-types';

type Person = 'first' | 'second' | 'third';
type EmojiPolicy = 'none' | 'informal' | 'free';

const PERSON_OPTIONS: { value: Person; label: string }[] = [
  { value: 'first', label: '1st — Nós/We' },
  { value: 'second', label: '2nd — Você/You' },
  { value: 'third', label: '3rd — Eles/They' },
];

const EMOJI_OPTIONS: { value: EmojiPolicy; label: string }[] = [
  { value: 'none', label: 'Never' },
  { value: 'informal', label: 'Informal only' },
  { value: 'free', label: 'Free use' },
];

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
  const [casingText, setCasingText] = useState('');
  const [person, setPerson] = useState<Person | undefined>(guideline.guidelines?.person);
  const [emojiPolicy, setEmojiPolicy] = useState<EmojiPolicy | undefined>(guideline.guidelines?.emojiPolicy);

  useEffect(() => {
    const g = guideline.guidelines || {};
    form.reset({ voice: g.voice || '', dos: g.dos || [], accessibility: g.accessibility || '' });
    setDosText((g.dos || []).join('\n'));
    setCasingText((g.casingRules || []).join('\n'));
    setPerson(g.person);
    setEmojiPolicy(g.emojiPolicy);
  }, [guideline.id]);

  const handleSave = () => {
    const voice = form.getValues('voice');
    const accessibility = form.getValues('accessibility');
    const dos = dosText.split('\n').filter(l => l.trim() !== '');
    const casingRules = casingText.split('\n').filter(l => l.trim() !== '');
    onUpdate({ guidelines: { ...guideline.guidelines, voice, dos, accessibility, person, emojiPolicy, casingRules } });
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
              <span className="text-[10px] font-mono text-brand-cyan/60 uppercase font-bold block mb-2">Voice & Tone</span>
              <p className="text-[14px] text-white/90 font-medium leading-relaxed ">"{guideline.guidelines.voice}"</p>
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
        <Button variant="ghost" size="icon" aria-label="Add item" className="h-6 w-6 text-neutral-500 hover:text-white"
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
              <MicroTitle className="text-[10px] opacity-100 uppercase pl-1">Voice Tone</MicroTitle>
              <Input
                {...form.register('voice')}
                className="text-xs h-9 bg-neutral-850 border-white/5 focus:border-brand-cyan/30"
                placeholder="Brand Personality..."
              />
            </div>

            <div className="space-y-1.5">
              <MicroTitle className="text-[10px] opacity-100 uppercase pl-1">Person</MicroTitle>
              <div className="flex gap-2">
                {PERSON_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setPerson(opt.value)}
                    className={cn(
                      'flex-1 h-8 rounded-lg border text-[10px] font-mono uppercase tracking-wider transition-all',
                      person === opt.value
                        ? 'border-brand-cyan/40 bg-brand-cyan/10 text-brand-cyan'
                        : 'border-white/5 bg-white/[0.02] text-neutral-500 hover:border-white/10'
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <MicroTitle className="text-[10px] opacity-100 uppercase pl-1">Emoji Policy</MicroTitle>
              <div className="flex gap-2">
                {EMOJI_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setEmojiPolicy(opt.value)}
                    className={cn(
                      'flex-1 h-8 rounded-lg border text-[10px] font-mono uppercase tracking-wider transition-all',
                      emojiPolicy === opt.value
                        ? 'border-brand-cyan/40 bg-brand-cyan/10 text-brand-cyan'
                        : 'border-white/5 bg-white/[0.02] text-neutral-500 hover:border-white/10'
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <MicroTitle className="text-[10px] opacity-100 uppercase pl-1">Casing Rules (one per line)</MicroTitle>
              <Textarea
                value={casingText}
                onChange={(e) => setCasingText(e.target.value)}
                className="text-xs bg-neutral-850 border-white/5 min-h-[60px] focus:border-brand-cyan/30"
                placeholder={'e.g. ALL CAPS for eyebrows\nSentence case for body'}
              />
            </div>

            <div className="space-y-1.5">
              <MicroTitle className="text-[10px] opacity-100 uppercase pl-1">Do's (one per line)</MicroTitle>
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
            {(guideline.guidelines?.voice || guideline.guidelines?.person || guideline.guidelines?.emojiPolicy) && (
              <div className="relative group/voice overflow-hidden rounded-xl bg-brand-cyan/[0.02] border border-brand-cyan/10 p-4 space-y-3">
                {guideline.guidelines?.voice && (
                  <>
                    <MicroTitle className="block opacity-50 uppercase text-[10px] font-bold">Voice & Tone</MicroTitle>
                    <p className="text-[12px] text-white/90 font-medium leading-relaxed">"{guideline.guidelines.voice}"</p>
                  </>
                )}
                <div className="flex gap-2 flex-wrap">
                  {guideline.guidelines?.person && (
                    <span className="px-2 py-1 rounded-md border border-brand-cyan/20 text-[10px] font-mono text-brand-cyan/70">
                      {PERSON_OPTIONS.find(o => o.value === guideline.guidelines?.person)?.label}
                    </span>
                  )}
                  {guideline.guidelines?.emojiPolicy && (
                    <span className="px-2 py-1 rounded-md border border-white/10 text-[10px] font-mono text-neutral-500">
                      Emoji: {guideline.guidelines.emojiPolicy}
                    </span>
                  )}
                </div>
                {guideline.guidelines?.casingRules && guideline.guidelines.casingRules.length > 0 && (
                  <div className="space-y-1 pt-1 border-t border-white/5">
                    {guideline.guidelines.casingRules.map((r, i) => (
                      <p key={i} className="text-[11px] text-neutral-400 font-mono">— {r}</p>
                    ))}
                  </div>
                )}
              </div>
            )}
            <div className="space-y-2 mt-3">
              {guideline.guidelines?.dos && guideline.guidelines.dos.length > 0 ? (
                guideline.guidelines.dos.map((item: string, i: number) => (
                  <div key={i} className="text-[11px] text-neutral-400 flex items-start gap-3 p-3 rounded-xl border border-white/[0.03] hover:border-brand-cyan/20 hover:bg-white/[0.01] transition-all duration-300 group/item">
                    <CheckCircle2 size={14} className="text-brand-cyan/50 shrink-0 mt-0.5" />
                    <span className="leading-5 font-medium tracking-tight text-neutral-300 group-hover/item:text-white transition-colors">{item}</span>
                  </div>
                ))
              ) : (
                <div className="py-12 text-center text-[10px] font-mono tracking-widest uppercase border border-dashed border-white/5 opacity-30">Editorial Framework Pending</div>
              )}
            </div>
          </>
        )}
      </div>
    </SectionBlock>
  );
};
