import React, { useEffect, useState } from 'react';
import type Konva from 'konva';
import { useCreativeStore } from './store/creativeStore';

interface Props {
  canvasWidth: number;
  canvasHeight: number;
  viewportScale: number;
  viewportX: number;
  viewportY: number;
  shapeRefs: React.MutableRefObject<Map<string, Konva.Node>>;
}

interface Bounds {
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
}

const Field: React.FC<{
  label: string;
  value: number;
  onCommit: (n: number) => void;
  step?: number;
  width?: number;
  suffix?: string;
}> = ({ label, value, onCommit, step = 1, width = 52, suffix }) => {
  const [draft, setDraft] = useState<string>(value.toFixed(0));
  useEffect(() => setDraft(value.toFixed(0)), [value]);
  const commit = () => {
    const n = Number(draft);
    if (Number.isFinite(n) && n !== value) onCommit(n);
    else setDraft(value.toFixed(0));
  };
  return (
    <label className="flex items-center gap-1 text-[10px] font-mono">
      <span className="text-neutral-500">{label}</span>
      <input
        type="number"
        step={step}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur();
          if (e.key === 'Escape') {
            setDraft(value.toFixed(0));
            (e.currentTarget as HTMLInputElement).blur();
          }
        }}
        style={{ width }}
        className="bg-neutral-800/60 border border-white/10 rounded px-1 py-0.5 text-white text-right focus:outline-none focus:border-brand-cyan/50"
      />
      {suffix && <span className="text-neutral-600">{suffix}</span>}
    </label>
  );
};

/**
 * Floating HUD that mirrors the current selection's X/Y/W/H/rotation.
 * Editable — typing commits to the store, which re-renders the layer.
 *
 * Single-selection only (matches Figma's Properties bar default).
 */
export const SelectionHud: React.FC<Props> = ({
  canvasWidth,
  canvasHeight,
  viewportScale,
  viewportX,
  viewportY,
  shapeRefs,
}) => {
  const selectedLayerIds = useCreativeStore((s) => s.selectedLayerIds);
  const layers = useCreativeStore((s) => s.layers);
  const updateLayer = useCreativeStore((s) => s.updateLayer);

  const [bounds, setBounds] = useState<Bounds | null>(null);
  const [screen, setScreen] = useState<{ left: number; top: number } | null>(null);

  // Recompute on selection or layer change. Polling at 60fps would be needed
  // to track live drag; instead the bar shows committed state and re-positions
  // on store updates, which is enough for fine-tuning.
  useEffect(() => {
    if (selectedLayerIds.length !== 1) {
      setBounds(null);
      setScreen(null);
      return;
    }
    const id = selectedLayerIds[0];
    const layer = layers.find((l) => l.id === id);
    if (!layer) return;
    const node = shapeRefs.current.get(id);
    if (!node) return;
    const r = node.getClientRect({ skipShadow: true, skipStroke: true });
    setBounds({
      x: layer.data.position.x * canvasWidth,
      y: layer.data.position.y * canvasHeight,
      w: (layer.data.size?.w ?? 0) * canvasWidth,
      h: (layer.data.size?.h ?? 0) * canvasHeight,
      rotation: (layer.data as { rotation?: number }).rotation ?? 0,
    });
    // Position above the bounding rect (in canvas-container coords)
    setScreen({ left: r.x, top: Math.max(0, r.y - 36) });
  }, [selectedLayerIds, layers, shapeRefs, canvasWidth, canvasHeight, viewportScale, viewportX, viewportY]);

  if (!bounds || !screen || selectedLayerIds.length !== 1) return null;
  const id = selectedLayerIds[0];

  const setX = (px: number) =>
    updateLayer(id, {
      position: { x: Math.max(0, Math.min(1, px / canvasWidth)), y: bounds.y / canvasHeight },
    } as never);
  const setY = (px: number) =>
    updateLayer(id, {
      position: { x: bounds.x / canvasWidth, y: Math.max(0, Math.min(1, px / canvasHeight)) },
    } as never);
  const setW = (px: number) =>
    updateLayer(id, {
      size: { w: Math.max(0.005, px / canvasWidth), h: bounds.h / canvasHeight },
    } as never);
  const setH = (px: number) =>
    updateLayer(id, {
      size: { w: bounds.w / canvasWidth, h: Math.max(0.005, px / canvasHeight) },
    } as never);
  const setRot = (deg: number) => updateLayer(id, { rotation: ((deg % 360) + 360) % 360 } as never);

  return (
    <div
      className="absolute z-20 flex items-center gap-2 px-2 py-1 rounded-md bg-neutral-950/95 backdrop-blur-xl border border-white/10 shadow-xl pointer-events-auto"
      style={{ left: screen.left, top: screen.top }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <Field label="X" value={bounds.x} onCommit={setX} />
      <Field label="Y" value={bounds.y} onCommit={setY} />
      <Field label="W" value={bounds.w} onCommit={setW} />
      <Field label="H" value={bounds.h} onCommit={setH} />
      <Field label="∠" value={bounds.rotation} onCommit={setRot} suffix="°" width={48} />
    </div>
  );
};
