/**
 * Resolve um nome de ícone lucide (string vinda do `AppConfig.icon`, editável no
 * admin) para o componente. Curado de propósito — `import * as` puxaria os ~1500
 * ícones pro bundle. Amplie o mapa conforme os apps precisarem. Plano APP-SHELL P3.
 */
import type { LucideIcon } from 'lucide-react';
import {
  LayoutGrid,
  Sparkles,
  Image as ImageIcon,
  Palette,
  Bot,
  Wand2,
  PenTool,
  Layers,
  Grid3x3,
  Box,
  Type,
  QrCode,
  Crop,
  Scissors,
  FileImage,
  FileText,
  Droplet,
  Gauge,
  Search,
  Megaphone,
  Video,
  Music,
  Globe,
  Shapes,
  Frame,
} from 'lucide-react';

const ICON_MAP: Record<string, LucideIcon> = {
  LayoutGrid,
  Sparkles,
  Image: ImageIcon,
  Palette,
  Bot,
  Wand2,
  PenTool,
  Layers,
  Grid3x3,
  Box,
  Type,
  QrCode,
  Crop,
  Scissors,
  FileImage,
  FileText,
  Droplet,
  Gauge,
  Search,
  Megaphone,
  Video,
  Music,
  Globe,
  Shapes,
  Frame,
};

/** Nomes suportados — útil para validar/preencher o input do admin. */
export const SUPPORTED_LUCIDE_ICONS = Object.keys(ICON_MAP);

/** Retorna o componente do ícone, ou undefined se o nome não for suportado. */
export function getLucideIcon(name?: string | null): LucideIcon | undefined {
  if (!name) return undefined;
  return ICON_MAP[name];
}
