import React, { useCallback } from 'react';
import { SectionBlock } from '../SectionBlock';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { MessageCircle, Plus, Trash2 } from 'lucide-react';
import type { BrandGuideline, BrandToneOfVoiceValue } from '@/lib/figma-types';

interface VoiceSectionProps {
  guideline: BrandGuideline;
  onUpdate: (data: Partial<BrandGuideline>) => void;
  span?: string;
}

export const VoiceSection: React.FC<VoiceSectionProps> = ({ guideline, onUpdate, span }) => {
  const values = guideline.strategy?.voiceValues || [];

  const persist = useCallback((next: BrandToneOfVoiceValue[]) => {
    onUpdate({ strategy: { ...guideline.strategy, voiceValues: next } });
  }, [onUpdate, guideline.strategy]);

  const add = () => persist([...values, { title: '', description: '', example: '' }]);

  const set = (i: number, patch: Partial<BrandToneOfVoiceValue>) =>
    persist(values.map((v, idx) => idx === i ? { ...v, ...patch } : v));

  const remove = (i: number) => persist(values.filter((_, idx) => idx !== i));

  return (
    <SectionBlock
      id="voice"
      icon={<MessageCircle size={14} />}
      title="Tone of Voice"
      span={span as any}
      actions={
        <Button variant="ghost" size="icon" className="h-5 w-5" onClick={add} aria-label="Add tone">
          <Plus size={11} />
        </Button>
      }
    >
      <div className="space-y-0 py-1">
        {values.length === 0 && (
          <p className="text-[11px] text-neutral-700 py-2">No voice values yet. Click + to add.</p>
        )}
        {values.map((v, i) => (
          <div key={i} className="flex gap-3 items-start py-2.5 border-b border-white/[0.04] last:border-0 group/item">
            <div className="flex-1 min-w-0 space-y-1">
              <Input
                value={v.title}
                onChange={(e) => set(i, { title: e.target.value })}
                className="h-6 bg-transparent border-none px-0 text-xs font-semibold text-neutral-200 focus-visible:ring-0 placeholder:text-neutral-700"
                placeholder="Tom (ex: Direto, Inspirador)"
              />
              <Input
                value={v.description}
                onChange={(e) => set(i, { description: e.target.value })}
                className="h-6 bg-transparent border-none px-0 text-xs text-neutral-400 focus-visible:ring-0 placeholder:text-neutral-700"
                placeholder="Como soa..."
              />
              <Input
                value={v.example}
                onChange={(e) => set(i, { example: e.target.value })}
                className="h-6 bg-transparent border-none px-0 text-xs text-neutral-600 italic focus-visible:ring-0 placeholder:text-neutral-800"
                placeholder='"Frase de exemplo..."'
              />
            </div>
            <Button
              variant="ghost" size="icon"
              className="h-6 w-6 text-neutral-700 hover:text-red-400 opacity-0 group-hover/item:opacity-100 transition-all shrink-0 mt-0.5"
              onClick={() => remove(i)} aria-label="Remove"
            >
              <Trash2 size={10} />
            </Button>
          </div>
        ))}
      </div>
    </SectionBlock>
  );
};
