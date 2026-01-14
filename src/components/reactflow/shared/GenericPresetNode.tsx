import { type NodeProps, type Node, NodeResizer } from '@xyflow/react';
import { ChevronDown, LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ConnectedImagesDisplay } from '../ConnectedImagesDisplay';
import { GlitchLoader } from '@/components/ui/GlitchLoader';
import { NodeHandles } from './NodeHandles';
import { NodeContainer } from './NodeContainer';
import { useTranslation } from '@/hooks/useTranslation';
import { useNodeResize } from '@/hooks/canvas/useNodeResize';
import { ComponentType, memo, useCallback, useEffect, useState } from 'react';

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
        const { handleResize: handleResizeWithDebounce, fitToContent } = useNodeResize();
        const [selectedPresetId, setSelectedPresetId] = useState<TPresetType | string>(
            (config.getSelectedPreset(data) as TPresetType | string) || config.defaultPresetId
        );
        const [isPresetModalOpen, setIsPresetModalOpen] = useState(false);

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
            if (!onGenerate) {
                return;
            }

            if (!connectedImage) {
                console.warn(`[${config.nodeName}] No connected image available`);
                return;
            }

            console.log(`[${config.nodeName}] Generating with:`, {
                nodeId: id,
                presetId: selectedPresetId,
                hasConnectedImage: !!connectedImage,
                imageType: connectedImage?.startsWith('http') ? 'URL' : connectedImage?.startsWith('data:') ? 'dataURL' : 'base64',
            });

            await onGenerate(id, connectedImage, selectedPresetId);
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

        const handleResize = useCallback((width: number, height: number) => {
            handleResizeWithDebounce(id, width, height, data.onResize as any);
        }, [id, data.onResize, handleResizeWithDebounce]);

        return (
            <NodeContainer
                selected={selected}
                dragging={dragging}
                onFitToContent={handleFitToContent}
                className="p-5"
                style={{
                    width: '320px',
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
                        minWidth={320}
                        minHeight={200}
                        maxWidth={2000}
                        maxHeight={2000}
                        keepAspectRatio={hasResult}
                        onResize={(_, { width, height }) => handleResize(width, height)}
                    />
                )}
                <NodeHandles />

                {/* Header */}
                <div className="flex items-center gap-3 mb-3">
                    <Icon size={16} className="text-brand-cyan" />
                    <h3 className="text-xs font-semibold text-neutral-300 font-mono uppercase">
                        {t(config.translationKeys.title) || config.title}
                    </h3>
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
                            'bg-brand-cyan/10 border-[brand-cyan]/50 hover:bg-brand-cyan/15',
                            isLoading && 'opacity-50 cursor-not-allowed'
                        )}
                    >
                        <div className="w-10 h-10 bg-neutral-900/30 border border-neutral-700/30 rounded flex items-center justify-center flex-shrink-0">
                            <Icon size={14} className="text-neutral-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="text-xs font-mono truncate text-brand-cyan">
                                {selectedPreset?.name || t(config.translationKeys.selectPreset) || `Select ${config.title.toLowerCase()}`}
                            </div>
                            {selectedPreset?.description && (
                                <div className="text-[10px] font-mono text-neutral-500 truncate">
                                    {selectedPreset.description}
                                </div>
                            )}
                        </div>
                        <ChevronDown size={14} className="text-neutral-400 flex-shrink-0" />
                    </button>
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
                        'w-full px-2 py-1.5 bg-brand-cyan/20 hover:bg-brand-cyan/30 border border-[brand-cyan]/30 rounded text-xs font-mono text-brand-cyan transition-colors flex items-center justify-center gap-3 node-interactive',
                        (isLoading || !hasConnectedImage) ? 'opacity-50 node-button-disabled' : 'node-button-enabled'
                    )}
                >
                    {isLoading ? (
                        <>
                            <GlitchLoader size={14} className="mr-1" color="brand-cyan" />
                            {t(config.translationKeys.generating) || 'Generating...'}
                        </>
                    ) : (
                        <>
                            <Icon size={14} />
                            {t(config.translationKeys.generateButton) || `Generate ${config.title}`}
                        </>
                    )}
                </button>

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
                    onSelectPreset={(presetId) => {
                        handlePresetChange(presetId);
                    }}
                    isLoading={isLoading}
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
