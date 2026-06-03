import React from 'react';
import { usePluginStore } from '../../store';
import { useOpRunner } from '../../hooks/useOpRunner';
import { useBrandImport } from '../../hooks/useBrandImport';
import { useBrandStrategyIngest } from '../../hooks/useBrandStrategyIngest';
import { OpButton } from '../common/OpButton';
import { Button } from '@/components/ui/button';
import { GlitchLoader } from '@/components/ui/GlitchLoader';
import { RefreshCw, Layers, FileText } from 'lucide-react';

export function BrandIntelligenceSection() {
  const { brandGuideline, isGenerating } = usePluginStore();
  const runner = useOpRunner({ globalBusy: isGenerating });
  const { run: runImport, isImporting } = useBrandImport();
  const { run: runStrategyIngest, isIngesting, hasSelection } = useBrandStrategyIngest();
  const selectionCount = usePluginStore((s) => s.selectionDetails.length);

  if (!brandGuideline) {
    return (
      <div className="text-xs text-muted-foreground text-center py-4">
        Load a brand guideline first to access AI analysis.
      </div>
    );
  }

  const references = brandGuideline.media?.filter((m: any) => m.type === 'reference') || [];

  return (
    <div className="space-y-4">
      <div className="bg-neutral-900/40 p-3 rounded-lg border border-white/5 shadow-sm relative overflow-hidden group">
        <div className="flex flex-col gap-2 relative z-10">
          <Button
            onClick={() => runImport({ overwrite: false })}
            disabled={isImporting || isGenerating}
            variant="brand"
            size="sm"
            title="Detect and sync tokens, colors, typography from this Figma file"
            className="w-full h-8 font-bold uppercase tracking-wider text-[10px]"
          >
            {isImporting ? (
              <GlitchLoader size={12} className="mr-2" />
            ) : (
              <RefreshCw size={12} className="mr-2" />
            )}
            {isImporting ? 'Syncing…' : 'Smart Import from Figma'}
          </Button>

          <Button
            onClick={() => runStrategyIngest()}
            disabled={isIngesting || isImporting || isGenerating}
            variant="outline"
            size="sm"
            title={hasSelection
              ? `Extract text from ${selectionCount} selected frame${selectionCount > 1 ? 's' : ''} and populate brand strategy`
              : 'Extract text from the current page and populate brand strategy fields'
            }
            className="w-full h-8 text-neutral-400 border-white/5 hover:border-white/10"
          >
            {isIngesting ? (
              <GlitchLoader size={12} className="mr-2" />
            ) : (
              <FileText size={12} className="mr-2" />
            )}
            {isIngesting
              ? 'Extracting strategy…'
              : hasSelection
                ? `Populate Strategy from ${selectionCount} Frame${selectionCount > 1 ? 's' : ''}`
                : 'Populate Strategy from Page'}
          </Button>

          <OpButton
            opId="smartScan"
            runner={runner}
            message={{ type: 'SMART_SCAN_SELECTION' }}
            responseTypes={['SMART_SCAN_RESULT']}
            busyLabel="Scanning…"
            variant="outline"
            size="sm"
            title="Categorize selected layers into brand asset types"
            className="w-full h-8 text-neutral-400 border-white/5 hover:border-white/10"
          >
            <Layers size={12} className="mr-2" />
            Scan Selection for Insights
          </OpButton>
        </div>
      </div>

      {references.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-[9px] font-bold uppercase tracking-widest text-neutral-600 px-1">
            Visual References
          </h4>
          <div className="grid grid-cols-2 gap-2">
            {references.map((ref: any, idx: number) => (
              <div
                key={idx}
                className="border border-white/5 rounded-lg overflow-hidden bg-neutral-950/40"
              >
                {ref.url && (
                  <img
                    src={ref.url}
                    alt={ref.label || 'Reference'}
                    className="w-full h-16 object-cover opacity-60 hover:opacity-100 transition-opacity"
                  />
                )}
                <p className="text-[9px] p-2 text-neutral-500 font-mono">{ref.label}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
