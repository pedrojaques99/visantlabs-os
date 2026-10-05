import React, { useState, useEffect } from 'react';
import { Save, FolderOpen, MoreVertical, Trash2, Check, X } from '@/lib/ui/icons';
import { useTranslation } from '@/hooks/useTranslation';
import { useTheme } from '@/hooks/useTheme';
import { cn } from '@/lib/utils';
import { hoverReveal } from '@/lib/ui/hoverReveal';
import { savedPresetsService, SavedPreset } from '@/services/savedPresetsService';
import { useMockup } from './MockupContext';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export const PresetsControl: React.FC = () => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const mockupContext = useMockup();

  const [presets, setPresets] = useState<SavedPreset[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [presetName, setPresetName] = useState('');

  useEffect(() => {
    loadPresets();
  }, []);

  const loadPresets = async () => {
    try {
      setIsLoading(true);
      const data = await savedPresetsService.getAll();
      setPresets(data);
    } catch (error) {
      console.error('Failed to load presets:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!presetName.trim()) return;

    try {
      setIsLoading(true);
      // Bundle current state
      const config = {
        selectedLocationTags: mockupContext.selectedLocationTags,
        selectedAngleTags: mockupContext.selectedAngleTags,
        selectedLightingTags: mockupContext.selectedLightingTags,
        selectedEffectTags: mockupContext.selectedEffectTags,
        selectedMaterialTags: mockupContext.selectedMaterialTags,
        selectedColors: mockupContext.selectedColors,
        negativePrompt: mockupContext.negativePrompt,
        additionalPrompt: mockupContext.additionalPrompt,
        designType: mockupContext.designType,
        selectedTags: mockupContext.selectedTags,
      };

      await savedPresetsService.save(presetName.trim(), config);
      toast.success(t('mockup.presetSaved'));
      setPresetName('');
      setIsSaving(false);
      await loadPresets();
    } catch (error) {
      console.error('Failed to save preset:', error);
      toast.error(t('mockup.presetSaveError'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoad = (config: any) => {
    if (!config) return;

    // Restore normal tags
    if (config.selectedTags) mockupContext.setSelectedTags(config.selectedTags);
    if (config.selectedLocationTags)
      mockupContext.setSelectedLocationTags(config.selectedLocationTags);
    if (config.selectedAngleTags) mockupContext.setSelectedAngleTags(config.selectedAngleTags);
    if (config.selectedLightingTags)
      mockupContext.setSelectedLightingTags(config.selectedLightingTags);
    if (config.selectedEffectTags) mockupContext.setSelectedEffectTags(config.selectedEffectTags);
    if (config.selectedMaterialTags)
      mockupContext.setSelectedMaterialTags(config.selectedMaterialTags);

    // Restore colors and prompts
    if (config.selectedColors) mockupContext.setSelectedColors(config.selectedColors);
    if (typeof config.negativePrompt === 'string')
      mockupContext.setNegativePrompt(config.negativePrompt);
    if (typeof config.additionalPrompt === 'string')
      mockupContext.setAdditionalPrompt(config.additionalPrompt);
    if (config.designType) mockupContext.setDesignType(config.designType);

    toast.success(t('mockup.presetLoaded'));
    setIsOpen(false);
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await savedPresetsService.delete(id);
      setPresets(presets.filter((p) => p.id !== id));
      toast.success(t('mockup.presetDeleted'));
    } catch (error) {
      toast.error(t('mockup.presetDeleteError'));
    }
  };

  // Auto-close popovers when clicking outside could be added here,
  // but for essentialism, toggling them is enough.

  return (
    <div className="relative mb-4">
      <div className="flex gap-2">
        <Button
          variant="ghost"
          onClick={() => {
            setIsOpen(!isOpen);
            setIsSaving(false);
          }}
          className={cn(
            'flex items-center gap-1.5 px-3 py-2 rounded-md text-xs transition-colors flex-1 justify-center border',
            isOpen
              ? 'bg-brand-cyan/10 text-foreground border-brand-cyan/30'
              : theme === 'dark'
                ? 'bg-neutral-900/50 text-neutral-400 border-neutral-800 hover:bg-neutral-800 hover:text-neutral-300'
                : 'bg-white/50 text-neutral-600 border-neutral-200 hover:bg-neutral-100 hover:text-neutral-800'
          )}
        >
          <FolderOpen size={14} />
          <span>{t('mockup.loadPreset')}</span>
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            setIsSaving(!isSaving);
            setIsOpen(false);
          }}
          className={cn(
            'flex items-center gap-1.5 px-3 py-2 rounded-md text-xs transition-colors flex-1 justify-center border',
            isSaving
              ? 'bg-brand-cyan/10 text-foreground border-brand-cyan/30'
              : theme === 'dark'
                ? 'bg-neutral-900/50 text-neutral-400 border-neutral-800 hover:bg-neutral-800 hover:text-neutral-300'
                : 'bg-white/50 text-neutral-600 border-neutral-200 hover:bg-neutral-100 hover:text-neutral-800'
          )}
        >
          <Save size={14} />
          <span>{t('mockup.savePreset')}</span>
        </Button>
      </div>

      {/* Save Popover */}
      {isSaving && (
        <div
          className={cn(
            'absolute top-12 left-0 right-0 z-20 p-3 rounded-md border animate-in fade-in slide-in-from-top-2 shadow-2xl',
            theme === 'dark'
              ? 'bg-neutral-900 border-neutral-800 shadow-black/50'
              : 'bg-white border-neutral-200'
          )}
        >
          <div className="flex gap-2">
            <Input
              type="text"
              placeholder={t('mockup.presetNamePlaceholder')}
              aria-label={t('mockup.presetName')}
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              className={cn(
                'flex-1 text-sm font-sans px-3 py-2 rounded-md border focus:outline-none focus:border-neutral-600 bg-transparent transition-colors',
                theme === 'dark'
                  ? 'border-neutral-700 text-neutral-200 placeholder:text-neutral-600'
                  : 'border-neutral-300 text-neutral-800 placeholder:text-neutral-400'
              )}
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            />
            <Button
              variant="brand"
              onClick={handleSave}
              disabled={isLoading || !presetName.trim()}
              className="px-3 py-2 rounded-md bg-brand-cyan/20 text-foreground hover:bg-brand-cyan/30 transition-colors disabled:opacity-50"
            >
              <Check size={16} />
            </Button>
            <Button
              variant="ghost"
              onClick={() => setIsSaving(false)}
              className={cn(
                'px-3 py-2 rounded-md transition-colors',
                theme === 'dark'
                  ? 'hover:bg-neutral-800 text-neutral-500'
                  : 'hover:bg-neutral-100 text-neutral-500'
              )}
            >
              <X size={16} />
            </Button>
          </div>
        </div>
      )}

      {/* Load Popover */}
      {isOpen && (
        <div
          className={cn(
            'absolute top-12 left-0 right-0 z-20 py-2 rounded-md border animate-in fade-in slide-in-from-top-2 shadow-2xl max-h-[250px] overflow-y-auto custom-scrollbar',
            theme === 'dark'
              ? 'bg-neutral-900 border-neutral-800 shadow-black/50'
              : 'bg-white border-neutral-200'
          )}
        >
          {isLoading ? (
            <div className="px-4 py-4 text-xs text-neutral-500 text-center">
              {t('common.loading')}
            </div>
          ) : presets.length === 0 ? (
            <div className="px-4 py-4 text-xs text-neutral-500 text-center">
              {t('mockup.noPresets')}
            </div>
          ) : (
            <div className="flex flex-col">
              {presets.map((preset) => (
                <div
                  key={preset.id}
                  className={cn(
                    'flex items-center justify-between pr-2 transition-colors border-b last:border-0 group',
                    theme === 'dark'
                      ? 'hover:bg-neutral-800/80 border-neutral-800/50'
                      : 'hover:bg-neutral-50 border-neutral-100'
                  )}
                >
                  <button
                    type="button"
                    onClick={() => handleLoad(preset.config)}
                    className={cn(
                      'flex-1 min-w-0 truncate text-left px-4 py-2.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      theme === 'dark'
                        ? 'text-neutral-300 group-hover:text-foreground'
                        : 'text-neutral-700 group-hover:text-foreground'
                    )}
                  >
                    {preset.name}
                  </button>
                  <Button
                    variant="ghost"
                    onClick={(e) => handleDelete(e, preset.id)}
                    className={cn(
                      hoverReveal,
                      'p-1.5 text-neutral-500 hover:text-destructive hover:bg-destructive/10 rounded-md'
                    )}
                    title={t('mockup.deletePreset')}
                    aria-label={t('mockup.deletePreset')}
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
