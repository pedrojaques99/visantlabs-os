import React from 'react';
import { useBrandGuidelines } from '@/hooks/queries/useBrandGuidelines';
import { Select, SelectOption } from '@/components/ui/select';
import { Palette, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BrandAvatar } from '@/components/brand/BrandAvatar';

interface BrandSelectorProps {
  value: string | null | undefined;
  onChange: (guidelineId: string | null) => void;
  onAddClick?: () => void;
  className?: string;
}

export const BrandSelector: React.FC<BrandSelectorProps> = ({
  value,
  onChange,
  onAddClick,
  className,
}) => {
  const { data: guidelines = [], isLoading } = useBrandGuidelines(true);

  if (isLoading) {
    return (
      <div className={cn("px-4 py-2 text-xs text-neutral-500 font-mono", className)}>
        Loading...
      </div>
    );
  }

  // if (guidelines.length === 0) {
  //   return null; // Don't show selector if no guidelines
  // }

  const options: SelectOption[] = [
    { value: 'none', label: 'No brand linked' },
    ...guidelines.map((g) => ({
      value: g.id!,
      label: g.identity?.name || g.name || 'Untitled',
      icon: <BrandAvatar brand={g} size={16} rounded="sm" />,
    })),
  ];

  if (onAddClick) {
    options.push({
      value: 'ADD_NEW',
      label: 'Novo Brand DNA...',
      icon: <Plus size={12} className="text-brand-cyan" />
    });
  }

  const handleSelect = (v: string) => {
    if (v === 'ADD_NEW') {
      onAddClick?.();
    } else {
      onChange(v === 'none' ? null : v);
    }
  };

  return (
    <div className={cn("flex items-center px-1.5 bg-neutral-900/40 border border-white/5 rounded-[10px] hover:bg-[#252525]/60 hover:border-white/10 transition-all duration-200 shadow-sm h-9", className)}>
      <Palette size={12} className="text-neutral-500 shrink-0 ml-1" />
      <Select
        options={options}
        value={value || 'none'}
        onChange={handleSelect}
        variant="node"
        className="h-full w-[130px] bg-transparent border-none text-[10px] font-mono hover:text-neutral-200 shadow-none focus:ring-0"
      />
    </div>
  );
};
