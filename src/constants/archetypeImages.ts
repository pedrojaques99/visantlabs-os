// Shared R2 library — the 12 Jungian archetype tarot cards (webp).
// Uploaded via scripts/upload-archetype-cards.mjs.
const BASE = 'https://pub-0acbd500af3b4beaa8b93b07f6490d58.r2.dev/archetypes';

export const ARCHETYPE_IMAGES: Record<string, string> = {
  'O Amante': `${BASE}/o-amante.webp`,
  'O Bobo da Corte': `${BASE}/o-bobo-da-corte.webp`,
  'O Cara Comum': `${BASE}/o-cara-comum.webp`,
  'O Criador': `${BASE}/o-criador.webp`,
  'O Cuidador': `${BASE}/o-cuidador.webp`,
  'O Explorador': `${BASE}/o-explorador.webp`,
  'O Governante': `${BASE}/o-governante.webp`,
  'O Herói': `${BASE}/o-heroi.webp`,
  'O Inocente': `${BASE}/o-inocente.webp`,
  'O Mago': `${BASE}/o-mago.webp`,
  'O Rebelde': `${BASE}/o-rebelde.webp`,
  'O Sábio': `${BASE}/o-sabio.webp`,
};

// Accent-insensitive slug used for matching (PT names + EN aliases).
const norm = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim().replace(/\s+/g, '-');

// English / variant name → canonical PT key.
const EN_ALIASES: Record<string, string> = {
  'the-lover': 'O Amante',
  lover: 'O Amante',
  'the-jester': 'O Bobo da Corte',
  jester: 'O Bobo da Corte',
  'the-fool': 'O Bobo da Corte',
  fool: 'O Bobo da Corte',
  'the-everyman': 'O Cara Comum',
  everyman: 'O Cara Comum',
  'regular-guy': 'O Cara Comum',
  orphan: 'O Cara Comum',
  'the-creator': 'O Criador',
  creator: 'O Criador',
  'the-caregiver': 'O Cuidador',
  caregiver: 'O Cuidador',
  'the-explorer': 'O Explorador',
  explorer: 'O Explorador',
  'the-ruler': 'O Governante',
  ruler: 'O Governante',
  'the-hero': 'O Herói',
  hero: 'O Herói',
  'the-innocent': 'O Inocente',
  innocent: 'O Inocente',
  'the-magician': 'O Mago',
  magician: 'O Mago',
  mage: 'O Mago',
  'the-outlaw': 'O Rebelde',
  outlaw: 'O Rebelde',
  'the-rebel': 'O Rebelde',
  rebel: 'O Rebelde',
  'the-sage': 'O Sábio',
  sage: 'O Sábio',
};

const SLUG_TO_KEY: Record<string, string> = Object.keys(ARCHETYPE_IMAGES).reduce(
  (acc, key) => {
    acc[norm(key)] = key;
    return acc;
  },
  {} as Record<string, string>
);

export const getArchetypeImage = (title: string): string | null => {
  if (!title) return null;
  const slug = norm(title);
  const key = SLUG_TO_KEY[slug] || EN_ALIASES[slug];
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
  {
    nome: 'O Explorador',
    objetivo: 'Descobrir novos caminhos e romper limites.',
    valores: ['curiosidade', 'exploração', 'mente aberta', 'desafio'],
    exemplos: ['Jeep', 'The North Face', 'SpaceX'],
    image: ARCHETYPE_IMAGES['O Explorador'],
  },
  {
    nome: 'O Governante',
    objetivo: 'Transmitir ordem, estabilidade e prestígio.',
    valores: ['autoridade', 'liderança', 'responsabilidade', 'controle'],
    exemplos: ['Rolex', 'Mercedes-Benz', 'AmEx'],
    image: ARCHETYPE_IMAGES['O Governante'],
  },
  {
    nome: 'O Herói',
    objetivo: 'Resolver grandes desafios e motivar o cliente.',
    valores: ['superação', 'vitória', 'conquista', 'eficiência'],
    exemplos: ['Nike', 'BMW', 'RedBull'],
    image: ARCHETYPE_IMAGES['O Herói'],
  },
  {
    nome: 'O Inocente',
    objetivo: 'Vender segurança emocional com mensagens claras e limpas.',
    valores: ['positivismo', 'leveza', 'união', 'paz'],
    exemplos: ["Johnson's Baby", 'Coca-Cola', 'Natura'],
    image: ARCHETYPE_IMAGES['O Inocente'],
  },
  {
    nome: 'O Mago',
    objetivo: 'Quebrar velhos paradigmas por meio da inteligência.',
    valores: ['inovação', 'insight visionário', 'mudança', 'disrupção'],
    exemplos: ['Apple', 'Tesla', 'Disney'],
    image: ARCHETYPE_IMAGES['O Mago'],
  },
  {
    nome: 'O Rebelde',
    objetivo: 'Romper padrões, quebrar tradições e destruir o que está ultrapassado.',
    valores: ['mudança', 'liberdade', 'verdade crua'],
    exemplos: ['Harley-Davidson', 'Dr. Martens', 'MTV'],
    image: ARCHETYPE_IMAGES['O Rebelde'],
  },
  {
    nome: 'O Sábio',
    objetivo: 'Explicar contextos, revelar verdades e ajudar a enxergar o quadro completo.',
    valores: ['conhecimento', 'clareza', 'autoridade', 'lucidez'],
    exemplos: ['Google', 'TED', 'National Geographic'],
    image: ARCHETYPE_IMAGES['O Sábio'],
  },
  {
    nome: 'O Amante',
    objetivo: 'Criar vínculos fortes e relacionamentos estratégicos.',
    valores: ['acolhimento', 'proximidade', 'pertencimento'],
    exemplos: ['LinkedIn', 'AirBnb', 'Meta'],
    image: ARCHETYPE_IMAGES['O Amante'],
  },
  {
    nome: 'O Bobo da Corte',
    objetivo: 'Criar conexão por riso e zombar do próprio mercado.',
    valores: ['irreverência', 'humor inteligente', 'diferenciação'],
    exemplos: ['Duolingo', 'Skol', 'Burger King'],
    image: ARCHETYPE_IMAGES['O Bobo da Corte'],
  },
  {
    nome: 'O Cara Comum',
    objetivo: 'Abraçar a autenticidade da vida cotidiana sem elitismo.',
    valores: ['conexão', 'pertencimento', 'empatia', 'realismo'],
    exemplos: ['Hering', 'Gap', 'IKEA'],
    image: ARCHETYPE_IMAGES['O Cara Comum'],
  },
  {
    nome: 'O Criador',
    objetivo: 'Dar forma a visões, construir coisas com significado e deixar um legado.',
    valores: ['criatividade', 'expressão', 'inovação', 'originalidade'],
    exemplos: ['Lego', 'Adobe', 'Canva'],
    image: ARCHETYPE_IMAGES['O Criador'],
  },
  {
    nome: 'O Cuidador',
    objetivo: 'Proteger, nutrir e colocar o bem-estar dos outros acima de tudo.',
    valores: ['cuidado', 'proteção', 'generosidade', 'empatia'],
    exemplos: ['Dove', 'Johnson & Johnson', 'Cruz Vermelha'],
    image: ARCHETYPE_IMAGES['O Cuidador'],
  },
];
