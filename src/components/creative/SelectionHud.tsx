import React, { useEffect, useState } from 'react';
import type Konva from 'konva';
import { useCreativeStore } from './store/creativeStore';
import { HUD_GAP_PX, MIN_LAYER_SIZE_NORMALIZED } from './lib/editorTokens';
import type { CreativeLayer } from './store/creativeTypes';

interface Props {
  canvasWidth: number;
  canvasHeight: number;
  viewportScale: number;
  viewportX: number;
  viewportY: number;
  /** Kept in the contract for future getClientRect-based features; unused for now. */
  shapeRefs: React.MutableRefObject<Map<string, Konva.Node>>;
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
 *
 * Position math comes purely from layer data + viewport state — no
 * `node.getClientRect()` reads, which avoids 1-frame staleness when zoom
 * effects haven't applied to the Konva stage yet (child effects run before
 * parent effects in React).
 *
 * Edits read live position/size from the store at commit time so successive
 * edits to different axes don't overwrite each other.
 */
export const SelectionHud: React.FC<Props> = ({
  canvasWidth,
  canvasHeight,
  viewportScale,
  viewportX,
  viewportY,
}) => {
  const selectedLayerIds = useCreativeStore((s) => s.selectedLayerIds);
  const layer = useCreativeStore((s) =>
    s.selectedLayerIds.length === 1
      ? s.layers.find((l) => l.id === s.selectedLayerIds[0]) ?? null
      : null
  );
  const updateLayer = useCreativeStore((s) => s.updateLayer);

  if (!layer || selectedLayerIds.length !== 1) return null;

  const data = layer.data;
  const sizeW = data.size?.w ?? 0;
  const sizeH = data.size?.h ?? 0;
  const rotation = (data as { rotation?: number }).rotation ?? 0;

  // Derive screen position from props directly: (logical * scale) + viewport offset.
  const screenLeft = data.position.x * canvasWidth * viewportScale + viewportX;
  const screenTop = data.position.y * canvasHeight * viewportScale + viewportY - HUD_GAP_PX;

  // Hide HUD when it would render off the top of the canvas — better than overlap.
  if (screenTop < 0) return null;

  // Display values in canvas pixels (logical) so users edit creative-space coords.
  const px = {
    x: data.position.x * canvasWidth,
    y: data.position.y * canvasHeight,
    w: sizeW * canvasWidth,
    h: sizeH * canvasHeight,
  };

  /** Always read live position/size from the store at commit so successive
   *  edits compose instead of overwriting each other from stale closure. */
  const live = (): CreativeLayer | undefined =>
    useCreativeStore.getState().layers.find((l) => l.id === layer.id);

  const setX = (pxX: number) => {
    const cur = live();
    if (!cur) return;
    updateLayer(layer.id, {
      position: {
        x: Math.max(0, Math.min(1, pxX / canvasWidth)),
        y: cur.data.position.y,
      },
    } as never);
  };
  const setY = (pxY: number) => {
    const cur = live();
    if (!cur) return;
    updateLayer(layer.id, {
      position: {
        x: cur.data.position.x,
        y: Math.max(0, Math.min(1, pxY / canvasHeight)),
      },
    } as never);
  };
  const setW = (pxW: number) => {
    const cur = live();
    if (!cur || !cur.data.size) return;
    updateLayer(layer.id, {
      size: {
        w: Math.max(MIN_LAYER_SIZE_NORMALIZED, pxW / canvasWidth),
        h: cur.data.size.h,
      },
    } as never);
  };
  const setH = (pxH: number) => {
    const cur = live();
    if (!cur || !cur.data.size) return;
    updateLayer(layer.id, {
      size: {
        w: cur.data.size.w,
        h: Math.max(MIN_LAYER_SIZE_NORMALIZED, pxH / canvasHeight),
      },
    } as never);
  };
  const setRot = (deg: number) => updateLayer(layer.id, { rotation: ((deg % 360) + 360) % 360 } as never);

  return (
    <div
      className="absolute z-20 flex items-center gap-2 px-2 py-1 rounded-md bg-neutral-950/95 backdrop-blur-xl border border-white/10 shadow-xl pointer-events-auto"
      style={{ left: screenLeft, top: screenTop }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <Field label="X" value={px.x} onCommit={setX} />
      <Field label="Y" value={px.y} onCommit={setY} />
      <Field label="W" value={px.w} onCommit={setW} />
      <Field label="H" value={px.h} onCommit={setH} />
      <Field label="∠" value={rotation} onCommit={setRot} suffix="°" width={48} />
    </div>
  );
};
