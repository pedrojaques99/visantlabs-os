import React from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { useOpRunner } from '../../hooks/useOpRunner';
import { usePluginStore } from '../../store';
import { useColorRename } from '../../hooks/useColorRename';
import { OpButton } from '../common/OpButton';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { GlitchLoader } from '@/components/ui/GlitchLoader';
import { Zap, LayoutGrid, Palette, Stamp, Paintbrush } from 'lucide-react';

/**
 * Not translated on purpose: the format string is written into the produced frame's name
 * (`Template - Story :: <variant>`, handlers/convertToPreset.ts), so translating it would
 * rename the artifact per locale and break preset scanning.
 */
const PRESET_FORMATS = ['Story', 'Feed'] as const;

export function AutomationSection() {
  const { t } = useTranslation();
  const store = usePluginStore();
  // Was hardcoded to 'Story' while the button said "convert to preset" — a label that
  // promised a choice the UI never offered.
  const [presetFormat, setPresetFormat] = React.useState<string>(PRESET_FORMATS[0]);
  const isGenerating = usePluginStore((s) => s.isGenerating);
  const runner = useOpRunner({ globalBusy: isGenerating });
  const colorRename = useColorRename();

  const brandColorHexes = store.selectedColors
    ? Array.from(store.selectedColors.values()).map((c) => c.hex)
    : undefined;

  const brandColorsArray = store.selectedColors
    ? Array.from(store.selectedColors.values()).map((c) => ({ hex: c.hex, name: c.role }))
    : [];

  const isRenaming =
    colorRename.status !== 'idle' &&
    colorRename.status !== 'done' &&
    colorRename.status !== 'error';
  const renameLabel =
    colorRename.status === 'scanning'
      ? t('plugin.tools.automation.scanningColors')
      : colorRename.status === 'naming'
        ? t('plugin.tools.automation.aiNaming')
        : colorRename.status === 'applying'
          ? t('plugin.tools.automation.applying')
          : t('plugin.tools.automation.smartColorRename');

  return (
    <div className="space-y-2">
      <Button
        variant="brand"
        size="sm"
        disabled={isRenaming || runner.anyBusy}
        onClick={() => colorRename.run({ createVariables: true, createStyles: true })}
        className="w-full h-8 text-[10px] font-bold uppercase tracking-wider"
        title={t('plugin.tools.automation.smartColorRenameTitle')}
      >
        {isRenaming ? (
          <GlitchLoader size={12} className="mr-2" />
        ) : (
          <Paintbrush size={12} className="mr-2" />
        )}
        {renameLabel}
      </Button>

      <OpButton
        opId="varyColors"
        runner={runner}
        message={{ type: 'VARY_SELECTION_COLORS', brandColors: brandColorHexes }}
        responseTypes={['OPERATIONS_DONE']}
        busyLabel={t('plugin.tools.automation.varyingColors')}
        variant="brand"
        size="sm"
        title={t('plugin.tools.automation.smartColorVariationsTitle')}
        className="w-full h-8 text-[10px] font-bold uppercase tracking-wider"
      >
        <Zap size={12} className="mr-2" />
        {t('plugin.tools.automation.smartColorVariations')}
      </OpButton>

      <OpButton
        opId="generateVariants"
        runner={runner}
        message={{ type: 'GENERATE_VARIANTS' }}
        responseTypes={['OPERATIONS_DONE']}
        busyLabel={t('plugin.tools.automation.generatingVariants')}
        variant="outline"
        size="sm"
        title={t('plugin.tools.automation.generateVariantsTitle')}
        className="w-full h-8 text-[10px] font-bold uppercase tracking-wider"
      >
        <Palette size={12} className="mr-2" />
        {t('plugin.tools.automation.generateVariants')}
      </OpButton>

      <div className="flex gap-2">
        <div className="w-24 shrink-0">
          <Select
            value={presetFormat}
            onChange={setPresetFormat}
            options={PRESET_FORMATS.map((f) => ({ value: f, label: f }))}
          />
        </div>
        <OpButton
          opId="convertToPreset"
          runner={runner}
          message={{ type: 'CONVERT_TO_PRESET', format: presetFormat }}
          responseTypes={['PRESET_CREATED']}
          busyLabel={t('plugin.tools.automation.converting')}
          variant="outline"
          size="sm"
          title={t('plugin.tools.automation.convertToPresetTitle')}
          className="flex-1 h-8 text-[10px] font-bold uppercase tracking-wider"
        >
          <Stamp size={12} className="mr-2" />
          {t('plugin.tools.automation.convertToPreset')}
        </OpButton>
      </div>

      <OpButton
        opId="socialFrames"
        runner={runner}
        message={{ type: 'GENERATE_SOCIAL_FRAMES', brandColors: brandColorsArray }}
        responseTypes={['OPERATIONS_DONE']}
        busyLabel={t('plugin.tools.automation.creatingFrames')}
        variant="outline"
        size="sm"
        title={t('plugin.tools.automation.socialFramesTitle')}
        className="w-full h-8 text-[10px] font-bold uppercase tracking-wider"
      >
        <LayoutGrid size={12} className="mr-2" />
        {t('plugin.tools.automation.socialFrames')}
      </OpButton>
    </div>
  );
}
