import React, { useState, useEffect, useRef } from 'react';
import { cn } from '../../lib/utils';
import { useTranslation } from '../../hooks/useTranslation';
import type { Node } from '@xyflow/react';
import type { FlowNodeData } from '../../types/reactFlow';
import { MessageSquare, Settings, X, Palette, Share, ChevronRight, Brush } from 'lucide-react';

// Import child components
import { ShaderControlsSidebar } from './ShaderControlsSidebar';
import { ChatSidebar } from './ChatSidebar';
import { ExportPanel } from '../ui/ExportPanel';

interface UniversalSidePanelProps {
    selectedNodes: Node<FlowNodeData>[];
    isOpen: boolean;
    onClose: () => void;
    width?: number; // Optional initial width
    onResize?: (width: number) => void;

    // Handlers
    onUpdateNode: (nodeId: string, newData: any) => void;

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
const COLLAPSED_WIDTH = 56;

// Registry configuration type
interface PanelConfig {
    component: React.FC<any>;
    title: string;
    icon: React.ComponentType<any>;
    className?: string;
    autoOpen?: boolean;
}

// Registry of supported node types
const PANEL_REGISTRY: Record<string, PanelConfig> = {
    'shader': {
        component: ShaderControlsSidebar,
        title: 'Shader Controls',
        icon: Brush,
        autoOpen: true
    },
    'chat': {
        component: ChatSidebar,
        title: 'Chat Assistant',
        icon: MessageSquare,
        autoOpen: false
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
    overridePanel
}) => {
    const { t } = useTranslation();
    const [panelWidth, setPanelWidth] = useState(width);
    const [activeTabId, setActiveTabId] = useState<string | null>(null);
    const resizerRef = useRef<HTMLDivElement>(null);
    const sidebarRef = useRef<HTMLDivElement>(null);
    const [isResizing, setIsResizing] = useState(false);

    // Filter selected nodes to those that have a registered panel
    const validNodes = selectedNodes.filter(node => PANEL_REGISTRY[node.type || '']);

    // Determine if we should show content
    const showContent = isOpen && (validNodes.length > 0 || !!overridePanel);
    const isCollapsed = !isOpen;

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
        if (!resizer || isCollapsed) return;

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
    }, [isCollapsed, onResize, panelWidth]);

    // Determine what to render
    const renderContent = () => {
        if (overridePanel) {
            // Export Panel or other overrides
            if (overridePanel.type === 'export') {
                const { nodeId, nodeName, imageUrl, nodeType } = overridePanel.data;
                return (
                    <div className="h-full flex flex-col">
                        <div className="flex items-center justify-between p-4 border-b border-zinc-700/30">
                            <div className="flex items-center gap-2">
                                <Share size={16} className="text-brand-cyan" />
                                <h3 className="text-sm font-semibold text-zinc-200">Export</h3>
                            </div>
                            <button onClick={overridePanel.onClose} className="text-zinc-400 hover:text-zinc-200">
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
                isCollapsed={false} // Always expanded inside the panel
                // Forward width props if needed by child
                width={panelWidth}
            />
        );
    };

    if (!isOpen && validNodes.length === 0 && !overridePanel) return null;

    return (
        <aside
            ref={sidebarRef}
            className={cn(
                "fixed right-0 top-[65px] h-[calc(100vh-65px)] z-40",
                "bg-zinc-950/80 backdrop-blur-xl border-l border-zinc-800",
                "transition-all duration-300 ease-out flex flex-col shadow-2xl",
                isResizing ? "transition-none select-none" : ""
            )}
            style={{
                width: isOpen ? `${panelWidth}px` : `${COLLAPSED_WIDTH}px`,
            }}
        >
            {/* Resizer Handle */}
            {isOpen && (
                <div
                    ref={resizerRef}
                    className="absolute left-0 top-0 w-1 h-full cursor-col-resize hover:bg-brand-cyan/50 transition-colors z-50"
                />
            )}

            {/* Tabs / Header */}
            {isOpen && validNodes.length > 1 && !overridePanel && (
                <div className="flex items-center overflow-x-auto border-b border-zinc-800 scrollbar-hide">
                    {validNodes.map(node => {
                        const conf = PANEL_REGISTRY[node.type || ''];
                        const Icon = conf?.icon || Settings;
                        const isActive = node.id === activeTabId;

                        return (
                            <button
                                key={node.id}
                                onClick={() => setActiveTabId(node.id)}
                                className={cn(
                                    "flex items-center gap-2 px-4 py-3 text-xs font-medium border-b-2 transition-colors min-w-[100px]",
                                    isActive
                                        ? "border-brand-cyan text-brand-cyan bg-brand-cyan/5"
                                        : "border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
                                )}
                            >
                                <Icon size={14} />
                                <span className="truncate max-w-[80px]">{node.data.label || conf?.title || 'Node'}</span>
                            </button>
                        );
                    })}
                </div>
            )}

            {/* Main Content Area */}
            <div className="flex-1 overflow-hidden relative">
                {isOpen ? renderContent() : (
                    // Collapsed State Icons
                    <div className="flex flex-col items-center py-4 gap-4">
                        <button onClick={onClose} className="p-2 text-zinc-500 hover:text-zinc-300">
                            <Settings size={20} />
                        </button>
                        {/* Add more collapsed state indicators if needed */}
                    </div>
                )}
            </div>

            {/* Collapsed Toggle Button (if we want manual toggle from collapsed state) */}
            {!isOpen && (
                <button
                    onClick={onClose} // Re-open or toggle
                    className="absolute left-0 top-0 w-full h-full flex items-center justify-center hover:bg-zinc-800/50"
                >
                    <ChevronRight size={20} className="text-zinc-500 rotate-180" />
                </button>
            )}
        </aside>
    );
};
