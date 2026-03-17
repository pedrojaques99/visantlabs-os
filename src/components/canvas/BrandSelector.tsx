import React from 'react';
import { useBrandGuidelines } from '@/hooks/queries/useBrandGuidelines';
import { Select } from '@/components/ui/select';
import { Palette } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BrandSelectorProps {
  value: string | null | undefined;
  onChange: (guidelineId: string | null) => void;
  className?: string;
}

export const BrandSelector: React.FC<BrandSelectorProps> = ({
  value,
  onChange,
  className,
}) => {
  const { data: guidelines = [], isLoading } = useBrandGuidelines(true);

  if (isLoading) {
    return (
      <div className={cn("h-8 w-[140px] bg-neutral-900/50 rounded animate-pulse", className)} />
    );
  }

  if (guidelines.length === 0) {
    return null; // Don't show selector if no guidelines
  }

  const options = [
    { value: 'none', label: 'No brand linked' },
    ...guidelines.map((g) => ({
      value: g.id!,
      label: g.identity?.name || g.name || 'Untitled',
    })),
  ];

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Palette size={12} className="text-neutral-500 shrink-0" />
      <Select
        options={options}
        value={value || 'none'}
        onChange={(v) => onChange(v === 'none' ? null : v)}
        variant="node"
        className="h-8 w-[140px] bg-neutral-900/50 border-white/10 text-xs font-mono"
      />
    </div>
  );
};
