import React from 'react';
import { useOpRunner } from '../../hooks/useOpRunner';
import { usePluginStore } from '../../store';
import { OpButton } from '../common/OpButton';
import { Zap, LayoutGrid, Palette, Stamp } from 'lucide-react';

export function AutomationSection() {
  const store = usePluginStore();
  const isGenerating = usePluginStore((s) => s.isGenerating);
  const runner = useOpRunner({ globalBusy: isGenerating });

  const brandColorHexes = store.selectedColors
    ? Array.from(store.selectedColors.values()).map((c) => c.hex)
    : undefined;

  const brandColorsArray = store.selectedColors
    ? Array.from(store.selectedColors.values()).map((c) => ({ hex: c.hex, name: c.role }))
    : [];

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
        opId="generateVariants"
        runner={runner}
        message={{ type: 'GENERATE_VARIANTS' }}
        responseTypes={['OPERATIONS_DONE']}
        busyLabel="Generating variants…"
        variant="outline"
        size="sm"
        title="Clone selection into Lava, Off-White and Terra color variants"
        className="w-full h-8 text-[10px] font-bold uppercase tracking-wider"
      >
        <Palette size={12} className="mr-2" />
        Generate Variants
      </OpButton>

      <OpButton
        opId="convertToPreset"
        runner={runner}
        message={{ type: 'CONVERT_TO_PRESET', format: 'Story' }}
        responseTypes={['PRESET_CREATED']}
        busyLabel="Converting…"
        variant="outline"
        size="sm"
        title="Convert selected frame into a template preset with auto-mapped text placeholders"
        className="w-full h-8 text-[10px] font-bold uppercase tracking-wider"
      >
        <Stamp size={12} className="mr-2" />
        Convert to Preset
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
