import React, { useState, useEffect, memo, useRef, useCallback, useMemo } from 'react';
import { Handle, Position, type NodeProps, useReactFlow, NodeResizer, useNodes } from '@xyflow/react';
import { Pickaxe, Image as ImageIcon, Wand2, Save, BookOpen } from 'lucide-react';
import { GlitchLoader } from '@/components/ui/GlitchLoader';
import type { PromptNodeData } from '@/types/reactFlow';
import type { GeminiModel, AspectRatio, Resolution } from '@/types/types';
import { cn } from '@/lib/utils';
import { GEMINI_MODELS, DEFAULT_MODEL, DEFAULT_ASPECT_RATIO, isAdvancedModel as isAdvancedModelFn, getMaxHandles } from '@/constants/geminiModels';
import { PromptInput } from '@/components/PromptInput';
import { ConnectedImagesDisplay } from './ConnectedImagesDisplay';
import { BrandIdentityPanel } from '@/components/ui/BrandIdentityPanel';
import { NodeContainer } from './shared/NodeContainer';
import { NodeInput } from './shared/node-input';
import { NodeLabel } from './shared/node-label';
import { NodeHeader } from './shared/node-header';
import { LabeledHandle } from './shared/LabeledHandle';
import { useTranslation } from '@/hooks/useTranslation';
import { getCreditsRequired } from '@/utils/creditCalculator';
import { useDebouncedCallback } from '@/hooks/useDebouncedCallback';
import { useNodeResize } from '@/hooks/canvas/useNodeResize';
import { PromptContextMenu } from './contextmenu/PromptContextMenu';
import { MockupPresetModal } from '@/components/MockupPresetModal';
import { getPresetByIdSync } from '@/services/unifiedPresetService';
import { NodeButton } from './shared/node-button';
import { ModelSelector } from './shared/ModelSelector';
import { AdvancedModelSettings } from './shared/AdvancedModelSettings';
import { toast } from 'sonner';
import { BrandMediaLibraryModal } from './modals/BrandMediaLibraryModal';
import { useCanvasHeader } from '@/components/canvas/CanvasHeaderContext';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const PromptNode = memo(({ data, selected, id, dragging }: NodeProps<any>) => {
  const { t } = useTranslation();
  const { linkedGuidelineId } = useCanvasHeader();
  const nodes = useNodes();
  const { setNodes, getNode, getZoom } = useReactFlow();
  const nodeData = data as PromptNodeData;
  const { handleResize: handleResizeWithDebounce, fitToContent } = useNodeResize();
  const [prompt, setPrompt] = useState(nodeData.prompt || '');
  const [model, setModel] = useState<GeminiModel>(nodeData.model || DEFAULT_MODEL);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(nodeData.aspectRatio || DEFAULT_ASPECT_RATIO);
  const [resolution, setResolution] = useState<Resolution>(nodeData.resolution || '1K');
  const [connectedImage1, setConnectedImage1] = useState<string | undefined>(nodeData.connectedImage1);
  const [connectedImage2, setConnectedImage2] = useState<string | undefined>(nodeData.connectedImage2);
  const [connectedImage3, setConnectedImage3] = useState<string | undefined>(nodeData.connectedImage3);
  const [connectedImage4, setConnectedImage4] = useState<string | undefined>(nodeData.connectedImage4);
  const [pdfPageReference, setPdfPageReference] = useState<string>(nodeData.pdfPageReference || '');
  const [isBrandActive, setIsBrandActive] = useState<boolean>(nodeData.isBrandActive !== undefined ? nodeData.isBrandActive : (!!(nodeData.connectedLogo || nodeData.connectedIdentity || nodeData.connectedTextDirection)));
  const [showMediaLibrary, setShowMediaLibrary] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Context Menu state
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [isPresetModalOpen, setIsPresetModalOpen] = useState(false);

  // Preset Selection Handler
  const handlePresetSelect = (presetId: string) => {
    const preset = getPresetByIdSync('mockup', presetId);
    if (preset && preset.prompt) {
      setPrompt(preset.prompt);
      debouncedUpdateData({ prompt: preset.prompt });
    }
    setIsPresetModalOpen(false);
  };

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
  const isAdvanced = isAdvancedModelFn(model);
  const finalResolution = isAdvanced ? resolution : undefined;
  const creditsRequired = getCreditsRequired(model, finalResolution);

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
    if (nodeData.pdfPageReference !== undefined) setPdfPageReference(nodeData.pdfPageReference || '');

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
    nodeData.pdfPageReference,
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

  const debouncedUpdateData = useDebouncedCallback((updates: Partial<PromptNodeData>) => {
    if (nodeData.onUpdateData) {
      nodeData.onUpdateData(id, updates);
    }
  }, 500);

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
    setShowMediaLibrary(true);
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

  const handleInsertElement = (text: string) => {
    const textarea = textareaRef.current;

    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newPrompt = prompt.slice(0, start) + ' ' + text + ' ' + prompt.slice(end);

      setPrompt(newPrompt.trim());
      handlePromptChange(newPrompt.trim());

      // Set cursor position after inserted text
      setTimeout(() => {
        const newCursorPos = start + text.length + 2;
        textarea.setSelectionRange(newCursorPos, newCursorPos);
        textarea.focus();
      }, 0);
    } else {
      // Fallback: append to end if textarea not available
      const newPrompt = prompt + (prompt ? ' ' : '') + text;
      setPrompt(newPrompt);
      handlePromptChange(newPrompt);
    }
  };

  const handlePdfPageReferenceChange = (value: string) => {
    setPdfPageReference(value);
    debouncedUpdateData({ pdfPageReference: value || undefined });
  };

  // Debounced fit-to-content: update node size when container content changes
  const debouncedFitToContent = useDebouncedCallback(() => {
    const el = containerRef.current;
    if (!el || !nodeData.onResize) return;
    const w = Math.max(el.scrollWidth, el.offsetWidth);
    const h = Math.max(el.scrollHeight, el.offsetHeight);
    if (w > 0 && h > 0) {
      fitToContent(id, w, h, nodeData.onResize);
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

  // Handle resize from NodeResizer (com debounce - aplica apenas quando soltar o mouse)
  const handleResize = useCallback((width: number, height: number) => {
    handleResizeWithDebounce(id, width, height, nodeData.onResize);
  }, [id, nodeData.onResize, handleResizeWithDebounce]);

  const handleFitToContent = useCallback(() => {
    // For prompt nodes, we set height to auto to let it grow based on prompt length
    fitToContent(id, 'auto', 'auto', nodeData.onResize);
  }, [id, nodeData.onResize, fitToContent]);

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

  return (
    <NodeContainer
      containerRef={containerRef}
      selected={selected}
      dragging={dragging}
      warning={nodeData.oversizedWarning}
      onFitToContent={handleFitToContent}
      className="min-w-[400px]"
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
          minWidth={280}
          minHeight={350}
          maxWidth={2000}
          maxHeight={2000}
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
        style={{ top: '60px' }}
      />

      {/* Image Input Handles - evenly spaced with fixed pixels */}
      {maxHandles >= 1 && (
        <LabeledHandle
          type="target"
          position={Position.Left}
          id="input-1"
          label={`${t('canvasNodes.promptNode.imageInput') || 'Image'} 1`}
          handleType="image"
          style={{ top: maxHandles === 2 ? '140px' : '120px' }}
        />
      )}
      {maxHandles >= 2 && (
        <LabeledHandle
          type="target"
          position={Position.Left}
          id="input-2"
          label={`${t('canvasNodes.promptNode.imageInput') || 'Image'} 2`}
          handleType="image"
          style={{ top: maxHandles === 2 ? '200px' : '180px' }}
        />
      )}
      {maxHandles >= 3 && (
        <LabeledHandle
          type="target"
          position={Position.Left}
          id="input-3"
          label={`${t('canvasNodes.promptNode.imageInput') || 'Image'} 3`}
          handleType="image"
          style={{ top: '240px' }}
        />
      )}
      {maxHandles >= 4 && (
        <LabeledHandle
          type="target"
          position={Position.Left}
          id="input-4"
          label={`${t('canvasNodes.promptNode.imageInput') || 'Image'} 4`}
          handleType="image"
          style={{ top: '300px' }}
        />
      )}

      {/* Header */}
      <NodeHeader 
        icon={Pickaxe} 
        title={t('canvasNodes.promptNode.title')} 
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

      {/* BrandCore Connection Display */}
      {/* HIERARCHY: Logo (priority 1) as primary focus, Identity (priority 2) as context/colors/vibe */}
        <div className={cn("mb-3 space-y-2 transition-all duration-300", !isBrandActive && "opacity-30 grayscale pointer-events-none")}>
          {connectedLogo && (
            <ConnectedImagesDisplay
              images={[connectedLogo]}
              label={t('canvasNodes.promptNode.logoFromBrandCore')}
              showLabel={true}
            />
          )}
          {connectedIdentity && (
            <ConnectedImagesDisplay
              images={[connectedIdentity]}
              label={t('canvasNodes.promptNode.identityFromBrandCore')}
              showLabel={true}
            />
          )}
          {connectedTextDirection && (
            <div className="p-2 rounded border border-[brand-cyan]/30 bg-brand-cyan/5">
              <div className="text-xs font-mono text-brand-cyan mb-1">{t('canvasNodes.promptNode.textDirectionFromBrandCore')}</div>
              <div className="text-xs text-neutral-400 line-clamp-3">{connectedTextDirection}</div>
            </div>
          )}
        </div>

      {/* Brand Identity Panel (legacy support) */}
      {nodeData.connectedBrandIdentity && (
        <>
          <BrandIdentityPanel
            brandIdentity={nodeData.connectedBrandIdentity}
            onInsertElement={handleInsertElement}
          />

          {/* PDF Page Reference Input - Only show if Identity is a PDF */}
          {nodeData.connectedIdentityType === 'pdf' && (
            <div className="mb-3">
              <NodeLabel className="text-[10px] mb-1.5">
                {t('canvasNodes.promptNode.pdfReference')}
              </NodeLabel>
              <NodeInput
                type="text"
                value={pdfPageReference}
                onChange={(e) => handlePdfPageReferenceChange(e.target.value)}
                placeholder={t('canvasNodes.promptNode.pdfReferencePlaceholder')}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          )}
        </>
      )}

      {/* Prompt Input */}
      <div className="node-margin">
        {hasTextNodeConnection && (
          <div className="mb-1.5 text-[10px] font-mono text-brand-cyan/70 flex items-center gap-1">
            <span>•</span>
            <span>{t('canvasNodes.promptNode.connectedToTextNode')}</span>
          </div>
        )}

        {/* Prompt Functions Toolbar */}
        <div className="flex items-center justify-between mb-1.5 px-0.5">
          <div className="flex items-center gap-1.5">
            <NodeButton variant="ghost" size="xs" type="button"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                setIsPresetModalOpen(true);
              }}
              disabled={isLoading}
              className="nodrag nopan"
              title={t('canvasNodes.promptNode.loadPreset') || 'Load Preset'}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <BookOpen size={14} />
            </NodeButton>
          </div>

          <NodeButton variant="ghost" size="xs" type="button"
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              if (nodeData.onSavePrompt) {
                nodeData.onSavePrompt(prompt);
              }
            }}
            disabled={isLoading || !prompt.trim()}
            className="nodrag nopan"
            title={t('canvasNodes.promptNode.savePrompt') || 'Save Prompt'}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <Save size={14} />
          </NodeButton>
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
            <NodeButton variant="ghost" size="xs" type="button"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                if (nodeData.onSuggestPrompts && prompt.trim()) {
                  nodeData.onSuggestPrompts(id, prompt);
                }
              }}
              disabled={isLoading || isSuggestingPrompts || !prompt.trim()}
              className="absolute top-2 right-2 nodrag nopan"
              title={t('canvasNodes.promptNode.suggestPrompts')}
              onMouseDown={(e) => e.stopPropagation()}
            >
              {isSuggestingPrompts ? (
                <GlitchLoader size={14} color="currentColor" />
              ) : (
                <Wand2 size={14} />
              )}
            </NodeButton>
          )}
        </div>

        {/* Prompt Suggestions */}
        {promptSuggestions.length > 0 && (
          <div className="mt-2 space-y-1.5 animate-fade-in">
            <div className="text-[10px] font-mono text-brand-cyan/70 mb-1.5">
              {t('canvasNodes.promptNode.aiSuggestions') || t('canvasNodes.promptNode.suggestions')}
            </div>
            {promptSuggestions.map((suggestion, index) => (
              <NodeButton variant="ghost" size="xs" key={index}
                onClick={(e) => {
                  e.stopPropagation();
                  setPrompt(suggestion);
                  handlePromptChange(suggestion);
                  // Clear suggestions after selection
                  if (nodeData.onUpdateData) {
                    nodeData.onUpdateData(id, { promptSuggestions: [] });
                  }
                }}
                className="w-full text-left font-mono"
                onMouseDown={(e) => e.stopPropagation()}
              >
                {suggestion}
              </NodeButton>
            ))}
          </div>
        )}
      </div>

      {/* Settings Section - Compact */}
      <div className="node-margin space-y-[var(--node-gap)]">
        <ModelSelector
          selectedModel={model}
          onModelChange={(newModel) => {
            setModel(newModel);
            if (nodeData.onUpdateData) {
              nodeData.onUpdateData(id, { model: newModel });
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

        <AdvancedModelSettings
          model={model}
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
      </div>

      {/* Generate Image Button */}
      <NodeButton variant="primary" size="full" onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        handleGenerate();
      }}
        onMouseDown={(e) => {
          e.stopPropagation();
        }}
        disabled={isLoading || !prompt.trim()}
        className="node-interactive"
      >
        {isLoading ? (
          <>
            <GlitchLoader size={14} className="mr-1" color="brand-cyan" />
            <span>{t('canvasNodes.promptNode.generating')}</span>
          </>
        ) : (
          <>
            <ImageIcon size={14} />
            <span>{t('canvasNodes.promptNode.generateImage')}</span>
            <span className="text-brand-cyan/70 ml-2">
              ({creditsRequired} {t('canvasNodes.promptNode.credits')})
            </span>
          </>
        )}
      </NodeButton>

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

      <BrandMediaLibraryModal
        isOpen={showMediaLibrary}
        onClose={() => setShowMediaLibrary(false)}
        onSelectAsset={handleSelectAsset}
        onAddToBoard={handleAddToBoard}
        guidelineId={linkedGuidelineId}
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
