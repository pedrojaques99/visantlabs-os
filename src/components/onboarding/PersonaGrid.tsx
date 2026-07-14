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
            'flex flex-col items-center gap-2 p-4 rounded-lg border transition-all text-center',
            selectedId === seg.id
              ? 'border-brand-cyan/40 bg-brand-cyan/5 text-white'
              : 'border-neutral-700/50 bg-neutral-800/30 text-neutral-400 hover:border-neutral-600'
          )}
        >
          <seg.icon className="w-6 h-6" />
          <span className="text-sm font-mono font-medium">
            {t(`onboarding.persona.${seg.id}.label`) || seg.label}
          </span>
          <span className="text-xs text-neutral-500">
            {t(`onboarding.persona.${seg.id}.desc`) || seg.desc}
          </span>
        </button>
      ))}
    </div>
  );
};
