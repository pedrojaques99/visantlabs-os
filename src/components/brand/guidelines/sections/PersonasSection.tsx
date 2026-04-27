import React, { useCallback } from 'react';
import { SectionBlock } from '../SectionBlock';
import { Input } from '@/components/ui/input';
import { MicroTitle } from '@/components/ui/MicroTitle';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { User, Plus, Trash2 } from 'lucide-react';
import type { BrandGuideline, BrandPersona } from '@/lib/figma-types';
import { InlineTags } from '../InlineTags';

interface PersonasSectionProps {
  guideline: BrandGuideline;
  onUpdate: (data: Partial<BrandGuideline>) => void;
  span?: string;
}

const toLines = (arr?: string[]) => (arr || []).join('\n');
const fromLines = (text: string) => text.split('\n').map(s => s.trim()).filter(Boolean);

const Avatar: React.FC<{
  persona: BrandPersona;
  mediaItems: BrandGuideline['media'];
  onPickImage: (url: string) => void;
}> = ({ persona, mediaItems, onPickImage }) => {
  const img = (persona as any).image as string | undefined;
  const initials = persona.name ? persona.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : '?';
  const hasMedia = mediaItems && mediaItems.length > 0;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="w-10 h-10 rounded-full shrink-0 overflow-hidden border border-white/10 bg-neutral-800 flex items-center justify-center hover:border-white/20 transition-colors"
          title="Set avatar from media"
        >
          {img ? (
            <img src={img} alt={persona.name} className="w-full h-full object-cover" />
          ) : (
            <span className="text-xs font-semibold text-neutral-400">{initials}</span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-52 p-1">
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
                className="aspect-square rounded overflow-hidden border border-white/5 hover:border-white/20 transition-colors"
                onClick={() => onPickImage(m.url)}
              >
                <img src={m.url} alt={m.label || ''} className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        ) : (
          <p className="text-[10px] text-neutral-600 px-2 py-1.5">No media yet. Add images in the Logotipo tab.</p>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export const PersonasSection: React.FC<PersonasSectionProps> = ({ guideline, onUpdate, span }) => {
  const personas = guideline.strategy?.personas || [];

  const persist = useCallback((next: BrandPersona[]) => {
    onUpdate({ strategy: { ...guideline.strategy, personas: next } });
  }, [onUpdate, guideline.strategy]);

  const set = (i: number, patch: Partial<BrandPersona>) =>
    persist(personas.map((p, idx) => idx === i ? { ...p, ...patch } : p));
  const add = () => persist([...personas, { name: '', age: undefined, occupation: '', bio: '', desires: [], painPoints: [], traits: [] }]);
  const remove = (i: number) => persist(personas.filter((_, idx) => idx !== i));

  return (
    <SectionBlock id="personas" icon={<User size={14} />} title="Personas" span={span as any}
      actions={
        <Button variant="ghost" size="icon" className="h-5 w-5" onClick={add} aria-label="Add persona">
          <Plus size={11} />
        </Button>
      }
    >
      <div className="space-y-0 py-1">
        {personas.length === 0 && (
          <p className="text-[11px] text-neutral-700 py-2">No personas yet. Click + to add.</p>
        )}
        {personas.map((p, i) => (
          <div key={i} className="group/persona border-b border-white/[0.04] last:border-0 overflow-hidden">
            {/* Header row: avatar + name + age */}
            <div className="flex items-center gap-3 py-3">
              <Avatar
                persona={p}
                mediaItems={guideline.media}
                onPickImage={(url) => set(i, { ...(p as any), image: url || undefined })}
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
                onChange={(e) => set(i, { age: e.target.value ? Number(e.target.value) : undefined })}
                className="h-7 bg-transparent border-none px-0 text-sm text-neutral-500 focus-visible:ring-0 w-10 text-right shrink-0"
                placeholder="—"
              />
              <Button variant="ghost" size="icon" className="h-6 w-6 text-neutral-700 hover:text-red-400 opacity-0 group-hover/persona:opacity-100 transition-all shrink-0" onClick={() => remove(i)} aria-label="Remove">
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
                    className="auto-textarea w-full bg-transparent border border-white/[0.06] rounded-md px-3 py-2 text-xs text-neutral-400 placeholder:text-neutral-700 focus:outline-none focus:border-white/[0.12] transition-colors"
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
                      className="auto-textarea w-full bg-transparent border border-white/[0.06] rounded-md px-3 py-2 text-xs text-neutral-400 placeholder:text-neutral-700 focus:outline-none focus:border-white/[0.12] transition-colors"
                      placeholder={"Reduzir fricção\nROI claro\nTime autônomo"}
                    />
                  </div>
                  <div className="space-y-1">
                    <MicroTitle className="text-neutral-600">Dores</MicroTitle>
                    <textarea
                      value={toLines(p.painPoints)}
                      onChange={(e) => set(i, { painPoints: fromLines(e.target.value) })}
                      className="auto-textarea w-full bg-transparent border border-white/[0.06] rounded-md px-3 py-2 text-xs text-neutral-400 placeholder:text-neutral-700 focus:outline-none focus:border-white/[0.12] transition-colors"
                      placeholder={"Ferramentas fragmentadas\nSem visibilidade\nOnboarding lento"}
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
