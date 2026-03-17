import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { strategySchema } from '@/schemas/brandGuideline.schema';
import { SectionBlock } from '../SectionBlock';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { MicroTitle } from '@/components/ui/MicroTitle';
import { Button } from '@/components/ui/button';
import { Compass, Sparkles, User, MessageCircle, Plus, Trash2, Heart } from 'lucide-react';
import type { BrandGuideline, BrandArchetype, BrandPersona, BrandToneOfVoiceValue } from '@/lib/figma-types';
import { cn } from '@/lib/utils';

interface StrategySectionProps {
  guideline: BrandGuideline;
  onUpdate: (data: Partial<BrandGuideline>) => void;
  span?: string;
}

export const StrategySection: React.FC<StrategySectionProps> = ({ guideline, onUpdate, span }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState<'manifesto' | 'positioning' | 'archetypes' | 'personas' | 'voice'>('manifesto');

  const strategy = guideline.strategy || {};

  const handleUpdateStrategy = (updatedStrategy: any) => {
    onUpdate({ strategy: { ...strategy, ...updatedStrategy } });
  };

  const addItem = (type: string) => {
    if (!isEditing) setIsEditing(true);

    if (type === 'archetype') {
      const archetypes = [...(strategy.archetypes || []), { name: 'New Archetype', description: '', role: 'primary' }];
      handleUpdateStrategy({ archetypes });
    } else if (type === 'persona') {
      const personas = [...(strategy.personas || []), { name: 'New Persona', age: 30, traits: [], desires: [], bio: '' }];
      handleUpdateStrategy({ personas });
    } else if (type === 'voice') {
      const voiceValues = [...(strategy.voiceValues || []), { title: 'Tone Name', description: '', example: '' }];
      handleUpdateStrategy({ voiceValues });
    }
  };

  const removeItem = (type: string, index: number) => {
    if (type === 'archetype') {
      const archetypes = (strategy.archetypes || []).filter((_, i) => i !== index);
      handleUpdateStrategy({ archetypes });
    } else if (type === 'persona') {
      const personas = (strategy.personas || []).filter((_, i) => i !== index);
      handleUpdateStrategy({ personas });
    } else if (type === 'voice') {
      const voiceValues = (strategy.voiceValues || []).filter((_, i) => i !== index);
      handleUpdateStrategy({ voiceValues });
    }
  };

  return (
    <SectionBlock
      id="strategy"
      icon={<Compass size={14} />}
      title="Brand Strategy"
      isEditing={isEditing}
      onEdit={() => setIsEditing(true)}
      onSave={() => setIsEditing(false)}
      onCancel={() => setIsEditing(false)}
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
                      <Sparkles size={24} className="text-brand-cyan/40 group-hover:text-brand-cyan transition-colors" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-white tracking-tight">{arch.name}</h4>
                        {arch.role && (
                          <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-brand-cyan/10 text-brand-cyan uppercase font-bold">{arch.role}</span>
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
                          <span key={idx} className="text-[9px] px-2 py-1 rounded-md bg-white/5 border border-white/5 text-neutral-500 whitespace-nowrap">{desire}</span>
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
              <MicroTitle className="opacity-300 uppercase text-[9px]">Manifesto</MicroTitle>
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
                <MicroTitle className="opacity-300 uppercase text-[9px]">Archetypes</MicroTitle>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => addItem('archetype')}>
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
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:bg-red-500/10" onClick={() => removeItem('archetype', i)}>
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
                <MicroTitle className="opacity-300 uppercase text-[9px]">Tone of Voice Values</MicroTitle>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => addItem('voice')}>
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
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:bg-red-500/10" onClick={() => removeItem('voice', i)}>
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
          <div className="grid grid-cols-2 gap-3 w-full h-full flex-1 opacity-300">
            {[
              { label: 'Manifesto', icon: Heart, type: 'manifesto' },
              { label: 'Archetypes', icon: Sparkles, type: 'archetype' },
              { label: 'Personas', icon: User, type: 'persona' },
              { label: 'Voice Values', icon: MessageCircle, type: 'voice' },
            ].map((p, i) => (
              <div
                key={i}
                className="flex flex-col items-center justify-center gap-2 p-6 rounded-xl border border-white/[0.01] bg-white/[0.01] h-full w-full cursor-pointer hover:bg-white/[0.03] transition-colors"
                onClick={() => {
                  setIsEditing(true);
                  if (p.type !== 'manifesto') {
                    addItem(p.type);
                  }
                }}
              >
                <div className="w-10 h-10 flex items-center justify-center rounded-lg text-neutral-800 border border-white/5">
                  <p.icon size={18} strokeWidth={1} />
                </div>
                <span className="py-4 text-center text-[10px] font-mono tracking-widest uppercase w-full opacity-30">{p.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </SectionBlock>
  );
};
