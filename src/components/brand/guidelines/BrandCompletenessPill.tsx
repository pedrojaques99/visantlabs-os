import React, { useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CheckCircle2, ArrowRight, Stethoscope } from '@/lib/ui/icons';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/hooks/useTranslation';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { computeBrandCompleteness, completenessStatus } from '@/lib/brandCompleteness';
import type { BrandGuideline } from '@/lib/figma-types';
import { brandGuidelineApi, type BrandHealthReport } from '@/services/brandGuidelineApi';
import { BRAND_GAP_HINTS as WHY_BY_ID } from '@/lib/brandGapHints';
import { BrandHealthDialog } from './BrandHealthDialog';

interface BrandCompletenessPillProps {
  guideline: BrandGuideline;
}

const STATUS_STYLES = {
  low: {
    ring: 'border-destructive/20    bg-destructive/[0.06]    text-destructive',
    dot: 'bg-destructive',
  },
  medium: { ring: 'border-warning/20  bg-warning/[0.06]  text-warning', dot: 'bg-warning' },
  high: { ring: 'border-success/20 bg-success/[0.06] text-success', dot: 'bg-success' },
} as const;

export const BrandCompletenessPill: React.FC<BrandCompletenessPillProps> = ({ guideline }) => {
  const { t } = useTranslation();
  const report = useMemo(() => computeBrandCompleteness(guideline), [guideline]);
  const status = completenessStatus(report.score);
  const style = STATUS_STYLES[status] ?? STATUS_STYLES.low;
  const missingCount = report.missing?.length ?? 0;

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
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={cn(
              'flex items-center gap-1.5 h-8 px-2.5 rounded-full border text-[11px] font-medium transition-[color,background-color,border-color,opacity] hover:opacity-90',
              style.ring
            )}
            aria-label={`Prontidão pra IA ${report.score}%`}
          >
            <span className={cn('w-1.5 h-1.5 rounded-full', style.dot)} />
            <span className="font-bold tabular-nums">{report.score}%</span>
            <span className="opacity-50 hidden sm:inline">
              {missingCount === 0 ? '· pronta' : `· ${missingCount} pend.`}
            </span>
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="end"
          className="w-[340px] p-0 bg-neutral-950/95 backdrop-blur-xl border-white/10"
        >
          {/* Header: enquadra pelo OUTPUT (não pela vaidade "% completo"). Sem as
              6 barrinhas de grupo — não diziam nada e eram cara de dashboard slop. */}
          <div className="p-4 border-b border-neutral-800">
            <div className="text-[10px] uppercase tracking-wider text-neutral-600">
              Prontidão pra IA
            </div>
            <p className="mt-1.5 text-[13px] text-neutral-300 leading-snug">
              {missingCount === 0 ? (
                'Marca pronta — a IA gera com todo o contexto.'
              ) : (
                <>
                  Faltam{' '}
                  <span className="font-semibold text-white tabular-nums">{missingCount}</span>{' '}
                  {missingCount === 1 ? 'coisa' : 'coisas'} pra IA gerar mais no ponto.
                </>
              )}
            </p>
          </div>

          {/* Gaps: cada um amarrado à CONSEQUÊNCIA de geração — sem "+N pontos". */}
          <div className="max-h-[300px] overflow-y-auto p-2">
            {missingCount === 0 ? (
              <div className="flex items-center gap-2 px-2 py-3 text-[12px] text-success">
                <CheckCircle2 size={14} />
                {t('brandGuidelines.completenessAllSet')}
              </div>
            ) : (
              <ul className="flex flex-col">
                {report.missing.map((rule) => (
                  <li
                    key={rule.id}
                    className="px-2 py-2 rounded-md hover:bg-white/[0.03] transition-colors"
                  >
                    <div className="flex items-start gap-2.5">
                      <span
                        className={cn('mt-[7px] w-1 h-1 rounded-full shrink-0', style.dot)}
                        aria-hidden
                      />
                      <div className="min-w-0">
                        <div className="text-[12.5px] text-neutral-200 leading-tight">
                          {t(`brandCompleteness.${rule.id}`) || rule.label}
                        </div>
                        {WHY_BY_ID[rule.id] && (
                          <div className="text-[11px] text-neutral-500 leading-snug mt-0.5">
                            {WHY_BY_ID[rule.id]}
                          </div>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Auditoria profunda (relatório por IA). Nome pelo que FAZ — sem selo
              "(IA)" nem ícone de cérebro (era sinalização de slop). */}
          {guideline.id && (
            <div className="p-2 border-t border-neutral-800">
              <Button
                variant="ghost"
                size="sm"
                onClick={triggerHealthCheck}
                disabled={healthMutation.isPending}
                className="w-full h-8 text-xs gap-2 text-brand-cyan/80 hover:text-brand-cyan hover:bg-brand-cyan/5"
              >
                <Stethoscope size={12} />
                {healthMutation.isPending ? 'Analisando…' : 'Auditar a fundo'}
                {!healthMutation.isPending && (
                  <ArrowRight size={12} className="ml-auto opacity-50" />
                )}
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
