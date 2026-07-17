import * as React from 'react';
import { cn } from '@/lib/utils';
import { SegmentedControl } from '@/components/shared/ToolPanel';
import { CurvesEditor } from './CurvesEditor';
import { type CurvePoint, type CurveInterpolation, IDENTITY_CURVE } from './curve-geometry';

export type MixerChannel = 'RGB' | 'R' | 'G' | 'B';

export type ChannelCurves = Record<MixerChannel, CurvePoint[]>;

export const IDENTITY_CHANNELS: ChannelCurves = {
  RGB: [...IDENTITY_CURVE],
  R: [...IDENTITY_CURVE],
  G: [...IDENTITY_CURVE],
  B: [...IDENTITY_CURVE],
};

const CHANNEL_OPTIONS: { value: MixerChannel; label: string }[] = [
  { value: 'RGB', label: 'RGB' },
  { value: 'R', label: 'R' },
  { value: 'G', label: 'G' },
  { value: 'B', label: 'B' },
];

const CHANNEL_TINT: Record<MixerChannel, string> = {
  RGB: 'var(--brand-cyan, #22d3ee)',
  R: '#f87171',
  G: '#4ade80',
  B: '#60a5fa',
};

export interface ChannelMixerProps {
  value?: ChannelCurves;
  onChange: (value: ChannelCurves) => void;
  interpolation?: CurveInterpolation;
  /** Optional per-channel histograms, keyed by channel. */
  histograms?: Partial<Record<MixerChannel, number[]>>;
  size?: number;
  className?: string;
}

/**
 * RGB channel mixer: a channel selector on top of a per-channel {@link CurvesEditor}.
 * Adapted from Pixel Point Toolcraft's channel-mixer (MIT).
 */
export const ChannelMixer = React.memo<ChannelMixerProps>(
  ({ value, onChange, interpolation, histograms, size = 232, className }) => {
    const channels = value ?? IDENTITY_CHANNELS;
    const [active, setActive] = React.useState<MixerChannel>('RGB');

    const handleCurve = React.useCallback(
      (points: CurvePoint[]) => onChange({ ...channels, [active]: points }),
      [channels, active, onChange]
    );

    return (
      <div className={cn('flex flex-col gap-2', className)}>
        <SegmentedControl
          options={CHANNEL_OPTIONS}
          value={active}
          onChange={(v) => setActive(v as MixerChannel)}
          size="sm"
        />
        <CurvesEditor
          points={channels[active] ?? [...IDENTITY_CURVE]}
          onChange={handleCurve}
          interpolation={interpolation}
          color={CHANNEL_TINT[active]}
          histogram={histograms?.[active]}
          size={size}
        />
      </div>
    );
  }
);

ChannelMixer.displayName = 'ChannelMixer';
