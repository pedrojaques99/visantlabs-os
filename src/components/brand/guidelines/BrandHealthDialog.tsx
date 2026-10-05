import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Stethoscope, CheckCircle2, AlertTriangle, XOctagon } from '@/lib/ui/icons';
import { cn } from '@/lib/utils';
import type { BrandHealthReport, BrandHealthInsight } from '@/services/brandGuidelineApi';
import { formatDateTime } from '@/utils/localeUtils';
import { useTranslation } from '@/hooks/useTranslation';

import { GlitchLoader } from '@/components/ui/GlitchLoader';
interface BrandHealthDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  report: BrandHealthReport | null;
  isLoading: boolean;
  error?: string | null;
  onRetry?: () => void;
}

const LEVEL_STYLES: Record<
  BrandHealthInsight['level'],
  { icon: React.ComponentType<{ size?: number; className?: string }>; cls: string }
> = {
  // Só o ícone carrega o nível: card inteiro tingido virava parede de semáforo.
  pass: { icon: CheckCircle2, cls: 'text-success' },
  warn: { icon: AlertTriangle, cls: 'text-warning' },
  fail: { icon: XOctagon, cls: 'text-destructive' },
};

export const BrandHealthDialog: React.FC<BrandHealthDialogProps> = ({
  open,
  onOpenChange,
  report,
  isLoading,
  error,
  onRetry,
}) => {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <Stethoscope size={14} className="text-muted-foreground" />
            <DialogTitle>{t('brandHealth.title')}</DialogTitle>
          </div>
          <DialogDescription>{t('brandHealth.description')}</DialogDescription>
        </DialogHeader>

        <DialogBody>
          {isLoading && (
            <div className="flex flex-col items-center justify-center gap-3 py-16">
              <GlitchLoader size={20} />
              <p className="text-xs text-muted-foreground">{t('brandHealth.loading')}</p>
            </div>
          )}

          {error && !isLoading && (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <XOctagon size={20} className="text-destructive" />
              <p className="text-xs text-muted-foreground max-w-md">{error}</p>
              {onRetry && (
                <Button variant="ghost" size="sm" onClick={onRetry}>
                  {t('common.retry')}
                </Button>
              )}
            </div>
          )}

          {!isLoading && !error && report && (
            <div className="flex flex-col gap-6">
              <div className="flex items-center gap-4 p-4 rounded-xl bg-muted/40 border border-border">
                <div className="text-3xl font-semibold text-foreground tabular-nums">
                  {report.score}
                </div>
                <div className="flex-1">
                  <p className="text-xs font-medium text-muted-foreground mb-1">
                    {t('brandHealth.coherence')}
                  </p>
                  <p className="text-sm text-foreground leading-relaxed">{report.summary}</p>
                </div>
              </div>

              {report.insights.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-foreground mb-2.5">
                    {t('brandHealth.insights')}
                  </h3>
                  <ul className="flex flex-col gap-2">
                    {report.insights.map((ins, i) => {
                      const meta = LEVEL_STYLES[ins.level];
                      const Icon = meta.icon;
                      return (
                        <li
                          key={i}
                          className="flex gap-3 p-3 rounded-lg border border-border bg-muted/30 text-xs"
                        >
                          <Icon size={13} className={cn('shrink-0 mt-0.5', meta.cls)} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline gap-2 flex-wrap">
                              <span className="font-medium text-foreground">{ins.title}</span>
                              <span className="text-2xs text-muted-foreground">{ins.category}</span>
                            </div>
                            <p className="mt-1 text-muted-foreground leading-snug">{ins.detail}</p>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              {report.recommendations.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-foreground mb-2.5">
                    {t('brandHealth.recommendations')}
                  </h3>
                  <ul className="flex flex-col gap-2">
                    {report.recommendations.map((rec, i) => (
                      <li key={i} className="p-3 rounded-lg border border-border bg-muted/30">
                        <p className="text-xs text-foreground font-medium">{rec.action}</p>
                        <p className="mt-1 text-xs text-muted-foreground leading-snug">
                          {rec.reason}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex items-center justify-between pt-3 border-t border-border">
                <span className="flex items-center gap-3 text-2xs text-muted-foreground">
                  <span className="font-mono">{report.model}</span>
                  <span>{formatDateTime(report.generatedAt)}</span>
                </span>
                {onRetry && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onRetry}
                    className="h-7 text-xs gap-1.5"
                  >
                    <Stethoscope size={11} />
                    {t('brandHealth.rerun')}
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
};
