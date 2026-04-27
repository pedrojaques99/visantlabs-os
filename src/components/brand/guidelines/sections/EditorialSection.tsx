import React, { useCallback } from 'react';
import { SectionBlock } from '../SectionBlock';
import { Input } from '@/components/ui/input';
import { MicroTitle } from '@/components/ui/MicroTitle';
import { FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { BrandGuideline } from '@/lib/figma-types';
import { InlineTags } from '../InlineTags';

type Person = 'first' | 'second' | 'third';
type EmojiPolicy = 'none' | 'informal' | 'free';

const PERSON_OPTIONS: { value: Person; label: string }[] = [
  { value: 'first', label: '1st' },
  { value: 'second', label: '2nd' },
  { value: 'third', label: '3rd' },
];

const EMOJI_OPTIONS: { value: EmojiPolicy; label: string }[] = [
  { value: 'none', label: 'Never' },
  { value: 'informal', label: 'Informal' },
  { value: 'free', label: 'Free' },
];

interface EditorialSectionProps {
  guideline: BrandGuideline;
  onUpdate: (data: Partial<BrandGuideline>) => void;
  span?: string;
}

type LocalState = {
  voice: string;
  dos: string[];
  casingRules: string[];
  person: Person | undefined;
  emojiPolicy: EmojiPolicy | undefined;
};

export const EditorialSection: React.FC<EditorialSectionProps> = ({ guideline, onUpdate, span }) => {
  const g = guideline.guidelines || {};
  const local: LocalState = {
    voice: g.voice || '',
    dos: g.dos || [],
    casingRules: g.casingRules || [],
    person: g.person,
    emojiPolicy: g.emojiPolicy,
  };

  const persist = useCallback((state: LocalState) => {
    onUpdate({ guidelines: {
      ...guideline.guidelines,
      voice: state.voice,
      dos: state.dos,
      casingRules: state.casingRules,
      person: state.person,
      emojiPolicy: state.emojiPolicy,
    }});
  }, [onUpdate, guideline.guidelines]);

  const update = (patch: Partial<LocalState>) => {
    const next = { ...local, ...patch };
    persist(next);
  };

  return (
    <SectionBlock id="editorial" icon={<FileText size={14} />} title="Editorial" span={span as any}>
      <div className="space-y-3 py-1">
        {/* Voice */}
        <div className="space-y-1">
          <MicroTitle className="text-neutral-600">Voice</MicroTitle>
          <Input
            value={local.voice}
            onChange={(e) => update({ voice: e.target.value })}
            className="h-7 border-white/5 text-xs text-neutral-400 placeholder:text-neutral-700"
            placeholder="Brand personality..."
          />
        </div>

        {/* Person + Emoji */}
        <div className="flex gap-3">
          <div className="space-y-1 flex-1">
            <MicroTitle className="text-neutral-600">Person</MicroTitle>
            <div className="flex gap-1">
              {PERSON_OPTIONS.map(opt => (
                <button key={opt.value} type="button" onClick={() => update({ person: opt.value })}
                  className={cn('flex-1 h-6 rounded border text-[10px] font-mono transition-all',
                    local.person === opt.value
                      ? 'border-white/20 bg-white/[0.06] text-neutral-200'
                      : 'border-white/5 text-neutral-600 hover:border-white/10 hover:text-neutral-400'
                  )}
                >{opt.label}</button>
              ))}
            </div>
          </div>
          <div className="space-y-1 flex-1">
            <MicroTitle className="text-neutral-600">Emoji</MicroTitle>
            <div className="flex gap-1">
              {EMOJI_OPTIONS.map(opt => (
                <button key={opt.value} type="button" onClick={() => update({ emojiPolicy: opt.value })}
                  className={cn('flex-1 h-6 rounded border text-[10px] font-mono transition-all',
                    local.emojiPolicy === opt.value
                      ? 'border-white/20 bg-white/[0.06] text-neutral-200'
                      : 'border-white/5 text-neutral-600 hover:border-white/10 hover:text-neutral-400'
                  )}
                >{opt.label}</button>
              ))}
            </div>
          </div>
        </div>

        {/* Casing rules */}
        <div className="space-y-1.5">
          <MicroTitle className="text-neutral-600">Casing rules</MicroTitle>
          <InlineTags
            values={local.casingRules}
            onChange={(next) => update({ casingRules: next })}
            placeholder="ex: ALL CAPS"
            inputWidth={120}
          />
        </div>

        {/* Do's */}
        <div className="space-y-1.5">
          <MicroTitle className="text-neutral-600">Do's</MicroTitle>
          <InlineTags
            values={local.dos}
            onChange={(next) => update({ dos: next })}
            placeholder="Best practice..."
            inputWidth={180}
          />
        </div>
      </div>
    </SectionBlock>
  );
};
