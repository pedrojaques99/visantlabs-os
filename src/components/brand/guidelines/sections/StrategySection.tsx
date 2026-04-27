import React, { useCallback } from 'react';
import { SectionBlock } from '../SectionBlock';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { MicroTitle } from '@/components/ui/MicroTitle';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Compass, Plus, Trash2 } from 'lucide-react';
import type { BrandGuideline } from '@/lib/figma-types';

interface ArchetypePreset {
  nome: string;
  objetivo: string;
  valores: string[];
  exemplos: string[];
  image: string;
}

const ARCHETYPE_PRESETS: ArchetypePreset[] = [
  { nome: 'O Explorador',    objetivo: 'Descobrir novos caminhos e romper limites.',                                  valores: ['curiosidade', 'exploração', 'mente aberta', 'desafio'],       exemplos: ['Jeep', 'The North Face', 'SpaceX'],        image: '/archetypes/O Explorador-1.png'    },
  { nome: 'O Governante',    objetivo: 'Transmitir ordem, estabilidade e prestígio.',                                 valores: ['autoridade', 'liderança', 'responsabilidade', 'controle'],    exemplos: ['Rolex', 'Mercedes-Benz', 'AmEx'],          image: '/archetypes/O Governante-1.png'    },
  { nome: 'O Herói',         objetivo: 'Resolver grandes desafios e motivar o cliente.',                              valores: ['superação', 'vitória', 'conquista', 'eficiência'],            exemplos: ['Nike', 'BMW', 'RedBull'],                  image: '/archetypes/O Herói-1.png'         },
  { nome: 'O Inocente',      objetivo: 'Vender segurança emocional com mensagens claras e limpas.',                   valores: ['positivismo', 'leveza', 'união', 'paz'],                       exemplos: ["Johnson's Baby", 'Coca-Cola', 'Natura'],   image: '/archetypes/O Inocente-1.png'      },
  { nome: 'O Mago',          objetivo: 'Quebrar velhos paradigmas por meio da inteligência.',                         valores: ['inovação', 'insight visionário', 'mudança', 'disrupção'],     exemplos: ['Apple', 'Tesla', 'Disney'],                image: '/archetypes/O Mago-1.png'          },
  { nome: 'O Rebelde',       objetivo: 'Romper padrões, quebrar tradições e destruir o que está ultrapassado.',       valores: ['mudança', 'liberdade', 'verdade crua'],                        exemplos: ['Harley-Davidson', 'Dr. Martens', 'MTV'],   image: '/archetypes/O Rebelde-1.png'       },
  { nome: 'O Sábio',         objetivo: 'Explicar contextos, revelar verdades e ajudar a enxergar o quadro completo.',valores: ['conhecimento', 'clareza', 'autoridade', 'lucidez'],           exemplos: ['Google', 'TED', 'National Geographic'],   image: '/archetypes/O Sábio-1.png'         },
  { nome: 'O Amante',        objetivo: 'Criar vínculos fortes e relacionamentos estratégicos.',                       valores: ['acolhimento', 'proximidade', 'pertencimento'],                 exemplos: ['LinkedIn', 'AirBnb', 'Meta'],              image: '/archetypes/O Amante-1.png'        },
  { nome: 'O Bobo da Corte', objetivo: 'Criar conexão por riso e zombar do próprio mercado.',                         valores: ['irreverência', 'humor inteligente', 'diferenciação'],         exemplos: ['Duolingo', 'Skol', 'Burger King'],         image: '/archetypes/O Bobo da Corte-1.png' },
  { nome: 'O Cara Comum',    objetivo: 'Abraçar a autenticidade da vida cotidiana sem elitismo.',                     valores: ['conexão', 'pertencimento', 'empatia', 'realismo'],            exemplos: ['Hering', 'Gap', 'IKEA'],                   image: '/archetypes/O Cara Comum-1.png'    },
  { nome: 'O Criador',       objetivo: 'Dar forma a visões, construir coisas com significado e deixar um legado.',    valores: ['criatividade', 'expressão', 'inovação', 'originalidade'],     exemplos: ['Lego', 'Adobe', 'Canva'],                  image: '/archetypes/O Criador-1.png'       },
  { nome: 'O Cuidador',      objetivo: 'Proteger, nutrir e colocar o bem-estar dos outros acima de tudo.',            valores: ['cuidado', 'proteção', 'generosidade', 'empatia'],             exemplos: ['Dove', 'Johnson & Johnson', 'Cruz Vermelha'], image: '/archetypes/O Cuidador-1.png'   },
];

interface StrategySectionProps {
  guideline: BrandGuideline;
  onUpdate: (data: Partial<BrandGuideline>) => void;
  span?: string;
}

export const StrategySection: React.FC<StrategySectionProps> = ({ guideline, onUpdate, span }) => {
  const local = guideline.strategy || {};

  const persist = useCallback((data: any) => {
    onUpdate({ strategy: data });
  }, [onUpdate]);

  const update = (patch: any) => {
    persist({ ...local, ...patch });
  };

  const addItem = (type: 'archetype' | 'persona' | 'voice') => {
    const next = { ...local };
    if (type === 'archetype') next.archetypes = [...(local.archetypes || []), { name: '', description: '', role: 'primary' }];
    else if (type === 'persona') next.personas = [...(local.personas || []), { name: '', age: 0, traits: [], desires: [], bio: '' }];
    else next.voiceValues = [...(local.voiceValues || []), { title: '', description: '', example: '' }];
    persist(next);
  };

  const removeItem = (type: 'archetype' | 'persona' | 'voice', index: number) => {
    const next = { ...local };
    if (type === 'archetype') next.archetypes = (local.archetypes || []).filter((_, i) => i !== index);
    else if (type === 'persona') next.personas = (local.personas || []).filter((_, i) => i !== index);
    else next.voiceValues = (local.voiceValues || []).filter((_, i) => i !== index);
    persist(next);
  };

  return (
    <SectionBlock
      id="strategy"
      icon={<Compass size={14} />}
      title="Brand Strategy"
      span={span as any}
    >
      <div className="space-y-6">
        {/* Manifesto */}
        <div className="space-y-1.5">
          <MicroTitle className="text-neutral-500">Manifesto</MicroTitle>
          <Textarea
            value={local.manifesto || ''}
            onChange={(e) => update({ manifesto: e.target.value })}
            className="border-white/5 min-h-[80px] text-xs resize-none"
            placeholder="Brand manifesto..."
          />
        </div>

        {/* Archetypes */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <MicroTitle className="text-neutral-500">Archetypes</MicroTitle>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-5 w-5" aria-label="Add archetype">
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
                      next.archetypes = [...(local.archetypes || []), {
                        name: preset.nome,
                        description: preset.objetivo,
                        role: 'primary',
                        image: preset.image,
                      }];
                      persist(next);
                    }}
                  >
                    <img src={preset.image} alt={preset.nome} className="w-7 h-9 object-cover rounded shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-neutral-200 truncate">{preset.nome}</p>
                      <p className="text-[10px] text-neutral-600 truncate">{preset.valores.slice(0, 2).join(', ')}</p>
                    </div>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuItem
                  className="text-[10px] text-neutral-600 border-t border-white/5 mt-1 pt-2"
                  onClick={() => addItem('archetype')}
                >
                  + Custom
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          {(local.archetypes || []).map((arch, i) => {
            const preset = ARCHETYPE_PRESETS.find(p => p.nome === arch.name);
            const img = (arch as any).image || preset?.image;
            return (
              <div key={i} className="flex gap-3 items-start py-2 border-b border-white/[0.04] last:border-0 group/item">
                {img && (
                  <img src={img} alt={arch.name} className="w-8 h-10 object-cover rounded shrink-0 opacity-80" />
                )}
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <Input
                      value={arch.name}
                      onChange={(e) => { const a = [...(local.archetypes || [])]; a[i] = { ...a[i], name: e.target.value }; update({ archetypes: a }); }}
                      className="h-6 bg-transparent border-none px-0 text-xs font-medium text-neutral-200 focus-visible:ring-0 placeholder:text-neutral-700 flex-1"
                      placeholder="Name"
                    />
                    <button
                      type="button"
                      onClick={() => { const a = [...(local.archetypes || [])]; a[i] = { ...a[i], role: arch.role === 'primary' ? 'secondary' : 'primary' }; update({ archetypes: a }); }}
                      className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded border border-white/10 text-neutral-600 hover:text-neutral-400 hover:border-white/20 transition-colors shrink-0"
                    >
                      {arch.role || 'primary'}
                    </button>
                  </div>
                  <Input
                    value={arch.description}
                    onChange={(e) => { const a = [...(local.archetypes || [])]; a[i] = { ...a[i], description: e.target.value }; update({ archetypes: a }); }}
                    className="h-6 bg-transparent border-none px-0 text-xs text-neutral-500 focus-visible:ring-0 placeholder:text-neutral-700"
                    placeholder="Objetivo..."
                  />
                  {preset && (
                    <p className="text-[10px] text-neutral-700 font-mono">{preset.valores.join(' · ')}</p>
                  )}
                </div>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-neutral-700 hover:text-red-400 opacity-0 group-hover/item:opacity-100 shrink-0 mt-0.5" onClick={() => removeItem('archetype', i)} aria-label="Remove">
                  <Trash2 size={10} />
                </Button>
              </div>
            );
          })}
          {!local.archetypes?.length && <p className="text-[11px] text-neutral-700 pl-0.5">No archetypes</p>}
        </div>
      </div>
    </SectionBlock>
  );
};
