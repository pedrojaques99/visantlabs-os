import React, { useCallback } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { SectionBlock } from '../SectionBlock';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { MicroTitle } from '@/components/ui/MicroTitle';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Compass, Plus, Trash2 } from '@/lib/ui/icons';
import type { BrandGuideline } from '@/lib/figma-types';
import { ARCHETYPE_PRESETS } from '@/constants/archetypeImages';
import { Thumb } from '@/components/ui/Thumb';

interface StrategySectionProps {
  guideline: BrandGuideline;
  onUpdate: (data: Partial<BrandGuideline>) => void;
  span?: string;
}

export const StrategySection: React.FC<StrategySectionProps> = ({ guideline, onUpdate, span }) => {
  const { t } = useTranslation();
  const local = guideline.strategy || {};

  const persist = useCallback(
    (data: any) => {
      onUpdate({ strategy: data });
    },
    [onUpdate]
  );

  const update = (patch: any) => {
    persist({ ...local, ...patch });
  };

  const addItem = (type: 'archetype' | 'persona' | 'voice') => {
    const next = { ...local };
    if (type === 'archetype')
      next.archetypes = [
        ...(local.archetypes || []),
        { name: '', description: '', role: 'primary' },
      ];
    else if (type === 'persona')
      next.personas = [
        ...(local.personas || []),
        { name: '', age: 0, traits: [], desires: [], bio: '' },
      ];
    else
      next.voiceValues = [
        ...(local.voiceValues || []),
        { title: '', description: '', example: '' },
      ];
    persist(next);
  };

  const removeItem = (type: 'archetype' | 'persona' | 'voice', index: number) => {
    const next = { ...local };
    if (type === 'archetype')
      next.archetypes = (local.archetypes || []).filter((_, i) => i !== index);
    else if (type === 'persona')
      next.personas = (local.personas || []).filter((_, i) => i !== index);
    else next.voiceValues = (local.voiceValues || []).filter((_, i) => i !== index);
    persist(next);
  };

  return (
    <SectionBlock
      id="strategy"
      icon={<Compass size={14} />}
      title={t('brandEditor.brandStrategy')}
      span={span as any}
    >
      <div className="space-y-6">
        {/* Manifesto */}
        <div className="space-y-1.5">
          <MicroTitle className="text-muted-foreground">{t('brandView.manifesto')}</MicroTitle>
          <Textarea
            value={
              typeof local.manifesto === 'string'
                ? local.manifesto
                : (local.manifesto as any)?.full || ''
            }
            onChange={(e) => update({ manifesto: e.target.value })}
            className="border-border min-h-[80px] text-xs resize-none"
            placeholder={t('brandView.manifestoPlaceholder')}
          />
        </div>

        {/* Archetypes */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <MicroTitle className="text-muted-foreground">{t('brandView.archetypes')}</MicroTitle>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-5 w-5" aria-label={t('brandEditor.addArchetype')}>
                  <Plus size={11} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 max-h-72 overflow-y-auto p-1">
                {ARCHETYPE_PRESETS.map((preset) => (
                  <DropdownMenuItem
                    key={preset.nome}
                    className="flex items-center gap-2.5 px-2 py-1.5 cursor-pointer"
                    onClick={() => {
                      const next = { ...local };
                      next.archetypes = [
                        ...(local.archetypes || []),
                        {
                          name: preset.nome,
                          description: preset.objetivo,
                          role: 'primary',
                          image: preset.image,
                        },
                      ];
                      persist(next);
                    }}
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
                  onClick={() => addItem('archetype')}
                >
                  + Custom
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          {(local.archetypes || []).map((arch, i) => {
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
                      onChange={(e) => {
                        const a = [...(local.archetypes || [])];
                        a[i] = { ...a[i], name: e.target.value };
                        update({ archetypes: a });
                      }}
                      className="h-6 bg-transparent border-none px-0 text-xs font-medium text-foreground focus-visible:ring-0 placeholder:text-muted-foreground/50 flex-1"
                      placeholder={t('brandEditor.namePlaceholder')}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const a = [...(local.archetypes || [])];
                        a[i] = { ...a[i], role: arch.role === 'primary' ? 'secondary' : 'primary' };
                        update({ archetypes: a });
                      }}
                      className="text-2xs px-1.5 py-0.5 rounded border border-border text-muted-foreground hover:text-foreground hover:border-ring transition-colors shrink-0"
                    >
                      {arch.role || 'primary'}
                    </button>
                  </div>
                  <Input
                    value={arch.description}
                    onChange={(e) => {
                      const a = [...(local.archetypes || [])];
                      a[i] = { ...a[i], description: e.target.value };
                      update({ archetypes: a });
                    }}
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
                  onClick={() => removeItem('archetype', i)}
                  aria-label={t('common.remove')}
                >
                  <Trash2 size={10} />
                </Button>
              </div>
            );
          })}
          {!local.archetypes?.length && (
            <p className="text-2xs text-muted-foreground/50 pl-0.5">{t('brandEditor.noArchetypes')}</p>
          )}
        </div>
      </div>
    </SectionBlock>
  );
};
