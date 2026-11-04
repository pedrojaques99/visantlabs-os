/**
 * ShaderControls — Reusable shader parameter UI
 *
 * Renders shader type selector + parameter controls driven by shaderParams.ts definitions.
 * Import into any app's control panel.
 */

import React from 'react';
import { cn } from '@/lib/utils';
import { NodeSlider } from '@/components/ui/NodeSlider';
import { Switch } from '@/components/ui/switch';
import { MicroTitle } from '@/components/ui/MicroTitle';
import {
  ToolPanelDisclosure,
  ToolPanelRow,
  InlineColorPicker,
} from '@/components/shared/ToolPanel';
import { PanelSectionTabs, type PanelTab } from '@/components/shared/PanelSectionTabs';
import { Zap, Square, SlidersHorizontal } from '@/lib/ui/icons';
import { useDebouncedSlider } from '@/hooks/useDebouncedSlider';
import {
  SHADER_DEFINITIONS,
  SHADER_DEFINITIONS_MAP,
  type ShaderParamSlider,
  type ShaderParamSelect,
  type ShaderParamColor,
  type ShaderParam,
} from '@/utils/shaders/shaderParams';
import type { ShaderType } from '@/utils/shaders/shaderRegistry';
import { parseHex } from '@/utils/colorUtils';
import { useTranslation } from '@/hooks/useTranslation';

/** Shader names and params live in shaderParams.ts as English labels; translate them by label. */
const useShaderLabel = () => {
  const { tOr } = useTranslation();
  return (label: string) => tOr(`imagelab.shader.labels.${label}`, label);
};

interface ShaderControlsProps {
  enabled: boolean;
  shaderType: ShaderType;
  values: Record<string, any>;
  onEnabledChange: (v: boolean) => void;
  onTypeChange: (t: ShaderType) => void;
  onValueChange: (key: string, value: any) => void;
  className?: string;
  hideToggle?: boolean;
  /**
   * Render the shader panel as a Blender/Photoshop-style sectioned panel (icon
   * rail: Shader / Style / Parameters) instead of the stacked-disclosure blob.
   * ImageLab opts in; the 3D-Studio effects tab keeps the default layout.
   */
  sectioned?: boolean;
}

export const ShaderControls: React.FC<ShaderControlsProps> = React.memo(
  ({
    enabled,
    shaderType,
    values,
    onEnabledChange,
    onTypeChange,
    onValueChange,
    className,
    hideToggle,
    sectioned,
  }) => {
    const { t } = useTranslation();
    const shaderLabel = useShaderLabel();
    const def = SHADER_DEFINITIONS_MAP[shaderType];

    const typeSelector = (
      <div className="grid grid-cols-2 gap-1.5">
        {SHADER_DEFINITIONS.map((d) => (
          <button
            key={d.id}
            onClick={() => onTypeChange(d.id)}
            className={cn(
              'px-2.5 py-2 rounded text-2xs transition-colors text-left',
              shaderType === d.id
                ? 'bg-accent text-foreground'
                : 'bg-muted text-muted-foreground hover:bg-accent'
            )}
          >
            {shaderLabel(d.label)}
          </button>
        ))}
      </div>
    );

    const variantSelector = def?.variants ? (
      <div className="grid grid-cols-3 gap-1.5">
        {def.variants.options.map((o) => (
          <button
            key={o.value}
            onClick={() => onValueChange(def.variants!.key, o.value)}
            className={cn(
              'px-2 py-1.5 rounded text-2xs transition-colors text-center',
              (values[def.variants!.key] ?? def.variants!.defaultValue) === o.value
                ? 'bg-accent text-foreground'
                : 'bg-muted text-muted-foreground hover:bg-accent'
            )}
          >
            {shaderLabel(o.label)}
          </button>
        ))}
      </div>
    ) : null;

    const parameters = (
      <div className="space-y-3">
        {def?.params.map((p) => (
          <ParamControl
            key={p.key}
            param={p}
            value={values[p.key]}
            onChange={(v) => onValueChange(p.key, v)}
          />
        ))}
      </div>
    );

    const toggleRow = !hideToggle && (
      <div
        className={cn(
          'flex items-center justify-between',
          sectioned && 'px-4 py-2.5 border-b border-border'
        )}
      >
        <MicroTitle>{t('canvas.shaderEffect')}</MicroTitle>
        <Switch checked={enabled} onCheckedChange={onEnabledChange} />
      </div>
    );

    // ── Sectioned layout (ImageLab): icon-rail tabs, matching the other tools ──
    if (sectioned) {
      const tabs: PanelTab[] = [
        {
          id: 'shader',
          label: t('imagelab.shader.title'),
          icon: <Zap size={16} />,
          content: typeSelector,
        },
        ...(variantSelector
          ? [
              {
                id: 'variant',
                label: shaderLabel(def!.variants!.label),
                icon: <Square size={16} />,
                content: variantSelector,
              },
            ]
          : []),
        {
          id: 'params',
          label: t('toolEditor.parameters'),
          icon: <SlidersHorizontal size={16} />,
          content: parameters,
        },
      ];
      return (
        <div className={cn('flex-1 flex flex-col min-h-0', className)}>
          {toggleRow}
          {enabled ? (
            <PanelSectionTabs tabs={tabs} />
          ) : (
            <div className="p-4 text-2xs text-muted-foreground">
              {t('imagelab.shader.enableHint')}
            </div>
          )}
        </div>
      );
    }

    // ── Default layout (3D Studio, canvas): stacked disclosures ──
    return (
      <div className={cn('space-y-4', className)}>
        {toggleRow}
        {!enabled ? null : (
          <>
            {typeSelector}
            {variantSelector && (
              <ToolPanelDisclosure
                label={shaderLabel(def!.variants!.label).toUpperCase()}
                defaultOpen
              >
                {variantSelector}
              </ToolPanelDisclosure>
            )}
            <ToolPanelDisclosure label={t('toolEditor.parameters')} defaultOpen>
              {parameters}
            </ToolPanelDisclosure>
          </>
        )}
      </div>
    );
  }
);

ShaderControls.displayName = 'ShaderControls';

// --- Individual param renderers ---

const ParamControl: React.FC<{
  param: ShaderParam;
  value: any;
  onChange: (v: any) => void;
}> = React.memo(({ param, value, onChange }) => {
  switch (param.kind) {
    case 'slider':
      return <SliderParam param={param} value={value} onChange={onChange} />;
    case 'select':
      return <SelectParam param={param} value={value} onChange={onChange} />;
    case 'toggle':
      return <ToggleParam param={param} value={value} onChange={onChange} />;
    case 'color':
      return <ColorParam param={param} value={value} onChange={onChange} />;
  }
});

ParamControl.displayName = 'ParamControl';

const SliderParam: React.FC<{
  param: ShaderParamSlider;
  value: any;
  onChange: (v: number) => void;
}> = React.memo(({ param, value, onChange }) => {
  const shaderLabel = useShaderLabel();
  const [local, setLocal] = useDebouncedSlider(value ?? param.defaultValue, onChange);
  return (
    <NodeSlider
      label={shaderLabel(param.label)}
      value={local}
      min={param.min}
      max={param.max}
      step={param.step}
      onChange={setLocal}
      formatValue={param.formatValue}
    />
  );
});

SliderParam.displayName = 'SliderParam';

const SelectParam: React.FC<{
  param: ShaderParamSelect;
  value: any;
  onChange: (v: number) => void;
}> = React.memo(({ param, value, onChange }) => {
  const shaderLabel = useShaderLabel();
  const current = value ?? param.defaultValue;
  return (
    <div>
      <span className="text-2xs text-muted-foreground block mb-1">{shaderLabel(param.label)}</span>
      <div className="grid grid-cols-2 gap-1">
        {param.options.map((o) => (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            className={cn(
              'px-2 py-1 rounded text-2xs transition-colors',
              current === o.value
                ? 'bg-accent text-foreground'
                : 'bg-muted text-muted-foreground hover:bg-accent'
            )}
          >
            {shaderLabel(o.label)}
          </button>
        ))}
      </div>
    </div>
  );
});

SelectParam.displayName = 'SelectParam';

const ToggleParam: React.FC<{
  param: ShaderParam;
  value: any;
  onChange: (v: number) => void;
}> = React.memo(({ param, value, onChange }) => {
  const shaderLabel = useShaderLabel();
  return (
    <div className="flex items-center justify-between">
      <span className="text-2xs text-muted-foreground">{shaderLabel(param.label)}</span>
      <Switch
        checked={(value ?? param.defaultValue) === 1}
        onCheckedChange={(v) => onChange(v ? 1 : 0)}
      />
    </div>
  );
});

ToggleParam.displayName = 'ToggleParam';

function glToHex(rgb: [number, number, number]): string {
  return (
    '#' +
    rgb
      .map((c) =>
        Math.round(c * 255)
          .toString(16)
          .padStart(2, '0')
      )
      .join('')
  );
}

function hexToGl(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return [r, g, b];
}

const ColorParam: React.FC<{
  param: ShaderParamColor;
  value: any;
  onChange: (v: [number, number, number]) => void;
}> = React.memo(({ param, value, onChange }) => {
  const shaderLabel = useShaderLabel();
  const rgb = (value ?? param.defaultValue) as [number, number, number];
  const label = shaderLabel(param.label);

  return (
    <ToolPanelRow label={label}>
      <InlineColorPicker
        value={glToHex(rgb)}
        onChange={(hex) => onChange(hexToGl(parseHex(hex) ?? hex))}
        label={label}
      />
    </ToolPanelRow>
  );
});

ColorParam.displayName = 'ColorParam';
