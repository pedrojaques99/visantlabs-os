import React, { useState, useCallback } from 'react';
import { Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { brandGuidelineApi } from '@/services/brandGuidelineApi';
import { toast } from 'sonner';
import type { BrandGuideline } from '@/lib/figma-types';

interface AiFieldButtonProps {
  guideline: BrandGuideline;
  section: string;
  onResult: (patch: Record<string, any>) => void;
  disabled?: boolean;
  className?: string;
}

export const AiFieldButton: React.FC<AiFieldButtonProps> = ({
  guideline,
  section,
  onResult,
  disabled,
  className,
}) => {
  const [loading, setLoading] = useState(false);

  const handleClick = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (loading || disabled) return;
      setLoading(true);
      try {
        const result = await brandGuidelineApi.aiPopulate(guideline.id!, [section]);
        if (result.patch && Object.keys(result.patch).length > 0) {
          onResult(result.patch);
          toast.success('Conteúdo gerado');
        } else {
          toast.info('Nenhum conteúdo gerado');
        }
      } catch (err: any) {
        toast.error(err.message || 'Erro ao gerar');
      } finally {
        setLoading(false);
      }
    },
    [guideline.id, section, onResult, loading, disabled]
  );

  return (
    <button
      onClick={handleClick}
      disabled={loading || disabled}
      title="Gerar com IA"
      className={cn(
        'inline-flex items-center justify-center w-5 h-5 rounded-full transition-all',
        'border border-warning/30 bg-warning/10 text-warning',
        'hover:bg-warning/20 hover:border-warning/50',
        'disabled:opacity-30 disabled:cursor-not-allowed',
        className
      )}
    >
      {loading ? (
        <span className="w-2.5 h-2.5 border border-warning border-t-transparent rounded-full animate-spin" />
      ) : (
        <Zap size={10} />
      )}
    </button>
  );
};
