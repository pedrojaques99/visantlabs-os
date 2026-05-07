import React from 'react';
import { useFigmaMessages } from '../../hooks/useFigmaMessages';
import { useSmartAnalyze } from '../../hooks/useSmartAnalyze';
import { useOpRunner } from '../../hooks/useOpRunner';
import { usePluginStore } from '../../store';
import { OpButton } from '../common/OpButton';
import { Zap, Grid3X3, Smartphone } from 'lucide-react';

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

    </div>
  );
}
