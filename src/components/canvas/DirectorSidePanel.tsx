import React, { useState, useCallback, useRef, useEffect } from 'react';
import { X, Compass, Sparkles, ChevronDown, ChevronUp, MapPin, Camera, Lightbulb, Layers, Palette, Package, Wand2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/hooks/useTranslation';
import { useTheme } from '@/hooks/useTheme';
import { Tag } from '@/components/shared/Tag';
import { GlitchLoader } from '@/components/ui/GlitchLoader';
import { translateTag } from '@/utils/localeUtils';
import type { DirectorNodeData } from '@/types/reactFlow';
import {
  AVAILABLE_TAGS,
  AVAILABLE_BRANDING_TAGS,
  AVAILABLE_LOCATION_TAGS,
  AVAILABLE_ANGLE_TAGS,
  AVAILABLE_LIGHTING_TAGS,
  AVAILABLE_EFFECT_TAGS,
  AVAILABLE_MATERIAL_TAGS
} from '@/utils/mockupConstants';

interface DirectorSidePanelProps {
  isOpen: boolean;
  onClose: () => void;
  nodeData: DirectorNodeData;
  nodeId: string;
  onAnalyze: () => void;
  onGeneratePrompt: () => void;
  onUpdateData: (nodeId: string, newData: Partial<DirectorNodeData>) => void;
}

// Collapsible tag section component
interface TagSectionProps {
  title: string;
  icon: React.ReactNode;
  tags: string[];
  suggestedTags: string[];
  selectedTags: string[];
  onTagToggle: (tag: string) => void;
  theme: string;
  t: (key: string) => string;
}

const TagSection: React.FC<TagSectionProps> = ({
  title,
  icon,
  tags,
  suggestedTags,
  selectedTags,
  onTagToggle,
  theme,
  t
}) => {
  const [isExpanded, setIsExpanded] = useState(suggestedTags.length > 0);
  const selectedCount = selectedTags.length;
  const selectionSummary = selectedTags.map(tag => translateTag(tag)).join(', ');

  return (
    <div className={cn(
      'rounded-lg border transition-all duration-200',
      theme === 'dark' ? 'border-neutral-800/50' : 'border-neutral-200'
    )}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          'w-full flex justify-between items-center text-left p-3 transition-all duration-200',
          'hover:bg-neutral-800/10',
          isExpanded && (theme === 'dark' ? 'bg-neutral-800/20' : 'bg-neutral-100/50')
        )}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="flex-shrink-0 text-neutral-500">{icon}</div>
          <div className="flex flex-col gap-0.5 overflow-hidden min-w-0">
            <span className={cn(
              'text-[10px] font-mono uppercase tracking-widest',
              theme === 'dark' ? 'text-neutral-500' : 'text-neutral-600'
            )}>
              {title}
            </span>
            {!isExpanded && selectedCount > 0 && (
              <span className="text-[10px] font-mono truncate text-brand-cyan">
                {selectionSummary}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {selectedCount > 0 && (
            <span className="text-[10px] font-mono text-brand-cyan bg-brand-cyan/10 px-1.5 py-0.5 rounded">
              {selectedCount}
            </span>
          )}
          {isExpanded ? (
            <ChevronUp size={16} className="text-neutral-500" />
          ) : (
            <ChevronDown size={16} className="text-neutral-500" />
          )}
        </div>
      </button>

      {isExpanded && (
        <div className="p-3 pt-0 animate-fade-in">
          {/* Suggested Tags */}
          {suggestedTags.length > 0 && (
            <div className="mb-2">
              <span className="text-[9px] font-mono uppercase text-brand-cyan/70 mb-1 block">
                {t('mockup.suggested') || 'Suggested'}
              </span>
              <div className="flex flex-wrap gap-1.5">
                {suggestedTags.map(tag => (
                  <Tag
                    key={tag}
                    label={translateTag(tag)}
                    selected={selectedTags.includes(tag)}
                    suggested={!selectedTags.includes(tag)}
                    onToggle={() => onTagToggle(tag)}
                    size="sm"
                  />
                ))}
              </div>
            </div>
          )}
          
          {/* All Tags */}
          <div className="flex flex-wrap gap-1.5 mt-2">
            {tags.filter(tag => !suggestedTags.includes(tag)).map(tag => (
              <Tag
                key={tag}
                label={translateTag(tag)}
                selected={selectedTags.includes(tag)}
                onToggle={() => onTagToggle(tag)}
                size="sm"
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// Color palette section
interface ColorSectionProps {
  suggestedColors: string[];
  selectedColors: string[];
  onColorToggle: (color: string) => void;
  theme: string;
  t: (key: string) => string;
}

const ColorSection: React.FC<ColorSectionProps> = ({
  suggestedColors,
  selectedColors,
  onColorToggle,
  theme,
  t
}) => {
  const [isExpanded, setIsExpanded] = useState(suggestedColors.length > 0);

  if (suggestedColors.length === 0) return null;

  return (
    <div className={cn(
      'rounded-lg border transition-all duration-200',
      theme === 'dark' ? 'border-neutral-800/50' : 'border-neutral-200'
    )}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          'w-full flex justify-between items-center text-left p-3 transition-all duration-200',
          'hover:bg-neutral-800/10',
          isExpanded && (theme === 'dark' ? 'bg-neutral-800/20' : 'bg-neutral-100/50')
        )}
      >
        <div className="flex items-center gap-2">
          <Palette size={14} className="text-neutral-500" />
          <span className={cn(
            'text-[10px] font-mono uppercase tracking-widest',
            theme === 'dark' ? 'text-neutral-500' : 'text-neutral-600'
          )}>
            {t('mockup.colorPalette') || 'Color Palette'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {selectedColors.length > 0 && (
            <div className="flex gap-0.5">
              {selectedColors.slice(0, 5).map(color => (
                <div
                  key={color}
                  className="w-3 h-3 rounded-full border border-white/20"
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          )}
          {isExpanded ? (
            <ChevronUp size={16} className="text-neutral-500" />
          ) : (
            <ChevronDown size={16} className="text-neutral-500" />
          )}
        </div>
      </button>

      {isExpanded && (
        <div className="p-3 pt-0 animate-fade-in">
          <div className="flex flex-wrap gap-2 mt-2">
            {suggestedColors.map(color => (
              <button
                key={color}
                onClick={() => onColorToggle(color)}
                className={cn(
                  'w-8 h-8 rounded-lg border-2 transition-all duration-200',
                  selectedColors.includes(color)
                    ? 'border-brand-cyan scale-110 shadow-lg shadow-brand-cyan/20'
                    : 'border-transparent hover:border-neutral-500 hover:scale-105'
                )}
                style={{ backgroundColor: color }}
                title={color}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export const DirectorSidePanel: React.FC<DirectorSidePanelProps> = ({
  isOpen,
  onClose,
  nodeData,
  nodeId,
  onAnalyze,
  onGeneratePrompt,
  onUpdateData
}) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const panelRef = useRef<HTMLDivElement>(null);

  const connectedImage = nodeData.connectedImage;
  const isAnalyzing = nodeData.isAnalyzing || false;
  const hasAnalyzed = nodeData.hasAnalyzed || false;
  const isGeneratingPrompt = nodeData.isGeneratingPrompt || false;
  const generatedPrompt = nodeData.generatedPrompt;

  // Tag selections
  const selectedBrandingTags = nodeData.selectedBrandingTags || [];
  const selectedCategoryTags = nodeData.selectedCategoryTags || [];
  const selectedLocationTags = nodeData.selectedLocationTags || [];
  const selectedAngleTags = nodeData.selectedAngleTags || [];
  const selectedLightingTags = nodeData.selectedLightingTags || [];
  const selectedEffectTags = nodeData.selectedEffectTags || [];
  const selectedMaterialTags = nodeData.selectedMaterialTags || [];
  const selectedColors = nodeData.selectedColors || [];

  // Suggested tags from analysis
  const suggestedBrandingTags = nodeData.suggestedBrandingTags || [];
  const suggestedCategoryTags = nodeData.suggestedCategoryTags || [];
  const suggestedLocationTags = nodeData.suggestedLocationTags || [];
  const suggestedAngleTags = nodeData.suggestedAngleTags || [];
  const suggestedLightingTags = nodeData.suggestedLightingTags || [];
  const suggestedEffectTags = nodeData.suggestedEffectTags || [];
  const suggestedMaterialTags = nodeData.suggestedMaterialTags || [];
  const suggestedColors = nodeData.suggestedColors || [];

  // Tag toggle handlers
  const createTagToggle = useCallback((
    field: keyof DirectorNodeData,
    currentTags: string[]
  ) => (tag: string) => {
    const newTags = currentTags.includes(tag)
      ? currentTags.filter(t => t !== tag)
      : [...currentTags, tag];
    onUpdateData(nodeId, { [field]: newTags });
  }, [nodeId, onUpdateData]);

  const toggleBrandingTag = createTagToggle('selectedBrandingTags', selectedBrandingTags);
  const toggleCategoryTag = createTagToggle('selectedCategoryTags', selectedCategoryTags);
  const toggleLocationTag = createTagToggle('selectedLocationTags', selectedLocationTags);
  const toggleAngleTag = createTagToggle('selectedAngleTags', selectedAngleTags);
  const toggleLightingTag = createTagToggle('selectedLightingTags', selectedLightingTags);
  const toggleEffectTag = createTagToggle('selectedEffectTags', selectedEffectTags);
  const toggleMaterialTag = createTagToggle('selectedMaterialTags', selectedMaterialTags);
  const toggleColor = createTagToggle('selectedColors', selectedColors);

  // Check if we have any selections for the generate button
  const hasSelections = selectedBrandingTags.length > 0 ||
    selectedCategoryTags.length > 0 ||
    selectedLocationTags.length > 0 ||
    selectedAngleTags.length > 0 ||
    selectedLightingTags.length > 0 ||
    selectedEffectTags.length > 0 ||
    selectedMaterialTags.length > 0 ||
    selectedColors.length > 0;

  // Close on escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={panelRef}
      className={cn(
        'fixed right-0 top-0 h-full z-50',
        'w-[400px] max-w-[90vw]',
        'bg-neutral-950/95 backdrop-blur-xl',
        'border-l border-neutral-800/50',
        'flex flex-col',
        'animate-slide-in-right'
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-neutral-800/50">
        <div className="flex items-center gap-3">
          <Compass size={20} className="text-brand-cyan" />
          <h2 className="text-sm font-semibold text-neutral-200 font-mono uppercase">
            {t('canvasNodes.directorNode.title') || 'Director'}
          </h2>
        </div>
        <button
          onClick={onClose}
          className="p-2 text-neutral-500 hover:text-white transition-colors rounded-lg hover:bg-neutral-800/50"
        >
          <X size={18} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Connected Image Preview */}
        {connectedImage && (
          <div className="rounded-lg overflow-hidden border border-neutral-800/50">
            <img
              src={connectedImage.startsWith('data:') ? connectedImage : `data:image/png;base64,${connectedImage}`}
              alt="Connected"
              className="w-full h-48 object-cover"
            />
          </div>
        )}

        {/* No Image State */}
        {!connectedImage && (
          <div className="rounded-lg border border-dashed border-neutral-700/50 p-8 text-center">
            <Compass size={32} className="mx-auto text-neutral-600 mb-3" />
            <p className="text-sm text-neutral-500 font-mono">
              {t('canvasNodes.directorNode.connectImageFirst') || 'Connect an image to the Director node to start'}
            </p>
          </div>
        )}

        {/* Analyze Button */}
        {connectedImage && !hasAnalyzed && (
          <button
            onClick={onAnalyze}
            disabled={isAnalyzing}
            className={cn(
              'w-full px-4 py-3 rounded-lg border transition-all duration-200',
              'flex items-center justify-center gap-2',
              'text-sm font-mono',
              isAnalyzing
                ? 'bg-neutral-800/50 border-neutral-700/50 text-neutral-400 cursor-not-allowed'
                : 'bg-brand-cyan/10 border-[brand-cyan]/30 text-brand-cyan hover:bg-brand-cyan/20'
            )}
          >
            {isAnalyzing ? (
              <>
                <GlitchLoader size={16} color="currentColor" />
                <span>{t('canvasNodes.directorNode.analyzing') || 'Analyzing...'}</span>
              </>
            ) : (
              <>
                <Sparkles size={16} />
                <span>{t('canvasNodes.directorNode.analyzeImage') || 'Analyze Image'}</span>
              </>
            )}
          </button>
        )}

        {/* Tag Selection Sections (after analysis) */}
        {hasAnalyzed && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles size={14} className="text-brand-cyan" />
              <span className="text-xs font-mono text-brand-cyan">
                {t('canvasNodes.directorNode.selectTags') || 'Select tags for your prompt'}
              </span>
            </div>

            {/* Branding Tags */}
            <TagSection
              title={t('mockup.branding') || 'Branding'}
              icon={<Package size={14} />}
              tags={AVAILABLE_BRANDING_TAGS}
              suggestedTags={suggestedBrandingTags}
              selectedTags={selectedBrandingTags}
              onTagToggle={toggleBrandingTag}
              theme={theme}
              t={t}
            />

            {/* Category Tags */}
            <TagSection
              title={t('mockup.categories') || 'Categories'}
              icon={<Layers size={14} />}
              tags={AVAILABLE_TAGS}
              suggestedTags={suggestedCategoryTags}
              selectedTags={selectedCategoryTags}
              onTagToggle={toggleCategoryTag}
              theme={theme}
              t={t}
            />

            {/* Location Tags */}
            <TagSection
              title={t('mockup.location') || 'Location'}
              icon={<MapPin size={14} />}
              tags={AVAILABLE_LOCATION_TAGS}
              suggestedTags={suggestedLocationTags}
              selectedTags={selectedLocationTags}
              onTagToggle={toggleLocationTag}
              theme={theme}
              t={t}
            />

            {/* Angle Tags */}
            <TagSection
              title={t('mockup.angle') || 'Angle'}
              icon={<Camera size={14} />}
              tags={AVAILABLE_ANGLE_TAGS}
              suggestedTags={suggestedAngleTags}
              selectedTags={selectedAngleTags}
              onTagToggle={toggleAngleTag}
              theme={theme}
              t={t}
            />

            {/* Lighting Tags */}
            <TagSection
              title={t('mockup.lighting') || 'Lighting'}
              icon={<Lightbulb size={14} />}
              tags={AVAILABLE_LIGHTING_TAGS}
              suggestedTags={suggestedLightingTags}
              selectedTags={selectedLightingTags}
              onTagToggle={toggleLightingTag}
              theme={theme}
              t={t}
            />

            {/* Effect Tags */}
            <TagSection
              title={t('mockup.effects') || 'Effects'}
              icon={<Sparkles size={14} />}
              tags={AVAILABLE_EFFECT_TAGS}
              suggestedTags={suggestedEffectTags}
              selectedTags={selectedEffectTags}
              onTagToggle={toggleEffectTag}
              theme={theme}
              t={t}
            />

            {/* Material Tags */}
            <TagSection
              title={t('mockup.materials') || 'Materials'}
              icon={<Layers size={14} />}
              tags={AVAILABLE_MATERIAL_TAGS}
              suggestedTags={suggestedMaterialTags}
              selectedTags={selectedMaterialTags}
              onTagToggle={toggleMaterialTag}
              theme={theme}
              t={t}
            />

            {/* Color Palette */}
            <ColorSection
              suggestedColors={suggestedColors}
              selectedColors={selectedColors}
              onColorToggle={toggleColor}
              theme={theme}
              t={t}
            />
          </div>
        )}

        {/* Generated Prompt Preview */}
        {generatedPrompt && (
          <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Wand2 size={14} className="text-green-400" />
              <span className="text-xs font-mono text-green-400 uppercase">
                {t('canvasNodes.directorNode.generatedPrompt') || 'Generated Prompt'}
              </span>
            </div>
            <p className="text-sm text-neutral-300 whitespace-pre-wrap">{generatedPrompt}</p>
          </div>
        )}
      </div>

      {/* Footer with Generate Button */}
      {hasAnalyzed && (
        <div className="p-4 border-t border-neutral-800/50">
          <button
            onClick={onGeneratePrompt}
            disabled={!hasSelections || isGeneratingPrompt}
            className={cn(
              'w-full px-4 py-3 rounded-lg border transition-all duration-200',
              'flex items-center justify-center gap-2',
              'text-sm font-mono font-semibold',
              (!hasSelections || isGeneratingPrompt)
                ? 'bg-neutral-800/50 border-neutral-700/50 text-neutral-500 cursor-not-allowed'
                : 'bg-brand-cyan text-black border-brand-cyan hover:bg-brand-cyan/90'
            )}
          >
            {isGeneratingPrompt ? (
              <>
                <GlitchLoader size={16} color="currentColor" />
                <span>{t('canvasNodes.directorNode.generating') || 'Generating...'}</span>
              </>
            ) : (
              <>
                <Wand2 size={16} />
                <span>{t('canvasNodes.directorNode.generateAndCreate') || 'Generate Prompt & Create Node'}</span>
              </>
            )}
          </button>
          {!hasSelections && (
            <p className="text-[10px] text-neutral-500 text-center mt-2 font-mono">
              {t('canvasNodes.directorNode.selectAtLeastOneTag') || 'Select at least one tag to generate'}
            </p>
          )}
        </div>
      )}
    </div>
  );
};
