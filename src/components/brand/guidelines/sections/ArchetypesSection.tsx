import React, { useCallback } from 'react';
import { SectionBlock } from '../SectionBlock';
import { Input } from '@/components/ui/input';
import { MicroTitle } from '@/components/ui/MicroTitle';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Diamond, Plus, Trash2 } from 'lucide-react';
import type { BrandGuideline } from '@/lib/figma-types';
import { ARCHETYPE_PRESETS, type ArchetypePreset } from '@/constants/archetypeImages';

interface ArchetypesSectionProps {
  guideline: BrandGuideline;
  onUpdate: (data: Partial<BrandGuideline>) => void;
  span?: string;
}

export const ArchetypesSection: React.FC<ArchetypesSectionProps> = ({ guideline, onUpdate, span }) => {
  const local = guideline.strategy?.archetypes || [];

  const persist = useCallback((archetypes: typeof local) => {
    onUpdate({ strategy: { ...guideline.strategy, archetypes } });
  }, [onUpdate, guideline.strategy]);

  const set = (i: number, patch: Partial<typeof local[0]>) =>
    persist(local.map((a, idx) => idx === i ? { ...a, ...patch } : a));

  const remove = (i: number) => persist(local.filter((_, idx) => idx !== i));

  const addPreset = (preset: ArchetypePreset) =>
    persist([...local, { name: preset.nome, description: preset.objetivo, role: 'primary', image: preset.image } as any]);

  const addBlank = () =>
    persist([...local, { name: '', description: '', role: 'primary' } as any]);

  return (
    <SectionBlock
      id="archetypes"
      icon={<Diamond size={14} />}
      title="Archetypes"
      span={span as any}
      actions={
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-5 w-5" aria-label="Add archetype">
              <Plus size={11} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 max-h-72 overflow-y-auto p-1">
            {ARCHETYPE_PRESETS.map((preset) => (
              <DropdownMenuItem key={preset.nome} className="flex items-center gap-2.5 px-2 py-1.5 cursor-pointer" onClick={() => addPreset(preset)}>
                <img src={preset.image} alt={preset.nome} className="w-7 h-9 object-cover rounded shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-medium text-neutral-200 truncate">{preset.nome}</p>
                  <p className="text-[10px] text-neutral-600 truncate">{preset.valores.slice(0, 2).join(', ')}</p>
                </div>
              </DropdownMenuItem>
            ))}
            <DropdownMenuItem className="text-[10px] text-neutral-600 border-t border-white/5 mt-1 pt-2" onClick={addBlank}>
              + Custom
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      }
    >
      <div className="space-y-0 py-1">
        {local.length === 0 && <p className="text-[11px] text-neutral-700 py-2">No archetypes. Click + to add.</p>}
        {local.map((arch, i) => {
          const preset = ARCHETYPE_PRESETS.find(p => p.nome === arch.name);
          const img = (arch as any).image || preset?.image;
          return (
            <div key={i} className="flex gap-3 items-start py-2 border-b border-white/[0.04] last:border-0 group/item">
              {img && <img src={img} alt={arch.name} className="w-8 h-10 object-cover rounded shrink-0 opacity-80" />}
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2">
                  <Input value={arch.name} onChange={(e) => set(i, { name: e.target.value })}
                    className="h-6 bg-transparent border-none px-0 text-xs font-medium text-neutral-200 focus-visible:ring-0 placeholder:text-neutral-700 flex-1" placeholder="Name" />
                  <button type="button"
                    onClick={() => set(i, { role: arch.role === 'primary' ? 'secondary' : 'primary' })}
                    className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded border border-white/10 text-neutral-600 hover:text-neutral-400 hover:border-white/20 transition-colors shrink-0">
                    {arch.role || 'primary'}
                  </button>
                </div>
                <Input value={arch.description} onChange={(e) => set(i, { description: e.target.value })}
                  className="h-6 bg-transparent border-none px-0 text-xs text-neutral-500 focus-visible:ring-0 placeholder:text-neutral-700" placeholder="Objetivo..." />
                {preset && <p className="text-[10px] text-neutral-700 font-mono">{preset.valores.join(' · ')}</p>}
              </div>
              <Button variant="ghost" size="icon" className="h-6 w-6 text-neutral-700 hover:text-red-400 opacity-0 group-hover/item:opacity-100 shrink-0 mt-0.5"
                onClick={() => remove(i)} aria-label="Remove">
                <Trash2 size={10} />
              </Button>
            </div>
          );
        })}
      </div>
    </SectionBlock>
  );
};
