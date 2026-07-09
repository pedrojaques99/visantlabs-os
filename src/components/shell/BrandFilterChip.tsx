/**
 * Chip de filtro de marca reutilizável para listas de produção (canvas,
 * criativos…). Default "Todas as marcas"; ligado mostra a marca ativa em
 * destaque. Plano APP-SHELL. Renderiza null sem marca ativa.
 */
import React from 'react';
import { Button } from '@/components/ui/button';
import { BrandAvatar } from '@/components/brand/BrandAvatar';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/hooks/useTranslation';
import type { BrandGuideline } from '@/lib/figma-types';

interface BrandFilterChipProps {
  brand: BrandGuideline | null;
  enabled: boolean;
  onToggle: () => void;
  className?: string;
}

export const BrandFilterChip: React.FC<BrandFilterChipProps> = ({
  brand,
  enabled,
  onToggle,
  className,
}) => {
  const { t } = useTranslation();
  if (!brand?.id) return null;

  return (
    <Button
      variant="ghost"
      onClick={onToggle}
      title={enabled ? t('nav.showAll') : t('nav.filterThisBrand')}
      className={cn(
        'h-10 px-3 rounded-md flex items-center gap-2 text-xs transition-colors',
        enabled
          ? 'bg-brand-cyan/10 border border-brand-cyan/30 text-brand-cyan'
          : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/40 border border-transparent',
        className
      )}
    >
      <BrandAvatar brand={brand} size={16} rounded="sm" />
      <span className="hidden md:inline truncate max-w-[120px]">
        {enabled ? brand.identity?.name || brand.name : t('nav.allBrands')}
      </span>
    </Button>
  );
};
