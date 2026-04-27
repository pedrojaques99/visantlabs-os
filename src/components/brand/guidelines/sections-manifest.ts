/**
 * SECTIONS_MANIFEST — single source of truth for all brand guideline sections.
 *
 * Adding a new section:
 *   1. Create the component in sections/
 *   2. Add an entry here (id, label, icon, defaultSpan)
 *   3. Add a case to GuidelineDetail renderSection()
 *   4. Add the field to BrandGuideline in figma-types.ts
 *
 * GuidelinesSidebar and DEFAULT_BLOCKS both derive from this manifest.
 */

import {
  FileText, Compass, Image as ImageIcon, Palette, Type, Tag,
  Layers, FileText as EditorialIcon, ShieldCheck, ImageIcon as MediaIcon,
  Link, BookOpen, Blend, Layers2, Zap, Frame, MessageCircle, User,
  Diamond, MessageSquare,
} from 'lucide-react';

export interface SectionMeta {
  id: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>;
  defaultSpan: '1' | 'full';
}

export const SECTIONS_MANIFEST: SectionMeta[] = [
  { id: 'identity',      label: 'Identity',       icon: FileText,      defaultSpan: 'full' },
  { id: 'strategy',      label: 'Strategy',        icon: Compass,       defaultSpan: 'full' },
  { id: 'logos',         label: 'Logos',            icon: ImageIcon,     defaultSpan: '1'    },
  { id: 'colors',        label: 'Colors',           icon: Palette,       defaultSpan: '1'    },
  { id: 'typography',    label: 'Typography',       icon: Type,          defaultSpan: 'full' },
  { id: 'tags',          label: 'Tags',             icon: Tag,           defaultSpan: '1'    },
  { id: 'tokens',        label: 'Design Tokens',    icon: Layers,        defaultSpan: '1'    },
  { id: 'editorial',     label: 'Editorial',        icon: EditorialIcon, defaultSpan: 'full' },
  { id: 'media',         label: 'Media Kit',        icon: MediaIcon,     defaultSpan: 'full' },
  { id: 'accessibility', label: 'Accessibility',    icon: ShieldCheck,   defaultSpan: '1'    },
  { id: 'knowledge',     label: 'Knowledge',        icon: BookOpen,      defaultSpan: 'full' },
  { id: 'figma',         label: 'Figma',            icon: Link,          defaultSpan: '1'    },
  { id: 'gradients',     label: 'Gradients',        icon: Blend,         defaultSpan: '1'    },
  { id: 'shadows',       label: 'Shadows',          icon: Layers2,       defaultSpan: '1'    },
  { id: 'motion',        label: 'Motion',           icon: Zap,           defaultSpan: '1'    },
  { id: 'borders',       label: 'Borders',          icon: Frame,         defaultSpan: '1'    },
  { id: 'manifesto',         label: 'Manifesto',         icon: BookOpen,       defaultSpan: 'full' },
  { id: 'archetypes',        label: 'Archetypes',        icon: Diamond,        defaultSpan: '1'    },
  { id: 'mensagem_central',  label: 'Mensagem Central',  icon: MessageSquare,  defaultSpan: '1'    },
  { id: 'voice',             label: 'Tone of Voice',     icon: MessageCircle,  defaultSpan: '1'    },
  { id: 'personas',          label: 'Personas',          icon: User,           defaultSpan: 'full' },
];

/**
 * Sections hidden by default when empty. Shown only if the guideline has data OR the user
 * explicitly adds them via the + button in the tab bar.
 */
export const OPTIONAL_SECTIONS = new Set([
  'tokens', 'gradients', 'shadows', 'motion', 'borders',
  'accessibility', 'knowledge', 'figma', 'tags', 'media',
]);

/** Returns true if the section has relevant data in the guideline */
export function sectionHasData(id: string, g: import('@/lib/figma-types').BrandGuideline): boolean {
  switch (id) {
    case 'colors':       return (g.colors?.length ?? 0) > 0;
    case 'typography':   return (g.typography?.length ?? 0) > 0;
    case 'logos':        return (g.logos?.length ?? 0) > 0;
    case 'media':        return (g.media?.length ?? 0) > 0;
    case 'strategy':     return !!(g.strategy?.manifesto || (g.strategy?.archetypes?.length ?? 0) > 0);
    case 'voice':        return (g.strategy?.voiceValues?.length ?? 0) > 0;
    case 'personas':     return (g.strategy?.personas?.length ?? 0) > 0;
    case 'editorial':    return !!(g.guidelines?.voice || (g.guidelines?.dos?.length ?? 0) > 0);
    case 'tags':         return Object.keys(g.tags || {}).length > 0;
    case 'tokens':       return !!(g.tokens?.spacing || g.tokens?.radius);
    case 'gradients':    return (g.gradients?.length ?? 0) > 0;
    case 'shadows':      return (g.shadows?.length ?? 0) > 0;
    case 'motion':       return !!(g.motion?.easing || g.motion?.philosophy);
    case 'borders':      return (g.borders?.length ?? 0) > 0;
    case 'accessibility':return !!(g.guidelines?.accessibility);
    case 'knowledge':    return (g.knowledgeFiles?.length ?? 0) > 0;
    case 'figma':        return !!(g.figmaFileUrl);
    default:             return true;
  }
}

/** Derived: ordered list of section ids — used as DEFAULT_BLOCKS in GuidelineDetail */
export const DEFAULT_SECTION_IDS = SECTIONS_MANIFEST.map(s => s.id);

/** Derived: lookup map for O(1) access by id */
export const SECTION_BY_ID = Object.fromEntries(
  SECTIONS_MANIFEST.map(s => [s.id, s])
) as Record<string, SectionMeta>;

export interface SectionTab {
  id: string;
  label: string;
  sections: string[];
}

/** Tab groups shown in admin Brand Guidelines header — mirrors public page structure */
export const SECTION_TABS: SectionTab[] = [
  {
    id: 'conceito',
    label: 'Conceito',
    sections: ['identity', 'knowledge', 'figma'],
  },
  {
    id: 'estrategia',
    label: 'Estratégia',
    sections: ['manifesto', 'archetypes', 'mensagem_central', 'voice', 'personas', 'editorial', 'tags'],
  },
  {
    id: 'logotipo',
    label: 'Logotipo',
    sections: ['logos', 'media'],
  },
  {
    id: 'identidade',
    label: 'Identidade Visual',
    sections: ['colors', 'typography', 'tokens', 'gradients', 'shadows', 'borders', 'motion'],
  },
  {
    id: 'patterns',
    label: 'Patterns',
    sections: ['accessibility'],
  },
];
