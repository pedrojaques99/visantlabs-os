import React from 'react';
import { usePluginStore } from '../../store';
import { useBrandIntelligence } from '../../hooks/useBrandIntelligence';
import { useOpRunner } from '../../hooks/useOpRunner';
import { useBrandImport } from '../../hooks/useBrandImport';
import { OpButton } from '../common/OpButton';
import { Button } from '@/components/ui/button';
import { GlitchLoader } from '@/components/ui/GlitchLoader';
import { Sparkles, RefreshCw, Layers } from 'lucide-react';

export function BrandIntelligenceSection() {
  const { brandGuideline, isGenerating } = usePluginStore();
  const runner = useOpRunner({ globalBusy: isGenerating });
  const { run: runImport, isImporting } = useBrandImport();

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
        <Sparkles size={24} className="absolute -top-1 -right-1 text-brand-cyan/10 rotate-12 group-hover:text-brand-cyan/20 transition-colors" />
        
        <div className="flex flex-col gap-2 relative z-10">
          <Button
            onClick={() => runImport({ overwrite: false })}
            disabled={isImporting || isGenerating}
            variant="brand"
            size="sm"
            className="w-full h-8 font-bold uppercase tracking-wider text-[10px]"
          >
            {isImporting ? <GlitchLoader size={12} className="mr-2" /> : <RefreshCw size={12} className="mr-2" />}
            {isImporting ? 'Sincronizando...' : 'Smart Import from Figma'}
          </Button>

          <OpButton
            opId="smartScan"
            runner={runner}
            message={{ type: 'SMART_SCAN_SELECTION' }}
            responseTypes={['SMART_SCAN_RESULT']}
            busyLabel="Scanning selection…"
            variant="outline"
            size="sm"
            className="w-full h-8 text-neutral-400 border-white/5 hover:border-white/10"
          >
            <Layers size={12} className="mr-2" />
            Scan Selection for Insights
          </OpButton>
        </div>
      </div>

      <p className="text-[9px] text-neutral-500 leading-tight px-1 italic">
        * Smart Import detecta automaticamente tokens (primary/500, Heading/H1, Logo/Dark) no arquivo atual.
      </p>

      {references.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-[9px] font-bold uppercase tracking-widest text-neutral-600 px-1">Visual References</h4>
          <div className="grid grid-cols-2 gap-2">
            {references.map((ref: any, idx: number) => (
              <div key={idx} className="border border-white/5 rounded-lg overflow-hidden bg-neutral-950/40">
                {ref.url && <img src={ref.url} alt={ref.label || 'Reference'} className="w-full h-16 object-cover opacity-60 hover:opacity-100 transition-opacity" />}
                <p className="text-[9px] p-2 text-neutral-500 font-mono">{ref.label}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
