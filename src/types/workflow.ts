import { Workflow, Layers, Image, Video, Palette, LayoutGrid } from '@/lib/ui/icons';

export type WorkflowCategory = 'branding' | 'mockup' | 'image-editing' | 'video' | 'general';

export const WORKFLOW_CATEGORY_CONFIG: Record<
  string,
  {
    icon: any;
    color: string;
    /**
     * Classes completas do chip de categoria. Escritas por extenso de propósito:
     * derivar `bg-`/`border-` de `color` em runtime gera string que o scanner do
     * Tailwind não enxerga (classe purgada no build) e, nas cores que já são
     * token (`text-success`), produzia fundo sólido opaco.
     */
    badgeClass: string;
    label: string;
  }
> = {
  branding: {
    icon: Palette,
    color: 'text-purple-400',
    badgeClass: 'bg-purple-500/20 border-purple-500/30 text-purple-400',
    label: 'Branding',
  },
  mockup: {
    icon: Image,
    color: 'text-blue-400',
    badgeClass: 'bg-blue-500/20 border-blue-500/30 text-blue-400',
    label: 'Mockup',
  },
  'image-editing': {
    icon: Layers,
    color: 'text-success',
    badgeClass: 'bg-success/15 border-success/30 text-success',
    label: 'Image Editing',
  },
  video: {
    icon: Video,
    color: 'text-pink-400',
    badgeClass: 'bg-pink-500/20 border-pink-500/30 text-pink-400',
    label: 'Video',
  },
  general: {
    icon: Workflow,
    color: 'text-warning',
    badgeClass: 'bg-warning/15 border-warning/30 text-warning',
    label: 'General',
  },
};
