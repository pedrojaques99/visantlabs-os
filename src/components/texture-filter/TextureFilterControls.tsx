import React, { useCallback } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { NodeSlider } from '@/components/ui/NodeSlider';
import { Switch } from '@/components/ui/switch';
import { useDebouncedSlider } from '@/hooks/useDebouncedSlider';
import {
  useTextureFilterStore, BLEND_MODES, TEXTURE_PRESETS, FILTER_PRESETS,
  TEXTURE_FILTER_DEFAULTS, type TextureFilterSettings,
} from '@/stores/textureFilterStore';
import { Download, UploadIcon, X, ImageIcon, Grid3X3, Layers, Blend, Move, RotateCw, Grid, Palette, Sparkles } from 'lucide-react';
import { SectionNavSidebar, type SectionNavItem } from '@/components/shared/SectionNavSidebar';

const SECTION_NAV: SectionNavItem[] = [
  { id: 'sec-presets', icon: <Grid3X3 size={14} />, label: 'Presets' },
  { id: 'sec-texture', icon: <Layers size={14} />, label: 'Texture' },
  { id: 'sec-mode', icon: <Blend size={14} />, label: 'Mode' },
  { id: 'sec-appearance', icon: <RotateCw size={14} />, label: 'Appearance' },
  { id: 'sec-position', icon: <Move size={14} />, label: 'Position' },
  { id: 'sec-tile', icon: <Grid size={14} />, label: 'Tile' },
  { id: 'sec-color', icon: <Palette size={14} />, label: 'Color' },
  { id: 'sec-post', icon: <Sparkles size={14} />, label: 'Post-Processing' },
];
import { ShaderControls } from '@/components/shared/ShaderControls';
import { SendToButton } from '@/components/shared/SendToButton';
import {
  ToolPanel, ToolPanelHeader, ToolPanelContent,
  ToolPanelDivider, ToolPanelDisclosure, ToolPanelActions, ToolPanelGrid,
  ToolPanelChip, ToolPanelRow,
} from '@/components/shared/ToolPanel';

const SectionLabel: React.FC<{ children: React.ReactNode; onReset?: () => void }> = ({ children, onReset }) => (
  <div className="group flex items-center justify-between">
    <span className="text-[10px] font-mono uppercase tracking-widest text-neutral-500">{children}</span>
    {onReset && (
      <button
        onClick={onReset}
        className="text-[9px] font-mono text-neutral-700 hover:text-neutral-400 transition-colors uppercase tracking-wider opacity-0 group-hover:opacity-100"
      >
        Reset
      </button>
    )}
  </div>
);

const DebouncedSlider: React.FC<{
  label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void; formatValue?: (v: number) => string;
}> = ({ label, value, min, max, step, onChange, formatValue }) => {
  const [local, setLocal] = useDebouncedSlider(value, onChange);
  return <NodeSlider label={label} value={local} min={min} max={max} step={step} onChange={setLocal} formatValue={formatValue} />;
};

interface TextureFilterControlsProps {
  onExport: () => void;
}

export const TextureFilterControls: React.FC<TextureFilterControlsProps> = React.memo(({ onExport }) => {
  const store = useTextureFilterStore();

  const update = useCallback(<K extends string>(key: K, value: any) => {
    store.updateSetting(key as any, value);
  }, [store]);

  const [opacity, setOpacity] = useDebouncedSlider(store.opacity, (v) => update('opacity', v));
  const [scale, setScale] = useDebouncedSlider(store.scale, (v) => update('scale', v));
  const [rotation, setRotation] = useDebouncedSlider(store.rotation, (v) => update('rotation', v));
  const [offsetX, setOffsetX] = useDebouncedSlider(store.offsetX, (v) => update('offsetX', v));
  const [offsetY, setOffsetY] = useDebouncedSlider(store.offsetY, (v) => update('offsetY', v));

  return (
    <ToolPanel className="flex-row">
      <SectionNavSidebar items={SECTION_NAV} />
      <div className="flex-1 flex flex-col overflow-hidden">
      {/* Image header */}
      <ToolPanelHeader>
        {store.imageUrl ? (
          <div className="flex items-center gap-3">
            {store.mediaType === 'image' ? (
              <img src={store.imageUrl} alt={store.fileName} className="w-10 h-10 rounded-md object-cover bg-neutral-800 shrink-0" />
            ) : (
              <div className="w-10 h-10 rounded-md bg-neutral-800 shrink-0 flex items-center justify-center text-[10px] text-neutral-400 font-mono uppercase">VID</div>
            )}
            <span className="text-[11px] text-neutral-400 font-mono truncate flex-1">{store.fileName}</span>
            <button onClick={() => store.setImageUrl('', '')} className="text-neutral-600 hover:text-neutral-300 transition-colors shrink-0 p-1">
              <X size={14} />
            </button>
          </div>
        ) : (
          <label className="flex items-center gap-3 cursor-pointer text-neutral-500 hover:text-neutral-300 transition-colors">
            <ImageIcon size={16} />
            <span className="text-[11px] uppercase tracking-widest">Upload image or video</span>
            <input type="file" accept="image/*,video/*" className="hidden" aria-label="Upload image or video" onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                const isVideo = file.type.startsWith('video/');
                store.setImageUrl(URL.createObjectURL(file), file.name, isVideo ? 'video' : 'image');
                toast.success(`Loaded ${file.name}`);
              }
              if (e.target) e.target.value = '';
            }} />
          </label>
        )}
      </ToolPanelHeader>

      <ToolPanelContent>
        {/* Presets */}
        <div id="sec-presets" className="space-y-3 scroll-mt-2">
          <SectionLabel>Presets</SectionLabel>
          <ToolPanelGrid>
            {Object.entries(FILTER_PRESETS).map(([name]) => (
              <ToolPanelChip key={name} onClick={() => {
                const preset = FILTER_PRESETS[name];
                Object.entries(preset).forEach(([k, v]) => {
                  store.updateSetting(k as keyof TextureFilterSettings, v as any);
                });
                toast.success(`Applied "${name}"`);
              }}>
                {name}
              </ToolPanelChip>
            ))}
          </ToolPanelGrid>
        </div>

        <ToolPanelDivider />

        {/* Texture */}
        <div id="sec-texture" className="space-y-3 scroll-mt-2">
          <SectionLabel>Texture</SectionLabel>
          <ToolPanelGrid>
            {TEXTURE_PRESETS.map((p) => (
              <ToolPanelChip key={p.name} active={store.textureName === p.name} onClick={() => store.applyPreset(p)}>
                {p.name}
              </ToolPanelChip>
            ))}
          </ToolPanelGrid>
          <label className="flex items-center gap-2 cursor-pointer text-neutral-500 hover:text-neutral-300 transition-colors">
            <UploadIcon size={12} />
            <span className="text-[10px] uppercase tracking-widest">Custom texture</span>
            <input type="file" accept="image/*,.svg" className="hidden" aria-label="Upload custom texture" onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                store.setTexture(URL.createObjectURL(file), file.name);
                toast.success(`Texture: ${file.name}`);
              }
              if (e.target) e.target.value = '';
            }} />
          </label>
        </div>

        <ToolPanelDivider />

        {/* Mode: Blend or Mask — mutually exclusive */}
        <div id="sec-mode" className="space-y-3 scroll-mt-2">
          <SectionLabel onReset={() => {
            update('blendMode', TEXTURE_FILTER_DEFAULTS.blendMode);
            update('maskMode', false);
            update('maskInvert', false);
          }}>
            Mode
          </SectionLabel>
          <ToolPanelGrid>
            <ToolPanelChip active={!store.maskMode} onClick={() => update('maskMode', false)}>
              Blend
            </ToolPanelChip>
            <ToolPanelChip active={store.maskMode} onClick={() => update('maskMode', true)}>
              Mask
            </ToolPanelChip>
          </ToolPanelGrid>

          {!store.maskMode ? (
            <ToolPanelGrid>
              {BLEND_MODES.map((m) => (
                <ToolPanelChip key={m.id} active={store.blendMode === m.id} onClick={() => update('blendMode', m.id)}>
                  {m.label}
                </ToolPanelChip>
              ))}
            </ToolPanelGrid>
          ) : (
            <ToolPanelRow label="Invert">
              <Switch checked={store.maskInvert} onCheckedChange={(v) => update('maskInvert', v)} />
            </ToolPanelRow>
          )}
        </div>

        <ToolPanelDivider />

        {/* Appearance */}
        <div id="sec-appearance" className="space-y-3 scroll-mt-2">
          <SectionLabel onReset={() => {
            update('opacity', TEXTURE_FILTER_DEFAULTS.opacity);
            update('scale', TEXTURE_FILTER_DEFAULTS.scale);
          }}>
            Appearance
          </SectionLabel>
          <NodeSlider label="Opacity" value={opacity} onChange={setOpacity} min={0} max={1} step={0.01} />
          <NodeSlider label="Scale" value={scale} onChange={setScale} min={0.1} max={5} step={0.01} />
        </div>

        <ToolPanelDivider />

        {/* Position */}
        <div id="sec-position" className="space-y-3 scroll-mt-2">
          <SectionLabel onReset={() => {
            update('rotation', 0);
            update('offsetX', 0);
            update('offsetY', 0);
          }}>
            Position
          </SectionLabel>
          <NodeSlider label="Rotation" value={rotation} onChange={setRotation} min={0} max={360} step={1} formatValue={(v) => `${Math.round(v)}°`} />
          <ToolPanelGrid>
            <NodeSlider label="Offset X" value={offsetX} onChange={setOffsetX} min={-2000} max={2000} step={1} formatValue={(v) => `${Math.round(v)}`} />
            <NodeSlider label="Offset Y" value={offsetY} onChange={setOffsetY} min={-2000} max={2000} step={1} formatValue={(v) => `${Math.round(v)}`} />
          </ToolPanelGrid>
        </div>

        <ToolPanelDivider />

        {/* Tile */}
        <div id="sec-tile" className="space-y-3 scroll-mt-2">
          <SectionLabel onReset={() => {
            update('tileGapX', 0);
            update('tileGapY', 0);
          }}>
            Tile
          </SectionLabel>
          <ToolPanelRow label="Repeat">
            <Switch checked={store.tileMode} onCheckedChange={(v) => update('tileMode', v)} />
          </ToolPanelRow>
          {store.tileMode && (
            <ToolPanelGrid>
              <DebouncedSlider label="Gap X" value={store.tileGapX} onChange={(v) => update('tileGapX', v)} min={-100} max={200} step={1} formatValue={(v) => `${Math.round(v)}px`} />
              <DebouncedSlider label="Gap Y" value={store.tileGapY} onChange={(v) => update('tileGapY', v)} min={-100} max={200} step={1} formatValue={(v) => `${Math.round(v)}px`} />
            </ToolPanelGrid>
          )}
        </div>

        <ToolPanelDivider />

        {/* Color */}
        <ToolPanelDisclosure label="Color" id="sec-color">
          <ToolPanelRow label="Original color">
            <Switch checked={store.useOriginalColor} onCheckedChange={(v) => update('useOriginalColor', v)} />
          </ToolPanelRow>
          {!store.useOriginalColor && (
            <ToolPanelRow label="Color">
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={store.textureColor}
                  onChange={(e) => update('textureColor', e.target.value)}
                  className="w-6 h-6 rounded-md cursor-pointer bg-transparent border-0"
                  aria-label="Texture color"
                />
                <span className="text-[10px] text-neutral-500 font-mono uppercase">{store.textureColor}</span>
              </div>
            </ToolPanelRow>
          )}
        </ToolPanelDisclosure>

        {/* Post-Processing */}
        <ToolPanelDisclosure label="Post-Processing" id="sec-post">
          <ShaderControls
            enabled={store.shaderEnabled}
            shaderType={store.shaderType}
            values={store.shaderValues}
            onEnabledChange={store.setShaderEnabled}
            onTypeChange={store.setShaderType}
            onValueChange={store.setShaderValue}
          />
        </ToolPanelDisclosure>
      </ToolPanelContent>

      <ToolPanelActions>
        <div className="flex gap-2 w-full">
          <Button
            onClick={onExport}
            disabled={store.isExporting || !store.imageUrl}
            className="flex-1 bg-white hover:bg-neutral-200 text-black font-medium h-9 text-xs gap-2"
          >
            <Download size={14} />
            {store.isExporting ? 'Exporting...' : 'Export PNG'}
          </Button>
          {store.imageUrl && <SendToButton source="texture-filter" imageUrl={store.imageUrl} />}
        </div>
      </ToolPanelActions>
      </div>
    </ToolPanel>
  );
});
