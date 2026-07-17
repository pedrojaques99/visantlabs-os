/**
 * Creative Controls Catalog — vitrine viva dos controles "pro" do DS
 * (curves, channel mixer, gradient, XY pad, anchor grid, dual-range) + o color
 * picker turbinado. Espelha o padrão da página /design-system/icons.
 *
 * Vários controles têm geometria/interação adaptada do Toolcraft (MIT) —
 * ver src/components/controls/index.ts. Nenhum runtime dos caras foi baixado.
 */
import { useState } from 'react';
import { PageShell } from '@/components/ui/PageShell';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { SegmentedControl, ExpandableColorPicker } from '@/components/shared/ToolPanel';
import {
  CurvesEditor,
  ChannelMixer,
  RangeSlider,
  VectorPad,
  AnchorGrid,
  GradientEditor,
  IDENTITY_CHANNELS,
  DEFAULT_GRADIENT,
  buildLut,
  type CurvePoint,
  type CurveInterpolation,
  type Anchor,
  type Vector2,
  type ChannelCurves,
  type GradientValue,
} from '@/components/controls';

const Demo: React.FC<{
  title: string;
  code: string;
  children: React.ReactNode;
  note?: string;
}> = ({ title, code, children, note }) => (
  <GlassPanel className="p-5 space-y-4">
    <div className="flex items-baseline justify-between gap-3">
      <h3 className="text-sm font-medium text-neutral-100">{title}</h3>
      <code className="text-[10px] font-mono text-neutral-500">{code}</code>
    </div>
    <div className="flex flex-wrap items-start gap-6">{children}</div>
    {note && <p className="text-[11px] text-neutral-500 leading-relaxed">{note}</p>}
  </GlassPanel>
);

export function ControlsCatalogPage() {
  const [curve, setCurve] = useState<CurvePoint[]>([
    { x: 0, y: 0 },
    { x: 0.35, y: 0.28 },
    { x: 1, y: 1 },
  ]);
  const [interp, setInterp] = useState<CurveInterpolation>('smooth');
  const [channels, setChannels] = useState<ChannelCurves>(IDENTITY_CHANNELS);
  const [range, setRange] = useState<[number, number]>([20, 80]);
  const [vec, setVec] = useState<Vector2>({ x: 0.3, y: 0.5 });
  const [anchor, setAnchor] = useState<Anchor>('center');
  const [gradient, setGradient] = useState<GradientValue>(DEFAULT_GRADIENT);
  const [color, setColor] = useState('#22D3EE');
  const [recent] = useState(['#22D3EE', '#8B5CF6', '#F43F5E', '#FACC15', '#10B981']);

  const lut = buildLut(curve, interp);

  return (
    <PageShell
      pageId="controls-catalog"
      microTitle="Design System // Controls"
      title="Creative Controls"
      description="Pro tool controls built on the design system — adapted from Toolcraft (MIT), no runtime vendored."
      breadcrumb={[
        { label: 'Design System', to: '/design-system' },
        { label: 'Controls' },
      ]}
      width="7xl"
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Demo
          title="Curves Editor"
          code="<CurvesEditor />"
          note={`Tone curve with monotone/smooth cubic interpolation. LUT[64] sample: ${lut[64]} · LUT[192]: ${lut[192]}. buildLut() feeds image pipelines.`}
        >
          <CurvesEditor points={curve} onChange={setCurve} interpolation={interp} size={200} />
          <div className="space-y-3 min-w-[140px]">
            <SegmentedControl
              options={[
                { value: 'smooth', label: 'Smooth' },
                { value: 'monotone', label: 'Monotone' },
              ]}
              value={interp}
              onChange={(v) => setInterp(v as CurveInterpolation)}
              size="sm"
            />
            <p className="text-[11px] text-neutral-500">{curve.length} points</p>
          </div>
        </Demo>

        <Demo
          title="Channel Mixer"
          code="<ChannelMixer />"
          note="RGB + per-channel curves on one surface. Reuses CurvesEditor under a channel selector."
        >
          <ChannelMixer value={channels} onChange={setChannels} size={200} />
        </Demo>

        <Demo
          title="Gradient Editor"
          code="<GradientEditor />"
          note="Linear / radial / angular / diamond. Draggable stops, per-stop opacity, reverse. getGradientCss() gives you the CSS string."
        >
          <div className="w-full max-w-sm">
            <GradientEditor value={gradient} onChange={setGradient} />
          </div>
        </Demo>

        <Demo
          title="Improved Color Picker"
          code="<ExpandableColorPicker eyedropper showRgb recentColors />"
          note="The existing SSoT picker, now with native eyedropper (Chromium), R/G/B fields and a recent row — all opt-in, hex contract unchanged."
        >
          <div className="w-full max-w-xs">
            <ExpandableColorPicker
              color={color}
              onChange={setColor}
              label="Brand"
              defaultExpanded
              showRgb
              recentColors={recent}
              presets={['#22D3EE', '#8B5CF6', '#F43F5E', '#FACC15']}
            />
          </div>
        </Demo>

        <Demo
          title="Range Slider"
          code="<RangeSlider />"
          note="Dual-handle min/max. Pure pointer events, keyboard-focusable handles."
        >
          <div className="w-full max-w-sm">
            <RangeSlider value={range} onChange={setRange} label="Threshold" min={0} max={100} />
          </div>
        </Demo>

        <Demo
          title="Vector Pad + Anchor Grid"
          code="<VectorPad /> · <AnchorGrid />"
          note="XY pad for light direction / offsets, and a 9-point origin picker with ANCHOR_ORIGIN helpers."
        >
          <VectorPad value={vec} onChange={setVec} label="Light dir" />
          <AnchorGrid value={anchor} onChange={setAnchor} label="Origin" />
        </Demo>
      </div>
    </PageShell>
  );
}

export default ControlsCatalogPage;
