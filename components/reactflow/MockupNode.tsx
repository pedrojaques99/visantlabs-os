import React, { useState, useEffect, memo, useRef, useCallback } from 'react';
import { type NodeProps, type Node, useReactFlow, NodeResizer, Position } from '@xyflow/react';
import { Loader2, Image as ImageIcon, ChevronDown, ChevronUp, Plus, X, FileText, ChevronRight, Settings } from 'lucide-react';
import type { MockupNodeData } from '../../types/reactFlow';
import type { MockupPresetType, MockupPreset } from '../../types/mockupPresets';
import type { Mockup } from '../../services/mockupApi';
import { cn } from '../../lib/utils';
import { getAllPresets, getPreset, getAllPresetsAsync, clearPresetsCache } from '../../services/mockupPresetsService';
import { MockupPresetModal } from '../MockupPresetModal';
import { getImageUrl, isSafeUrl } from '../../utils/imageUtils';
import { ConnectedImagesDisplay } from './ConnectedImagesDisplay';
import { NodeHandles } from './shared/NodeHandles';
import { LabeledHandle } from './shared/LabeledHandle';
import { NodeContainer } from './shared/NodeContainer';
import { Textarea } from '../ui/textarea';
import { toast } from 'sonner';
import { useTranslation } from '../../hooks/useTranslation';
import { useNodeResize } from '../../hooks/canvas/useNodeResize';

const MockupNodeComponent: React.FC<NodeProps<Node<MockupNodeData>>> = ({ data, selected, id, dragging }) => {
  const { t } = useTranslation();
  const { setNodes } = useReactFlow();
  const { handleResize: handleResizeWithDebounce } = useNodeResize();
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
  const [isPromptOpen, setIsPromptOpen] = useState(false);
  const [isColorSectionOpen, setIsColorSectionOpen] = useState(false);
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
          console.log('[MockupNode] Reloaded presets after modal close:', {
            count: allPresets.length,
            ids: allPresets.map(p => p.id).slice(0, 10),
          });
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

  // Sync colors, withHuman, and customPrompt with data
  useEffect(() => {
    if (data.selectedColors !== undefined) {
      setSelectedColors(data.selectedColors);
    }
    if (data.colorInput !== undefined) {
      setColorInput(data.colorInput);
    }
    if (data.isValidColor !== undefined) {
      setIsValidColor(data.isValidColor);
    }
    if (data.withHuman !== undefined) {
      setWithHuman(data.withHuman);
    }
    if (data.customPrompt !== undefined) {
      setCustomPrompt(data.customPrompt);
    }
  }, [data.selectedColors, data.colorInput, data.isValidColor, data.withHuman, data.customPrompt]);


  const handlePresetChange = (presetId: string | MockupPresetType) => {
    setSelectedPresetId(presetId);
    if (data.onUpdateData) {
      data.onUpdateData(id, { selectedPreset: presetId });
    }
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

  const handleGenerate = async () => {
    if (!data.onGenerate) {
      return;
    }

    // HIERARCHY: Logo (priority 1) as main focus, Identity (priority 2) as context/colors/vibe
    // Use logo first, fallback to legacy connectedImage if no logo
    const imageToUse = connectedLogo || data.connectedImage;

    if (!imageToUse) {
      console.warn('[MockupNode] No logo (required) or connected image available');
      toast.error(t('canvasNodes.mockupNode.logoRequired'), { duration: 3000 });
      return;
    }

    // Combine text direction from BrandCore with custom prompt
    const finalPrompt = connectedTextDirection
      ? (customPrompt ? `${connectedTextDirection}\n\n${customPrompt}` : connectedTextDirection)
      : customPrompt;

    console.log('[MockupNode] Generating with:', {
      nodeId: id,
      presetId: selectedPresetId,
      hasLogo: !!connectedLogo,
      hasIdentity: !!connectedIdentity,
      hasLegacyImage: !!data.connectedImage,
      imageToUse: imageToUse === connectedLogo ? 'LOGO (primary)' : 'LEGACY_IMAGE',
      hasTextDirection: !!connectedTextDirection,
      imageType: imageToUse?.startsWith('http') ? 'URL' : imageToUse?.startsWith('data:') ? 'dataURL' : 'base64',
      colorsCount: selectedColors.length,
      withHuman,
      hasCustomPrompt: !!customPrompt,
      hasFinalPrompt: !!finalPrompt,
    });

    await data.onGenerate(id, imageToUse, selectedPresetId, selectedColors, withHuman, finalPrompt || undefined);
  };

  // Handle resize from NodeResizer (com debounce - aplica apenas quando soltar o mouse)
  const handleResize = useCallback((width: number, height: number) => {
    handleResizeWithDebounce(id, width, 'auto', data.onResize);
  }, [id, data.onResize, handleResizeWithDebounce]);

  return (
    <NodeContainer
      selected={selected}
      dragging={dragging}
      warning={data.oversizedWarning}
      className="p-5"
      style={{
        height: 'auto'
      }}
      onContextMenu={(e) => {
        // Allow ReactFlow to handle the context menu event
      }}
    >
      {selected && !dragging && (
        <NodeResizer
          color="#52ddeb"
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
      <div className="flex items-center gap-3 mb-3">
        <ImageIcon size={16} className="text-[#52ddeb]" />
        <h3 className="text-xs font-semibold text-zinc-300 font-mono">{t('canvasNodes.mockupNode.title')}</h3>
      </div>

      {/* Preset Selector - Button to open modal */}
      <div className="mb-2">
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsPresetModalOpen(true);
          }}
          onMouseDown={(e) => {
            e.stopPropagation();
          }}
          disabled={isLoading}
          className={cn(
            'w-full flex items-center gap-3 p-1.5 rounded border transition-all text-left node-interactive',
            'bg-[#52ddeb]/10 border-[#52ddeb]/50 hover:bg-[#52ddeb]/15',
            isLoading && 'opacity-50 cursor-not-allowed'
          )}
        >
          {/* Thumbnail */}
          {selectedPreset?.referenceImageUrl ? (
            <div className="w-10 h-10 bg-zinc-900/30 border border-zinc-700/30 rounded overflow-hidden flex-shrink-0">
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
            <div className="w-10 h-10 bg-zinc-900/30 border border-zinc-700/30 rounded overflow-hidden flex-shrink-0">
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
            <div className="w-10 h-10 bg-zinc-900/30 border border-zinc-700/30 rounded flex items-center justify-center flex-shrink-0">
              <ImageIcon size={14} className="text-zinc-600" />
            </div>
          )}
          {/* Title with thumbnail in same div */}
          <div className="flex-1 min-w-0">
            <div className="text-xs font-mono truncate text-[#52ddeb]">
              {selectedPreset?.name || selectedMockup?.prompt?.substring(0, 30) || t('canvasNodes.mockupNode.selectPreset')}
            </div>
          </div>
          {/* Click indicator */}
          <ChevronDown size={14} className="text-zinc-400 flex-shrink-0" />
        </button>
      </div>



      {/* Connected Images from BrandCore or legacy image node */}
      {/* HIERARCHY: Logo (priority 1) as primary focus, Identity (priority 2) as context/colors/vibe */}
      {hasBrandCoreConnection ? (
        <div className="mb-3 space-y-3">
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
            <div className="p-2 rounded border border-[#52ddeb]/30 bg-[#52ddeb]/5">
              <div className="text-xs font-mono text-[#52ddeb] mb-1">{t('canvasNodes.mockupNode.textDirectionFromBrandCore')}</div>
              <div className="text-xs text-zinc-400 line-clamp-3">{connectedTextDirection}</div>
            </div>
          )}
          {data.connectedStrategyData && (
            <div className="p-2 rounded border border-[#52ddeb]/20 bg-[#52ddeb]/3">
              <div className="text-xs font-mono text-[#52ddeb]/80 mb-1">{t('canvasNodes.mockupNode.strategyDataFromBrandCore')}</div>
              <div className="text-[10px] text-zinc-500">{t('canvasNodes.mockupNode.available')}</div>
            </div>
          )}
        </div>
      ) : hasConnectedImage ? (
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
      ) : null}

      {/* Prompt Editor Toggle */}
      <div className="mb-2">
        <button
          onClick={(e) => {
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
            'w-full flex items-center justify-between p-1.5 rounded border transition-all text-left node-interactive',
            'bg-zinc-900/50 border-zinc-700/50 hover:bg-zinc-800/50 hover:border-zinc-600/50',
            'text-zinc-400 hover:text-[#52ddeb]',
            isLoading && 'opacity-50 cursor-not-allowed'
          )}
        >
          <div className="flex items-center gap-3">
            <FileText size={12} />
            <span className="text-xs font-mono">{t('canvasNodes.mockupNode.editPrompt')}</span>
            {customPrompt && customPrompt.trim() && (
              <span className="text-[10px] text-[#52ddeb]">(custom)</span>
            )}
          </div>
          <ChevronRight
            size={12}
            className={cn(
              'transition-transform duration-200',
              isPromptOpen && 'rotate-90'
            )}
          />
        </button>
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
          <p className="text-[10px] font-mono text-zinc-500 mt-1">
            {customPrompt && customPrompt.trim()
              ? t('canvasNodes.mockupNode.customPromptOverride')
              : t('canvasNodes.mockupNode.editPromptHint')}
          </p>
        </div>
      )}

      {/* Color & Human Section - Collapsable */}
      <div className="mb-2">
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsColorSectionOpen(!isColorSectionOpen);
          }}
          onMouseDown={(e) => e.stopPropagation()}
          disabled={isLoading}
          className={cn(
            'w-full flex items-center justify-between p-1.5 rounded border transition-all text-left node-interactive',
            'bg-zinc-900/50 border-zinc-700/50 hover:bg-zinc-800/50 hover:border-zinc-600/50',
            'text-zinc-400 hover:text-[#52ddeb]',
            isLoading && 'opacity-50 cursor-not-allowed'
          )}
        >
          <div className="flex items-center gap-3">
            <Settings size={12} className="text-zinc-500" />
            <span className="text-xs font-mono">{t('canvasNodes.mockupNode.advancedControls')}</span>
            {(selectedColors.length > 0 || withHuman) && (
              <span className="text-[10px] text-[#52ddeb]">
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
        </button>

        {isColorSectionOpen && (
          <div className="mt-3 space-y-3">
            {/* Color Picker */}
            <div>
              <h4 className="text-xs font-mono mb-1.5 text-zinc-500">{t('canvasNodes.mockupNode.colorPalette')}</h4>
              <div className="flex gap-3">
                <div className="flex-grow relative flex items-center">
                  <input
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
                    className="w-full p-1.5 rounded-md border focus:outline-none focus:border-[#52ddeb]/50 focus:ring-0 text-xs font-mono transition-colors duration-200 pl-7 bg-zinc-900/50 border-zinc-700/50 text-zinc-400"
                    placeholder={t('canvasNodes.mockupNode.colorPlaceholder')}
                    disabled={isLoading}
                    style={{ pointerEvents: 'auto' }}
                  />
                  {(isValidColor || !colorInput) && (
                    <span
                      className="absolute left-2 w-3 h-3 rounded-md border border-zinc-600"
                      style={{ backgroundColor: isValidColor ? colorInput : '#52ddeb' }}
                    ></span>
                  )}
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAddColor();
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                  disabled={isLoading || !isValidColor}
                  className={cn(
                    'px-2 rounded-md border text-xs font-mono transition-colors node-interactive',
                    'bg-zinc-800/50 text-zinc-400 border-zinc-700/50 hover:bg-zinc-700/50 hover:text-zinc-300',
                    (isLoading || !isValidColor) && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  {t('canvasNodes.mockupNode.add')}
                </button>
              </div>
              {selectedColors.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-1.5 min-h-[24px]">
                  {selectedColors.map(color => (
                    <div key={color} className="flex items-center gap-1 pl-1.5 pr-0.5 py-0.5 rounded-md border text-xs bg-zinc-900/80 border-zinc-700">
                      <span
                        className="w-2.5 h-2.5 rounded-md border border-white/10"
                        style={{ backgroundColor: color }}
                      ></span>
                      <span className="font-mono text-[10px]">{color}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveColor(color);
                        }}
                        onMouseDown={(e) => e.stopPropagation()}
                        className="rounded-md text-zinc-500 hover:text-white transition-colors node-interactive"
                      >
                        <X size={10} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Human Interaction Checkbox */}
            <div>
              <div
                className={cn(
                  "flex items-center p-1.5 rounded-md cursor-pointer border bg-zinc-900/50 border-zinc-700/50 hover:bg-zinc-800/50 transition-colors",
                  "node-interactive"
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  handleWithHumanChange(!withHuman);
                }}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <div className={cn(
                  "w-3.5 h-3.5 rounded-md flex items-center justify-center border transition-all duration-200",
                  withHuman ? 'bg-[#52ddeb]/80 border-[#52ddeb]' : 'bg-zinc-700 border-zinc-600'
                )}>
                  {withHuman && (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-2.5 w-2.5 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <label className="ml-2 text-xs select-none cursor-pointer text-zinc-400 font-mono">{t('canvasNodes.mockupNode.includeHumanInteraction')}</label>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Generate Button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          handleGenerate();
        }}
        onMouseDown={(e) => {
          e.stopPropagation();
        }}
        disabled={isLoading || !hasConnectedImage}
        className={cn(
          'w-full px-2 py-1.5 bg-[#52ddeb]/20 hover:bg-[#52ddeb]/30 border border-[#52ddeb]/30 rounded text-xs font-mono text-[#52ddeb] transition-colors flex items-center justify-center gap-3 node-interactive',
          (isLoading || !hasConnectedImage) ? 'opacity-50 node-button-disabled' : 'node-button-enabled'
        )}
        title={!hasConnectedImage ? t('canvasNodes.mockupNode.connectBrandCoreHint') : undefined}
      >
        {isLoading ? (
          <>
            <Loader2 size={14} className="animate-spin" />
            {t('canvasNodes.mockupNode.generating')}
          </>
        ) : (
          <>
            <ImageIcon size={14} />
            {t('canvasNodes.mockupNode.generateMockup')}
          </>
        )}
      </button>



      {/* Add Mockup Button */}
      <div className="mt-2 pt-2 border-t border-zinc-700/30 flex justify-center">
        <button
          onClick={(e) => {
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
            'w-6 h-6 flex items-center justify-center rounded-md border transition-all node-interactive',
            'bg-zinc-900/50 border-zinc-700/50 hover:bg-zinc-800/50 hover:border-zinc-600/50',
            'text-zinc-400 hover:text-[#52ddeb]',
            isLoading && 'opacity-50 cursor-not-allowed'
          )}
          title={t('canvasNodes.mockupNode.addAnotherMockupNode')}
        >
          <Plus size={12} />
        </button>
      </div>

      {/* Preset Selection Modal */}
      <MockupPresetModal
        isOpen={isPresetModalOpen}
        selectedPresetId={selectedPresetId}
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
    prevProps.data.isValidColor === nextProps.data.isValidColor
  );
});

MockupNode.displayName = 'MockupNode';

