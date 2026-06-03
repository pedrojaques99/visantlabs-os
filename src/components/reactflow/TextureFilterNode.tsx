import React, { useEffect, memo, useRef, useCallback, useState } from 'react';
import { type NodeProps, type Node, NodeResizer } from '@xyflow/react';
import { Download, Maximize2, Layers, Image as ImageIcon } from 'lucide-react';
import { GlitchLoader } from '@/components/ui/GlitchLoader';
import { NodeHeader } from './shared/node-header';
import type { TextureFilterNodeData } from '@/types/reactFlow';
import { cn } from '@/lib/utils';
import { NodeHandles } from './shared/NodeHandles';
import { NodeContainer } from './shared/NodeContainer';
import { NodePlaceholder } from './shared/NodePlaceholder';
import { useTranslation } from '@/hooks/useTranslation';
import { useNodeDownload } from './shared/useNodeDownload';
import { useNodeResize } from '@/hooks/canvas/useNodeResize';
import { NodeButton } from './shared/node-button';
import { NodeSlider } from './shared/node-slider';
import { TEXTURE_FILTER_RENDER_DEFAULTS } from '@/utils/textureFilter/renderTextureFilter';
import { FILTER_PRESETS } from '@/stores/textureFilterStore';

const BLEND_MODES = [
  { id: 'multiply', label: 'Multiply' },
  { id: 'screen', label: 'Screen' },
  { id: 'overlay', label: 'Overlay' },
  { id: 'soft-light', label: 'Soft Light' },
  { id: 'hard-light', label: 'Hard Light' },
  { id: 'color-burn', label: 'Burn' },
  { id: 'color-dodge', label: 'Dodge' },
] as const;

const TextureFilterNodeComponent: React.FC<NodeProps<Node<TextureFilterNodeData>>> = ({
  data,
  selected,
  id,
  dragging,
}) => {
  const { t } = useTranslation();
  const { handleResize: handleResizeWithDebounce, fitToContent } = useNodeResize();
  const isLoading = data.isLoading || false;
  const hasResult = !!(data.resultImageUrl || data.resultImageBase64);
  const hasConnectedImage = !!data.connectedImage;
  const resultImageUrl = data.resultImageUrl || data.resultImageBase64;
  const previousConnectedImageRef = useRef<string | undefined>(undefined);
  const [isHovered, setIsHovered] = useState(false);

  const opacity = data.opacity ?? TEXTURE_FILTER_RENDER_DEFAULTS.opacity;
  const scale = data.scale ?? TEXTURE_FILTER_RENDER_DEFAULTS.scale;
  const blendMode = data.blendMode ?? TEXTURE_FILTER_RENDER_DEFAULTS.blendMode;
  const maskMode = data.maskMode ?? TEXTURE_FILTER_RENDER_DEFAULTS.maskMode;
  const tileMode = data.tileMode ?? TEXTURE_FILTER_RENDER_DEFAULTS.tileMode;
  const rotation = data.rotation ?? TEXTURE_FILTER_RENDER_DEFAULTS.rotation;

  // Auto-apply when connected image arrives or settings change
  useEffect(() => {
    if (!data.onApply || !hasConnectedImage) return;

    const imageChanged = data.connectedImage !== previousConnectedImageRef.current;
    const isInitialMount = previousConnectedImageRef.current === undefined;
    previousConnectedImageRef.current = data.connectedImage;

    if (isInitialMount && hasResult && !imageChanged) return;

    if (imageChanged || !hasResult) {
      data.onApply(id, data.connectedImage!).catch(console.error);
    }
  }, [data.connectedImage]);

  // Re-apply when settings change (only if we have an image and a result already)
  useEffect(() => {
    if (!data.onApply || !hasConnectedImage || !hasResult || isLoading) return;
    data.onApply(id, data.connectedImage!).catch(console.error);
  }, [
    opacity,
    scale,
    blendMode,
    maskMode,
    tileMode,
    rotation,
    data.maskInvert,
    data.useOriginalColor,
    data.textureColor,
    data.textureSrc,
    data.tileGapX,
    data.tileGapY,
    data.offsetX,
    data.offsetY,
  ]);

  const { handleDownload } = useNodeDownload(resultImageUrl || null, 'texture-filter-result');

  const handleFitToContent = useCallback(() => {
    const width = data.imageWidth as number;
    const height = data.imageHeight as number;
    if (width && height) {
      let tw = width,
        th = height;
      if (tw > 1200) {
        const r = 1200 / tw;
        tw = 1200;
        th = th * r;
      }
      fitToContent(id, Math.round(tw), Math.round(th), data.onResize);
    }
  }, [id, data.imageWidth, data.imageHeight, data.onResize, fitToContent]);

  const handleResize = useCallback(
    (_: any, params: { width: number; height: number }) => {
      handleResizeWithDebounce(id, params.width, 'auto');
    },
    [id, handleResizeWithDebounce]
  );

  const updateSetting = useCallback(
    (key: string, value: any) => {
      if (data.onUpdateData) data.onUpdateData(id, { [key]: value });
    },
    [data.onUpdateData, id]
  );

  return (
    <NodeContainer
      selected={selected}
      dragging={dragging}
      warning={data.oversizedWarning}
      onFitToContent={handleFitToContent}
      className="min-w-[320px] w-full h-full"
    >
      {selected && !dragging && (
        <NodeResizer
          color="brand-cyan"
          isVisible={selected}
          minWidth={320}
          minHeight={200}
          maxWidth={2000}
          maxHeight={2000}
          keepAspectRatio={true}
          onResize={handleResize}
        />
      )}
      <NodeHandles />

      <NodeHeader
        icon={Layers}
        title="Texture Filter"
        selected={selected}
        isBrandActive={data.isBrandActive}
        onToggleBrand={(active) => data.onUpdateData?.(id, { isBrandActive: active })}
      />

      {/* Empty state */}
      {!hasConnectedImage && (
        <div className="w-full px-4 py-3 bg-neutral-800/30 border-node border-neutral-700/30 rounded text-xs font-mono text-neutral-500 flex items-center justify-center gap-3 opacity-50">
          <ImageIcon size={14} />
          Connect an image
        </div>
      )}

      {/* Processing indicator */}
      {hasConnectedImage && !hasResult && isLoading && (
        <div className="mt-2 pt-2 border-t border-neutral-700/30 flex-1 min-h-[100px] flex items-center justify-center">
          <NodePlaceholder isLoading={true} emptyMessage="Applying texture..." />
        </div>
      )}

      {/* Result preview */}
      {hasResult && resultImageUrl && (
        <div
          className="mt-2 pt-2 border-t border-neutral-700/30 relative group flex-1 min-h-0 flex flex-col"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          <div className="relative w-full h-full flex items-center justify-center">
            <img
              src={resultImageUrl}
              alt="Texture filter result"
              className="w-full h-full object-contain rounded"
              onLoad={(e) => {
                const img = e.target as HTMLImageElement;
                if (img.naturalWidth > 0 && img.naturalHeight > 0) {
                  data.onUpdateData?.(id, {
                    imageWidth: img.naturalWidth,
                    imageHeight: img.naturalHeight,
                  });
                }
              }}
            />
          </div>

          {isLoading && (
            <div className="absolute top-3 left-3 z-20">
              <div className="p-1.5 rounded-md bg-neutral-950/60 backdrop-blur-sm border-node border-neutral-800 shadow-lg">
                <GlitchLoader size={14} color="brand-cyan" />
              </div>
            </div>
          )}

          <div
            className={cn(
              'absolute top-3 right-3 flex gap-1.5 transition-all backdrop-blur-sm z-10',
              selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
            )}
          >
            {data.onViewFullscreen && (
              <NodeButton
                variant="ghost"
                size="xs"
                onClick={(e) => {
                  e.stopPropagation();
                  data.onViewFullscreen!(resultImageUrl, data.resultImageBase64);
                }}
              >
                <Maximize2 size={14} />
              </NodeButton>
            )}
            <NodeButton
              variant="ghost"
              size="xs"
              onClick={handleDownload}
              aria-label="Download result"
            >
              <Download size={14} />
            </NodeButton>
          </div>
        </div>
      )}

      {/* Inline settings */}
      {hasConnectedImage && (
        <div className="mt-2 pt-2 border-t border-neutral-700/30 space-y-[var(--node-gap-sm)]">
          {/* Preset chips */}
          <div className="flex flex-wrap gap-1">
            {Object.keys(FILTER_PRESETS).map((name) => (
              <button
                key={name}
                onClick={() => {
                  const preset = FILTER_PRESETS[name];
                  Object.entries(preset).forEach(([k, v]) => updateSetting(k, v));
                }}
                className="px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider border-node transition-all bg-brand-cyan/5 text-brand-cyan/70 border-white/15 hover:bg-brand-cyan/15 hover:text-brand-cyan"
              >
                {name}
              </button>
            ))}
          </div>

          {/* Blend mode chips */}
          <div className="flex flex-wrap gap-1">
            <button
              onClick={() => updateSetting('maskMode', !maskMode)}
              className={cn(
                'px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider border-node transition-all',
                maskMode
                  ? 'bg-brand-cyan/20 text-brand-cyan border-white/20'
                  : 'bg-neutral-800/50 text-neutral-500 border-neutral-700/30 hover:bg-neutral-800'
              )}
            >
              Mask
            </button>
            {!maskMode &&
              BLEND_MODES.map((m) => (
                <button
                  key={m.id}
                  onClick={() => updateSetting('blendMode', m.id)}
                  className={cn(
                    'px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider border-node transition-all',
                    blendMode === m.id
                      ? 'bg-white/10 text-white border-white/20'
                      : 'bg-neutral-800/50 text-neutral-500 border-neutral-700/30 hover:bg-neutral-800'
                  )}
                >
                  {m.label}
                </button>
              ))}
          </div>

          <NodeSlider
            label="Opacity"
            value={opacity}
            min={0}
            max={1}
            step={0.01}
            onChange={(v) => updateSetting('opacity', v)}
          />
          <NodeSlider
            label="Scale"
            value={scale}
            min={0.1}
            max={5}
            step={0.01}
            onChange={(v) => updateSetting('scale', v)}
          />
          <NodeSlider
            label="Rotation"
            value={rotation}
            min={0}
            max={360}
            step={1}
            onChange={(v) => updateSetting('rotation', v)}
            formatValue={(v) => `${Math.round(v)}°`}
          />

          {/* Tile toggle */}
          <button
            onClick={() => updateSetting('tileMode', !tileMode)}
            className={cn(
              'w-full px-2 py-1 rounded text-[10px] font-mono uppercase tracking-wider border-node transition-all text-center',
              tileMode
                ? 'bg-white/10 text-white border-white/20'
                : 'bg-neutral-800/50 text-neutral-500 border-neutral-700/30 hover:bg-neutral-800'
            )}
          >
            {tileMode ? 'Tile: On' : 'Tile: Off'}
          </button>
        </div>
      )}
    </NodeContainer>
  );
};

export const TextureFilterNode = memo(TextureFilterNodeComponent);
