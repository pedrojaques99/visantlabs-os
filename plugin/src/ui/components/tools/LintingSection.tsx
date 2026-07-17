import React from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { useOpRunner } from '../../hooks/useOpRunner';
import { usePluginStore } from '../../store';
import { OpButton } from '../common/OpButton';
import { ShieldCheck, ShieldAlert, AlertTriangle } from 'lucide-react';

function BrandLintReport({ report }: { report: any }) {
  const { t } = useTranslation();
  const totals = report?.totals || {};
  const issues: any[] = Array.isArray(report?.issues) ? report.issues : [];
  const score = typeof report?.score === 'number' ? report.score : null;
  const scoreColor =
    score === null
      ? ''
      : score >= 80
        ? 'text-green-500'
        : score >= 50
          ? 'text-yellow-500'
          : 'text-red-500';

  return (
    <div className="border border-border/50 rounded-lg p-3 space-y-2 mt-3 bg-muted/30">
      <div className="flex items-center justify-between text-[10px]">
        <span className="font-bold uppercase tracking-wider text-muted-foreground">{t('plugin.tools.linting.report')}</span>
        {score !== null && <span className={`font-bold ${scoreColor}`}>{t('plugin.tools.linting.score', { score })}</span>}
      </div>
      <div className="flex gap-3 text-[9px] font-mono text-muted-foreground">
        <span>{t('plugin.tools.linting.nodes', { count: totals.nodesScanned ?? 0 })}</span>
        <span className="text-red-500/80">{t('plugin.tools.linting.errors', { count: totals.errors ?? 0 })}</span>
        <span className="text-yellow-500/80">{t('plugin.tools.linting.warnings', { count: totals.warnings ?? 0 })}</span>
      </div>
      {issues.length > 0 && (
        <div className="max-h-32 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
          {issues.slice(0, 15).map((iss, i) => (
            <div
              key={`${iss.nodeId}-${i}`}
              className="text-[9px] border-l border-border pl-2 py-1 bg-foreground/[0.01]"
            >
              <div className="font-mono truncate text-muted-foreground">
                {iss.nodeName || iss.nodeId}
              </div>
              <div className="text-muted-foreground">{iss.message}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function LintingSection() {
  const { t } = useTranslation();
  const store = usePluginStore();
  const isGenerating = usePluginStore((s) => s.isGenerating);
  const runner = useOpRunner({ globalBusy: isGenerating });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        <OpButton
          opId="lint"
          runner={runner}
          message={{ type: 'BRAND_LINT', brand: store.brandGuideline }}
          responseTypes={['BRAND_LINT_REPORT']}
          busyLabel={t('plugin.tools.linting.linting')}
          variant="outline"
          size="sm"
          title={t('plugin.tools.linting.scanBrandTitle')}
          className="h-8 text-[10px]"
        >
          <ShieldAlert size={12} className="mr-2 text-muted-foreground" />
          {t('plugin.tools.linting.scanBrand')}
        </OpButton>
        <OpButton
          opId="lintFix"
          runner={runner}
          message={{ type: 'BRAND_LINT_FIX', brand: store.brandGuideline }}
          responseTypes={['BRAND_LINT_REPORT', 'OPERATIONS_DONE']}
          busyLabel={t('plugin.tools.linting.fixing')}
          variant="outline"
          size="sm"
          title={t('plugin.tools.linting.autoFixTitle')}
          className="h-8 text-[10px]"
        >
          <ShieldCheck size={12} className="mr-2 text-muted-foreground" />
          {t('plugin.tools.linting.autoFix')}
        </OpButton>
      </div>

      {store.brandLintReport && <BrandLintReport report={store.brandLintReport} />}
    </div>
  );
}
