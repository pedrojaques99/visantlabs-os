import React, { useState, memo, useCallback, useRef, useEffect, useMemo } from 'react';
import { Handle, Position, type NodeProps, NodeResizer, useReactFlow } from '@xyflow/react';
import { Loader2, Target, ChevronDown, ChevronUp, Zap, Download, Save, X, ExternalLink, XCircle, FolderOpen, Plus } from 'lucide-react';
import type { StrategyNodeData } from '../../types/reactFlow';
import { cn } from '../../lib/utils';
import { toast } from 'sonner';
import { NodeContainer } from './shared/NodeContainer';
import { Select } from '../ui/select';
import { Textarea } from '../ui/textarea';
import { NodeLabel } from './shared/node-label';
import { NodeHeader } from './shared/node-header';
import { NodeButton } from './shared/node-button';
import { getSectionEmoji, cleanMarketResearchText } from '../../utils/brandingHelpers';
import type { BrandingData } from '../../types';
import { useTranslation } from '../../hooks/useTranslation';
import { useNodeResize } from '../../hooks/canvas/useNodeResize';

// Auto-resize textarea component
const AutoResizeTextarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  minHeight?: number;
  maxHeight?: number;
  onWheel?: (e: React.WheelEvent<HTMLTextAreaElement>) => void;
}>(({ onChange, minHeight = 40, maxHeight = 400, onWheel, ...props }, ref) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const combinedRef = (node: HTMLTextAreaElement | null) => {
    textareaRef.current = node;
    if (typeof ref === 'function') {
      ref(node);
    } else if (ref) {
      ref.current = node;
    }
  };

  const adjustHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      const newHeight = Math.max(textarea.scrollHeight, minHeight);
      textarea.style.height = `${Math.min(newHeight, maxHeight)}px`;
    }
  }, [minHeight, maxHeight]);

  useEffect(() => {
    adjustHeight();
  }, [props.value, adjustHeight]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    adjustHeight();
    onChange?.(e);
  };

  return (
    <Textarea
      {...props}
      ref={combinedRef}
      onChange={handleChange}
      onWheel={onWheel}
      style={{
        ...props.style,
        minHeight: `${minHeight}px`,
        maxHeight: `${maxHeight}px`,
        overflowY: 'auto',
      }}
    />
  );
});

AutoResizeTextarea.displayName = 'AutoResizeTextarea';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const StrategyNode = memo(({ data, selected, id, dragging }: NodeProps<any>) => {
  const { t } = useTranslation();
  const { setNodes } = useReactFlow();
  const nodeData = data as StrategyNodeData;
  const { handleResize: handleResizeWithDebounce } = useNodeResize();
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>(
    nodeData.expandedSections || {}
  );
  const [prompt, setPrompt] = useState(nodeData.prompt || '');
  const [editedSections, setEditedSections] = useState<Record<string, string>>({});
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [showProjectSelector, setShowProjectSelector] = useState(!nodeData.prompt && !nodeData.strategyData);
  
  const strategyType = nodeData.strategyType || 'all';
  const strategyData = nodeData.strategyData;
  const isGenerating = nodeData.isGenerating || false;
  const generatingStep = nodeData.generatingStep; // Legacy support
  const generatingSteps = nodeData.generatingSteps || []; // Array of sections being generated

  // Section definitions with their step numbers and labels - memoized to prevent recreation
  const sections = useMemo(() => [
    { type: 'marketResearch', step: 1, label: t('canvasNodes.strategyNode.sections.marketResearch'), emoji: '📊' },
    { type: 'persona', step: 10, label: t('canvasNodes.strategyNode.sections.persona'), emoji: '👤' },
    { type: 'archetypes', step: 13, label: t('canvasNodes.strategyNode.sections.archetypes'), emoji: '🎭' },
    { type: 'competitors', step: 5, label: t('canvasNodes.strategyNode.sections.competitors'), emoji: '🏢' },
    { type: 'references', step: 6, label: t('canvasNodes.strategyNode.sections.references'), emoji: '🎨' },
    { type: 'swot', step: 7, label: t('canvasNodes.strategyNode.sections.swot'), emoji: '⚖️' },
    { type: 'colorPalettes', step: 8, label: t('canvasNodes.strategyNode.sections.colorPalettes'), emoji: '🎨' },
    { type: 'visualElements', step: 9, label: t('canvasNodes.strategyNode.sections.visualElements'), emoji: '🎨' },
    { type: 'mockupIdeas', step: 11, label: t('canvasNodes.strategyNode.sections.mockupIdeas'), emoji: '💡' },
  ], [t]);

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) {
      toast.error(t('canvasNodes.strategyNode.pleaseEnterBrandDescription'), { duration: 3000 });
      return;
    }

    if (!nodeData.onGenerate) return;

    try {
      await nodeData.onGenerate(id, strategyType, prompt);
    } catch (error: any) {
      toast.error(error?.message || 'Failed to generate strategy', { duration: 5000 });
    }
  }, [id, strategyType, prompt, nodeData, t]);

  const handleGenerateSection = useCallback(async (sectionType: string) => {
    if (!prompt.trim()) {
      toast.error(t('canvasNodes.strategyNode.pleaseEnterBrandDescription'), { duration: 3000 });
      return;
    }

    // Prevent generating multiple sections at once
    if (generatingSteps.length > 0) {
      toast.error(t('canvasNodes.strategyNode.pleaseWaitForSection'), { duration: 3000 });
      return;
    }

    if (!nodeData.onGenerateSection) return;

    try {
      await nodeData.onGenerateSection(id, sectionType);
    } catch (error: any) {
      const sectionLabel = sections.find(s => s.type === sectionType)?.label || sectionType;
      toast.error(error?.message || t('canvasNodes.strategyNode.failedToGenerateSection', { section: sectionLabel }), { duration: 5000 });
    }
  }, [id, prompt, nodeData, generatingSteps]);

  const handleGenerateAll = useCallback(async () => {
    if (!prompt.trim()) {
      toast.error(t('canvasNodes.strategyNode.pleaseEnterBrandDescription'), { duration: 3000 });
      return;
    }

    if (!nodeData.onGenerateAll) return;

    try {
      await nodeData.onGenerateAll(id);
    } catch (error: any) {
      toast.error(error?.message || t('canvasNodes.strategyNode.failedToGenerateAllSections'), { duration: 5000 });
    }
  }, [id, prompt, nodeData]);

  const handleGeneratePDF = useCallback(() => {
    if (!nodeData.onGeneratePDF) return;
    try {
      nodeData.onGeneratePDF(id);
    } catch (error: any) {
      toast.error(error?.message || 'Failed to generate PDF', { duration: 5000 });
    }
  }, [id, nodeData]);

  const handleSave = useCallback(async (): Promise<string | undefined> => {
    if (!nodeData.onSave) return undefined;
    try {
      const projectId = await nodeData.onSave(id);
      toast.success(t('canvasNodes.strategyNode.strategySavedSuccessfully'));
      return projectId;
    } catch (error: any) {
      toast.error(error?.message || 'Failed to save strategy', { duration: 5000 });
      return undefined;
    }
  }, [id, nodeData]);

  const handleOpenInNewTab = useCallback(async () => {
    try {
      let projectId = nodeData.projectId;
      
      // If no projectId, save first to get one
      if (!projectId && nodeData.onSave) {
        projectId = await handleSave();
      }
      
      if (projectId) {
        const url = `/branding-machine?projectId=${projectId}`;
        window.open(url, '_blank');
      } else {
        toast.error(t('canvasNodes.strategyNode.pleaseSaveProjectFirst'), { duration: 3000 });
      }
    } catch (error: any) {
      toast.error(error?.message || 'Failed to open project', { duration: 3000 });
    }
  }, [id, nodeData, handleSave, t]);

  const handleDeleteSection = useCallback((sectionType: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent toggling the section when clicking delete
    
    if (!nodeData.onUpdateData || !strategyData) return;

    const currentData = { ...strategyData };
    
    // Clear the specific section data
    switch (sectionType) {
      case 'marketResearch':
        delete currentData.marketResearch;
        break;
      case 'persona':
        delete currentData.persona;
        break;
      case 'archetypes':
        delete currentData.archetypes;
        break;
      case 'competitors':
        delete currentData.competitors;
        break;
      case 'references':
        delete currentData.references;
        break;
      case 'swot':
        delete currentData.swot;
        break;
      case 'colorPalettes':
        delete currentData.colorPalettes;
        break;
      case 'visualElements':
        delete currentData.visualElements;
        break;
      case 'mockupIdeas':
        delete currentData.mockupIdeas;
        break;
    }

    // Also clear any edited content for this section
    setEditedSections(prev => {
      const next = { ...prev };
      delete next[sectionType];
      return next;
    });

    // Collapse the section
    setExpandedSections(prev => {
      const next = { ...prev };
      delete next[sectionType];
      return next;
    });

    nodeData.onUpdateData(id, { strategyData: currentData });
    toast.success(t('canvasNodes.strategyNode.sectionDeleted', { 
      section: sections.find(s => s.type === sectionType)?.label || t('canvasNodes.strategyNode.section')
    }));
  }, [id, nodeData, strategyData, sections, t]);

  const hasSectionData = (sectionType: string): boolean => {
    if (!strategyData) return false;
    switch (sectionType) {
      case 'marketResearch': {
        const mr = strategyData.marketResearch;
        if (!mr || typeof mr !== 'object') return false;
        // Check if at least one field has meaningful content
        return !!(mr.mercadoNicho?.trim() || mr.publicoAlvo?.trim() || mr.posicionamento?.trim() || mr.insights?.trim());
      }
      case 'persona': {
        const persona = strategyData.persona;
        if (!persona || typeof persona !== 'object') return false;
        // Check if at least one field has meaningful content
        return !!(persona.demographics?.trim() || (persona.desires && persona.desires.length > 0) || (persona.pains && persona.pains.length > 0));
      }
      case 'archetypes': {
        const arch = strategyData.archetypes;
        if (!arch || typeof arch !== 'object') return false;
        // Check if at least primary archetype or reasoning exists
        return !!((arch.primary && arch.primary.title && arch.primary.description) || 
                  (arch.secondary && arch.secondary.title && arch.secondary.description) || 
                  arch.reasoning?.trim());
      }
      case 'competitors':
        return !!(strategyData.competitors && Array.isArray(strategyData.competitors) && strategyData.competitors.length > 0);
      case 'references':
        return !!(strategyData.references && Array.isArray(strategyData.references) && strategyData.references.length > 0);
      case 'swot': {
        const swot = strategyData.swot;
        if (!swot || typeof swot !== 'object') return false;
        // Check if at least one SWOT category has content
        return !!((swot.strengths && swot.strengths.length > 0) ||
                  (swot.weaknesses && swot.weaknesses.length > 0) ||
                  (swot.opportunities && swot.opportunities.length > 0) ||
                  (swot.threats && swot.threats.length > 0));
      }
      case 'colorPalettes':
        return !!(strategyData.colorPalettes && Array.isArray(strategyData.colorPalettes) && strategyData.colorPalettes.length > 0);
      case 'visualElements':
        return !!(strategyData.visualElements && Array.isArray(strategyData.visualElements) && strategyData.visualElements.length > 0);
      case 'mockupIdeas':
        return !!(strategyData.mockupIdeas && Array.isArray(strategyData.mockupIdeas) && strategyData.mockupIdeas.length > 0);
      default:
        return false;
    }
  };

  const saveTimeoutRef = useRef<Record<string, NodeJS.Timeout>>({});
  // Refs to store latest values to avoid stale closures in debounced save
  const strategyDataRef = useRef(strategyData);
  const nodeDataRef = useRef(nodeData);
  const idRef = useRef(id);
  
  // Keep refs in sync with latest values
  useEffect(() => {
    strategyDataRef.current = strategyData;
  }, [strategyData]);
  
  useEffect(() => {
    nodeDataRef.current = nodeData;
  }, [nodeData]);
  
  useEffect(() => {
    idRef.current = id;
  }, [id]);

  const handleSectionContentChange = useCallback((sectionType: string, newContent: string) => {
    // Only update local state - don't trigger external updates that could cause loops
    setEditedSections(prev => ({
      ...prev,
      [sectionType]: newContent
    }));

    // Debounce save - save after 2 seconds of no typing
    if (saveTimeoutRef.current[sectionType]) {
      clearTimeout(saveTimeoutRef.current[sectionType]);
    }

    // Capture newContent at the time the timeout is set
    const contentToSave = newContent;
    
    saveTimeoutRef.current[sectionType] = setTimeout(() => {
      // Read latest values from refs instead of closure to avoid stale data
      const latestStrategyData = strategyDataRef.current;
      const latestNodeData = nodeDataRef.current;
      const latestId = idRef.current;
      
      // Only save if onUpdateData exists and we have valid data
      if (latestNodeData.onUpdateData && latestStrategyData) {
        const currentData = { ...latestStrategyData };
        // Store edited content as a separate field to avoid conflicts
        latestNodeData.onUpdateData(latestId, {
          strategyData: {
            ...currentData,
            [`${sectionType}Edited`]: contentToSave
          }
        });
      }
    }, 2000);
  }, []);

  // Memoized function to format section content - prevents unnecessary recalculations
  const formatSectionContent = useCallback((sectionType: string): string => {
    // Return edited content if exists, otherwise format from strategyData
    if (editedSections[sectionType] !== undefined) {
      return editedSections[sectionType];
    }
    
    if (!strategyData) return '';
    
    switch (sectionType) {
      case 'marketResearch': {
        const mr = strategyData.marketResearch;
        if (!mr) return '';
        // Support both new (string) and old (object) formats
        if (typeof mr === 'string') {
          return cleanMarketResearchText(mr);
        }
        if (typeof mr === 'object' && mr !== null) {
          const parts: string[] = [];
          if (mr.mercadoNicho) parts.push(cleanMarketResearchText(mr.mercadoNicho));
          if (mr.publicoAlvo) parts.push(cleanMarketResearchText(mr.publicoAlvo));
          if (mr.posicionamento) parts.push(cleanMarketResearchText(mr.posicionamento));
          if (mr.insights) parts.push(cleanMarketResearchText(mr.insights));
          return parts.join('\n\n');
        }
        return '';
      }
      case 'persona': {
        const persona = strategyData.persona;
        if (!persona) return '';
        const parts: string[] = [];
        if (persona.demographics) parts.push(cleanMarketResearchText(persona.demographics));
        if (persona.desires && persona.desires.length > 0) parts.push(persona.desires.join('\n'));
        if (persona.pains && persona.pains.length > 0) parts.push(persona.pains.join('\n'));
        return parts.join('\n\n');
      }
      case 'archetypes': {
        const arch = strategyData.archetypes;
        if (!arch) return '';
        const parts: string[] = [];
        if (arch.primary?.title && arch.primary?.description) {
          parts.push(`${arch.primary.title}\n${cleanMarketResearchText(arch.primary.description)}`);
        }
        if (arch.secondary?.title && arch.secondary?.description) {
          parts.push(`${arch.secondary.title}\n${cleanMarketResearchText(arch.secondary.description)}`);
        }
        if (arch.reasoning) parts.push(cleanMarketResearchText(arch.reasoning));
        return parts.join('\n\n');
      }
      case 'competitors': {
        const competitors = strategyData.competitors;
        if (!competitors || competitors.length === 0) return '';
        return competitors.map((c, idx) => {
          const name = typeof c === 'string' ? c : c.name;
          const url = typeof c === 'object' && c.url ? ` (${c.url})` : '';
          return `${idx + 1}. ${name}${url}`;
        }).join('\n');
      }
      case 'references': {
        const references = strategyData.references;
        if (!references || references.length === 0) return '';
        return references.map((ref, idx) => `${idx + 1}. ${ref}`).join('\n');
      }
      case 'swot': {
        const swot = strategyData.swot;
        if (!swot) return '';
        return `Strengths:\n${swot.strengths?.join('\n') || 'N/A'}\n\nWeaknesses:\n${swot.weaknesses?.join('\n') || 'N/A'}\n\nOpportunities:\n${swot.opportunities?.join('\n') || 'N/A'}\n\nThreats:\n${swot.threats?.join('\n') || 'N/A'}`;
      }
      case 'colorPalettes': {
        const palettes = strategyData.colorPalettes;
        if (!palettes || palettes.length === 0) return '';
        return palettes.map((p, idx) => {
          return `${idx + 1}. ${p.name}\nColors: ${p.colors.join(', ')}\nPsychology: ${p.psychology || 'N/A'}`;
        }).join('\n\n');
      }
      case 'visualElements': {
        const elements = strategyData.visualElements;
        if (!elements || elements.length === 0) return '';
        return elements.map((el, idx) => `${idx + 1}. ${el}`).join('\n');
      }
      case 'mockupIdeas': {
        const ideas = strategyData.mockupIdeas;
        if (!ideas || ideas.length === 0) return '';
        return ideas.map((idea, idx) => `${idx + 1}. ${idea}`).join('\n\n');
      }
      default:
        return '';
    }
  }, [editedSections, strategyData]);

  const hasData = strategyData && (
    strategyData.persona ||
    strategyData.archetypes ||
    strategyData.marketResearch ||
    strategyData.competitors ||
    strategyData.references ||
    strategyData.swot ||
    strategyData.colorPalettes ||
    strategyData.visualElements ||
    strategyData.mockupIdeas
  );

  const [originalPrompt, setOriginalPrompt] = useState(nodeData.prompt || '');
  const promptRef = useRef(nodeData.prompt || '');
  
  // Track if prompt has changed from when data was generated
  const promptHasChanged = prompt !== originalPrompt;

  // Update original prompt only when new data is generated (not on every prompt change)
  useEffect(() => {
    if (hasData && !isGenerating && nodeData.prompt) {
      const newOriginal = nodeData.prompt;
      if (newOriginal !== originalPrompt) {
        setOriginalPrompt(newOriginal);
        promptRef.current = newOriginal;
      }
    }
  }, [hasData, isGenerating, nodeData.prompt]); // Removed 'prompt' and 'originalPrompt' from deps to prevent loops

  // Sync prompt state with nodeData.prompt when it changes externally (only if different)
  useEffect(() => {
    if (nodeData.prompt !== undefined && nodeData.prompt !== promptRef.current) {
      promptRef.current = nodeData.prompt;
      setPrompt(nodeData.prompt);
    }
  }, [nodeData.prompt]);

  // Sync showProjectSelector state with nodeData changes
  useEffect(() => {
    const shouldShowSelector = !nodeData.prompt && !nodeData.strategyData;
    if (shouldShowSelector !== showProjectSelector) {
      setShowProjectSelector(shouldShowSelector);
    }
  }, [nodeData.prompt, nodeData.strategyData, showProjectSelector]);

  // Debounced prompt update to prevent loops
  const promptUpdateTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const handlePromptChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newPrompt = e.target.value;
    setPrompt(newPrompt);
    
    // Debounce external updates to prevent loops
    if (promptUpdateTimeoutRef.current) {
      clearTimeout(promptUpdateTimeoutRef.current);
    }
    
    promptUpdateTimeoutRef.current = setTimeout(() => {
      if (nodeData.onUpdateData && newPrompt !== promptRef.current) {
        promptRef.current = newPrompt;
        nodeData.onUpdateData(id, { prompt: newPrompt });
      }
    }, 500);
  }, [id, nodeData]);

  const handleLoadProject = useCallback(async (projectId: string) => {
    try {
      const { brandingApi } = await import('../../services/brandingApi');
      const project = await brandingApi.getById(projectId);
      
      // Convert BrandingData to StrategyNodeData format
      const convertedStrategyData: any = {};
      
      // Handle marketResearch - support both old format (string) and new format (object with individual fields)
      if (typeof project.data.marketResearch === 'string') {
        // Old format: marketResearch is a string, try to extract from individual fields
        convertedStrategyData.marketResearch = {
          mercadoNicho: project.data.mercadoNicho || '',
          publicoAlvo: project.data.publicoAlvo || '',
          posicionamento: project.data.posicionamento || '',
          insights: project.data.insights || '',
        };
      } else if (project.data.marketResearch && typeof project.data.marketResearch === 'object') {
        // New format: marketResearch is already an object
        convertedStrategyData.marketResearch = project.data.marketResearch;
      } else if (project.data.mercadoNicho || project.data.publicoAlvo || project.data.posicionamento || project.data.insights) {
        // Individual fields exist, construct marketResearch object
        convertedStrategyData.marketResearch = {
          mercadoNicho: project.data.mercadoNicho || '',
          publicoAlvo: project.data.publicoAlvo || '',
          posicionamento: project.data.posicionamento || '',
          insights: project.data.insights || '',
        };
      }
      
      // Convert all other sections - ensure we capture all sections even if some fields are empty
      if (project.data.persona) convertedStrategyData.persona = project.data.persona;
      if (project.data.archetypes) convertedStrategyData.archetypes = project.data.archetypes;
      if (project.data.competitors && Array.isArray(project.data.competitors) && project.data.competitors.length > 0) {
        convertedStrategyData.competitors = project.data.competitors;
      }
      if (project.data.references && Array.isArray(project.data.references) && project.data.references.length > 0) {
        convertedStrategyData.references = project.data.references;
      }
      if (project.data.swot) convertedStrategyData.swot = project.data.swot;
      if (project.data.colorPalettes && Array.isArray(project.data.colorPalettes) && project.data.colorPalettes.length > 0) {
        convertedStrategyData.colorPalettes = project.data.colorPalettes;
      }
      if (project.data.visualElements && Array.isArray(project.data.visualElements) && project.data.visualElements.length > 0) {
        convertedStrategyData.visualElements = project.data.visualElements;
      }
      if (project.data.mockupIdeas && Array.isArray(project.data.mockupIdeas) && project.data.mockupIdeas.length > 0) {
        convertedStrategyData.mockupIdeas = project.data.mockupIdeas;
      }
      if (project.data.moodboard) convertedStrategyData.moodboard = project.data.moodboard;

      if (nodeData.onUpdateData) {
        nodeData.onUpdateData(id, {
          prompt: project.prompt,
          strategyData: convertedStrategyData,
          projectId: project._id || (project as any).id,
        });
      }
      
      setPrompt(project.prompt);
      setShowProjectSelector(false);
      toast.success(t('canvas.projectLoadedSuccessfully'));
    } catch (error: any) {
      console.error('Failed to load project:', error);
      toast.error(error?.message || t('canvas.failedToLoadProject'), { duration: 3000 });
    }
  }, [id, nodeData]);

  // No longer needed - modal loads projects on demand

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      // Clear all debounce timeouts
      Object.values(saveTimeoutRef.current).forEach(timeout => clearTimeout(timeout));
      if (promptUpdateTimeoutRef.current) {
        clearTimeout(promptUpdateTimeoutRef.current);
      }
    };
  }, []);

  // Auto-load branding project when node has projectId but incomplete data
  const hasLoadedProjectRef = useRef<string | null>(null);
  useEffect(() => {
    const projectId = nodeData.projectId;
    
    // Only auto-load if:
    // 1. We have a projectId
    // 2. We haven't loaded this projectId yet
    // 3. We don't have complete data (no strategyData or no hasData)
    if (projectId && projectId !== hasLoadedProjectRef.current) {
      const needsLoad = !strategyData || !hasData;
      
      if (needsLoad) {
        hasLoadedProjectRef.current = projectId;
        handleLoadProject(projectId).catch((error) => {
          // Reset ref on error so it can retry if needed
          if (hasLoadedProjectRef.current === projectId) {
            hasLoadedProjectRef.current = null;
          }
          console.error('Auto-load failed:', error);
        });
      } else {
        // Mark as loaded even if we don't need to load (data already exists)
        hasLoadedProjectRef.current = projectId;
      }
    } else if (!projectId) {
      // Reset ref when projectId is cleared
      hasLoadedProjectRef.current = null;
    }
  }, [nodeData.projectId, strategyData, hasData, handleLoadProject]);

  // Auto-expand sections when they are generated or loaded - but respect persisted state
  useEffect(() => {
    if (hasData && strategyData) {
      setExpandedSections(prev => {
        const newExpanded: Record<string, boolean> = { ...prev };
        let hasChanges = false;
        
        sections.forEach(section => {
          // Only auto-expand if:
          // 1. Section has data
          // 2. Section state is not already set (undefined means not persisted yet)
          // 3. Don't override if user has explicitly collapsed it (false)
          if (hasSectionData(section.type) && prev[section.type] === undefined) {
            newExpanded[section.type] = true; // Default to expanded for new sections
            hasChanges = true;
          }
        });
        
        if (hasChanges && nodeData.onUpdateData) {
          // Persist the auto-expanded state
          nodeData.onUpdateData(id, { expandedSections: newExpanded });
        }
        
        return hasChanges ? newExpanded : prev;
      });
      
      // Hide project selector when data is loaded (only update if needed)
      setShowProjectSelector(prev => prev ? false : prev);
      setIsCreatingNew(prev => prev ? false : prev);
    }
  }, [hasData, strategyData, sections, id, nodeData]);

  // Sync expandedSections from nodeData (only on mount or when nodeData changes externally)
  const expandedSectionsRef = useRef(expandedSections);
  useEffect(() => {
    expandedSectionsRef.current = expandedSections;
  }, [expandedSections]);

  useEffect(() => {
    if (nodeData.expandedSections && 
        JSON.stringify(nodeData.expandedSections) !== JSON.stringify(expandedSectionsRef.current)) {
      setExpandedSections(nodeData.expandedSections);
    }
  }, [nodeData.expandedSections]);

  // Toggle individual section
  const toggleSection = useCallback((sectionType: string) => {
    setExpandedSections(prev => {
      const newState = {
        ...prev,
        [sectionType]: !prev[sectionType]
      };
      // Persist immediately
      if (nodeData.onUpdateData) {
        nodeData.onUpdateData(id, { expandedSections: newState });
      }
      return newState;
    });
  }, [id, nodeData]);

  // Toggle all sections
  const toggleAllSections = useCallback(() => {
    const sectionsWithData = sections.filter(section => hasSectionData(section.type));
    if (sectionsWithData.length === 0) return;
    
    const allExpanded = sectionsWithData.every(section => expandedSections[section.type] !== false);
    
    const newState: Record<string, boolean> = {};
    sectionsWithData.forEach(section => {
      newState[section.type] = !allExpanded;
    });
    
    const finalState = { ...expandedSections, ...newState };
    setExpandedSections(finalState);
    // Persist immediately
    if (nodeData.onUpdateData) {
      nodeData.onUpdateData(id, { expandedSections: finalState });
    }
  }, [sections, expandedSections, strategyData, id, nodeData]);

  // Handle resize from NodeResizer (com debounce - aplica apenas quando soltar o mouse)
  const handleResize = useCallback((width: number, height: number) => {
    handleResizeWithDebounce(id, width, height, nodeData.onResize);
  }, [id, nodeData.onResize, handleResizeWithDebounce]);

  return (
    <NodeContainer
      selected={selected}
      dragging={dragging}
      className="p-5 min-w-[500px] flex flex-col"
      onContextMenu={(e) => {
        // Allow ReactFlow to handle the context menu event
      }}
    >
      {selected && !dragging && (
        <NodeResizer
          color="#52ddeb"
          isVisible={selected}
          minWidth={400}
          minHeight={800}
          maxWidth={2000}
          maxHeight={2000}
          onResize={(_, { width, height }) => {
            handleResize(width, height);
          }}
        />
      )}

      {/* Output Handle */}
      <Handle
        type="source"
        position={Position.Right}
        id="strategy-output"
        className="node-handle handle-strategy"
        data-handle-type="strategy"
        style={{ top: '50%' }}
      />

      <div className="flex flex-col h-full min-h-0">
      {/* Header with action buttons */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Target size={18} className="text-[#52ddeb]" />
          <h3 className="text-sm font-semibold text-zinc-300 font-mono">{t('canvasNodes.strategyNode.title') || 'Strategy Node'}</h3>
        </div>
        <div className="flex items-center gap-1">
          {hasData && (
            <button
              onClick={handleOpenInNewTab}
              disabled={!hasData || isGenerating}
              className={cn(
                "p-1.5 rounded border transition-all",
                "bg-zinc-900/50 border-zinc-700/30 text-zinc-300 hover:border-zinc-600/50",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                "hover:bg-zinc-800/50"
              )}
              title={t('canvasNodes.strategyNode.openInNewTab')}
            >
              <ExternalLink size={14} />
            </button>
          )}
          {nodeData.onGeneratePDF && (
            <button
              onClick={handleGeneratePDF}
              disabled={!hasData}
              className={cn(
                "p-1.5 rounded border transition-all",
                "bg-zinc-900/50 border-zinc-700/30 text-zinc-300 hover:border-zinc-600/50",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                "hover:bg-zinc-800/50"
              )}
              title={t('canvasNodes.strategyNode.downloadPDF')}
            >
              <Download size={14} />
            </button>
          )}
          {nodeData.onSave && (
            <button
              onClick={handleSave}
              disabled={!hasData || isGenerating}
              className={cn(
                "p-1.5 rounded border transition-all",
                "bg-[#52ddeb]/90 hover:bg-[#52ddeb] text-black font-semibold",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
              title={t('canvasNodes.strategyNode.save')}
            >
              <Save size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Initial State - Project Selector or Create New */}
      {showProjectSelector && !isCreatingNew && (
        <div className="mb-4 space-y-4">
          <NodeLabel>{t('canvasNodes.strategyNode.chooseOption')}</NodeLabel>
          
          {/* Load Existing Projects */}
          <div className="space-y-2">
            <NodeButton
              onClick={() => {
                if (nodeData.onOpenProjectModal) {
                  nodeData.onOpenProjectModal(id);
                }
              }}
              variant="default"
              className="w-full px-3 py-2 gap-3"
            >
              <FolderOpen size={14} />
              <span>{t('canvasNodes.strategyNode.selectExistingProject')}</span>
            </NodeButton>
          </div>

          {/* Create New Project */}
          <div className="pt-2 border-t border-zinc-700/30">
            <NodeButton
              onClick={() => setIsCreatingNew(true)}
              variant="primary"
              className="w-full px-3 py-2 gap-3"
            >
              <Plus size={14} />
              <span>{t('canvasNodes.strategyNode.createNewProject')}</span>
            </NodeButton>
          </div>
        </div>
      )}

      {/* Prompt Input - Show when creating new or when has data */}
      {(!showProjectSelector || isCreatingNew || hasData) && (
        <div className="mb-4">
          <NodeLabel>{t('canvasNodes.strategyNode.brandDescription')}</NodeLabel>
          <Textarea
            value={prompt}
            onChange={handlePromptChange}
            placeholder={t('canvasNodes.strategyNode.brandDescriptionPlaceholder')}
            className="text-xs resize-none nodrag nopan"
            rows={3}
            disabled={isGenerating}
          />
        </div>
      )}

      {/* Analyze Button - Before Generate Sections */}
      {nodeData.onInitialAnalysis && (isCreatingNew || !hasData || promptHasChanged) && (
        <div className="mb-4">
          {isGenerating && generatingStep === 'marketResearch' ? (
            <div className="flex gap-3">
              <NodeButton
                onClick={() => nodeData.onCancelGeneration?.(id)}
                variant="default"
                className="flex-1 px-3 py-2 gap-3 border-red-500/50 text-red-400 hover:bg-red-500/20"
              >
                <XCircle size={14} />
                <span>{t('canvasNodes.strategyNode.cancel')}</span>
              </NodeButton>
              <div className="flex-1 px-3 py-2 bg-[#52ddeb]/20 border border-[#52ddeb]/30 rounded flex items-center justify-center gap-3">
                <Loader2 size={14} className="animate-spin text-[#52ddeb]" />
                <span className="text-xs font-mono text-[#52ddeb]">{t('canvasNodes.strategyNode.analyzing')}</span>
              </div>
            </div>
          ) : (
            <NodeButton
              onClick={async () => {
                if (!nodeData.onInitialAnalysis) return;
                try {
                  await nodeData.onInitialAnalysis(id);
                } catch (error: any) {
                  toast.error(error?.message || 'Failed to analyze', { duration: 5000 });
                }
              }}
              disabled={!prompt.trim() || isGenerating}
              variant="primary"
              className="w-full px-3 py-2 gap-3"
            >
              <Target size={14} />
              <span>{promptHasChanged && hasData ? 'Re-analyze' : 'Analyze'}</span>
            </NodeButton>
          )}
        </div>
      )}

      {/* Section Buttons Grid - Only show after initial analysis */}
      {hasData && (
        <div className="mb-4">
        <div className="flex items-center justify-between mb-3">
          <NodeLabel className="mb-0">{t('canvasNodes.strategyNode.generateSections')}</NodeLabel>
          {nodeData.onGenerateAll && (
            <button
              onClick={handleGenerateAll}
              disabled={!prompt.trim() || isGenerating}
              className={cn(
                'px-2 py-1 text-[10px] font-mono border rounded transition-all',
                'bg-zinc-900/30 border-zinc-700/20 text-zinc-400 hover:border-zinc-600/40 hover:text-zinc-300',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
              title={t('canvasNodes.strategyNode.generateAllSections')}
            >
              {isGenerating && generatingStep === 'all' ? (
                <>
                  <Loader2 size={10} className="animate-spin text-[#52ddeb] inline mr-1" />
                  {t('canvasNodes.strategyNode.generating')}
                </>
              ) : (
                t('canvasNodes.strategyNode.generateAll')
              )}
            </button>
          )}
        </div>
        <div 
          className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto"
          onWheel={(e) => e.stopPropagation()}
        >
          {sections
            .filter((section) => !hasSectionData(section.type)) // Hide sections that already have data
            .map((section) => {
              // Check if this section is being generated (support both new array and legacy string)
              const isGeneratingSection = generatingSteps.includes(section.type) || 
                                         generatingStep === section.type || 
                                         (isGenerating && generatingStep === 'all');
              
              return (
                <button
                  key={section.type}
                  onClick={() => handleGenerateSection(section.type)}
                  disabled={!prompt.trim() || isGeneratingSection || (isGenerating && generatingStep === 'all') || generatingSteps.length > 0}
                  className={cn(
                    'px-2 py-2 border rounded text-xs font-mono transition-all flex items-center gap-1.5 justify-center',
                    'bg-zinc-900/50 border-zinc-700/30 text-zinc-300 hover:border-zinc-600/50 cursor-pointer',
                    (!prompt.trim() || isGeneratingSection || (isGenerating && generatingStep === 'all') || generatingSteps.length > 0) && 'opacity-50 cursor-not-allowed'
                  )}
                  title={section.label}
                >
                  {isGeneratingSection ? (
                    <Loader2 size={10} className="animate-spin text-[#52ddeb]" />
                  ) : (
                    <span className="text-xs">{section.emoji}</span>
                  )}
                  <span className="truncate">{section.label}</span>
                </button>
              );
            })}
        </div>
        </div>
      )}

      {/* Generated Sections Display */}
      {hasData && (
        <div className="border-t border-zinc-700/30 pt-3 flex flex-col flex-1 min-h-0">
          <div className="flex items-center justify-between mb-4 shrink-0">
            <span className="text-xs font-mono text-zinc-400">
              {t('canvasNodes.strategyNode.generatedSections')} ({sections.filter(s => hasSectionData(s.type)).length}/{sections.length})
            </span>
            <button
              onClick={toggleAllSections}
              className="text-xs font-mono text-zinc-400 hover:text-zinc-300 flex items-center gap-1"
            >
              {sections.every(s => !hasSectionData(s.type) || expandedSections[s.type]) ? (
                <>
                  <ChevronUp size={12} />
                  <span>{t('canvasNodes.strategyNode.collapseAll')}</span>
                </>
              ) : (
                <>
                  <ChevronDown size={12} />
                  <span>{t('canvasNodes.strategyNode.expandAll')}</span>
                </>
              )}
            </button>
          </div>
          
          <div 
            className="space-y-3 flex-1 overflow-y-auto min-h-0"
            onWheel={(e) => e.stopPropagation()}
          >
            {sections.map((section) => {
              const sectionHasData = hasSectionData(section.type);
              // Check if this section is being generated (support both new array and legacy string)
              const isGeneratingSection = generatingSteps.includes(section.type) || 
                                         generatingStep === section.type;
              const isGeneratingAll = isGenerating && generatingStep === 'all';
              
              // Show section if it has data, is currently generating, or if generating all (to show progress)
              if (!sectionHasData && !isGeneratingSection && !isGeneratingAll) return null;

              const content = formatSectionContent(section.type);
              const isSectionExpanded = expandedSections[section.type] ?? true; // Default to expanded

              return (
                <div
                  key={section.type}
                  className="border border-zinc-700/30 rounded-md overflow-hidden group"
                >
                  <button
                    onClick={() => toggleSection(section.type)}
                    className="w-full flex items-center justify-between px-3 py-2 bg-zinc-900/30 hover:bg-zinc-900/50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      {sectionHasData && !isGeneratingSection && (
                        <div
                          onClick={(e) => handleDeleteSection(section.type, e)}
                          className="p-0.5 hover:bg-red-500/20 rounded opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                          title={t('canvasNodes.strategyNode.deleteSection', { section: section.label })}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              handleDeleteSection(section.type, e as any);
                            }
                          }}
                        >
                          <X size={12} className="text-red-400 hover:text-red-300" />
                        </div>
                      )}
                      {isGeneratingSection ? (
                        <Loader2 size={12} className="animate-spin text-[#52ddeb]" />
                      ) : (
                        <span className="text-sm">{section.emoji}</span>
                      )}
                      <NodeLabel className="mb-0">
                        {section.label}
                        {sectionHasData && !isGeneratingSection && (
                          <span className="ml-2 text-[#52ddeb] text-[10px]">✓</span>
                        )}
                        {isGeneratingAll && !sectionHasData && !isGeneratingSection && (
                          <span className="ml-2 text-zinc-500 text-[10px]">...</span>
                        )}
                      </NodeLabel>
                    </div>
                    {isSectionExpanded ? <ChevronUp size={14} className="text-zinc-400" /> : <ChevronDown size={14} className="text-zinc-400" />}
                  </button>
                  
                  {isSectionExpanded && (
                    <div 
                      className="p-3 bg-zinc-900/20"
                      onWheel={(e) => e.stopPropagation()}
                    >
                      {sectionHasData && content && (
                        <AutoResizeTextarea
                          value={content}
                          onChange={(e) => handleSectionContentChange(section.type, e.target.value)}
                          className="text-xs resize-none nodrag nopan w-full"
                          minHeight={40}
                          maxHeight={400}
                          onWheel={(e) => {
                            const target = e.currentTarget;
                            const isScrollable = target.scrollHeight > target.clientHeight;
                            // Only prevent zoom if textarea is scrollable and we're scrolling within it
                            if (isScrollable) {
                              e.stopPropagation();
                            }
                          }}
                        />
                      )}
                      
                      {isGeneratingSection && (
                        <div className="px-3 py-2 bg-[#52ddeb]/10 border border-[#52ddeb]/30 rounded flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <Loader2 size={12} className="animate-spin text-[#52ddeb]" />
                            <span className="text-xs font-mono text-[#52ddeb]">{t('canvasNodes.strategyNode.generatingSection', { section: section.label })}</span>
                          </div>
                          {nodeData.onCancelGeneration && (
                            <button
                              onClick={() => nodeData.onCancelGeneration?.(id, section.type)}
                              className="p-1 hover:bg-red-500/20 rounded transition-colors"
                              title={t('canvasNodes.strategyNode.cancelGeneration')}
                            >
                              <XCircle size={12} className="text-red-400 hover:text-red-300" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
      </div>
    </NodeContainer>
  );
});

StrategyNode.displayName = 'StrategyNode';
