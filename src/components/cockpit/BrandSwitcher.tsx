import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { Select, type SelectOption } from '@/components/ui/select';
import { BrandAvatar } from '@/components/brand/BrandAvatar';
import { useTranslation } from '@/hooks/useTranslation';
import { cn } from '@/lib/utils';
import type { BrandGuideline } from '@/lib/figma-types';

/**
 * Active-brand dropdown for the cockpit header (plano Revenue-Centric §4).
 * Audited before creating: `canvas/BrandSelector` carries canvas-chrome
 * semantics ("No brand linked") and ContentStudio's `BrandSelect` is a local
 * form field — neither fits a header "active brand" control. This is a thin
 * wrapper over the existing `Select` + `BrandAvatar` primitives (no new UI).
 */
interface BrandSwitcherProps {
  brands: BrandGuideline[];
  value: string | null;
  onChange: (guidelineId: string) => void;
  className?: string;
}

const MANAGE_VALUE = '__manage_brands__';

export const BrandSwitcher: React.FC<BrandSwitcherProps> = ({
  brands,
  value,
  onChange,
  className,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const options: SelectOption[] = [
    ...brands.map((g) => ({
      value: g.id!,
      label: g.identity?.name || g.name || 'Untitled',
      icon: <BrandAvatar brand={g} size={16} rounded="sm" />,
    })),
    {
      value: MANAGE_VALUE,
      label: t('cockpit.switcher.manageBrands'),
      icon: <Plus size={12} className="text-neutral-400" />,
    },
  ];

  return (
    <div
      className={cn(
        'flex items-center px-1.5 bg-neutral-900/40 border border-white/5 rounded-[10px] hover:bg-neutral-900/60 hover:border-white/10 transition-all duration-200 shadow-sm h-9',
        className
      )}
      data-vsn-component="BrandSwitcher"
    >
      <Select
        options={options}
        value={value ?? ''}
        onChange={(v) => (v === MANAGE_VALUE ? navigate('/brand-guidelines') : onChange(v))}
        placeholder={t('cockpit.switcher.placeholder')}
        variant="node"
        className="h-full min-w-[160px] bg-transparent border-none text-xs hover:text-neutral-200 shadow-none focus:ring-0"
      />
    </div>
  );
};
