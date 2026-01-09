import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Settings,
  ChevronDown,
  ChevronUp,
  LayoutGrid,
  MapPin,
  Camera,
  Sun,
  Sparkles,
  Layers,
  CheckCircle2,
  Circle
} from 'lucide-react';
import { Badge } from './ui/badge';
import { useTranslation } from '../hooks/useTranslation';
import { toast } from 'sonner';
import { getSurpriseMeSelectedTags, saveSurpriseMeSelectedTags, type SurpriseMeSelectedTags } from '../utils/surpriseMeSettings';
import {
  GENERIC_MOCKUP_TAGS,
  AVAILABLE_LOCATION_TAGS,
  AVAILABLE_ANGLE_TAGS,
  AVAILABLE_LIGHTING_TAGS,
  AVAILABLE_EFFECT_TAGS,
  AVAILABLE_MATERIAL_TAGS
} from '../utils/mockupConstants';

interface SurpriseMeSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SurpriseMeSettingsModal: React.FC<SurpriseMeSettingsModalProps> = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  const [selectedTags, setSelectedTags] = useState<SurpriseMeSelectedTags>({
    selectedCategoryTags: [],
    selectedLocationTags: [],
    selectedAngleTags: [],
    selectedLightingTags: [],
    selectedEffectTags: [],
    selectedMaterialTags: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    categories: true,
    locations: false,
    angles: false,
    lighting: false,
    effects: false,
    materials: false,
  });

  // Handle modal open/close animations
  useEffect(() => {
    if (isOpen) {
      setIsAnimating(true);
      loadSettings();
      // Prevent body scroll
      document.body.style.overflow = 'hidden';
    } else {
      // Re-enable body scroll
      document.body.style.overflow = '';
      // Delay unmount for exit animation
      const timer = setTimeout(() => setIsAnimating(false), 200);
      return () => clearTimeout(timer);
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onClose]);

  const loadSettings = () => {
    setIsLoading(true);
    try {
      const settings = getSurpriseMeSelectedTags();
      // If categories are empty, select all as default for better UX
      if (settings.selectedCategoryTags.length === 0) {
        settings.selectedCategoryTags = [...GENERIC_MOCKUP_TAGS];
        settings.selectedLocationTags = [...AVAILABLE_LOCATION_TAGS];
        settings.selectedAngleTags = [...AVAILABLE_ANGLE_TAGS];
        settings.selectedLightingTags = [...AVAILABLE_LIGHTING_TAGS];
        settings.selectedEffectTags = [...AVAILABLE_EFFECT_TAGS];
        settings.selectedMaterialTags = [...AVAILABLE_MATERIAL_TAGS];
      }
      setSelectedTags(settings);
    } catch (error) {
      console.error('Failed to load settings:', error);
      toast.error(t('surpriseMeSettings.loadError') || 'Failed to load settings');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const success = saveSurpriseMeSelectedTags(selectedTags);
      if (success) {
        toast.success(t('surpriseMeSettings.saved') || 'Settings saved successfully');
        onClose();
      } else {
        toast.error(t('surpriseMeSettings.saveError') || 'Failed to save settings');
      }
    } catch (error) {
      console.error('Failed to save settings:', error);
      toast.error(t('surpriseMeSettings.saveError') || 'Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const toggleTag = (category: keyof SurpriseMeSelectedTags, tag: string) => {
    setSelectedTags(prev => {
      const currentTags = prev[category];
      const isSelected = currentTags.includes(tag);

      return {
        ...prev,
        [category]: isSelected
          ? currentTags.filter(t => t !== tag)
          : [...currentTags, tag],
      };
    });
  };

  const selectAllTags = (category: keyof SurpriseMeSelectedTags, availableTags: string[]) => {
    setSelectedTags(prev => {
      const currentTags = prev[category];
      const allSelected = availableTags.every(tag => currentTags.includes(tag));

      return {
        ...prev,
        [category]: allSelected ? [] : [...availableTags],
      };
    });
  };

  const isTagSelected = (category: keyof SurpriseMeSelectedTags, tag: string) => {
    return selectedTags[category].includes(tag);
  };

  const areAllTagsSelected = (category: keyof SurpriseMeSelectedTags, availableTags: string[]) => {
    return availableTags.length > 0 && availableTags.every(tag => selectedTags[category].includes(tag));
  };

  const renderTagSection = (
    sectionKey: string,
    category: keyof SurpriseMeSelectedTags,
    availableTags: string[],
    titleKey: string,
    icon: React.ReactNode,
    descriptionKey?: string
  ) => {
    const isExpanded = expandedSections[sectionKey];
    const allSelected = areAllTagsSelected(category, availableTags);
    const selectedCount = selectedTags[category].length;

    return (
      <div className="group border border-white/5 bg-zinc-900/40 rounded-2xl overflow-hidden transition-all duration-300 hover:border-brand-cyan/20">
        <button
          type="button"
          onClick={() => toggleSection(sectionKey)}
          className={`w-full flex items-center justify-between p-4 transition-all duration-300 ${isExpanded ? 'bg-zinc-800/40' : 'hover:bg-zinc-800/20'
            }`}
        >
          <div className="flex items-center gap-4">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 ${isExpanded ? 'bg-brand-cyan/20 text-brand-cyan' : 'bg-zinc-800/50 text-zinc-400'
              }`}>
              {icon}
            </div>
            <div className="flex flex-col items-start">
              <span className="text-sm font-semibold text-zinc-100 font-manrope">
                {t(titleKey)}
              </span>
              <span className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider">
                {selectedCount} / {availableTags.length} SELECTED
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                selectAllTags(category, availableTags);
              }}
              className={`text-[10px] font-bold px-3 py-1.5 rounded-full border transition-all duration-200 uppercase tracking-tighter ${allSelected
                  ? 'bg-brand-cyan/10 border-brand-cyan/30 text-brand-cyan'
                  : 'bg-zinc-800/50 border-zinc-700/50 text-zinc-500 hover:text-zinc-300 hover:border-zinc-600'
                }`}
            >
              {allSelected ? 'Unselect All' : 'Select All'}
            </button>
            <div className={`transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>
              <ChevronDown size={18} className="text-zinc-500" />
            </div>
          </div>
        </button>

        <div className={`transition-all duration-500 ease-in-out ${isExpanded ? 'max-h-[1000px] opacity-100 py-4' : 'max-h-0 opacity-0 py-0'
          } bg-black/20 px-4`}>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {availableTags.map(tag => {
              const selected = isTagSelected(category, tag);
              return (
                <Badge
                  key={tag}
                  onClick={() => toggleTag(category, tag)}
                  variant="outline"
                  className={`flex items-center gap-2 p-2.5 rounded-xl border transition-all duration-200 group/tag cursor-pointer ${selected
                      ? 'bg-brand-cyan/5 border-brand-cyan/20 text-brand-cyan shadow-[0_0_15px_-5px_rgba(0,255,255,0.1)]'
                      : 'bg-zinc-900/50 border-zinc-800/50 text-zinc-500 hover:border-zinc-700 hover:text-zinc-400'
                    }`}
                >
                  <div className={`transition-colors duration-200 ${selected ? 'text-brand-cyan' : 'text-zinc-700'}`}>
                    {selected ? <CheckCircle2 size={14} /> : <Circle size={14} />}
                  </div>
                  <span className="text-xs font-medium truncate font-manrope">{tag}</span>
                </Badge>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  if (!isOpen && !isAnimating) return null;

  const modalContent = (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-[9998] bg-black/80 backdrop-blur-md transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0'
          }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Container */}
      <div
        className="fixed inset-0 z-[9999] flex items-center justify-center p-4 overflow-y-auto"
        onClick={onClose}
      >
        <div
          ref={modalRef}
          className={`bg-zinc-950 border border-white/10 rounded-[2rem] w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-[0_0_50px_-12px_rgba(0,0,0,0.5)] transform transition-all duration-300 flex flex-col ${isOpen ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-8'
            }`}
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
        >
          {/* Header */}
          <div className="px-8 pt-8 pb-6 flex items-center justify-between shrink-0 bg-gradient-to-b from-white/[0.02] to-transparent">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-brand-cyan to-blue-600 p-[1px]">
                <div className="w-full h-full rounded-[0.9rem] bg-zinc-950 flex items-center justify-center">
                  <Settings size={22} className="text-brand-cyan animate-pulse-slow" />
                </div>
              </div>
              <div>
                <h2 id="modal-title" className="text-2xl font-bold font-manrope text-white tracking-tight">
                  {t('surpriseMeSettings.title') || 'Surprise Me Settings'}
                </h2>
                <p className="text-xs text-zinc-500 font-medium">Configure your random generation preferences</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-zinc-500 hover:text-white hover:bg-white/10 rounded-full p-2.5 transition-all duration-200 border border-transparent hover:border-white/10"
              aria-label="Close modal"
            >
              <X size={20} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-8 pb-6 custom-scrollbar space-y-6">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <div className="relative">
                  <div className="w-12 h-12 border-2 border-brand-cyan/20 rounded-full" />
                  <div className="absolute inset-0 w-12 h-12 border-2 border-transparent border-t-brand-cyan rounded-full animate-spin" />
                </div>
                <p className="text-zinc-500 font-mono text-sm animate-pulse uppercase tracking-widest">Loading Settings</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Info Box */}
                <div className="relative group overflow-hidden bg-white/[0.02] border border-white/5 rounded-2xl p-5">
                  <div className="absolute top-0 right-0 -tranzinc-y-1/2 tranzinc-x-1/2 w-32 h-32 bg-brand-cyan/10 blur-[50px] rounded-full group-hover:bg-brand-cyan/20 transition-all duration-500" />
                  <p className="relative text-sm text-zinc-400 font-manrope leading-relaxed">
                    {t('surpriseMeSettings.info') || 'Choose which tags you want to include when using Surprise Me. Unselected tags will be excluded from random generations.'}
                  </p>
                </div>

                {/* Tag Sections */}
                <div className="space-y-3">
                  {renderTagSection(
                    'categories',
                    'selectedCategoryTags',
                    GENERIC_MOCKUP_TAGS,
                    'surpriseMeSettings.categories',
                    <LayoutGrid size={20} />
                  )}

                  {renderTagSection(
                    'locations',
                    'selectedLocationTags',
                    AVAILABLE_LOCATION_TAGS,
                    'surpriseMeSettings.locations',
                    <MapPin size={20} />
                  )}

                  {renderTagSection(
                    'angles',
                    'selectedAngleTags',
                    AVAILABLE_ANGLE_TAGS,
                    'surpriseMeSettings.angles',
                    <Camera size={20} />
                  )}

                  {renderTagSection(
                    'lighting',
                    'selectedLightingTags',
                    AVAILABLE_LIGHTING_TAGS,
                    'surpriseMeSettings.lighting',
                    <Sun size={20} />
                  )}

                  {renderTagSection(
                    'effects',
                    'selectedEffectTags',
                    AVAILABLE_EFFECT_TAGS,
                    'surpriseMeSettings.effects',
                    <Sparkles size={20} />
                  )}

                  {renderTagSection(
                    'materials',
                    'selectedMaterialTags',
                    AVAILABLE_MATERIAL_TAGS,
                    'surpriseMeSettings.materials',
                    <Layers size={20} />
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="px-8 py-6 shrink-0 bg-zinc-900/50 backdrop-blur-xl border-t border-white/5 flex items-center gap-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="flex-1 px-6 py-3.5 bg-white/[0.02] hover:bg-white/[0.05] disabled:opacity-50 disabled:cursor-not-allowed text-zinc-300 hover:text-white border border-white/5 hover:border-white/10 font-bold rounded-2xl transition-all duration-200 text-xs uppercase tracking-widest font-mono"
            >
              {t('common.cancel') || 'Cancel'}
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving || isLoading}
              className="group relative flex-[1.5] px-6 py-3.5 bg-white text-black font-bold rounded-2xl transition-all duration-300 text-xs uppercase tracking-widest font-mono overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-brand-cyan to-blue-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <span className="relative z-10 flex items-center justify-center gap-2 group-hover:text-white transition-colors duration-300">
                {isSaving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-black/30 border-t-black group-hover:border-white/30 group-hover:border-t-white rounded-full animate-spin" />
                    {t('common.saving') || 'Saving...'}
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={16} />
                    {t('common.save') || 'Save Preferences'}
                  </>
                )}
              </span>
            </button>
          </div>
        </div>
      </div>
    </>
  );

  // Render modal in portal to ensure proper z-index stacking
  return createPortal(modalContent, document.body);
};
