import React from 'react';
import { BarChart3, Users, Target, Lightbulb, TrendingUp, MapPin, Heart, ShoppingBag } from 'lucide-react';

export interface ParsedSection {
  title: string;
  icon: React.ReactNode;
  color: string;
  subsections: Array<{ title: string; content: string[] }>;
  items: string[];
}

export type MarketCategory = 'mercado-nicho' | 'publico-alvo' | 'posicionamento' | 'insights';

export const categorizeMarketSection = (title: string): MarketCategory => {
  const lowerTitle = title.toLowerCase();
  
  // Mercado e Nicho
  if (lowerTitle.includes('mercado') || lowerTitle.includes('market') || 
      lowerTitle.includes('niche') || lowerTitle.includes('análise de mercado') || 
      lowerTitle.includes('market analysis') || lowerTitle.includes('tamanho') ||
      lowerTitle.includes('size') || lowerTitle.includes('crescimento') || 
      lowerTitle.includes('growth')) {
    return 'mercado-nicho';
  }
  
  // Público Alvo
  if (lowerTitle.includes('público') || lowerTitle.includes('target') || 
      lowerTitle.includes('audience') || lowerTitle.includes('demográfico') || 
      lowerTitle.includes('demographic') || lowerTitle.includes('psicográfico') || 
      lowerTitle.includes('psychographic') || lowerTitle.includes('comportamento') || 
      lowerTitle.includes('behavior') || lowerTitle.includes('perfil') ||
      lowerTitle.includes('profile')) {
    return 'publico-alvo';
  }
  
  // Posicionamento
  if (lowerTitle.includes('posicionamento') || lowerTitle.includes('positioning') ||
      lowerTitle.includes('diferenciação') || lowerTitle.includes('differentiation') ||
      lowerTitle.includes('gap') || lowerTitle.includes('lacuna') ||
      lowerTitle.includes('competitivo') || lowerTitle.includes('competitive')) {
    return 'posicionamento';
  }
  
  // Insights (oportunidades e tendências)
  if (lowerTitle.includes('oportunidade') || lowerTitle.includes('opportunity') ||
      lowerTitle.includes('tendência') || lowerTitle.includes('trend') ||
      lowerTitle.includes('insight') || lowerTitle.includes('oportunidades') ||
      lowerTitle.includes('opportunities')) {
    return 'insights';
  }
  
  // Default: mercado-nicho
  return 'mercado-nicho';
};

export const getSectionInfo = (title: string): { icon: React.ReactNode; color: string } => {
  const lowerTitle = title.toLowerCase();
  if (lowerTitle.includes('mercado') || lowerTitle.includes('market') || lowerTitle.includes('niche') || lowerTitle.includes('análise de mercado') || lowerTitle.includes('market analysis')) {
    return { icon: <BarChart3 className="h-5 w-5" />, color: 'text-blue-400' };
  }
  if (lowerTitle.includes('público') || lowerTitle.includes('target') || lowerTitle.includes('audience')) {
    return { icon: <Users className="h-5 w-5" />, color: 'text-purple-400' };
  }
  if (lowerTitle.includes('posicionamento') || lowerTitle.includes('positioning')) {
    return { icon: <Target className="h-5 w-5" />, color: 'text-green-400' };
  }
  if (lowerTitle.includes('oportunidade') || lowerTitle.includes('opportunity')) {
    return { icon: <Lightbulb className="h-5 w-5" />, color: 'text-yellow-400' };
  }
  if (lowerTitle.includes('tendência') || lowerTitle.includes('trend')) {
    return { icon: <TrendingUp className="h-5 w-5" />, color: 'text-cyan-400' };
  }
  if (lowerTitle.includes('demográfico') || lowerTitle.includes('demographic')) {
    return { icon: <MapPin className="h-5 w-5" />, color: 'text-pink-400' };
  }
  if (lowerTitle.includes('psicográfico') || lowerTitle.includes('psychographic')) {
    return { icon: <Heart className="h-5 w-5" />, color: 'text-rose-400' };
  }
  if (lowerTitle.includes('comportamento') || lowerTitle.includes('behavior')) {
    return { icon: <ShoppingBag className="h-5 w-5" />, color: 'text-orange-400' };
  }
  return { icon: <BarChart3 className="h-5 w-5" />, color: 'text-brand-cyan' };
};

const extractBoldTitle = (line: string): string | null => {
  const boldMatch = line.match(/\*\*([^*]+)\*\*:?/);
  if (boldMatch) {
    return boldMatch[1].trim();
  }
  return null;
};

/**
 * Verifica se uma linha é uma frase introdutória
 */
const isIntroductoryPhrase = (text: string): boolean => {
  if (!text || text.trim().length === 0) return false;
  
  const lowerText = text.toLowerCase().trim();
  
  // Padrões de frases introdutórias
  const introductoryPatterns = [
    /^(aqui está|here is|esta é|this is|segue|below is|following is|apresento|i present)/i,
  ];
  
  // Verificar se começa com padrão introdutório e contém palavras-chave
  const hasIntroductoryStart = introductoryPatterns.some(pattern => pattern.test(lowerText));
  const hasIntroductoryKeywords = 
    (lowerText.includes('análise') || lowerText.includes('analysis')) &&
    (lowerText.includes('marca') || lowerText.includes('brand') || lowerText.includes('descri'));
  
  // Se começa com padrão introdutório e tem palavras-chave, e é uma linha curta, é introdutória
  return hasIntroductoryStart && hasIntroductoryKeywords && text.length < 100;
};

/**
 * Remove frases introdutórias comuns do texto
 * Remove padrões como "Aqui está...", "Here is...", "Esta é...", "This is..."
 */
export const removeIntroductoryPhrases = (text: string): string => {
  if (!text || !text.trim()) return text;
  
  const lowerText = text.toLowerCase();
  
  // Padrões de frases introdutórias em português
  const ptPatterns = [
    /^aqui está\s+(?:uma\s+)?(?:análise|análise de mercado|pesquisa|estudo|resumo|informação|dados?)[\s\S]*?:/i,
    /^esta é\s+(?:uma\s+)?(?:análise|análise de mercado|pesquisa|estudo|resumo|informação|dados?)[\s\S]*?:/i,
    /^segue\s+(?:uma\s+)?(?:análise|análise de mercado|pesquisa|estudo|resumo|informação|dados?)[\s\S]*?:/i,
    /^apresento\s+(?:a\s+)?(?:análise|análise de mercado|pesquisa|estudo|resumo|informação|dados?)[\s\S]*?:/i,
    /^a\s+seguir\s+(?:está|segue)\s+(?:uma\s+)?(?:análise|análise de mercado|pesquisa|estudo|resumo|informação|dados?)[\s\S]*?:/i,
    /^análise\s+de\s+mercado\s+(?:concisa|resumida|detalhada)?\s+para\s+(?:a\s+)?marca[\s\S]*?:/i,
  ];
  
  // Padrões de frases introdutórias em inglês
  const enPatterns = [
    /^here is\s+(?:a\s+)?(?:analysis|market analysis|research|study|summary|information|data)[\s\S]*?:/i,
    /^this is\s+(?:a\s+)?(?:analysis|market analysis|research|study|summary|information|data)[\s\S]*?:/i,
    /^below is\s+(?:a\s+)?(?:analysis|market analysis|research|study|summary|information|data)[\s\S]*?:/i,
    /^following is\s+(?:a\s+)?(?:analysis|market analysis|research|study|summary|information|data)[\s\S]*?:/i,
    /^i present\s+(?:a\s+)?(?:analysis|market analysis|research|study|summary|information|data)[\s\S]*?:/i,
    /^market analysis\s+(?:for|of)\s+(?:the\s+)?(?:brand|described brand)[\s\S]*?:/i,
  ];
  
  let cleanedText = text;
  
  // Remover padrões em português
  for (const pattern of ptPatterns) {
    cleanedText = cleanedText.replace(pattern, '').trim();
  }
  
  // Remover padrões em inglês
  for (const pattern of enPatterns) {
    cleanedText = cleanedText.replace(pattern, '').trim();
  }
  
  // Remover linhas que são apenas frases introdutórias (linhas inteiras)
  const lines = cleanedText.split('\n');
  const filteredLines = lines.filter(line => {
    const trimmed = line.trim();
    if (!trimmed) return true; // Manter linhas vazias
    
    const lowerLine = trimmed.toLowerCase();
    
    // Verificar se a linha inteira é uma frase introdutória
    const isIntroductory = 
      /^(aqui está|here is|esta é|this is|segue|below is|following is|apresento|i present)/i.test(trimmed) &&
      (lowerLine.includes('análise') || lowerLine.includes('analysis') || 
       lowerLine.includes('pesquisa') || lowerLine.includes('research') ||
       lowerLine.includes('marca') || lowerLine.includes('brand')) &&
      trimmed.length < 100; // Frases introdutórias geralmente são curtas
    
    return !isIntroductory;
  });
  
  return filteredLines.join('\n').trim();
};

export const parseMarketResearch = (text: string): ParsedSection[] | null => {
  // Remove frases introdutórias antes de processar
  const cleanedText = removeIntroductoryPhrases(text);
  const lines = cleanedText.split('\n');
  const sections: ParsedSection[] = [];
  
  let currentSection: ParsedSection | null = null;
  let currentSubsection: { title: string; content: string[] } | null = null;

  lines.forEach((line) => {
    const trimmed = line.trim();
    
    if (trimmed.match(/^#{2,4}\s+/)) {
      if (currentSubsection && currentSection) {
        if (currentSubsection.content.length > 0) {
          currentSection.subsections.push(currentSubsection);
        }
        currentSubsection = null;
      }
      
      if (currentSection) {
        if (currentSection.subsections.length > 0 || currentSection.items.length > 0) {
          sections.push(currentSection);
        }
      }
      
      const title = trimmed.replace(/^#+\s*/, '').replace(/\*\*/g, '').trim();
      const { icon, color } = getSectionInfo(title);
      currentSection = { 
        title, 
        icon, 
        color, 
        subsections: [],
        items: []
      };
      currentSubsection = null;
    } 
    else if (trimmed) {
      // Ignora linhas que são apenas pontuação ou vazias
      if (trimmed === ':' || trimmed === ';' || trimmed.length === 0) {
        return;
      }
      
      const boldTitle = extractBoldTitle(trimmed);
      
      if (boldTitle) {
        if (currentSubsection && currentSection) {
          if (currentSubsection.content.length > 0) {
            currentSection.subsections.push(currentSubsection);
          }
        }
        
        const contentAfterTitle = trimmed.replace(/\*\*[^*]+?\*\*:?\s*/, '').trim();
        currentSubsection = { title: boldTitle, content: [] };
        
        if (contentAfterTitle && contentAfterTitle !== boldTitle && contentAfterTitle !== ':') {
          currentSubsection.content.push(contentAfterTitle);
        }
      } 
      else if (trimmed.startsWith('-') || trimmed.startsWith('*') || trimmed.startsWith('•')) {
        const item = trimmed.replace(/^[-*•]\s+/, '').trim();
        // Filtrar items que são apenas frases introdutórias
        if (item && !isIntroductoryPhrase(item)) {
          if (currentSubsection && currentSection) {
            currentSubsection.content.push(item);
          } else if (currentSection) {
            currentSection.items.push(item);
          } else {
            const { icon, color } = getSectionInfo('Análise de Mercado');
            currentSection = {
              title: 'Análise de Mercado',
              icon,
              color,
              subsections: [],
              items: [item]
            };
          }
        }
      } else {
        // Filtrar linhas que são apenas frases introdutórias
        if (!isIntroductoryPhrase(trimmed)) {
          if (currentSubsection && currentSection) {
            currentSubsection.content.push(trimmed);
          } else if (currentSection) {
            currentSection.items.push(trimmed);
          } else {
            const { icon, color } = getSectionInfo('Análise de Mercado');
            currentSection = {
              title: 'Análise de Mercado',
              icon,
              color,
              subsections: [],
              items: [trimmed]
            };
          }
        }
      }
    }
  });

  if (currentSubsection && currentSection) {
    if (currentSubsection.content.length > 0) {
      currentSection.subsections.push(currentSubsection);
    }
  }

  if (currentSection) {
    if (currentSection.subsections.length > 0 || currentSection.items.length > 0) {
      sections.push(currentSection);
    }
  }

  return sections.length > 0 ? sections : null;
};

/**
 * Extrai informações demográficas do texto e retorna como array de tags
 * Identifica: faixas etárias, localizações, profissões, informações socioeconômicas
 */
export const parseDemographics = (text: string): string[] => {
  if (!text || !text.trim()) return [];
  
  const tags: string[] = [];
  const lowerText = text.toLowerCase();
  
  // Extrair faixas etárias
  // Padrões: "35-60 anos", "entre 35 e 60 anos", "de 35 a 60 anos", "35 a 60"
  const agePatterns = [
    /(\d+)\s*[-–]\s*(\d+)\s*(?:anos|years?)?/gi,
    /(?:entre|de)\s+(\d+)\s+(?:e|a)\s+(\d+)\s*(?:anos|years?)?/gi,
    /(\d+)\s+(?:a|até)\s+(\d+)\s*(?:anos|years?)?/gi,
  ];
  
  agePatterns.forEach(pattern => {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      const ageRange = match[0].replace(/\s+/g, ' ').trim();
      if (ageRange && !tags.includes(ageRange)) {
        tags.push(ageRange);
      }
    }
  });
  
  // Extrair localizações específicas conhecidas primeiro (mais preciso)
  const knownLocations = [
    'Balneário Camboriú', 'Praia Brava', 'Litoral Catarinense',
    'Santa Catarina', 'São Paulo', 'Rio de Janeiro', 'Minas Gerais',
    'Rio Grande do Sul', 'Bahia', 'Pernambuco', 'Ceará', 'Paraná'
  ];
  
  knownLocations.forEach(location => {
    if (text.includes(location) && !tags.includes(location)) {
      tags.push(location);
    }
  });
  
  // Extrair outras localizações (cidades e regiões com nomes próprios)
  // Padrão: palavras que começam com maiúscula seguidas de outras palavras com maiúscula
  const locationPattern = /\b([A-ZÁÉÍÓÚÂÊÔÇ][a-záéíóúâêôçãõ]+(?:\s+[A-ZÁÉÍÓÚÂÊÔÇ][a-záéíóúâêôçãõ]+)+)\b/g;
  const locationMatches = text.matchAll(locationPattern);
  
  const excludeWords = ['idade', 'anos', 'empresários', 'executivos', 'investidores', 
    'predominantemente', 'localizados', 'outras', 'áreas', 'alto', 'valor', 'poder', 
    'aquisitivo', 'estabelecidos', 'donos', 'negócios', 'lideres', 'líderes', 'mercado'];
  
  for (const match of locationMatches) {
    const location = match[1];
    const lowerLocation = location.toLowerCase();
    
    // Verificar se não é uma palavra excluída e não está nas tags conhecidas
    if (location && location.length > 3 && 
        !excludeWords.some(word => lowerLocation.includes(word)) &&
        !knownLocations.some(known => location.includes(known) || known.includes(location)) &&
        !tags.includes(location)) {
      tags.push(location);
    }
  }
  
  // Extrair profissões/cargos
  const professionKeywords = [
    { pattern: /\b(empresários?\s+estabelecidos?)\b/gi, tag: 'Empresários estabelecidos' },
    { pattern: /\b(executivos?)\b/gi, tag: 'Executivos' },
    { pattern: /\b(investidores?)\b/gi, tag: 'Investidores' },
    { pattern: /\b(donos?\s+de\s+negócios?)\b/gi, tag: 'Donos de negócios' },
    { pattern: /\b(líderes?\s+de\s+mercado)\b/gi, tag: 'Líderes de mercado' },
    { pattern: /\b(empreendedores?)\b/gi, tag: 'Empreendedores' },
    { pattern: /\b(diretores?)\b/gi, tag: 'Diretores' },
    { pattern: /\b(gerentes?)\b/gi, tag: 'Gerentes' },
    { pattern: /\b(presidentes?)\b/gi, tag: 'Presidentes' },
  ];
  
  professionKeywords.forEach(({ pattern, tag }) => {
    if (pattern.test(text) && !tags.includes(tag)) {
      tags.push(tag);
    }
  });
  
  // Extrair informações socioeconômicas
  const socioeconomicPatterns = [
    { pattern: /\b(alto\s+poder\s+aquisitivo)\b/gi, tag: 'Alto poder aquisitivo' },
    { pattern: /\b(alto\s+valor)\b/gi, tag: 'Alto valor' },
    { pattern: /\b(renda\s+(?:alta|elevada))\b/gi, tag: 'Renda alta' },
  ];
  
  socioeconomicPatterns.forEach(({ pattern, tag }) => {
    if (pattern.test(text) && !tags.includes(tag)) {
      tags.push(tag);
    }
  });
  
  // Remover duplicatas e ordenar (localizações primeiro, depois profissões, depois outros)
  const uniqueTags = Array.from(new Set(tags));
  
  // Ordenar: localizações primeiro, depois profissões, depois outros
  const sortedTags = uniqueTags.sort((a, b) => {
    const locationKeywords = ['Balneário', 'Praia', 'Litoral', 'Catarinense', 'Paulista', 
      'Carioca', 'Mineiro', 'Gaúcho', 'Baiano', 'Pernambucano', 'Ceará', 'Paraná', 
      'Santa Catarina', 'Rio de Janeiro', 'São Paulo', 'Minas Gerais', 'Rio Grande do Sul', 
      'Bahia', 'Pernambuco'];
    const aIsLocation = locationKeywords.some(keyword => a.includes(keyword));
    const bIsLocation = locationKeywords.some(keyword => b.includes(keyword));
    
    if (aIsLocation && !bIsLocation) return -1;
    if (!aIsLocation && bIsLocation) return 1;
    
    // Se ambos são localizações ou ambos não são, ordenar alfabeticamente
    return a.localeCompare(b);
  });
  
  return sortedTags;
};

export interface PersonaInfo {
  name: string | null;
  age: string | null;
  profession: string | null;
  decisionType: string | null;
  sector: string | null;
  characteristicTags: string[];
}

/**
 * Extrai informações estruturadas da persona do texto de demografia
 * Identifica: nome, idade, profissão, tipo de decisor, setor e tags características
 */
export const parsePersonaInfo = (demographics: string, desires?: string[], pains?: string[]): PersonaInfo => {
  if (!demographics || !demographics.trim()) {
    return {
      name: null,
      age: null,
      profession: null,
      decisionType: null,
      sector: null,
      characteristicTags: [],
    };
  }

  const text = demographics;
  const lowerText = text.toLowerCase();
  const result: PersonaInfo = {
    name: null,
    age: null,
    profession: null,
    decisionType: null,
    sector: null,
    characteristicTags: [],
  };

  // Extrair nome (padrão: "Nome Sobrenome" no início do texto ou após vírgula)
  const namePatterns = [
    /^([A-ZÁÉÍÓÚÂÊÔÇ][a-záéíóúâêôçãõ]+(?:\s+[A-ZÁÉÍÓÚÂÊÔÇ][a-záéíóúâêôçãõ]+)+)/,
    /(?:^|,\s*)([A-ZÁÉÍÓÚÂÊÔÇ][a-záéíóúâêôçãõ]+(?:\s+[A-ZÁÉÍÓÚÂÊÔÇ][a-záéíóúâêôçãõ]+)+)(?:\s*,|\s+[0-9])/,
  ];

  for (const pattern of namePatterns) {
    const match = text.match(pattern);
    if (match) {
      const potentialName = match[1];
      // Verificar se não é uma localização ou profissão comum
      const excludeNames = ['Balneário', 'Praia', 'Litoral', 'Santa', 'São', 'Rio', 'Minas', 'Rio Grande'];
      if (!excludeNames.some(ex => potentialName.includes(ex)) && potentialName.length > 3) {
        result.name = potentialName;
        break;
      }
    }
  }

  // Extrair idade específica (ex: "44", "35 anos")
  const ageMatch = text.match(/\b(\d{1,2})\s*(?:anos|years?)?\b/);
  if (ageMatch) {
    result.age = ageMatch[1];
  } else {
    // Tentar extrair faixa etária
    const ageRangeMatch = text.match(/(\d+)\s*[-–]\s*(\d+)\s*(?:anos|years?)?/);
    if (ageRangeMatch) {
      result.age = `${ageRangeMatch[1]}-${ageRangeMatch[2]} anos`;
    }
  }

  // Extrair profissão/cargo
  const professionPatterns = [
    { pattern: /\b(diretor\s+(?:comercial|executivo|geral|financeiro|de\s+operações?))\b/gi, extract: (m: RegExpMatchArray) => m[0].charAt(0).toUpperCase() + m[0].slice(1).toLowerCase() },
    { pattern: /\b(empresário\s+estabelecido)\b/gi, extract: () => 'Empresário estabelecido' },
    { pattern: /\b(executivo)\b/gi, extract: () => 'Executivo' },
    { pattern: /\b(investidor)\b/gi, extract: () => 'Investidor' },
    { pattern: /\b(dono\s+de\s+negócio)\b/gi, extract: () => 'Dono de negócio' },
    { pattern: /\b(empreendedor)\b/gi, extract: () => 'Empreendedor' },
    { pattern: /\b(diretor)\b/gi, extract: () => 'Diretor' },
    { pattern: /\b(gerente)\b/gi, extract: () => 'Gerente' },
    { pattern: /\b(presidente)\b/gi, extract: () => 'Presidente' },
  ];

  for (const { pattern, extract } of professionPatterns) {
    const match = text.match(pattern);
    if (match) {
      result.profession = extract(match);
      break;
    }
  }

  // Extrair tipo de decisor
  const decisionTypePatterns = [
    { pattern: /\b(decisor\s+pragmático)\b/gi, extract: () => 'Decisor Pragmático' },
    { pattern: /\b(pragmático)\b/gi, extract: () => 'Decisor Pragmático' },
    { pattern: /\b(racional)\b/gi, extract: () => 'Decisor Racional' },
    { pattern: /\b(analítico)\b/gi, extract: () => 'Decisor Analítico' },
    { pattern: /\b(emocional)\b/gi, extract: () => 'Decisor Emocional' },
    { pattern: /\b(intuitivo)\b/gi, extract: () => 'Decisor Intuitivo' },
  ];

  for (const { pattern, extract } of decisionTypePatterns) {
    const match = text.match(pattern);
    if (match) {
      result.decisionType = extract();
      break;
    }
  }

  // Extrair setor/área
  const sectorPatterns = [
    { pattern: /\b(distribuidora)\b/gi, extract: () => 'Distribuidora' },
    { pattern: /\b(varejo)\b/gi, extract: () => 'Varejo' },
    { pattern: /\b(indústria)\b/gi, extract: () => 'Indústria' },
    { pattern: /\b(serviços?)\b/gi, extract: () => 'Serviços' },
    { pattern: /\b(tecnologia)\b/gi, extract: () => 'Tecnologia' },
    { pattern: /\b(construção)\b/gi, extract: () => 'Construção' },
    { pattern: /\b(alimentação)\b/gi, extract: () => 'Alimentação' },
    { pattern: /\b(saúde)\b/gi, extract: () => 'Saúde' },
  ];

  for (const { pattern, extract } of sectorPatterns) {
    const match = text.match(pattern);
    if (match) {
      result.sector = extract();
      break;
    }
  }

  // Criar tags características combinando profissão, tipo de decisor e setor
  if (result.profession) {
    result.characteristicTags.push(result.profession);
  }
  if (result.decisionType) {
    result.characteristicTags.push(result.decisionType);
  }
  if (result.sector) {
    result.characteristicTags.push(result.sector);
  }

  return result;
};

