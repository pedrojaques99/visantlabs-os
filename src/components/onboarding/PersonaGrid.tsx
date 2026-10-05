import React from 'react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/hooks/useTranslation';
import { SEGMENTS } from './onboardingSegments';

interface PersonaGridProps {
  selectedId: string | null;
  onSelect: (id: string) => void;
  className?: string;
}

/**
 * Persona picker grid shared by the legacy wizard (V1) and the brand-first
 * wizard (V2, FEATURE_ONBOARDING_V2) — extracted because both step-0 markups
 * were byte-identical. Zero visual/behavioral change from either original.
 */
export const PersonaGrid: React.FC<PersonaGridProps> = ({ selectedId, onSelect, className }) => {
  const { t } = useTranslation();
  return (
    <div className={cn('grid grid-cols-2 gap-3 mb-6', className)}>
      {SEGMENTS.map((seg) => (
        <button
          key={seg.id}
          onClick={() => onSelect(seg.id)}
          className={cn(
            'flex flex-col items-center gap-2 p-4 rounded-lg border transition-colors text-center',
            selectedId === seg.id
              ? 'border-brand-cyan/40 bg-brand-cyan/5 text-foreground'
              : 'border-border bg-muted/40 text-muted-foreground hover:border-border-hover'
          )}
        >
          <seg.icon className="w-6 h-6" />
          <span className="text-sm font-medium">{t(`onboarding.persona.${seg.id}.label`)}</span>
          <span className="text-xs text-muted-foreground">
            {t(`onboarding.persona.${seg.id}.desc`)}
          </span>
        </button>
      ))}
    </div>
  );
};
