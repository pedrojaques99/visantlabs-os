import React from 'react';
import { useFigmaMessages } from '../../hooks/useFigmaMessages';
import { useSmartAnalyze } from '../../hooks/useSmartAnalyze';
import { useOpRunner } from '../../hooks/useOpRunner';
import { usePluginStore } from '../../store';
import { OpButton } from '../common/OpButton';
import { Zap, Grid3X3, Smartphone, FileJson, Image as ImageIcon, StickyNote, Download, Copy } from 'lucide-react';

function BrandLintReport({ report }: { report: any }) {
  const totals = report?.totals || {};
  const issues: any[] = Array.isArray(report?.issues) ? report.issues : [];
  const score = typeof report?.score === 'number' ? report.score : null;
  const scoreColor = score === null ? '' : score >= 80 ? 'text-green-500' : score >= 50 ? 'text-yellow-500' : 'text-red-500';

  return (
    <div className="border border-border rounded p-2 space-y-2 mt-2">
      <div className="flex items-center justify-between text-xs">
        <span className="font-mono uppercase text-muted-foreground">Lint Report</span>
        {score !== null && <span className={`font-semibold ${scoreColor}`}>Score {score}</span>}
      </div>
      <div className="flex gap-3 text-[10px] text-muted-foreground">
        <span>{totals.nodesScanned ?? 0} nodes</span>
        <span className="text-red-500">{totals.errors ?? 0} errors</span>
        <span className="text-yellow-500">{totals.warnings ?? 0} warnings</span>
        <span>{totals.infos ?? 0} info</span>
      </div>
      {issues.length > 0 && (
        <div className="max-h-40 overflow-y-auto space-y-1">
          {issues.slice(0, 30).map((iss, i) => (
            <div key={`${iss.nodeId}-${i}`} className="text-[10px] border-l-2 pl-2 py-0.5" style={{ borderColor: iss.severity === 'error' ? '#ef4444' : iss.severity === 'warning' ? '#eab308' : '#6b7280' }}>
              <div className="font-mono truncate">{iss.nodeName || iss.nodeId}</div>
              <div className="text-muted-foreground">{iss.message}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function BrandOperationsSection() {
  useFigmaMessages(); // ensure listener mounted
  const { analyze } = useSmartAnalyze();
  const store = usePluginStore();
  const isGenerating = usePluginStore((s) => s.isGenerating);
  const runner = useOpRunner({ globalBusy: isGenerating });

  const brandColorsArray = store.selectedColors
    ? Array.from(store.selectedColors.values()).map((c) => ({ hex: c.hex, name: c.role }))
    : [];
  const brandColorHexes = store.selectedColors
    ? Array.from(store.selectedColors.values()).map((c) => c.hex)
    : undefined;

  return (
    <div className="space-y-4 p-1">
      <div className="space-y-3 bg-neutral-900/40 p-3 rounded-lg border border-border/60 shadow-sm">
        <h3 className="text-[11px] uppercase tracking-widest font-semibold flex items-center gap-2 text-muted-foreground pb-2 border-b border-border/40">
          AI Intelligence
        </h3>

        <OpButton
          opId="smartScan"
          runner={runner}
          message={{ type: 'SMART_SCAN_SELECTION' }}
          responseTypes={['SMART_SCAN_RESULT']}
          busyLabel="Scanning selection…"
          variant="brand"
          size="sm"
          className="w-full"
        >
          Smart Scan Selection
        </OpButton>

        <div className="grid grid-cols-2 gap-2">
          <OpButton
            opId="analyzeJson"
            runner={runner}
            task={() => analyze('figma-plugin')}
            busyLabel="Analyzing…"
            variant="outline"
            size="sm"
          >
            Analyze to JSON
          </OpButton>
          <OpButton
            opId="analyzePrompt"
            runner={runner}
            task={() => analyze('image-gen')}
            busyLabel="Analyzing…"
            variant="outline"
            size="sm"
          >
            Analyze to Prompt
          </OpButton>
        </div>
      </div>

      <div className="space-y-3 bg-neutral-900/40 p-3 rounded-lg border border-border/60 shadow-sm">
        <h3 className="text-[11px] uppercase tracking-widest font-semibold flex items-center gap-2 text-muted-foreground pb-2 border-b border-border/40">
          Brand Automation
        </h3>

        <OpButton
          opId="varyColors"
          runner={runner}
          message={{ type: 'VARY_SELECTION_COLORS', brandColors: brandColorHexes }}
          responseTypes={['OPERATIONS_DONE']}
          busyLabel="Variando cores…"
          variant="brand"
          size="sm"
          className="w-full"
        >
          Variar Cores Inteligente
        </OpButton>

        <div className="grid grid-cols-2 gap-2">
          <OpButton
            opId="brandGrid"
            runner={runner}
            message={{ type: 'GENERATE_BRAND_GRID' }}
            responseTypes={['OPERATIONS_DONE']}
            busyLabel="Criando grid…"
            variant="outline"
            size="sm"
          >
            Brand Grid
          </OpButton>
          <OpButton
            opId="socialFrames"
            runner={runner}
            message={{ type: 'GENERATE_SOCIAL_FRAMES', brandColors: brandColorsArray }}
            responseTypes={['OPERATIONS_DONE']}
            busyLabel="Criando frames…"
            variant="outline"
            size="sm"
          >
            Social Frames
          </OpButton>
        </div>
      </div>

      <div className="space-y-3 bg-neutral-900/40 p-3 rounded-lg border border-border/60 shadow-sm">
        <h3 className="text-[11px] uppercase tracking-widest font-semibold flex items-center gap-2 text-muted-foreground pb-2 border-b border-border/40">
          Brand Linting
        </h3>

        <div className="grid grid-cols-2 gap-2">
          <OpButton
            opId="lint"
            runner={runner}
            message={{ type: 'BRAND_LINT', brand: store.brandGuideline }}
            responseTypes={['BRAND_LINT_REPORT']}
            busyLabel="Linting…"
            variant="outline"
            size="sm"
          >
            Lint
          </OpButton>
          <OpButton
            opId="lintFix"
            runner={runner}
            message={{ type: 'BRAND_LINT_FIX', brand: store.brandGuideline }}
            responseTypes={['BRAND_LINT_REPORT', 'OPERATIONS_DONE']}
            busyLabel="Fixing…"
            variant="outline"
            size="sm"
          >
            Fix Issues
          </OpButton>
        </div>

        {store.brandLintReport && <BrandLintReport report={store.brandLintReport} />}
      </div>

      <div className="space-y-3 bg-neutral-900/40 p-3 rounded-lg border border-border/60 shadow-sm">
        <h3 className="text-[11px] uppercase tracking-widest font-semibold flex items-center gap-2 text-muted-foreground pb-2 border-b border-border/40">
          Layout & Assets
        </h3>

        <div className="grid grid-cols-2 gap-2">
          <OpButton
            opId="slices"
            runner={runner}
            message={{ type: 'SELECTION_TO_SLICES' }}
            responseTypes={['OPERATIONS_DONE']}
            busyLabel="Fatiando…"
            variant="outline"
            size="sm"
          >
            Carousel Slices
          </OpButton>
          <OpButton
            opId="responsive"
            runner={runner}
            message={{ type: 'RESPONSIVE_MULTIPLY' }}
            responseTypes={['OPERATIONS_DONE']}
            busyLabel="Gerando…"
            variant="outline"
            size="sm"
          >
            Responsive
          </OpButton>
          <OpButton
            opId="copyJSX"
            runner={runner}
            message={{ type: 'COPY_ILLUSTRATOR_CODE' }}
            responseTypes={['ILLUSTRATOR_CODE_READY']}
            busyLabel="Copiando…"
            variant="outline"
            size="sm"
          >
            Copy AI JSX
          </OpButton>
          <OpButton
            opId="exportAI"
            runner={runner}
            message={{ type: 'ILLUSTRATOR_EXPORT' }}
            responseTypes={['ILLUSTRATOR_CODE_READY', 'OPERATIONS_DONE']}
            busyLabel="Exportando…"
            variant="outline"
            size="sm"
          >
            Export AI Files
          </OpButton>
        </div>

        <OpButton
          opId="sticky"
          runner={runner}
          message={{
            type: 'CREATE_STICKY_PROMPT',
            name: 'Design Note',
            prompt: 'Escreva aqui suas considerações sobre o design para que a IA possa usar como contexto.'
          }}
          responseTypes={['OPERATIONS_DONE']}
          busyLabel="Criando sticky…"
          variant="outline"
          size="sm"
          className="w-full"
        >
          Sticky Note
        </OpButton>
      </div>
    </div>
  );
}
