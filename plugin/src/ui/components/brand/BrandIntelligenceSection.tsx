import React from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { usePluginStore } from '../../store';
import { useBrandImport } from '../../hooks/useBrandImport';
import { useBrandStrategyIngest } from '../../hooks/useBrandStrategyIngest';
import { useSlidesAnalyze } from '../../hooks/useSlidesAnalyze';
import { SlidesPreviewPanel } from './SlidesPreviewPanel';
import { Button } from '@/components/ui/button';
import { GlitchLoader } from '@/components/ui/GlitchLoader';
import { RefreshCw, FileText, Presentation } from 'lucide-react';

export function BrandIntelligenceSection() {
  const { t } = useTranslation();
  const { brandGuideline, isGenerating } = usePluginStore();
  const { run: runImport, isImporting } = useBrandImport();
  const { run: runStrategyIngest, isIngesting, hasSelection } = useBrandStrategyIngest();
  const { scan, apply, dismiss, isScanning, isApplying, progress, preview } = useSlidesAnalyze();
  const selectionCount = usePluginStore((s) => s.selectionDetails.length);
  const busy = isImporting || isIngesting || isScanning || isApplying || isGenerating;

  if (!brandGuideline) {
    return (
      <div className="text-xs text-muted-foreground text-center py-4">
        {t('plugin.brand.intelligence.loadFirst')}
      </div>
    );
  }

  // Show full-panel preview when dry-run result is available
  if (preview) {
    return (
      <SlidesPreviewPanel
        preview={preview}
        isApplying={isApplying}
        onApply={apply}
        onDismiss={dismiss}
      />
    );
  }

  const references = brandGuideline.media?.filter((m: any) => m.type === 'reference') || [];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2">
        <Button
          onClick={() => scan()}
          disabled={busy}
          variant="brand"
          size="sm"
          title={t('plugin.brand.intelligence.analyzeTitle')}
          className="w-full h-8 font-bold uppercase tracking-wider text-[10px]"
        >
          {isScanning ? (
            <GlitchLoader size={12} className="mr-2" />
          ) : (
            <Presentation size={12} className="mr-2" />
          )}
          {isScanning ? (progress ?? t('plugin.brand.intelligence.analyzing')) : t('plugin.brand.intelligence.analyzeAll')}
        </Button>

        <Button
          onClick={() => runImport({ overwrite: false })}
          disabled={busy}
          variant="outline"
          size="sm"
          title={t('plugin.brand.intelligence.smartImportTitle')}
          className="w-full h-8 text-muted-foreground border-border/50 hover:border-border"
        >
          {isImporting ? (
            <GlitchLoader size={12} className="mr-2" />
          ) : (
            <RefreshCw size={12} className="mr-2" />
          )}
          {isImporting ? t('plugin.brand.intelligence.syncing') : t('plugin.brand.intelligence.smartImport')}
        </Button>

        <Button
          onClick={() => runStrategyIngest()}
          disabled={busy}
          variant="outline"
          size="sm"
          title={
            hasSelection
              ? t('plugin.brand.intelligence.extractSelectionTitle', { count: selectionCount })
              : t('plugin.brand.intelligence.extractPageTitle')
          }
          className="w-full h-8 text-muted-foreground border-border/50 hover:border-border"
        >
          {isIngesting ? (
            <GlitchLoader size={12} className="mr-2" />
          ) : (
            <FileText size={12} className="mr-2" />
          )}
          {isIngesting
            ? t('plugin.brand.intelligence.extractingStrategy')
            : hasSelection
              ? t('plugin.brand.intelligence.populateSelection', { count: selectionCount })
              : t('plugin.brand.intelligence.populatePage')}
        </Button>

        {/* Smart scan used to have a second trigger here, but this one only fired the scan —
            no SMART_SCAN_RESULT listener, no modal — so the results went nowhere. The live
            one lives in Tools › Extract, which owns the result modal. */}
      </div>

      {references.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/70 px-1">
            {t('plugin.brand.intelligence.visualReferences')}
          </h4>
          <div className="grid grid-cols-2 gap-2">
            {references.map((ref: any, idx: number) => (
              <div
                key={idx}
                className="border border-border/50 rounded-lg overflow-hidden bg-background/40"
              >
                {ref.url && (
                  <img
                    src={ref.url}
                    alt={ref.label || t('plugin.brand.intelligence.referenceAlt')}
                    className="w-full h-16 object-cover opacity-60 hover:opacity-100 transition-opacity"
                  />
                )}
                <p className="text-[9px] p-2 text-muted-foreground font-mono">{ref.label}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
