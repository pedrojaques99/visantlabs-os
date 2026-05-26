/**
 * ShaderControls — Reusable shader parameter UI
 *
 * Renders shader type selector + parameter controls driven by shaderParams.ts definitions.
 * Import into any app's control panel.
 */

import React, { useCallback } from 'react';
import { cn } from '@/lib/utils';
import { NodeSlider } from '@/components/ui/NodeSlider';
import { Switch } from '@/components/ui/switch';
import { MicroTitle } from '@/components/ui/MicroTitle';
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

interface ShaderControlsProps {
  enabled: boolean;
  shaderType: ShaderType;
  values: Record<string, any>;
  onEnabledChange: (v: boolean) => void;
  onTypeChange: (t: ShaderType) => void;
  onValueChange: (key: string, value: any) => void;
  className?: string;
}

export const ShaderControls: React.FC<ShaderControlsProps> = React.memo(({
  enabled,
  shaderType,
  values,
  onEnabledChange,
  onTypeChange,
  onValueChange,
  className,
}) => {
  const def = SHADER_DEFINITIONS_MAP[shaderType];

  return (
    <div className={cn('space-y-4', className)}>
      {/* Enable toggle */}
      <div className="flex items-center justify-between">
        <MicroTitle>SHADER EFFECT</MicroTitle>
        <Switch checked={enabled} onCheckedChange={onEnabledChange} />
      </div>

      {!enabled ? null : (
        <>
          {/* Shader type selector */}
          <div className="grid grid-cols-2 gap-1.5">
            {SHADER_DEFINITIONS.map((d) => (
              <button
                key={d.id}
                onClick={() => onTypeChange(d.id)}
                className={cn(
                  'px-2.5 py-2 rounded text-[10px] uppercase tracking-wider transition-colors text-left',
                  shaderType === d.id
                    ? 'bg-white/10 text-white'
                    : 'bg-white/5 text-neutral-400 hover:bg-white/10'
                )}
              >
                {d.label}
              </button>
            ))}
          </div>

          {/* Variant selector (e.g. halftone style) */}
          {def?.variants && (
            <div>
              <MicroTitle>{def.variants.label.toUpperCase()}</MicroTitle>
              <div className="grid grid-cols-3 gap-1.5 mt-2">
                {def.variants.options.map((o) => (
                  <button
                    key={o.value}
                    onClick={() => onValueChange(def.variants!.key, o.value)}
                    className={cn(
                      'px-2 py-1.5 rounded text-[10px] uppercase tracking-wider transition-colors text-center',
                      (values[def.variants!.key] ?? def.variants!.defaultValue) === o.value
                        ? 'bg-white/10 text-white'
                        : 'bg-white/5 text-neutral-400 hover:bg-white/10'
                    )}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Parameters */}
          <div className="space-y-3">
            <MicroTitle>PARAMETERS</MicroTitle>
            {def?.params.map((p) => (
              <ParamControl
                key={p.key}
                param={p}
                value={values[p.key]}
                onChange={(v) => onValueChange(p.key, v)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
});

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
  const [local, setLocal] = useDebouncedSlider(value ?? param.defaultValue, onChange);
  return (
    <NodeSlider
      label={param.label}
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
  const current = value ?? param.defaultValue;
  return (
    <div>
      <span className="text-[10px] text-neutral-500 uppercase tracking-wider block mb-1">{param.label}</span>
      <div className="grid grid-cols-2 gap-1">
        {param.options.map((o) => (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            className={cn(
              'px-2 py-1 rounded text-[10px] uppercase tracking-wider transition-colors',
              current === o.value
                ? 'bg-white/10 text-white'
                : 'bg-white/5 text-neutral-500 hover:bg-white/10'
            )}
          >
            {o.label}
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
}> = React.memo(({ param, value, onChange }) => (
  <div className="flex items-center justify-between">
    <span className="text-[10px] text-neutral-500 uppercase tracking-wider">{param.label}</span>
    <Switch
      checked={(value ?? param.defaultValue) === 1}
      onCheckedChange={(v) => onChange(v ? 1 : 0)}
    />
  </div>
));

ToggleParam.displayName = 'ToggleParam';

function glToHex(rgb: [number, number, number]): string {
  return '#' + rgb.map((c) => Math.round(c * 255).toString(16).padStart(2, '0')).join('');
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
  const rgb = (value ?? param.defaultValue) as [number, number, number];
  const hex = glToHex(rgb);
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(hexToGl(e.target.value));
  }, [onChange]);

  return (
    <div className="flex items-center justify-between">
      <span className="text-[10px] text-neutral-500 uppercase tracking-wider">{param.label}</span>
      <input
        type="color"
        value={hex}
        onChange={handleChange}
        className="w-8 h-5 rounded cursor-pointer bg-transparent border-0"
      />
    </div>
  );
});

ColorParam.displayName = 'ColorParam';
