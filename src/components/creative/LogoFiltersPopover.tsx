import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Sliders, RotateCcw } from 'lucide-react';
import { useCreativeStore } from './store/creativeStore';
import type { LogoLayerData } from './store/creativeTypes';

const Slider: React.FC<{
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (n: number) => void;
  suffix?: string;
}> = ({ label, value, min, max, step = 1, onChange, suffix }) => (
  <div className="flex flex-col gap-1">
    <div className="flex items-center justify-between text-[10px] font-mono">
      <span className="text-neutral-400 uppercase tracking-wider">{label}</span>
      <span className="text-white tabular-nums">
        {value.toFixed(step < 1 ? 2 : 0)}
        {suffix}
      </span>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full accent-brand-cyan"
    />
  </div>
);

const NumPair: React.FC<{
  label: string;
  ax: number;
  ay: number;
  onA: (n: number) => void;
  onB: (n: number) => void;
  labelA: string;
  labelB: string;
}> = ({ label, ax, ay, onA, onB, labelA, labelB }) => (
  <div className="flex flex-col gap-1">
    <span className="text-[10px] font-mono text-neutral-400 uppercase tracking-wider">{label}</span>
    <div className="grid grid-cols-2 gap-1">
      <label className="flex items-center gap-1 text-[10px] font-mono">
        <span className="text-neutral-500 w-4">{labelA}</span>
        <input
          type="number"
          value={Math.round(ax * 100)}
          onChange={(e) => onA(Math.max(0, Math.min(100, Number(e.target.value))) / 100)}
          className="w-full bg-neutral-800/60 border border-white/10 rounded px-1 py-0.5 text-white text-right focus:outline-none focus:border-brand-cyan/50"
        />
      </label>
      <label className="flex items-center gap-1 text-[10px] font-mono">
        <span className="text-neutral-500 w-4">{labelB}</span>
        <input
          type="number"
          value={Math.round(ay * 100)}
          onChange={(e) => onB(Math.max(0, Math.min(100, Number(e.target.value))) / 100)}
          className="w-full bg-neutral-800/60 border border-white/10 rounded px-1 py-0.5 text-white text-right focus:outline-none focus:border-brand-cyan/50"
        />
      </label>
    </div>
  </div>
);

interface Props {
  layerId: string;
  data: LogoLayerData;
}

export const LogoFiltersPopover: React.FC<Props> = ({ layerId, data }) => {
  const updateLayer = useCreativeStore((s) => s.updateLayer);
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ left: number; top: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocDown = (e: MouseEvent) => {
      if (!popoverRef.current?.contains(e.target as Node) && !triggerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('mousedown', onDocDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onDocDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const toggle = () => {
    if (!open && triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect();
      setCoords({ left: r.left, top: r.bottom + 6 });
    }
    setOpen((v) => !v);
  };

  const filters = data.filters ?? {};
  const crop = data.crop ?? { x: 0, y: 0, w: 1, h: 1 };

  const setFilter = (patch: Partial<NonNullable<LogoLayerData['filters']>>) => {
    updateLayer(layerId, { filters: { ...filters, ...patch } } as Partial<LogoLayerData>);
  };
  const setCrop = (patch: Partial<NonNullable<LogoLayerData['crop']>>) => {
    updateLayer(layerId, { crop: { ...crop, ...patch } } as Partial<LogoLayerData>);
  };

  const reset = () => {
    updateLayer(layerId, { filters: undefined, crop: undefined } as Partial<LogoLayerData>);
  };

  const hasAny =
    !!(filters.brightness || filters.contrast || filters.blur || filters.grayscale ||
       (data.crop && (data.crop.x || data.crop.y || data.crop.w !== 1 || data.crop.h !== 1)));

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={toggle}
        title="Ajustes de imagem"
        className={`p-1.5 rounded transition-colors ${
          hasAny || open ? 'bg-brand-cyan/20 text-brand-cyan' : 'text-neutral-400 hover:text-white hover:bg-white/5'
        }`}
      >
        <Sliders size={14} />
      </button>

      {open && coords && createPortal(
        <div
          ref={popoverRef}
          onMouseDown={(e) => e.stopPropagation()}
          style={{ left: coords.left, top: coords.top, width: 240 }}
          className="fixed z-[10001] bg-neutral-950/95 backdrop-blur-xl border border-white/10 rounded-lg shadow-2xl p-3 flex flex-col gap-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-300">
              Ajustes
            </span>
            <button
              type="button"
              onClick={reset}
              title="Resetar ajustes"
              className="p-1 rounded text-neutral-500 hover:text-white hover:bg-white/5"
            >
              <RotateCcw size={11} />
            </button>
          </div>

          <Slider
            label="Brilho"
            value={filters.brightness ?? 0}
            min={-1}
            max={1}
            step={0.05}
            onChange={(n) => setFilter({ brightness: n === 0 ? undefined : n })}
          />
          <Slider
            label="Contraste"
            value={filters.contrast ?? 0}
            min={-100}
            max={100}
            step={1}
            onChange={(n) => setFilter({ contrast: n === 0 ? undefined : n })}
          />
          <Slider
            label="Desfoque"
            value={filters.blur ?? 0}
            min={0}
            max={40}
            step={1}
            onChange={(n) => setFilter({ blur: n === 0 ? undefined : n })}
            suffix="px"
          />

          <label className="flex items-center gap-2 text-[10px] font-mono text-neutral-300">
            <input
              type="checkbox"
              checked={!!filters.grayscale}
              onChange={(e) => setFilter({ grayscale: e.target.checked || undefined })}
              className="accent-brand-cyan"
            />
            <span className="uppercase tracking-wider">Preto e branco</span>
          </label>

          <div className="h-px bg-white/5" />

          <NumPair
            label="Crop pos %"
            ax={crop.x}
            ay={crop.y}
            labelA="X"
            labelB="Y"
            onA={(n) => setCrop({ x: n })}
            onB={(n) => setCrop({ y: n })}
          />
          <NumPair
            label="Crop tam %"
            ax={crop.w}
            ay={crop.h}
            labelA="W"
            labelB="H"
            onA={(n) => setCrop({ w: n })}
            onB={(n) => setCrop({ h: n })}
          />
        </div>,
        document.body
      )}
    </>
  );
};
