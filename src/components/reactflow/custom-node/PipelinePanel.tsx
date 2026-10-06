import React from 'react';
import { ArrowRight } from '@/lib/ui/icons';
import type { PipelineConfig } from '@/types/customNode';
import { useTranslation } from '@/hooks/useTranslation';

interface Props {
  config: PipelineConfig;
  log: string[];
  isLoading: boolean;
}

export function PipelinePanel({ config, log, isLoading }: Props) {
  const { t } = useTranslation();
  return (
    <div className="space-y-2">
      {config.behavior === 'iterative-refine' ? (
        <p className="text-2xs text-neutral-500">
          {t('canvasNodes.customNode.iterates', { n: config.iterations ?? 3 })}
        </p>
      ) : (
        <>
          <p className="text-2xs text-neutral-500">{t('canvasNodes.customNode.steps')}</p>
          <div className="flex items-center gap-1 flex-wrap">
            {config.steps.map((step, i) => (
              <React.Fragment key={step.id}>
                <span className="px-1.5 py-0.5 rounded bg-neutral-900 border-node border-neutral-800 text-2xs font-mono text-neutral-300">
                  {step.label}
                </span>
                {i < config.steps.length - 1 && (
                  <ArrowRight size={10} className="text-neutral-600 shrink-0" />
                )}
              </React.Fragment>
            ))}
          </div>
        </>
      )}

      {log.length > 0 && (
        <div className="space-y-0.5 max-h-20 overflow-y-auto scrollbar-thin">
          {log.map((entry, i) => (
            <p key={i} className="text-2xs font-mono text-neutral-400 leading-relaxed">
              {entry}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
