import React from 'react';
import { ZoomIn, ZoomOut, Maximize2, Grid3x3, Keyboard } from 'lucide-react';
import { useCreativeStore } from './store/creativeStore';

interface Props {
  scale: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  onCheatsheet: () => void;
}

const Btn: React.FC<{ title: string; onClick: () => void; active?: boolean; children: React.ReactNode }> = ({
  title, onClick, active, children,
}) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    className={`w-7 h-7 flex items-center justify-center rounded transition-colors ${
      active
        ? 'bg-brand-cyan/20 text-brand-cyan'
        : 'text-neutral-400 hover:bg-white/5 hover:text-white'
    }`}
  >
    {children}
  </button>
);

export const CameraControls: React.FC<Props> = ({
  scale, onZoomIn, onZoomOut, onZoomReset, onCheatsheet,
}) => {
  const gridEnabled = useCreativeStore((s) => s.gridEnabled);
  const setGridEnabled = useCreativeStore((s) => s.setGridEnabled);

  const pct = Math.round(scale * 100);

  return (
    <div className="absolute bottom-4 right-4 z-30 flex items-center gap-1 px-1.5 py-1 rounded-lg bg-neutral-950/90 backdrop-blur-xl border border-white/10 shadow-2xl">
      <Btn title="Zoom out (Cmd+−)" onClick={onZoomOut}>
        <ZoomOut size={13} />
      </Btn>
      <button
        type="button"
        onClick={onZoomReset}
        title="Reset 100% (Cmd+0)"
        className="min-w-[48px] px-2 py-1 text-[10px] font-mono text-neutral-300 hover:text-white rounded transition-colors hover:bg-white/5"
      >
        {pct}%
      </button>
      <Btn title="Zoom in (Cmd++)" onClick={onZoomIn}>
        <ZoomIn size={13} />
      </Btn>
      <div className="w-px h-4 bg-white/10 mx-1" />
      <Btn title="Snap to grid" onClick={() => setGridEnabled(!gridEnabled)} active={gridEnabled}>
        <Grid3x3 size={13} />
      </Btn>
      <Btn title="Reset view" onClick={onZoomReset}>
        <Maximize2 size={13} />
      </Btn>
      <Btn title="Atalhos (?)" onClick={onCheatsheet}>
        <Keyboard size={13} />
      </Btn>
    </div>
  );
};
