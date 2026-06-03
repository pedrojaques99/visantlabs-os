import React from 'react';
import { useOpRunner } from '../../hooks/useOpRunner';
import { usePluginStore } from '../../store';
import { OpButton } from '../common/OpButton';
import { Zap, LayoutGrid } from 'lucide-react';

export function AutomationSection() {
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
    <div className="space-y-2">
      <OpButton
        opId="varyColors"
        runner={runner}
        message={{ type: 'VARY_SELECTION_COLORS', brandColors: brandColorHexes }}
        responseTypes={['OPERATIONS_DONE']}
        busyLabel="Varying colors…"
        variant="brand"
        size="sm"
        title="Generate color variations of the selection using brand palette"
        className="w-full h-8 text-[10px] font-bold uppercase tracking-wider"
      >
        <Zap size={12} className="mr-2" />
        Smart Color Variations
      </OpButton>

      <OpButton
        opId="socialFrames"
        runner={runner}
        message={{ type: 'GENERATE_SOCIAL_FRAMES', brandColors: brandColorsArray }}
        responseTypes={['OPERATIONS_DONE']}
        busyLabel="Creating frames…"
        variant="outline"
        size="sm"
        title="Create pre-sized frames for Instagram, Stories, LinkedIn, etc."
        className="w-full h-8 text-[10px] font-bold uppercase tracking-wider"
      >
        <LayoutGrid size={12} className="mr-2" />
        Social Frames
      </OpButton>
    </div>
  );
}
