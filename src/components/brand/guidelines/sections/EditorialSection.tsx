import React, { useCallback } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { SectionBlock } from '../SectionBlock';
import { Input } from '@/components/ui/input';
import { MicroTitle } from '@/components/ui/MicroTitle';
import { AiFieldButton } from '../AiFieldButton';
import { FileText } from '@/lib/ui/icons';
import { cn } from '@/lib/utils';
import type { BrandGuideline } from '@/lib/figma-types';
import { InlineTags } from '../InlineTags';

type Person = 'first' | 'second' | 'third';
type EmojiPolicy = 'none' | 'informal' | 'free';

const PERSON_OPTIONS: { value: Person; label: string }[] = [
  { value: 'first', label: 'brandEditor.person1' },
  { value: 'second', label: 'brandEditor.person2' },
  { value: 'third', label: 'brandEditor.person3' },
];

const EMOJI_OPTIONS: { value: EmojiPolicy; label: string }[] = [
  { value: 'none', label: 'brandEditor.emojiNever' },
  { value: 'informal', label: 'brandEditor.emojiInformal' },
  { value: 'free', label: 'brandEditor.emojiFree' },
];

interface EditorialSectionProps {
  guideline: BrandGuideline;
  onUpdate: (data: Partial<BrandGuideline>) => void;
  span?: string;
}

type LocalState = {
  voice: string;
  dos: string[];
  donts: string[];
  casingRules: string[];
  person: Person | undefined;
  emojiPolicy: EmojiPolicy | undefined;
};

export const EditorialSection: React.FC<EditorialSectionProps> = ({
  guideline,
  onUpdate,
  span,
}) => {
  const { t } = useTranslation();
  const g = guideline.guidelines || {};
  const local: LocalState = {
    voice: g.voice || '',
    dos: g.dos || [],
    donts: g.donts || [],
    casingRules: g.casingRules || [],
    person: g.person,
    emojiPolicy: g.emojiPolicy,
  };

  const persist = useCallback(
    (state: LocalState) => {
      onUpdate({
        guidelines: {
          ...guideline.guidelines,
          voice: state.voice,
          dos: state.dos,
          donts: state.donts,
          casingRules: state.casingRules,
          person: state.person,
          emojiPolicy: state.emojiPolicy,
        },
      });
    },
    [onUpdate, guideline.guidelines]
  );

  const update = (patch: Partial<LocalState>) => {
    const next = { ...local, ...patch };
    persist(next);
  };

  const isEmpty = !local.voice && local.dos.length === 0;

  const handleAiResult = useCallback(
    (patch: Record<string, any>) => {
      const gl = patch.guidelines;
      if (!gl) return;
      const next = { ...local };
      if (gl.voice) next.voice = gl.voice;
      if (Array.isArray(gl.dos)) next.dos = gl.dos;
      if (Array.isArray(gl.donts)) next.donts = gl.donts;
      persist(next);
    },
    [persist, local]
  );

  return (
    <SectionBlock
      id="editorial"
      icon={<FileText size={14} />}
      title={t('brandEditor.editorial')}
      span={span as any}
      actions={
        isEmpty ? (
          <AiFieldButton guideline={guideline} section="guidelines" onResult={handleAiResult} />
        ) : undefined
      }
    >
      <div className="space-y-3 py-1">
        {/* Voice */}
        <div className="space-y-1">
          <MicroTitle className="text-muted-foreground/70">{t('brandEditor.voice')}</MicroTitle>
          <Input
            value={local.voice}
            onChange={(e) => update({ voice: e.target.value })}
            className="h-7 border-border text-xs text-muted-foreground placeholder:text-muted-foreground/50"
            placeholder={t('brandEditor.voicePlaceholder')}
          />
        </div>

        {/* Person + Emoji */}
        <div className="flex gap-3">
          <div className="space-y-1 flex-1">
            <MicroTitle className="text-muted-foreground/70">{t('brandEditor.person')}</MicroTitle>
            <div className="flex gap-1">
              {PERSON_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => update({ person: opt.value })}
                  className={cn(
                    'flex-1 h-6 rounded border text-2xs font-mono transition-colors',
                    local.person === opt.value
                      ? 'border-border-hover bg-muted text-foreground'
                      : 'border-border text-muted-foreground hover:border-border-hover hover:text-foreground'
                  )}
                >
                  {t(opt.label)}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1 flex-1">
            <MicroTitle className="text-muted-foreground/70">{t('brandEditor.emoji')}</MicroTitle>
            <div className="flex gap-1">
              {EMOJI_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => update({ emojiPolicy: opt.value })}
                  className={cn(
                    'flex-1 h-6 rounded border text-2xs font-mono transition-colors',
                    local.emojiPolicy === opt.value
                      ? 'border-border-hover bg-muted text-foreground'
                      : 'border-border text-muted-foreground hover:border-border-hover hover:text-foreground'
                  )}
                >
                  {t(opt.label)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Casing rules */}
        <div className="space-y-1.5">
          <MicroTitle className="text-muted-foreground/70">{t('brandEditor.casingRules')}</MicroTitle>
          <InlineTags
            values={local.casingRules}
            onChange={(next) => update({ casingRules: next })}
            placeholder={t('brandEditor.casingPlaceholder')}
            inputWidth={120}
          />
        </div>

        {/* Do's */}
        <div className="space-y-1.5">
          <MicroTitle className="text-muted-foreground/70">{t('brandEditor.dos')}</MicroTitle>
          <InlineTags
            values={local.dos}
            onChange={(next) => update({ dos: next })}
            placeholder={t('brandEditor.doPlaceholder')}
            inputWidth={180}
          />
        </div>

        {/* Don'ts */}
        <div className="space-y-1.5">
          <MicroTitle className="text-muted-foreground/70">{t('brandEditor.donts')}</MicroTitle>
          <InlineTags
            values={local.donts}
            onChange={(next) => update({ donts: next })}
            placeholder={t('brandEditor.dontPlaceholder')}
            inputWidth={180}
          />
        </div>
      </div>
    </SectionBlock>
  );
};
