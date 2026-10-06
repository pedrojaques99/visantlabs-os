import React, { useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CheckCircle2, ArrowRight, Stethoscope } from '@/lib/ui/icons';
import { useTranslation } from '@/hooks/useTranslation';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { computeBrandCompleteness } from '@/lib/brandCompleteness';
import type { BrandGuideline } from '@/lib/figma-types';
import { brandGuidelineApi, type BrandHealthReport } from '@/services/brandGuidelineApi';
import { brandGapHint } from '@/lib/brandGapHints';
import { BrandHealthDialog } from './BrandHealthDialog';

interface BrandCompletenessPillProps {
  guideline: BrandGuideline;
}

export const BrandCompletenessPill: React.FC<BrandCompletenessPillProps> = ({ guideline }) => {
  const { t, tOr } = useTranslation();
  // Leitura neutra: o número já diz o quanto falta; semáforo vermelho/verde
  // transformava "marca em construção" em alarme.
  const report = useMemo(() => computeBrandCompleteness(guideline), [guideline]);
  const missingCount = report.missing?.length ?? 0;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [healthReport, setHealthReport] = useState<BrandHealthReport | null>(null);

  const healthMutation = useMutation({
    mutationFn: () => brandGuidelineApi.runHealthCheck(guideline.id!),
    onSuccess: (r) => {
      setHealthReport(r);
    },
    onError: (err: Error) => {
      toast.error(err.message || t('errors.brandHealthCheckFailed'));
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
            className="flex items-center gap-1.5 h-8 px-2.5 rounded-full border border-border bg-muted/40 text-2xs font-medium text-foreground transition-colors hover:bg-muted"
            aria-label={t('brandGuidelines.readiness.aria', { score: report.score })}
          >
            <span>
              {missingCount === 0
                ? t('brandGuidelines.readiness.ready')
                : t('brandGuidelines.readiness.pending', { count: missingCount })}
            </span>
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-[340px] p-0">
          {/* Header: enquadra pelo OUTPUT (não pela vaidade "% completo"). Sem as
              6 barrinhas de grupo — não diziam nada e eram cara de dashboard slop. */}
          <div className="p-4 border-b border-border">
            <div className="text-xs font-medium text-foreground">
              {t('brandGuidelines.readiness.title')}
            </div>
            <p className="mt-1.5 text-sm text-muted-foreground leading-snug">
              {missingCount === 0
                ? t('brandGuidelines.readiness.readyBody')
                : missingCount === 1
                  ? t('brandGuidelines.readiness.missingOne')
                  : t('brandGuidelines.readiness.missingMany', { count: missingCount })}
            </p>
          </div>

          {/* Gaps: cada um amarrado à CONSEQUÊNCIA de geração — sem "+N pontos". */}
          <div className="max-h-[300px] overflow-y-auto p-2">
            {missingCount === 0 ? (
              <div className="flex items-center gap-2 px-2 py-3 text-xs text-muted-foreground">
                <CheckCircle2 size={14} />
                {t('brandGuidelines.completenessAllSet')}
              </div>
            ) : (
              <ul className="flex flex-col">
                {report.missing.map((rule) => (
                  <li key={rule.id} className="px-2 py-2 rounded-md">
                    <div className="flex items-start gap-2.5">
                      <span
                        className="mt-[7px] w-1 h-1 rounded-full shrink-0 bg-muted-foreground"
                        aria-hidden
                      />
                      <div className="min-w-0">
                        <div className="text-xs text-foreground leading-tight">
                          {tOr(`brandCompleteness.${rule.id}`, rule.label)}
                        </div>
                        {brandGapHint(rule.id, t) && (
                          <div className="text-2xs text-muted-foreground leading-snug mt-0.5">
                            {brandGapHint(rule.id, t)}
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
            <div className="p-2 border-t border-border">
              <Button
                variant="ghost"
                size="sm"
                onClick={triggerHealthCheck}
                disabled={healthMutation.isPending}
                className="w-full h-8 text-xs gap-2"
              >
                <Stethoscope size={12} />
                {healthMutation.isPending
                  ? t('common.analysing')
                  : t('brandGuidelines.readiness.deepAudit')}
                {!healthMutation.isPending && (
                  <ArrowRight size={12} className="ml-auto text-muted-foreground" />
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
