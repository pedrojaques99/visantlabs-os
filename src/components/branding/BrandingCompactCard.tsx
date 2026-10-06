import React from 'react';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { cn } from '@/lib/utils';

interface BrandingCompactCardProps {
  stepId: number;
  stepTitle: string;
  emoji: string;
  isGenerating: boolean;
  onClick: () => void;
}

export const BrandingCompactCard: React.FC<BrandingCompactCardProps> = ({
  stepId,
  stepTitle,
  emoji,
  isGenerating,
  onClick,
}) => {
  return (
    <GlassPanel
      onClick={onClick}
      className={cn(
        'aspect-square hover:border-border-hover transition-colors duration-200 cursor-pointer group relative animate-fade-in-down flex flex-col items-center justify-center w-1/2 md:max-w-[150px]',
        'border-border',
        isGenerating && 'opacity-50'
      )}
      padding="sm"
    >
      <div className="text-2xl md:text-3xl mb-2 transition-transform duration-200">{emoji}</div>
      <h3 className="font-medium font-manrope text-xs md:text-sm text-center leading-tight text-foreground">
        {stepTitle}
      </h3>
      {isGenerating && (
        <div className="absolute inset-0 rounded-md flex items-center justify-center bg-background/60">
          <SkeletonLoader height="1rem" className="w-3/4" />
        </div>
      )}
    </GlassPanel>
  );
};
