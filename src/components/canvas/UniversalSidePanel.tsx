import React, { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/hooks/useTranslation';
import type { Node } from '@xyflow/react';
import type { FlowNodeData } from '@/types/reactFlow';
import { MessageSquare, Settings, X, Share, Brush } from 'lucide-react';

// Import child components
import { ShaderControlsSidebar } from './ShaderControlsSidebar';
import { ChatSidebar } from './ChatSidebar';
import { ExportPanel } from '@/components/ui/ExportPanel';
import { CommunityPresetsSidebar } from './CommunityPresetsSidebar';

interface UniversalSidePanelProps {
    selectedNodes: Node<FlowNodeData>[];
    isOpen: boolean;
    onClose: () => void;
    width?: number; // Optional initial width
    onResize?: (width: number) => void;

    // Handlers
    onUpdateNode: (nodeId: string, newData: any) => void;

    // Global Panel State
    activeSidePanel?: string | null;
    onImportCommunityPreset?: (preset: any, type: string) => void;

    // Override view (e.g. for manual export trigger)
    overridePanel?: {
        type: 'export';
        data: any;
        onClose: () => void;
    } | null;
}

const DEFAULT_WIDTH = 320;
const MIN_WIDTH = 280;
const MAX_WIDTH = 800;

// Registry configuration type
interface PanelConfig {
    component: React.FC<any>;
    title: string;
    icon: React.ComponentType<any>;
    className?: string;
    autoOpen?: boolean;
    variant?: string;
}

// Registry of supported node types
const PANEL_REGISTRY: Record<string, PanelConfig> = {
    'shader': {
        component: ShaderControlsSidebar,
        title: 'Shader Controls',
        icon: Brush,
        autoOpen: true,
        variant: 'embedded'
    },
    'chat': {
        component: ChatSidebar,
        title: 'Chat Assistant',
        icon: MessageSquare,
        autoOpen: false,
        variant: 'embedded'
    },
    // Add other node types here as needed
};

export const UniversalSidePanel: React.FC<UniversalSidePanelProps> = ({
    selectedNodes,
    isOpen,
    onClose,
    width = DEFAULT_WIDTH,
    onResize,
    onUpdateNode,
    overridePanel,
    activeSidePanel,
    onImportCommunityPreset
}) => {
    const { t } = useTranslation();
    const [panelWidth, setPanelWidth] = useState(width);
    const [activeTabId, setActiveTabId] = useState<string | null>(null);
    const resizerRef = useRef<HTMLDivElement>(null);
    const sidebarRef = useRef<HTMLDivElement>(null);
    const [isResizing, setIsResizing] = useState(false);

    // Filter selected nodes to those that have a registered panel
    const validNodes = selectedNodes.filter(node => PANEL_REGISTRY[node.type || '']);

    // Handle auto-selection of tab when nodes change
    useEffect(() => {
        if (activeTabId && validNodes.find(n => n.id === activeTabId)) {
            return; // Current active tab is still valid
        }

        // Sort logic: embedded auto-open nodes priority? Or just last selected?
        // User requested: "2 - a) Mostra abas para alternar" (Show tabs to switch)
        // We default to the last selected valid node
        if (validNodes.length > 0) {
            setActiveTabId(validNodes[validNodes.length - 1].id);
        } else {
            setActiveTabId(null);
        }
    }, [validNodes.map(n => n.id).join(',')]); // Depend on node IDs list

    // Resizing logic
    useEffect(() => {
        const resizer = resizerRef.current;
        if (!resizer) return;

        const handleMouseDown = (e: MouseEvent) => {
            e.preventDefault();
            setIsResizing(true);
            const startX = e.clientX;
            const startWidth = sidebarRef.current?.offsetWidth || panelWidth;

            const handleMouseMove = (moveEvent: MouseEvent) => {
                const dx = startX - moveEvent.clientX; // Resize from right edge means pulling left increases width
                const newWidth = Math.min(Math.max(startWidth + dx, MIN_WIDTH), MAX_WIDTH);
                setPanelWidth(newWidth);
                onResize?.(newWidth);
            };

            const handleMouseUp = () => {
                setIsResizing(false);
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
            };

            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
        };

        resizer.addEventListener('mousedown', handleMouseDown);
        return () => resizer.removeEventListener('mousedown', handleMouseDown);
    }, [onResize, panelWidth]);

    // Determine what to render
    const renderContent = () => {
        if (overridePanel) {
            // Export Panel or other overrides
            if (overridePanel.type === 'export') {
                const { nodeId, nodeName, imageUrl, nodeType } = overridePanel.data;
                return (
                    <div className="h-full flex flex-col">
                        <div className="flex items-center justify-between p-4 border-b border-neutral-700/30">
                            <div className="flex items-center gap-2">
                                <Share size={16} className="text-brand-cyan" />
                                <h3 className="text-sm font-semibold text-neutral-200">Export</h3>
                            </div>
                            <button onClick={overridePanel.onClose} className="text-neutral-400 hover:text-neutral-200">
                                <X size={16} />
                            </button>
                        </div>
                        <ExportPanel
                            isOpen={true}
                            onClose={overridePanel.onClose}
                            nodeId={nodeId}
                            nodeName={nodeName}
                            imageUrl={imageUrl}
                            nodeType={nodeType}
                            embedded={true} // New prop we will add
                        />
                    </div>
                );
            }
        }

        if (activeSidePanel === 'community-presets') {
            return (
                <div className="h-full">
                    <CommunityPresetsSidebar
                        isOpen={true}
                        variant="embedded"
                        onImportPreset={(preset, type) => {
                            if (onImportCommunityPreset) onImportCommunityPreset(preset, type);
                        }}
                    />
                </div>
            );
        }

        if (validNodes.length === 0) {
            return (
                <div className="h-full flex flex-col items-center justify-center text-neutral-500 p-8 text-center gap-4">
                    <Brush size={32} className="opacity-20" />
                    <div className="flex flex-col gap-1">
                        <h3 className="text-sm font-medium text-neutral-400">No node selected</h3>
                        <p className="text-xs">Select a supported node to view its controls</p>
                    </div>
                </div>
            );
        }

        if (!activeTabId) return null;

        const activeNode = validNodes.find(n => n.id === activeTabId);
        if (!activeNode) return null;

        const config = PANEL_REGISTRY[activeNode.type || ''];
        if (!config) return null;

        const Component = config.component;

        return (
            <Component
                key={activeNode.id}
                nodeId={activeNode.id}
                nodeData={activeNode.data}
                onUpdateData={onUpdateNode}
                variant="embedded" // New variant we will add
                // Forward width props if needed by child
                width={panelWidth}
            />
        );
    };

    if (!isOpen) return null;

    return (
        <aside
            ref={sidebarRef}
            className={cn(
                "fixed right-4 top-[65px] z-40",
                "backdrop-blur-xl border border-neutral-800/50",
                "rounded-2xl shadow-2xl",
                "transition-all duration-300 ease-out flex flex-col",
                "bg-neutral-950/70",
                isResizing ? "transition-none select-none" : ""
            )}
            style={{
                width: `${panelWidth}px`,
                height: 'calc(100vh - 97px)',
                backgroundColor: 'var(--sidebar)',
            }}
        >
            {/* Resizer Handle */}
            <div
                ref={resizerRef}
                className="absolute left-0 top-0 w-1 h-full cursor-col-resize hover:bg-neutral-500/50 transition-colors z-50 rounded-l-2xl"
            />

            {/* Tabs / Header */}
            {!overridePanel && activeSidePanel !== 'community-presets' && (
                <div className="flex items-center justify-between border-b border-neutral-800/50 bg-transparent rounded-t-2xl overflow-hidden">
                    <div className="flex items-center overflow-x-auto scrollbar-hide flex-1 h-[41px]"> {/* Fixed height for consistency */}
                        {validNodes.length > 0 ? (
                            validNodes.map(node => {
                                const conf = PANEL_REGISTRY[node.type || ''];
                                const Icon = conf?.icon || Settings;
                                const isActive = node.id === activeTabId;

                                return (
                                    <button
                                        key={node.id}
                                        onClick={() => setActiveTabId(node.id)}
                                        className={cn(
                                            "flex items-center gap-2 px-4 py-3 text-xs font-medium border-r border-neutral-800/50 transition-colors min-w-[100px] h-full",
                                            isActive
                                                ? "text-neutral-400 bg-neutral-800/5"
                                                : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50"
                                        )}
                                    >
                                        <Icon size={14} />
                                        <span className="truncate max-w-[80px]">{node.data.label || conf?.title || 'Node'}</span>
                                    </button>
                                );
                            })
                        ) : (
                            <div className="px-4 text-xs font-medium text-neutral-500 italic">
                                Controls
                            </div>
                        )}
                    </div>
                    {/* Close Button */}
                    <button
                        onClick={onClose}
                        className="p-3 text-neutral-500 hover:text-neutral-200 border-l border-neutral-800/50 hover:bg-neutral-800/50 transition-colors h-full rounded-tr-2xl"
                    >
                        <X size={16} />
                    </button>
                </div>
            )}

            {/* Global Panel Header for Community Presets */}
            {activeSidePanel === 'community-presets' && (
                <div className="flex items-center justify-between border-b border-neutral-800/50 bg-transparent rounded-t-2xl overflow-hidden h-[41px]">
                    <div className="flex items-center px-4 gap-2 text-neutral-200 font-medium text-xs">
                        {/* We need Users icon imported */}
                        <span className="text-brand-cyan">❖</span>
                        Community Presets
                    </div>
                    <button
                        onClick={onClose}
                        className="p-3 text-neutral-500 hover:text-neutral-200 border-l border-neutral-800/50 hover:bg-neutral-800/50 transition-colors h-full rounded-tr-2xl"
                    >
                        <X size={16} />
                    </button>
                </div>
            )}

            {/* Main Content Area */}
            <div className="flex-1 overflow-hidden relative rounded-b-2xl">
                {renderContent()}
            </div>
        </aside>
    );
};
