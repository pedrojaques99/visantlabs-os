import React, { ComponentType, memo, useCallback, useEffect, useState, useRef } from 'react';
import { type NodeProps, type Node, NodeResizer, Position, useNodes } from '@xyflow/react';
import { ChevronDown, type LucideIcon, Diamond, LayoutGrid, Palette } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ConnectedImagesDisplay } from '../ConnectedImagesDisplay';
import { GlitchLoader } from '@/components/ui/GlitchLoader';
import { NodeHandles } from './NodeHandles';
import { NodeContainer } from './NodeContainer';
import { useTranslation } from '@/hooks/useTranslation';
import { useNodeResize } from '@/hooks/canvas/useNodeResize';
import { NodeButton } from './node-button';
import { NodeLabel } from './NodeLabel';
import { NodeHeader } from './node-header';
import { Tooltip } from '@/components/ui/Tooltip';
import { BrandMediaLibraryModal } from '../modals/BrandMediaLibraryModal';
import { useLinkedGuidelineId } from '@/components/canvas/CanvasHeaderContext';
import { toast } from 'sonner';

interface PresetItem {
    id: string;
    name: string;
    description?: string;
    prompt?: string;
}

interface GenericPresetNodeConfig<TPresetType extends string, TNodeData> {
    // Node configuration
    icon: LucideIcon;
    title: string;
    defaultPresetId: TPresetType;

    // Preset management
    getAllPresets: () => PresetItem[];
    getPreset: (id: TPresetType) => PresetItem | undefined;

    // Modal component - accepts any modal with compatible props
    PresetModal: ComponentType<any>;

    // Data accessors
    getSelectedPreset: (data: TNodeData) => TPresetType | string | undefined;
    getConnectedImage: (data: TNodeData) => string | undefined;
    getResultImageUrl: (data: TNodeData) => string | undefined;
    getResultImageBase64: (data: TNodeData) => string | undefined;
    getIsLoading: (data: TNodeData) => boolean | undefined;
    getOnGenerate: (data: TNodeData) => ((nodeId: string, imageBase64: string, presetId: string) => Promise<void>) | undefined;
    getOnUpdateData: (data: TNodeData) => ((nodeId: string, newData: Partial<TNodeData>) => void) | undefined;

    // Translation keys
    translationKeys: {
        title: string;
        selectPreset: string;
        inputImage: string;
        connectImageNode: string;
        generating: string;
        generateButton: string;
        result: string;
    };

    // Node name for logging
    nodeName: string;
}

export function createGenericPresetNode<TPresetType extends string, TNodeData extends Record<string, any>>(
    config: GenericPresetNodeConfig<TPresetType, TNodeData>
) {
    const GenericPresetNodeComponent: React.FC<NodeProps<Node<TNodeData>>> = ({ data, selected, id, dragging }) => {
        const { t } = useTranslation();
        const nodes = useNodes();
        const linkedGuidelineId = useLinkedGuidelineId();
        const { handleResize: handleResizeWithDebounce, fitToContent } = useNodeResize();
        const [selectedPresetId, setSelectedPresetId] = useState<TPresetType | string>(
            (config.getSelectedPreset(data) as TPresetType | string) || config.defaultPresetId
        );
        const [isPresetModalOpen, setIsPresetModalOpen] = useState(false);
        const [showMediaLibrary, setShowMediaLibrary] = useState(false);
        const containerRef = useRef<HTMLDivElement>(null);

        const isLoading = config.getIsLoading(data) || false;
        const resultImageUrl = config.getResultImageUrl(data);
        const resultImageBase64 = config.getResultImageBase64(data);
        const hasResult = !!(resultImageUrl || resultImageBase64);
        const connectedImage = config.getConnectedImage(data);
        const hasConnectedImage = !!connectedImage;

        const selectedPreset = config.getPreset(selectedPresetId as TPresetType);
        const Icon = config.icon;
        const PresetModal = config.PresetModal;

        // Sync preset with data
        useEffect(() => {
            const dataPreset = config.getSelectedPreset(data);
            if (dataPreset && dataPreset !== selectedPresetId) {
                setSelectedPresetId(dataPreset as TPresetType);
            }
        }, [config.getSelectedPreset(data)]);

        const handlePresetChange = (presetId: string | TPresetType) => {
            setSelectedPresetId(presetId);
            const onUpdateData = config.getOnUpdateData(data);
            if (onUpdateData) {
                onUpdateData(id, { selectedPreset: presetId } as unknown as Partial<TNodeData>);
            }
        };

        const handleGenerate = async () => {
            const onGenerate = config.getOnGenerate(data);
            if (!onGenerate || !connectedImage) {
                return;
            }

            await onGenerate(id, connectedImage, selectedPresetId);
        };

        const handleOpenMediaLibrary = () => {
            setShowMediaLibrary(true);
        };

        const handleSelectAsset = (url: string, type: 'image' | 'logo') => {
            const onUpdateData = config.getOnUpdateData(data);
            if (onUpdateData) {
                onUpdateData(id, { connectedImage: url } as any);
            }
            setShowMediaLibrary(false);
        };

        const handleFitToContent = useCallback(() => {
            const width = data.imageWidth as number;
            const height = data.imageHeight as number;
            if (width && height) {
                // Calculate a reasonable size if image is too large
                let targetWidth = width;
                let targetHeight = height;
                const MAX_FIT_WIDTH = 1200;

                if (targetWidth > MAX_FIT_WIDTH) {
                    const ratio = MAX_FIT_WIDTH / targetWidth;
                    targetWidth = MAX_FIT_WIDTH;
                    targetHeight = targetHeight * ratio;
                }

                fitToContent(id, Math.round(targetWidth), Math.round(targetHeight), data.onResize as any);
            } else {
                // For nodes without result image yet, just reset to original width/auto height
                fitToContent(id, 320, 'auto', data.onResize as any);
            }
        }, [id, data.imageWidth, data.imageHeight, data.onResize, fitToContent]);

        const handleResize = useCallback((_: any, params: { width: number; height: number }) => {
            const { width } = params;
            handleResizeWithDebounce(id, width, 'auto', data.onResize as any);
        }, [id, data.onResize, handleResizeWithDebounce]);

        return (
            <NodeContainer
                containerRef={containerRef}
                selected={selected}
                dragging={dragging}
                onFitToContent={handleFitToContent}
                className="min-w-[320px]"
                onContextMenu={(e) => {
                    // Allow ReactFlow to handle the context menu event
                }}
            >
                {selected && !dragging && (
                    <NodeResizer
                        color="brand-cyan"
                        isVisible={selected}
                        minWidth={320}
                        minHeight={200}
                        maxWidth={2000}
                        maxHeight={2000}
                        keepAspectRatio={hasResult}
                        onResize={handleResize}
                    />
                )}
                <NodeHandles />

                {/* Header */}
                <NodeHeader
                    icon={Icon}
                    title={t(config.translationKeys.title) || config.title}
                    selected={selected}
                    isBrandActive={data.isBrandActive}
                    onToggleBrand={(active) => {
                        const onUpdateData = config.getOnUpdateData(data);
                        if (onUpdateData) {
                            onUpdateData(id, { isBrandActive: active } as any);
                        }
                    }}
                    onOpenMediaLibrary={handleOpenMediaLibrary}
                />

                {/* Preset Selector - Button to open modal */}
                <div className="node-margin">
                    <NodeButton variant="ghost" size="full"
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
                            'bg-foreground/10 border-foreground/40 hover:bg-foreground/15',
                            isLoading && 'opacity-50 cursor-not-allowed'
                        )}
                    >
                        {selectedPreset?.id ? (
                            <div className="w-10 h-10 bg-neutral-900/30 border border-neutral-700/30 rounded flex items-center justify-center flex-shrink-0 overflow-hidden">
                                <Icon size={14} className="text-neutral-400" />
                            </div>
                        ) : (
                            <div className="w-10 h-10 bg-neutral-900/30 border border-neutral-700/30 rounded flex items-center justify-center flex-shrink-0">
                                <Icon size={14} className="text-neutral-400" />
                            </div>
                        )}
                        <div className="flex-1 min-w-0">
                            <div className="text-xs font-mono truncate text-foreground font-semibold">
                                {selectedPreset?.name || t(config.translationKeys.selectPreset) || `Select ${config.title.toLowerCase()}`}
                            </div>
                            {selectedPreset?.description && (
                                <div className="text-[10px] font-mono text-neutral-500 truncate">
                                    {selectedPreset.description}
                                </div>
                            )}
                        </div>
                        <ChevronDown size={14} className="text-neutral-400 flex-shrink-0" />
                    </NodeButton>
                </div>

                {/* Connected Image Thumbnail */}
                <ConnectedImagesDisplay
                    images={[connectedImage]}
                    label={t(config.translationKeys.inputImage)}
                    showLabel={hasConnectedImage}
                />

                {!hasConnectedImage && (
                    <div className="mb-2">
                        <span className="text-xs font-mono text-neutral-500">
                            {t(config.translationKeys.connectImageNode) || 'Connect an image node'}
                        </span>
                    </div>
                )}

                {/* Generate Button */}
                <Tooltip 
                    content={`${t('canvasNodes.promptNode.creditsRequired') || 'Costs'} 2 ${t('canvasNodes.promptNode.credits')}`}
                    delay={500}
                >
                    <NodeButton variant="primary" size="full"
                        onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            handleGenerate();
                        }}
                        onMouseDown={(e) => {
                            e.stopPropagation();
                        }}
                        disabled={isLoading || !hasConnectedImage}
                        className="node-interactive group/gen"
                    >
                        {isLoading ? (
                            <div className="flex items-center justify-center gap-2">
                                <GlitchLoader size={14} color="brand-cyan" />
                                <span className="animate-pulse">{t(config.translationKeys.generating) || 'Generating...'}</span>
                            </div>
                        ) : (
                            <div className="flex items-center justify-center gap-2">
                                <Icon size={14} className="group-hover/gen:rotate-12 transition-transform" />
                                <span className="font-semibold tracking-tight">{t(config.translationKeys.generateButton) || `Generate ${config.title}`}</span>
                                <div className="flex items-center gap-1 ml-1 px-1.5 py-0.5 rounded-full bg-black/20 text-[10px] text-foreground/80">
                                    <Diamond size={10} className="opacity-50 fill-current" />
                                    2
                                </div>
                            </div>
                        )}
                    </NodeButton>
                </Tooltip>

                {/* Result Preview */}
                {hasResult && (resultImageUrl || resultImageBase64) && (
                    <div className="mt-2 pt-2 border-t border-neutral-700/30">
                        <img
                            src={resultImageUrl || (resultImageBase64 ? `data:image/png;base64,${resultImageBase64}` : '')}
                            alt={t(config.translationKeys.result) || `${config.title} result`}
                            className="w-full h-auto rounded"
                            onLoad={(e) => {
                                const img = e.target as HTMLImageElement;
                                if (img.naturalWidth > 0 && img.naturalHeight > 0) {
                                    const onUpdateData = config.getOnUpdateData(data);
                                    if (onUpdateData) {
                                        onUpdateData(id, {
                                            imageWidth: img.naturalWidth,
                                            imageHeight: img.naturalHeight,
                                        } as any);
                                    }
                                }
                            }}
                        />
                    </div>
                )}

                {/* Preset Selection Modal */}
                <PresetModal
                    isOpen={isPresetModalOpen}
                    selectedPresetId={selectedPresetId}
                    onClose={() => setIsPresetModalOpen(false)}
                    onSelectPreset={(presetId: string) => {
                        handlePresetChange(presetId);
                    }}
                    isLoading={isLoading}
                />

                <BrandMediaLibraryModal
                    isOpen={showMediaLibrary}
                    onClose={() => setShowMediaLibrary(false)}
                    onSelectAsset={handleSelectAsset}
                    guidelineId={linkedGuidelineId}
                />
            </NodeContainer>
        );
    };

    return memo(GenericPresetNodeComponent, (prevProps, nextProps) => {
        const prevConnectedImage = config.getConnectedImage(prevProps.data) ?? undefined;
        const nextConnectedImage = config.getConnectedImage(nextProps.data) ?? undefined;
        const connectedImageChanged = prevConnectedImage !== nextConnectedImage;

        if (connectedImageChanged) {
            return false;
        }

        return (
            prevProps.id === nextProps.id &&
            prevProps.selected === nextProps.selected &&
            prevProps.dragging === nextProps.dragging &&
            config.getIsLoading(prevProps.data) === config.getIsLoading(nextProps.data) &&
            config.getSelectedPreset(prevProps.data) === config.getSelectedPreset(nextProps.data) &&
            config.getResultImageUrl(prevProps.data) === config.getResultImageUrl(nextProps.data) &&
            config.getResultImageBase64(prevProps.data) === config.getResultImageBase64(nextProps.data)
        );
    });
}
