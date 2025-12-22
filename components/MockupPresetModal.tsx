import React from 'react';
import { createPortal } from 'react-dom';
import { X, Image as ImageIcon, ChevronDown, ChevronUp, Check, Users, Layers, Camera, MapPin, Sun, Grid } from 'lucide-react';
import type { MockupPresetType, MockupPreset } from '../types/mockupPresets';
import type { Mockup } from '../services/mockupApi';
import { getImageUrl } from '../utils/imageUtils';
import { cn } from '../lib/utils';
import { updatePresetsCache } from '../services/mockupPresetsService';
import { getAllCommunityPresets } from '../services/communityPresetsService';

interface MockupPresetModalProps {
  isOpen: boolean;
  selectedPresetId: MockupPresetType | string;
  onClose: () => void;
  onSelectPreset?: (presetId: MockupPresetType | string) => void;
  onSelectPresets?: (presetIds: string[]) => void; // New callback for multiple selection
  userMockups?: Mockup[];
  isLoading?: boolean;
  multiSelect?: boolean; // Enable multi-select mode
  maxSelections?: number; // Maximum number of selections (default 5)
}

type CommunityPresetType = 'all' | 'mockup' | 'angle' | 'texture' | 'ambience' | 'luminance';

export const MockupPresetModal: React.FC<MockupPresetModalProps> = ({
  isOpen,
  selectedPresetId,
  onClose,
  onSelectPreset,
  onSelectPresets,
  userMockups = [],
  isLoading = false,
  multiSelect = false,
  maxSelections = 5,
}) => {
  const [presets, setPresets] = React.useState<MockupPreset[]>([]);
  const [communityPresets, setCommunityPresets] = React.useState<any[]>([]);
  const [isLoadingPresets, setIsLoadingPresets] = React.useState(false);
  const [isLoadingCommunityPresets, setIsLoadingCommunityPresets] = React.useState(false);
  const [expandedPrompts, setExpandedPrompts] = React.useState<Set<string>>(new Set());
  const [failedImages, setFailedImages] = React.useState<Set<string>>(new Set());
  const [failedUserMockupImages, setFailedUserMockupImages] = React.useState<Set<string>>(new Set());
  const [selectedPresetIds, setSelectedPresetIds] = React.useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = React.useState<'official' | 'community' | 'custom'>('official');
  const [communityFilter, setCommunityFilter] = React.useState<CommunityPresetType>('all');

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

  const handleImageError = (presetId: string) => {
    setFailedImages((prev) => new Set(prev).add(presetId));
  };

  const handleUserMockupImageError = (mockupId: string) => {
    setFailedUserMockupImages((prev) => new Set(prev).add(mockupId));
  };

  // Fetch presets from MongoDB when modal opens
  React.useEffect(() => {
    if (!isOpen) {
      // Clear presets when modal closes to ensure fresh data on next open
      setPresets([]);
      setCommunityPresets([]);
      return;
    }

    const fetchPresets = async () => {
      setIsLoadingPresets(true);
      try {
        const response = await fetch('/api/admin/presets/public');
        if (response.ok) {
          const data = await response.json();
          if (data.mockupPresets && Array.isArray(data.mockupPresets)) {
            // Normalize presets to ensure referenceImageUrl is always a string
            const normalizedPresets = data.mockupPresets.map((p: any) => ({
              ...p,
              referenceImageUrl: p.referenceImageUrl || '',
            }));
            setPresets(normalizedPresets);
            // Update the service cache so other parts of the app can use it
            updatePresetsCache(normalizedPresets);
          }
        }
      } catch (error) {
        console.error('Failed to load presets from MongoDB:', error);
        setPresets([]);
      } finally {
        setIsLoadingPresets(false);
      }
    };

    const fetchCommunityPresets = async () => {
      setIsLoadingCommunityPresets(true);
      try {
        const allPresets = await getAllCommunityPresets();
        // Flatten and normalize
        const flattened: any[] = [];
        Object.entries(allPresets).forEach(([type, list]) => {
          if (Array.isArray(list)) {
            list.forEach(p => {
              flattened.push({
                ...p,
                referenceImageUrl: p.referenceImageUrl || '',
                bgType: type // Add type for filtering if not present
              });
            });
          }
        });
        setCommunityPresets(flattened);
      } catch (error) {
        console.error('Failed to load community presets:', error);
        setCommunityPresets([]);
      } finally {
        setIsLoadingCommunityPresets(false);
      }
    };

    fetchPresets();
    fetchCommunityPresets();
  }, [isOpen]);

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);

      // Focus the modal container
      const modalElement = document.getElementById('mockup-preset-modal');
      if (modalElement) {
        modalElement.focus();
      }

      return () => {
        document.body.style.overflow = '';
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [isOpen, onClose]);

  // Reset selections when modal opens/closes
  React.useEffect(() => {
    if (isOpen && !multiSelect) {
      setSelectedPresetIds(new Set());
    }
  }, [isOpen, multiSelect]);

  const handlePresetClick = (presetId: string) => {
    if (isLoading) return;

    if (multiSelect) {
      // Toggle selection in multi-select mode
      setSelectedPresetIds((prev) => {
        const next = new Set(prev);
        if (next.has(presetId)) {
          next.delete(presetId);
        } else if (next.size < maxSelections) {
          next.add(presetId);
        }
        return next;
      });
    } else {
      // Single select mode - close modal and call callback
      onSelectPreset?.(presetId);
      onClose();
    }
  };

  const handleSelectMockups = () => {
    if (selectedPresetIds.size > 0 && onSelectPresets) {
      onSelectPresets(Array.from(selectedPresetIds));
      setSelectedPresetIds(new Set());
    }
  };

  const isPresetSelected = (presetId: string) => {
    return multiSelect ? selectedPresetIds.has(presetId) : presetId === selectedPresetId;
  };

  const canSelectMore = selectedPresetIds.size < maxSelections;

  // Filter community presets
  const filteredCommunityPresets = React.useMemo(() => {
    if (communityFilter === 'all') return communityPresets;
    return communityPresets.filter(p => p.presetType === communityFilter || p.bgType === communityFilter);
  }, [communityPresets, communityFilter]);

  const getFilterIcon = (type: CommunityPresetType) => {
    switch (type) {
      case 'mockup': return ImageIcon;
      case 'angle': return Camera;
      case 'texture': return Layers;
      case 'ambience': return MapPin;
      case 'luminance': return Sun;
      default: return Grid;
    }
  };

  if (!isOpen) return null;

  const modalContent = (
    <div
      id="mockup-preset-modal"
      tabIndex={-1}
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4"
      style={{ animation: 'fadeIn 0.2s ease-out' }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="mockup-preset-modal-title"
    >
      <div
        className="relative max-w-4xl w-full max-h-[90vh] bg-black/95 backdrop-blur-xl border border-zinc-800/50 rounded-md shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-800/50">
          <div className="flex items-center gap-2">
            <ImageIcon size={20} className="text-[#52ddeb]" />
            <h2 id="mockup-preset-modal-title" className="text-sm font-mono text-zinc-300 uppercase">
              {multiSelect ? `Select Mockup Presets (${selectedPresetIds.size}/${maxSelections})` : 'Select Mockup Preset'}
            </h2>
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
            Official ({presets.length})
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
          {userMockups && userMockups.length > 0 && (
            <button
              onClick={() => setActiveTab('custom')}
              className={cn(
                'px-4 py-2 text-xs font-mono uppercase transition-all duration-200 border-b-2 relative',
                activeTab === 'custom'
                  ? 'text-[#52ddeb] border-[#52ddeb]'
                  : 'text-zinc-400 border-transparent hover:text-zinc-300 hover:border-zinc-600/50'
              )}
            >
              Custom ({userMockups.length})
            </button>
          )}
        </div>

        {/* Community Filters */}
        {activeTab === 'community' && (
          <div className="px-4 py-2 border-b border-zinc-800/50 flex gap-2 overflow-x-auto">
            {(['all', 'mockup', 'texture', 'angle', 'ambience', 'luminance'] as CommunityPresetType[]).map((type) => {
              const Icon = getFilterIcon(type);
              return (
                <button
                  key={type}
                  onClick={() => setCommunityFilter(type)}
                  className={cn(
                    'flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[10px] font-mono uppercase transition-all whitespace-nowrap',
                    communityFilter === type
                      ? 'bg-[#52ddeb]/20 text-[#52ddeb] border border-[#52ddeb]/30'
                      : 'bg-zinc-900/50 text-zinc-400 border border-zinc-700/50 hover:bg-zinc-800/50'
                  )}
                >
                  <Icon size={12} />
                  {type}
                </button>
              );
            })}
          </div>
        )}

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
              <h3 className="text-xs font-mono text-zinc-400 uppercase mb-4">Presets</h3>
              {isLoadingPresets ? (
                <div className="flex items-center justify-center py-12">
                  <p className="text-sm font-mono text-zinc-400">Carregando presets...</p>
                </div>
              ) : presets.length === 0 ? (
                <div className="flex items-center justify-center py-12">
                  <p className="text-sm font-mono text-zinc-400">Nenhum preset encontrado</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {presets.map((preset) => {
                    const presetImageUrl = preset.referenceImageUrl;
                    const isSelected = isPresetSelected(preset.id);
                    const isPromptExpanded = expandedPrompts.has(preset.id);
                    const hasImage = presetImageUrl && !failedImages.has(preset.id);
                    const isDisabled = multiSelect && !isSelected && !canSelectMore;

                    return (
                      <div
                        key={`preset-${preset.id}`}
                        className={cn(
                          'flex flex-col rounded-md border transition-all overflow-hidden group',
                          isSelected
                            ? 'bg-[#52ddeb]/10 border-[#52ddeb]/50 hover:bg-[#52ddeb]/15'
                            : 'bg-zinc-900/30 border-zinc-700/30 hover:bg-zinc-900/50 hover:border-zinc-600/50',
                          (isLoading || isDisabled) && 'opacity-50 cursor-not-allowed'
                        )}
                      >
                        {/* Thumbnail */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!isLoading && !isDisabled) {
                              handlePresetClick(preset.id);
                            }
                          }}
                          disabled={isLoading || isDisabled}
                          className="relative w-full aspect-square bg-zinc-900/30 border-b border-zinc-700/30 overflow-hidden flex-shrink-0"
                        >
                          {hasImage ? (
                            <img
                              src={presetImageUrl}
                              alt={preset.name}
                              className="w-full h-full object-contain bg-zinc-900/50 group-hover:scale-105 transition-transform duration-300"
                              onError={() => handleImageError(preset.id)}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-zinc-900/50">
                              <ImageIcon size={40} className="text-zinc-500" />
                            </div>
                          )}
                          {/* Selection Indicator */}
                          {isSelected && (
                            <div className="absolute top-2 right-2 w-6 h-6 bg-[#52ddeb] rounded-md border-2 border-black flex items-center justify-center">
                              {multiSelect ? (
                                <span className="text-[10px] font-mono font-bold text-black">
                                  {Array.from(selectedPresetIds).indexOf(preset.id) + 1}
                                </span>
                              ) : (
                                <Check size={12} className="text-black" strokeWidth={3} />
                              )}
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
                  })}
                </div>
              )}
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
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Users size={14} className="text-[#52ddeb]" />
                  <h3 className="text-xs font-mono text-zinc-400 uppercase">Community Presets</h3>
                </div>
                <div className="text-[10px] font-mono text-zinc-500">
                  {filteredCommunityPresets.length} items
                </div>
              </div>

              {isLoadingCommunityPresets ? (
                <div className="flex items-center justify-center py-12">
                  <p className="text-sm font-mono text-zinc-400">Loading community presets...</p>
                </div>
              ) : filteredCommunityPresets.length === 0 ? (
                <div className="flex items-center justify-center py-12">
                  <p className="text-sm font-mono text-zinc-400">Nenhum preset encontrado</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {filteredCommunityPresets.map((preset: any) => {
                    const presetImageUrl = preset.referenceImageUrl;
                    const isSelected = isPresetSelected(preset.id);
                    const isPromptExpanded = expandedPrompts.has(preset.id);
                    const hasImage = presetImageUrl && !failedImages.has(preset.id);
                    const isDisabled = multiSelect && !isSelected && !canSelectMore;
                    const type = preset.presetType || preset.bgType || 'mockup';

                    return (
                      <div
                        key={`community-preset-${preset.id}`}
                        className={cn(
                          'flex flex-col rounded-md border transition-all overflow-hidden group',
                          isSelected
                            ? 'bg-[#52ddeb]/10 border-[#52ddeb]/50 hover:bg-[#52ddeb]/15'
                            : 'bg-zinc-900/30 border-zinc-700/30 hover:bg-zinc-900/50 hover:border-zinc-600/50',
                          (isLoading || isDisabled) && 'opacity-50 cursor-not-allowed'
                        )}
                      >
                        {/* Thumbnail */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!isLoading && !isDisabled) {
                              handlePresetClick(preset.id);
                            }
                          }}
                          disabled={isLoading || isDisabled}
                          className="relative w-full aspect-square bg-zinc-900/30 border-b border-zinc-700/30 overflow-hidden flex-shrink-0"
                        >
                          {hasImage ? (
                            <img
                              src={presetImageUrl}
                              alt={preset.name}
                              className="w-full h-full object-contain bg-zinc-900/50 group-hover:scale-105 transition-transform duration-300"
                              onError={() => handleImageError(preset.id)}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-zinc-900/50">
                              <ImageIcon size={40} className="text-zinc-500" />
                            </div>
                          )}
                          {/* Selection Indicator */}
                          {isSelected && (
                            <div className="absolute top-2 right-2 w-6 h-6 bg-[#52ddeb] rounded-md border-2 border-[#1A1A1A] flex items-center justify-center">
                              {multiSelect ? (
                                <span className="text-[10px] font-mono font-bold text-[#1A1A1A]">
                                  {Array.from(selectedPresetIds).indexOf(preset.id) + 1}
                                </span>
                              ) : (
                                <Check size={12} className="text-[#1A1A1A]" strokeWidth={3} />
                              )}
                            </div>
                          )}
                          {/* Community Badge */}
                          <div className="absolute top-2 left-2 flex gap-1">
                            <div className="px-1.5 py-0.5 bg-[#52ddeb]/20 border border-[#52ddeb]/30 rounded text-[8px] font-mono text-[#52ddeb]">
                              Comm.
                            </div>
                            <div className="px-1.5 py-0.5 bg-zinc-800/80 border border-zinc-700/50 rounded text-[8px] font-mono text-zinc-400 capitalize">
                              {type}
                            </div>
                          </div>
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
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Custom Mockups Tab */}
          {userMockups && userMockups.length > 0 && (
            <div
              className={cn(
                'transition-all duration-300 ease-in-out',
                activeTab === 'custom'
                  ? 'opacity-100 translate-y-0'
                  : 'opacity-0 translate-y-2 absolute inset-0 pointer-events-none'
              )}
            >
              <div>
                <h3 className="text-xs font-mono text-zinc-400 uppercase mb-4">Custom Mockups</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {userMockups.map((mockup) => {
                    const mockupId = mockup._id || '';
                    const mockupImageUrl = getImageUrl(mockup);
                    const isSelected = isPresetSelected(mockupId);
                    const hasImage = mockupImageUrl && !failedUserMockupImages.has(mockupId);
                    const isDisabled = multiSelect && !isSelected && !canSelectMore;

                    return (
                      <div
                        key={`usermockup-${mockupId}`}
                        className={cn(
                          'flex flex-col rounded-md border transition-all overflow-hidden group',
                          isSelected
                            ? 'bg-[#52ddeb]/10 border-[#52ddeb]/50 hover:bg-[#52ddeb]/15'
                            : 'bg-zinc-900/30 border-zinc-700/30 hover:bg-zinc-900/50 hover:border-zinc-600/50',
                          (isLoading || isDisabled) && 'opacity-50 cursor-not-allowed'
                        )}
                      >
                        {/* Thumbnail */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!isLoading && !isDisabled) {
                              handlePresetClick(mockupId);
                            }
                          }}
                          disabled={isLoading || isDisabled}
                          className="relative w-full aspect-square bg-zinc-900/30 border-b border-zinc-700/30 overflow-hidden flex-shrink-0"
                        >
                          {hasImage ? (
                            <img
                              src={mockupImageUrl}
                              alt={mockup.prompt || 'Custom Mockup'}
                              className="w-full h-full object-contain bg-zinc-900/50 group-hover:scale-105 transition-transform duration-300"
                              onError={() => handleUserMockupImageError(mockupId)}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-zinc-900/50">
                              <ImageIcon size={40} className="text-zinc-500" />
                            </div>
                          )}
                          {/* Selection Indicator */}
                          {isSelected && (
                            <div className="absolute top-2 right-2 w-6 h-6 bg-[#52ddeb] rounded-md border-2 border-black flex items-center justify-center">
                              {multiSelect ? (
                                <span className="text-[10px] font-mono font-bold text-black">
                                  {Array.from(selectedPresetIds).indexOf(mockupId) + 1}
                                </span>
                              ) : (
                                <Check size={12} className="text-black" strokeWidth={3} />
                              )}
                            </div>
                          )}
                        </button>

                        {/* Name Section */}
                        <div className="flex flex-col p-3 min-h-[80px]">
                          <div className={cn(
                            'text-sm font-mono font-semibold mb-2 line-clamp-2 leading-tight',
                            isSelected ? 'text-[#52ddeb]' : 'text-zinc-200'
                          )}>
                            {mockup.prompt?.substring(0, 30) || 'Custom Mockup'}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer with Select Mockups button (multi-select mode only) */}
        {multiSelect && (
          <div className="border-t border-zinc-800/50 p-4 flex items-center justify-between">
            <div className="text-xs font-mono text-zinc-400">
              {selectedPresetIds.size === 0
                ? 'Select up to 5 presets'
                : `${selectedPresetIds.size} of ${maxSelections} presets selected`}
            </div>
            <button
              onClick={handleSelectMockups}
              disabled={selectedPresetIds.size === 0 || isLoading}
              className={cn(
                'px-4 py-2 bg-[#52ddeb]/20 hover:bg-[#52ddeb]/30 border border-[#52ddeb]/30 rounded text-xs font-mono text-[#52ddeb] transition-colors',
                (selectedPresetIds.size === 0 || isLoading) && 'opacity-50 cursor-not-allowed'
              )}
            >
              Select Mockups
            </button>
          </div>
        )}
      </div>
    </div>
  );

  // Render modal using portal to body
  return createPortal(modalContent, document.body);
};
