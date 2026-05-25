import React, { useEffect, memo, useRef, useCallback, useState, Suspense } from 'react';
import { type NodeProps, type Node, NodeResizer } from '@xyflow/react';
import { Download, Maximize2, Box, Pencil, Image as ImageIcon } from 'lucide-react';
import { GlitchLoader } from '@/components/ui/GlitchLoader';
import { NodeHeader } from './shared/node-header';
import type { Studio3DNodeData } from '@/types/reactFlow';
import { cn } from '@/lib/utils';
import { NodeHandles } from './shared/NodeHandles';
import { NodeContainer } from './shared/NodeContainer';
import { NodePlaceholder } from './shared/NodePlaceholder';
import { useNodeDownload } from './shared/useNodeDownload';
import { useNodeResize } from '@/hooks/canvas/useNodeResize';
import { NodeButton } from './shared/node-button';
import { NodeSlider } from './shared/node-slider';
import { useStudio3DStore } from '@/stores/studio3dStore';
import type { SceneHandle } from '@/components/3d-studio/engine/useSceneRef';
import { toast } from 'sonner';

const SceneCanvas = React.lazy(() =>
  import('@/components/3d-studio/SceneCanvas').then(m => ({ default: m.SceneCanvas }))
);

const MATERIAL_OPTIONS = ['default', 'plastic', 'metal', 'glass', 'chrome', 'gold', 'copper', 'ceramic', 'rubber', 'holographic'] as const;

const Studio3DNodeComponent: React.FC<NodeProps<Node<Studio3DNodeData>>> = ({ data, selected, id, dragging }) => {
  const { handleResize: handleResizeWithDebounce, fitToContent } = useNodeResize();
  const isLoading = data.isLoading || false;
  const hasResult = !!(data.resultImageUrl || data.resultImageBase64);
  const resultImageUrl = data.resultImageUrl || data.resultImageBase64;
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sceneHandleRef = useRef<SceneHandle | null>(null);
  const previousConnectedImageRef = useRef<string | undefined>(undefined);

  const material = data.material || 'default';
  const depth = data.depth ?? 20;

  // When connected image changes (SVG input), auto-render
  useEffect(() => {
    if (!data.connectedImage) return;
    const imageChanged = data.connectedImage !== previousConnectedImageRef.current;
    previousConnectedImageRef.current = data.connectedImage;

    if (imageChanged && data.onApply) {
      // Store the SVG in node data, then trigger render
      if (data.onUpdateData) {
        data.onUpdateData(id, { svgData: data.connectedImage });
      }
    }
  }, [data.connectedImage]);

  const { handleDownload } = useNodeDownload(resultImageUrl || null, '3d-render');

  const handleFitToContent = useCallback(() => {
    const width = data.imageWidth as number;
    const height = data.imageHeight as number;
    if (width && height) {
      let tw = width, th = height;
      if (tw > 1200) { const r = 1200 / tw; tw = 1200; th = th * r; }
      fitToContent(id, Math.round(tw), Math.round(th), data.onResize);
    }
  }, [id, data.imageWidth, data.imageHeight, data.onResize, fitToContent]);

  const handleResize = useCallback((_: any, params: { width: number; height: number }) => {
    handleResizeWithDebounce(id, params.width, 'auto');
  }, [id, handleResizeWithDebounce]);

  const updateSetting = useCallback((key: string, value: any) => {
    if (data.onUpdateData) data.onUpdateData(id, { [key]: value });
  }, [data.onUpdateData, id]);

  // Open the fullscreen 3D editor modal
  const openEditor = useCallback(() => {
    // Apply current node config to the shared store before opening
    const store = useStudio3DStore.getState();
    if (data.sceneConfig) {
      store.applyConfig(data.sceneConfig);
    }
    if (data.svgData) {
      store.setSvgData(data.svgData, 'node-input.svg');
    }
    setIsEditorOpen(true);
  }, [data.sceneConfig, data.svgData]);

  // Capture snapshot when closing editor
  const closeEditor = useCallback(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      try {
        const snapshot = canvas.toDataURL('image/png');
        const store = useStudio3DStore.getState();

        // Save the full config back to node
        if (data.onUpdateData) {
          data.onUpdateData(id, {
            resultImageBase64: snapshot,
            imageWidth: canvas.width,
            imageHeight: canvas.height,
            material: store.material,
            depth: store.depth,
            color: store.color,
            animate: store.animate,
            background: store.background,
            environment: store.environment,
            svgData: store.svgData,
            sceneConfig: {
              material: store.material,
              depth: store.depth,
              color: store.color,
              metalness: store.metalness,
              roughness: store.roughness,
              animate: store.animate,
              animateSpeed: store.animateSpeed,
              background: store.background,
              bgType: store.bgType,
              bgGradient: store.bgGradient,
              transparentBg: store.transparentBg,
              environment: store.environment,
              shadow: store.shadow,
              bloomEnabled: store.bloomEnabled,
              bloomIntensity: store.bloomIntensity,
              dofEnabled: store.dofEnabled,
              vignetteEnabled: store.vignetteEnabled,
              bevelEnabled: store.bevelEnabled,
              bevelThickness: store.bevelThickness,
              bevelSize: store.bevelSize,
              wireframe: store.wireframe,
              smoothness: store.smoothness,
              shapeType: store.shapeType,
            },
          });
        }
        toast.success('3D snapshot captured');
      } catch {
        toast.error('Failed to capture snapshot');
      }
    }
    setIsEditorOpen(false);
  }, [data.onUpdateData, id]);

  const handleCanvasReady = useCallback((canvas: HTMLCanvasElement) => {
    canvasRef.current = canvas;
  }, []);

  const handleSceneReady = useCallback((handle: SceneHandle) => {
    sceneHandleRef.current = handle;
  }, []);

  return (
    <>
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
          icon={Box}
          title="3D Studio"
          selected={selected}
          isBrandActive={data.isBrandActive}
          onToggleBrand={(active) => data.onUpdateData?.(id, { isBrandActive: active })}
        />

        {/* Empty state */}
        {!hasResult && !isLoading && (
          <div className="w-full space-y-[var(--node-gap-sm)]">
            <div className="w-full px-4 py-3 bg-neutral-800/30 border-node border-neutral-700/30 rounded text-xs font-mono text-neutral-500 flex items-center justify-center gap-3 opacity-50">
              <Box size={14} />
              No render yet
            </div>
            <button
              onClick={openEditor}
              className="w-full px-3 py-2 bg-brand-cyan/10 hover:bg-brand-cyan/20 border border-neutral-800 hover:border-neutral-700 rounded text-xs font-mono text-brand-cyan flex items-center justify-center gap-2 cursor-pointer transition-all"
            >
              <Pencil size={14} />
              Open 3D Editor
            </button>
          </div>
        )}

        {/* Loading state */}
        {isLoading && !hasResult && (
          <div className="mt-2 pt-2 border-t border-neutral-700/30 flex-1 min-h-[100px] flex items-center justify-center">
            <NodePlaceholder isLoading={true} emptyMessage="Rendering 3D..." />
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
                alt="3D render result"
                className="w-full h-full object-contain rounded"
                onLoad={(e) => {
                  const img = e.target as HTMLImageElement;
                  if (img.naturalWidth > 0 && img.naturalHeight > 0) {
                    data.onUpdateData?.(id, { imageWidth: img.naturalWidth, imageHeight: img.naturalHeight });
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

            <div className={cn(
              "absolute top-3 right-3 flex gap-1.5 transition-all backdrop-blur-sm z-10",
              selected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
            )}>
              <NodeButton variant="ghost" size="xs" onClick={(e) => { e.stopPropagation(); openEditor(); }}>
                <Pencil size={14} />
              </NodeButton>
              {data.onViewFullscreen && (
                <NodeButton variant="ghost" size="xs" onClick={(e) => {
                  e.stopPropagation();
                  data.onViewFullscreen!(resultImageUrl, data.resultImageBase64);
                }}>
                  <Maximize2 size={14} />
                </NodeButton>
              )}
              <NodeButton variant="ghost" size="xs" onClick={handleDownload} aria-label="Download render">
                <Download size={14} />
              </NodeButton>
            </div>
          </div>
        )}

        {/* Inline settings (compact) */}
        {(hasResult || data.svgData) && (
          <div className="mt-2 pt-2 border-t border-neutral-700/30 space-y-[var(--node-gap-sm)]">
            {/* Material chips */}
            <div className="flex flex-wrap gap-1">
              {MATERIAL_OPTIONS.map((m) => (
                <button
                  key={m}
                  onClick={() => updateSetting('material', m)}
                  className={cn(
                    'px-2 py-0.5 rounded text-[9px] font-mono uppercase tracking-wider border-node transition-all',
                    material === m ? 'bg-white/10 text-white border-white/20' : 'bg-neutral-800/50 text-neutral-500 border-neutral-700/30 hover:bg-neutral-800'
                  )}
                >
                  {m}
                </button>
              ))}
            </div>

            <NodeSlider
              label="Depth"
              value={depth}
              min={1}
              max={80}
              step={1}
              onChange={(v) => updateSetting('depth', v)}
            />

            <button
              onClick={openEditor}
              className="w-full px-2 py-1 rounded text-[9px] font-mono uppercase tracking-wider border-node bg-brand-cyan/10 text-brand-cyan border-white/20 hover:bg-brand-cyan/20 transition-all text-center"
            >
              Full Editor
            </button>
          </div>
        )}
      </NodeContainer>

      {/* Fullscreen 3D Editor Modal */}
      {isEditorOpen && (
        <div className="fixed inset-0 z-[9999] bg-neutral-950 flex flex-col" style={{ position: 'fixed' }}>
          {/* Modal header */}
          <div className="h-10 bg-neutral-900 border-b border-neutral-800 flex items-center justify-between px-4 shrink-0">
            <span className="text-[11px] font-mono text-neutral-400 uppercase tracking-widest">3D Studio — Node Editor</span>
            <button
              onClick={closeEditor}
              className="px-3 py-1 bg-white hover:bg-neutral-200 text-black text-[11px] font-medium rounded transition-colors"
            >
              Save & Close
            </button>
          </div>
          {/* Scene */}
          <div className="flex-1 relative">
            <Suspense fallback={
              <div className="w-full h-full flex items-center justify-center">
                <span className="text-[10px] uppercase tracking-widest text-neutral-600 animate-pulse">Loading 3D engine...</span>
              </div>
            }>
              <SceneCanvas onCanvasReady={handleCanvasReady} onSceneReady={handleSceneReady} />
            </Suspense>
          </div>
        </div>
      )}
    </>
  );
};

export const Studio3DNode = memo(Studio3DNodeComponent);
