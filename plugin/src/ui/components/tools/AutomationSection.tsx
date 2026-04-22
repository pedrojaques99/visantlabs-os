import React from 'react';
import { useOpRunner } from '../../hooks/useOpRunner';
import { usePluginStore } from '../../store';
import { OpButton } from '../common/OpButton';
import { Grid3X3, Zap } from 'lucide-react';

export function AutomationSection() {
  const store = usePluginStore();
  const isGenerating = usePluginStore((s) => s.isGenerating);
  const runner = useOpRunner({ globalBusy: isGenerating });

  const brandColorHexes = store.selectedColors
    ? Array.from(store.selectedColors.values()).map((c) => c.hex)
    : undefined;

  return (
    <div className="space-y-4">
      <OpButton
        opId="varyColors"
        runner={runner}
        message={{ type: 'VARY_SELECTION_COLORS', brandColors: brandColorHexes }}
        responseTypes={['OPERATIONS_DONE']}
        busyLabel="Variando cores…"
        variant="brand"
        size="sm"
        className="w-full h-8 text-[10px] font-bold uppercase tracking-wider"
      >
        <Zap size={12} className="mr-2" />
        Variar Cores Inteligente
      </OpButton>

      <OpButton
        opId="brandGrid"
        runner={runner}
        message={{ type: 'GENERATE_BRAND_GRID' }}
        responseTypes={['OPERATIONS_DONE']}
        busyLabel="Criando grid…"
        variant="outline"
        size="sm"
        className="w-full h-8 text-[10px]"
      >
        <Grid3X3 size={12} className="mr-2 text-neutral-500" />
        Brand Grid
      </OpButton>
    </div>
  );
}
