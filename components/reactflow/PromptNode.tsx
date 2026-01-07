import React, { useState, useEffect, memo, useRef, useCallback } from 'react';
import { Handle, Position, type NodeProps, useReactFlow, NodeResizer } from '@xyflow/react';
import { Pickaxe, Image as ImageIcon, Wand2, Save, BookOpen } from 'lucide-react';
import { GlitchLoader } from '../ui/GlitchLoader';
import type { PromptNodeData } from '../../types/reactFlow';
import type { GeminiModel, AspectRatio, Resolution } from '../../types';
import { cn } from '../../lib/utils';
import { PromptInput } from '../PromptInput';
import { ConnectedImagesDisplay } from './ConnectedImagesDisplay';
import { BrandIdentityPanel } from '../ui/BrandIdentityPanel';
import { NodeContainer } from './shared/NodeContainer';
import { Select } from '../ui/select';
import { NodeInput } from './shared/node-input';
import { NodeLabel } from './shared/node-label';
import { NodeHeader } from './shared/node-header';
import { LabeledHandle } from './shared/LabeledHandle';
import { AspectRatioSelector } from './shared/AspectRatioSelector';
import { ResolutionSelector } from './shared/ResolutionSelector';
import { useTranslation } from '../../hooks/useTranslation';
import { getCreditsRequired } from '../../utils/creditCalculator';
import { useDebouncedCallback } from '../../hooks/useDebouncedCallback';
import { useNodeResize } from '../../hooks/canvas/useNodeResize';
import { PromptContextMenu } from './contextmenu/PromptContextMenu';
import { MockupPresetModal } from '../MockupPresetModal';
import { getPresetByIdSync } from '../../services/unifiedPresetService';


// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const PromptNode = memo(({ data, selected, id, dragging }: NodeProps<any>) => {
  const { t } = useTranslation();
  const { setNodes, getNode, getZoom } = useReactFlow();
  const nodeData = data as PromptNodeData;
  const { handleResize: handleResizeWithDebounce, fitToContent } = useNodeResize();
  const [prompt, setPrompt] = useState(nodeData.prompt || '');
  const [model, setModel] = useState<GeminiModel>(nodeData.model || 'gemini-2.5-flash-image');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(nodeData.aspectRatio || '16:9');
  const [resolution, setResolution] = useState<Resolution>(nodeData.resolution || '1K');
  const [connectedImage1, setConnectedImage1] = useState<string | undefined>(nodeData.connectedImage1);
  const [connectedImage2, setConnectedImage2] = useState<string | undefined>(nodeData.connectedImage2);
  const [connectedImage3, setConnectedImage3] = useState<string | undefined>(nodeData.connectedImage3);
  const [connectedImage4, setConnectedImage4] = useState<string | undefined>(nodeData.connectedImage4);
  const [pdfPageReference, setPdfPageReference] = useState<string>(nodeData.pdfPageReference || '');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
  const isProModel = model === 'gemini-3-pro-image-preview';
  const finalResolution = isProModel ? resolution : undefined;
  const creditsRequired = getCreditsRequired(model, finalResolution);

  // Determine number of handles based on model
  const maxHandles = model === 'gemini-3-pro-image-preview' ? 4 : 2;

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

  // Sync prompt and model with data
  // If connectedText exists, use it for real-time sync from TextNode
  useEffect(() => {
    if (hasTextNodeConnection && connectedText !== undefined) {
      // Real-time sync from connected TextNode
      setPrompt(connectedText);
    } else if (nodeData.prompt !== undefined) {
      // Manual prompt or disconnected state
      setPrompt(nodeData.prompt);
    }
  }, [nodeData.prompt, connectedText, hasTextNodeConnection]);

  useEffect(() => {
    if (nodeData.model) {
      setModel(nodeData.model);
    }
  }, [nodeData.model]);

  useEffect(() => {
    if (nodeData.aspectRatio) {
      setAspectRatio(nodeData.aspectRatio);
    }
  }, [nodeData.aspectRatio]);

  useEffect(() => {
    if (nodeData.resolution) {
      setResolution(nodeData.resolution);
    }
  }, [nodeData.resolution]);

  // Sync connected images with data - force re-render when images change
  useEffect(() => {
    setConnectedImage1(nodeData.connectedImage1);
  }, [nodeData.connectedImage1]);

  useEffect(() => {
    setConnectedImage2(nodeData.connectedImage2);
  }, [nodeData.connectedImage2]);

  useEffect(() => {
    setConnectedImage3(nodeData.connectedImage3);
  }, [nodeData.connectedImage3]);

  useEffect(() => {
    setConnectedImage4(nodeData.connectedImage4);
  }, [nodeData.connectedImage4]);

  useEffect(() => {
    setPdfPageReference(nodeData.pdfPageReference || '');
  }, [nodeData.pdfPageReference]);

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
      if (isProModel && aspectRatio !== nodeData.aspectRatio) updates.aspectRatio = aspectRatio;
      if (isProModel && resolution !== nodeData.resolution) updates.resolution = resolution;

      if (Object.keys(updates).length > 0) {
        nodeData.onUpdateData(id, updates);
      }
    }

    // HIERARCHY: Logo (priority 1) as first image, Identity (priority 2) as second image for context
    // Then legacy connected images
    const connectedImages: string[] = [];
    const maxImages = model === 'gemini-3-pro-image-preview' ? 4 : 2;

    // Add Logo first (primary focus)
    if (nodeData.connectedLogo) {
      connectedImages.push(nodeData.connectedLogo);
    }

    // Add Identity second (context/colors/vibe)
    if (nodeData.connectedIdentity) {
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
    if (model === 'gemini-3-pro-image-preview') {
      if (nodeData.connectedImage3 && !brandCoreImages.includes(nodeData.connectedImage3)) {
        connectedImages.push(nodeData.connectedImage3);
      }
      if (nodeData.connectedImage4 && !brandCoreImages.includes(nodeData.connectedImage4)) {
        connectedImages.push(nodeData.connectedImage4);
      }
    }

    // Limit to max images for the model
    const limitedImages = connectedImages.slice(0, maxImages);

    // Combine text direction with prompt if available
    const finalPrompt = nodeData.connectedTextDirection
      ? (prompt ? `${nodeData.connectedTextDirection}\n\n${prompt}` : nodeData.connectedTextDirection)
      : prompt;

    console.log('[PromptNode] Generating with:', {
      prompt: finalPrompt.trim(),
      model,
      connectedImagesCount: limitedImages.length,
      maxImages,
      hasLogo: !!nodeData.connectedLogo,
      hasIdentity: !!nodeData.connectedIdentity,
      hasTextDirection: !!nodeData.connectedTextDirection,
      hasImage1: !!nodeData.connectedImage1,
      hasImage2: !!nodeData.connectedImage2,
      hasImage3: !!nodeData.connectedImage3,
      hasImage4: !!nodeData.connectedImage4,
    });

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
      selected={selected}
      dragging={dragging}
      warning={nodeData.oversizedWarning}
      onFitToContent={handleFitToContent}
      className="p-5 min-w-[320px]"
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setContextMenu({ x: e.clientX, y: e.clientY });
      }}
    >
      {selected && !dragging && (
        <NodeResizer
          color="#brand-cyan"
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
      <NodeHeader icon={Pickaxe} title={t('canvasNodes.promptNode.title')} />

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
      {hasBrandCoreConnection && (
        <div className="mb-3 space-y-2">
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
            <div className="p-2 rounded border border-[#brand-cyan]/30 bg-brand-cyan/5">
              <div className="text-xs font-mono text-brand-cyan mb-1">{t('canvasNodes.promptNode.textDirectionFromBrandCore')}</div>
              <div className="text-xs text-zinc-400 line-clamp-3">{connectedTextDirection}</div>
            </div>
          )}
        </div>
      )}

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
      <div className="mb-3">
        {hasTextNodeConnection && (
          <div className="mb-1.5 text-[10px] font-mono text-brand-cyan/70 flex items-center gap-1">
            <span>•</span>
            <span>{t('canvasNodes.promptNode.connectedToTextNode')}</span>
          </div>
        )}

        {/* Prompt Functions Toolbar */}
        <div className="flex items-center justify-between mb-1.5 px-0.5">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                setIsPresetModalOpen(true);
              }}
              disabled={isLoading}
              className={cn(
                'flex items-center gap-1.5 px-2 py-1 rounded-md border text-[10px] font-mono transition-all',
                'bg-zinc-800/50 border-zinc-700/50 hover:bg-zinc-700/50 hover:border-[#brand-cyan]/30',
                'text-zinc-400 hover:text-brand-cyan',
                'node-interactive'
              )}
              title={t('canvasNodes.promptNode.loadPreset') || 'Load Preset'}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <BookOpen size={14} />
            </button>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              if (nodeData.onSavePrompt) {
                nodeData.onSavePrompt(prompt);
              }
            }}
            disabled={isLoading || !prompt.trim()}
            className={cn(
              'flex items-center gap-1.5 px-2 py-1 rounded-md border text-[10px] font-mono transition-all',
              'bg-zinc-800/50 border-zinc-700/50 hover:bg-zinc-700/50 hover:border-[#brand-cyan]/30',
              'text-zinc-400 hover:text-brand-cyan',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'node-interactive'
            )}
            title={t('canvasNodes.promptNode.savePrompt') || 'Save Prompt'}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <Save size={14} />
          </button>
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
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                if (nodeData.onSuggestPrompts && prompt.trim()) {
                  nodeData.onSuggestPrompts(id, prompt);
                }
              }}
              disabled={isLoading || isSuggestingPrompts || !prompt.trim()}
              className={cn(
                'absolute top-2 right-2 p-1.5 rounded border transition-all',
                'bg-zinc-800/50 hover:bg-zinc-700/50 border-zinc-700/50 hover:border-[#brand-cyan]/40',
                'text-zinc-400 hover:text-brand-cyan',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                'node-interactive'
              )}
              title={t('canvasNodes.promptNode.suggestPrompts')}
              onMouseDown={(e) => e.stopPropagation()}
            >
              {isSuggestingPrompts ? (
                <GlitchLoader size={14} color="currentColor" />
              ) : (
                <Wand2 size={14} />
              )}
            </button>
          )}
        </div>

        {/* Prompt Suggestions */}
        {promptSuggestions.length > 0 && (
          <div className="mt-2 space-y-1.5 animate-fade-in">
            <div className="text-[10px] font-mono text-brand-cyan/70 mb-1.5">
              {t('canvasNodes.promptNode.aiSuggestions') || t('canvasNodes.promptNode.suggestions')}
            </div>
            {promptSuggestions.map((suggestion, index) => (
              <button
                key={index}
                onClick={(e) => {
                  e.stopPropagation();
                  setPrompt(suggestion);
                  handlePromptChange(suggestion);
                  // Clear suggestions after selection
                  if (nodeData.onUpdateData) {
                    nodeData.onUpdateData(id, { promptSuggestions: [] });
                  }
                }}
                className={cn(
                  'w-full text-left p-1.5 text-[11px] font-mono rounded border transition-all',
                  'bg-zinc-800/30 hover:bg-zinc-800/50 border-zinc-700/30 hover:border-[#brand-cyan]/40',
                  'text-zinc-300 hover:text-brand-cyan',
                  'node-interactive'
                )}
                onMouseDown={(e) => e.stopPropagation()}
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Settings Section - Compact and organized */}
      <div className="mb-3 space-y-2.5">
        {/* Model Selector */}
        <div>
          <NodeLabel className="mb-1.5 text-[10px]">
            {t('canvasNodes.promptNode.model')}
          </NodeLabel>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                const newModel: GeminiModel = 'gemini-2.5-flash-image';
                const previousModel = model;

                setModel(newModel);

                if (nodeData.onUpdateData) {
                  const updates: Partial<PromptNodeData> = { model: newModel };

                  // Clear resolution and aspectRatio when switching to Flash
                  updates.resolution = undefined;
                  updates.aspectRatio = undefined;

                  // If switching from Pro to Flash, clear images 3 and 4
                  if (previousModel === 'gemini-3-pro-image-preview') {
                    updates.connectedImage3 = undefined;
                    updates.connectedImage4 = undefined;

                    // Remove edges for input-3 and input-4
                    if (nodeData.onRemoveEdge) {
                      if (connectedImage3) {
                        nodeData.onRemoveEdge(id, 'input-3');
                      }
                      if (connectedImage4) {
                        nodeData.onRemoveEdge(id, 'input-4');
                      }
                    }

                    setConnectedImage3(undefined);
                    setConnectedImage4(undefined);
                  }

                  nodeData.onUpdateData(id, updates);
                }
              }}
              onMouseDown={(e) => e.stopPropagation()}
              disabled={isLoading}
              className={cn(
                'p-2 rounded border transition-all text-left node-interactive',
                model === 'gemini-2.5-flash-image'
                  ? 'bg-brand-cyan/20 border-[#brand-cyan]/50 text-brand-cyan'
                  : 'bg-zinc-900/50 border-zinc-700/50 text-zinc-400 hover:bg-zinc-800/50 hover:border-zinc-600/50',
                isLoading && 'opacity-50 cursor-not-allowed'
              )}
            >
              <div className="text-[11px] font-mono font-semibold">
                {t('canvasNodes.promptNode.modelHD')}
              </div>
              <div className="text-[9px] font-mono opacity-70 mt-0.5">
                {getCreditsRequired('gemini-2.5-flash-image')} {t('canvasNodes.promptNode.credits')}
              </div>
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                const newModel: GeminiModel = 'gemini-3-pro-image-preview';

                setModel(newModel);

                if (nodeData.onUpdateData) {
                  const updates: Partial<PromptNodeData> = { model: newModel };

                  // Set default resolution and aspectRatio if not set
                  if (!nodeData.resolution) {
                    updates.resolution = '4K';
                    setResolution('4K');
                  }
                  if (!nodeData.aspectRatio) {
                    updates.aspectRatio = '16:9';
                    setAspectRatio('16:9');
                  }

                  nodeData.onUpdateData(id, updates);
                }
              }}
              onMouseDown={(e) => e.stopPropagation()}
              disabled={isLoading}
              className={cn(
                'p-2 rounded border transition-all text-left node-interactive',
                model === 'gemini-3-pro-image-preview'
                  ? 'bg-brand-cyan/20 border-[#brand-cyan]/50 text-brand-cyan'
                  : 'bg-zinc-900/50 border-zinc-700/50 text-zinc-400 hover:bg-zinc-800/50 hover:border-zinc-600/50',
                isLoading && 'opacity-50 cursor-not-allowed'
              )}
            >
              <div className="text-[11px] font-mono font-semibold">
                {t('canvasNodes.promptNode.model4K')}
              </div>
              <div className="text-[9px] font-mono opacity-70 mt-0.5">
                {getCreditsRequired('gemini-3-pro-image-preview', resolution)} {t('canvasNodes.promptNode.credits')}
              </div>
            </button>
          </div>
        </div>

        {/* Pro Model Settings - Grouped in a row */}
        {isProModel && (
          <div className="grid grid-cols-2 gap-2.5">
            {/* Aspect Ratio Selector */}
            <div>
              <NodeLabel className="mb-1.5 text-[10px]">
                {t('canvasNodes.promptNode.aspectRatio')}
              </NodeLabel>
              <div onMouseDown={(e) => e.stopPropagation()}>
                <AspectRatioSelector
                  value={aspectRatio}
                  onChange={(ratio) => {
                    setAspectRatio(ratio);
                    if (nodeData.onUpdateData) {
                      nodeData.onUpdateData(id, { aspectRatio: ratio });
                    }
                  }}
                  disabled={isLoading}
                  compact
                />
              </div>
            </div>

            {/* Resolution Selector */}
            <div>
              <NodeLabel className="mb-1.5 text-[10px]">
                {t('canvasNodes.promptNode.resolution')}
              </NodeLabel>
              <div onMouseDown={(e) => e.stopPropagation()}>
                <ResolutionSelector
                  value={resolution}
                  onChange={(res) => {
                    setResolution(res);
                    if (nodeData.onUpdateData) {
                      nodeData.onUpdateData(id, { resolution: res });
                    }
                  }}
                  model={model}
                  disabled={isLoading}
                  compact
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Generate Image Button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          handleGenerate();
        }}
        onMouseDown={(e) => {
          e.stopPropagation();
        }}
        disabled={isLoading || !prompt.trim()}
        className={cn(
          'w-full px-3 py-2 bg-brand-cyan/20 hover:bg-brand-cyan/30 border border-[#brand-cyan]/30 rounded text-xs font-mono text-brand-cyan transition-colors flex items-center justify-center gap-3 node-interactive',
          (isLoading || !prompt.trim()) ? 'opacity-50 node-button-disabled' : 'node-button-enabled'
        )}
      >
        {isLoading ? (
          <>
            <GlitchLoader size={14} className="mr-1" color="#brand-cyan" />
            <span>{t('canvasNodes.promptNode.generating')}</span>
          </>
        ) : (
          <>
            <ImageIcon size={14} />
            <span>{t('canvasNodes.promptNode.generateImage')}</span>
            <span className="text-brand-cyan/70">
              ({creditsRequired} {t('canvasNodes.promptNode.credits')})
            </span>
          </>
        )}
      </button>

      {/* Output Handle */}
      <LabeledHandle
        type="source"
        position={Position.Right}
        label={t('canvasNodes.promptNode.output')}
        handleType="image"
        style={{ top: '50%' }}
      />

      {/* Context Menu */}
      {contextMenu && (
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
      )}

      <MockupPresetModal
        isOpen={isPresetModalOpen}
        selectedPresetId=""
        onClose={() => setIsPresetModalOpen(false)}
        onSelectPreset={handlePresetSelect}
      />
    </NodeContainer>
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
  const prevIdentity = prevData.connectedIdentity ?? undefined;
  const nextIdentity = nextData.connectedIdentity ?? undefined;
  const prevTextDirection = prevData.connectedTextDirection ?? undefined;
  const nextTextDirection = nextData.connectedTextDirection ?? undefined;

  // Always re-render if connected images change (including to/from undefined)
  // This ensures thumbnails are removed when edges are disconnected
  if (prevImage1 !== nextImage1 ||
    prevImage2 !== nextImage2 ||
    prevImage3 !== nextImage3 ||
    prevImage4 !== nextImage4 ||
    prevLogo !== nextLogo ||
    prevIdentity !== nextIdentity ||
    prevTextDirection !== nextTextDirection) {
    return false; // Re-render
  }

  // Re-render if other important props change
  if (prevData.isLoading !== nextData.isLoading ||
    prevData.prompt !== nextData.prompt ||
    prevData.model !== nextData.model ||
    prevData.aspectRatio !== nextData.aspectRatio ||
    prevData.resolution !== nextData.resolution ||
    prevData.isSuggestingPrompts !== nextData.isSuggestingPrompts ||
    prevData.promptSuggestions !== nextData.promptSuggestions ||
    prevProps.selected !== nextProps.selected ||
    prevProps.dragging !== nextProps.dragging) {
    return false; // Re-render
  }

  // Don't re-render if nothing important changed
  return true; // Skip re-render
});

