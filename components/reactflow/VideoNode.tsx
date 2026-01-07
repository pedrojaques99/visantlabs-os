import React, { useState, useEffect, memo, useRef, useCallback } from 'react';
import { type NodeProps, type Node, useReactFlow, NodeResizer, Position } from '@xyflow/react';
import { Clapperboard, Video as VideoIcon, Image as ImageIcon, Settings, ChevronRight } from 'lucide-react';
import type { VideoNodeData, GenerateVideoParams } from '../../types/reactFlow';
import { VeoModel, GenerationMode, Resolution, AspectRatio } from '../../types';
import { cn } from '../../lib/utils';
import { NodeContainer } from './shared/NodeContainer';
import { NodeHeader } from './shared/node-header';
import { NodeLabel } from './shared/node-label';
import { Select } from '../ui/select';
import { LabeledHandle } from './shared/LabeledHandle';
import { PromptInput } from '../PromptInput';
import { AspectRatioSelector } from './shared/AspectRatioSelector';
import { ResolutionSelector } from './shared/ResolutionSelector';
import { useTranslation } from '../../hooks/useTranslation';
import { Switch } from '../ui/switch';
import { ConnectedImagesDisplay } from './ConnectedImagesDisplay';
import { GlitchLoader } from '../ui/GlitchLoader';
import { useDebouncedCallback } from '../../hooks/useDebouncedCallback';
import { useNodeResize } from '../../hooks/canvas/useNodeResize';

const VideoNodeComponent: React.FC<NodeProps<Node<VideoNodeData>>> = ({ data, selected, id, dragging }) => {
  const { t } = useTranslation();
  const { setNodes } = useReactFlow();
  const { handleResize: handleResizeWithDebounce, fitToContent } = useNodeResize();

  // State initialization
  const [prompt, setPrompt] = useState(data.prompt || '');
  const [negativePrompt, setNegativePrompt] = useState(data.negativePrompt || '');
  const [model, setModel] = useState<string>(data.model || VeoModel.VEO_3_1);
  const [mode, setMode] = useState<GenerationMode>(data.mode || GenerationMode.TEXT_TO_VIDEO);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(data.aspectRatio || '16:9');
  const [resolution, setResolution] = useState<Resolution>(data.resolution || '1080p');
  const [duration, setDuration] = useState<string>(data.duration || '5s');
  const [isLooping, setIsLooping] = useState<boolean>(data.isLooping || false);
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync with data
  useEffect(() => {
    if (data.prompt !== prompt) setPrompt(data.prompt || '');
    if (data.negativePrompt !== negativePrompt) setNegativePrompt(data.negativePrompt || '');
    if (data.model && data.model !== model) setModel(data.model);
    if (data.mode && data.mode !== mode) setMode(data.mode);
    if (data.aspectRatio && data.aspectRatio !== aspectRatio) setAspectRatio(data.aspectRatio);
    if (data.resolution && data.resolution !== resolution) setResolution(data.resolution);
    if (data.duration && data.duration !== duration) setDuration(data.duration);
    if (data.isLooping !== undefined && data.isLooping !== isLooping) setIsLooping(data.isLooping);

    // Sync connected text if no manual prompt
    if (data.connectedText && !data.prompt) {
      setPrompt(data.connectedText);
    }
  }, [data]);

  const updateData = (updates: Partial<VideoNodeData>) => {
    if (data.onUpdateData) {
      data.onUpdateData(id, updates);
    }
  };

  // Debounced update for text inputs to avoid log spam
  const debouncedUpdateData = useDebouncedCallback((updates: Partial<VideoNodeData>) => {
    if (data.onUpdateData) {
      data.onUpdateData(id, updates);
    }
  }, 500);

  const handleGenerate = async () => {
    if (!data.onGenerate) return;

    // Check required inputs based on mode
    let missingInput = false;
    if (mode === GenerationMode.FRAMES_TO_VIDEO && !data.connectedImage1) missingInput = true;
    if (mode === GenerationMode.EXTEND_VIDEO && !data.connectedVideo) missingInput = true;
    if (missingInput) return; // Add visual feedback/toast here ideally

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
      // Pass connected inputs
      startFrame: mode === GenerationMode.FRAMES_TO_VIDEO ? toInput(data.connectedImage1) : undefined,
      endFrame: mode === GenerationMode.FRAMES_TO_VIDEO ? toInput(data.connectedImage2) : undefined,
      inputVideo: mode === GenerationMode.EXTEND_VIDEO ? toInput(data.connectedVideo) : undefined,
      referenceImages: mode === GenerationMode.REFERENCES
        ? [data.connectedImage1, data.connectedImage2, data.connectedImage3, data.connectedImage4]
          .filter((str): str is string => !!str)
          .map((str) => toInput(str)!)
        : undefined,
    };

    await data.onGenerate(params);
  };

  // Resize handler (com debounce - aplica apenas quando soltar o mouse)
  const handleResize = useCallback((width: number, height: number) => {
    handleResizeWithDebounce(id, width, height, data.onResize);
  }, [id, data.onResize, handleResizeWithDebounce]);

  const handleFitToContent = useCallback(() => {
    // Check if we have dimensions in data
    const width = data.imageWidth;
    const height = data.imageHeight;

    if (width && height) {
      // Calculate a reasonable size if video is too large
      let targetWidth = width;
      let targetHeight = height;
      const MAX_FIT_WIDTH = 1200;

      if (targetWidth > MAX_FIT_WIDTH) {
        const ratio = MAX_FIT_WIDTH / targetWidth;
        targetWidth = MAX_FIT_WIDTH;
        targetHeight = targetHeight * ratio;
      }

      fitToContent(id, Math.round(targetWidth), Math.round(targetHeight), data.onResize);
    }
  }, [id, (data as any).imageWidth, (data as any).imageHeight, data.onResize, fitToContent]);

  // Derived states
  const isLoading = data.isLoading || false;
  const creditsRequired = 20; // Hardcoded for now as per current logic

  const getInputLabel = (index: number) => {
    if (mode === GenerationMode.FRAMES_TO_VIDEO) {
      if (index === 1) return t('Start Frame');
      if (index === 2) return t('End Frame');
    }
    if (mode === GenerationMode.EXTEND_VIDEO) {
      if (index === 1) return t('Input Video');
    }
    if (mode === GenerationMode.REFERENCES) {
      return `${t('Reference')} ${index}`;
    }
    return `${t('Input')} ${index}`;
  };

  // Connected Images Visualization
  const connectedImages = [
    data.connectedImage1,
    data.connectedImage2,
    data.connectedImage3,
    data.connectedImage4
  ].filter(Boolean) as string[];



  // Determine handles based on mode
  const showSecondHandle = mode === GenerationMode.FRAMES_TO_VIDEO || mode === GenerationMode.REFERENCES;
  const showHandles3and4 = mode === GenerationMode.REFERENCES;

  return (
    <NodeContainer
      selected={selected}
      dragging={dragging}
      onFitToContent={handleFitToContent}
      className="p-0 min-w-[320px] max-w-[400px] overflow-visible"
    >
      {selected && !dragging && (
        <NodeResizer
          color="#52ddeb"
          isVisible={selected}
          minWidth={320}
          minHeight={300}
          keepAspectRatio={true}
          onResize={(_, { width, height }) => handleResize(width, height)}
        />
      )}

      {/* Handles */}
      <LabeledHandle type="target" position={Position.Left} id="text-input" label={t('Prompt')} handleType="text" style={{ top: '60px' }} />

      {mode !== GenerationMode.TEXT_TO_VIDEO && (
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
        <LabeledHandle type="target" position={Position.Left} id="input-2" label={getInputLabel(2)} handleType="image" style={{ top: '140px' }} />
      )}
      {showHandles3and4 && (
        <>
          <LabeledHandle type="target" position={Position.Left} id="input-3" label={getInputLabel(3)} handleType="image" style={{ top: '180px' }} />
          <LabeledHandle type="target" position={Position.Left} id="input-4" label={getInputLabel(4)} handleType="image" style={{ top: '220px' }} />
        </>
      )}

      {/* Header */}
      <div className="p-4 border-b border-zinc-800">
        <NodeHeader icon={Clapperboard} title="Veo Video" className="mb-0" />
      </div>

      <div className="p-4 space-y-4 relative z-50">
        {/* Mode Selector */}
        <div className="relative z-50">
          <NodeLabel>{t('Generation Mode')}</NodeLabel>
          <Select
            value={mode}
            onChange={(v) => {
              const newMode = v as GenerationMode;
              setMode(newMode);
              updateData({ mode: newMode });
            }}
            options={[
              { value: GenerationMode.TEXT_TO_VIDEO, label: t('Text to Video') },
              { value: GenerationMode.FRAMES_TO_VIDEO, label: t('Frames to Video') },
              { value: GenerationMode.EXTEND_VIDEO, label: t('Extend Video') },
              { value: GenerationMode.REFERENCES, label: t('References') },
            ]}
            variant="node"
            disabled={isLoading}
            className="z-[99999]"
          />
        </div>

        {/* Prompt Input */}


        {/* Prompt Input */}
        <div>
          <NodeLabel>{t('Prompt')}</NodeLabel>
          {data.connectedText && (
            <div className="mb-1.5 text-[10px] font-mono text-brand-cyan/70 flex items-center gap-1">
              <span>•</span>
              <span>{t('Connected to TextNode')}</span>
            </div>
          )}
          <PromptInput
            value={prompt}
            onChange={(v) => {
              setPrompt(v);
              debouncedUpdateData({ prompt: v });
            }}
            onSubmit={handleGenerate}
            placeholder={t('Describe your video...')}
            disabled={isLoading}
            textareaRef={textareaRef}
            className="min-h-[80px]"
          />
        </div>

        {/* Connected Inputs Display */}
        {connectedImages.length > 0 && (
          <ConnectedImagesDisplay
            images={connectedImages}
            label={t('Connected Inputs')}
            showLabel
          />
        )}

        {data.connectedVideo && (
          <div className="bg-zinc-900/50 border border-zinc-800 rounded p-2 flex items-center gap-2">
            <VideoIcon size={14} className="text-brand-cyan" />
            <span className="text-xs text-zinc-400">{t('Video Input Connected')}</span>
          </div>
        )}

        {/* Advanced Settings */}
        <div className="border border-zinc-800 rounded-md bg-zinc-900/30">
          <button
            onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
            className="flex items-center gap-2 text-xs font-mono text-zinc-400 hover:text-zinc-200 transition-colors w-full p-2 hover:bg-zinc-800/50"
          >
            <Settings size={12} />
            <span>{t('Advanced Settings')}</span>
            <ChevronRight size={12} className={cn("transition-transform ml-auto", isAdvancedOpen && "rotate-90")} />
          </button>

          {isAdvancedOpen && (
            <div className="p-3 space-y-3 border-t border-zinc-800 bg-zinc-900/50">
              <div>
                <NodeLabel>{t('Model')}</NodeLabel>
                <Select
                  value={model}
                  onChange={(v) => { setModel(v); updateData({ model: v }); }}
                  options={[
                    { value: VeoModel.VEO_3_1, label: 'Veo 3.1' },
                    { value: VeoModel.VEO_3_1_FAST, label: 'Veo 3.1 Fast' },
                  ]}
                  variant="node"
                  disabled={isLoading}
                  className="z-[99999]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <NodeLabel>{t('Aspect Ratio')}</NodeLabel>
                  <AspectRatioSelector
                    value={aspectRatio}
                    onChange={(r) => { setAspectRatio(r); updateData({ aspectRatio: r }); }}
                    disabled={isLoading}
                    compact
                  />
                </div>
                <div>
                  <NodeLabel>{t('Resolution')}</NodeLabel>
                  <ResolutionSelector
                    value={resolution}
                    onChange={(r) => { setResolution(r); updateData({ resolution: r }); }}
                    model={model as any}
                    disabled={isLoading}
                    compact
                  />
                </div>
              </div>

              <div>
                <NodeLabel>{t('Duration')}</NodeLabel>
                <Select
                  value={duration}
                  onChange={(v) => { setDuration(v); updateData({ duration: v }); }}
                  options={[
                    { value: '5s', label: '5 Seconds' },
                    { value: '10s', label: '10 Seconds' },
                  ]}
                  variant="node"
                  disabled={isLoading}
                  className="z-[99999]"
                />
              </div>

              <div className="flex items-center justify-between py-1">
                <NodeLabel className="mb-0">{t('Loop Video')}</NodeLabel>
                <Switch
                  checked={isLooping}
                  onCheckedChange={(c) => { setIsLooping(c); updateData({ isLooping: c }); }}
                  disabled={isLoading}
                />
              </div>

              <div>
                <NodeLabel>{t('Negative Prompt')}</NodeLabel>
                <input
                  className="w-full bg-zinc-900 border border-zinc-700 rounded p-2 text-xs font-mono text-zinc-300 focus:border-[#52ddeb] outline-none placeholder:text-zinc-600"
                  placeholder={t('What to avoid...')}
                  value={negativePrompt}
                  onChange={(e) => {
                    setNegativePrompt(e.target.value);
                    debouncedUpdateData({ negativePrompt: e.target.value });
                  }}
                  disabled={isLoading}
                />
              </div>
            </div>
          )}
        </div>

        {/* Generate Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleGenerate();
          }}
          disabled={isLoading || (!prompt && !data.connectedText && !data.connectedImage1)} // Basic validation
          className={cn(
            'w-full px-3 py-2.5 bg-brand-cyan/20 hover:bg-brand-cyan/30 border border-[#52ddeb]/30 rounded text-xs font-mono text-brand-cyan transition-colors flex items-center justify-center gap-2 group',
            (isLoading || (!prompt && !data.connectedText && !data.connectedImage1)) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
          )}
        >
          {isLoading ? (
            <>
              <GlitchLoader size={16} color="#52ddeb" />
              <span>{t('Generating...')}</span>
            </>
          ) : (
            <>
              <VideoIcon size={16} className="group-hover:scale-110 transition-transform" />
              <span>{t('Generate Video')}</span>
              <span className="text-brand-cyan/50 ml-1">({creditsRequired})</span>
            </>
          )}
        </button>

        {/* Result Preview */}
        {(data.resultVideoUrl || data.resultVideoBase64) && !isLoading && (
          <div className="mt-4 rounded-lg overflow-hidden border border-zinc-700 bg-black relative group shadow-lg">
            <video
              src={data.resultVideoUrl || (data.resultVideoBase64 ? `data:video/mp4;base64,${data.resultVideoBase64}` : undefined)}
              className="w-full h-auto max-h-[200px] object-contain"
              controls
              loop={isLooping}
              onLoadedMetadata={(e) => {
                const video = e.target as HTMLVideoElement;
                if (video.videoWidth > 0 && video.videoHeight > 0) {
                  if (data.onUpdateData) {
                    data.onUpdateData(String(id), {
                      imageWidth: video.videoWidth,
                      imageHeight: video.videoHeight,
                    });
                  }
                }
              }}
            />
          </div>
        )}
      </div>

      {/* Output Handle */}
      <LabeledHandle
        type="source"
        position={Position.Right}
        label={t('Video')}
        handleType="video"
        style={{ top: '50%' }}
      />
    </NodeContainer>
  );
};

export const VideoNode = memo(VideoNodeComponent, (prevProps, nextProps) => {
  // Custom equality check for performance
  const prevData = prevProps.data as VideoNodeData;
  const nextData = nextProps.data as VideoNodeData;

  // Re-render only on relevant prop changes
  if (
    prevData.isLoading !== nextData.isLoading ||
    prevData.prompt !== nextData.prompt ||
    prevData.negativePrompt !== nextData.negativePrompt ||
    prevData.model !== nextData.model ||
    prevData.mode !== nextData.mode ||
    prevData.aspectRatio !== nextData.aspectRatio ||
    prevData.resolution !== nextData.resolution ||
    prevData.isLooping !== nextData.isLooping ||
    prevData.duration !== nextData.duration ||
    prevData.connectedText !== nextData.connectedText ||
    prevData.connectedImage1 !== nextData.connectedImage1 ||
    prevData.connectedImage2 !== nextData.connectedImage2 ||
    prevData.connectedImage3 !== nextData.connectedImage3 ||
    prevData.connectedImage4 !== nextData.connectedImage4 ||
    prevData.connectedVideo !== nextData.connectedVideo ||
    prevData.resultVideoUrl !== nextData.resultVideoUrl ||
    prevData.resultVideoBase64 !== nextData.resultVideoBase64 ||
    prevProps.selected !== nextProps.selected
  ) {
    return false; // Re-render
  }
  return true; // Skip re-render
});
