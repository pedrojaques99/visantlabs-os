import React from 'react';
import { usePluginStore } from '../../store';
import { useBrandIntelligence } from '../../hooks/useBrandIntelligence';
import { Button } from '@/components/ui/button';
import { Zap, ImageIcon } from 'lucide-react';

export function BrandIntelligenceSection() {
  const { brandGuideline } = usePluginStore();
  const { syncFromFigma } = useBrandIntelligence();

  if (!brandGuideline) {
    return (
      <div className="text-xs text-muted-foreground text-center py-4">
        Load a brand guideline first to access AI analysis.
      </div>
    );
  }

  const references = brandGuideline.media?.filter((m: any) => m.type === 'reference') || [];

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold flex items-center gap-2">
        <Zap size={14} />
        Brand Intelligence
      </h3>

      <Button
        onClick={() => syncFromFigma()}
        className="w-full bg-brand-cyan text-black hover:bg-brand-cyan/90 text-xs h-8"
      >
        <Zap size={12} className="mr-1" />
        Scan Selection for Brand Insights
      </Button>

      {references.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-mono uppercase text-muted-foreground">Visual References</h4>
          <div className="grid grid-cols-2 gap-2">
            {references.map((ref: any, idx: number) => (
              <div key={idx} className="border border-border rounded overflow-hidden">
                {ref.url && <img src={ref.url} alt={ref.label || 'Reference'} className="w-full h-16 object-cover" />}
                <p className="text-[10px] p-1 text-muted-foreground">{ref.label}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
