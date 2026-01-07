import React, { useState, memo, useCallback, useRef, useEffect, useMemo } from 'react';
import { Handle, Position, type NodeProps, NodeResizer } from '@xyflow/react';
import { Target, ChevronDown, ChevronUp, Download, Save, X, ExternalLink, XCircle, FolderOpen, Plus, Lock } from 'lucide-react';
import { GlitchLoader } from '../ui/GlitchLoader';
import type { StrategyNodeData } from '../../types/reactFlow';
import { cn } from '../../lib/utils';
import { toast } from 'sonner';
import { NodeContainer } from './shared/NodeContainer';
import { Textarea } from '../ui/textarea';
import { NodeLabel } from './shared/node-label';
import { NodeButton } from './shared/node-button';
import { NodeInput } from './shared/node-input';
import { cleanMarketResearchText } from '../../utils/brandingHelpers';
import { useTranslation } from '../../hooks/useTranslation';
import { useNodeResize } from '../../hooks/canvas/useNodeResize';

const AutoResizeTextarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  minHeight?: number;
  maxHeight?: number;
  onWheel?: (e: React.WheelEvent<HTMLTextAreaElement>) => void;
}>(({ onChange, minHeight = 40, maxHeight = 400, onWheel, ...props }, ref) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const combinedRef = useCallback((node: HTMLTextAreaElement | null) => {
    textareaRef.current = node;
    if (typeof ref === 'function') {
      ref(node);
    } else if (ref) {
      ref.current = node;
    }
  }, [ref]);

  const adjustHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(Math.max(textarea.scrollHeight, minHeight), maxHeight)}px`;
    }
  }, [minHeight, maxHeight]);

  useEffect(() => {
    adjustHeight();
  }, [props.value, adjustHeight]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    adjustHeight();
    onChange?.(e);
  }, [adjustHeight, onChange]);

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
  const nodeData = data as StrategyNodeData;
  const { handleResize: handleResizeWithDebounce, fitToContent } = useNodeResize();
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>(
    nodeData.expandedSections || {}
  );
  const [prompt, setPrompt] = useState(nodeData.prompt || '');
  const [projectName, setProjectName] = useState(nodeData.name || '');
  const [editedSections, setEditedSections] = useState<Record<string, string>>({});
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [showProjectSelector, setShowProjectSelector] = useState(!nodeData.prompt && !nodeData.strategyData);

  const strategyType = nodeData.strategyType || 'all';
  const strategyData = nodeData.strategyData;
  const isGenerating = nodeData.isGenerating || false;
  const generatingStep = nodeData.generatingStep;
  const generatingSteps = nodeData.generatingSteps || [];

  const devLog = useCallback((message: string, data?: any) => {
    if (import.meta.env.DEV) {
      console.log(`[StrategyNode:${id}] ${message}`, data || '');
    }
  }, [id]);

  // Debounced log for dragging to avoid excessive logging
  const draggingLogTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const lastDraggingLogRef = useRef<string>('');
  const devLogDebounced = useCallback((message: string, data?: any) => {
    if (!import.meta.env.DEV) return;

    // Clear existing timeout
    if (draggingLogTimeoutRef.current) {
      clearTimeout(draggingLogTimeoutRef.current);
    }

    // Store the message and data
    const logKey = `${message}-${JSON.stringify(data || {})}`;
    lastDraggingLogRef.current = logKey;

    // Debounce: only log after 500ms of no new logs
    draggingLogTimeoutRef.current = setTimeout(() => {
      if (lastDraggingLogRef.current === logKey) {
        console.log(`[StrategyNode:${id}] ${message}`, data || '');
      }
    }, 500);
  }, [id]);

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

  const hasSectionData = useCallback((sectionType: string): boolean => {
    if (!strategyData) return false;
    const checks: Record<string, () => boolean> = {
      marketResearch: () => {
        const mr = strategyData.marketResearch;
        if (!mr) return false;
        // Support new format: string
        if (typeof mr === 'string') {
          return mr.trim().length > 0;
        }
        // Support old format: object with fields
        if (typeof mr === 'object' && mr !== null && !Array.isArray(mr)) {
          const mrObj = mr as { mercadoNicho?: string; publicoAlvo?: string; posicionamento?: string; insights?: string };
          return !!(mrObj.mercadoNicho?.trim() || mrObj.publicoAlvo?.trim() || mrObj.posicionamento?.trim() || mrObj.insights?.trim());
        }
        return false;
      },
      persona: () => {
        const persona = strategyData.persona;
        return !!(persona && typeof persona === 'object' && (persona.demographics?.trim() || persona.desires?.length > 0 || persona.pains?.length > 0));
      },
      archetypes: () => {
        const arch = strategyData.archetypes;
        return !!(arch && typeof arch === 'object' && ((arch.primary?.title && arch.primary?.description) || (arch.secondary?.title && arch.secondary?.description) || arch.reasoning?.trim()));
      },
      competitors: () => !!(strategyData.competitors && Array.isArray(strategyData.competitors) && strategyData.competitors.length > 0),
      references: () => !!(strategyData.references && Array.isArray(strategyData.references) && strategyData.references.length > 0),
      swot: () => {
        const swot = strategyData.swot;
        return !!(swot && typeof swot === 'object' && (swot.strengths?.length > 0 || swot.weaknesses?.length > 0 || swot.opportunities?.length > 0 || swot.threats?.length > 0));
      },
      colorPalettes: () => !!(strategyData.colorPalettes && Array.isArray(strategyData.colorPalettes) && strategyData.colorPalettes.length > 0),
      visualElements: () => !!(strategyData.visualElements && Array.isArray(strategyData.visualElements) && strategyData.visualElements.length > 0),
      mockupIdeas: () => !!(strategyData.mockupIdeas && Array.isArray(strategyData.mockupIdeas) && strategyData.mockupIdeas.length > 0),
    };
    return checks[sectionType]?.() || false;
  }, [strategyData]);

  // Check if section has required dependencies (parent sections)
  const checkDependencies = useCallback((sectionType: string): string[] => {
    if (!strategyData) return [];
    const missing: string[] = [];

    switch (sectionType) {
      case 'marketResearch':
        // No dependencies
        break;
      case 'competitors':
        // Needs marketResearch
        if (!hasSectionData('marketResearch')) {
          missing.push('marketResearch');
        }
        break;
      case 'references':
        // Needs marketResearch + competitors
        if (!hasSectionData('marketResearch')) {
          missing.push('marketResearch');
        }
        if (!hasSectionData('competitors')) {
          missing.push('competitors');
        }
        break;
      case 'swot':
        // Needs marketResearch + competitors
        if (!hasSectionData('marketResearch')) {
          missing.push('marketResearch');
        }
        if (!hasSectionData('competitors')) {
          missing.push('competitors');
        }
        break;
      case 'colorPalettes':
        // Needs swot + references
        if (!hasSectionData('swot')) {
          missing.push('swot');
        }
        if (!hasSectionData('references')) {
          missing.push('references');
        }
        break;
      case 'visualElements':
        // Needs colorPalettes
        if (!hasSectionData('colorPalettes')) {
          missing.push('colorPalettes');
        }
        break;
      case 'persona':
        // Needs marketResearch
        if (!hasSectionData('marketResearch')) {
          missing.push('marketResearch');
        }
        break;
      case 'archetypes':
        // Needs marketResearch
        if (!hasSectionData('marketResearch')) {
          missing.push('marketResearch');
        }
        break;
      case 'mockupIdeas':
        // No strict dependencies
        break;
    }

    return missing;
  }, [strategyData, hasSectionData]);

  const hasData = useMemo(() => {
    if (!strategyData) return false;
    // Check if marketResearch has valid content (string or object with fields)
    let hasMarketResearch = false;
    const mr = strategyData.marketResearch;
    if (mr) {
      if (typeof mr === 'string') {
        hasMarketResearch = mr.trim().length > 0;
      } else if (typeof mr === 'object' && mr !== null && !Array.isArray(mr)) {
        const mrObj = mr as { mercadoNicho?: string; publicoAlvo?: string; posicionamento?: string; insights?: string };
        hasMarketResearch = !!(mrObj.mercadoNicho?.trim() || mrObj.publicoAlvo?.trim() || mrObj.posicionamento?.trim() || mrObj.insights?.trim());
      }
    }
    return !!(hasMarketResearch || strategyData.persona || strategyData.archetypes ||
      strategyData.competitors || strategyData.references || strategyData.swot ||
      strategyData.colorPalettes || strategyData.visualElements || strategyData.mockupIdeas);
  }, [strategyData]);

  const prevStrategyDataRef = useRef(strategyData);
  useEffect(() => {
    // Use debounced log when dragging, regular log otherwise
    const logFn = dragging ? devLogDebounced : devLog;

    if (import.meta.env.DEV) {
      const sectionsWithData = sections.filter(s => hasSectionData(s.type)).map(s => s.type);
      logFn('🔄 Generation state', {
        isGenerating,
        generatingStep: generatingStep || 'none',
        generatingSteps: generatingSteps.length > 0 ? generatingSteps : 'none',
        hasData,
        sectionsWithData,
        sectionsCount: `${sectionsWithData.length}/${sections.length}`,
        dragging
      });

      if (strategyData && strategyData !== prevStrategyDataRef.current) {
        const completedSections = sections.filter(s => hasSectionData(s.type)).map(s => ({ type: s.type, label: s.label }));
        if (completedSections.length > 0) {
          logFn('✅ Completed sections', { count: completedSections.length, sections: completedSections });
        }
        prevStrategyDataRef.current = strategyData;
      }
    }
  }, [isGenerating, generatingStep, generatingSteps, hasData, id, sections, strategyData, hasSectionData, dragging, devLog, devLogDebounced]);

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
      devLog('❌ Section generation blocked - already generating', {
        currentSteps: generatingSteps,
        requestedSection: sectionType
      });
      toast.error(t('canvasNodes.strategyNode.pleaseWaitForSection'), { duration: 3000 });
      return;
    }

    if (!nodeData.onGenerateSection) {
      devLog('❌ onGenerateSection callback not available');
      return;
    }

    const sectionLabel = sections.find(s => s.type === sectionType)?.label || sectionType;
    devLog('🚀 Starting section generation', {
      sectionType,
      sectionLabel,
      promptLength: prompt.length
    });

    try {
      await nodeData.onGenerateSection(id, sectionType);
      devLog('✅ Section generation initiated', { sectionType, sectionLabel });
    } catch (error: any) {
      devLog('❌ Section generation failed', {
        sectionType,
        sectionLabel,
        error: error?.message || error
      });
      toast.error(error?.message || t('canvasNodes.strategyNode.failedToGenerateSection', { section: sectionLabel }), { duration: 5000 });
    }
  }, [id, prompt, nodeData, generatingSteps, sections, t, devLog]);

  const handleGenerateAll = useCallback(async () => {
    if (!prompt.trim()) {
      toast.error(t('canvasNodes.strategyNode.pleaseEnterBrandDescription'), { duration: 3000 });
      return;
    }

    if (!nodeData.onGenerateAll) {
      devLog('❌ onGenerateAll callback not available');
      return;
    }

    const sectionsToGenerate = sections.filter(s => !hasSectionData(s.type));
    devLog('🚀 Starting generation of all sections', {
      totalSections: sections.length,
      sectionsToGenerate: sectionsToGenerate.length,
      sectionsList: sectionsToGenerate.map(s => s.type),
      promptLength: prompt.length
    });

    try {
      await nodeData.onGenerateAll(id);
      devLog('✅ All sections generation initiated', {
        sectionsCount: sectionsToGenerate.length
      });
    } catch (error: any) {
      devLog('❌ All sections generation failed', {
        error: error?.message || error
      });
      toast.error(error?.message || t('canvasNodes.strategyNode.failedToGenerateAllSections'), { duration: 5000 });
    }
  }, [id, prompt, nodeData, sections, hasSectionData, devLog, t]);

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
  }, [id, nodeData, t]);

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
  }, [nodeData, handleSave, t]);

  const handleDeleteSection = useCallback((sectionType: string, e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    if (!nodeData.onUpdateData || !strategyData) return;

    const currentData = { ...strategyData };
    delete currentData[sectionType as keyof typeof currentData];

    setEditedSections(prev => {
      const next = { ...prev };
      delete next[sectionType];
      return next;
    });

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

  const saveTimeoutRef = useRef<Record<string, NodeJS.Timeout>>({});
  const latestRefs = useRef({ strategyData, nodeData, id });

  useEffect(() => {
    latestRefs.current = { strategyData, nodeData, id };
  }, [strategyData, nodeData, id]);

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
      const { strategyData: latestStrategyData, nodeData: latestNodeData, id: latestId } = latestRefs.current;
      if (latestNodeData.onUpdateData && latestStrategyData) {
        latestNodeData.onUpdateData(latestId, {
          strategyData: {
            ...latestStrategyData,
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

  const [originalPrompt, setOriginalPrompt] = useState(nodeData.prompt || '');
  const promptRef = useRef(nodeData.prompt || '');
  const promptHasChanged = prompt !== originalPrompt;

  // Sync local state when nodeData changes (e.g., after loading project)
  useEffect(() => {
    // Sync prompt
    if (nodeData.prompt !== undefined && nodeData.prompt !== promptRef.current) {
      promptRef.current = nodeData.prompt;
      setPrompt(nodeData.prompt);
      if (hasData && !isGenerating && nodeData.prompt !== originalPrompt) {
        setOriginalPrompt(nodeData.prompt);
      }
    }

    // Sync project name
    if (nodeData.name !== undefined && nodeData.name !== projectName) {
      setProjectName(nodeData.name);
    }

    // Check if strategyData has changed
    const currentStrategyDataKeys = strategyData ? Object.keys(strategyData).sort().join(',') : '';
    const newStrategyDataKeys = nodeData.strategyData ? Object.keys(nodeData.strategyData).sort().join(',') : '';
    const strategyDataChanged = currentStrategyDataKeys !== newStrategyDataKeys;

    if (strategyDataChanged && nodeData.strategyData) {
      devLog('🔄 Strategy data updated from nodeData', {
        oldKeys: currentStrategyDataKeys,
        newKeys: newStrategyDataKeys,
        newDataKeys: Object.keys(nodeData.strategyData),
        newDataCount: Object.keys(nodeData.strategyData).length
      });
    }

    // Update showProjectSelector based on actual data
    const hasPrompt = !!nodeData.prompt;
    const hasStrategyData = !!nodeData.strategyData && Object.keys(nodeData.strategyData).length > 0;
    const shouldShowSelector = !hasPrompt && !hasStrategyData;

    if (shouldShowSelector !== showProjectSelector) {
      devLog('🔄 Updating showProjectSelector', {
        shouldShowSelector,
        current: showProjectSelector,
        hasPrompt,
        hasStrategyData,
        strategyDataKeys: nodeData.strategyData ? Object.keys(nodeData.strategyData) : [],
        strategyDataCount: nodeData.strategyData ? Object.keys(nodeData.strategyData).length : 0
      });
      setShowProjectSelector(shouldShowSelector);
    }

    // If we have data, hide the selector and create new form
    if (hasStrategyData) {
      if (showProjectSelector) {
        devLog('✅ Hiding project selector - data available', {
          hasStrategyData,
          strategyDataKeys: Object.keys(nodeData.strategyData || {}),
          strategyDataCount: Object.keys(nodeData.strategyData || {}).length
        });
        setShowProjectSelector(false);
      }
      if (isCreatingNew) {
        setIsCreatingNew(false);
      }
    }
  }, [hasData, isGenerating, nodeData.prompt, nodeData.name, nodeData.strategyData, originalPrompt, showProjectSelector, projectName, strategyData, isCreatingNew, devLog]);

  // Debounced prompt update to prevent loops
  const promptUpdateTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const nameUpdateTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
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

  // Debounced name update to prevent loops
  const handleNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newName = e.target.value;
    setProjectName(newName);

    // Debounce external updates to prevent loops
    if (nameUpdateTimeoutRef.current) {
      clearTimeout(nameUpdateTimeoutRef.current);
    }

    nameUpdateTimeoutRef.current = setTimeout(() => {
      if (nodeData.onUpdateData) {
        nodeData.onUpdateData(id, { name: newName });
      }
    }, 500);
  }, [id, nodeData]);

  const handleLoadProject = useCallback(async (projectId: string) => {
    devLog('📂 Loading project', { projectId });
    try {
      const { brandingApi } = await import('../../services/brandingApi');
      const project = await brandingApi.getById(projectId);

      if (!project || !project.data) {
        devLog('❌ Invalid project data', { projectId, project });
        toast.error(t('canvas.failedToLoadProject'), { duration: 3000 });
        return;
      }

      devLog('📦 Project loaded from API', {
        projectId,
        projectName: project.name,
        hasPrompt: !!project.prompt,
        promptLength: project.prompt?.length || 0,
        dataKeys: Object.keys(project.data || {}),
        dataValues: Object.keys(project.data || {}).reduce((acc, key) => {
          const value = project.data[key];
          if (Array.isArray(value)) {
            acc[key] = `Array(${value.length})`;
          } else if (typeof value === 'object' && value !== null) {
            acc[key] = `Object(${Object.keys(value).length} keys)`;
          } else if (typeof value === 'string') {
            acc[key] = `String(${value.length} chars)`;
          } else {
            acc[key] = typeof value;
          }
          return acc;
        }, {} as Record<string, string>)
      });

      const convertedStrategyData: any = {};

      // Handle marketResearch - support multiple formats
      if (typeof project.data.marketResearch === 'string' && project.data.marketResearch.trim()) {
        // New format: marketResearch is a string (benchmarking paragraph)
        convertedStrategyData.marketResearch = project.data.marketResearch;
      } else if (typeof project.data.marketResearch === 'object' && project.data.marketResearch !== null) {
        // Object format
        convertedStrategyData.marketResearch = project.data.marketResearch;
      } else if (project.data.mercadoNicho || project.data.publicoAlvo || project.data.posicionamento || project.data.insights) {
        // Old format: separate fields
        convertedStrategyData.marketResearch = {
          mercadoNicho: project.data.mercadoNicho || '',
          publicoAlvo: project.data.publicoAlvo || '',
          posicionamento: project.data.posicionamento || '',
          insights: project.data.insights || '',
        };
      }

      // Convert persona
      if (project.data.persona) {
        if (typeof project.data.persona === 'object' && project.data.persona !== null) {
          convertedStrategyData.persona = project.data.persona;
        }
      }

      // Convert archetypes
      if (project.data.archetypes) {
        if (typeof project.data.archetypes === 'object' && project.data.archetypes !== null) {
          convertedStrategyData.archetypes = project.data.archetypes;
        }
      }

      // Convert array sections
      const arraySections = ['competitors', 'references', 'colorPalettes', 'visualElements', 'mockupIdeas'] as const;
      arraySections.forEach(key => {
        if (project.data[key] !== undefined && project.data[key] !== null) {
          if (Array.isArray(project.data[key])) {
            if (project.data[key].length > 0) {
              convertedStrategyData[key] = project.data[key];
            }
          }
        }
      });

      // Convert object sections
      const objectSections = ['swot', 'moodboard'] as const;
      objectSections.forEach(key => {
        if (project.data[key] !== undefined && project.data[key] !== null) {
          if (typeof project.data[key] === 'object') {
            convertedStrategyData[key] = project.data[key];
          }
        }
      });

      const convertedKeys = Object.keys(convertedStrategyData);
      devLog('🔄 Converting project data', {
        projectId,
        nodeId: id,
        convertedSections: convertedKeys,
        sectionsCount: convertedKeys.length,
        convertedData: convertedStrategyData
      });

      if (nodeData.onUpdateData) {
        nodeData.onUpdateData(id, {
          prompt: project.prompt || '',
          name: project.name || '',
          strategyData: convertedStrategyData,
          projectId: project._id || (project as any).id,
        });

        devLog('✅ Data update called', {
          projectId,
          nodeId: id,
          prompt: project.prompt || '',
          name: project.name || '',
          strategyDataKeys: Object.keys(convertedStrategyData),
          strategyDataCount: Object.keys(convertedStrategyData).length
        });
      } else {
        devLog('❌ onUpdateData not available', { projectId, nodeId: id });
      }

      setPrompt(project.prompt || '');
      setProjectName(project.name || '');
      setShowProjectSelector(false);

      devLog('✅ Project loaded successfully', {
        projectId,
        projectName: project.name,
        sectionsLoaded: convertedKeys.length,
        hasData: convertedKeys.length > 0,
        convertedSections: convertedKeys
      });

      toast.success(t('canvas.projectLoadedSuccessfully'));
    } catch (error: any) {
      devLog('❌ Failed to load project', {
        projectId,
        error: error?.message || error,
        stack: error?.stack
      });
      console.error('Failed to load project:', error);
      toast.error(error?.message || t('canvas.failedToLoadProject'), { duration: 3000 });
    }
  }, [id, nodeData, t, devLog]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      // Clear all debounce timeouts
      Object.values(saveTimeoutRef.current).forEach(timeout => clearTimeout(timeout));
      if (promptUpdateTimeoutRef.current) {
        clearTimeout(promptUpdateTimeoutRef.current);
      }
      if (nameUpdateTimeoutRef.current) {
        clearTimeout(nameUpdateTimeoutRef.current);
      }
      if (draggingLogTimeoutRef.current) {
        clearTimeout(draggingLogTimeoutRef.current);
      }
    };
  }, []);

  const hasLoadedProjectRef = useRef<string | null>(null);
  const isLoadingRef = useRef(false);
  const hasLoadedDataForProjectRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const projectId = nodeData.projectId;

    // Only proceed if we have a projectId and we're not already loading
    if (!projectId || isLoadingRef.current) {
      if (!projectId) {
        hasLoadedProjectRef.current = null;
        hasLoadedDataForProjectRef.current.clear();
      }
      return;
    }

    // Check if this is a different project
    const isDifferentProject = projectId !== hasLoadedProjectRef.current;

    // Check if we've already loaded data for this project
    const hasLoadedData = hasLoadedDataForProjectRef.current.has(projectId);

    // Only load if it's a different project OR we haven't loaded data for this project yet
    if (isDifferentProject || !hasLoadedData) {
      // Prevent multiple simultaneous loads
      if (isLoadingRef.current) {
        devLog('⏳ Already loading project, skipping', { projectId });
        return;
      }

      isLoadingRef.current = true;
      hasLoadedProjectRef.current = projectId;

      devLog('🔄 Auto-loading project', {
        projectId,
        isDifferentProject,
        hasLoadedData,
        hasStrategyData: !!strategyData,
        strategyDataKeys: strategyData ? Object.keys(strategyData) : [],
        hasData
      });

      handleLoadProject(projectId)
        .then(() => {
          isLoadingRef.current = false;
          // Mark that we've loaded data for this project
          hasLoadedDataForProjectRef.current.add(projectId);
        })
        .catch((error) => {
          isLoadingRef.current = false;
          if (hasLoadedProjectRef.current === projectId) {
            hasLoadedProjectRef.current = null;
            hasLoadedDataForProjectRef.current.delete(projectId);
          }
          devLog('❌ Auto-load failed', {
            projectId,
            error: error?.message || error
          });
          console.error('Auto-load failed:', error);
        });
    } else {
      // Project already loaded, just update the ref
      hasLoadedProjectRef.current = projectId;
    }
  }, [nodeData.projectId, handleLoadProject, devLog]);

  const expandedSectionsRef = useRef(expandedSections);
  useEffect(() => {
    expandedSectionsRef.current = expandedSections;
  }, [expandedSections]);

  useEffect(() => {
    if (nodeData.expandedSections && JSON.stringify(nodeData.expandedSections) !== JSON.stringify(expandedSectionsRef.current)) {
      setExpandedSections(nodeData.expandedSections);
    }
    if (hasData && strategyData) {
      setExpandedSections(prev => {
        const newExpanded: Record<string, boolean> = { ...prev };
        let hasChanges = false;
        sections.forEach(section => {
          if (hasSectionData(section.type) && prev[section.type] === undefined) {
            newExpanded[section.type] = true;
            hasChanges = true;
          }
        });
        if (hasChanges && nodeData.onUpdateData) {
          nodeData.onUpdateData(id, { expandedSections: newExpanded });
        }
        return hasChanges ? newExpanded : prev;
      });
      // Note: showProjectSelector and isCreatingNew are now handled in the sync useEffect above
    }
  }, [hasData, strategyData, sections, id, nodeData, hasSectionData, expandedSections]);

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
  }, [sections, expandedSections, hasSectionData, id, nodeData]);

  const handleResize = useCallback((width: number, height: number) => {
    handleResizeWithDebounce(id, width, height, nodeData.onResize);
  }, [id, nodeData.onResize, handleResizeWithDebounce]);

  const handleFitToContent = useCallback(() => {
    fitToContent(id, 500, 'auto', nodeData.onResize);
  }, [id, nodeData.onResize, fitToContent]);

  return (
    <NodeContainer
      selected={selected}
      dragging={dragging}
      onFitToContent={handleFitToContent}
      className="p-5 min-w-[500px] flex flex-col"
      onContextMenu={(e) => {
        // Allow ReactFlow to handle the context menu event
      }}
    >
      {selected && !dragging && (
        <NodeResizer
          color="#brand-cyan"
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
        <div className="flex items-center justify-between mb-5 pb-4 border-b border-zinc-700/30 bg-gradient-to-r from-zinc-900/40 to-zinc-900/20 backdrop-blur-sm -mx-5 px-5 pt-0">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-md bg-brand-cyan/10 border border-brand-cyan/20">
              <Target size={16} className="text-brand-cyan" />
            </div>
            <div className="flex flex-col">
              <h3 className="text-sm font-semibold text-zinc-200 font-mono tracking-tight">{t('canvasNodes.strategyNode.title') || 'Strategy Node'}</h3>
              {projectName && (
                <span className="text-[10px] text-zinc-400 font-mono mt-0.5 truncate max-w-[200px]" title={projectName}>{projectName}</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {hasData && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleOpenInNewTab();
                }}
                disabled={!hasData || isGenerating}
                className={cn(
                  "p-2 rounded-md border transition-all nodrag nopan",
                  "bg-zinc-900/60 border-zinc-700/40 text-zinc-300 hover:border-zinc-600/60",
                  "disabled:opacity-50 disabled:cursor-not-allowed",
                  "hover:bg-zinc-800/70 backdrop-blur-sm shadow-sm hover:shadow-md hover:scale-105 active:scale-95"
                )}
                title={t('canvasNodes.strategyNode.openInNewTab')}
              >
                <ExternalLink size={14} />
              </button>
            )}
            {nodeData.onGeneratePDF && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleGeneratePDF();
                }}
                disabled={!hasData}
                className={cn(
                  "p-2 rounded-md border transition-all nodrag nopan",
                  "bg-zinc-900/60 border-zinc-700/40 text-zinc-300 hover:border-zinc-600/60",
                  "disabled:opacity-50 disabled:cursor-not-allowed",
                  "hover:bg-zinc-800/70 backdrop-blur-sm shadow-sm hover:shadow-md hover:scale-105 active:scale-95"
                )}
                title={t('canvasNodes.strategyNode.downloadPDF')}
              >
                <Download size={14} />
              </button>
            )}
            {nodeData.onSave && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleSave();
                }}
                disabled={!hasData || isGenerating}
                className={cn(
                  "p-2 rounded-md border transition-all nodrag nopan",
                  "bg-brand-cyan/20 hover:bg-brand-cyan/30 border-brand-cyan/40 text-brand-cyan font-semibold",
                  "disabled:opacity-50 disabled:cursor-not-allowed",
                  "backdrop-blur-sm shadow-sm hover:shadow-md hover:scale-105 active:scale-95"
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
          <div className="mb-5 space-y-4">
            <NodeLabel className="text-zinc-300 font-medium">{t('canvasNodes.strategyNode.chooseOption')}</NodeLabel>

            {/* Load Existing Projects */}
            <div className="space-y-2.5">
              <NodeButton
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (nodeData.onOpenProjectModal) {
                    nodeData.onOpenProjectModal(id);
                  }
                }}
                variant="default"
                className="w-full px-3 py-2.5 gap-3 backdrop-blur-sm shadow-sm hover:shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                <FolderOpen size={14} />
                <span>{t('canvasNodes.strategyNode.selectExistingProject')}</span>
              </NodeButton>
            </div>

            {/* Create New Project */}
            <div className="pt-3 border-t border-zinc-700/30">
              <NodeButton
                onClick={(e) => {
                  e.stopPropagation();
                  setIsCreatingNew(true);
                }}
                variant="primary"
                className="w-full px-3 py-2.5 gap-3 backdrop-blur-sm shadow-sm hover:shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                <Plus size={14} />
                <span>{t('canvasNodes.strategyNode.createNewProject')}</span>
              </NodeButton>
            </div>
          </div>
        )}

        {/* Name Input - Show when creating new */}
        {isCreatingNew && (
          <div className="mb-5">
            <NodeLabel className="text-zinc-300 font-medium">{t('canvasNodes.strategyNode.projectName') || 'Project Name'}</NodeLabel>
            <NodeInput
              type="text"
              value={projectName}
              onChange={handleNameChange}
              placeholder={t('canvasNodes.strategyNode.projectNamePlaceholder') || 'Enter project name...'}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              disabled={isGenerating}
            />
          </div>
        )}

        {/* Prompt Input - Show when creating new or when has data */}
        {(!showProjectSelector || isCreatingNew || hasData) && (
          <div className="mb-5">
            <NodeLabel className="text-zinc-300 font-medium">{t('canvasNodes.strategyNode.brandDescription')}</NodeLabel>
            <Textarea
              value={prompt}
              onChange={handlePromptChange}
              placeholder={t('canvasNodes.strategyNode.brandDescriptionPlaceholder')}
              className="text-xs resize-none nodrag nopan bg-zinc-900/60 border-zinc-700/40 focus:border-brand-cyan/50 focus:ring-1 focus:ring-brand-cyan/20 backdrop-blur-sm"
              rows={3}
              disabled={isGenerating}
            />
          </div>
        )}

        {/* Analyze Button - Before Generate Sections */}
        {nodeData.onInitialAnalysis && (isCreatingNew || !hasData || promptHasChanged) && (
          <div className="mb-5">
            {isGenerating && generatingStep === 'marketResearch' ? (
              <div className="flex gap-3">
                <NodeButton
                  onClick={(e) => {
                    e.stopPropagation();
                    nodeData.onCancelGeneration?.(id);
                  }}
                  variant="default"
                  className="flex-1 px-3 py-2.5 gap-3 border-red-500/50 text-red-400 hover:bg-red-500/20 backdrop-blur-sm shadow-sm hover:shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all nodrag nopan"
                >
                  <XCircle size={14} />
                  <span>{t('canvasNodes.strategyNode.cancel')}</span>
                </NodeButton>
                <div className="flex-1 px-3 py-2.5 bg-brand-cyan/20 border border-brand-cyan/40 rounded-md flex items-center justify-center gap-3 backdrop-blur-sm shadow-sm">
                  <GlitchLoader size={14} color="#brand-cyan" />
                  <span className="text-xs font-mono text-brand-cyan font-medium">{t('canvasNodes.strategyNode.analyzing')}</span>
                </div>
              </div>
            ) : (
              <NodeButton
                onClick={async (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (!nodeData.onInitialAnalysis) {
                    return;
                  }

                  // Validate prompt before proceeding
                  if (!prompt.trim()) {
                    toast.error(t('canvasNodes.strategyNode.pleaseEnterBrandDescription') || 'Please enter a brand description', { duration: 3000 });
                    return;
                  }

                  // Ensure name and prompt are saved before analysis (flush debounced updates)
                  if (nameUpdateTimeoutRef.current) {
                    clearTimeout(nameUpdateTimeoutRef.current);
                    nameUpdateTimeoutRef.current = undefined;
                    if (nodeData.onUpdateData) {
                      nodeData.onUpdateData(id, { name: projectName });
                    }
                  }

                  if (promptUpdateTimeoutRef.current) {
                    clearTimeout(promptUpdateTimeoutRef.current);
                    promptUpdateTimeoutRef.current = undefined;
                  }

                  // Force update prompt immediately (don't wait for debounce)
                  if (nodeData.onUpdateData) {
                    promptRef.current = prompt;
                    nodeData.onUpdateData(id, { prompt });
                  }

                  devLog('🔍 Starting initial analysis', {
                    promptLength: prompt.length,
                    promptPreview: prompt.substring(0, 50),
                    projectName: projectName || 'none',
                    isReanalyze: promptHasChanged && hasData,
                    hasData: !!hasData
                  });
                  try {
                    // Pass prompt directly to avoid race condition with nodesRef update
                    await nodeData.onInitialAnalysis(id, prompt);
                    devLog('✅ Initial analysis initiated');
                  } catch (error: any) {
                    devLog('❌ Initial analysis failed', {
                      error: error?.message || error
                    });
                    toast.error(error?.message || 'Failed to analyze', { duration: 5000 });
                  }
                }}
                disabled={!prompt.trim() || isGenerating}
                variant="primary"
                className="w-full px-3 py-2.5 gap-3 backdrop-blur-sm shadow-sm hover:shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                <Target size={14} />
                <span>{promptHasChanged && hasData ? t('canvasNodes.strategyNode.reAnalyze') || 'Re-analyze' : t('canvasNodes.strategyNode.analyze') || 'Analyze'}</span>
              </NodeButton>
            )}
          </div>
        )}

        {/* Section Buttons Grid - Only show after initial analysis */}
        {hasData && (
          <div className="mb-5">
            <div className="flex items-center justify-between mb-3">
              <NodeLabel className="mb-0 text-zinc-300 font-medium">{t('canvasNodes.strategyNode.generateSections')}</NodeLabel>
              {nodeData.onGenerateAll && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleGenerateAll();
                  }}
                  disabled={!prompt.trim() || isGenerating}
                  className={cn(
                    'px-2.5 py-1.5 text-[10px] font-mono border rounded-md transition-all nodrag nopan',
                    'bg-zinc-900/60 border-zinc-700/40 text-zinc-400 hover:border-zinc-600/60 hover:text-zinc-300',
                    'disabled:opacity-50 disabled:cursor-not-allowed',
                    'backdrop-blur-sm shadow-sm hover:shadow-md hover:scale-105 active:scale-95'
                  )}
                  title={t('canvasNodes.strategyNode.generateAllSections')}
                >
                  {t('canvasNodes.strategyNode.generateAll')}
                </button>
              )}
            </div>
            <div
              className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto"
              onWheel={(e) => e.stopPropagation()}
            >
              {sections
                .filter((section) => !hasSectionData(section.type)) // Hide sections that already have data
                .map((section) => {
                  const isGeneratingSection = generatingSteps.includes(section.type) || generatingStep === section.type || (isGenerating && generatingStep === 'all');
                  const missingDeps = checkDependencies(section.type);
                  const isBlocked = missingDeps.length > 0;

                  // Get labels for missing dependencies
                  const missingDepsLabels = missingDeps.map(depType => {
                    const depSection = sections.find(s => s.type === depType);
                    return depSection?.label || depType;
                  }).join(', ');

                  return (
                    <button
                      key={section.type}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!isBlocked) {
                          handleGenerateSection(section.type);
                        }
                      }}
                      disabled={!prompt.trim() || isGeneratingSection || (isGenerating && generatingStep === 'all') || generatingSteps.length > 0 || isBlocked}
                      className={cn(
                        'px-2.5 py-2 border rounded-md text-xs font-mono transition-all flex items-center gap-1.5 justify-center nodrag nopan relative',
                        isBlocked
                          ? 'bg-zinc-900/30 border-zinc-700/30 text-zinc-500 cursor-not-allowed opacity-60'
                          : 'bg-zinc-900/60 border-zinc-700/40 text-zinc-300 hover:border-zinc-600/60 cursor-pointer backdrop-blur-sm shadow-sm hover:shadow-md hover:scale-[1.02] active:scale-[0.98]',
                        (!prompt.trim() || isGeneratingSection || (isGenerating && generatingStep === 'all') || generatingSteps.length > 0) && !isBlocked && 'opacity-50 cursor-not-allowed'
                      )}
                      title={isBlocked ? `Bloqueado: requer ${missingDepsLabels}` : section.label}
                    >
                      {isBlocked && (
                        <Lock size={12} className="absolute top-1 right-1 text-red-400" />
                      )}
                      <span className={cn('text-xs', isBlocked && 'opacity-50')}>{section.emoji}</span>
                      <span className={cn('truncate', isBlocked && 'opacity-50')}>{section.label}</span>
                    </button>
                  );
                })}
            </div>
          </div>
        )}

        {/* Single Generation Status - Shows when any section is generating */}
        {isGenerating && (generatingStep || generatingSteps.length > 0) && (
          <div className="mb-5 px-3 py-2.5 bg-brand-cyan/10 border border-brand-cyan/40 rounded-md flex items-center justify-between gap-3 backdrop-blur-sm shadow-sm">
            <div className="flex items-center gap-3">
              <GlitchLoader size={12} color="#brand-cyan" />
              <span className="text-xs font-mono text-brand-cyan font-medium">
                {generatingStep === 'all'
                  ? t('canvasNodes.strategyNode.generatingAllSections') || 'Generating all sections...'
                  : generatingStep === 'marketResearch'
                    ? t('canvasNodes.strategyNode.analyzing') || 'Analyzing...'
                    : generatingSteps.length > 0
                      ? t('canvasNodes.strategyNode.generatingSection', {
                        section: sections.find(s => s.type === generatingSteps[0])?.label || generatingSteps[0]
                      }) || `Generating ${generatingSteps[0]}...`
                      : generatingStep
                        ? t('canvasNodes.strategyNode.generatingSection', {
                          section: sections.find(s => s.type === generatingStep)?.label || generatingStep
                        }) || `Generating ${generatingStep}...`
                        : t('canvasNodes.strategyNode.generating') || 'Generating...'}
              </span>
            </div>
            {nodeData.onCancelGeneration && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (generatingStep === 'all') {
                    nodeData.onCancelGeneration?.(id);
                  } else if (generatingSteps.length > 0) {
                    nodeData.onCancelGeneration?.(id, generatingSteps[0]);
                  } else if (generatingStep) {
                    nodeData.onCancelGeneration?.(id, generatingStep);
                  }
                }}
                className="p-1.5 hover:bg-red-500/20 rounded-md transition-all nodrag nopan"
                title={t('canvasNodes.strategyNode.cancelGeneration')}
              >
                <XCircle size={12} className="text-red-400 hover:text-red-300" />
              </button>
            )}
          </div>
        )}

        {/* Generated Sections Display */}
        {hasData && (
          <div className="border-t border-zinc-700/30 pt-4 flex flex-col flex-1 min-h-0">
            <div className="flex items-center justify-between mb-4 shrink-0 px-1">
              <span className="text-xs font-mono text-zinc-300 font-medium">
                {t('canvasNodes.strategyNode.generatedSections')} <span className="text-brand-cyan">({sections.filter(s => hasSectionData(s.type)).length}/{sections.length})</span>
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleAllSections();
                }}
                className="text-xs font-mono text-zinc-400 hover:text-zinc-300 flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-zinc-800/50 transition-all backdrop-blur-sm nodrag nopan"
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
                const isGeneratingSection = generatingSteps.includes(section.type) || generatingStep === section.type;
                const isGeneratingAll = isGenerating && generatingStep === 'all';
                if (!sectionHasData && !isGeneratingSection && !isGeneratingAll) return null;

                const content = formatSectionContent(section.type);
                const isSectionExpanded = expandedSections[section.type] ?? true; // Default to expanded

                return (
                  <div
                    key={section.type}
                    className="border border-zinc-700/40 rounded-lg overflow-hidden group bg-zinc-900/30 backdrop-blur-sm shadow-sm hover:shadow-md transition-all"
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSection(section.type);
                      }}
                      className="w-full flex items-center justify-between px-3.5 py-2.5 bg-zinc-900/40 hover:bg-zinc-900/60 transition-all nodrag nopan"
                    >
                      <div className="flex items-center gap-2.5">
                        {sectionHasData && !isGeneratingSection && (
                          <div
                            onClick={(e) => handleDeleteSection(section.type, e)}
                            className="p-1 hover:bg-red-500/20 rounded-md opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
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
                        <span className="text-sm">{section.emoji}</span>
                        <NodeLabel className="mb-0 text-zinc-200">
                          {section.label}
                          {sectionHasData && !isGeneratingSection && (
                            <span className="ml-2 text-brand-cyan text-[10px]">✓</span>
                          )}
                        </NodeLabel>
                      </div>
                      {isSectionExpanded ? <ChevronUp size={14} className="text-zinc-400" /> : <ChevronDown size={14} className="text-zinc-400" />}
                    </button>

                    {isSectionExpanded && (
                      <div
                        className="p-3.5 bg-zinc-900/20 border-t border-zinc-700/20"
                        onWheel={(e) => e.stopPropagation()}
                      >
                        {sectionHasData && content && (
                          <AutoResizeTextarea
                            value={content}
                            onChange={(e) => handleSectionContentChange(section.type, e.target.value)}
                            className="text-xs resize-none nodrag nopan w-full bg-zinc-900/60 border-zinc-700/40 focus:border-brand-cyan/50 focus:ring-1 focus:ring-brand-cyan/20 backdrop-blur-sm"
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
