import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Save, FileDown, Zap, Edit2, Check, X } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { useTheme } from '@/hooks/useTheme';
import { generateBrandingPDF } from '@/utils/generateBrandingPDF';
import { GridDotsBackground } from '@/components/ui/GridDotsBackground';
import { useBrandingMoodboard } from '@/hooks/useBrandingMoodboard';
import { useSectionLayout } from '@/hooks/useSectionLayout';
import { useAutoSave } from '@/hooks/useAutoSave';
import { getSectionEmoji } from '@/utils/brandingHelpers';
import { BrandingSectionCard } from './BrandingSectionCard';
import { BrandingCompactCard } from './BrandingCompactCard';
import { EmptySectionCard } from './EmptySectionCard';
import { NotionColumnLayout } from './NotionColumnLayout';
import type { BrandingData } from '@/types/types';

interface BrandingMoodboardProps {
  data: BrandingData;
  onSave: (data: BrandingData, isAutoSave?: boolean) => Promise<void>;
  isSaving?: boolean;
  prompt?: string;
  projectName?: string | null; // Nome do projeto da tabela
  generatingSteps?: Set<number>;
  onGenerateSection?: (stepNumber: number) => Promise<void>;
  onGenerateAll?: () => Promise<void>;
  steps?: Array<{ id: number; title: string }>;
  onFeedback?: (stepNumber: number, type: 'up' | 'down') => void;
  checkDependencies?: (stepNumber: number) => number[]; // Function to check missing dependencies
}

export const BrandingMoodboard: React.FC<BrandingMoodboardProps> = ({
  data,
  onSave,
  isSaving = false,
  prompt = '',
  projectName,
  generatingSteps = new Set(),
  onGenerateSection,
  onGenerateAll,
  steps = [],
  onFeedback,
  checkDependencies,
}) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const {
    editableData,
    setEditableData,
    editingSections,
    setEditingSections,
    collapsedSections,
    compactSections,
    toggleSectionCompact,
    toggleSectionEdit,
    updateStepContent,
    getStepContent,
    hasContent,
    updateLayout,
    getLayout,
  } = useBrandingMoodboard({ data, steps });

  // Get step IDs - only include sections with data that are not compact
  // Empty sections will be shown in the compact grid as EmptySectionCard
  const expandedStepIds = useMemo(
    () => {
      return steps
        .filter(step => {
          const hasData = hasContent(step.id);
          const isCompact = compactSections.has(step.id);
          // Only include if has data AND not in compact sections
          return hasData && !isCompact;
        })
        .map(step => step.id);
    },
    [steps, compactSections, hasContent]
  );

  // Get empty step IDs (without data) to show as EmptySectionCard in compact grid
  // Exclude step 12 (moodboard) from empty cards
  const emptyStepIds = useMemo(
    () => {
      return steps
        .filter(step => !hasContent(step.id) && step.id !== 12)
        .map(step => step.id);
    },
    [steps, hasContent]
  );

  // Initialize and manage layout
  // Passar editableData.layout diretamente - o hook faz comparação profunda
  const {
    layout,
    moveSection,
    resizeSection,
    addColumn,
    sectionsByColumn,
    getSectionPosition,
    toggleFullWidth,
    setColumnCount,
  } = useSectionLayout({
    stepIds: expandedStepIds,
    initialLayout: editableData.layout,
    onLayoutChange: updateLayout,
  });

  // Auto-save with debounce - saves automatically after changes
  // Only enable auto-save when not generating, not editing, and user is authenticated
  const isGeneratingAny = generatingSteps.size > 0;
  const isEditingAny = editingSections.size > 0;
  useAutoSave({
    data: editableData,
    onSave: async (dataToSave) => {
      // Pass isAutoSave flag to make feedback more subtle
      await onSave(dataToSave, true);
    },
    debounceMs: 2000, // 2 seconds after last change
    enabled: !isGeneratingAny && !isSaving && !isEditingAny, // Disable during generation, manual save, or active editing
  });

  // ESC key to exit edit mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && editingSections.size > 0) {
        // Exit edit mode for all sections
        setEditingSections(new Set());
      }
    };

    if (editingSections.size > 0) {
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        window.removeEventListener('keydown', handleKeyDown);
      };
    }

    // Always return a cleanup function, even if it's a no-op
    return () => { };
  }, [editingSections, setEditingSections]);

  const handleSave = async () => {
    await onSave(editableData, false); // Manual save - show toast
    setEditingSections(new Set());
  };

  const handleSaveSection = async (stepNumber: number) => {
    await onSave(editableData, false); // Manual save - show toast
    setEditingSections(prev => {
      const next = new Set(prev);
      next.delete(stepNumber);
      return next;
    });
  };

  const handleRegenerateSection = async (stepNumber: number) => {
    if (onGenerateSection) {
      await onGenerateSection(stepNumber);
    }
  };

  const handleGenerateAndExpand = async (stepNumber: number) => {
    if (onGenerateSection) {
      // Remover de compact sections antes de gerar
      if (compactSections.has(stepNumber)) {
        toggleSectionCompact(stepNumber);
      }
      // Remover de collapsed sections para expandir
      if (collapsedSections.has(stepNumber)) {
        // collapsedSections não tem toggle direto, mas vamos garantir que não fique collapsed
      }
      await onGenerateSection(stepNumber);
    }
  };

  const handleGeneratePDF = () => {
    try {
      generateBrandingPDF(editableData, prompt || data.prompt, t, steps);
    } catch (error) {
      console.error('Error generating PDF:', error);
    }
  };

  const handleContentChange = (stepNumber: number, value: any) => {
    updateStepContent(stepNumber, value);
  };

  const [isEditingName, setIsEditingName] = useState(false);
  // Use projectName from props (database) first, then fallback to data.name
  const [localProjectName, setLocalProjectName] = useState(projectName || editableData.name || '');

  useEffect(() => {
    // Update local name when prop changes or when data.name changes
    // But don't update if user is currently editing the name
    if (!isEditingName) {
      const nameToUse = projectName || editableData.name || '';
      setLocalProjectName(nameToUse);
    }
  }, [projectName, editableData.name, isEditingName]);

  const handleNameChange = (newName: string) => {
    setLocalProjectName(newName);
    setEditableData(prev => ({ ...prev, name: newName }));
  };

  const handleNameAccept = async () => {
    setIsEditingName(false);
    const currentName = projectName || editableData.name || '';
    const trimmedName = localProjectName.trim();
    if (trimmedName !== currentName) {
      // Update editableData with the new name before saving
      const updatedData = { ...editableData, name: trimmedName };
      setEditableData(updatedData);
      // Save immediately to update database with the updated data
      await onSave(updatedData, false);
    }
  };

  const handleNameCancel = () => {
    const currentName = projectName || editableData.name || '';
    setLocalProjectName(currentName);
    setIsEditingName(false);
  };

  const handleNameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleNameAccept();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleNameCancel();
    }
  };

  return (
    <div className={`w-full relative min-h-screen ${theme === 'dark' ? 'bg-[#121212] text-zinc-300' : 'bg-zinc-50 text-zinc-800'
      }`}>
      <div className="fixed inset-0 z-0">
        <GridDotsBackground />
      </div>
      <div className="relative z-10 pt-10 md:pt-14">
        <div className="max-w-[1800px] mx-auto px-4 md:px-6 py-4 md:py-6 space-y-3">
          {/* Header Section */}
          <section className={`border rounded-xl p-4 md:p-5 flex-shrink-0 ${theme === 'dark'
            ? 'bg-[#141414] border-zinc-800/60'
            : 'bg-white border-zinc-300'
            }`}>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-4">
              <div className="flex-1 min-w-0">
                {isEditingName ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={localProjectName}
                      onChange={(e) => handleNameChange(e.target.value)}
                      onKeyDown={handleNameKeyDown}
                      onFocus={(e) => e.target.select()}
                      placeholder={t('branding.projectNamePlaceholder') || 'Nome do projeto'}
                      className={`flex-1 text-xl md:text-2xl font-semibold font-manrope bg-transparent border-b-2 border-[brand-cyan]/50 focus:border-[brand-cyan] focus:outline-none pb-1 transition-colors ${theme === 'dark' ? 'text-zinc-200' : 'text-zinc-800'
                        }`}
                      autoFocus
                    />
                    <button
                      onClick={handleNameAccept}
                      className={`p-1.5 rounded-md transition-colors ${theme === 'dark'
                        ? 'bg-brand-cyan/20 hover:bg-brand-cyan/30 text-brand-cyan'
                        : 'bg-brand-cyan/20 hover:bg-brand-cyan/30 text-brand-cyan'
                        }`}
                      title="Salvar (Enter)"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                    <button
                      onClick={handleNameCancel}
                      className={`p-1.5 rounded-md transition-colors ${theme === 'dark'
                        ? 'bg-zinc-800/60 hover:bg-zinc-800/80 text-zinc-400 hover:text-zinc-300'
                        : 'bg-zinc-200 hover:bg-zinc-300 text-zinc-600 hover:text-zinc-700'
                        }`}
                      title="Cancelar (ESC)"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 group">
                    {localProjectName ? (
                      <>
                        <h2
                          className={`text-xl md:text-2xl font-semibold font-manrope cursor-pointer hover:text-brand-cyan transition-colors truncate ${theme === 'dark' ? 'text-zinc-200' : 'text-zinc-800'
                            }`}
                          onClick={() => setIsEditingName(true)}
                          title={localProjectName}
                        >
                          {localProjectName}
                        </h2>
                        <button
                          onClick={() => setIsEditingName(true)}
                          className={`opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded ${theme === 'dark' ? 'hover:bg-black/40' : 'hover:bg-zinc-200'
                            }`}
                          title={t('branding.editProjectName') || 'Editar nome do projeto'}
                        >
                          <Edit2 className={`h-4 w-4 hover:text-brand-cyan ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-600'
                            }`} />
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => setIsEditingName(true)}
                        className={`text-xl md:text-2xl font-semibold font-manrope hover:text-brand-cyan transition-colors ${theme === 'dark' ? 'text-zinc-500' : 'text-zinc-400'
                          }`}
                      >
                        {t('branding.projectNamePlaceholder') || 'Clique para adicionar nome do projeto'}
                      </button>
                    )}
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {onGenerateAll && (
                  <button
                    onClick={onGenerateAll}
                    disabled={generatingSteps.size > 0}
                    className={`px-4 py-2 border rounded-xl text-sm font-mono transition-all duration-300 hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 hover:border-[brand-cyan]/50 hover:text-brand-cyan ${theme === 'dark'
                      ? 'bg-black/40 border-zinc-800/60 text-zinc-300 disabled:border-zinc-800/30 disabled:text-zinc-600'
                      : 'bg-zinc-100 border-zinc-300 text-zinc-800 disabled:border-zinc-200 disabled:text-zinc-400'
                      }`}
                  >
                    <Zap className="h-4 w-4" />
                    {t('branding.generateAll')}
                  </button>
                )}
                <button
                  onClick={handleGeneratePDF}
                  className={`px-4 py-2 border rounded-xl text-sm font-mono transition-all duration-300 hover:scale-[1.02] active:scale-95 flex items-center gap-2 hover:border-[brand-cyan]/50 hover:text-brand-cyan ${theme === 'dark'
                    ? 'bg-black/40 border-zinc-800/60 text-zinc-300'
                    : 'bg-zinc-100 border-zinc-300 text-zinc-800'
                    }`}
                >
                  <FileDown className="h-4 w-4" />
                  {t('branding.generatePDF')}
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving || !hasContent(1)}
                  className={`px-4 py-2 bg-brand-cyan/90 hover:bg-brand-cyan text-black font-semibold rounded-xl text-sm font-mono transition-all duration-300 hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 ${theme === 'dark'
                    ? 'disabled:bg-zinc-700 disabled:text-zinc-500'
                    : 'disabled:bg-zinc-300 disabled:text-zinc-400'
                    }`}
                >
                  <Save className="h-4 w-4" />
                  {isSaving ? t('branding.saving') : t('branding.saveProject')}
                </button>
              </div>
            </div>
          </section>

          {/* Notion-style Column Layout */}
          <div className="space-y-3">

            {/* Column Layout */}
            {expandedStepIds.length > 0 && (
              <NotionColumnLayout
                layout={layout}
                sectionsByColumn={sectionsByColumn}
                stepIds={expandedStepIds}
                steps={steps}
                renderSection={(stepNumber, dragProps) => {
                  const step = steps.find(s => s.id === stepNumber);
                  if (!step) return null;

                  const content = getStepContent(stepNumber);
                  const hasData = hasContent(stepNumber);
                  const isGenerating = generatingSteps.has(stepNumber);

                  // Renderizar apenas cards com dados (empty cards vão para grid de compactas)
                  const isEditingSection = editingSections.has(stepNumber);
                  const canEdit = hasData; // Permitir edição de qualquer seção com dados
                  const isCollapsed = collapsedSections.has(stepNumber);
                  const emoji = getSectionEmoji(stepNumber);

                  return (
                    <BrandingSectionCard
                      stepNumber={stepNumber}
                      stepTitle={step.title}
                      emoji={emoji}
                      content={content}
                      hasData={hasData}
                      isGenerating={isGenerating}
                      isEditing={isEditingSection}
                      canEdit={canEdit}
                      isCollapsed={isCollapsed}
                      steps={steps}
                      hasContent={hasContent}
                      onToggleCompact={() => toggleSectionCompact(stepNumber)}
                      onEdit={() => toggleSectionEdit(stepNumber)}
                      onRegenerate={onGenerateSection ? () => handleRegenerateSection(stepNumber) : undefined}
                      onSave={() => handleSaveSection(stepNumber)}
                      onGenerate={onGenerateSection ? () => onGenerateSection(stepNumber) : undefined}
                      onContentChange={(value) => handleContentChange(stepNumber, value)}
                      isSaving={isSaving}
                      isDraggable={dragProps.isDraggable}
                      onDragStart={dragProps.onDragStart}
                      onDragEnd={dragProps.onDragEnd}
                      customHeight={dragProps.customHeight}
                      onResize={dragProps.onResize}
                      prompt={prompt}
                      onFeedback={onFeedback}
                    />
                  );
                }}
                onMoveSection={moveSection}
                onResizeSection={resizeSection}
                onAddColumn={addColumn}
                onToggleFullWidth={toggleFullWidth}
                onSetColumnCount={setColumnCount}
                getSectionHeight={(stepNumber) => {
                  const position = getSectionPosition(stepNumber);
                  return position?.height;
                }}
              />
            )}
          </div>

          {/* Grid of Compact Cards - includes empty sections and collapsed sections */}
          {(emptyStepIds.length > 0 || steps.some((step) => compactSections.has(step.id))) && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-2 md:gap-3">
              {/* Empty sections - show as EmptySectionCard in black and white */}
              {emptyStepIds.map((stepNumber) => {
                const step = steps.find(s => s.id === stepNumber);
                if (!step) return null;
                const isGenerating = generatingSteps.has(stepNumber);
                const missingDeps = checkDependencies ? checkDependencies(stepNumber) : [];
                const isBlocked = missingDeps.length > 0;

                return (
                  <EmptySectionCard
                    key={stepNumber}
                    stepNumber={stepNumber}
                    stepTitle={step.title}
                    onGenerate={() => handleGenerateAndExpand(stepNumber)}
                    isGenerating={isGenerating}
                    isBlocked={isBlocked}
                    missingDependencies={missingDeps}
                    steps={steps}
                  />
                );
              })}

              {/* Collapsed sections with data - show as BrandingCompactCard */}
              {steps
                .filter((step) => {
                  const hasData = hasContent(step.id);
                  const isCompact = compactSections.has(step.id);
                  // Only show if has data AND is compact (collapsed)
                  return hasData && isCompact;
                })
                .map((step) => {
                  const stepNumber = step.id;
                  const isGenerating = generatingSteps.has(stepNumber);
                  const emoji = getSectionEmoji(stepNumber);

                  return (
                    <BrandingCompactCard
                      key={step.id}
                      stepId={stepNumber}
                      stepTitle={step.title}
                      emoji={emoji}
                      isGenerating={isGenerating}
                      onClick={() => toggleSectionCompact(stepNumber)}
                    />
                  );
                })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
