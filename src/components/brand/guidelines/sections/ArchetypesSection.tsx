import React, { useCallback } from 'react';
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
import { Diamond, Plus, Trash2 } from '@/lib/ui/icons';
import type { BrandGuideline } from '@/lib/figma-types';
import { ARCHETYPE_PRESETS, type ArchetypePreset } from '@/constants/archetypeImages';
import { Thumb } from '@/components/ui/Thumb';

interface ArchetypesSectionProps {
  guideline: BrandGuideline;
  onUpdate: (data: Partial<BrandGuideline>) => void;
  span?: string;
}

export const ArchetypesSection: React.FC<ArchetypesSectionProps> = ({
  guideline,
  onUpdate,
  span,
}) => {
  const { t } = useTranslation();
  const local = guideline.strategy?.archetypes || [];

  const persist = useCallback(
    (archetypes: typeof local) => {
      onUpdate({ strategy: { ...guideline.strategy, archetypes } });
    },
    [onUpdate, guideline.strategy]
  );

  const set = (i: number, patch: Partial<(typeof local)[0]>) =>
    persist(local.map((a, idx) => (idx === i ? { ...a, ...patch } : a)));

  const remove = (i: number) => persist(local.filter((_, idx) => idx !== i));

  const addPreset = (preset: ArchetypePreset) =>
    persist([
      ...local,
      {
        name: preset.nome,
        description: preset.objetivo,
        role: 'primary',
        image: preset.image,
      } as any,
    ]);

  const addBlank = () => persist([...local, { name: '', description: '', role: 'primary' } as any]);

  const handleAiResult = useCallback(
    (patch: Record<string, any>) => {
      const a = patch.strategy?.archetypes;
      if (Array.isArray(a)) persist(a);
    },
    [persist]
  );

  return (
    <SectionBlock
      id="archetypes"
      icon={<Diamond size={14} />}
      title={t('brandView.archetypes')}
      span={span as any}
      actions={
        <div className="flex items-center gap-1">
          {local.length === 0 && (
            <AiFieldButton
              guideline={guideline}
              section="strategy.archetypes"
              onResult={handleAiResult}
            />
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5"
                aria-label={t('brandEditor.addArchetype')}
              >
                <Plus size={11} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 max-h-72 overflow-y-auto p-1">
              {ARCHETYPE_PRESETS.map((preset) => (
                <DropdownMenuItem
                  key={preset.nome}
                  className="flex items-center gap-2.5 px-2 py-1.5 cursor-pointer"
                  onClick={() => addPreset(preset)}
                >
                  <Thumb
                    src={preset.image}
                    alt={preset.nome}
                    className="w-7 h-9 object-cover rounded shrink-0"
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{preset.nome}</p>
                    <p className="text-2xs text-muted-foreground/70 truncate">
                      {preset.valores.slice(0, 2).join(', ')}
                    </p>
                  </div>
                </DropdownMenuItem>
              ))}
              <DropdownMenuItem
                className="text-2xs text-muted-foreground/70 border-t border-border mt-1 pt-2"
                onClick={addBlank}
              >
                + Custom
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      }
    >
      <div className="space-y-0 py-1">
        {local.length === 0 && (
          <p className="text-2xs text-muted-foreground/50 py-2">
            {t('brandEditor.noArchetypesAdd')}
          </p>
        )}
        {local.map((arch, i) => {
          const preset = ARCHETYPE_PRESETS.find((p) => p.nome === arch.name);
          const img = (arch as any).image || preset?.image;
          return (
            <div
              key={i}
              className="flex gap-3 items-start py-2 border-b border-border last:border-0 group/item"
            >
              {img && (
                <Thumb
                  src={img}
                  alt={arch.name}
                  className="w-8 h-10 object-cover rounded shrink-0 opacity-80"
                />
              )}
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2">
                  <Input
                    value={arch.name}
                    onChange={(e) => set(i, { name: e.target.value })}
                    className="h-6 bg-transparent border-none px-0 text-xs font-medium text-foreground focus-visible:ring-0 placeholder:text-muted-foreground/50 flex-1"
                    placeholder={t('brandEditor.namePlaceholder')}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      set(i, { role: arch.role === 'primary' ? 'secondary' : 'primary' })
                    }
                    className="text-2xs px-1.5 py-0.5 rounded border border-border text-muted-foreground hover:text-foreground hover:border-ring transition-colors shrink-0"
                  >
                    {arch.role || 'primary'}
                  </button>
                </div>
                <Input
                  value={arch.description}
                  onChange={(e) => set(i, { description: e.target.value })}
                  className="h-6 bg-transparent border-none px-0 text-xs text-muted-foreground focus-visible:ring-0 placeholder:text-muted-foreground/50"
                  placeholder={t('brandEditor.goalPlaceholder')}
                />
                {preset && (
                  <p className="text-2xs text-muted-foreground">{preset.valores.join(', ')}</p>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground/50 hover:text-destructive opacity-0 group-hover/item:opacity-100 shrink-0 mt-0.5"
                onClick={() => remove(i)}
                aria-label={t('common.remove')}
              >
                <Trash2 size={10} />
              </Button>
            </div>
          );
        })}
      </div>
    </SectionBlock>
  );
};
