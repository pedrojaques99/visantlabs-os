import React, { useState, useEffect } from 'react';
import { Users, Loader2, Image as ImageIcon, Camera, Layers, MapPin, Sun, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
} from '../ui/sheet';
import { cn } from '../../lib/utils';
import { getAllCommunityPresets } from '../../services/communityPresetsService';
import { useTranslation } from '../../hooks/useTranslation';
import type { MockupPreset } from '../../types/mockupPresets';
import type { AnglePreset } from '../../types/anglePresets';
import type { TexturePreset } from '../../types/texturePresets';
import type { AmbiencePreset } from '../../types/ambiencePresets';
import type { LuminancePreset } from '../../types/luminancePresets';

type PresetType = 'mockup' | 'angle' | 'texture' | 'ambience' | 'luminance';
type CommunityPreset = MockupPreset | AnglePreset | TexturePreset | AmbiencePreset | LuminancePreset;

interface CommunityPresetsSidebarProps {
    isOpen: boolean;
    onClose: () => void;
    onImportPreset: (preset: CommunityPreset, type: PresetType) => void;
}

const getPresetIcon = (type: PresetType) => {
    const icons = {
        mockup: ImageIcon,
        angle: Camera,
        texture: Layers,
        ambience: MapPin,
        luminance: Sun,
    };
    return icons[type];
};

export const CommunityPresetsSidebar: React.FC<CommunityPresetsSidebarProps> = ({
    isOpen,
    onClose,
    onImportPreset,
}) => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<PresetType>('mockup');
    const [presets, setPresets] = useState<Record<PresetType, CommunityPreset[]>>({
        mockup: [],
        angle: [],
        texture: [],
        ambience: [],
        luminance: [],
    });
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            loadPresets();
        }
    }, [isOpen]);

    const loadPresets = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const allPresets = await getAllCommunityPresets();
            setPresets(allPresets as Record<PresetType, CommunityPreset[]>);
        } catch (err) {
            console.error('Failed to load community presets:', err);
            setError(t('communityPresets.errors.failedToLoad') || 'Failed to load presets');
        } finally {
            setIsLoading(false);
        }
    };

    const currentPresets = presets[activeTab] || [];
    const Icon = getPresetIcon(activeTab);

    return (
        <Sheet open={isOpen} onOpenChange={onClose}>
            <SheetContent
                side="right"
                className="w-full sm:max-w-md bg-[#1A1A1A] border-zinc-800/50 text-zinc-300 overflow-y-auto p-6"
            >
                <SheetHeader className="border-b border-zinc-800/30 pb-6 mb-6">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                            <Users className="h-5 w-5 text-[#52ddeb]" />
                            <SheetTitle className="text-zinc-300 text-lg">
                                {t('communityPresets.title') || 'Community Presets'}
                            </SheetTitle>
                        </div>
                        <button
                            onClick={() => {
                                navigate(`/community/presets?type=${activeTab}&view=my&create=true`);
                                onClose();
                            }}
                            className="flex items-center gap-2 px-3 py-2 rounded-md text-xs font-mono bg-[#52ddeb]/20 hover:bg-[#52ddeb]/30 border border-[#52ddeb]/30 text-[#52ddeb] transition-all"
                            title={t('communityPresets.createNew') || 'Create New Preset'}
                        >
                            <Plus size={14} />
                            {t('communityPresets.new') || 'New'}
                        </button>
                    </div>
                    <SheetDescription className="text-zinc-500 text-sm mt-1">
                        {t('communityPresets.subtitle') || 'Browse and import community presets'}
                    </SheetDescription>
                </SheetHeader>

                {/* Tabs */}
                <div className="flex gap-2 mb-6 flex-wrap">
                    {(['mockup', 'angle', 'texture', 'ambience', 'luminance'] as PresetType[]).map((type) => {
                        const TabIcon = getPresetIcon(type);
                        return (
                            <button
                                key={type}
                                onClick={() => setActiveTab(type)}
                                className={cn(
                                    'px-4 py-2 rounded-md text-xs font-mono transition-all flex items-center gap-2',
                                    activeTab === type
                                        ? 'bg-[#52ddeb]/20 text-[#52ddeb] border border-[#52ddeb]/30'
                                        : 'bg-zinc-900/50 border border-zinc-700/50 text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-300'
                                )}
                            >
                                <TabIcon size={14} />
                                {t(`communityPresets.tabs.${type}`) || type}
                            </button>
                        );
                    })}
                </div>

                {/* Content */}
                <div className="space-y-4">
                    {isLoading && (
                        <div className="flex items-center justify-center py-16">
                            <Loader2 className="h-6 w-6 animate-spin text-[#52ddeb]" />
                        </div>
                    )}

                    {error && (
                        <div className="p-4 rounded-md bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                            {error}
                        </div>
                    )}

                    {!isLoading && !error && currentPresets.length === 0 && (
                        <div className="text-center py-16 text-zinc-500 text-sm">
                            {t('communityPresets.noPresets') || 'No presets available'}
                        </div>
                    )}

                    {!isLoading && !error && currentPresets.map((preset) => (
                        <button
                            key={preset.id}
                            onClick={() => {
                                onImportPreset(preset, activeTab);
                                onClose();
                            }}
                            className="w-full p-4 rounded-md border border-zinc-700/50 bg-zinc-900/30 hover:bg-zinc-800/50 hover:border-[#52ddeb]/30 transition-all text-left group"
                        >
                            <div className="flex gap-4">
                                {/* Thumbnail */}
                                {(preset as MockupPreset).referenceImageUrl ? (
                                    <div className="w-20 h-20 bg-zinc-900/50 border border-zinc-700/30 rounded overflow-hidden flex-shrink-0">
                                        <img
                                            src={(preset as MockupPreset).referenceImageUrl}
                                            alt={preset.name}
                                            className="w-full h-full object-cover"
                                            onError={(e) => {
                                                const target = e.target as HTMLImageElement;
                                                target.style.display = 'none';
                                            }}
                                        />
                                    </div>
                                ) : (
                                    <div className="w-20 h-20 bg-zinc-900/50 border border-zinc-700/30 rounded flex items-center justify-center flex-shrink-0">
                                        <Icon size={24} className="text-zinc-600" />
                                    </div>
                                )}

                                {/* Info */}
                                <div className="flex-1 min-w-0">
                                    <h4 className="text-sm font-semibold text-zinc-300 group-hover:text-[#52ddeb] transition-colors mb-2 truncate">
                                        {preset.name}
                                    </h4>
                                    <p className="text-xs text-zinc-500 line-clamp-2 mb-2">
                                        {preset.description}
                                    </p>
                                    {preset.tags && preset.tags.length > 0 && (
                                        <div className="flex flex-wrap gap-1.5 mt-2">
                                            {preset.tags.slice(0, 3).map((tag) => (
                                                <span
                                                    key={tag}
                                                    className="px-2 py-1 rounded text-[10px] bg-zinc-800/50 text-zinc-500 border border-zinc-700/30"
                                                >
                                                    {tag}
                                                </span>
                                            ))}
                                            {preset.tags.length > 3 && (
                                                <span className="px-2 py-1 rounded text-[10px] text-zinc-600">
                                                    +{preset.tags.length - 3}
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </button>
                    ))}
                </div>
            </SheetContent>
        </Sheet>
    );
};
