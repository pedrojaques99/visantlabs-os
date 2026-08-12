import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Layers } from '@/lib/ui/icons';
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
  /** `null` = "Todas as marcas" (só emitido quando `showAllOption`). */
  onChange: (guidelineId: string | null) => void;
  /** Adiciona a opção "Todas as marcas" (listas filtráveis). Default: false. */
  showAllOption?: boolean;
  className?: string;
}

const MANAGE_VALUE = '__manage_brands__';
const ALL_VALUE = '__all_brands__';

export const BrandSwitcher: React.FC<BrandSwitcherProps> = ({
  brands,
  value,
  onChange,
  showAllOption = false,
  className,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const options: SelectOption[] = [
    ...(showAllOption
      ? [
          {
            value: ALL_VALUE,
            label: t('nav.allBrands'),
            icon: <Layers size={13} className="text-neutral-400" />,
          },
        ]
      : []),
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

  // Quando não há marca ativa e a opção "todas" existe, mostra "Todas as marcas".
  const selectValue = value ?? (showAllOption ? ALL_VALUE : '');

  return (
    <div
      className={cn(
        'flex items-center px-1.5 bg-muted/40 border border-border rounded-lg hover:bg-muted hover:border-border transition-[color,background-color,border-color,box-shadow] duration-200 shadow-sm h-9',
        className
      )}
      data-vsn-component="BrandSwitcher"
    >
      <Select
        options={options}
        value={selectValue}
        onChange={(v) => {
          if (v === MANAGE_VALUE) return navigate('/brand-guidelines');
          if (v === ALL_VALUE) return onChange(null);
          onChange(v);
        }}
        placeholder={t('cockpit.switcher.placeholder')}
        variant="node"
        className="h-full min-w-[160px] bg-transparent border-none text-xs hover:text-neutral-200 shadow-none focus:ring-0"
        footer={
          brands.length > 1 ? (
            <div className="flex items-center justify-between px-2 py-1.5 text-[10px] text-neutral-500">
              <span>{t('nav.lastBrand')}</span>
              <kbd className="font-mono px-1 py-0.5 rounded bg-neutral-800/60 border border-neutral-700/50 text-neutral-400">
                ⌥B
              </kbd>
            </div>
          ) : undefined
        }
      />
    </div>
  );
};
