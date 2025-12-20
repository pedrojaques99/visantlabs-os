import React from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronDown, ChevronUp, Users, LucideIcon } from 'lucide-react';
import { getCommunityPresetsByType } from '../../services/communityPresetsService';
import { cn } from '../../lib/utils';

interface PresetItem {
    id: string;
    name: string;
    description?: string;
    prompt?: string;
    thumbnail?: string;
}

interface GenericPresetModalProps<T extends string> {
    isOpen: boolean;
    selectedPresetId: T | string;
    onClose: () => void;
    onSelectPreset: (presetId: T | string) => void;
    isLoading?: boolean;

    // Configuration
    title: string;
    icon: LucideIcon;
    officialPresets: PresetItem[];
    communityPresetType: 'ambience' | 'angle' | 'luminance' | 'texture';
    fallbackIcon: LucideIcon;
}

export function GenericPresetModal<T extends string>({
    isOpen,
    selectedPresetId,
    onClose,
    onSelectPreset,
    isLoading = false,
    title,
    icon: Icon,
    officialPresets,
    communityPresetType,
    fallbackIcon: FallbackIcon,
}: GenericPresetModalProps<T>) {
    const [communityPresets, setCommunityPresets] = React.useState<any[]>([]);
    const [isLoadingCommunityPresets, setIsLoadingCommunityPresets] = React.useState(false);
    const [expandedPrompts, setExpandedPrompts] = React.useState<Set<string>>(new Set());
    const [activeTab, setActiveTab] = React.useState<'official' | 'community'>('official');

    const togglePrompt = (presetId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setExpandedPrompts((prev) => {
            const next = new Set(prev);
            if (next.has(presetId)) {
                next.delete(presetId);
            } else {
                next.add(presetId);
            }
            return next;
        });
    };

    // Load community presets when modal opens
    React.useEffect(() => {
        if (!isOpen) {
            setCommunityPresets([]);
            return;
        }

        const fetchCommunityPresets = async () => {
            setIsLoadingCommunityPresets(true);
            try {
                const community = await getCommunityPresetsByType(communityPresetType);
                setCommunityPresets(community);
            } catch (error) {
                console.error(`Failed to load community ${communityPresetType} presets:`, error);
                setCommunityPresets([]);
            } finally {
                setIsLoadingCommunityPresets(false);
            }
        };

        fetchCommunityPresets();
    }, [isOpen, communityPresetType]);

    React.useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };

        if (isOpen) {
            document.body.style.overflow = 'hidden';
            window.addEventListener('keydown', handleKeyDown);

            const modalElement = document.getElementById('preset-modal');
            if (modalElement) {
                modalElement.focus();
            }

            return () => {
                document.body.style.overflow = '';
                window.removeEventListener('keydown', handleKeyDown);
            };
        }
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const renderPresetCard = (preset: PresetItem, isCommunity: boolean = false) => {
        const isSelected = preset.id === selectedPresetId;
        const isPromptExpanded = expandedPrompts.has(preset.id);

        return (
            <div
                key={`${isCommunity ? 'community-' : ''}${preset.id}`}
                className={cn(
                    'flex flex-col rounded-md border transition-all overflow-hidden group',
                    isSelected
                        ? 'bg-[#52ddeb]/10 border-[#52ddeb]/50 hover:bg-[#52ddeb]/15'
                        : 'bg-zinc-900/30 border-zinc-700/30 hover:bg-zinc-900/50 hover:border-zinc-600/50',
                    isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                )}
            >
                {/* Thumbnail */}
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        if (!isLoading) {
                            onSelectPreset(preset.id as T);
                            onClose();
                        }
                    }}
                    disabled={isLoading}
                    className={cn(
                        "relative w-full aspect-square bg-zinc-900/30 border-b border-zinc-700/30 overflow-hidden flex-shrink-0",
                        !isLoading && "cursor-pointer"
                    )}
                >
                    <div className="w-full h-full flex items-center justify-center bg-zinc-900/50">
                        <FallbackIcon size={40} className="text-zinc-500" />
                    </div>
                    {/* Selection Indicator */}
                    {isSelected && (
                        <div className="absolute top-2 right-2 w-3 h-3 bg-[#52ddeb] rounded-md border-2 border-black" />
                    )}
                    {/* Community Badge */}
                    {isCommunity && (
                        <div className="absolute top-2 left-2 px-1.5 py-0.5 bg-[#52ddeb]/20 border border-[#52ddeb]/30 rounded text-[8px] font-mono text-[#52ddeb]">
                            Community
                        </div>
                    )}
                </button>

                {/* Name and Prompt Section */}
                <div className="flex flex-col p-3 min-h-[80px]">
                    {/* Name */}
                    <div className={cn(
                        'text-sm font-mono font-semibold mb-2 line-clamp-2 leading-tight',
                        isSelected ? 'text-[#52ddeb]' : 'text-zinc-200'
                    )}>
                        {preset.name}
                    </div>

                    {/* Description */}
                    {preset.description && (
                        <div className="text-[10px] text-zinc-500 font-mono mb-2 line-clamp-2">
                            {preset.description}
                        </div>
                    )}

                    {/* Collapsible Prompt */}
                    {preset.prompt && (
                        <div className="flex-1 flex flex-col min-h-0">
                            <button
                                onClick={(e) => togglePrompt(preset.id, e)}
                                className="flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-300 transition-colors mb-1"
                                aria-expanded={isPromptExpanded}
                            >
                                <span className="text-[10px] uppercase font-mono">Prompt</span>
                                {isPromptExpanded ? (
                                    <ChevronUp size={12} className="flex-shrink-0" />
                                ) : (
                                    <ChevronDown size={12} className="flex-shrink-0" />
                                )}
                            </button>
                            {isPromptExpanded && (
                                <div className="text-[10px] text-zinc-500 font-mono leading-relaxed overflow-y-auto max-h-24">
                                    {preset.prompt}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        );
    };

    const modalContent = (
        <div
            id="preset-modal"
            tabIndex={-1}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4"
            style={{ animation: 'fadeIn 0.2s ease-out' }}
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-labelledby="preset-modal-title"
        >
            <div
                className="relative max-w-4xl w-full max-h-[90vh] bg-black/95 backdrop-blur-xl border border-zinc-800/50 rounded-md shadow-2xl overflow-hidden flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-zinc-800/50">
                    <div className="flex items-center gap-2">
                        <Icon size={20} className="text-[#52ddeb]" />
                        <h2 id="preset-modal-title" className="text-sm font-mono text-zinc-300 uppercase">{title}</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-zinc-500 hover:text-white transition-colors"
                        title="Close (Esc)"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex gap-2 px-4 pt-4 border-b border-zinc-800/50">
                    <button
                        onClick={() => setActiveTab('official')}
                        className={cn(
                            'px-4 py-2 text-xs font-mono uppercase transition-all duration-200 border-b-2 relative',
                            activeTab === 'official'
                                ? 'text-[#52ddeb] border-[#52ddeb]'
                                : 'text-zinc-400 border-transparent hover:text-zinc-300 hover:border-zinc-600/50'
                        )}
                    >
                        Official ({officialPresets.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('community')}
                        className={cn(
                            'px-4 py-2 text-xs font-mono uppercase transition-all duration-200 border-b-2 flex items-center gap-1.5 relative',
                            activeTab === 'community'
                                ? 'text-[#52ddeb] border-[#52ddeb]'
                                : 'text-zinc-400 border-transparent hover:text-zinc-300 hover:border-zinc-600/50'
                        )}
                    >
                        <Users size={12} />
                        Community ({communityPresets.length})
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 relative">
                    {/* Official Presets Tab */}
                    <div
                        className={cn(
                            'transition-all duration-300 ease-in-out',
                            activeTab === 'official'
                                ? 'opacity-100 translate-y-0'
                                : 'opacity-0 translate-y-2 absolute inset-0 pointer-events-none'
                        )}
                    >
                        <div>
                            <h3 className="text-xs font-mono text-zinc-400 uppercase mb-4">{title}s</h3>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                                {officialPresets.map((preset) => renderPresetCard(preset, false))}
                            </div>
                        </div>
                    </div>

                    {/* Community Presets Tab */}
                    <div
                        className={cn(
                            'transition-all duration-300 ease-in-out',
                            activeTab === 'community'
                                ? 'opacity-100 translate-y-0'
                                : 'opacity-0 translate-y-2 absolute inset-0 pointer-events-none'
                        )}
                    >
                        <div>
                            <div className="flex items-center gap-2 mb-4">
                                <Users size={14} className="text-[#52ddeb]" />
                                <h3 className="text-xs font-mono text-zinc-400 uppercase">Community Presets</h3>
                            </div>
                            {isLoadingCommunityPresets ? (
                                <div className="flex items-center justify-center py-12">
                                    <p className="text-sm font-mono text-zinc-400">Loading community presets...</p>
                                </div>
                            ) : communityPresets.length === 0 ? (
                                <div className="flex items-center justify-center py-12">
                                    <p className="text-sm font-mono text-zinc-400">Nenhum preset encontrado</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                                    {communityPresets.map((preset: any) => renderPresetCard(preset, true))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
}
