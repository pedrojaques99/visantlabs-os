import React, { useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CheckCircle2, AlertCircle, Brain } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import {
  computeBrandCompleteness,
  completenessStatus,
  type CompletenessRule,
} from '@/lib/brandCompleteness';
import type { BrandGuideline } from '@/lib/figma-types';
import { brandGuidelineApi, type BrandHealthReport } from '@/services/brandGuidelineApi';
import { BrandHealthDialog } from './BrandHealthDialog';

interface BrandCompletenessPillProps {
  guideline: BrandGuideline;
}

const STATUS_STYLES = {
  low:    { ring: 'border-red-500/20    bg-red-500/[0.06]    text-red-300',     dot: 'bg-red-400'    },
  medium: { ring: 'border-amber-500/20  bg-amber-500/[0.06]  text-amber-200',   dot: 'bg-amber-400'  },
  high:   { ring: 'border-emerald-500/20 bg-emerald-500/[0.06] text-emerald-200', dot: 'bg-emerald-400' },
} as const;

const GROUP_LABELS: Record<CompletenessRule['group'], string> = {
  identity: 'Identidade',
  visual:   'Visual',
  strategy: 'Estratégia',
  voice:    'Voz',
  tokens:   'Tokens',
  assets:   'Assets',
};

export const BrandCompletenessPill: React.FC<BrandCompletenessPillProps> = ({
  guideline,
}) => {
  const report = useMemo(() => computeBrandCompleteness(guideline), [guideline]);
  const status = completenessStatus(report.score);
  const style = STATUS_STYLES[status];
  const missingCount = report.missing.length;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [healthReport, setHealthReport] = useState<BrandHealthReport | null>(null);

  const healthMutation = useMutation({
    mutationFn: () => brandGuidelineApi.runHealthCheck(guideline.id!),
    onSuccess: (r) => {
      setHealthReport(r);
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Falha ao analisar marca');
    },
  });

  const triggerHealthCheck = () => {
    if (!guideline.id) return;
    setHealthReport(null);
    setDialogOpen(true);
    healthMutation.mutate();
  };

  return (
    <><DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            'flex items-center gap-1.5 h-8 px-2.5 rounded-full border text-[10px] font-mono uppercase tracking-widest transition-all hover:opacity-90',
            style.ring
          )}
          aria-label={`Brand completeness ${report.score}%`}
        >
          <span className={cn('w-1.5 h-1.5 rounded-full', style.dot)} />
          <span className="font-bold tabular-nums">{report.score}%</span>
          <span className="opacity-50 hidden sm:inline">
            {missingCount === 0 ? '· completa' : `· ${missingCount} pend.`}
          </span>
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-[320px] p-0 bg-neutral-950/95 backdrop-blur-xl border-white/10">
        <div className="p-4 border-b border-white/[0.06]">
          <div className="flex items-baseline justify-between mb-1">
            <span className="text-[10px] font-mono uppercase tracking-widest text-neutral-500">
              Brand completeness
            </span>
            <span className={cn('text-2xl font-bold tabular-nums', style.ring.split(' ').find(c => c.startsWith('text-')))}>
              {report.score}%
            </span>
          </div>
          <p className="text-[11px] text-neutral-500 leading-relaxed">
            Quanto desta marca está pronto para alimentar geração IA.
          </p>

          <div className="mt-3 grid grid-cols-3 gap-1.5">
            {Object.entries(report.byGroup).map(([key, val]) => {
              if (val.max === 0) return null;
              const pct = Math.round((val.score / val.max) * 100);
              return (
                <div key={key} className="flex flex-col gap-1">
                  <span className="text-[9px] font-mono uppercase tracking-widest text-neutral-600">
                    {GROUP_LABELS[key as CompletenessRule['group']]}
                  </span>
                  <div className="h-1 rounded-full bg-white/[0.04] overflow-hidden">
                    <div
                      className={cn('h-full transition-all',
                        pct >= 75 ? 'bg-emerald-500/60' : pct >= 40 ? 'bg-amber-500/60' : 'bg-red-500/40'
                      )}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="max-h-[260px] overflow-y-auto p-2">
          {missingCount === 0 ? (
            <div className="flex items-center gap-2 px-2 py-3 text-[11px] text-emerald-300">
              <CheckCircle2 size={14} />
              Tudo preenchido. Brand pronta pra IA.
            </div>
          ) : (
            <ul className="flex flex-col gap-0.5">
              {report.missing.map((rule) => (
                <li
                  key={rule.id}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-white/[0.03] transition-colors"
                >
                  <AlertCircle size={12} className="text-amber-400/70 shrink-0" />
                  <span className="text-[11px] text-neutral-300 flex-1 truncate">{rule.label}</span>
                  <span className="text-[9px] font-mono text-neutral-600 tabular-nums">+{rule.weight}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {guideline.id && (
          <div className="p-2 border-t border-white/[0.06]">
            <Button
              variant="ghost"
              size="sm"
              onClick={triggerHealthCheck}
              disabled={healthMutation.isPending}
              className="w-full h-8 text-[10px] font-mono uppercase tracking-widest gap-2 text-brand-cyan/80 hover:text-brand-cyan hover:bg-brand-cyan/5"
            >
              <Brain size={11} />
              {healthMutation.isPending ? 'Analisando...' : 'Run Brand Health (IA)'}
            </Button>
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>

    <BrandHealthDialog
      open={dialogOpen}
      onOpenChange={setDialogOpen}
      report={healthReport}
      isLoading={healthMutation.isPending}
      error={healthMutation.error ? (healthMutation.error as Error).message : null}
      onRetry={triggerHealthCheck}
    />
    </>
  );
};
