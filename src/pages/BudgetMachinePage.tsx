import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from '@/hooks/useTranslation';
import { useLayout } from '@/hooks/useLayout';
import { usePremiumAccess } from '@/hooks/usePremiumAccess';
import { budgetApi } from '../services/budgetApi';
import { useBudgetAutoSave } from '@/hooks/useBudgetAutoSave';
import { BudgetTemplateSelector } from '../components/budget/BudgetTemplateSelector';
import { BudgetForm } from '../components/budget/BudgetForm';
import { BudgetPreview } from '../components/budget/BudgetPreview';
import { PdfUploadRequired } from '../components/budget/PdfUploadRequired';
import { BrandCustomizationPanel } from '../components/budget/BrandCustomizationPanel';
import { FieldPropertiesPanel } from '../components/budget/FieldPropertiesPanel';
import { FormButton } from '../components/ui/form-button';
import { Tooltip } from '../components/ui/Tooltip';
import type { PdfFieldMapping } from '../types/types';
import { toast } from 'sonner';
import type { BudgetData } from '../types/types';
import { Save, Download, Share2, Copy, Check, AlertCircle, Menu, X } from 'lucide-react';
import { GlitchLoader } from '../components/ui/GlitchLoader';
import { generateBudgetPDF } from '@/utils/generateBudgetPDF';
import { getTemplateById } from '@/utils/budgetTemplates';
import { DndContext, PointerSensor, useSensor, useSensors, DragEndEvent, DragStartEvent, DragOverlay } from '@dnd-kit/core';
import { SEO } from '../components/SEO';

export const BudgetMachinePage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isAuthenticated, isCheckingAuth } = useLayout();
  const { hasAccess, isLoading: isLoadingAccess } = usePremiumAccess();

  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [budgetData, setBudgetData] = useState<BudgetData | null>(null);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [budgetName, setBudgetName] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingProject, setIsLoadingProject] = useState(false);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const loadedProjectIdRef = useRef<string | null>(null);

  // PDF positioning mode for custom templates
  const [positioningFieldId, setPositioningFieldId] = useState<string | null>(null);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [pendingFieldPosition, setPendingFieldPosition] = useState<{ pageNum: number; x: number; y: number } | null>(null);
  const [focusedFieldId, setFocusedFieldId] = useState<string | null>(null);

  // Form width state for resize
  const [formWidth, setFormWidth] = useState<number | null>(null);
  const formContainerRef = useRef<HTMLDivElement>(null);

  // Sidebar open/close state
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Initialize default budget data
  const initializeBudgetData = (templateId: string): BudgetData => {
    const baseData: BudgetData = {
      template: templateId,
      clientName: '',
      projectName: '',
      projectDescription: '',
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days from now
      deliverables: [],
      observations: '',
      links: {},
      faq: [],
      brandColors: ['var(--brand-cyan)'],
      brandName: 'Your Brand',
      brandLogo: undefined,
    };

    if (templateId === 'visant') {
      return {
        ...baseData,
        paymentInfo: {
          totalHours: 30,
          hourlyRate: 258,
          pixKey: '29673608000169',
          cashDiscountPercent: 8,
          paymentMethods: [],
        },
        signatures: [
          { name: 'Pedro Xavier', role: 'Designer / Diretor' },
          { name: 'Pedro Jaques', role: 'Designer / Diretor' },
        ],
        contentWidth: 800, // Default width
        contentHeight: undefined, // Auto height by default
      };
    }

    if (templateId === 'custom') {
      return {
        ...baseData,
        customPdfUrl: undefined,
        pdfFieldMappings: [],
      };
    }

    return baseData;
  };

  // Redirect to waitlist if user doesn't have premium access
  useEffect(() => {
    if (!isLoadingAccess && !hasAccess) {
      navigate('/waitlist', { replace: true });
    }
  }, [hasAccess, isLoadingAccess, navigate]);

  // Load project from URL if projectId is present
  useEffect(() => {
    const projectId = searchParams.get('projectId');
    const presetId = searchParams.get('presetId');

    if (presetId && presetId.trim() !== '' && presetId !== 'undefined' && isAuthenticated === true) {
      loadPreset(presetId);
    } else if (projectId && projectId.trim() !== '' && projectId !== 'undefined' && isAuthenticated === true) {
      if (loadedProjectIdRef.current !== projectId) {
        loadProject(projectId);
      }
    } else {
      loadedProjectIdRef.current = null;
    }
  }, [searchParams, isAuthenticated]);

  const loadPreset = async (presetId: string) => {
    if (isLoadingProject) {
      return;
    }

    setIsLoadingProject(true);

    try {
      const presets = await budgetApi.getPdfPresets();
      const preset = presets.find(p => (p._id || p.id) === presetId);

      if (!preset) {
        throw new Error('Preset not found');
      }

      setSelectedTemplate('custom');
      setCurrentProjectId(null);
      setBudgetName(preset.name || t('budget.title') || 'Budget Machine');

      // Initialize budget data with preset PDF
      const data: BudgetData = {
        ...initializeBudgetData('custom'),
        customPdfUrl: preset.pdfUrl,
        pdfFieldMappings: [], // Start with empty mappings, user can add them
      };

      setBudgetData(data);
      toast.success(t('budget.presetLoaded') || 'Preset loaded successfully');

      // Remove presetId from URL after loading
      navigate('/budget-machine', { replace: true });
    } catch (error: any) {
      console.error('Error loading preset:', error);
      toast.error(error.message || t('budget.errors.failedToLoadPreset') || 'Failed to load preset');
      navigate('/budget-machine', { replace: true });
    } finally {
      setIsLoadingProject(false);
    }
  };

  const loadProject = async (projectId: string) => {
    if (loadedProjectIdRef.current === projectId || isLoadingProject) {
      return;
    }

    setIsLoadingProject(true);
    loadedProjectIdRef.current = projectId;

    try {
      const project = await budgetApi.getById(projectId);
      const id = project._id || (project as any).id;
      setCurrentProjectId(id);
      setSelectedTemplate(project.template);
      setBudgetName(project.name || t('budget.title') || 'Budget Machine');

      // Convert project data to BudgetData
      const data: BudgetData = {
        template: project.template,
        clientName: project.clientName,
        projectName: project.name || project.projectDescription.split('\n')[0] || '',
        projectDescription: project.projectDescription,
        startDate: project.startDate,
        endDate: project.endDate,
        deliverables: Array.isArray(project.deliverables) ? project.deliverables : [],
        observations: project.observations || '',
        links: project.links || {},
        faq: Array.isArray(project.faq) ? project.faq : [],
        brandColors: project.brandColors || ['var(--brand-cyan)'],
        brandName: project.brandName,
        brandLogo: project.brandLogo || undefined,
        brandBackgroundColor: project.brandBackgroundColor || undefined,
        brandAccentColor: project.brandAccentColor || undefined,
        timeline: (project as any).timeline || undefined,
        paymentInfo: (project as any).paymentInfo || undefined,
        signatures: (project as any).signatures || undefined,
        giftOptions: (project as any).giftOptions || undefined,
        customContent: (project as any).customContent || undefined,
        finalCTAText: (project as any).finalCTAText || undefined,
        year: (project as any).year || undefined,
        serviceTitle: (project as any).data?.serviceTitle || (project as any).serviceTitle || undefined,
        coverBackgroundColor: (project as any).data?.coverBackgroundColor || (project as any).coverBackgroundColor || undefined,
        coverTextColor: (project as any).data?.coverTextColor || (project as any).coverTextColor || undefined,
        customPdfUrl: (project as any).data?.customPdfUrl || (project as any).customPdfUrl || undefined,
        pdfFieldMappings: (project as any).data?.pdfFieldMappings || (project as any).pdfFieldMappings || undefined,
      };

      setBudgetData(data);
      toast.success(t('budget.saved') || 'Budget loaded successfully');
    } catch (error: any) {
      console.error('Error loading budget:', error);
      toast.error(error.message || t('budget.errors.failedToLoad') || 'Failed to load budget');
      navigate('/budget-machine', { replace: true });
      loadedProjectIdRef.current = null;
    } finally {
      setIsLoadingProject(false);
    }
  };

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplate(templateId);
    setBudgetData(initializeBudgetData(templateId));
    setBudgetName(t('budget.title') || 'Budget Machine');
    setCurrentProjectId(null);
  };


  // Auto-save hook
  const { isSaving: isAutoSaving, saveStatus } = useBudgetAutoSave({
    data: budgetData,
    projectId: currentProjectId,
    enabled: isAuthenticated === true && !!currentProjectId && !!budgetData,
    debounceMs: 1500,
    onSaveSuccess: (savedId) => {
      if (savedId !== currentProjectId) {
        setCurrentProjectId(savedId);
      }
    },
    onSaveError: (error) => {
      console.error('Auto-save error:', error);
      // Don't show toast for auto-save errors to avoid spam
    },
  });

  const handlePreviewDataChange = (partialData: Partial<BudgetData>) => {
    if (budgetData) {
      setBudgetData({ ...budgetData, ...partialData });
    }
  };

  const handleBrandDataChange = (partialData: Partial<BudgetData>) => {
    if (budgetData) {
      setBudgetData({ ...budgetData, ...partialData });
    }
  };

  const validateData = (): boolean => {
    if (!budgetData) return false;

    // Skip field validation for custom templates
    if (budgetData.template !== 'custom') {
      if (!budgetData.clientName.trim()) {
        toast.error(t('budget.errors.requiredFields') || 'Please fill in all required fields');
        return false;
      }

      if (!budgetData.projectName.trim()) {
        toast.error(t('budget.errors.requiredFields') || 'Please fill in all required fields');
        return false;
      }

      if (!budgetData.projectDescription.trim()) {
        toast.error(t('budget.errors.requiredFields') || 'Please fill in all required fields');
        return false;
      }
    }

    // Always validate dates
    if (new Date(budgetData.endDate) < new Date(budgetData.startDate)) {
      toast.error(t('budget.errors.invalidDates') || 'End date must be after start date');
      return false;
    }

    return true;
  };

  const handleSave = async () => {
    if (!budgetData || !validateData()) return;

    if (isAuthenticated !== true) {
      toast.error('Please sign in to save budgets');
      return;
    }

    setIsSaving(true);

    try {
      const saved = await budgetApi.save(budgetData, currentProjectId || undefined, budgetName || undefined);
      const id = saved._id || (saved as any).id;
      setCurrentProjectId(id);
      navigate(`/budget-machine?projectId=${id}`, { replace: true });
      toast.success(t('budget.saved') || 'Budget saved successfully');
    } catch (error: any) {
      console.error('Error saving budget:', error);
      toast.error(error.message || t('budget.errors.failedToSave') || 'Failed to save budget');
    } finally {
      setIsSaving(false);
    }
  };

  const handleGeneratePDF = async () => {
    if (!budgetData || !validateData()) return;

    try {
      await generateBudgetPDF(budgetData, t);
      toast.success('PDF generated successfully');
    } catch (error: any) {
      console.error('Error generating PDF:', error);
      toast.error(error.message || 'Failed to generate PDF');
    }
  };

  const handleShare = async () => {
    if (!currentProjectId) {
      toast.error('Please save the budget first');
      return;
    }

    try {
      const result = await budgetApi.share(currentProjectId);
      const fullUrl = `${window.location.origin}${result.shareUrl}`;
      setShareLink(fullUrl);

      // Copy to clipboard
      await navigator.clipboard.writeText(fullUrl);
      setLinkCopied(true);
      toast.success(t('budget.linkCopied') || 'Link copied to clipboard!');

      setTimeout(() => setLinkCopied(false), 2000);
    } catch (error: any) {
      console.error('Error sharing budget:', error);
      toast.error(error.message || t('budget.errors.failedToShare') || 'Failed to generate share link');
    }
  };

  const handleDuplicate = async () => {
    if (!currentProjectId) {
      toast.error('Please save the budget first');
      return;
    }

    if (isAuthenticated !== true) {
      toast.error('Please sign in to duplicate budgets');
      return;
    }

    try {
      const duplicated = await budgetApi.duplicate(currentProjectId);
      const id = duplicated._id || (duplicated as any).id;

      // Load the duplicated budget
      await loadProject(id);

      toast.success(t('budget.duplicated') || 'Budget duplicated successfully');
    } catch (error: any) {
      console.error('Error duplicating budget:', error);
      toast.error(error.message || 'Failed to duplicate budget');
    }
  };

  // Form resizer handler
  useEffect(() => {
    if (!budgetData) return;

    const resizer = document.getElementById('form-resizer');
    if (!resizer || !formContainerRef.current) return;

    const formContainer = formContainerRef.current;

    const handleMouseDown = (e: MouseEvent) => {
      e.preventDefault();
      const startX = e.clientX;
      const startWidth = formContainer.offsetWidth;

      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const dx = moveEvent.clientX - startX;
        const newWidth = startWidth + dx;

        // Limites absolutos (pixels) - sidebar overlay não precisa de limites percentuais
        const minWidthAbsolute = 320; // Mínimo de 320px
        const maxWidthAbsolute = 600; // Máximo de 600px para overlay

        if (newWidth >= minWidthAbsolute && newWidth <= maxWidthAbsolute) {
          setFormWidth(newWidth);
        }
      };

      const handleMouseUp = () => {
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };

      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    };

    resizer.addEventListener('mousedown', handleMouseDown);

    return () => {
      resizer.removeEventListener('mousedown', handleMouseDown);
    };
  }, [budgetData]);

  // DnD sensors for drag and drop
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 3,
      },
    })
  );

  const [dragActiveId, setDragActiveId] = useState<string | null>(null);

  const handleDragStart = (event: DragStartEvent) => {
    setDragActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    const activeIdStr = active.id as string;

    // Check if dragging a variable from the menu
    if (activeIdStr.startsWith('variable-')) {
      if (!over || !over.id) {
        setDragActiveId(null);
        return;
      }

      // Extract fieldId from variable-{fieldId}
      const fieldId = activeIdStr.replace('variable-', '');

      // Check if dropped on a PDF page
      const overIdStr = over.id as string;
      if (overIdStr.startsWith('pdf-page-')) {
        const pageNum = parseInt(overIdStr.replace('pdf-page-', ''));
        if (isNaN(pageNum) || !budgetData) {
          setDragActiveId(null);
          return;
        }

        // Get drop position - we'll need to calculate this in PdfPreviewWithFields
        // For now, just pass the event to PdfPreviewWithFields via a callback
        // The actual position calculation will be done there
        setDragActiveId(null);
        return;
      }
    }

    // For moving existing fields, let PdfPreviewWithFields handle it
    setDragActiveId(null);
  };

  const handleDragCancel = () => {
    setDragActiveId(null);
  };

  // Show loading state while checking authentication or access
  if (isCheckingAuth || isLoadingAccess) {
    return (
      <div className="min-h-full w-full flex items-center justify-center bg-[#121212] text-zinc-300">
        <div className="text-center">
          <p className="text-sm font-mono text-zinc-400">Loading...</p>
        </div>
      </div>
    );
  }

  // Don't render content if redirecting
  if (!hasAccess) {
    return null;
  }

  if (isLoadingProject) {
    return (
      <div className="min-h-full w-full flex items-center justify-center bg-[#121212] text-zinc-300">
        <div className="text-center">
          <p className="text-sm font-mono text-zinc-400">Loading budget...</p>
        </div>
      </div>
    );
  }

  if (!selectedTemplate) {
    return (
      <div className="min-h-full w-full bg-[#121212] text-zinc-300">
        <BudgetTemplateSelector
          selectedTemplate={selectedTemplate}
          onSelectTemplate={handleTemplateSelect}
        />
      </div>
    );
  }

  if (!budgetData) {
    return null;
  }

  const isCustom = selectedTemplate === 'custom';

  // If custom template but no PDF uploaded, show upload screen
  if (isCustom && !budgetData.customPdfUrl) {
    return (
      <PdfUploadRequired
        budgetId={currentProjectId || undefined}
        onPdfUploaded={(url) => {
          setBudgetData({ ...budgetData, customPdfUrl: url });
        }}
      />
    );
  }

  return (
    <>
      <SEO
        title="Budget Machine"
        description="Crie e gerencie orçamentos profissionais para seus projetos de design. Templates personalizáveis e geração de PDF."
        keywords="budget machine, orçamento, orçamento design, templates orçamento, gerenciar orçamento"
      />
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div className="min-h-full w-full bg-[#121212] text-zinc-300 pt-10 md:pt-14">
          {/* Brand Customization Panel - Floating (only panel, button is in header) */}
          {budgetData && !isCustom && (
            <BrandCustomizationPanel
              data={budgetData}
              budgetId={currentProjectId || undefined}
              onDataChange={handleBrandDataChange}
              renderButton={false}
            />
          )}

          <div className="relative min-h-[calc(100vh-2.5rem)] md:min-h-[calc(100vh-3.5rem)]">
            {/* Overlay - Close sidebar when clicking outside */}
            {isSidebarOpen && (
              <div
                className="fixed inset-0 bg-black/50 z-30 md:hidden"
                onClick={() => setIsSidebarOpen(false)}
              />
            )}

            {/* Preview Side - Full Width */}
            <div className="w-full h-full overflow-y-auto bg-zinc-100 flex flex-col relative min-h-full">
              {/* Toggle Sidebar Button */}
              <button
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="fixed top-12 md:top-16 z-50 p-1.5 bg-black/30 backdrop-blur-sm border border-zinc-700/20 rounded-md text-zinc-400 hover:text-zinc-300 hover:border-zinc-600/30 hover:bg-black/40 transition-all duration-200 shadow-sm"
                style={isSidebarOpen
                  ? (formWidth ? { left: `${formWidth + 16}px` } : { left: '416px' })
                  : { left: '16px' }
                }
                title={isSidebarOpen ? 'Fechar formulário' : 'Abrir formulário'}
              >
                {isSidebarOpen ? <X size={18} /> : <Menu size={18} />}
              </button>

              {/* Save Status Indicator */}
              {isAuthenticated === true && currentProjectId && (
                <div className="absolute top-2 right-2 z-10 flex items-center gap-2 px-3 py-1.5 bg-white/90 backdrop-blur-sm rounded-md shadow-sm border border-zinc-200">
                  {saveStatus === 'saving' && (
                    <>
                      <GlitchLoader size={14} color="brand-cyan" />
                      <span className="text-xs text-zinc-600">Salvando...</span>
                    </>
                  )}
                  {saveStatus === 'saved' && (
                    <>
                      <Check size={14} className="text-green-500" />
                      <span className="text-xs text-green-600">Salvo</span>
                    </>
                  )}
                  {saveStatus === 'error' && (
                    <>
                      <AlertCircle size={14} className="text-red-500" />
                      <span className="text-xs text-red-600">Erro ao salvar</span>
                    </>
                  )}
                  {saveStatus === 'idle' && (
                    <span className="text-xs text-zinc-400">Pronto</span>
                  )}
                </div>
              )}
              <BudgetPreview
                data={budgetData}
                editable={true}
                onDataChange={handlePreviewDataChange}
                saveStatus={saveStatus}
                positioningFieldId={positioningFieldId}
                onPositioningModeChange={setPositioningFieldId}
                budgetId={currentProjectId}
                onFieldSelect={setSelectedFieldId}
                selectedFieldId={selectedFieldId}
                isSidebarOpen={isSidebarOpen}
              />
            </div>

            {/* Form Side - Overlay Sidebar */}
            <div
              ref={formContainerRef}
              className={`fixed top-10 md:top-14 left-0 h-[calc(100vh-2.5rem)] md:h-[calc(100vh-3.5rem)] z-40 bg-[#121212] border-r border-zinc-800 overflow-hidden flex flex-col transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
                }`}
              style={formWidth ? {
                width: `${formWidth}px`,
                minWidth: '320px',
                maxWidth: '600px'
              } : {
                width: '400px',
                minWidth: '320px',
                maxWidth: '600px'
              }}
            >
              {/* Header with actions */}
              <div className="flex-shrink-0 border-b border-zinc-800 bg-zinc-900 px-4 sm:px-6 py-4">
                {/* Row 1: Title and Description */}
                <div className="flex flex-col mb-4">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={budgetName || t('budget.title') || 'Budget Machine'}
                      onChange={(e) => setBudgetName(e.target.value)}
                      onBlur={async () => {
                        if (currentProjectId && budgetName.trim() && budgetData) {
                          try {
                            await budgetApi.save(budgetData, currentProjectId, budgetName.trim());
                          } catch (error) {
                            console.error('Error saving budget name:', error);
                          }
                        }
                      }}
                      className="flex-1 text-xl sm:text-2xl font-bold text-zinc-200 font-mono bg-transparent border-none outline-none focus:outline-none hover:bg-black/20 px-2 py-1 rounded transition-colors cursor-text"
                      placeholder={t('budget.title') || 'Budget Machine'}
                    />
                  </div>
                  {selectedTemplate && (
                    <p className="text-xs text-zinc-400 font-mono mt-0.5">
                      {getTemplateById(selectedTemplate)?.name || selectedTemplate}
                    </p>
                  )}
                </div>
                {/* Row 2: Icons and Buttons */}
                <div className="flex flex-wrap gap-2 w-full">
                  {budgetData && !isCustom && (
                    <BrandCustomizationPanel
                      data={budgetData}
                      budgetId={currentProjectId || undefined}
                      onDataChange={handleBrandDataChange}
                      renderButton={true}
                    />
                  )}
                  {currentProjectId && (
                    <Tooltip content={t('budget.duplicate') || 'Duplicar'} position="top">
                      <button
                        onClick={handleDuplicate}
                        className="flex items-center justify-center p-2 bg-card border border-zinc-800 rounded-md text-zinc-200 hover:text-brand-cyan hover:bg-card/90 hover:border-brand-cyan/50 transition-all duration-300 shadow-lg"
                        aria-label="Duplicate budget"
                      >
                        <Copy size={18} />
                      </button>
                    </Tooltip>
                  )}
                  <FormButton
                    onClick={handleSave}
                    disabled={isSaving}
                    className="flex items-center gap-2"
                  >
                    <Save size={16} />
                    {isSaving ? t('budget.saving') : t('budget.save')}
                  </FormButton>
                  {currentProjectId && (
                    <>
                      <FormButton
                        onClick={handleGeneratePDF}
                        className="flex items-center gap-2"
                      >
                        <Download size={16} />
                        {t('budget.generatePDF')}
                      </FormButton>
                      <FormButton
                        onClick={handleShare}
                        className="flex items-center gap-2"
                      >
                        {linkCopied ? <Check size={16} /> : <Share2 size={16} />}
                        {linkCopied ? 'Copied!' : t('budget.share')}
                      </FormButton>
                    </>
                  )}
                </div>
              </div>

              {/* Form Content */}
              <div className="flex-1 overflow-y-auto min-h-0">
                {/* Field Properties Panel is now rendered inside PdfPreviewWithFields */}
                <div className="h-full overflow-visible px-4 pt-4 pb-5 sm:px-6 sm:pt-6 sm:pb-7">
                  <div className="max-w-2xl mx-auto space-y-6 w-full">
                    <BudgetForm
                      data={budgetData}
                      onChange={setBudgetData}
                      budgetId={currentProjectId || undefined}
                      positioningFieldId={positioningFieldId}
                      onPositioningModeChange={setPositioningFieldId}
                      pendingFieldPosition={pendingFieldPosition}
                      focusedFieldId={focusedFieldId}
                      onFocusedFieldChange={setFocusedFieldId}
                      onFieldFilled={((fieldId) => {
                        // When field is filled, add it to PDF if there's a pending position
                        if (pendingFieldPosition && budgetData) {
                          const field = [
                            { id: 'clientName', label: 'Nome do Cliente' },
                            { id: 'projectName', label: 'Nome do Projeto' },
                            { id: 'projectDescription', label: 'Descrição do Projeto' },
                            { id: 'brandName', label: 'Nome da Marca' },
                            { id: 'year', label: 'Ano' },
                            { id: 'observations', label: 'Observações' },
                            { id: 'finalCTAText', label: 'Texto CTA Final' },
                          ].find(f => f.id === fieldId);

                          if (field) {
                            const newMapping: PdfFieldMapping = {
                              id: `${fieldId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                              fieldId,
                              label: field.label,
                              x: pendingFieldPosition.x,
                              y: pendingFieldPosition.y,
                              fontSize: 12,
                              color: '#000000',
                              align: 'left',
                              page: pendingFieldPosition.pageNum,
                              fontFamily: 'geist',
                              bold: false,
                            };

                            const currentMappings = budgetData.pdfFieldMappings || [];
                            setBudgetData({ ...budgetData, pdfFieldMappings: [...currentMappings, newMapping] });
                            setPendingFieldPosition(null);
                            setSelectedFieldId(newMapping.id);
                            setPositioningFieldId(fieldId);
                          }
                        }
                      })}
                      onFieldFromFormClick={((fieldId) => {
                        if (!pendingFieldPosition || !budgetData) return;

                        const field = [
                          { id: 'clientName', label: 'Nome do Cliente' },
                          { id: 'projectName', label: 'Nome do Projeto' },
                          { id: 'projectDescription', label: 'Descrição do Projeto' },
                          { id: 'brandName', label: 'Nome da Marca' },
                          { id: 'startDate', label: 'Data de Início' },
                          { id: 'endDate', label: 'Data de Término' },
                          { id: 'year', label: 'Ano' },
                          { id: 'observations', label: 'Observações' },
                          { id: 'finalCTAText', label: 'Texto CTA Final' },
                          { id: 'custom_text', label: 'Campo de Texto' },
                          { id: 'custom_currency', label: 'Campo de Valor (Moeda)' },
                        ].find(f => f.id === fieldId);

                        if (!field) return;

                        const newMapping: PdfFieldMapping = {
                          id: `${fieldId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                          fieldId,
                          label: field.label,
                          x: pendingFieldPosition.x,
                          y: pendingFieldPosition.y,
                          fontSize: 12,
                          color: '#000000',
                          align: 'left',
                          page: pendingFieldPosition.pageNum,
                          fontFamily: 'geist',
                          bold: false,
                        };

                        const currentMappings = budgetData.pdfFieldMappings || [];
                        setBudgetData({ ...budgetData, pdfFieldMappings: [...currentMappings, newMapping] });
                        setPendingFieldPosition(null);
                        setSelectedFieldId(newMapping.id);
                      })}
                    />
                  </div>
                </div>
              </div>

              {/* Share Link Section */}
              {shareLink && (
                <div className="flex-shrink-0 border-t border-zinc-800 p-4 sm:p-6 bg-zinc-900">
                  <div className="max-w-2xl mx-auto">
                    <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-xl">
                      <p className="text-sm text-zinc-400 mb-2 font-mono">Share Link:</p>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <input
                          type="text"
                          value={shareLink}
                          readOnly
                          className="flex-1 px-3 py-2 bg-black/40 border border-zinc-800 rounded-md text-zinc-200 text-sm font-mono"
                        />
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(shareLink);
                            setLinkCopied(true);
                            setTimeout(() => setLinkCopied(false), 2000);
                          }}
                          className="px-4 py-2 bg-brand-cyan/20 hover:bg-brand-cyan/30 border border-brand-cyan/50 rounded-md text-brand-cyan font-mono text-sm transition-colors flex items-center justify-center gap-2"
                        >
                          <Copy size={16} />
                          <span className="sm:hidden">Copiar</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Resizer - Only show when sidebar is open */}
            {budgetData && isSidebarOpen && (
              <div
                id="form-resizer"
                className="fixed top-10 md:top-14 h-[calc(100vh-2.5rem)] md:h-[calc(100vh-3.5rem)] z-50 w-2 cursor-col-resize group"
                style={formWidth ? { left: `${formWidth}px` } : { left: '400px' }}
              >
                <div className="w-px h-full mx-auto bg-zinc-800 group-hover:bg-brand-cyan/50 transition-colors duration-200"></div>
              </div>
            )}
          </div>
        </div>
      </DndContext>
    </>
  );
};

