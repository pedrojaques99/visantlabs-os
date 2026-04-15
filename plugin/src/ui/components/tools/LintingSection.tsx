import React from 'react';
import { useOpRunner } from '../../hooks/useOpRunner';
import { usePluginStore } from '../../store';
import { OpButton } from '../common/OpButton';
import { ShieldCheck, ShieldAlert, AlertTriangle } from 'lucide-react';

function BrandLintReport({ report }: { report: any }) {
  const totals = report?.totals || {};
  const issues: any[] = Array.isArray(report?.issues) ? report.issues : [];
  const score = typeof report?.score === 'number' ? report.score : null;
  const scoreColor = score === null ? '' : score >= 80 ? 'text-green-500' : score >= 50 ? 'text-yellow-500' : 'text-red-500';

  return (
    <div className="border border-white/5 rounded-lg p-3 space-y-2 mt-3 bg-white/[0.02]">
      <div className="flex items-center justify-between text-[10px]">
        <span className="font-bold uppercase tracking-wider text-neutral-500">Lint Report</span>
        {score !== null && <span className={`font-bold ${scoreColor}`}>SCORE {score}%</span>}
      </div>
      <div className="flex gap-3 text-[9px] font-mono text-neutral-500">
        <span>{totals.nodesScanned ?? 0} NODES</span>
        <span className="text-red-500/80">{totals.errors ?? 0} ERRORS</span>
        <span className="text-yellow-500/80">{totals.warnings ?? 0} WARNINGS</span>
      </div>
      {issues.length > 0 && (
        <div className="max-h-32 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
          {issues.slice(0, 15).map((iss, i) => (
            <div key={`${iss.nodeId}-${i}`} className="text-[9px] border-l border-white/10 pl-2 py-1 bg-white/[0.01]">
              <div className="font-mono truncate text-neutral-400">{iss.nodeName || iss.nodeId}</div>
              <div className="text-neutral-500">{iss.message}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function LintingSection() {
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
          busyLabel="Linting…"
          variant="outline"
          size="sm"
          className="h-8 text-[10px]"
        >
          <ShieldAlert size={12} className="mr-2 text-neutral-500" />
          Scan Brand
        </OpButton>
        <OpButton
          opId="lintFix"
          runner={runner}
          message={{ type: 'BRAND_LINT_FIX', brand: store.brandGuideline }}
          responseTypes={['BRAND_LINT_REPORT', 'OPERATIONS_DONE']}
          busyLabel="Fixing…"
          variant="outline"
          size="sm"
          className="h-8 text-[10px]"
        >
          <ShieldCheck size={12} className="mr-2 text-neutral-500" />
          Auto Fix
        </OpButton>
      </div>

      {store.brandLintReport && <BrandLintReport report={store.brandLintReport} />}
    </div>
  );
}
