import React from 'react';
import { createPortal } from 'react-dom';
import { X, Image as ImageIcon, Users, Plus, Check } from 'lucide-react';
import type { MockupPresetType, MockupPreset } from '../types/mockupPresets';
import type { Mockup } from '../services/mockupApi';
import { getImageUrl } from '../utils/imageUtils';
import { cn } from '../lib/utils';
import { updatePresetsCache } from '../services/mockupPresetsService';
import { getAllCommunityPresets } from '../services/communityPresetsService';
import { PresetCard, CATEGORY_CONFIG } from './PresetCard';
import type { CommunityPrompt } from '../types/communityPrompts';
import { useTranslation } from '../hooks/useTranslation';
import { fetchAllOfficialPresets } from '../services/unifiedPresetService';

interface MockupPresetModalProps {
  isOpen: boolean;
  selectedPresetId: MockupPresetType | string;
  onClose: () => void;
  onSelectPreset?: (presetId: MockupPresetType | string) => void;
  onSelectPresets?: (presetIds: string[]) => void;
  userMockups?: Mockup[];
  isLoading?: boolean;
  multiSelect?: boolean;
  maxSelections?: number;
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
  const { t } = useTranslation();
  const [presets, setPresets] = React.useState<MockupPreset[]>([]);
  const [communityPresets, setCommunityPresets] = React.useState<any[]>([]);
  const [isLoadingPresets, setIsLoadingPresets] = React.useState(false);
  const [isLoadingCommunityPresets, setIsLoadingCommunityPresets] = React.useState(false);
  const [selectedPresetIds, setSelectedPresetIds] = React.useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = React.useState<'official' | 'community' | 'custom'>('official');
  const [communityFilter, setCommunityFilter] = React.useState<CommunityPresetType>('all');

  // Fetch presets logic remains same
  React.useEffect(() => {
    if (!isOpen) {
      setPresets([]);
      setCommunityPresets([]);
      return;
    }

    const fetchPresets = async () => {
      setIsLoadingPresets(true);
      try {
        const data = await fetchAllOfficialPresets();
        if (data.mockupPresets && Array.isArray(data.mockupPresets)) {
          const normalizedPresets = data.mockupPresets.map((p: any) => ({
            ...p,
            referenceImageUrl: p.referenceImageUrl || '',
          }));
          setPresets(normalizedPresets);
          updatePresetsCache(normalizedPresets);
        }
      } catch (error) {
        console.error('Failed to load presets from Unified Service:', error);
        setPresets([]);
      } finally {
        setIsLoadingPresets(false);
      }
    };

    const fetchCommunityPresets = async () => {
      setIsLoadingCommunityPresets(true);
      try {
        const allPresets = await getAllCommunityPresets();
        const flattened: any[] = [];
        Object.entries(allPresets).forEach(([type, list]) => {
          if (Array.isArray(list)) {
            list.forEach(p => {
              flattened.push({
                ...p,
                referenceImageUrl: p.referenceImageUrl || '',
                bgType: type
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

  // Event Listeners
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
      const modalElement = document.getElementById('mockup-preset-modal');
      if (modalElement) modalElement.focus();

      return () => {
        document.body.style.overflow = '';
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [isOpen, onClose]);

  // Reset selections
  React.useEffect(() => {
    if (isOpen && !multiSelect) {
      setSelectedPresetIds(new Set());
    }
  }, [isOpen, multiSelect]);

  const handlePresetClick = (presetId: string) => {
    if (isLoading) return;

    if (multiSelect) {
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

  const getSelectionIndex = (presetId: string) => {
    if (!multiSelect || !selectedPresetIds.has(presetId)) return undefined;
    return Array.from(selectedPresetIds).indexOf(presetId) + 1;
  };

  const filteredCommunityPresets = React.useMemo(() => {
    if (communityFilter === 'all') return communityPresets;
    return communityPresets.filter(p => p.presetType === communityFilter || p.bgType === communityFilter);
  }, [communityPresets, communityFilter]);

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
        <div className="flex items-center justify-between p-4 border-b border-zinc-800/50 bg-zinc-900/20">
          <div className="flex items-center gap-2">
            <ImageIcon size={20} className="text-brand-cyan" />
            <h2 id="mockup-preset-modal-title" className="text-sm font-mono text-zinc-300 uppercase tracking-wider">
              {multiSelect
                ? t('canvasNodes.promptNode.presetModal.titleMulti')
                  .replace('{selected}', selectedPresetIds.size.toString())
                  .replace('{max}', maxSelections.toString())
                : t('canvasNodes.promptNode.presetModal.title')}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-zinc-500 hover:text-white transition-colors hover:bg-zinc-800/50 rounded-full"
            title="Close (Esc)"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-4 pt-4 border-b border-zinc-800/50 bg-zinc-900/10">
          <button
            onClick={() => setActiveTab('official')}
            className={cn(
              'px-4 py-2 text-xs font-mono uppercase transition-all duration-200 border-b-2 relative rounded-t-md',
              activeTab === 'official'
                ? 'text-brand-cyan border-[#52ddeb] bg-brand-cyan/5'
                : 'text-zinc-400 border-transparent hover:text-zinc-300 hover:bg-zinc-800/30'
            )}
          >
            {t('canvasNodes.promptNode.presetModal.tabs.official').replace('{count}', presets.length.toString())}
          </button>
          <button
            onClick={() => setActiveTab('community')}
            className={cn(
              'px-4 py-2 text-xs font-mono uppercase transition-all duration-200 border-b-2 flex items-center gap-1.5 relative rounded-t-md',
              activeTab === 'community'
                ? 'text-brand-cyan border-[#52ddeb] bg-brand-cyan/5'
                : 'text-zinc-400 border-transparent hover:text-zinc-300 hover:bg-zinc-800/30'
            )}
          >
            <Users size={12} />
            {t('canvasNodes.promptNode.presetModal.tabs.community').replace('{count}', communityPresets.length.toString())}
          </button>
          {userMockups && userMockups.length > 0 && (
            <button
              onClick={() => setActiveTab('custom')}
              className={cn(
                'px-4 py-2 text-xs font-mono uppercase transition-all duration-200 border-b-2 relative rounded-t-md',
                activeTab === 'custom'
                  ? 'text-brand-cyan border-[#52ddeb] bg-brand-cyan/5'
                  : 'text-zinc-400 border-transparent hover:text-zinc-300 hover:bg-zinc-800/30'
              )}
            >
              {t('canvasNodes.promptNode.presetModal.tabs.custom').replace('{count}', userMockups.length.toString())}
            </button>
          )}
        </div>

        {/* Community Filters */}
        {activeTab === 'community' && (
          <div className="px-4 py-2 border-b border-zinc-800/50 flex gap-2 overflow-x-auto bg-zinc-900/5">
            {(['all', 'mockup', 'texture', 'angle', 'ambience', 'luminance'] as CommunityPresetType[]).map((type) => {
              const config = CATEGORY_CONFIG[type as keyof typeof CATEGORY_CONFIG];
              const Icon = config ? config.icon : ImageIcon;
              return (
                <button
                  key={type}
                  onClick={() => setCommunityFilter(type)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-mono uppercase transition-all whitespace-nowrap border',
                    communityFilter === type
                      ? 'bg-brand-cyan/10 text-brand-cyan border-brand-cyan/30'
                      : 'bg-zinc-900/50 text-zinc-400 border-zinc-800 hover:bg-zinc-800 hover:border-zinc-700'
                  )}
                >
                  <Icon size={12} />
                  {t(`communityPresets.tabs.${type}`) || type}
                </button>
              );
            })}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 relative custom-scrollbar bg-black/50">
          {/* Official Presets Tab */}
          <div className={cn(
            'transition-all duration-300 ease-in-out',
            activeTab === 'official' ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 absolute inset-0 pointer-events-none'
          )}>
            <div>
              {isLoadingPresets ? (
                <div className="flex flex-col items-center justify-center py-20 text-zinc-500 gap-2">
                  <div className="w-6 h-6 border-2 border-brand-cyan/30 border-t-brand-cyan rounded-full animate-spin"></div>
                  <p className="text-xs font-mono">{t('canvasNodes.promptNode.presetModal.loading')}</p>
                </div>
              ) : presets.length === 0 ? (
                <div className="flex items-center justify-center py-20">
                  <p className="text-sm font-mono text-zinc-500">{t('canvasNodes.promptNode.presetModal.noOfficial')}</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {presets.map((preset) => {
                    const presetItem: CommunityPrompt = {
                      id: preset.id,
                      userId: 'system',
                      category: 'presets',
                      presetType: 'mockup',
                      name: preset.name,
                      description: preset.description,
                      prompt: preset.prompt,
                      referenceImageUrl: preset.referenceImageUrl,
                      aspectRatio: preset.aspectRatio,
                      isApproved: true,
                      createdAt: new Date().toISOString(),
                      updatedAt: new Date().toISOString(),
                    };
                    return (
                      <PresetCard
                        key={`preset-${preset.id}`}
                        preset={presetItem}
                        onClick={() => handlePresetClick(preset.id)}
                        isAuthenticated={true}
                        canEdit={false}
                        t={t}
                        selected={isPresetSelected(preset.id)}
                        selectionIndex={getSelectionIndex(preset.id)}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Community Presets Tab */}
          <div className={cn(
            'transition-all duration-300 ease-in-out',
            activeTab === 'community' ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 absolute inset-0 pointer-events-none'
          )}>
            <div>
              <div className="flex items-center justify-end mb-4">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    window.location.href = '/canvas';
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-cyan/10 hover:bg-brand-cyan/20 border border-brand-cyan/30 rounded-md text-[10px] font-mono text-brand-cyan transition-all hover:scale-105"
                >
                  <Plus size={12} />
                  <span>{t('canvasNodes.promptNode.presetModal.createNew')}</span>
                </button>
              </div>

              {isLoadingCommunityPresets ? (
                <div className="flex flex-col items-center justify-center py-20 text-zinc-500 gap-2">
                  <div className="w-6 h-6 border-2 border-brand-cyan/30 border-t-brand-cyan rounded-full animate-spin"></div>
                  <p className="text-xs font-mono">{t('canvasNodes.promptNode.presetModal.loadingCommunity')}</p>
                </div>
              ) : filteredCommunityPresets.length === 0 ? (
                <div className="flex items-center justify-center py-20">
                  <p className="text-sm font-mono text-zinc-500">{t('canvasNodes.promptNode.presetModal.noCommunity')}</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {filteredCommunityPresets.map((preset: any) => (
                    <PresetCard
                      key={`community-preset-${preset.id}`}
                      preset={{
                        ...preset,
                        category: preset.category || preset.bgType || 'presets', // Ensure category is set
                      }}
                      onClick={() => handlePresetClick(preset.id)}
                      isAuthenticated={true}
                      canEdit={false} // Modal view usually doesn't allow editing
                      t={t}
                      selected={isPresetSelected(preset.id)}
                      selectionIndex={getSelectionIndex(preset.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Custom Mockups Tab */}
          <div className={cn(
            'transition-all duration-300 ease-in-out',
            activeTab === 'custom' ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 absolute inset-0 pointer-events-none'
          )}>
            <div>
              {userMockups && userMockups.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {userMockups.map((mockup) => {
                    const mockupId = mockup._id || '';
                    // Mockup to CommunityPrompt conversion
                    const mockupItem: CommunityPrompt = {
                      id: mockupId,
                      userId: 'user', // Assuming current user own this
                      category: 'mockup',
                      name: mockup.prompt?.substring(0, 30) || 'Custom Mockup',
                      description: mockup.prompt || '',
                      prompt: mockup.prompt || '',
                      referenceImageUrl: getImageUrl(mockup),
                      aspectRatio: '16:9', // Default or actual
                      isApproved: true,
                      createdAt: mockup.createdAt || new Date().toISOString(),
                      updatedAt: new Date().toISOString(),
                    };

                    return (
                      <PresetCard
                        key={`usermockup-${mockupId}`}
                        preset={mockupItem}
                        onClick={() => handlePresetClick(mockupId)}
                        isAuthenticated={true}
                        canEdit={false}
                        t={t}
                        selected={isPresetSelected(mockupId)}
                        selectionIndex={getSelectionIndex(mockupId)}
                      />
                    );
                  })}
                </div>
              ) : (
                <div className="flex items-center justify-center py-20">
                  <p className="text-sm font-mono text-zinc-500">{t('canvasNodes.promptNode.presetModal.noCustom')}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer with Select Mockups button (multi-select mode only) */}
        {multiSelect && (
          <div className="border-t border-zinc-800/50 p-4 flex items-center justify-between bg-zinc-900/50 backdrop-blur-md">
            <div className="text-xs font-mono text-zinc-400">
              {selectedPresetIds.size === 0
                ? t('canvasNodes.promptNode.presetModal.multiSelectMessageEmpty').replace('{max}', maxSelections.toString())
                : t('canvasNodes.promptNode.presetModal.multiSelectMessage')
                  .replace('{selected}', selectedPresetIds.size.toString())
                  .replace('{max}', maxSelections.toString())}
            </div>
            <button
              onClick={handleSelectMockups}
              disabled={selectedPresetIds.size === 0 || isLoading}
              className={cn(
                'px-6 py-2.5 bg-brand-cyan text-black font-semibold rounded-md text-xs font-mono transition-all hover:bg-brand-cyan/90 hover:shadow-lg hover:shadow-brand-cyan/20 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed',
                selectedPresetIds.size > 0 && 'animate-pulse-subtle'
              )}
            >
              {t('canvasNodes.promptNode.presetModal.confirmSelection')}
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
