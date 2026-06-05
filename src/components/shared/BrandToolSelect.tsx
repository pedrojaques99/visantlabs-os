import React from 'react';
import { Palette } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useBrandGuidelines } from '@/hooks/queries/useBrandGuidelines';
import { BrandAvatar } from '@/components/brand/BrandAvatar';

interface BrandToolSelectProps {
  value: string | null;
  onChange: (brandId: string | null) => void;
  className?: string;
}

/**
 * Compact brand selector for mini-tools.
 * Shows a small dropdown to optionally link a brand guideline.
 */
export const BrandToolSelect: React.FC<BrandToolSelectProps> = ({
  value,
  onChange,
  className,
}) => {
  const { data: guidelines = [], isLoading } = useBrandGuidelines(true);

  if (isLoading || guidelines.length === 0) return null;

  const selected = value ? guidelines.find((g: any) => g.id === value) : null;

  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      <Palette size={10} className="text-neutral-500 shrink-0" />
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value || null)}
        className="bg-transparent text-[10px] font-mono text-neutral-400 hover:text-neutral-200 uppercase tracking-wider cursor-pointer border-none outline-none appearance-none pr-3"
        style={{ backgroundImage: 'none' }}
      >
        <option value="">No brand</option>
        {guidelines.map((g: any) => (
          <option key={g.id} value={g.id}>
            {g.identity?.name || g.name || 'Untitled'}
          </option>
        ))}
      </select>
      {selected && (
        <BrandAvatar brand={selected} size={14} rounded="sm" />
      )}
    </div>
  );
};
