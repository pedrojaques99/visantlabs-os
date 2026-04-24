import React, { useState, useEffect, memo, useRef, useCallback } from 'react';
import { type NodeProps, type Node, useReactFlow, NodeResizer, Position } from '@xyflow/react';
import { Image as ImageIcon, ChevronDown, ChevronUp, Plus, X, FileText, ChevronRight, Settings, Camera, Layers, MapPin, Sun, Box, LayoutGrid, Diamond } from 'lucide-react';
import { GlitchLoader } from '@/components/ui/GlitchLoader';
import { Tooltip } from '@/components/ui/Tooltip';
import type { MockupNodeData } from '@/types/reactFlow';
import type { MockupPresetType, MockupPreset } from '@/types/mockupPresets';
import type { Mockup } from '@/services/mockupApi';
import type { GeminiModel, SeedreamModel, AspectRatio, Resolution } from '@/types/types';
import { cn } from '@/lib/utils';
import { getAllPresets, getPreset, getAllPresetsAsync, clearPresetsCache } from '@/services/mockupPresetsService';
import { MockupPresetModal } from '../MockupPresetModal';
import { getImageUrl, isSafeUrl } from '@/utils/imageUtils';
import { ConnectedImagesDisplay } from './ConnectedImagesDisplay';
import { CATEGORY_CONFIG } from '../PresetCard';
import { NodeHandles } from './shared/NodeHandles';
import { LabeledHandle } from './shared/LabeledHandle';
import { NodeContainer } from './shared/NodeContainer';
import { NodeLabel } from './shared/node-label';
import { getCreditsRequired } from '@/utils/creditCalculator';
import { NodeMediaDisplay } from './shared/NodeMediaDisplay';
import { GEMINI_MODELS, DEFAULT_MODEL, DEFAULT_ASPECT_RATIO, isAdvancedModel } from '@/constants/geminiModels';
import { isSeedreamModel } from '@/constants/seedreamModels';
import { NodeHeader } from './shared/node-header';
import { toast } from 'sonner';
import { Textarea } from '@/components/ui/textarea';
import { useTranslation } from '@/hooks/useTranslation';
import { useNodeResize } from '@/hooks/canvas/useNodeResize';
import { applyPresetDataToNodes } from '@/lib/presetImportUtils';
import { NodeButton } from './shared/node-button';
import { ModelSelector } from '../shared/ModelSelector';
import { AdvancedModelSettings } from './shared/AdvancedModelSettings';
import { Input } from '@/components/ui/input'
import { useBrandKit } from '@/contexts/BrandKitContext';
import { useNodes } from '@xyflow/react';


const MockupNodeComponent: React.FC<NodeProps<Node<MockupNodeData>>> = ({ data, selected, id, dragging }) => {
  const { t } = useTranslation();

  const { setNodes } = useReactFlow();
  const nodes = useNodes();
  const { handleResize: handleResizeWithDebounce, fitToContent } = useNodeResize();
  const [selectedPresetId, setSelectedPresetId] = useState<MockupPresetType | string>(
    (data.selectedPreset as MockupPresetType | string) || 'cap'
  );
  const [referenceImageUrl, setReferenceImageUrl] = useState<string | null>(null);
  const [isPresetModalOpen, setIsPresetModalOpen] = useState(false);
  const [selectedColors, setSelectedColors] = useState<string[]>(data.selectedColors || []);
  const [colorInput, setColorInput] = useState(data.colorInput || '');
  const [isValidColor, setIsValidColor] = useState(data.isValidColor || false);
  const [withHuman, setWithHuman] = useState(data.withHuman || false);
  const [customPrompt, setCustomPrompt] = useState(data.customPrompt || '');
  const [model, setModel] = useState<GeminiModel | SeedreamModel>(data.model || DEFAULT_MODEL);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(data.aspectRatio || DEFAULT_ASPECT_RATIO);
  const [resolution, setResolution] = useState<Resolution>(data.resolution || '1K');
  const [isBrandActive, setIsBrandActive] = useState<boolean>(data.isBrandActive !== undefined ? data.isBrandActive : (!!(data.connectedLogo || data.connectedIdentity || data.connectedTextDirection)));
  const [isPromptOpen, setIsPromptOpen] = useState(false);
  const [isColorSectionOpen, setIsColorSectionOpen] = useState(false);
  const { openLibrary } = useBrandKit();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const userMockups = (data as any).userMockups as Mockup[] | undefined;

  const isLoading = data.isLoading || false;
  const hasResult = !!(data.resultImageUrl || data.resultImageBase64);
  // BrandCore connection data
  const connectedLogo = data.connectedLogo;
  const connectedIdentity = data.connectedIdentity;
  const connectedTextDirection = data.connectedTextDirection;
  const hasBrandCoreConnection = !!(connectedLogo || connectedIdentity || connectedTextDirection);
  // Check if we have any image source (BrandCore or legacy)
  const hasConnectedImage = !!(data.connectedImage || connectedLogo || connectedIdentity);
  // Load presets async on mount to ensure MongoDB presets (with referenceImageUrl) are available
  const [loadedPresets, setLoadedPresets] = useState<MockupPreset[]>([]);
  const [isLoadingPresets, setIsLoadingPresets] = useState(true);

  useEffect(() => {
    const loadPresets = async () => {
      setIsLoadingPresets(true);
      try {
        const allPresets = await getAllPresetsAsync();
        setLoadedPresets(allPresets);
      } catch (error) {
        console.error('Failed to load presets:', error);
        // Fallback to sync presets if async fails
        setLoadedPresets(getAllPresets());
      } finally {
        setIsLoadingPresets(false);
      }
    };

    loadPresets();
  }, []);

  // Reload presets when modal closes (cache might have been updated)
  useEffect(() => {
    if (!isPresetModalOpen) {
      // Clear cache to force reload that includes community presets
      clearPresetsCache();
      // Reload presets after modal closes to get any cache updates
      const reloadPresets = async () => {
        try {
          const allPresets = await getAllPresetsAsync();
          setLoadedPresets(allPresets);
        } catch (error) {
          console.error('Failed to reload presets:', error);
          // Keep existing loaded presets if reload fails
        }
      };
      reloadPresets();
    }
  }, [isPresetModalOpen]);

  // Use loaded presets if available, otherwise fallback to sync presets
  const currentPresets = loadedPresets.length > 0 ? loadedPresets : getAllPresets();
  const isPreset = typeof selectedPresetId === 'string' && currentPresets.some(preset => preset.id === selectedPresetId);
  const selectedPreset = isPreset ? (currentPresets.find(p => p.id === selectedPresetId) || null) : null;
  const selectedMockup = !isPreset && userMockups ? userMockups.find(m => m._id === selectedPresetId) : null;

  // Determine dynamic identity based on category
  const presetCategory = (selectedPreset as any)?.presetType || (selectedPreset as any)?.category || (selectedPreset?.id as any) || 'mockup';
  const categoryConfig = CATEGORY_CONFIG[presetCategory as keyof typeof CATEGORY_CONFIG] || CATEGORY_CONFIG.mockup;
  const CategoryIcon = categoryConfig.icon;
  const categoryTitle = t(`communityPresets.tabs.${presetCategory}`) || categoryConfig.label;

  // Get base prompt from preset
  const basePrompt = selectedPreset?.prompt || '';

  // Load reference image URL when preset changes
  useEffect(() => {
    // Check if it's a preset or a mockup
    const preset = typeof selectedPresetId === 'string' && !selectedPresetId.startsWith('mockup-')
      ? currentPresets.find(p => p.id === selectedPresetId) || null
      : null;

    if (preset?.referenceImageUrl && preset.referenceImageUrl.trim() !== '') {
      setReferenceImageUrl(preset.referenceImageUrl);
    } else {
      setReferenceImageUrl(null);
    }
  }, [selectedPresetId, currentPresets]);

  // Sync preset with data
  useEffect(() => {
    if (data.selectedPreset && data.selectedPreset !== selectedPresetId) {
      setSelectedPresetId(data.selectedPreset as MockupPresetType);
    }
  }, [data.selectedPreset]);

  // Consolidate syncing node data into local state
  useEffect(() => {
    if (data.selectedColors !== undefined) setSelectedColors(data.selectedColors);
    if (data.colorInput !== undefined) setColorInput(data.colorInput);
    if (data.isValidColor !== undefined) setIsValidColor(data.isValidColor);
    if (data.withHuman !== undefined) setWithHuman(data.withHuman);
    if (data.customPrompt !== undefined) setCustomPrompt(data.customPrompt);
    if (data.model) setModel(data.model);
    if (data.aspectRatio) setAspectRatio(data.aspectRatio);
    if (data.resolution) setResolution(data.resolution);
    if (data.isBrandActive !== undefined) setIsBrandActive(data.isBrandActive);
  }, [
    data.selectedColors,
    data.colorInput,
    data.isValidColor,
    data.withHuman,
    data.customPrompt,
    data.model,
    data.aspectRatio,
    data.resolution,
    data.isBrandActive
  ]);


  const { getNodes } = useReactFlow();

  const handlePresetChange = (presetId: string | MockupPresetType) => {
    const allNodes = getNodes();

    // Use shared utility for smart selection/update
    const updated = applyPresetDataToNodes(
      allNodes as any,
      { id: presetId as string },
      (nodeId, updates) => {
        if (data.onUpdateData) {
          data.onUpdateData(nodeId, updates);
        }
      },
      id
    );

    if (!updated && data.onUpdateData) {
      data.onUpdateData(id, {
        selectedPreset: presetId as any,
        customPrompt: ''
      });
    }

    setSelectedPresetId(presetId);
  };

  const handleColorInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.trim();
    // Remove todos os # existentes e adiciona um no início se houver conteúdo
    if (value) {
      value = value.replace(/#/g, '');
      if (value.length > 0) {
        value = '#' + value;
      }
    }
    setColorInput(value);
    const valid = /^#([0-9A-F]{3}){1,2}$/i.test(value);
    setIsValidColor(valid);
    if (data.onUpdateData) {
      data.onUpdateData(id, { colorInput: value, isValidColor: valid });
    }
  };

  const handleAddColor = () => {
    const sanitizedColor = colorInput.trim().toUpperCase();
    if (isValidColor && !selectedColors.includes(sanitizedColor) && selectedColors.length < 5) {
      const newColors = [...selectedColors, sanitizedColor];
      setSelectedColors(newColors);
      setColorInput('');
      setIsValidColor(false);
      if (data.onUpdateData) {
        data.onUpdateData(id, { selectedColors: newColors, colorInput: '', isValidColor: false });
      }
    }
  };

  const handleRemoveColor = (colorToRemove: string) => {
    const newColors = selectedColors.filter(color => color !== colorToRemove);
    setSelectedColors(newColors);
    if (data.onUpdateData) {
      data.onUpdateData(id, { selectedColors: newColors });
    }
  };

  const handleWithHumanChange = (value: boolean) => {
    setWithHuman(value);
    if (data.onUpdateData) {
      data.onUpdateData(id, { withHuman: value });
    }
  };

  const handlePromptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setCustomPrompt(value);
    if (data.onUpdateData) {
      data.onUpdateData(id, { customPrompt: value });
    }
    // Auto-resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  };

  // Auto-resize textarea on mount and when prompt opens
  useEffect(() => {
    if (isPromptOpen && textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [isPromptOpen, customPrompt]);

  const handleAddToBoard = (url: string, type: 'image' | 'logo') => {
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
        onUpdateData: data.onUpdateData,
        onDelete: data.onDelete,
        onResize: data.onResize
      } as any
    }));
  };

  const handleSelectAsset = (url: string, type: 'image' | 'logo') => {
    if (data.onUpdateData) {
      if (type === 'logo') {
        data.onUpdateData(id, { connectedLogo: url });
      } else {
        data.onUpdateData(id, { connectedImage: url });
      }
    }
  };

  const handleGenerate = async () => {
    if (!data.onGenerate) {
      return;
    }

    // HIERARCHY: Logo (priority 1) as main focus, Identity (priority 2) as context/colors/vibe
    // Use logo first, fallback to legacy connectedImage if no logo
    const imageToUse = (isBrandActive && connectedLogo) || data.connectedImage;

    if (!imageToUse) {
      console.warn('[MockupNode] No logo (required) or connected image available');
      toast.error(t('canvasNodes.mockupNode.logoRequired'), { duration: 3000 });
      return;
    }

    // Combine text direction from BrandCore with custom prompt if active
    const finalPrompt = (isBrandActive && connectedTextDirection)
      ? (customPrompt ? `${connectedTextDirection}\n\n${customPrompt}` : connectedTextDirection)
      : customPrompt;

    const isAdvanced = isAdvancedModel(model);
    const finalResolution = isAdvanced ? resolution : undefined;
    const finalAspectRatio = isAdvanced ? aspectRatio : undefined;

    await data.onGenerate(id, imageToUse, selectedPresetId, selectedColors, withHuman, finalPrompt || undefined, model, finalResolution, finalAspectRatio);
  };

  // Handle resize from NodeResizer (com debounce - aplica apenas quando soltar o mouse)
  const handleResize = useCallback((width: number, height: number) => {
    handleResizeWithDebounce(id, width, 'auto', data.onResize);
  }, [id, data.onResize, handleResizeWithDebounce]);

  const handleFitToContent = useCallback(() => {
    // For mockup nodes, we set height to auto
    fitToContent(id, 'auto', 'auto', data.onResize);
  }, [id, data.onResize, fitToContent]);

  return (
    <NodeContainer
      selected={selected}
      dragging={dragging}
      warning={data.oversizedWarning}
      onFitToContent={handleFitToContent}
      className="min-w-[320px]"
      style={{
        height: 'auto'
      }}
      onContextMenu={(e) => {
        // Allow ReactFlow to handle the context menu event
      }}
    >
      {selected && !dragging && (
        <NodeResizer
          color="brand-cyan"
          isVisible={selected}
          minWidth={280}
          minHeight={200}
          maxWidth={2000}
          maxHeight={2000}
          onResize={(_, { width, height }) => {
            handleResize(width, height);
          }}
        />
      )}

      <LabeledHandle
        type="target"
        position={Position.Left}
        label={t('canvasNodes.mockupNode.imageInput') || 'Image'}
      />
      <LabeledHandle
        type="source"
        position={Position.Right}
        label={t('canvasNodes.mockupNode.output') || 'Output'}
      />

      {/* Header */}
      <NodeHeader 
        icon={categoryConfig.icon} 
        title={categoryTitle} 
        selected={selected}
        isBrandActive={isBrandActive}
        onToggleBrand={(active) => {
          setIsBrandActive(active);
          if (data.onUpdateData) data.onUpdateData(id, { isBrandActive: active });
        }}
        onOpenMediaLibrary={() => openLibrary({ onSelectAsset: handleSelectAsset, onAddToBoard: handleAddToBoard })}
      />

      {/* Preset Selector - Button to open modal */}
      <div className="node-margin">
        <NodeButton variant="ghost" onClick={(e) => {
          e.stopPropagation();
          setIsPresetModalOpen(true);
        }}
          onMouseDown={(e) => {
            e.stopPropagation();
          }}
          disabled={isLoading}
          className={cn(
            'w-full flex items-center gap-3 p-1.5 rounded-md border-node transition-all text-left node-interactive',
            'bg-brand-cyan/10 border-neutral-800 hover:bg-brand-cyan/15',
            isLoading && 'opacity-50 cursor-not-allowed'
          )}
        >
          {/* Thumbnail */}
          {selectedPreset?.referenceImageUrl ? (
            <div className="w-10 h-10 bg-neutral-900/30 border-node border-neutral-700/30 rounded overflow-hidden flex-shrink-0">
              <img
                src={isSafeUrl(selectedPreset.referenceImageUrl) ? selectedPreset.referenceImageUrl : ''}
                alt={selectedPreset.name}
                className="w-full h-full object-cover"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  if (target) {
                    target.style.display = 'none';
                  }
                }}
              />
            </div>
          ) : selectedMockup ? (
            <div className="w-10 h-10 bg-neutral-900/30 border-node border-neutral-700/30 rounded overflow-hidden flex-shrink-0">
              <img
                src={getImageUrl(selectedMockup) || ''}
                alt={selectedMockup.prompt || t('canvasNodes.mockupNode.mockupAltText')}
                className="w-full h-full object-cover"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  if (target) {
                    target.style.display = 'none';
                  }
                }}
              />
            </div>
          ) : (
            <div className="w-10 h-10 bg-neutral-900/30 border-node border-neutral-700/30 rounded flex items-center justify-center flex-shrink-0">
              <ImageIcon size={14} className="text-neutral-600" />
            </div>
          )}
          {/* Title with thumbnail in same div */}
          <div className="flex-1 min-w-0">
            <div className="text-xs font-mono truncate text-brand-cyan">
              {selectedPreset?.name || selectedMockup?.prompt?.substring(0, 30) || t('canvasNodes.mockupNode.selectPreset')}
            </div>
          </div>
          {/* Click indicator */}
          <ChevronDown size={14} className="text-neutral-400 flex-shrink-0" />
        </NodeButton>
      </div>



      {/* Connected Images from BrandCore or legacy image node */}
      {/* HIERARCHY: Logo (priority 1) as primary focus, Identity (priority 2) as context/colors/vibe */}
        <div className={cn("node-margin space-y-[var(--node-gap)] transition-all duration-300", !isBrandActive && "opacity-30 grayscale pointer-events-none")}>
          {connectedLogo && (
            <ConnectedImagesDisplay
              images={[connectedLogo]}
              label={t('canvasNodes.mockupNode.logoFromBrandCore')}
              showLabel={true}
              onImageRemove={() => {
                if (data.onUpdateData) {
                  data.onUpdateData(id, { connectedLogo: undefined });
                }
              }}
            />
          )}
          {connectedIdentity && (
            <ConnectedImagesDisplay
              images={[connectedIdentity]}
              label={`${t('canvasNodes.mockupNode.identityFromBrandCore')}${connectedIdentity.includes('.pdf') || connectedIdentity.includes('application/pdf') || (connectedIdentity.startsWith('http') && connectedIdentity.includes('pdf')) ? ` ${t('canvasNodes.mockupNode.pdfLabel')}` : ` ${t('canvasNodes.mockupNode.imageLabel')}`}`}
              showLabel={true}
              onImageRemove={() => {
                if (data.onUpdateData) {
                  data.onUpdateData(id, { connectedIdentity: undefined });
                }
              }}
            />
          )}
          {connectedTextDirection && (
            <div className="p-2 rounded border-node border-neutral-800 bg-brand-cyan/5">
              <div className="text-xs font-mono text-brand-cyan mb-1">{t('canvasNodes.mockupNode.textDirectionFromBrandCore')}</div>
              <div className="text-xs text-neutral-400 line-clamp-3">{connectedTextDirection}</div>
            </div>
          )}
        </div>

      {hasConnectedImage && !isBrandActive && (
        <ConnectedImagesDisplay
          images={[data.connectedImage]}
          label={t('canvasNodes.mockupNode.inputImage')}
          showLabel={true}
          onImageRemove={() => {
            if (data.onUpdateData) {
              data.onUpdateData(id, { connectedImage: undefined });
            }
          }}
        />
      )}

      {/* Prompt Editor Toggle */}
      <div className="mb-2">
        <NodeButton variant="ghost" onClick={(e) => {
          e.stopPropagation();
          const newIsOpen = !isPromptOpen;
          setIsPromptOpen(newIsOpen);
          // If opening and no custom prompt exists, initialize with base prompt or text direction
          if (newIsOpen && !customPrompt) {
            const initialPrompt = connectedTextDirection || basePrompt;
            if (initialPrompt) {
              setCustomPrompt(initialPrompt);
              if (data.onUpdateData) {
                data.onUpdateData(id, { customPrompt: initialPrompt });
              }
            }
          }
        }}
          onMouseDown={(e) => e.stopPropagation()}
          disabled={isLoading}
          className={cn(
            'w-full flex items-center justify-between p-1.5 rounded-md border-node transition-all text-left node-interactive',
            'bg-neutral-900/50 border-neutral-700/50 hover:bg-neutral-800/50 hover:border-neutral-600/50',
            'text-neutral-400 hover:text-brand-cyan',
            isLoading && 'opacity-50 cursor-not-allowed'
          )}
        >
          <div className="flex items-center gap-3">
            <FileText size={12} />
            <span className="text-xs font-mono">{t('canvasNodes.mockupNode.editPrompt')}</span>
            {customPrompt && customPrompt.trim() && (
              <span className="text-[10px] text-brand-cyan">(custom)</span>
            )}
          </div>
          <ChevronRight
            size={12}
            className={cn(
              'transition-transform duration-200',
              isPromptOpen && 'rotate-90'
            )}
          />
        </NodeButton>
      </div>

      {/* Prompt Editor Textarea */}
      {isPromptOpen && (
        <div className="mb-2">
          <Textarea
            ref={textareaRef}
            value={customPrompt}
            onChange={handlePromptChange}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            placeholder={basePrompt || t('canvasNodes.mockupNode.enterCustomPrompt')}
            disabled={isLoading}
            className="text-xs nodrag nopan"
            rows={1}
          />
          <p className="text-[10px] font-mono text-neutral-500 mt-1">
            {customPrompt && customPrompt.trim()
              ? t('canvasNodes.mockupNode.customPromptOverride')
              : t('canvasNodes.mockupNode.editPromptHint')}
          </p>
        </div>
      )}

      {/* Color & Human Section - Collapsable */}
      <div className="mb-2">
        <NodeButton variant="ghost" onClick={(e) => {
          e.stopPropagation();
          setIsColorSectionOpen(!isColorSectionOpen);
        }}
          onMouseDown={(e) => e.stopPropagation()}
          disabled={isLoading}
          className={cn(
            'w-full flex items-center justify-between p-1.5 rounded-md border-node transition-all text-left node-interactive',
            'bg-neutral-900/50 border-neutral-700/50 hover:bg-neutral-800/50 hover:border-neutral-600/50',
            'text-neutral-400 hover:text-brand-cyan',
            isLoading && 'opacity-50 cursor-not-allowed'
          )}
        >
          <div className="flex items-center gap-3">
            <Settings size={12} className="text-neutral-500" />
            <span className="text-xs font-mono">{t('canvasNodes.mockupNode.advancedControls')}</span>
            {(selectedColors.length > 0 || withHuman) && (
              <span className="text-[10px] text-brand-cyan">
                ({selectedColors.length} {selectedColors.length !== 1 ? t('canvasNodes.mockupNode.colorsPlural') : t('canvasNodes.mockupNode.colorSingular')}{withHuman ? `, ${t('canvasNodes.mockupNode.humanText')}` : ''})
              </span>
            )}
          </div>
          <ChevronRight
            size={12}
            className={cn(
              'transition-transform duration-200',
              isColorSectionOpen && 'rotate-90'
            )}
          />
        </NodeButton>

        {isColorSectionOpen && (
          <div className="mt-3 space-y-3">
            <ModelSelector
              type="image"
              variant="node"
              selectedModel={model}
              onModelChange={(newModel, provider) => {
                setModel(newModel as GeminiModel | SeedreamModel);
                if (data.onUpdateData) {
                  data.onUpdateData(id, { model: newModel as GeminiModel | SeedreamModel, provider });
                }
              }}
              resolution={resolution}
              disabled={isLoading}
              onSyncResolution={(res) => {
                setResolution(res);
                if (data.onUpdateData) data.onUpdateData(id, { resolution: res });
              }}
              onClearAdvancedConfig={() => {
                if (data.onUpdateData) {
                  data.onUpdateData(id, {
                    resolution: undefined,
                    aspectRatio: undefined
                  });
                }
              }}
            />

            {!isSeedreamModel(model) && (
              <AdvancedModelSettings
                model={model as GeminiModel}
                aspectRatio={aspectRatio}
                resolution={resolution}
                onAspectRatioChange={(ratio) => {
                  setAspectRatio(ratio);
                  if (data.onUpdateData) data.onUpdateData(id, { aspectRatio: ratio });
                }}
                onResolutionChange={(res) => {
                  setResolution(res);
                  if (data.onUpdateData) data.onUpdateData(id, { resolution: res });
                }}
                onModelChange={(newModel) => {
                  setModel(newModel);
                  if (data.onUpdateData) data.onUpdateData(id, { model: newModel });
                }}
                isLoading={isLoading}
              />
            )}

            {/* Color Picker */}
            <div>
              <h4 className="text-xs font-mono mb-1.5 text-neutral-500">{t('canvasNodes.mockupNode.colorPalette')}</h4>
              <div className="flex gap-3">
                <div className="flex-grow relative flex items-center">
                  <Input
                    type="text"
                    value={colorInput}
                    onChange={handleColorInputChange}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.stopPropagation();
                        e.preventDefault();
                        handleAddColor();
                      }
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                    className="w-full p-1.5 rounded-md border-node focus:outline-none focus:border-neutral-600 focus:ring-0 text-xs font-mono transition-colors duration-200 pl-7 bg-neutral-900/50 border-neutral-700/50 text-neutral-400"
                    placeholder={t('canvasNodes.mockupNode.colorPlaceholder')}
                    disabled={isLoading}
                    style={{ pointerEvents: 'auto' }}
                  />
                  {(isValidColor || !colorInput) && (
                    <span
                      className="absolute left-2 w-3 h-3 rounded-md border-node border-neutral-600"
                      style={{ backgroundColor: isValidColor ? colorInput : 'brand-cyan' }}
                    ></span>
                  )}
                </div>
                <NodeButton variant="ghost" size="xs" onClick={(e) => {
                  e.stopPropagation();
                  handleAddColor();
                }}
                  onMouseDown={(e) => e.stopPropagation()}
                  disabled={isLoading || !isValidColor}
                  className="nodrag nopan"
                >
                  {t('canvasNodes.mockupNode.add')}
                </NodeButton>
              </div>
              {selectedColors.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-1.5 min-h-[24px]">
                  {selectedColors.map(color => (
                    <div key={color} className="flex items-center gap-1 pl-1.5 pr-0.5 py-0.5 rounded-md border-node text-xs bg-neutral-900/80 border-neutral-700">
                      <span
                        className="w-2.5 h-2.5 rounded-md border-node border-white/10"
                        style={{ backgroundColor: color }}
                      ></span>
                      <span className="font-mono text-[10px]">{color}</span>
                      <NodeButton variant="ghost" size="xs" onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveColor(color);
                      }}
                        onMouseDown={(e) => e.stopPropagation()}
                        className="p-1 min-w-0 h-auto"
                      >
                        <X size={10} />
                      </NodeButton>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Human Interaction Checkbox */}
            <div>
              <div
                className={cn(
                  "flex items-center p-1.5 rounded-md cursor-pointer border-node bg-neutral-900/50 border-neutral-700/50 hover:bg-neutral-800/50 transition-colors",
                  "node-interactive"
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  handleWithHumanChange(!withHuman);
                }}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <div className={cn(
                  "w-3.5 h-3.5 rounded-md flex items-center justify-center border-node transition-all duration-200",
                  withHuman ? 'bg-brand-cyan/80 border-neutral-800' : 'bg-neutral-700 border-neutral-600'
                )}>
                  {withHuman && (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-2.5 w-2.5 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <label className="ml-2 text-xs select-none cursor-pointer text-neutral-400 font-mono">{t('canvasNodes.mockupNode.includeHumanInteraction')}</label>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Result Display Section */}
      {(data.resultImageUrl || data.resultImageBase64) && (
        <div className="node-margin">
          <NodeMediaDisplay
            url={data.resultImageUrl || (data.resultImageBase64 ? (data.resultImageBase64.startsWith('data:') ? data.resultImageBase64 : `data:image/png;base64,${data.resultImageBase64}`) : null)}
            isLoading={isLoading}
            dragging={dragging}
            alt="Generation Result"
          />
        </div>
      )}

      {/* Generate Button */}
      <Tooltip 
        content={`${t('canvasNodes.promptNode.creditsRequired') || 'Costs'} ${getCreditsRequired(model, resolution)} ${t('canvasNodes.promptNode.credits')}`}
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
          disabled={isLoading || !hasConnectedImage}
          className="node-interactive group/gen"
        >
          {isLoading ? (
            <div className="flex items-center justify-center gap-2">
              <GlitchLoader size={14} color="brand-cyan" />
              <span>{t('canvasNodes.mockupNode.generating')}</span>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2">
              <Diamond size={14} className="group-hover/gen:rotate-12 transition-transform" />
              <span className="font-semibold tracking-tight">{t('canvasNodes.mockupNode.generateMockup')}</span>
              <div className="flex items-center gap-1 ml-1 px-1.5 py-0.5 rounded-full bg-black/20 text-[10px] text-foreground/80">
                <Diamond size={10} className="opacity-50 fill-current" />
                {getCreditsRequired(model, resolution)}
              </div>
            </div>
          )}
        </NodeButton>
      </Tooltip>

      {/* Add Mockup Button */}
      <div className="mt-2 pt-2 border-t border-neutral-700/30 flex justify-center">
        <NodeButton variant="ghost" size="xs" onClick={(e) => {
          e.stopPropagation();
          if (data.onAddMockupNode) {
            data.onAddMockupNode();
          }
        }}
          onMouseDown={(e) => {
            e.stopPropagation();
          }}
          disabled={isLoading}
          className={cn(
            'w-6 h-6 flex items-center justify-center rounded-md border-node transition-all node-interactive',
            'bg-neutral-900/50 border-neutral-700/50 hover:bg-neutral-800/50 hover:border-neutral-600/50',
            'text-neutral-400 hover:text-brand-cyan',
            isLoading && 'opacity-50 cursor-not-allowed'
          )}
          title={t('canvasNodes.mockupNode.addAnotherMockupNode')}
        >
          <Plus size={12} />
        </NodeButton>
      </div>

      {/* Preset Selection Modal */}
      <MockupPresetModal
        isOpen={isPresetModalOpen}
        selectedPresetId={selectedPresetId}
        initialCategory={presetCategory}
        onClose={() => setIsPresetModalOpen(false)}
        onSelectPreset={(presetId) => {
          handlePresetChange(presetId);
        }}
        userMockups={userMockups || []}
        isLoading={isLoading}
      />
    </NodeContainer>
  );
};

export const MockupNode = memo(MockupNodeComponent, (prevProps, nextProps) => {
  // Custom comparison to prevent unnecessary re-renders
  // IMPORTANT: Always re-render if connected images or text direction changes (including to/from undefined)
  // This ensures thumbnails are removed when edge is disconnected
  const prevConnectedImage = prevProps.data.connectedImage ?? undefined;
  const nextConnectedImage = nextProps.data.connectedImage ?? undefined;
  const prevConnectedLogo = prevProps.data.connectedLogo ?? undefined;
  const nextConnectedLogo = nextProps.data.connectedLogo ?? undefined;
  const prevConnectedIdentity = prevProps.data.connectedIdentity ?? undefined;
  const nextConnectedIdentity = nextProps.data.connectedIdentity ?? undefined;
  const prevTextDirection = prevProps.data.connectedTextDirection ?? undefined;
  const nextTextDirection = nextProps.data.connectedTextDirection ?? undefined;

  const connectedImageChanged = prevConnectedImage !== nextConnectedImage;
  const connectedLogoChanged = prevConnectedLogo !== nextConnectedLogo;
  const connectedIdentityChanged = prevConnectedIdentity !== nextConnectedIdentity;
  const textDirectionChanged = prevTextDirection !== nextTextDirection;

  // If any connected data changed, force re-render
  if (connectedImageChanged || connectedLogoChanged || connectedIdentityChanged || textDirectionChanged) {
    return false; // Re-render
  }

  // Otherwise, check other props
  return (
    prevProps.id === nextProps.id &&
    prevProps.selected === nextProps.selected &&
    prevProps.dragging === nextProps.dragging &&
    prevProps.data.isLoading === nextProps.data.isLoading &&
    prevProps.data.selectedPreset === nextProps.data.selectedPreset &&
    prevProps.data.resultImageUrl === nextProps.data.resultImageUrl &&
    prevProps.data.resultImageBase64 === nextProps.data.resultImageBase64 &&
    prevProps.data.selectedColors === nextProps.data.selectedColors &&
    prevProps.data.withHuman === nextProps.data.withHuman &&
    prevProps.data.customPrompt === nextProps.data.customPrompt &&
    prevProps.data.colorInput === nextProps.data.colorInput &&
    prevProps.data.isValidColor === nextProps.data.isValidColor &&
    prevProps.data.model === nextProps.data.model &&
    prevProps.data.aspectRatio === nextProps.data.aspectRatio &&
    prevProps.data.resolution === nextProps.data.resolution
  );
});

MockupNode.displayName = 'MockupNode';

