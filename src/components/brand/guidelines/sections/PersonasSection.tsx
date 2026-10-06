import React, { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { useTranslation } from '@/hooks/useTranslation';
import { SectionBlock } from '../SectionBlock';
import { Input } from '@/components/ui/input';
import { MicroTitle } from '@/components/ui/MicroTitle';
import { AiFieldButton } from '../AiFieldButton';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { User, Plus, Trash2, ImagePlus, Loader2 } from '@/lib/ui/icons';
import type { BrandGuideline, BrandPersona } from '@/lib/figma-types';
import { InlineTags } from '../InlineTags';
import { brandGuidelineApi } from '@/services/brandGuidelineApi';
import { Thumb } from '@/components/ui/Thumb';

interface PersonasSectionProps {
  guideline: BrandGuideline;
  onUpdate: (data: Partial<BrandGuideline>) => void;
  span?: string;
}

const toLines = (arr?: string[]) => (arr || []).join('\n');
const fromLines = (text: string) =>
  text
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);

const GENDERS: { value: NonNullable<BrandPersona['gender']>; label: string }[] = [
  { value: 'female', label: 'F' },
  { value: 'male', label: 'M' },
  { value: 'neutral', label: 'N' },
];

const Avatar: React.FC<{
  persona: BrandPersona;
  mediaItems: BrandGuideline['media'];
  onPickImage: (url: string) => void;
  onSetGender: (gender: BrandPersona['gender']) => void;
}> = ({ persona, mediaItems, onPickImage, onSetGender }) => {
  const { t } = useTranslation();
  const img = (persona as any).image as string | undefined;
  const initials = persona.name
    ? persona.name
        .split(' ')
        .map((w) => w[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : '?';
  const hasMedia = mediaItems && mediaItems.length > 0;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="w-10 h-10 rounded-full shrink-0 overflow-hidden border border-border bg-muted flex items-center justify-center hover:border-border-hover transition-colors"
          title={t('brandEditor.personaAvatarTitle')}
        >
          {img ? (
            <Thumb src={img} alt={persona.name} className="w-full h-full object-cover" />
          ) : (
            <span className="text-xs font-medium text-muted-foreground">{initials}</span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-52 p-1">
        {/* Gender — steers auto-resolved stock portraits */}
        <div className="flex items-center justify-between px-2 py-1.5">
          <span className="text-2xs text-muted-foreground">{t('brandEditor.stockGender')}</span>
          <div className="flex gap-1">
            {GENDERS.map((g) => (
              <button
                key={g.value}
                onClick={() => onSetGender(g.value)}
                className={`w-6 h-6 rounded text-2xs font-medium transition-colors ${
                  persona.gender === g.value
                    ? 'bg-accent text-foreground'
                    : 'bg-muted text-muted-foreground hover:text-foreground'
                }`}
                title={g.value}
              >
                {g.label}
              </button>
            ))}
          </div>
        </div>
        {img && (
          <DropdownMenuItem
            className="text-xs text-muted-foreground"
            onClick={() => onPickImage('')}
          >
            {t('brandEditor.removeAvatar')}
          </DropdownMenuItem>
        )}
        {hasMedia ? (
          <div className="grid grid-cols-4 gap-1 p-1">
            {mediaItems!.map((m) => (
              <button
                key={m.id}
                className="aspect-square rounded overflow-hidden border border-border hover:border-border-hover transition-colors"
                onClick={() => onPickImage(m.url)}
              >
                <Thumb src={m.url} alt={m.label || ''} className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        ) : (
          <p className="text-2xs text-muted-foreground/70 px-2 py-1.5">
            {t('brandEditor.noMediaYet')}
          </p>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export const PersonasSection: React.FC<PersonasSectionProps> = ({ guideline, onUpdate, span }) => {
  const { t } = useTranslation();
  const personas = guideline.strategy?.personas || [];

  const persist = useCallback(
    (next: BrandPersona[]) => {
      onUpdate({ strategy: { ...guideline.strategy, personas: next } });
    },
    [onUpdate, guideline.strategy]
  );

  const set = (i: number, patch: Partial<BrandPersona>) =>
    persist(personas.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  const add = () =>
    persist([
      ...personas,
      {
        name: '',
        age: undefined,
        occupation: '',
        bio: '',
        desires: [],
        painPoints: [],
        traits: [],
      },
    ]);
  const remove = (i: number) => persist(personas.filter((_, idx) => idx !== i));

  const handleAiResult = useCallback(
    (patch: Record<string, any>) => {
      const p = patch.strategy?.personas;
      if (Array.isArray(p)) persist(p);
    },
    [persist]
  );

  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const autoFillPhotos = useCallback(async () => {
    if (!guideline.id) return;
    setLoadingPhotos(true);
    try {
      const { personas: next, resolved } = await brandGuidelineApi.resolvePersonaImages(
        guideline.id
      );
      if (Array.isArray(next)) persist(next as BrandPersona[]);
      toast.success(
        resolved > 0
          ? t('brandEditor.stockPhotosAdded', { count: resolved })
          : t('brandEditor.noNewPhotos')
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('brandEditor.stockPhotosFailed'));
    } finally {
      setLoadingPhotos(false);
    }
  }, [guideline.id, persist]);

  return (
    <SectionBlock
      id="personas"
      icon={<User size={14} />}
      title={t('brandView.personas')}
      span={span as any}
      actions={
        <div className="flex items-center gap-1">
          {personas.length === 0 && (
            <AiFieldButton
              guideline={guideline}
              section="strategy.personas"
              onResult={handleAiResult}
            />
          )}
          {personas.length > 0 && guideline.id && (
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5"
              onClick={autoFillPhotos}
              disabled={loadingPhotos}
              aria-label={t('brandEditor.autofillPhotos')}
              title={t('brandEditor.fetchStockPhotos')}
            >
              {loadingPhotos ? (
                <Loader2 size={11} className="animate-spin" />
              ) : (
                <ImagePlus size={11} />
              )}
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5"
            onClick={add}
            aria-label={t('brandEditor.addPersona')}
          >
            <Plus size={11} />
          </Button>
        </div>
      }
    >
      <div className="space-y-0 py-1">
        {personas.length === 0 && (
          <p className="text-2xs text-muted-foreground/50 py-2">{t('brandEditor.noPersonasAdd')}</p>
        )}
        {personas.map((p, i) => (
          <div
            key={i}
            className="group/persona border-b border-border last:border-0 overflow-hidden"
          >
            {/* Header row: avatar + name + age */}
            <div className="flex items-center gap-3 py-3">
              <Avatar
                persona={p}
                mediaItems={guideline.media}
                onPickImage={(url) => set(i, { ...(p as any), image: url || undefined })}
                onSetGender={(gender) => set(i, { gender })}
              />
              <div className="flex-1 min-w-0">
                <Input
                  value={p.name}
                  onChange={(e) => set(i, { name: e.target.value })}
                  className="h-8 bg-transparent border-none px-0 text-base font-medium text-foreground focus-visible:ring-0 placeholder:text-muted-foreground"
                  placeholder={t('brandEditor.personaName')}
                />
                <Input
                  value={p.occupation || ''}
                  onChange={(e) => set(i, { occupation: e.target.value })}
                  className="h-5 bg-transparent border-none px-0 text-xs text-muted-foreground focus-visible:ring-0 placeholder:text-muted-foreground/50 mt-0.5"
                  placeholder={t('brandEditor.personaRole')}
                />
              </div>
              <Input
                value={p.age ?? ''}
                type="number"
                onChange={(e) =>
                  set(i, { age: e.target.value ? Number(e.target.value) : undefined })
                }
                className="h-7 bg-transparent border-none px-0 text-sm text-muted-foreground focus-visible:ring-0 w-10 text-right shrink-0"
                placeholder={t('brandEditor.age')}
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground/50 hover:text-destructive opacity-0 group-hover/persona:opacity-100 transition-[color,background-color,border-color,opacity] shrink-0"
                onClick={() => remove(i)}
                aria-label={t('common.remove')}
              >
                <Trash2 size={10} />
              </Button>
            </div>

            {/* Detail: hover-reveal */}
            <div className="hover-reveal group-hover/persona:max-h-[600px] group-focus-within/persona:max-h-[600px]">
              <div className="pl-[52px] pb-4 space-y-3">
                {/* Bio */}
                <div className="space-y-1">
                  <MicroTitle className="text-muted-foreground/70">
                    {t('brandEditor.bio')}
                  </MicroTitle>
                  <textarea
                    value={p.bio || ''}
                    onChange={(e) => set(i, { bio: e.target.value })}
                    className="auto-textarea w-full bg-transparent border border-border rounded-md px-3 py-2 text-xs text-muted-foreground placeholder:text-muted-foreground focus:outline-none focus:border-ring transition-colors"
                    placeholder={t('brandEditor.bioPlaceholder')}
                  />
                </div>

                {/* Desejos + Dores */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <MicroTitle className="text-muted-foreground/70">
                      {t('brandEditor.personaDesires')}
                    </MicroTitle>
                    <textarea
                      value={toLines(p.desires)}
                      onChange={(e) => set(i, { desires: fromLines(e.target.value) })}
                      className="auto-textarea w-full bg-transparent border border-border rounded-md px-3 py-2 text-xs text-muted-foreground placeholder:text-muted-foreground focus:outline-none focus:border-ring transition-colors"
                      placeholder={t('brandEditor.desiresPlaceholder')}
                    />
                  </div>
                  <div className="space-y-1">
                    <MicroTitle className="text-muted-foreground/70">
                      {t('brandEditor.personaPains')}
                    </MicroTitle>
                    <textarea
                      value={toLines(p.painPoints)}
                      onChange={(e) => set(i, { painPoints: fromLines(e.target.value) })}
                      className="auto-textarea w-full bg-transparent border border-border rounded-md px-3 py-2 text-xs text-muted-foreground placeholder:text-muted-foreground focus:outline-none focus:border-ring transition-colors"
                      placeholder={t('brandEditor.painsPlaceholder')}
                    />
                  </div>
                </div>

                {/* Características as badges */}
                <div className="space-y-1.5">
                  <MicroTitle className="text-muted-foreground/70">
                    {t('brandEditor.traits')}
                  </MicroTitle>
                  <InlineTags
                    values={p.traits || []}
                    onChange={(next) => set(i, { traits: next })}
                    placeholder={t('brandEditor.addPlaceholder')}
                    inputWidth={100}
                  />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </SectionBlock>
  );
};
