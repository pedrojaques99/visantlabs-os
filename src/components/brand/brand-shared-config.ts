/**
 * brand-shared-config.ts — Single source of truth for brand section metadata
 * shared between admin (BrandGuidelinesPage) and public (PublicBrandGuideline).
 *
 * Both pages derive their tabs, icons, section visibility, and download utils from here.
 */

import {
  FileText, Compass, Image as ImageIcon, Palette, Type, Tag,
  Layers, ShieldCheck, Link, BookOpen, Blend, Layers2, Zap, Frame,
  MessageCircle, User, Diamond, MessageSquare, LayoutTemplate, Globe,
  Smartphone,
} from 'lucide-react';
import type { BrandViewSection } from './BrandReadOnlyView';

// ── Icon Map ────────────────────────────────────────────────────────────────

export const SECTION_ICON_MAP: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
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
  identity:              { admin: true, public: true,  label: 'Identity' },
  manifesto:             { admin: true, public: true,  label: 'Manifesto' },
  archetypes:            { admin: true, public: true,  label: 'Archetypes' },
  mensagem_central:      { admin: true, public: false, label: 'Mensagem Central' },
  voice:                 { admin: true, public: true,  label: 'Tone of Voice' },
  personas:              { admin: true, public: true,  label: 'Personas' },
  colors:                { admin: true, public: true,  label: 'Colors' },
  typography:            { admin: true, public: true,  label: 'Typography' },
  logos:                 { admin: true, public: true,  label: 'Logos' },
  media:                 { admin: true, public: true,  label: 'Media Kit' },
  editorial:             { admin: true, public: true,  label: 'Editorial' },
  tags:                  { admin: true, public: false, label: 'Tags' },
  tokens:                { admin: true, public: false, label: 'Design Tokens' },
  gradients:             { admin: true, public: true,  label: 'Gradients' },
  shadows:               { admin: true, public: true,  label: 'Shadows' },
  borders:               { admin: true, public: false, label: 'Borders' },
  motion:                { admin: true, public: false, label: 'Motion' },
  accessibility:         { admin: true, public: true,  label: 'Accessibility' },
  knowledge:             { admin: true, public: false, label: 'Knowledge' },
  figma:                 { admin: true, public: false, label: 'Figma' },
  preview:               { admin: true, public: true,  label: 'Preview' },
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
    sections: ['identity', 'manifesto', 'archetypes', 'personas', 'voiceValues', 'colors', 'typography', 'logos', 'media', 'guidelines'],
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
    sections: ['manifesto', 'archetypes', 'personas', 'voiceValues', 'guidelines'],
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

export function extFromUrl(url: string): string {
  return url.split('.').pop()?.split('?')[0] || 'png';
}
