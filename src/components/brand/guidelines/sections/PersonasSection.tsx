import React, { useCallback, useState } from 'react';
import { toast } from 'sonner';
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
import { User, Plus, Trash2, ImagePlus, Loader2 } from 'lucide-react';
import type { BrandGuideline, BrandPersona } from '@/lib/figma-types';
import { InlineTags } from '../InlineTags';
import { brandGuidelineApi } from '@/services/brandGuidelineApi';

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
          className="w-10 h-10 rounded-full shrink-0 overflow-hidden border border-white/10 bg-neutral-800 flex items-center justify-center hover:border-white/20 transition-colors"
          title="Set avatar / gender for stock photos"
        >
          {img ? (
            <img src={img} alt={persona.name} className="w-full h-full object-cover" />
          ) : (
            <span className="text-xs font-semibold text-neutral-400">{initials}</span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-52 p-1">
        {/* Gender — steers auto-resolved stock portraits */}
        <div className="flex items-center justify-between px-2 py-1.5">
          <span className="text-[10px] uppercase tracking-wide text-neutral-600">Stock gender</span>
          <div className="flex gap-1">
            {GENDERS.map((g) => (
              <button
                key={g.value}
                onClick={() => onSetGender(g.value)}
                className={`w-6 h-6 rounded text-[10px] font-bold transition-colors ${
                  persona.gender === g.value
                    ? 'bg-white/15 text-neutral-100'
                    : 'bg-white/[0.03] text-neutral-500 hover:text-neutral-300'
                }`}
                title={g.value}
              >
                {g.label}
              </button>
            ))}
          </div>
        </div>
        {img && (
          <DropdownMenuItem className="text-xs text-neutral-500" onClick={() => onPickImage('')}>
            Remove avatar
          </DropdownMenuItem>
        )}
        {hasMedia ? (
          <div className="grid grid-cols-4 gap-1 p-1">
            {mediaItems!.map((m) => (
              <button
                key={m.id}
                className="aspect-square rounded overflow-hidden border border-neutral-800 hover:border-white/20 transition-colors"
                onClick={() => onPickImage(m.url)}
              >
                <img src={m.url} alt={m.label || ''} className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        ) : (
          <p className="text-[10px] text-neutral-600 px-2 py-1.5">
            No media yet. Add images in the Logotipo tab.
          </p>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export const PersonasSection: React.FC<PersonasSectionProps> = ({ guideline, onUpdate, span }) => {
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
        resolved > 0 ? `${resolved} stock photo(s) added` : 'No new photos found'
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to fetch stock photos');
    } finally {
      setLoadingPhotos(false);
    }
  }, [guideline.id, persist]);

  return (
    <SectionBlock
      id="personas"
      icon={<User size={14} />}
      title="Personas"
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
              aria-label="Auto-fill persona photos from free stock"
              title="Fetch free stock photos (Unsplash/Pexels)"
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
            aria-label="Add persona"
          >
            <Plus size={11} />
          </Button>
        </div>
      }
    >
      <div className="space-y-0 py-1">
        {personas.length === 0 && (
          <p className="text-[11px] text-neutral-700 py-2">No personas yet. Click + to add.</p>
        )}
        {personas.map((p, i) => (
          <div
            key={i}
            className="group/persona border-b border-neutral-800 last:border-0 overflow-hidden"
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
                  className="h-8 bg-transparent border-none px-0 text-base font-semibold text-neutral-100 focus-visible:ring-0 placeholder:text-neutral-700"
                  placeholder="Nome da persona"
                />
                <Input
                  value={p.occupation || ''}
                  onChange={(e) => set(i, { occupation: e.target.value })}
                  className="h-5 bg-transparent border-none px-0 text-xs text-neutral-500 focus-visible:ring-0 placeholder:text-neutral-700 mt-0.5"
                  placeholder="Cargo / Ocupação"
                />
              </div>
              <Input
                value={p.age ?? ''}
                type="number"
                onChange={(e) =>
                  set(i, { age: e.target.value ? Number(e.target.value) : undefined })
                }
                className="h-7 bg-transparent border-none px-0 text-sm text-neutral-500 focus-visible:ring-0 w-10 text-right shrink-0"
                placeholder="—"
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-neutral-700 hover:text-destructive opacity-0 group-hover/persona:opacity-100 transition-all shrink-0"
                onClick={() => remove(i)}
                aria-label="Remove"
              >
                <Trash2 size={10} />
              </Button>
            </div>

            {/* Detail: hover-reveal */}
            <div className="hover-reveal group-hover/persona:max-h-[600px] group-focus-within/persona:max-h-[600px]">
              <div className="pl-[52px] pb-4 space-y-3">
                {/* Bio */}
                <div className="space-y-1">
                  <MicroTitle className="text-neutral-600">Bio</MicroTitle>
                  <textarea
                    value={p.bio || ''}
                    onChange={(e) => set(i, { bio: e.target.value })}
                    className="auto-textarea w-full bg-transparent border border-neutral-800 rounded-md px-3 py-2 text-xs text-neutral-400 placeholder:text-neutral-700 focus:outline-none focus:border-white/10 transition-colors"
                    placeholder="Contexto, rotina, mentalidade..."
                  />
                </div>

                {/* Desejos + Dores */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <MicroTitle className="text-neutral-600">Desejos</MicroTitle>
                    <textarea
                      value={toLines(p.desires)}
                      onChange={(e) => set(i, { desires: fromLines(e.target.value) })}
                      className="auto-textarea w-full bg-transparent border border-neutral-800 rounded-md px-3 py-2 text-xs text-neutral-400 placeholder:text-neutral-700 focus:outline-none focus:border-white/10 transition-colors"
                      placeholder={'Reduzir fricção\nROI claro\nTime autônomo'}
                    />
                  </div>
                  <div className="space-y-1">
                    <MicroTitle className="text-neutral-600">Dores</MicroTitle>
                    <textarea
                      value={toLines(p.painPoints)}
                      onChange={(e) => set(i, { painPoints: fromLines(e.target.value) })}
                      className="auto-textarea w-full bg-transparent border border-neutral-800 rounded-md px-3 py-2 text-xs text-neutral-400 placeholder:text-neutral-700 focus:outline-none focus:border-white/10 transition-colors"
                      placeholder={'Ferramentas fragmentadas\nSem visibilidade\nOnboarding lento'}
                    />
                  </div>
                </div>

                {/* Características as badges */}
                <div className="space-y-1.5">
                  <MicroTitle className="text-neutral-600">Características</MicroTitle>
                  <InlineTags
                    values={p.traits || []}
                    onChange={(next) => set(i, { traits: next })}
                    placeholder="Adicionar..."
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
