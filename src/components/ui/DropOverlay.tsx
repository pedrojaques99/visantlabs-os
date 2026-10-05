// Colhido para o registry: `@visant/drop-overlay` — a versão canônica vive lá.
// Correção que valha para outros projetos deve ir no registry primeiro.
import React from 'react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/hooks/useTranslation';

interface DropOverlayProps {
  visible: boolean;
  message?: string;
  className?: string;
}

export const DropOverlay: React.FC<DropOverlayProps> = ({ visible, message, className }) => {
  const { t } = useTranslation();
  if (!visible) return null;
  return (
    <div
      className={cn(
        'absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm border-2 border-dashed border-ring pointer-events-none',
        className
      )}
    >
      <span className="text-sm text-muted-foreground">{message ?? t('common.dropFileHere')}</span>
    </div>
  );
};
