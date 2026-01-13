import React from 'react';
import { ZoomIn, ZoomOut } from 'lucide-react';

interface ZoomControlsProps {
  viewportScale: number;
  minZoom: number;
  maxZoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomSliderChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const ZoomControls: React.FC<ZoomControlsProps> = ({
  viewportScale,
  minZoom,
  maxZoom,
  onZoomIn,
  onZoomOut,
  onZoomSliderChange,
}) => {
  return (
    <div className="fixed bottom-4 right-4 md:right-6 z-30">
      <div className="bg-black/20 backdrop-blur-sm border border-zinc-800/30 rounded-md px-3 py-2 flex items-center gap-3 opacity-60 hover:opacity-80 transition-opacity">
        <button
          onClick={onZoomOut}
          className="p-1 text-zinc-500 hover:text-brand-cyan transition-colors"
          title="Zoom Out"
        >
          <ZoomOut size={16} />
        </button>
        <input
          type="range"
          min={minZoom}
          max={maxZoom}
          step={0.01}
          value={viewportScale}
          onChange={onZoomSliderChange}
          className="w-20 accent-[brand-cyan]/50"
          title={`Zoom: ${Math.round(viewportScale * 100)}%`}
        />
        <button
          onClick={onZoomIn}
          className="p-1 text-zinc-500 hover:text-brand-cyan transition-colors"
          title="Zoom In"
        >
          <ZoomIn size={16} />
        </button>
        <span className="text-xs text-zinc-500 font-mono min-w-[3rem] text-right">
          {Math.round(viewportScale * 100)}%
        </span>
      </div>
    </div>
  );
};

