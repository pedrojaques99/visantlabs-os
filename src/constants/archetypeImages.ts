const BASE = 'https://pub-0acbd500af3b4beaa8b93b07f6490d58.r2.dev/static/archetypes';

export const ARCHETYPE_IMAGES: Record<string, string> = {
  'O Amante':        `${BASE}/O Amante-1.png`,
  'O Bobo da Corte': `${BASE}/O Bobo da Corte-1.png`,
  'O Cara Comum':    `${BASE}/O Cara Comum-1.png`,
  'O Criador':       `${BASE}/O Criador-1.png`,
  'O Cuidador':      `${BASE}/O Cuidador-1.png`,
  'O Explorador':    `${BASE}/O Explorador-1.png`,
  'O Governante':    `${BASE}/O Governante-1.png`,
  'O Herói':         `${BASE}/O Herói-1.png`,
  'O Inocente':      `${BASE}/O Inocente-1.png`,
  'O Mago':          `${BASE}/O Mago-1.png`,
  'O Rebelde':       `${BASE}/O Rebelde-1.png`,
  'O Sábio':         `${BASE}/O Sábio-1.png`,
};

export const getArchetypeImage = (title: string): string | null => {
  const key = Object.keys(ARCHETYPE_IMAGES).find(
    k => k.toLowerCase() === title.toLowerCase().trim() ||
         title.toLowerCase().includes(k.toLowerCase().replace('o ', ''))
  );
  return key ? ARCHETYPE_IMAGES[key] : null;
};

export interface ArchetypePreset {
  nome: string;
  objetivo: string;
  valores: string[];
  exemplos: string[];
  image: string;
}

export const ARCHETYPE_PRESETS: ArchetypePreset[] = [
  { nome: 'O Explorador',    objetivo: 'Descobrir novos caminhos e romper limites.',                                  valores: ['curiosidade', 'exploração', 'mente aberta', 'desafio'],       exemplos: ['Jeep', 'The North Face', 'SpaceX'],           image: ARCHETYPE_IMAGES['O Explorador']    },
  { nome: 'O Governante',    objetivo: 'Transmitir ordem, estabilidade e prestígio.',                                 valores: ['autoridade', 'liderança', 'responsabilidade', 'controle'],    exemplos: ['Rolex', 'Mercedes-Benz', 'AmEx'],             image: ARCHETYPE_IMAGES['O Governante']    },
  { nome: 'O Herói',         objetivo: 'Resolver grandes desafios e motivar o cliente.',                              valores: ['superação', 'vitória', 'conquista', 'eficiência'],            exemplos: ['Nike', 'BMW', 'RedBull'],                     image: ARCHETYPE_IMAGES['O Herói']         },
  { nome: 'O Inocente',      objetivo: 'Vender segurança emocional com mensagens claras e limpas.',                   valores: ['positivismo', 'leveza', 'união', 'paz'],                       exemplos: ["Johnson's Baby", 'Coca-Cola', 'Natura'],      image: ARCHETYPE_IMAGES['O Inocente']      },
  { nome: 'O Mago',          objetivo: 'Quebrar velhos paradigmas por meio da inteligência.',                         valores: ['inovação', 'insight visionário', 'mudança', 'disrupção'],     exemplos: ['Apple', 'Tesla', 'Disney'],                   image: ARCHETYPE_IMAGES['O Mago']          },
  { nome: 'O Rebelde',       objetivo: 'Romper padrões, quebrar tradições e destruir o que está ultrapassado.',       valores: ['mudança', 'liberdade', 'verdade crua'],                        exemplos: ['Harley-Davidson', 'Dr. Martens', 'MTV'],      image: ARCHETYPE_IMAGES['O Rebelde']       },
  { nome: 'O Sábio',         objetivo: 'Explicar contextos, revelar verdades e ajudar a enxergar o quadro completo.',valores: ['conhecimento', 'clareza', 'autoridade', 'lucidez'],           exemplos: ['Google', 'TED', 'National Geographic'],      image: ARCHETYPE_IMAGES['O Sábio']         },
  { nome: 'O Amante',        objetivo: 'Criar vínculos fortes e relacionamentos estratégicos.',                       valores: ['acolhimento', 'proximidade', 'pertencimento'],                 exemplos: ['LinkedIn', 'AirBnb', 'Meta'],                 image: ARCHETYPE_IMAGES['O Amante']        },
  { nome: 'O Bobo da Corte', objetivo: 'Criar conexão por riso e zombar do próprio mercado.',                         valores: ['irreverência', 'humor inteligente', 'diferenciação'],         exemplos: ['Duolingo', 'Skol', 'Burger King'],            image: ARCHETYPE_IMAGES['O Bobo da Corte'] },
  { nome: 'O Cara Comum',    objetivo: 'Abraçar a autenticidade da vida cotidiana sem elitismo.',                     valores: ['conexão', 'pertencimento', 'empatia', 'realismo'],            exemplos: ['Hering', 'Gap', 'IKEA'],                      image: ARCHETYPE_IMAGES['O Cara Comum']    },
  { nome: 'O Criador',       objetivo: 'Dar forma a visões, construir coisas com significado e deixar um legado.',    valores: ['criatividade', 'expressão', 'inovação', 'originalidade'],     exemplos: ['Lego', 'Adobe', 'Canva'],                     image: ARCHETYPE_IMAGES['O Criador']       },
  { nome: 'O Cuidador',      objetivo: 'Proteger, nutrir e colocar o bem-estar dos outros acima de tudo.',            valores: ['cuidado', 'proteção', 'generosidade', 'empatia'],             exemplos: ['Dove', 'Johnson & Johnson', 'Cruz Vermelha'], image: ARCHETYPE_IMAGES['O Cuidador']      },
];
