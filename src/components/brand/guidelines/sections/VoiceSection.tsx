import React, { useCallback } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { SectionBlock } from '../SectionBlock';
import { Input } from '@/components/ui/input';
import { MicroTitle } from '@/components/ui/MicroTitle';
import { Select } from '@/components/ui/select';
import { AiFieldButton } from '../AiFieldButton';
import { Button } from '@/components/ui/button';
import { MessageCircle, Plus, Trash2 } from '@/lib/ui/icons';
import type { BrandGuideline, BrandToneOfVoiceValue, BrandCopyExample } from '@/lib/figma-types';

interface VoiceSectionProps {
  guideline: BrandGuideline;
  onUpdate: (data: Partial<BrandGuideline>) => void;
  span?: string;
}

const COPY_TYPE_OPTIONS = [
  { value: 'headline', label: 'brandEditor.copyHeadline' },
  { value: 'tagline', label: 'brandView.tagline' },
  { value: 'cta', label: 'brandEditor.copyCta' },
  { value: 'body', label: 'brandEditor.copyBody' },
];

export const VoiceSection: React.FC<VoiceSectionProps> = ({ guideline, onUpdate, span }) => {
  const { t } = useTranslation();
  const values = guideline.strategy?.voiceValues || [];
  const copies = guideline.strategy?.copyExamples || [];

  const persist = useCallback(
    (next: BrandToneOfVoiceValue[]) => {
      onUpdate({ strategy: { ...guideline.strategy, voiceValues: next } });
    },
    [onUpdate, guideline.strategy]
  );

  const persistCopies = useCallback(
    (next: BrandCopyExample[]) => {
      onUpdate({ strategy: { ...guideline.strategy, copyExamples: next } });
    },
    [onUpdate, guideline.strategy]
  );

  const add = () => persist([...values, { title: '', description: '', example: '' }]);

  const set = (i: number, patch: Partial<BrandToneOfVoiceValue>) =>
    persist(values.map((v, idx) => (idx === i ? { ...v, ...patch } : v)));

  const remove = (i: number) => persist(values.filter((_, idx) => idx !== i));

  const addCopy = () => persistCopies([...copies, { text: '', type: 'headline' }]);

  const setCopy = (i: number, patch: Partial<BrandCopyExample>) =>
    persistCopies(copies.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));

  const removeCopy = (i: number) => persistCopies(copies.filter((_, idx) => idx !== i));

  const handleAiResult = useCallback(
    (patch: Record<string, any>) => {
      const v = patch.strategy?.voiceValues;
      if (Array.isArray(v)) persist(v);
    },
    [persist]
  );

  return (
    <SectionBlock
      id="voice"
      icon={<MessageCircle size={14} />}
      title={t('brandView.voice')}
      span={span as any}
      actions={
        <div className="flex items-center gap-1">
          {values.length === 0 && (
            <AiFieldButton
              guideline={guideline}
              section="strategy.voiceValues"
              onResult={handleAiResult}
            />
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5"
            onClick={add}
            aria-label={t('brandEditor.addTone')}
          >
            <Plus size={11} />
          </Button>
        </div>
      }
    >
      <div className="space-y-0 py-1">
        {values.length === 0 && (
          <p className="text-2xs text-muted-foreground/50 py-2">{t('brandEditor.noVoiceAdd')}</p>
        )}
        {values.map((v, i) => (
          <div
            key={i}
            className="flex gap-3 items-start py-2.5 border-b border-border last:border-0 group/item"
          >
            <div className="flex-1 min-w-0 space-y-1">
              <Input
                value={v.title}
                onChange={(e) => set(i, { title: e.target.value })}
                className="h-6 bg-transparent border-none px-0 text-xs font-medium text-foreground focus-visible:ring-0 placeholder:text-muted-foreground"
                placeholder={t('brandEditor.toneName')}
              />
              <Input
                value={v.description}
                onChange={(e) => set(i, { description: e.target.value })}
                className="h-6 bg-transparent border-none px-0 text-xs text-muted-foreground focus-visible:ring-0 placeholder:text-muted-foreground/50"
                placeholder={t('brandEditor.toneSounds')}
              />
              <Input
                value={v.example}
                onChange={(e) => set(i, { example: e.target.value })}
                className="h-6 bg-transparent border-none px-0 text-xs text-muted-foreground/70 italic focus-visible:ring-0 placeholder:text-muted-foreground/50"
                placeholder={t('brandEditor.toneExample')}
              />
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground/50 hover:text-destructive opacity-0 group-hover/item:opacity-100 transition-[color,background-color,border-color,opacity] shrink-0 mt-0.5"
              onClick={() => remove(i)}
              aria-label={t('common.remove')}
            >
              <Trash2 size={10} />
            </Button>
          </div>
        ))}
      </div>

      {/* Copy examples — real shipped copy, fed to generation as few-shot. */}
      <div className="space-y-1.5 pt-3 mt-2 border-t border-border">
        <div className="flex items-center justify-between">
          <MicroTitle className="text-muted-foreground/70">{t('brandView.copyExamples')}</MicroTitle>
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5"
            onClick={addCopy}
            aria-label={t('brandEditor.addCopyExample')}
          >
            <Plus size={11} />
          </Button>
        </div>
        {copies.length === 0 && (
          <p className="text-2xs text-muted-foreground/50 py-1">
            {t('brandEditor.copyExamplesHint')}
          </p>
        )}
        {copies.map((c, i) => (
          <div key={i} className="flex gap-2 items-center group/copy">
            <Select
              options={COPY_TYPE_OPTIONS.map((o) => ({ ...o, label: t(o.label) }))}
              value={c.type || 'headline'}
              onChange={(value) => setCopy(i, { type: value as BrandCopyExample['type'] })}
              className="w-24 shrink-0"
            />
            <Input
              value={c.text}
              onChange={(e) => setCopy(i, { text: e.target.value })}
              className="h-6 bg-transparent border-none px-0 text-xs text-muted-foreground focus-visible:ring-0 placeholder:text-muted-foreground/50"
              placeholder={t('brandEditor.copyExamplePlaceholder')}
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground/50 hover:text-destructive opacity-0 group-hover/copy:opacity-100 transition-[color,background-color,border-color,opacity] shrink-0"
              onClick={() => removeCopy(i)}
              aria-label={t('brandEditor.removeCopyExample')}
            >
              <Trash2 size={10} />
            </Button>
          </div>
        ))}
      </div>
    </SectionBlock>
  );
};
