import React, { useState, useEffect, memo, useRef, useCallback } from 'react';
import { Position, type NodeProps, useReactFlow, NodeResizer, useNodes } from '@xyflow/react';
import { 
  Clapperboard, 
  Video as VideoIcon, 
  Settings, 
  ChevronRight, 
  Diamond 
} from 'lucide-react';
import { SeedControl } from './shared/SeedControl';
import type { VideoNodeData, GenerateVideoParams } from '@/types/reactFlow';
import { VeoModel, GenerationMode, type Resolution, type AspectRatio } from '@/types/types';
import { cn } from '@/lib/utils';
import { NodeContainer } from './shared/NodeContainer';
import { NodeHeader } from './shared/node-header';
import { NodeLabel } from './shared/node-label';
import { Select } from '@/components/ui/select';
import { LabeledHandle } from './shared/LabeledHandle';
import { PromptInput } from '../PromptInput';
import { AspectRatioSelector } from './shared/AspectRatioSelector';
import { ResolutionSelector } from './shared/ResolutionSelector';
import { useTranslation } from '@/hooks/useTranslation';
import { Switch } from '@/components/ui/switch';
import { ConnectedImagesDisplay } from './ConnectedImagesDisplay';
import { GlitchLoader } from '@/components/ui/GlitchLoader';
import { useNodeDataUpdater } from '@/hooks/canvas/useNodeDataUpdater';
import { useNodeResize } from '@/hooks/canvas/useNodeResize';
import { NodeButton } from './shared/node-button';
import { Input } from '@/components/ui/input';
import { useLinkedGuidelineId } from '@/components/canvas/CanvasHeaderContext';
import { BrandMediaLibraryModal } from './modals/BrandMediaLibraryModal';
import { toast } from 'sonner';
import { Tooltip } from '@/components/ui/Tooltip';
import { NodeMediaDisplay } from './shared/NodeMediaDisplay';

// Constants
const DEFAULT_MODEL = VeoModel.VEO_3_1;
const DEFAULT_ASPECT_RATIO: AspectRatio = '16:9';
const DEFAULT_RESOLUTION: Resolution = '1080p';
const DEFAULT_DURATION = '5s';
const CREDITS_REQUIRED = 20;

// Mode options for Select
const MODE_OPTIONS = [
  { value: GenerationMode.TEXT_TO_VIDEO, label: 'Text to Video' },
  { value: GenerationMode.FRAMES_TO_VIDEO, label: 'Frames to Video' },
  { value: GenerationMode.EXTEND_VIDEO, label: 'Extend Video' },
  { value: GenerationMode.REFERENCES, label: 'References' },
];

// Model options for Select
const MODEL_OPTIONS = [
  { value: VeoModel.VEO_3_1, label: 'Veo 3.1' },
  { value: VeoModel.VEO_3_1_FAST, label: 'Veo 3.1 Fast' },
];

// Duration options
const DURATION_OPTIONS = [
  { value: '5s', label: '5 Seconds' },
  { value: '10s', label: '10 Seconds' },
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const VideoNode = memo(({ data, selected, id, dragging }: NodeProps<any>) => {
  const { t } = useTranslation();
  const linkedGuidelineId = useLinkedGuidelineId();
  const nodes = useNodes();
  const { setNodes } = useReactFlow();
  const nodeData = data as VideoNodeData;
  const { handleResize: handleResizeWithDebounce, fitToContent } = useNodeResize();

  // Refs
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Local state synced from nodeData
  const [prompt, setPrompt] = useState(nodeData.prompt || '');
  const [negativePrompt, setNegativePrompt] = useState(nodeData.negativePrompt || '');
  const [model, setModel] = useState<string>(nodeData.model || DEFAULT_MODEL);
  const [mode, setMode] = useState<GenerationMode>(nodeData.mode || GenerationMode.TEXT_TO_VIDEO);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(nodeData.aspectRatio || DEFAULT_ASPECT_RATIO);
  const [resolution, setResolution] = useState<Resolution>(nodeData.resolution || DEFAULT_RESOLUTION);
  const [duration, setDuration] = useState<string>(nodeData.duration || DEFAULT_DURATION);
  const [isLooping, setIsLooping] = useState<boolean>(nodeData.isLooping || false);
  const [isBrandActive, setIsBrandActive] = useState<boolean>(nodeData.isBrandActive ?? true);

  // UI state
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [showMediaLibrary, setShowMediaLibrary] = useState(false);

  // Derived state
  const isLoading = nodeData.isLoading || false;
  const connectedText = nodeData.connectedText;
  const hasTextConnection = connectedText !== undefined;

  // Connected images for display
  const connectedImages = [
    nodeData.connectedImage1,
    nodeData.connectedImage2,
    nodeData.connectedImage3,
    nodeData.connectedImage4
  ].filter(Boolean) as string[];

  // Handle visibility based on mode
  const showFirstHandle = mode !== GenerationMode.TEXT_TO_VIDEO;
  const showSecondHandle = mode === GenerationMode.FRAMES_TO_VIDEO || mode === GenerationMode.REFERENCES;
  const showHandles3and4 = mode === GenerationMode.REFERENCES;

  // Sync effect - consolidated from nodeData
  useEffect(() => {
    // Sync prompt from connected text or nodeData
    if (hasTextConnection && connectedText !== undefined) {
      setPrompt(connectedText);
    } else if (nodeData.prompt !== undefined && nodeData.prompt !== prompt) {
      setPrompt(nodeData.prompt);
    }

    // Sync other fields
    if (nodeData.negativePrompt !== undefined && nodeData.negativePrompt !== negativePrompt) {
      setNegativePrompt(nodeData.negativePrompt);
    }
    if (nodeData.model && nodeData.model !== model) setModel(nodeData.model);
    if (nodeData.mode && nodeData.mode !== mode) setMode(nodeData.mode);
    if (nodeData.aspectRatio && nodeData.aspectRatio !== aspectRatio) setAspectRatio(nodeData.aspectRatio);
    if (nodeData.resolution && nodeData.resolution !== resolution) setResolution(nodeData.resolution);
    if (nodeData.duration && nodeData.duration !== duration) setDuration(nodeData.duration);
    if (nodeData.isLooping !== undefined && nodeData.isLooping !== isLooping) setIsLooping(nodeData.isLooping);
    if (nodeData.isBrandActive !== undefined && nodeData.isBrandActive !== isBrandActive) setIsBrandActive(nodeData.isBrandActive);
  }, [
    nodeData.prompt, nodeData.negativePrompt, nodeData.model, nodeData.mode,
    nodeData.aspectRatio, nodeData.resolution, nodeData.duration,
    nodeData.isLooping, nodeData.isBrandActive, connectedText, hasTextConnection
  ]);

  const { debouncedUpdate: debouncedUpdateData, immediateUpdate: updateData } = useNodeDataUpdater<VideoNodeData>(nodeData.onUpdateData, id);

  // Handle generation
  const handleGenerate = useCallback(async () => {
    if (!nodeData.onGenerate) return;

    // Validate required inputs based on mode
    if (mode === GenerationMode.FRAMES_TO_VIDEO && !nodeData.connectedImage1) {
      toast.error(t('canvasNodes.videoNode.startFrameRequired') || 'Start frame is required');
      return;
    }
    if (mode === GenerationMode.EXTEND_VIDEO && !nodeData.connectedVideo) {
      toast.error(t('canvasNodes.videoNode.inputVideoRequired') || 'Input video is required');
      return;
    }

    // Helper to convert string to input format
    const toInput = (str?: string) => {
      if (!str) return undefined;
      return str.startsWith('http') ? { url: str } : { base64: str };
    };

    const params: GenerateVideoParams = {
      nodeId: id,
      prompt,
      negativePrompt,
      model,
      mode,
      aspectRatio,
      resolution,
      duration,
      isLooping,
      seed: nodeData.seedLocked ? nodeData.seed : undefined, // Only pass seed when locked
      // Mode-specific inputs
      startFrame: mode === GenerationMode.FRAMES_TO_VIDEO ? toInput(nodeData.connectedImage1) : undefined,
      endFrame: mode === GenerationMode.FRAMES_TO_VIDEO ? toInput(nodeData.connectedImage2) : undefined,
      inputVideo: mode === GenerationMode.EXTEND_VIDEO ? toInput(nodeData.connectedVideo) : undefined,
      referenceImages: mode === GenerationMode.REFERENCES
        ? [nodeData.connectedImage1, nodeData.connectedImage2, nodeData.connectedImage3, nodeData.connectedImage4]
            .filter((str): str is string => !!str)
            .map((str) => toInput(str)!)
        : undefined,
    };

    await nodeData.onGenerate(params);
  }, [
    nodeData, id, prompt, negativePrompt, model, mode,
    aspectRatio, resolution, duration, isLooping, t
  ]);

  // Handle prompt change
  const handlePromptChange = useCallback((value: string) => {
    setPrompt(value);
    debouncedUpdateData({ prompt: value });
  }, [debouncedUpdateData]);

  // Resize handlers
  const handleResize = useCallback((_: any, params: { width: number }) => {
    handleResizeWithDebounce(id, params.width, 'auto', nodeData.onResize);
  }, [id, nodeData.onResize, handleResizeWithDebounce]);

  const handleFitToContent = useCallback(() => {
    const width = nodeData.imageWidth;
    const height = nodeData.imageHeight;

    if (width && height) {
      let targetWidth = width;
      let targetHeight = height;
      const MAX_FIT_WIDTH = 1200;

      if (targetWidth > MAX_FIT_WIDTH) {
        const ratio = MAX_FIT_WIDTH / targetWidth;
        targetWidth = MAX_FIT_WIDTH;
        targetHeight = targetHeight * ratio;
      }

      fitToContent(id, Math.round(targetWidth), Math.round(targetHeight), nodeData.onResize);
    }
  }, [id, nodeData.imageWidth, nodeData.imageHeight, nodeData.onResize, fitToContent]);

  // Brand Media Library handlers
  const handleAddToBoard = useCallback((url: string, type: 'image' | 'logo') => {
    const newNodeId = `image-${Date.now()}`;
    const currentNode = nodes.find(n => n.id === id);
    const x = currentNode ? currentNode.position.x + 450 : 0;
    const y = currentNode ? currentNode.position.y : 0;

    setNodes((nds) => nds.concat({
      id: newNodeId,
      type: 'image',
      position: { x, y },
      data: {
        mockup: {
          _id: `brand-${Date.now()}`,
          imageUrl: url,
          prompt: `Brand ${type}`,
          designType: 'other',
          tags: ['brand'],
          brandingTags: [],
          aspectRatio: '1:1'
        },
        label: type === 'logo' ? 'Brand Logo' : 'Brand Asset',
        onUpdateData: nodeData.onUpdateData,
        onDelete: nodeData.onDelete,
        onResize: nodeData.onResize
      } as any
    }));
  }, [id, nodes, setNodes, nodeData]);

  const handleSelectAsset = useCallback((url: string, type: 'image' | 'logo') => {
    const updates: Partial<VideoNodeData> = {};
    let slotFound = false;

    if (!nodeData.connectedImage1) {
      updates.connectedImage1 = url;
      slotFound = true;
    } else if (!nodeData.connectedImage2) {
      updates.connectedImage2 = url;
      slotFound = true;
    } else if (!nodeData.connectedImage3) {
      updates.connectedImage3 = url;
      slotFound = true;
    } else if (!nodeData.connectedImage4) {
      updates.connectedImage4 = url;
      slotFound = true;
    }

    if (slotFound) {
      updateData(updates);
    } else {
      toast.warning(t('canvasNodes.videoNode.allSlotsFull') || 'All reference slots are full. Added to board instead.');
      handleAddToBoard(url, type);
    }
  }, [nodeData, updateData, handleAddToBoard, t]);

  // Get label for input handles based on mode
  const getInputLabel = useCallback((index: number): string => {
    if (mode === GenerationMode.FRAMES_TO_VIDEO) {
      if (index === 1) return t('canvasNodes.videoNode.startFrame') || 'Start Frame';
      if (index === 2) return t('canvasNodes.videoNode.endFrame') || 'End Frame';
    }
    if (mode === GenerationMode.EXTEND_VIDEO) {
      if (index === 1) return t('canvasNodes.videoNode.inputVideo') || 'Input Video';
    }
    if (mode === GenerationMode.REFERENCES) {
      return `${t('canvasNodes.videoNode.reference') || 'Reference'} ${index}`;
    }
    return `${t('canvasNodes.videoNode.input') || 'Input'} ${index}`;
  }, [mode, t]);

  // Check if generate button should be disabled
  const isGenerateDisabled = isLoading || (!prompt && !connectedText && !nodeData.connectedImage1);

  return (
    <NodeContainer
      containerRef={containerRef}
      selected={selected}
      dragging={dragging}
      onFitToContent={handleFitToContent}
      className="min-w-[320px]"
    >
      {/* Resizer */}
      {selected && !dragging && (
        <NodeResizer
          color="brand-cyan"
          isVisible={selected}
          minWidth={320}
          minHeight={300}
          keepAspectRatio={true}
          onResize={handleResize}
        />
      )}

      {/* Input Handles */}
      <LabeledHandle
        type="target"
        position={Position.Left}
        id="text-input"
        label={t('canvasNodes.videoNode.prompt') || 'Prompt'}
        handleType="text"
        style={{ top: '60px' }}
      />

      {showFirstHandle && (
        <LabeledHandle
          type="target"
          position={Position.Left}
          id="input-1"
          label={getInputLabel(1)}
          handleType={mode === GenerationMode.EXTEND_VIDEO ? 'video' : 'image'}
          style={{ top: '100px' }}
        />
      )}

      {showSecondHandle && (
        <LabeledHandle
          type="target"
          position={Position.Left}
          id="input-2"
          label={getInputLabel(2)}
          handleType="image"
          style={{ top: '140px' }}
        />
      )}

      {showHandles3and4 && (
        <>
          <LabeledHandle
            type="target"
            position={Position.Left}
            id="input-3"
            label={getInputLabel(3)}
            handleType="image"
            style={{ top: '180px' }}
          />
          <LabeledHandle
            type="target"
            position={Position.Left}
            id="input-4"
            label={getInputLabel(4)}
            handleType="image"
            style={{ top: '220px' }}
          />
        </>
      )}

      {/* Header */}
      <NodeHeader
        icon={Clapperboard}
        title={t('canvasNodes.videoNode.title') || 'Veo Video'}
        selected={selected}
        isBrandActive={isBrandActive}
        onToggleBrand={(active) => {
          setIsBrandActive(active);
          updateData({ isBrandActive: active } as any);
        }}
        onOpenMediaLibrary={() => setShowMediaLibrary(true)}
      />

      {/* Mode Selector */}
      <div className="node-margin">
        <NodeLabel>{t('canvasNodes.videoNode.generationMode') || 'Generation Mode'}</NodeLabel>
        <Select
          value={mode}
          onChange={(v) => {
            const newMode = v as GenerationMode;
            setMode(newMode);
            updateData({ mode: newMode });
          }}
          options={MODE_OPTIONS.map(opt => ({
            value: opt.value,
            label: t(`canvasNodes.videoNode.mode.${opt.value}`) || opt.label
          }))}
          variant="node"
          disabled={isLoading}
        />
      </div>

      {/* Prompt Input */}
      <div className="node-margin">
        <NodeLabel>{t('canvasNodes.videoNode.prompt') || 'Prompt'}</NodeLabel>

        {hasTextConnection && (
          <div className="mb-1.5 text-[10px] font-mono text-brand-cyan/70 flex items-center gap-1">
            <span>*</span>
            <span>{t('canvasNodes.videoNode.connectedToTextNode') || 'Connected to TextNode'}</span>
          </div>
        )}

        <PromptInput
          value={prompt}
          onChange={handlePromptChange}
          onSubmit={handleGenerate}
          placeholder={t('canvasNodes.videoNode.describeVideo') || 'Describe your video...'}
          disabled={isLoading || hasTextConnection}
          textareaRef={textareaRef}
          className="min-h-[80px]"
        />
      </div>

      {/* Connected Inputs Display */}
      {connectedImages.length > 0 && (
        <ConnectedImagesDisplay
          images={connectedImages}
          label={t('canvasNodes.videoNode.connectedInputs') || 'Connected Inputs'}
          showLabel
        />
      )}

      {nodeData.connectedVideo && (
        <div className="node-margin bg-neutral-900/50 border border-neutral-800 rounded p-2 flex items-center gap-2">
          <VideoIcon size={14} className="text-brand-cyan" />
          <span className="text-xs text-neutral-400">
            {t('canvasNodes.videoNode.videoInputConnected') || 'Video Input Connected'}
          </span>
        </div>
      )}

      {/* Advanced Settings Accordion */}
      <div className="node-margin border border-neutral-800 rounded-md bg-neutral-900/30">
        <NodeButton
          variant="ghost"
          size="sm"
          onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
          className="text-xs font-mono text-neutral-400 hover:text-neutral-200 w-full p-2 hover:bg-neutral-800/50"
        >
          <Settings size={12} />
          <span>{t('canvasNodes.videoNode.advancedSettings') || 'Advanced Settings'}</span>
          <ChevronRight
            size={12}
            className={cn('transition-transform ml-auto', isAdvancedOpen && 'rotate-90')}
          />
        </NodeButton>
      </div>

      {isAdvancedOpen && (
        <div className="node-margin p-3 space-y-3 border border-neutral-800 rounded-md bg-neutral-900/50">
          {/* Model */}
          <div>
            <NodeLabel>{t('canvasNodes.videoNode.model') || 'Model'}</NodeLabel>
            <Select
              value={model}
              onChange={(v) => {
                setModel(v);
                updateData({ model: v });
              }}
              options={MODEL_OPTIONS}
              variant="node"
              disabled={isLoading}
            />
          </div>

          {/* Aspect Ratio & Resolution Grid */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <NodeLabel>{t('canvasNodes.videoNode.aspectRatio') || 'Aspect Ratio'}</NodeLabel>
              <AspectRatioSelector
                value={aspectRatio}
                onChange={(r) => {
                  setAspectRatio(r);
                  updateData({ aspectRatio: r });
                }}
                disabled={isLoading}
                compact
              />
            </div>
            <div>
              <NodeLabel>{t('canvasNodes.videoNode.resolution') || 'Resolution'}</NodeLabel>
              <ResolutionSelector
                value={resolution}
                onChange={(r) => {
                  setResolution(r);
                  updateData({ resolution: r });
                }}
                model={model as any}
                disabled={isLoading}
                compact
                allowVideo={true}
              />
            </div>
          </div>

          {/* Duration */}
          <div>
            <NodeLabel>{t('canvasNodes.videoNode.duration') || 'Duration'}</NodeLabel>
            <Select
              value={duration}
              onChange={(v) => {
                setDuration(v);
                updateData({ duration: v });
              }}
              options={DURATION_OPTIONS}
              variant="node"
              disabled={isLoading}
            />
          </div>

          {/* Loop Toggle */}
          <div className="flex items-center justify-between py-1">
            <NodeLabel className="mb-0">{t('canvasNodes.videoNode.loopVideo') || 'Loop Video'}</NodeLabel>
            <Switch
              checked={isLooping}
              onCheckedChange={(c) => {
                setIsLooping(c);
                updateData({ isLooping: c });
              }}
              disabled={isLoading}
            />
          </div>

          {/* Negative Prompt */}
          <div>
            <NodeLabel>{t('canvasNodes.videoNode.negativePrompt') || 'Negative Prompt'}</NodeLabel>
            <Input
              className="w-full bg-neutral-900 border border-neutral-700 rounded p-2 text-xs font-mono text-neutral-300 focus:border-brand-cyan outline-none placeholder:text-neutral-600"
              placeholder={t('canvasNodes.videoNode.whatToAvoid') || 'What to avoid...'}
              value={negativePrompt}
              onChange={(e) => {
                setNegativePrompt(e.target.value);
                debouncedUpdateData({ negativePrompt: e.target.value });
              }}
              disabled={isLoading}
            />
          </div>

          {/* Seed Control */}
          <SeedControl
            seed={nodeData.seed}
            seedLocked={nodeData.seedLocked}
            onSeedChange={(seed) => updateData({ seed })}
            onSeedLockedChange={(locked) => updateData({ seedLocked: locked })}
            disabled={isLoading}
          />
        </div>
      )}

      {/* Generate Button */}
      <Tooltip 
        content={`${t('canvasNodes.promptNode.creditsRequired') || 'Costs'} ${CREDITS_REQUIRED} ${t('canvasNodes.promptNode.credits')}`}
        delay={500}
      >
        <NodeButton
          variant="primary"
          size="full"
          onClick={(e) => {
            e.stopPropagation();
            handleGenerate();
          }}
          onMouseDown={(e) => e.stopPropagation()}
          disabled={isGenerateDisabled}
          className="node-interactive group/gen"
        >
          {isLoading ? (
            <div className="flex items-center justify-center gap-2">
              <GlitchLoader size={14} color="brand-cyan" />
              <span>{t('canvasNodes.videoNode.generating') || 'Generating...'}</span>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2">
              <VideoIcon size={14} className="group-hover/gen:rotate-12 transition-transform" />
              <span className="font-semibold tracking-tight">{t('canvasNodes.videoNode.generateVideo') || 'Generate Video'}</span>
              <div className="flex items-center gap-1 ml-1 px-1.5 py-0.5 rounded-full bg-black/20 text-[10px] text-foreground/80">
                <Diamond size={10} className="opacity-50 fill-current" />
                {CREDITS_REQUIRED}
              </div>
            </div>
          )}
        </NodeButton>
      </Tooltip>

      {/* Result Preview */}
      {(nodeData.resultVideoUrl || nodeData.resultVideoBase64) && (
        <div className="node-margin">
          <NodeMediaDisplay
            url={nodeData.resultVideoUrl || (nodeData.resultVideoBase64 ? (nodeData.resultVideoBase64.startsWith('data:') ? nodeData.resultVideoBase64 : `data:video/mp4;base64,${nodeData.resultVideoBase64}`) : null)}
            isVideo={true}
            isLoading={isLoading}
            dragging={dragging}
            onMediaLoad={(width, height) => {
              nodeData.onUpdateData?.(String(id), {
                imageWidth: width,
                imageHeight: height,
              });
            }}
          />
        </div>
      )}

      {/* Output Handle */}
      <LabeledHandle
        type="source"
        position={Position.Right}
        label={t('canvasNodes.videoNode.video') || 'Video'}
        handleType="video"
        style={{ top: '50%' }}
      />

      {/* Brand Media Library Modal */}
      <BrandMediaLibraryModal
        isOpen={showMediaLibrary}
        onClose={() => setShowMediaLibrary(false)}
        onSelectAsset={handleSelectAsset}
        onAddToBoard={handleAddToBoard}
        guidelineId={linkedGuidelineId}
      />
    </NodeContainer>
  );
}, (prevProps, nextProps) => {
  // Custom equality check for performance
  const prevData = prevProps.data as VideoNodeData;
  const nextData = nextProps.data as VideoNodeData;

  // Re-render on relevant prop changes
  return (
    prevProps.selected === nextProps.selected &&
    prevData.isLoading === nextData.isLoading &&
    prevData.prompt === nextData.prompt &&
    prevData.negativePrompt === nextData.negativePrompt &&
    prevData.model === nextData.model &&
    prevData.mode === nextData.mode &&
    prevData.aspectRatio === nextData.aspectRatio &&
    prevData.resolution === nextData.resolution &&
    prevData.isLooping === nextData.isLooping &&
    prevData.duration === nextData.duration &&
    prevData.isBrandActive === nextData.isBrandActive &&
    prevData.connectedText === nextData.connectedText &&
    prevData.connectedImage1 === nextData.connectedImage1 &&
    prevData.connectedImage2 === nextData.connectedImage2 &&
    prevData.connectedImage3 === nextData.connectedImage3 &&
    prevData.connectedImage4 === nextData.connectedImage4 &&
    prevData.connectedVideo === nextData.connectedVideo &&
    prevData.seed === nextData.seed &&
    prevData.seedLocked === nextData.seedLocked &&
    prevData.resultVideoUrl === nextData.resultVideoUrl &&
    prevData.resultVideoBase64 === nextData.resultVideoBase64
  );
});
