import React, { useState, useEffect, memo, useRef, useCallback } from 'react';
import { Position, type NodeProps, useReactFlow, NodeResizer, useNodes } from '@xyflow/react';
import { Pickaxe, Image as ImageIcon, Wand2, Save, BookOpen, Palette, Diamond, Settings, ChevronRight } from 'lucide-react';
import { SeedControl } from './shared/SeedControl';
import { GlitchLoader } from '@/components/ui/GlitchLoader';
import type { PromptNodeData } from '@/types/reactFlow';
import type { GeminiModel, SeedreamModel, AspectRatio, Resolution } from '@/types/types';
import { cn } from '@/lib/utils';
import { DEFAULT_MODEL, DEFAULT_ASPECT_RATIO, isAdvancedModel as isAdvancedModelFn, getMaxHandles } from '@/constants/geminiModels';
import { isSeedreamModel, getSeedreamModelConfig } from '@/constants/seedreamModels';
import { PromptInput } from '@/components/PromptInput';
import { ConnectedImagesDisplay } from './ConnectedImagesDisplay';
import { NodeContainer } from './shared/NodeContainer';
import { NodeHeader } from './shared/node-header';
import { LabeledHandle } from './shared/LabeledHandle';
import { useTranslation } from '@/hooks/useTranslation';
import { getCreditsRequired } from '@/utils/creditCalculator';
import { useNodeDataUpdater } from '@/hooks/canvas/useNodeDataUpdater';
import { useDebouncedCallback } from '@/hooks/useDebouncedCallback';
import { useNodeResize } from '@/hooks/canvas/useNodeResize';
import { PromptContextMenu } from './contextmenu/PromptContextMenu';
import { MockupPresetModal } from '@/components/MockupPresetModal';
import { getPresetByIdSync } from '@/services/unifiedPresetService';
import { NodeButton } from './shared/node-button';
import { ModelSelector } from '../shared/ModelSelector';
import { AdvancedModelSettings } from './shared/AdvancedModelSettings';
import { toast } from 'sonner';
import { useBrandKit } from '@/contexts/BrandKitContext';

import { Tooltip } from '@/components/ui/Tooltip';
import { GEMINI_MODELS } from '@/constants/geminiModels';
import { NODE_LAYOUT } from '@/constants/nodeLayout';
import { useBaseNode } from '@/hooks/canvas/useBaseNode';
import { motion, AnimatePresence } from 'framer-motion';
import type { Connection } from '@xyflow/react';


// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const PromptNode = memo(({ data, selected, id, dragging }: NodeProps<any>) => {
  const { t } = useTranslation();

  const nodes = useNodes();
  const { setNodes, getNode, getZoom } = useReactFlow();
  const nodeData = data as PromptNodeData;
  const { handleResize: baseResize, handleFitToContent: baseFitToContent } = useBaseNode(id, nodeData);
  const [prompt, setPrompt] = useState(nodeData.prompt || '');
  const [model, setModel] = useState<GeminiModel | SeedreamModel>(nodeData.model || GEMINI_MODELS.IMAGE_NB2);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(nodeData.aspectRatio || DEFAULT_ASPECT_RATIO);
  const [resolution, setResolution] = useState<Resolution>(nodeData.resolution || '2K');
  const [connectedImage1, setConnectedImage1] = useState<string | undefined>(nodeData.connectedImage1);
  const [connectedImage2, setConnectedImage2] = useState<string | undefined>(nodeData.connectedImage2);
  const [connectedImage3, setConnectedImage3] = useState<string | undefined>(nodeData.connectedImage3);
  const [connectedImage4, setConnectedImage4] = useState<string | undefined>(nodeData.connectedImage4);
  const [isBrandActive, setIsBrandActive] = useState<boolean>(nodeData.isBrandActive !== undefined ? nodeData.isBrandActive : (!!(nodeData.connectedLogo || nodeData.connectedIdentity || nodeData.connectedTextDirection)));
  const { openLibrary } = useBrandKit();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Context Menu state
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [isPresetModalOpen, setIsPresetModalOpen] = useState(false);

  const { debouncedUpdate: debouncedUpdateData } = useNodeDataUpdater<PromptNodeData>(nodeData.onUpdateData, id);

  // Preset Selection Handler
  const handlePresetSelect = useCallback((presetId: string) => {
    const preset = getPresetByIdSync('mockup', presetId);
    if (preset && preset.prompt) {
      setPrompt(preset.prompt);
      debouncedUpdateData({ prompt: preset.prompt });
    }
    setIsPresetModalOpen(false);
  }, [debouncedUpdateData]);

  // BrandCore connection data
  const connectedLogo = nodeData.connectedLogo;
  const connectedIdentity = nodeData.connectedIdentity;
  const connectedTextDirection = nodeData.connectedTextDirection;
  const hasBrandCoreConnection = !!(connectedLogo || connectedIdentity || connectedTextDirection);

  // TextNode connection - sync in real-time
  const connectedText = nodeData.connectedText;
  const hasTextNodeConnection = connectedText !== undefined;

  const isLoading = nodeData.isLoading || false;
  const isSuggestingPrompts = nodeData.isSuggestingPrompts || false;
  const promptSuggestions = nodeData.promptSuggestions || [];
  const isSeedream = isSeedreamModel(model);
  const isAdvanced = !isSeedream && isAdvancedModelFn(model as GeminiModel);
  // For Seedream: pass resolution directly (credit differs by resolution). For Gemini: only advanced models use it.
  const effectiveResolution = isSeedream ? resolution : (isAdvanced ? resolution : undefined);
  const provider = isSeedream ? 'seedream' as const : 'gemini' as const;
  const creditsRequired = getCreditsRequired(model, effectiveResolution, provider);

  // Determine number of handles based on model
  const maxHandles = getMaxHandles(model);

  // Get all connected images up to max handles
  // BrandCore images are displayed separately, so only include legacy connected images here
  const brandCoreImages = [connectedLogo, connectedIdentity].filter(Boolean);
  const legacyImages = [
    connectedImage1,
    connectedImage2,
    connectedImage3,
    connectedImage4,
  ].filter(img => img && !brandCoreImages.includes(img)).slice(0, maxHandles);

  // Only legacy images in the main display (BrandCore images shown separately)
  const allConnectedImages = legacyImages;

  const hasConnectedImages = allConnectedImages.some(img => !!img) || hasBrandCoreConnection;

  // Sync all node data into local state in a consolidated effect
  useEffect(() => {
    if (hasTextNodeConnection && connectedText !== undefined) {
      setPrompt(connectedText);
    } else if (nodeData.prompt !== undefined) {
      setPrompt(nodeData.prompt);
    }

    if (nodeData.model) setModel(nodeData.model);
    if (nodeData.aspectRatio) setAspectRatio(nodeData.aspectRatio);
    if (nodeData.resolution) setResolution(nodeData.resolution);

    // Track connected images for manual UI refreshes if needed
    setConnectedImage1(nodeData.connectedImage1);
    setConnectedImage2(nodeData.connectedImage2);
    setConnectedImage3(nodeData.connectedImage3);
    setConnectedImage4(nodeData.connectedImage4);
    if (nodeData.isBrandActive !== undefined) setIsBrandActive(nodeData.isBrandActive);
  }, [
    nodeData.prompt,
    nodeData.model,
    nodeData.aspectRatio,
    nodeData.resolution,
    nodeData.connectedImage1,
    nodeData.connectedImage2,
    nodeData.connectedImage3,
    nodeData.connectedImage4,
    nodeData.isBrandActive,
    connectedText,
    hasTextNodeConnection
  ]);

  // Sync BrandCore connection data
  useEffect(() => {
    // BrandCore data is read directly from nodeData in handleGenerate
    // No local state needed, but we can trigger re-render if needed
  }, [nodeData.connectedLogo, nodeData.connectedIdentity, nodeData.connectedTextDirection]);

  const handleAddToBoard = (url: string, type: 'image' | 'logo') => {
    const newNodeId = `image-${Date.now()}`;
    // Position it slightly to the right of the current node
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
  };

  const handleSelectAsset = (url: string, type: 'image' | 'logo') => {
    const updates: Partial<PromptNodeData> = {};
    let slotFound = false;

    if (!connectedImage1) {
      updates.connectedImage1 = url;
      slotFound = true;
    } else if (!connectedImage2) {
      updates.connectedImage2 = url;
      slotFound = true;
    } else if (isAdvanced && !connectedImage3 && maxHandles >= 3) {
      updates.connectedImage3 = url;
      slotFound = true;
    } else if (isAdvanced && !connectedImage4 && maxHandles >= 4) {
      updates.connectedImage4 = url;
      slotFound = true;
    }

    if (slotFound) {
      if (nodeData.onUpdateData) {
        nodeData.onUpdateData(id, updates);
      }
    } else {
      toast.warning("All available reference slots are full. Added to board instead.");
      handleAddToBoard(url, type);
    }
  };

  const handleOpenMediaLibrary = () => {
    openLibrary({ onSelectAsset: handleSelectAsset, onAddToBoard: handleAddToBoard });
  };

  const handlePromptChange = (value: string) => {
    setPrompt(value);
    debouncedUpdateData({ prompt: value });
  };

  const handleGenerate = async () => {
    if (!nodeData.onGenerate || !prompt.trim()) {
      return;
    }

    // Update model, aspectRatio, and resolution in node data if changed
    if (nodeData.onUpdateData) {
      const updates: Partial<PromptNodeData> = {};
      if (model !== nodeData.model) updates.model = model;
      if (isAdvanced && aspectRatio !== nodeData.aspectRatio) updates.aspectRatio = aspectRatio;
      if (isAdvanced && resolution !== nodeData.resolution) updates.resolution = resolution;

      if (Object.keys(updates).length > 0) {
        nodeData.onUpdateData(id, updates);
      }
    }

    // HIERARCHY: Logo (priority 1) as first image, Identity (priority 2) as second image for context
    // Then legacy connected images
    const connectedImages: string[] = [];
    const maxImages = getMaxHandles(model);

    // Add Logo first (primary focus)
    if (isBrandActive && nodeData.connectedLogo) {
      connectedImages.push(nodeData.connectedLogo);
    }

    // Add Identity second (context/colors/vibe)
    if (isBrandActive && nodeData.connectedIdentity) {
      connectedImages.push(nodeData.connectedIdentity);
    }

    // Add legacy connected images (avoid duplicates)
    const brandCoreImages = [nodeData.connectedLogo, nodeData.connectedIdentity].filter(Boolean);
    if (nodeData.connectedImage1 && !brandCoreImages.includes(nodeData.connectedImage1)) {
      connectedImages.push(nodeData.connectedImage1);
    }
    if (nodeData.connectedImage2 && !brandCoreImages.includes(nodeData.connectedImage2)) {
      connectedImages.push(nodeData.connectedImage2);
    }
    if (isAdvancedModelFn(model)) {
      if (nodeData.connectedImage3 && !brandCoreImages.includes(nodeData.connectedImage3)) {
        connectedImages.push(nodeData.connectedImage3);
      }
      if (nodeData.connectedImage4 && !brandCoreImages.includes(nodeData.connectedImage4)) {
        connectedImages.push(nodeData.connectedImage4);
      }
    }

    // Limit to max images for the model
    const limitedImages = connectedImages.slice(0, maxImages);

    // Combine text direction with prompt if available and active
    const finalPrompt = (isBrandActive && nodeData.connectedTextDirection)
      ? (prompt ? `${nodeData.connectedTextDirection}\n\n${prompt}` : nodeData.connectedTextDirection)
      : prompt;

    await nodeData.onGenerate(id, finalPrompt.trim(), limitedImages.length > 0 ? limitedImages : undefined, model);
  };


  const handleImageClick = (index: number) => {
    const imageReference = `{image ${String(index + 1).padStart(2, '0')}}`;
    const textarea = textareaRef.current;

    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newPrompt = prompt.slice(0, start) + imageReference + prompt.slice(end);

      setPrompt(newPrompt);
      handlePromptChange(newPrompt);

      // Set cursor position after inserted text
      setTimeout(() => {
        const newCursorPos = start + imageReference.length;
        textarea.setSelectionRange(newCursorPos, newCursorPos);
        textarea.focus();
      }, 0);
    } else {
      // Fallback: append to end if textarea not available
      const newPrompt = prompt + (prompt ? ' ' : '') + imageReference;
      setPrompt(newPrompt);
      handlePromptChange(newPrompt);
    }
  };

  const handleImageRemove = (index: number) => {
    const handleMap: Record<number, 'input-1' | 'input-2' | 'input-3' | 'input-4'> = {
      0: 'input-1',
      1: 'input-2',
      2: 'input-3',
      3: 'input-4',
    };

    const targetHandle = handleMap[index];
    if (!targetHandle) return;

    // Remove the edge if onRemoveEdge is available
    if (nodeData.onRemoveEdge) {
      nodeData.onRemoveEdge(id, targetHandle);
    }

    // Clear the connected image data
    if (nodeData.onUpdateData) {
      const updates: Partial<PromptNodeData> = {};
      if (index === 0) updates.connectedImage1 = undefined;
      else if (index === 1) updates.connectedImage2 = undefined;
      else if (index === 2) updates.connectedImage3 = undefined;
      else if (index === 3) updates.connectedImage4 = undefined;
      nodeData.onUpdateData(id, updates);
    }
  };

  // Debounced fit-to-content: update node size when container content changes
  const debouncedFitToContent = useDebouncedCallback(() => {
    const el = containerRef.current;
    if (!el || !nodeData.onResize) return;
    const w = Math.max(el.scrollWidth, el.offsetWidth);
    const h = Math.max(el.scrollHeight, el.offsetHeight);
    if (w > 0 && h > 0) {
      baseFitToContent(w, h);
    }
  }, 150);

  // ResizeObserver: auto-fit node when prompt text grows or aspect ratio section toggles
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => debouncedFitToContent());
    ro.observe(el);
    debouncedFitToContent();
    return () => ro.disconnect();
  }, [id, debouncedFitToContent]);

  // Handle resize from NodeResizer
  const handleResize = useCallback((width: number, height: number) => {
    baseResize(width, height);
  }, [baseResize]);

  const handleFitToContent = useCallback(() => {
    baseFitToContent();
  }, [baseFitToContent]);

  const handleDuplicate = () => {
    // ReactFlow handle duplication through the internal state
    // but we can trigger it via a helper if available or by creating a new node
    // Simple way: if nodeData has onDuplicate, use it
    if (nodeData.onDuplicate) {
      nodeData.onDuplicate(id);
    }
  };

  const handleDelete = () => {
    if (nodeData.onDelete) {
      nodeData.onDelete(id);
    } else {
      setNodes((nodes) => nodes.filter((node) => node.id !== id));
    }
  };

  // Connection validation logic
  const isValidConnection = useCallback((connection: Connection) => {
    // Prevent self-connections
    if (connection.source === connection.target) return false;

    const sourceNode = nodes.find(n => n.id === connection.source);
    if (!sourceNode) return false;

    const targetHandle = connection.targetHandle;
    
    // Check for text input handle
    if (targetHandle === 'text-input') {
      // Only Text nodes can connect to text input
      return sourceNode.type === 'text';
    }

    // Check for image input handles
    if (targetHandle?.startsWith('input-')) {
      // Valid image sources
      const validImageNodes = ['image', 'prompt', 'logo', 'video', 'merge', 'upscale', 'shader', 'color-extractor'];
      return validImageNodes.includes(sourceNode.type || '');
    }

    return true;
  }, [nodes]);

  return (
    <NodeContainer
      containerRef={containerRef}
      selected={selected}
      dragging={dragging}
      warning={nodeData.oversizedWarning}
      onFitToContent={handleFitToContent}
      className={cn(`min-w-[${NODE_LAYOUT.PROMPT_NODE_WIDTH}px]`)}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setContextMenu({ x: e.clientX, y: e.clientY });
      }}
    >
      {selected && !dragging && (
        <NodeResizer
          color="brand-cyan"
          isVisible={selected}
          minWidth={NODE_LAYOUT.MIN_WIDTH}
          minHeight={NODE_LAYOUT.MIN_HEIGHT}
          maxWidth={NODE_LAYOUT.MAX_WIDTH}
          maxHeight={NODE_LAYOUT.MAX_HEIGHT}
          onResize={(_, { width, height }) => {
            handleResize(width, height);
          }}
        />
      )}

      {/* Text Input Handle - accepts TextNode connections */}
      <LabeledHandle
        type="target"
        position={Position.Left}
        id="text-input"
        label={t('canvasNodes.promptNode.textInput') || 'Text'}
        className="handle-text-inverted"
        handleType="text"
        style={{ top: `${NODE_LAYOUT.HANDLE_START_TOP}px` }}
        isValidConnection={isValidConnection}
      />

      {/* Image Input Handles - evenly spaced using constants */}
      {maxHandles >= 1 && (
        <LabeledHandle
          type="target"
          position={Position.Left}
          id="input-1"
          label={`${t('canvasNodes.promptNode.imageInput') || 'Image'} 1`}
          handleType="image"
          style={{ top: `${NODE_LAYOUT.HANDLE_START_TOP + NODE_LAYOUT.HANDLE_SPACING}px` }}
          isValidConnection={isValidConnection}
        />
      )}
      {maxHandles >= 2 && (
        <LabeledHandle
          type="target"
          position={Position.Left}
          id="input-2"
          label={`${t('canvasNodes.promptNode.imageInput') || 'Image'} 2`}
          handleType="image"
          style={{ top: `${NODE_LAYOUT.HANDLE_START_TOP + NODE_LAYOUT.HANDLE_SPACING * 2}px` }}
          isValidConnection={isValidConnection}
        />
      )}
      {maxHandles >= 3 && (
        <LabeledHandle
          type="target"
          position={Position.Left}
          id="input-3"
          label={`${t('canvasNodes.promptNode.imageInput') || 'Image'} 3`}
          handleType="image"
          style={{ top: `${NODE_LAYOUT.HANDLE_START_TOP + NODE_LAYOUT.HANDLE_SPACING * 3}px` }}
          isValidConnection={isValidConnection}
        />
      )}
      {maxHandles >= 4 && (
        <LabeledHandle
          type="target"
          position={Position.Left}
          id="input-4"
          label={`${t('canvasNodes.promptNode.imageInput') || 'Image'} 4`}
          handleType="image"
          style={{ top: `${NODE_LAYOUT.HANDLE_START_TOP + NODE_LAYOUT.HANDLE_SPACING * 4}px` }}
          isValidConnection={isValidConnection}
        />
      )}

      {/* Header */}
      <NodeHeader 
        icon={Pickaxe} 
        title={t('canvasNodes.promptNode.title')} 
        selected={selected}
        isBrandActive={isBrandActive}
        onToggleBrand={(active) => {
          setIsBrandActive(active);
          if (nodeData.onUpdateData) nodeData.onUpdateData(id, { isBrandActive: active });
        }}
        onOpenMediaLibrary={handleOpenMediaLibrary}
      />

      {/* Connected Images Thumbnails - unified component */}
      <ConnectedImagesDisplay
        images={allConnectedImages}
        label={t('canvasNodes.promptNode.referenceImages')}
        showLabel={hasConnectedImages}
        maxThumbnails={maxHandles}
        onImageClick={handleImageClick}
        onImageRemove={handleImageRemove}
      />

      {/* BrandCore Connection Indicator - compact, non-intrusive */}
      {hasBrandCoreConnection && (
        <div className="node-margin">
          <Tooltip content={isBrandActive ? "Brand assets will be used in generation" : "Brand assets connected but inactive"}>
            <div className={cn(
              "flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-[10px] font-mono transition-all duration-300",
              isBrandActive
                ? "bg-foreground/10 border-foreground/30 text-foreground shadow-[0_0_15px_rgba(255,255,255,0.05)]"
                : "bg-neutral-900/40 border-neutral-800/40 text-neutral-400 opacity-80"
            )}>
              <div className="relative flex items-center justify-center shrink-0">
                <Palette size={10} className={cn(isBrandActive ? "text-brand-cyan" : "text-neutral-600", "transition-colors")} />
                {isBrandActive && (
                  <div className="absolute -inset-0.5 rounded-full bg-brand-cyan/20 animate-ping pointer-events-none" />
                )}
              </div>
              <span className="text-[9px] uppercase tracking-wider font-bold">
                {t('canvasNodes.promptNode.brandConnected') || 'Brand Guidelines'}
              </span>
              <div className="flex items-center gap-1.5 ml-auto">
                {connectedLogo && <span className="px-1.5 py-0.5 bg-black/20 rounded border border-white/5 text-[8px]">LOGO</span>}
                {connectedIdentity && <span className="px-1.5 py-0.5 bg-black/20 rounded border border-white/5 text-[8px]">IDENTITY</span>}
              </div>
            </div>
          </Tooltip>
        </div>
      )}

      {/* Prompt Input */}
      <div className="node-margin">
        {hasTextNodeConnection && (
          <div className="mb-1.5 text-[10px] font-mono text-foreground/80 flex items-center gap-1">
            <span>•</span>
            <span>{t('canvasNodes.promptNode.connectedToTextNode')}</span>
          </div>
        )}

        {/* Prompt Functions Toolbar */}
        <div className="flex items-center justify-between mb-1.5 px-0.5">
          <div className="flex items-center gap-1.5">
            <Tooltip content={t('canvasNodes.promptNode.loadPreset') || 'Load Preset'}>
              <NodeButton variant="ghost" size="xs" type="button"
                onClick={(e) => {
                  setIsPresetModalOpen(true);
                }}
                disabled={isLoading}
                className="nodrag nopan hover:text-brand-cyan transition-colors"
              >
                <BookOpen size={14} />
              </NodeButton>
            </Tooltip>
          </div>

          <Tooltip content={t('canvasNodes.promptNode.savePrompt') || 'Save Prompt'}>
            <NodeButton variant="ghost" size="xs" type="button"
              onClick={() => {
                if (nodeData.onSavePrompt) {
                  nodeData.onSavePrompt(prompt);
                }
              }}
              disabled={isLoading || !prompt.trim()}
              className="nodrag nopan hover:text-brand-cyan transition-colors"
            >
              <Save size={14} />
            </NodeButton>
          </Tooltip>
        </div>

        <div className="relative">
          <PromptInput
            value={prompt}
            onChange={handlePromptChange}
            onSubmit={handleGenerate}
            placeholder={t('canvasNodes.promptNode.promptPlaceholder')}
            disabled={isLoading || hasTextNodeConnection}
            className="w-full"
            textareaRef={textareaRef}
          />
          {/* Prompt Suggestion Button */}
          {!hasTextNodeConnection && prompt.trim() && (
            <Tooltip content={t('canvasNodes.promptNode.suggestPrompts') || 'Suggest AI Prompts'}>
              <NodeButton variant="ghost" size="xs" type="button"
                onClick={(e) => {
                  e.preventDefault();
                  if (nodeData.onSuggestPrompts && prompt.trim()) {
                    nodeData.onSuggestPrompts(id, prompt);
                  }
                }}
                disabled={isLoading || isSuggestingPrompts || !prompt.trim()}
                className="absolute top-2 right-2 nodrag nopan text-foreground hover:bg-brand-cyan/10 hover:text-brand-cyan transition-colors"
              >
                {isSuggestingPrompts ? (
                  <GlitchLoader size={14} color="currentColor" />
                ) : (
                  <Wand2 size={14} />
                )}
              </NodeButton>
            </Tooltip>
          )}
        </div>

        {/* Prompt Suggestions */}
        <AnimatePresence>
          {promptSuggestions.length > 0 && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="mt-2 space-y-1.5 overflow-hidden"
            >
              <div className="text-[10px] font-mono text-foreground/80 mb-1.5 flex items-center gap-2">
                <Diamond size={10} />
                {t('canvasNodes.promptNode.aiSuggestions') || t('canvasNodes.promptNode.suggestions')}
              </div>
              {promptSuggestions.map((suggestion, index) => (
                <NodeButton variant="ghost" size="xs" key={index}
                  onClick={(e) => {
                    setPrompt(suggestion);
                    handlePromptChange(suggestion);
                    // Clear suggestions after selection
                    if (nodeData.onUpdateData) {
                      nodeData.onUpdateData(id, { promptSuggestions: [] });
                    }
                  }}
                  className="w-full text-left font-mono border border-foreground/10 hover:border-brand-cyan/20 hover:bg-brand-cyan/5 hover:text-brand-cyan transition-colors"
                >
                  <span className="truncate">{suggestion}</span>
                </NodeButton>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Settings Section - Compact */}
      <div className="node-margin space-y-[var(--node-gap)]">
        <ModelSelector
          type="image"
          variant="node"
          selectedModel={model}
          onModelChange={(newModel, provider) => {
            setModel(newModel);
            if (nodeData.onUpdateData) {
              nodeData.onUpdateData(id, { model: newModel, provider });
            }
          }}
          resolution={resolution}
          disabled={isLoading}
          onSyncResolution={(res) => {
            setResolution(res);
            if (nodeData.onUpdateData) nodeData.onUpdateData(id, { resolution: res });
          }}
          onClearAdvancedConfig={() => {
            if (nodeData.onUpdateData) {
              nodeData.onUpdateData(id, {
                resolution: undefined,
                aspectRatio: undefined,
                connectedImage3: undefined,
                connectedImage4: undefined
              });
            }
          }}
        />

        {/* Advanced Options Accordion */}
        <div className="border border-neutral-800 rounded-md bg-neutral-900/30">
          <NodeButton
            variant="ghost"
            size="sm"
            onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
            className="text-xs font-mono text-neutral-400 hover:text-neutral-200 w-full p-2 hover:bg-neutral-800/50"
          >
            <Settings size={12} />
            <span>Advanced Settings</span>
            <ChevronRight
              size={12}
              className={cn('transition-transform ml-auto', isAdvancedOpen && 'rotate-90')}
            />
          </NodeButton>

          {isAdvancedOpen && (
            <div className="p-3 space-y-3 border-t border-neutral-800 bg-neutral-900/50">
              {!isSeedream && (
                <AdvancedModelSettings
                  model={model as GeminiModel}
                  aspectRatio={aspectRatio}
                  resolution={resolution}
                  onAspectRatioChange={(ratio) => {
                    setAspectRatio(ratio);
                    if (nodeData.onUpdateData) nodeData.onUpdateData(id, { aspectRatio: ratio });
                  }}
                  onResolutionChange={(res) => {
                    setResolution(res);
                    if (nodeData.onUpdateData) nodeData.onUpdateData(id, { resolution: res });
                  }}
                  onModelChange={(newModel) => {
                    setModel(newModel);
                    if (nodeData.onUpdateData) nodeData.onUpdateData(id, { model: newModel });
                  }}
                  isLoading={isLoading}
                  allowVideo={true}
                />
              )}

              <SeedControl
                seed={nodeData.seed}
                seedLocked={nodeData.seedLocked}
                onSeedChange={(seed) => {
                  if (nodeData.onUpdateData) nodeData.onUpdateData(id, { seed });
                }}
                onSeedLockedChange={(locked) => {
                  if (nodeData.onUpdateData) nodeData.onUpdateData(id, { seedLocked: locked });
                }}
                disabled={isLoading}
              />
            </div>
          )}
        </div>
      </div>



      {/* Generate Image Button */}
      <Tooltip 
        content={`${t('canvasNodes.promptNode.creditsRequired') || 'Costs'} ${creditsRequired} ${t('canvasNodes.promptNode.credits')}`}
        delay={500}
      >
        <NodeButton variant="primary" size="full" onClick={(e) => {
          handleGenerate();
        }}
          disabled={isLoading || !prompt.trim()}
          className="node-interactive group/gen"
        >
          {isLoading ? (
            <div className="flex items-center justify-center gap-2">
              <GlitchLoader size={14} color="brand-cyan" />
              <span>{t('canvasNodes.promptNode.generating')}...</span>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2">
              <ImageIcon size={14} className="group-hover/gen:rotate-12 transition-transform" />
              <span className="font-semibold tracking-tight">{t('canvasNodes.promptNode.generateImage')}</span>
              <div className="flex items-center gap-1 ml-1 px-1.5 py-0.5 rounded-full bg-black/20 text-[10px] text-foreground">
                <Diamond size={10} className="opacity-70 fill-current" />
                {creditsRequired}
              </div>
            </div>
          )}
        </NodeButton>
      </Tooltip>

      {/* Output Handle */}
      <LabeledHandle
        type="source"
        position={Position.Right}
        label={t('canvasNodes.promptNode.output')}
        handleType="image"
        style={{ top: '50%' }}
      />

      {/* Context Menu */}
      {
        contextMenu && (
          <PromptContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            onClose={() => setContextMenu(null)}
            onDuplicate={handleDuplicate}
            onDelete={handleDelete}
            onSavePrompt={() => {
              if (nodeData.onSavePrompt) {
                nodeData.onSavePrompt(prompt);
              }
            }}
          />
        )
      }

      <MockupPresetModal
        isOpen={isPresetModalOpen}
        selectedPresetId=""
        onClose={() => setIsPresetModalOpen(false)}
        onSelectPreset={handlePresetSelect}
      />

    </NodeContainer >
  );
}, (prevProps, nextProps) => {
  // Custom comparison - re-render if connected images change
  const prevData = prevProps.data as PromptNodeData;
  const nextData = nextProps.data as PromptNodeData;

  // Normalize undefined/null values for proper comparison
  const prevImage1 = prevData.connectedImage1 ?? undefined;
  const nextImage1 = nextData.connectedImage1 ?? undefined;
  const prevImage2 = prevData.connectedImage2 ?? undefined;
  const nextImage2 = nextData.connectedImage2 ?? undefined;
  const prevImage3 = prevData.connectedImage3 ?? undefined;
  const nextImage3 = nextData.connectedImage3 ?? undefined;
  const prevImage4 = prevData.connectedImage4 ?? undefined;
  const nextImage4 = nextData.connectedImage4 ?? undefined;

  // Normalize BrandCore connection data for comparison
  const prevLogo = prevData.connectedLogo ?? undefined;
  const nextLogo = nextData.connectedLogo ?? undefined;
  const prevId = prevData.connectedIdentity ?? undefined;
  const nextId = nextData.connectedIdentity ?? undefined;
  const prevText = prevData.connectedTextDirection ?? undefined;
  const nextText = nextData.connectedTextDirection ?? undefined;

  return (
    prevProps.selected === nextProps.selected &&
    prevData.prompt === nextData.prompt &&
    prevData.isLoading === nextData.isLoading &&
    prevData.model === nextData.model &&
    prevData.aspectRatio === nextData.aspectRatio &&
    prevData.resolution === nextData.resolution &&
    prevData.isSuggestingPrompts === nextData.isSuggestingPrompts &&
    prevData.connectedText === nextData.connectedText &&
    prevData.isBrandActive === nextData.isBrandActive &&
    prevImage1 === nextImage1 &&
    prevImage2 === nextImage2 &&
    prevImage3 === nextImage3 &&
    prevImage4 === nextImage4 &&
    prevLogo === nextLogo &&
    prevId === nextId &&
    prevText === nextText
  );
});
