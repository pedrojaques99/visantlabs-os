import { Palette, Megaphone, Code, Building2, LucideIcon } from '@/lib/ui/icons';

// Each persona gets a tailored first action + destination route. This is the core
// of brand-first onboarding: send the user to the tool that matches their job,
// instead of dumping everyone on the mockup machine.
// Shared between the legacy wizard (flag off) and wizard v2 (FEATURE_ONBOARDING_V2).
export interface Segment {
  id: string;
  label: string;
  desc: string;
  icon: LucideIcon;
  route: string;
  actionTitle: string;
  actionDesc: string;
  actionCta: string;
}

export const SEGMENTS: Segment[] = [
  {
    id: 'designer',
    label: 'Designer',
    desc: 'UI/UX, branding, visual design',
    icon: Palette,
    route: '/mockupmachine',
    actionTitle: 'Crie seu primeiro mockup',
    actionDesc: 'Veja o poder da plataforma em acao — um mockup profissional em segundos.',
    actionCta: 'Criar mockup',
  },
  {
    id: 'agency',
    label: 'Agency',
    desc: 'Clientes, campanhas, entregas',
    icon: Building2,
    route: '/brand-guidelines',
    actionTitle: 'Centralize a marca dos seus clientes',
    actionDesc:
      'Uma fonte de verdade por cliente — compartilhe, gere e repita sem copiar hex na mao.',
    actionCta: 'Criar brand guideline',
  },
  {
    id: 'marketing',
    label: 'Marketing',
    desc: 'Redes sociais, conteudo, growth',
    icon: Megaphone,
    route: '/content-studio',
    actionTitle: 'Gere conteudo para todas as redes',
    actionDesc: 'Um brief, varias pecas — copy e imagem consistentes com a marca, de uma vez.',
    actionCta: 'Abrir Content Studio',
  },
  {
    id: 'developer',
    label: 'Developer',
    desc: 'Codigo, integracoes, automacao',
    icon: Code,
    route: '/docs/getting-started',
    actionTitle: 'Conecte via API e MCP',
    actionDesc:
      'Design tokens como codigo e contexto de marca em qualquer agente. Comece pelos docs.',
    actionCta: 'Ver documentacao',
  },
];

export const DEFAULT_ROUTE = '/mockupmachine';
