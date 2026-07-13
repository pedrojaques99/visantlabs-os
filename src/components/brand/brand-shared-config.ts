/**
 * brand-shared-config.ts — Single source of truth for brand section metadata
 * shared between admin (BrandGuidelinesPage) and public (PublicBrandGuideline).
 *
 * Both pages derive their tabs, icons, section visibility, and download utils from here.
 */

import {
  FileText,
  Compass,
  Image as ImageIcon,
  Palette,
  Type,
  Tag,
  Layers,
  ShieldCheck,
  Link,
  BookOpen,
  Blend,
  Layers2,
  Zap,
  Frame,
  MessageCircle,
  User,
  Diamond,
  MessageSquare,
  LayoutTemplate,
  Globe,
  Smartphone,
} from 'lucide-react';
import type { BrandViewSection } from './BrandReadOnlyView';
import type { BrandGuideline } from '@/lib/figma-types';
import { getBrandLogoUrl, getBrandInitial } from '@/utils/brandLogo';

// ── Icon Map ────────────────────────────────────────────────────────────────

export const SECTION_ICON_MAP: Record<
  string,
  React.ComponentType<{ size?: number; className?: string }>
> = {
  identity: FileText,
  strategy: Compass,
  logos: ImageIcon,
  colors: Palette,
  typography: Type,
  tags: Tag,
  tokens: Layers,
  editorial: FileText,
  media: ImageIcon,
  accessibility: ShieldCheck,
  knowledge: BookOpen,
  figma: Link,
  gradients: Blend,
  shadows: Layers2,
  motion: Zap,
  borders: Frame,
  manifesto: BookOpen,
  archetypes: Diamond,
  mensagem_central: MessageSquare,
  voice: MessageCircle,
  personas: User,
  preview: LayoutTemplate,
  'design-system-output': Layers,
};

// ── Section visibility per context ──────────────────────────────────────────

export interface SectionVisibility {
  admin: boolean;
  public: boolean;
  label: string;
}

export const SECTION_VISIBILITY: Record<string, SectionVisibility> = {
  identity: { admin: true, public: true, label: 'Identity' },
  manifesto: { admin: true, public: true, label: 'Manifesto' },
  archetypes: { admin: true, public: true, label: 'Archetypes' },
  mensagem_central: { admin: true, public: false, label: 'Mensagem Central' },
  voice: { admin: true, public: true, label: 'Tone of Voice' },
  personas: { admin: true, public: true, label: 'Personas' },
  colors: { admin: true, public: true, label: 'Colors' },
  typography: { admin: true, public: true, label: 'Typography' },
  logos: { admin: true, public: true, label: 'Logos' },
  media: { admin: true, public: true, label: 'Media Kit' },
  editorial: { admin: true, public: true, label: 'Editorial' },
  tags: { admin: true, public: false, label: 'Tags' },
  tokens: { admin: true, public: false, label: 'Design Tokens' },
  gradients: { admin: true, public: true, label: 'Gradients' },
  shadows: { admin: true, public: true, label: 'Shadows' },
  borders: { admin: true, public: false, label: 'Borders' },
  motion: { admin: true, public: false, label: 'Motion' },
  accessibility: { admin: true, public: true, label: 'Accessibility' },
  knowledge: { admin: true, public: false, label: 'Knowledge' },
  figma: { admin: true, public: false, label: 'Figma' },
  preview: { admin: true, public: true, label: 'Preview' },
  'design-system-output': { admin: true, public: false, label: 'Design System Output' },
};

// ── Public page tab groups ──────────────────────────────────────────────────

export interface PublicTab {
  id: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  sections: BrandViewSection[];
}

export const PUBLIC_TABS: PublicTab[] = [
  {
    id: 'all',
    label: 'Overview',
    icon: Globe,
    sections: [
      'identity',
      'coreMessage',
      'pillars',
      'manifesto',
      'archetypes',
      'personas',
      'voiceValues',
      'colors',
      'typography',
      'logos',
      'media',
      'guidelines',
    ],
  },
  {
    id: 'identity',
    label: 'Identity',
    icon: FileText,
    sections: ['identity', 'guidelines'],
  },
  {
    id: 'strategy',
    label: 'Strategy',
    icon: Compass,
    sections: [
      'coreMessage',
      'pillars',
      'manifesto',
      'archetypes',
      'personas',
      'voiceValues',
      'guidelines',
    ],
  },
  {
    id: 'colors',
    label: 'Colors',
    icon: Palette,
    sections: ['colors'],
  },
  {
    id: 'typography',
    label: 'Typography',
    icon: Type,
    sections: ['typography'],
  },
  {
    id: 'logos',
    label: 'Assets',
    icon: ImageIcon,
    sections: ['logos'],
  },
  {
    id: 'media',
    label: 'Library',
    icon: ImageIcon,
    sections: ['media'],
  },
  {
    id: 'preview',
    label: 'Preview',
    icon: Smartphone,
    sections: [],
  },
];

// ── Tab ↔ URL slug mapping ───────────────────────────────────────────────────
// Drives the per-tab dynamic route (public: /brand/:slug/<seg>, admin: ?tab=<seg>).
// `all` (Overview) is the base route — it has no segment. Slugs follow the tab
// *label* where it differs from the internal id (logos→assets, media→library).
export const TAB_SLUGS: Record<string, string> = {
  all: 'overview',
  identity: 'identity',
  strategy: 'strategy',
  colors: 'colors',
  typography: 'typography',
  logos: 'assets',
  media: 'library',
  preview: 'preview',
};

export const SLUG_TO_TAB: Record<string, string> = Object.fromEntries(
  Object.entries(TAB_SLUGS).map(([id, slug]) => [slug, id])
);

// ── Download utilities ──────────────────────────────────────────────────────

export function downloadBlob(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function triggerAssetDownload(url: string, filename: string) {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
  } catch {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.target = '_blank';
    a.click();
  }
}

export function safeFileName(label?: string, fallback = 'asset'): string {
  return (label || fallback).replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
}

export function extFromUrl(url?: string): string {
  if (!url) return 'png';
  return url.split('.').pop()?.split('?')[0] || 'png';
}

// ── Brand avatar / default ────────────────────────────────────────────────────
// A brand's canonical "mark" for large display (hero lockup): the logo when
// present, otherwise a themed initial chip over the brand's primary color.
// Delegates logo/initial resolution to the shared `brandLogo` SSoT and only
// adds the AA-contrast color pair the initial chip needs.

export interface BrandAvatar {
  /** Logo image URL when the brand has one (primary > icon > first). */
  logoUrl?: string;
  /** Uppercase first letter fallback when there's no logo. */
  initial: string;
  /** Background for the initial chip — the brand's primary color. */
  bg: string;
  /** Foreground picked for AA contrast against `bg`. */
  fg: string;
}

/** Relative luminance (WCAG) → readable ink for a solid background. */
function readableInk(hex: string): string {
  const h = (hex || '').replace('#', '').padEnd(6, '0').slice(0, 6);
  const chan = (i: number) => {
    const c = parseInt(h.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  const L = 0.2126 * chan(0) + 0.7152 * chan(2) + 0.0722 * chan(4);
  return L > 0.5 ? '#111111' : '#ffffff';
}

export function getBrandAvatar(g?: BrandGuideline | null): BrandAvatar {
  const colors = g?.colors || [];
  const primary = colors.find((c) => c.role?.toUpperCase() === 'PRIMARY') || colors[0];
  const bg = primary?.hex || '#888888';
  return {
    logoUrl: getBrandLogoUrl(g, 'primary'),
    initial: getBrandInitial(g),
    bg,
    fg: readableInk(bg),
  };
}
