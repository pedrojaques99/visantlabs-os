import React, { useCallback } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ScrubInput } from '@/components/ui/ScrubInput';
import { Select } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  useTextureFilterStore, BLEND_MODES, TEXTURE_PRESETS, FILTER_PRESETS,
  TEXTURE_FILTER_DEFAULTS, type TextureFilterSettings,
} from '@/stores/textureFilterStore';
import { Download, UploadIcon, Layers, Blend, Move, RotateCw, Grid, Palette, SlidersHorizontal } from 'lucide-react';
import { SectionNavSidebar, type SectionNavItem } from '@/components/shared/SectionNavSidebar';

const SECTION_NAV: SectionNavItem[] = [
  { id: 'sec-texture', icon: <Layers size={14} />, label: 'Texture' },
  { id: 'sec-mode', icon: <Blend size={14} />, label: 'Mode' },
  { id: 'sec-appearance', icon: <RotateCw size={14} />, label: 'Appearance' },
  { id: 'sec-position', icon: <Move size={14} />, label: 'Position' },
  { id: 'sec-tile', icon: <Grid size={14} />, label: 'Tile' },
  { id: 'sec-color', icon: <Palette size={14} />, label: 'Color' },
  { id: 'sec-post', icon: <SlidersHorizontal size={14} />, label: 'Post-Processing' },
];
import { ShaderControls } from '@/components/shared/ShaderControls';
import { SendToButton } from '@/components/shared/SendToButton';
import { ImageLabHeader } from '@/components/shared/ImageLabHeader';
import { PresetThumbnailStrip } from '@/components/shared/PresetThumbnailStrip';
import {
  ToolPanel, ToolPanelContent,
  ToolPanelDivider, ToolPanelDisclosure, ToolPanelActions, ToolPanelGrid,
  ToolPanelRow,
} from '@/components/shared/ToolPanel';

const SectionLabel: React.FC<{ children: React.ReactNode; onReset?: () => void }> = ({ children, onReset }) => (
  <div className="group flex items-center justify-between">
    <span className="text-[10px] font-mono uppercase tracking-widest text-neutral-500">{children}</span>
    {onReset && (
      <button
        onClick={onReset}
        className="text-[10px] font-mono text-neutral-700 hover:text-neutral-400 transition-colors uppercase tracking-wider opacity-0 group-hover:opacity-100"
      >
        Reset
      </button>
    )}
  </div>
);


const FILTER_PRESET_ITEMS = Object.keys(FILTER_PRESETS).map((name) => ({ name }));

interface TextureFilterControlsProps {
  onExport: () => void;
  onClosePanel?: () => void;
}

export const TextureFilterControls: React.FC<TextureFilterControlsProps> = React.memo(({ onExport, onClosePanel }) => {
  const store = useTextureFilterStore();

  const update = useCallback(<K extends string>(key: K, value: any) => {
    store.updateSetting(key as any, value);
  }, [store]);


  return (
    <ToolPanel className="flex-row">
      <SectionNavSidebar items={SECTION_NAV} />
      <div className="flex-1 flex flex-col overflow-hidden">
      <ImageLabHeader
        imageUrl={store.imageUrl}
        fileName={store.fileName}
        mediaType={store.mediaType}
        acceptVideo
        onLoad={(url, name, mediaType) => store.setImageUrl(url, name, mediaType)}
        onClear={() => store.setImageUrl('', '')}
        onResetSettings={store.resetSettings}
        onClosePanel={onClosePanel}
      />

      <PresetThumbnailStrip
        imageUrl={store.imageUrl}
        presets={FILTER_PRESET_ITEMS}
        onSelect={(name) => {
          const preset = FILTER_PRESETS[name];
          Object.entries(preset).forEach(([k, v]) => {
            store.updateSetting(k as keyof TextureFilterSettings, v as any);
          });
          toast.success(`Applied "${name}"`);
        }}
      />

      <ToolPanelContent>
        {/* Texture */}
        <div id="sec-texture" className="space-y-3 scroll-mt-2">
          <SectionLabel>Texture</SectionLabel>
          <Select
            options={TEXTURE_PRESETS.map((p) => ({ value: p.name, label: p.name }))}
            value={store.textureName}
            onChange={(name) => {
              const p = TEXTURE_PRESETS.find((t) => t.name === name);
              if (p) store.applyPreset(p);
            }}
            variant="node"
          />
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

        {/* Mode */}
        <div id="sec-mode" className="space-y-3 scroll-mt-2">
          <SectionLabel onReset={() => {
            update('blendMode', TEXTURE_FILTER_DEFAULTS.blendMode);
            update('maskMode', false);
            update('maskInvert', false);
          }}>
            Mode
          </SectionLabel>
          <ToolPanelRow label="Mode">
            <Select
              options={[
                { value: 'blend', label: 'Blend' },
                { value: 'mask', label: 'Mask' },
              ]}
              value={store.maskMode ? 'mask' : 'blend'}
              onChange={(v) => update('maskMode', v === 'mask')}
              variant="node"
            />
          </ToolPanelRow>

          {!store.maskMode ? (
            <ToolPanelRow label="Blend">
              <Select
                options={BLEND_MODES.map((m) => ({ value: m.id, label: m.label }))}
                value={store.blendMode}
                onChange={(v) => update('blendMode', v)}
                variant="node"
              />
            </ToolPanelRow>
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
          <div className="grid grid-cols-2 gap-1.5">
            <ScrubInput label="Opacity" value={store.opacity} min={0} max={1} step={0.01} onChange={(v) => update('opacity', v)} />
            <ScrubInput label="Scale" value={store.scale} min={0.1} max={5} step={0.01} onChange={(v) => update('scale', v)} />
          </div>
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
          <ScrubInput label="Rotation" value={store.rotation} min={0} max={360} step={1} suffix="°" onChange={(v) => update('rotation', v)} />
          <div className="grid grid-cols-2 gap-1.5">
            <ScrubInput label="X" value={store.offsetX} min={-2000} max={2000} step={1} suffix="px" onChange={(v) => update('offsetX', v)} />
            <ScrubInput label="Y" value={store.offsetY} min={-2000} max={2000} step={1} suffix="px" onChange={(v) => update('offsetY', v)} />
          </div>
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
              <ScrubInput label="Gap X" value={store.tileGapX} min={-100} max={200} step={1} suffix="px" onChange={(v) => update('tileGapX', v)} />
              <ScrubInput label="Gap Y" value={store.tileGapY} min={-100} max={200} step={1} suffix="px" onChange={(v) => update('tileGapY', v)} />
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
            {store.isExporting ? 'Exporting...' : 'Export'}
          </Button>
          {store.imageUrl && <SendToButton source="texture-filter" imageUrl={store.imageUrl} />}
        </div>
      </ToolPanelActions>
      </div>
    </ToolPanel>
  );
});
