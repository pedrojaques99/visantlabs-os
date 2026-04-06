import React from 'react';
import { Eye, EyeOff, Type, Square, Download, ArrowLeft, Trash2 } from 'lucide-react';
import { useCreativeStore } from './store/creativeStore';
import { useBrandKit } from '@/contexts/BrandKitContext';
import { Button } from '@/components/ui/button';
import type { CreativeFormat, CreativeLayerData } from './store/creativeTypes';

const FORMATS: CreativeFormat[] = ['1:1', '9:16', '16:9', '4:5'];

interface Props {
  onExport: () => void;
}

export const CreativeEditorSidebar: React.FC<Props> = ({ onExport }) => {
  const {
    layers,
    selectedLayerId,
    format,
    setFormat,
    selectLayer,
    updateLayerMeta,
    removeLayer,
    addLayer,
    reset,
  } = useCreativeStore();
  const { colors, activeGuideline } = useBrandKit();

  const accentColor = colors[0]?.hex ?? '#00e5ff';
  const defaultFont =
    activeGuideline?.typography?.[0]?.family ?? 'Inter, sans-serif';

  const handleAddText = () => {
    const newLayer: CreativeLayerData = {
      type: 'text',
      content: 'Novo texto',
      role: 'body',
      position: { x: 0.1, y: 0.1 },
      size: { w: 0.4, h: 0.08 },
      align: 'left',
      fontSize: 48,
      fontFamily: defaultFont,
      color: '#ffffff',
      bold: false,
    };
    addLayer(newLayer);
  };

  const handleAddShape = () => {
    const newLayer: CreativeLayerData = {
      type: 'shape',
      shape: 'rect',
      color: accentColor,
      position: { x: 0.1, y: 0.5 },
      size: { w: 0.15, h: 0.15 },
    };
    addLayer(newLayer);
  };

  return (
    <aside className="w-[360px] h-full bg-neutral-950 border-r border-white/5 flex flex-col p-5 gap-5 overflow-y-auto">
      <button
        onClick={reset}
        className="flex items-center gap-2 text-[11px] font-mono text-neutral-500 hover:text-white transition-colors"
      >
        <ArrowLeft size={12} /> Novo criativo
      </button>

      {/* Add layers */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-mono uppercase tracking-wider text-neutral-500">
          Adicionar
        </label>
        <div className="grid grid-cols-2 gap-1.5">
          <button
            onClick={handleAddText}
            className="px-2 py-2.5 rounded text-[11px] font-mono border bg-neutral-900/60 border-white/10 text-neutral-400 hover:text-white hover:border-brand-cyan/30 transition-all flex items-center justify-center gap-1.5"
          >
            <Type size={12} /> Texto
          </button>
          <button
            onClick={handleAddShape}
            className="px-2 py-2.5 rounded text-[11px] font-mono border bg-neutral-900/60 border-white/10 text-neutral-400 hover:text-white hover:border-brand-cyan/30 transition-all flex items-center justify-center gap-1.5"
          >
            <Square size={12} /> Shape
          </button>
        </div>
      </div>

      {/* Layers list */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-mono uppercase tracking-wider text-neutral-500">
          Layers ({layers.length})
        </label>
        <div className="flex flex-col gap-1">
          {[...layers].reverse().map((layer) => {
            const label =
              layer.data.type === 'text'
                ? layer.data.content.replace(/<\/?accent>/g, '').slice(0, 20) || 'Texto'
                : layer.data.type === 'logo'
                ? 'Logo'
                : 'Shape';
            const isSelected = layer.id === selectedLayerId;
            return (
              <div
                key={layer.id}
                onClick={() => selectLayer(layer.id)}
                className={`flex items-center gap-2 px-2 py-1.5 rounded text-[11px] font-mono cursor-pointer transition-colors ${
                  isSelected
                    ? 'bg-brand-cyan/10 text-brand-cyan'
                    : 'text-neutral-400 hover:bg-white/5'
                }`}
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    updateLayerMeta(layer.id, { visible: !layer.visible });
                  }}
                  className="text-neutral-600 hover:text-white"
                >
                  {layer.visible ? <Eye size={12} /> : <EyeOff size={12} />}
                </button>
                <span className="flex-1 truncate">{label}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeLayer(layer.id);
                  }}
                  className="text-neutral-700 hover:text-red-400"
                >
                  <Trash2 size={11} />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Format switcher */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-mono uppercase tracking-wider text-neutral-500">
          Formato
        </label>
        <div className="grid grid-cols-4 gap-1.5">
          {FORMATS.map((f) => (
            <button
              key={f}
              onClick={() => setFormat(f)}
              className={`px-2 py-2 rounded text-[11px] font-mono border transition-all ${
                format === f
                  ? 'bg-brand-cyan/10 border-brand-cyan/50 text-brand-cyan'
                  : 'bg-neutral-900/60 border-white/10 text-neutral-500 hover:text-white'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Export */}
      <div className="mt-auto">
        <Button
          variant="brand"
          onClick={onExport}
          className="w-full py-3 font-mono text-sm font-bold flex items-center justify-center gap-2"
        >
          <Download size={14} /> Baixar PNG
        </Button>
      </div>
    </aside>
  );
};
