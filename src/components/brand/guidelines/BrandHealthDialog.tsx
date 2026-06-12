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
import { Brain, CheckCircle2, AlertTriangle, XOctagon } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { BrandHealthReport, BrandHealthInsight } from '@/services/brandGuidelineApi';
import { formatDateTime } from '@/utils/localeUtils';

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
  pass: { icon: CheckCircle2, cls: 'text-success bg-success/[0.08] border-success/20' },
  warn: {
    icon: AlertTriangle,
    cls: 'text-warning    bg-warning/[0.08]    border-warning/20',
  },
  fail: {
    icon: XOctagon,
    cls: 'text-destructive     bg-destructive/[0.08]      border-destructive/20',
  },
};

export const BrandHealthDialog: React.FC<BrandHealthDialogProps> = ({
  open,
  onOpenChange,
  report,
  isLoading,
  error,
  onRetry,
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <Brain size={14} className="text-brand-cyan" />
            <DialogTitle className="text-sm font-bold uppercase tracking-[0.15em]">
              Brand Health Check
            </DialogTitle>
          </div>
          <DialogDescription className="text-[11px] text-neutral-500">
            Análise de coerência da marca pra geração IA — gerada por LLM.
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          {isLoading && (
            <div className="flex flex-col items-center justify-center gap-3 py-16">
              <GlitchLoader size={20} />
              <p className="text-[11px] text-neutral-500 font-mono uppercase tracking-widest">
                Auditando marca…
              </p>
            </div>
          )}

          {error && !isLoading && (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <XOctagon size={20} className="text-destructive" />
              <p className="text-xs text-neutral-400 max-w-md">{error}</p>
              {onRetry && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onRetry}
                  className="text-[10px] font-mono uppercase tracking-widest"
                >
                  Tentar novamente
                </Button>
              )}
            </div>
          )}

          {!isLoading && !error && report && (
            <div className="flex flex-col gap-6">
              <div className="flex items-center gap-4 p-4 rounded-xl bg-white/[0.03] border border-neutral-800">
                <div className="text-3xl font-bold text-brand-cyan tabular-nums">
                  {report.score}
                </div>
                <div className="flex-1">
                  <p className="text-[10px] font-mono uppercase tracking-widest text-neutral-600 mb-1">
                    Coerência
                  </p>
                  <p className="text-xs text-neutral-300 leading-relaxed">{report.summary}</p>
                </div>
              </div>

              {report.insights.length > 0 && (
                <div>
                  <h3 className="text-[10px] font-mono uppercase tracking-widest text-neutral-600 mb-2.5">
                    Insights
                  </h3>
                  <ul className="flex flex-col gap-2">
                    {report.insights.map((ins, i) => {
                      const meta = LEVEL_STYLES[ins.level];
                      const Icon = meta.icon;
                      return (
                        <li
                          key={i}
                          className={cn('flex gap-3 p-3 rounded-lg border text-xs', meta.cls)}
                        >
                          <Icon size={13} className="shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline gap-2 flex-wrap">
                              <span className="font-bold">{ins.title}</span>
                              <span className="text-[10px] font-mono uppercase tracking-widest opacity-50">
                                {ins.category}
                              </span>
                            </div>
                            <p className="mt-1 opacity-80 leading-snug">{ins.detail}</p>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              {report.recommendations.length > 0 && (
                <div>
                  <h3 className="text-[10px] font-mono uppercase tracking-widest text-neutral-600 mb-2.5">
                    Recomendações
                  </h3>
                  <ul className="flex flex-col gap-2">
                    {report.recommendations.map((rec, i) => (
                      <li
                        key={i}
                        className="p-3 rounded-lg border border-neutral-800 bg-white/[0.03]"
                      >
                        <p className="text-xs text-neutral-200 font-semibold">{rec.action}</p>
                        <p className="mt-1 text-[11px] text-neutral-500 leading-snug">
                          {rec.reason}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex items-center justify-between pt-3 border-t border-neutral-800">
                <span className="text-[10px] font-mono text-neutral-700 uppercase tracking-widest">
                  {report.model} · {formatDateTime(report.generatedAt)}
                </span>
                {onRetry && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onRetry}
                    className="h-7 text-[10px] font-mono uppercase tracking-widest gap-1.5 text-neutral-500 hover:text-brand-cyan"
                  >
                    <Brain size={11} />
                    Re-analisar
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
