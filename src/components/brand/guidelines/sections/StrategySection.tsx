import React, { useState, useEffect, useRef, useCallback } from 'react';
import { SectionBlock } from '../SectionBlock';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { MicroTitle } from '@/components/ui/MicroTitle';
import { Button } from '@/components/ui/button';
import { Compass, Diamond, User, MessageCircle, Plus, Trash2, Heart } from 'lucide-react';
import type { BrandGuideline } from '@/lib/figma-types';
import { cn } from '@/lib/utils';

interface StrategySectionProps {
  guideline: BrandGuideline;
  onUpdate: (data: Partial<BrandGuideline>) => void;
  span?: string;
}

export const StrategySection: React.FC<StrategySectionProps> = ({ guideline, onUpdate, span }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [localStrategy, setLocalStrategy] = useState(guideline.strategy || {});
  const [isSaving, setIsSaving] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync local state when server data changes (only when not editing)
  useEffect(() => {
    if (!isEditing) {
      setLocalStrategy(guideline.strategy || {});
    }
  }, [guideline.strategy, isEditing]);

  const strategy = isEditing ? localStrategy : (guideline.strategy || {});

  const persistStrategy = useCallback((data: any) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setIsSaving(true);
    debounceRef.current = setTimeout(() => {
      onUpdate({ strategy: data });
      setIsSaving(false);
    }, 800);
  }, [onUpdate]);

  const handleUpdateStrategy = (updatedStrategy: any) => {
    const next = { ...localStrategy, ...updatedStrategy };
    setLocalStrategy(next);
    persistStrategy(next);
  };

  const handleCancel = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setLocalStrategy(guideline.strategy || {});
    setIsSaving(false);
    setIsEditing(false);
  };

  // Flush pending save and exit editing
  const handleDone = () => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      onUpdate({ strategy: localStrategy });
    }
    setIsSaving(false);
    setIsEditing(false);
  };

  const addItem = (type: string) => {
    if (!isEditing) setIsEditing(true);
    let next = { ...localStrategy };
    if (type === 'archetype') {
      next.archetypes = [...(localStrategy.archetypes || []), { name: 'New Archetype', description: '', role: 'primary' }];
    } else if (type === 'persona') {
      next.personas = [...(localStrategy.personas || []), { name: 'New Persona', age: 30, traits: [], desires: [], bio: '' }];
    } else if (type === 'voice') {
      next.voiceValues = [...(localStrategy.voiceValues || []), { title: 'Tone Name', description: '', example: '' }];
    }
    setLocalStrategy(next);
    persistStrategy(next);
  };

  const removeItem = (type: string, index: number) => {
    let next = { ...localStrategy };
    if (type === 'archetype') {
      next.archetypes = (localStrategy.archetypes || []).filter((_, i) => i !== index);
    } else if (type === 'persona') {
      next.personas = (localStrategy.personas || []).filter((_, i) => i !== index);
    } else if (type === 'voice') {
      next.voiceValues = (localStrategy.voiceValues || []).filter((_, i) => i !== index);
    }
    setLocalStrategy(next);
    persistStrategy(next);
  };

  return (
    <SectionBlock
      id="strategy"
      icon={<Compass size={14} />}
      title="Brand Strategy"
      isEditing={isEditing}
      isSaving={isSaving}
      onEdit={() => setIsEditing(true)}
      onSave={handleDone}
      onCancel={handleCancel}
      span={span as any}
      expandedContent={
        <div className="space-y-8">
          {/* Manifesto View */}
          {strategy.manifesto && (
            <div className="space-y-3">
              <MicroTitle className="text-brand-cyan/60 uppercase tracking-widest">Brand Manifesto</MicroTitle>
              <div className="p-8 rounded-3xl bg-white/[0.02] border border-white/[0.05] relative overflow-hidden group">
                <Heart className="absolute -right-4 -bottom-4 text-brand-cyan/5 w-32 h-32 group-hover:scale-110 transition-transform duration-700" />
                <p className="text-lg md:text-xl text-neutral-300 leading-relaxed font-light  relative z-10">
                  {strategy.manifesto}
                </p>
              </div>
            </div>
          )}

          {/* Archetypes View */}
          {strategy.archetypes && strategy.archetypes.length > 0 && (
            <div className="space-y-4">
              <MicroTitle className="text-brand-cyan/60 uppercase tracking-widest">Brand Archetypes</MicroTitle>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {strategy.archetypes.map((arch, i) => (
                  <div key={i} className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.05] flex gap-6 hover:border-brand-cyan/20 transition-all group">
                    <div className="w-16 h-16 rounded-xl bg-neutral-900 border border-white/5 flex items-center justify-center shrink-0">
                      <Diamond size={24} className="text-brand-cyan/40 group-hover:text-brand-cyan transition-colors" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-white tracking-tight">{arch.name}</h4>
                        {arch.role && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-brand-cyan/10 text-brand-cyan uppercase font-bold">{arch.role}</span>
                        )}
                      </div>
                      <p className="text-xs text-neutral-400 leading-relaxed">{arch.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Personas View */}
          {strategy.personas && strategy.personas.length > 0 && (
            <div className="space-y-4">
              <MicroTitle className="text-brand-cyan/60 uppercase tracking-widest">Target Personas</MicroTitle>
              <div className="grid grid-cols-1 gap-4">
                {strategy.personas.map((persona, i) => (
                  <div key={i} className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.05] flex flex-col md:flex-row gap-8 hover:border-brand-cyan/20 transition-all">
                    <div className="flex flex-col items-center gap-2 shrink-0">
                      <div className="w-12 h-12 rounded-full bg-neutral-800 border border-white/10 flex items-center justify-center">
                        <User size={20} className="text-neutral-500" />
                      </div>
                      <span className="text-[10px] font-bold text-white uppercase">{persona.name}, {persona.age}</span>
                    </div>
                    <div className="flex-1 space-y-3">
                      <p className="text-xs text-neutral-400  line-clamp-2">"{persona.bio}"</p>
                      <div className="flex flex-wrap gap-2">
                        {persona.desires?.map((desire, idx) => (
                          <span key={idx} className="text-[10px] px-2 py-1 rounded-md bg-white/5 border border-white/5 text-neutral-500 whitespace-nowrap">{desire}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      }
    >
      <div className="space-y-6">
        {isEditing ? (
          <div className="space-y-8">
            {/* Editing Manifesto */}
            <div className="space-y-2">
              <MicroTitle className="opacity-60 uppercase text-[11px] tracking-widest text-neutral-400">Manifesto</MicroTitle>
              <Textarea
                value={strategy.manifesto || ''}
                onChange={(e) => handleUpdateStrategy({ manifesto: e.target.value })}
                className="bg-neutral-850 border-white/5 min-h-[120px] text-xs focus:border-brand-cyan/30"
                placeholder="Write the brand manifesto..."
              />
            </div>

            {/* Editing Archetypes */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <MicroTitle className="opacity-60 uppercase text-[11px] tracking-widest text-neutral-400">Archetypes</MicroTitle>
                <Button variant="ghost" size="icon" aria-label="Add archetype" className="h-6 w-6" onClick={() => addItem('archetype')}>
                  <Plus size={12} />
                </Button>
              </div>
              <div className="space-y-3">
                {strategy.archetypes?.map((arch, i) => (
                  <div key={i} className="p-4 rounded-xl bg-neutral-900/50 border border-white/5 space-y-3">
                    <div className="flex gap-2">
                      <Input
                        value={arch.name}
                        onChange={(e) => {
                          const archetypes = [...(strategy.archetypes || [])];
                          archetypes[i].name = e.target.value;
                          handleUpdateStrategy({ archetypes });
                        }}
                        className="h-8 bg-neutral-850 border-white/5 text-xs"
                        placeholder="Name (e.g. O Mago)"
                      />
                      <Button variant="ghost" size="icon" aria-label="Remove archetype" className="h-8 w-8 text-red-500 hover:bg-red-500/10" onClick={() => removeItem('archetype', i)}>
                        <Trash2 size={12} />
                      </Button>
                    </div>
                    <Textarea
                      value={arch.description}
                      onChange={(e) => {
                        const archetypes = [...(strategy.archetypes || [])];
                        archetypes[i].description = e.target.value;
                        handleUpdateStrategy({ archetypes });
                      }}
                      className="bg-neutral-850 border-white/5 text-xs min-h-[60px]"
                      placeholder="Archetype description..."
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Editing Voice Values */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <MicroTitle className="opacity-60 uppercase text-[11px] tracking-widest text-neutral-400">Tone of Voice Values</MicroTitle>
                <Button variant="ghost" size="icon" aria-label="Add voice value" className="h-6 w-6" onClick={() => addItem('voice')}>
                  <Plus size={12} />
                </Button>
              </div>
              <div className="space-y-3">
                {strategy.voiceValues?.map((val, i) => (
                  <div key={i} className="p-4 rounded-xl bg-neutral-900/50 border border-white/5 space-y-3">
                    <div className="flex gap-2">
                      <Input
                        value={val.title}
                        onChange={(e) => {
                          const voiceValues = [...(strategy.voiceValues || [])];
                          voiceValues[i].title = e.target.value;
                          handleUpdateStrategy({ voiceValues });
                        }}
                        className="h-8 bg-neutral-850 border-white/5 text-xs"
                        placeholder="Title"
                      />
                      <Button variant="ghost" size="icon" aria-label="Remove voice value" className="h-8 w-8 text-red-500 hover:bg-red-500/10" onClick={() => removeItem('voice', i)}>
                        <Trash2 size={12} />
                      </Button>
                    </div>
                    <Input
                      value={val.description}
                      onChange={(e) => {
                        const voiceValues = [...(strategy.voiceValues || [])];
                        voiceValues[i].description = e.target.value;
                        handleUpdateStrategy({ voiceValues });
                      }}
                      className="h-8 bg-neutral-850 border-white/5 text-xs"
                      placeholder="How it sounds..."
                    />
                    <Input
                      value={val.example}
                      onChange={(e) => {
                        const voiceValues = [...(strategy.voiceValues || [])];
                        voiceValues[i].example = e.target.value;
                        handleUpdateStrategy({ voiceValues });
                      }}
                      className="h-8 bg-neutral-850 border-white/5 text-xs"
                      placeholder="Example phrase..."
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 w-full h-full flex-1">
            {[
              { label: 'Manifesto', icon: Heart, type: 'manifesto' },
              { label: 'Archetypes', icon: Diamond, type: 'archetype' },
              { label: 'Personas', icon: User, type: 'persona' },
              { label: 'Voice Values', icon: MessageCircle, type: 'voice' },
            ].map((p, i) => (
              <div
                key={i}
                className="flex flex-col items-center justify-center gap-2 p-6 rounded-xl border border-white/[0.05] bg-white/[0.01] h-full w-full cursor-pointer hover:bg-white/[0.04] hover:border-white/10 transition-all duration-300"
                onClick={() => {
                  setIsEditing(true);
                  if (p.type !== 'manifesto') {
                    addItem(p.type);
                  }
                }}
              >
                <div className="w-12 h-12 flex items-center justify-center rounded-xl text-neutral-500 border border-white/5 bg-neutral-900/50">
                  <p.icon size={20} strokeWidth={1} />
                </div>
                <span className="pt-4 text-center text-[11px] font-mono tracking-[0.1em] uppercase w-full text-neutral-400">{p.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </SectionBlock>
  );
};
