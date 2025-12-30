import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Settings, ChevronDown, ChevronUp } from 'lucide-react';
import { useTranslation } from '../hooks/useTranslation';
import { toast } from 'sonner';
import { getSurpriseMeExcludedTags, saveSurpriseMeExcludedTags, type SurpriseMeExcludedTags } from '../utils/surpriseMeSettings';
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
  const [excludedTags, setExcludedTags] = useState<SurpriseMeExcludedTags>({
    excludedCategoryTags: [],
    excludedLocationTags: [],
    excludedAngleTags: [],
    excludedLightingTags: [],
    excludedEffectTags: [],
    excludedMaterialTags: [],
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

  // Focus trap
  useEffect(() => {
    if (!isOpen || !modalRef.current) return;

    const modal = modalRef.current;
    const focusableElements = modal.querySelectorAll(
      'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    modal.addEventListener('keydown', handleTabKey as any);
    return () => modal.removeEventListener('keydown', handleTabKey as any);
  }, [isOpen]);

  const loadSettings = () => {
    setIsLoading(true);
    try {
      const settings = getSurpriseMeExcludedTags();
      setExcludedTags(settings);
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
      const success = saveSurpriseMeExcludedTags(excludedTags);
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

  const toggleTag = (category: keyof SurpriseMeExcludedTags, tag: string) => {
    setExcludedTags(prev => {
      const currentTags = prev[category];
      const isExcluded = currentTags.includes(tag);
      
      return {
        ...prev,
        [category]: isExcluded
          ? currentTags.filter(t => t !== tag)
          : [...currentTags, tag],
      };
    });
  };

  const selectAllTags = (category: keyof SurpriseMeExcludedTags, availableTags: string[]) => {
    setExcludedTags(prev => {
      const currentTags = prev[category];
      const allSelected = availableTags.every(tag => currentTags.includes(tag));
      
      return {
        ...prev,
        [category]: allSelected ? [] : [...availableTags],
      };
    });
  };

  const isTagExcluded = (category: keyof SurpriseMeExcludedTags, tag: string) => {
    return excludedTags[category].includes(tag);
  };

  const areAllTagsSelected = (category: keyof SurpriseMeExcludedTags, availableTags: string[]) => {
    return availableTags.length > 0 && availableTags.every(tag => excludedTags[category].includes(tag));
  };

  const renderTagSection = (
    sectionKey: string,
    category: keyof SurpriseMeExcludedTags,
    availableTags: string[],
    titleKey: string,
    descriptionKey?: string
  ) => {
    const isExpanded = expandedSections[sectionKey];
    const allSelected = areAllTagsSelected(category, availableTags);

    return (
      <div className="border border-zinc-800/50 rounded-xl overflow-hidden">
        <button
          type="button"
          onClick={() => toggleSection(sectionKey)}
          className="w-full flex items-center justify-between p-4 bg-zinc-900/30 hover:bg-zinc-900/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={(e) => {
                  e.stopPropagation();
                  selectAllTags(category, availableTags);
                }}
                onClick={(e) => e.stopPropagation()}
                className="w-4 h-4 rounded border-zinc-700 bg-zinc-800 text-brand-cyan focus:ring-2 focus:ring-brand-cyan/50 focus:ring-offset-2 focus:ring-offset-zinc-900 cursor-pointer"
              />
              <span className="text-sm font-medium text-zinc-200 font-mono">
                {t(titleKey)}
              </span>
            </div>
            {descriptionKey && (
              <span className="text-xs text-zinc-500 font-mono">
                {t(descriptionKey)}
              </span>
            )}
          </div>
          {isExpanded ? <ChevronUp size={18} className="text-zinc-400" /> : <ChevronDown size={18} className="text-zinc-400" />}
        </button>
        
        {isExpanded && (
          <div className="p-4 bg-zinc-900/20 max-h-64 overflow-y-auto space-y-2">
            {availableTags.map(tag => (
              <label
                key={tag}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-zinc-800/30 cursor-pointer transition-colors"
              >
                <input
                  type="checkbox"
                  checked={isTagExcluded(category, tag)}
                  onChange={() => toggleTag(category, tag)}
                  className="w-4 h-4 rounded border-zinc-700 bg-zinc-800 text-brand-cyan focus:ring-2 focus:ring-brand-cyan/50 focus:ring-offset-2 focus:ring-offset-zinc-900 cursor-pointer"
                />
                <span className="text-sm text-zinc-300 font-mono flex-1">{tag}</span>
              </label>
            ))}
          </div>
        )}
      </div>
    );
  };

  if (!isOpen && !isAnimating) return null;

  const modalContent = (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-[9998] bg-black/60 backdrop-blur-sm transition-opacity duration-200 ${
          isOpen ? 'opacity-100' : 'opacity-0'
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
          className={`bg-[#1A1A1A] border border-zinc-800/40 rounded-2xl p-6 sm:p-8 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl transform transition-all duration-200 ${
            isOpen ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-4'
          }`}
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-cyan/20 to-blue-500/20 border border-brand-cyan/30 flex items-center justify-center">
                <Settings size={20} className="text-brand-cyan" />
              </div>
              <h2 id="modal-title" className="text-xl font-semibold font-manrope text-zinc-100">
                {t('surpriseMeSettings.title') || 'Surprise Me Settings'}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 rounded-lg p-2 transition-all duration-150"
              aria-label="Close modal"
            >
              <X size={20} />
            </button>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-brand-cyan/30 border-t-brand-cyan rounded-full animate-spin" />
                <p className="text-zinc-500 font-mono text-sm">Loading...</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Info Box */}
              <div className="bg-gradient-to-br from-blue-500/5 to-brand-cyan/5 border border-blue-500/10 rounded-xl p-4">
                <p className="text-xs text-zinc-400 font-mono leading-relaxed">
                  {t('surpriseMeSettings.info') || 'Select tags to exclude when using Surprise Me. Excluded tags will not be randomly selected.'}
                </p>
              </div>

              {/* Tag Sections */}
              <div className="space-y-3">
                {renderTagSection(
                  'categories',
                  'excludedCategoryTags',
                  GENERIC_MOCKUP_TAGS,
                  'surpriseMeSettings.categories',
                  'surpriseMeSettings.categoriesDescription'
                )}

                {renderTagSection(
                  'locations',
                  'excludedLocationTags',
                  AVAILABLE_LOCATION_TAGS,
                  'surpriseMeSettings.locations',
                  'surpriseMeSettings.locationsDescription'
                )}

                {renderTagSection(
                  'angles',
                  'excludedAngleTags',
                  AVAILABLE_ANGLE_TAGS,
                  'surpriseMeSettings.angles',
                  'surpriseMeSettings.anglesDescription'
                )}

                {renderTagSection(
                  'lighting',
                  'excludedLightingTags',
                  AVAILABLE_LIGHTING_TAGS,
                  'surpriseMeSettings.lighting',
                  'surpriseMeSettings.lightingDescription'
                )}

                {renderTagSection(
                  'effects',
                  'excludedEffectTags',
                  AVAILABLE_EFFECT_TAGS,
                  'surpriseMeSettings.effects',
                  'surpriseMeSettings.effectsDescription'
                )}

                {renderTagSection(
                  'materials',
                  'excludedMaterialTags',
                  AVAILABLE_MATERIAL_TAGS,
                  'surpriseMeSettings.materials',
                  'surpriseMeSettings.materialsDescription'
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3 pt-4 border-t border-zinc-800/30">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSaving}
                  className="flex-1 px-4 py-3 bg-zinc-900/50 hover:bg-zinc-900/70 disabled:bg-zinc-900/30 disabled:text-zinc-600 disabled:cursor-not-allowed text-zinc-300 hover:text-zinc-100 border border-zinc-800/50 hover:border-zinc-700/50 font-medium rounded-xl transition-all duration-150 text-sm font-mono"
                >
                  {t('common.cancel') || 'Cancel'}
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-brand-cyan to-blue-500 hover:from-brand-cyan/90 hover:to-blue-500/90 disabled:from-zinc-900/30 disabled:to-zinc-900/30 disabled:text-zinc-600 disabled:cursor-not-allowed text-black font-semibold rounded-xl transition-all duration-150 text-sm font-mono shadow-lg shadow-brand-cyan/20 hover:shadow-brand-cyan/30 disabled:shadow-none"
                >
                  {isSaving ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                      {t('common.saving') || 'Saving...'}
                    </span>
                  ) : (
                    t('common.save') || 'Save'
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );

  // Render modal in portal to ensure proper z-index stacking
  return createPortal(modalContent, document.body);
};

