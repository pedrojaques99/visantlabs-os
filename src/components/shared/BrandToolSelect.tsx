import React from 'react';
import { Palette } from '@/lib/ui/icons';
import { cn } from '@/lib/utils';
import { useBrandGuidelines } from '@/hooks/queries/useBrandGuidelines';
import { BrandAvatar } from '@/components/brand/BrandAvatar';
import { Select } from '@/components/ui/select';
import { useTranslation } from '@/hooks/useTranslation';

interface BrandToolSelectProps {
  value: string | null;
  onChange: (brandId: string | null) => void;
  className?: string;
}

/**
 * Compact brand selector for mini-tools.
 * Shows a small dropdown to optionally link a brand guideline.
 */
export const BrandToolSelect: React.FC<BrandToolSelectProps> = ({ value, onChange, className }) => {
  const { t } = useTranslation();
  const { data: guidelines = [], isLoading } = useBrandGuidelines(true);

  if (isLoading || guidelines.length === 0) return null;

  const selected = value ? guidelines.find((g: any) => g.id === value) : null;

  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      <Palette size={10} className="text-muted-foreground shrink-0" />
      <div className="flex-1 min-w-0">
        <Select
          variant="node"
          value={value || ''}
          onChange={(id) => onChange(id || null)}
          options={[
            { value: '', label: t('miniTools.brandSelect.none') },
            ...guidelines.map((g: any) => ({
              value: g.id,
              label: g.identity?.name || g.name || t('miniTools.brandSelect.untitled'),
            })),
          ]}
        />
      </div>
      {selected && <BrandAvatar brand={selected} size={14} rounded="sm" />}
    </div>
  );
};
