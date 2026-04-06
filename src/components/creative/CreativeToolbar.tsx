import React from 'react';
import { useCreativeStore } from './store/creativeStore';
import { useBrandKit } from '@/contexts/BrandKitContext';
import { AlignLeft, AlignCenter, AlignRight, Bold, Trash2 } from 'lucide-react';
import type { TextLayerData } from './store/creativeTypes';

export const CreativeToolbar: React.FC = () => {
  const { layers, selectedLayerId, updateLayer, removeLayer } = useCreativeStore();
  const { colors, activeGuideline } = useBrandKit();

  const selected = layers.find((l) => l.id === selectedLayerId);
  if (!selected || selected.data.type !== 'text') return null;

  const data = selected.data as TextLayerData;
  const fonts = (activeGuideline?.typography ?? []).map((t) => t.family).filter(Boolean);

  const update = (patch: Partial<TextLayerData>) => updateLayer(selected.id, patch);

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-neutral-900/95 border border-white/10 rounded-lg px-3 py-2 backdrop-blur-md shadow-2xl"
    >
      {/* Font family */}
      {fonts.length > 0 && (
        <select
          value={data.fontFamily}
          onChange={(e) => update({ fontFamily: e.target.value })}
          className="bg-neutral-800 text-white text-xs font-mono px-2 py-1 rounded border border-white/10"
        >
          {fonts.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
      )}

      {/* Font size */}
      <input
        type="number"
        value={Math.round(data.fontSize)}
        onChange={(e) => update({ fontSize: Number(e.target.value) })}
        min={8}
        max={400}
        className="w-16 bg-neutral-800 text-white text-xs font-mono px-2 py-1 rounded border border-white/10"
      />

      {/* Bold */}
      <button
        onClick={() => update({ bold: !data.bold })}
        className={`p-1.5 rounded ${data.bold ? 'bg-brand-cyan/20 text-brand-cyan' : 'text-neutral-400 hover:text-white'}`}
      >
        <Bold size={14} />
      </button>

      {/* Align */}
      <div className="flex items-center gap-0.5 border-l border-white/10 pl-2">
        {(['left', 'center', 'right'] as const).map((a) => {
          const Icon = a === 'left' ? AlignLeft : a === 'center' ? AlignCenter : AlignRight;
          return (
            <button
              key={a}
              onClick={() => update({ align: a })}
              className={`p-1.5 rounded ${data.align === a ? 'bg-brand-cyan/20 text-brand-cyan' : 'text-neutral-400 hover:text-white'}`}
            >
              <Icon size={14} />
            </button>
          );
        })}
      </div>

      {/* Brand color swatches */}
      {colors.length > 0 && (
        <div className="flex items-center gap-1 border-l border-white/10 pl-2">
          {colors.slice(0, 6).map((c) => (
            <button
              key={c.hex}
              onClick={() => update({ color: c.hex })}
              title={c.name || c.hex}
              className="w-5 h-5 rounded-full border border-white/20 hover:scale-110 transition-transform"
              style={{ backgroundColor: c.hex }}
            />
          ))}
          <input
            type="color"
            value={data.color}
            onChange={(e) => update({ color: e.target.value })}
            className="w-5 h-5 rounded cursor-pointer bg-transparent border border-white/20"
          />
        </div>
      )}

      {/* Delete */}
      <button
        onClick={() => removeLayer(selected.id)}
        className="p-1.5 rounded text-neutral-400 hover:text-red-400 border-l border-white/10 ml-1 pl-2"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
};
