import { useCallback, useRef } from 'react';
import type { Node } from '@xyflow/react';
import type { FlowNodeData, StrategyNodeData } from '../../types/reactFlow';
import type { BrandingData } from '../../types';
import { toast } from 'sonner';

interface UseStrategyNodeHandlerParams {
  nodesRef: React.MutableRefObject<Node<FlowNodeData>[]>;
  updateNodeData: <T extends FlowNodeData>(
    nodeId: string,
    newData: Partial<T>,
    nodeType?: string
  ) => void;
  saveImmediately?: () => Promise<void>;
}

// Helper to extract market research as string (supports both new string format and old object format)
const getMarketResearchString = (mr: any): string => {
  if (!mr) return '';
  if (typeof mr === 'string') return mr;
  // Old format: object with separate fields
  if (typeof mr === 'object' && mr !== null) {
    const parts: string[] = [];
    if (mr.mercadoNicho) parts.push(mr.mercadoNicho);
    if (mr.publicoAlvo) parts.push(mr.publicoAlvo);
    if (mr.posicionamento) parts.push(mr.posicionamento);
    if (mr.insights) parts.push(mr.insights);
    return parts.join('\n\n');
  }
  return '';
};

export const useCanvasStrategyHandler = ({
  nodesRef,
  updateNodeData,
  saveImmediately,
}: UseStrategyNodeHandlerParams) => {
  const cancelGenerationRef = useRef<Record<string, Record<string, boolean> | boolean>>({});
  const handleStrategyNodeGenerate = useCallback(async (nodeId: string, strategyType: string, prompt?: string) => {
    const node = nodesRef.current.find(n => n.id === nodeId);
    if (!node || node.type !== 'strategy') return;

    const strategyData = node.data as any;
    const brandPrompt = prompt || strategyData.prompt || '';
    
    if (!brandPrompt.trim()) {
      toast.error('Please enter a brand description', { duration: 3000 });
      return;
    }

    updateNodeData<StrategyNodeData>(nodeId, { isGenerating: true, generatingStep: strategyType }, 'strategy');

    try {
      const { generatePersona, generateArchetypes, generateMarketResearch } = await import('../../services/brandingService');
      
      const newStrategyData: any = { ...strategyData.strategyData };

      if (strategyType === 'all' || strategyType === 'persona') {
        const marketResearch = getMarketResearchString(newStrategyData.marketResearch);
        newStrategyData.persona = await generatePersona(brandPrompt, marketResearch || brandPrompt);
      }

      if (strategyType === 'all' || strategyType === 'archetypes') {
        const marketResearch = getMarketResearchString(newStrategyData.marketResearch);
        newStrategyData.archetypes = await generateArchetypes(brandPrompt, marketResearch || brandPrompt);
      }

      if (strategyType === 'all' || strategyType === 'marketResearch') {
        newStrategyData.marketResearch = await generateMarketResearch(brandPrompt);
      }

      updateNodeData<StrategyNodeData>(nodeId, { 
        strategyData: newStrategyData, 
        isGenerating: false, 
        generatingStep: undefined 
      }, 'strategy');

      if (saveImmediately) {
        setTimeout(() => saveImmediately(), 100);
      }
    } catch (error: any) {
      console.error('Error generating strategy:', error);
      toast.error(error?.message || 'Failed to generate strategy', { duration: 5000 });
      updateNodeData<StrategyNodeData>(nodeId, { isGenerating: false, generatingStep: undefined }, 'strategy');
    }
  }, [nodesRef, updateNodeData, saveImmediately]);

  const handleStrategyNodeDataUpdate = useCallback((nodeId: string, newData: any) => {
    // Preserve onOpenProjectModal handler if it exists
    const node = nodesRef.current.find(n => n.id === nodeId);
    if (node && node.type === 'strategy') {
      const strategyData = node.data as StrategyNodeData;
      if (strategyData.onOpenProjectModal && !newData.onOpenProjectModal) {
        updateNodeData<StrategyNodeData>(nodeId, {
          ...newData,
          onOpenProjectModal: strategyData.onOpenProjectModal,
        }, 'strategy');
      } else {
        updateNodeData<StrategyNodeData>(nodeId, newData, 'strategy');
      }
    } else {
      updateNodeData<StrategyNodeData>(nodeId, newData, 'strategy');
    }
  }, [updateNodeData, nodesRef]);

  const handleStrategyNodeInitialAnalysis = useCallback(async (nodeId: string) => {
    const node = nodesRef.current.find(n => n.id === nodeId);
    if (!node || node.type !== 'strategy') return;

    const strategyData = node.data as any;
    const brandPrompt = strategyData.prompt || '';
    
    if (!brandPrompt.trim()) {
      toast.error('Please enter a brand description', { duration: 3000 });
      return;
    }

    updateNodeData<StrategyNodeData>(nodeId, { isGenerating: true, generatingStep: 'marketResearch' }, 'strategy');

    try {
      const { generateMarketResearch } = await import('../../services/brandingService');
      
      const newStrategyData: any = { ...strategyData.strategyData };
      
      // Only generate Market Research as initial analysis
      newStrategyData.marketResearch = await generateMarketResearch(brandPrompt);

      updateNodeData<StrategyNodeData>(nodeId, { 
        strategyData: newStrategyData, 
        isGenerating: false, 
        generatingStep: undefined 
      }, 'strategy');

      if (saveImmediately) {
        setTimeout(() => saveImmediately(), 100);
      }
      
      toast.success('Initial analysis completed. You can now generate sections manually.');
    } catch (error: any) {
      console.error('Error in initial analysis:', error);
      toast.error(error?.message || 'Failed to perform initial analysis', { duration: 5000 });
      updateNodeData<StrategyNodeData>(nodeId, { isGenerating: false, generatingStep: undefined }, 'strategy');
    }
  }, [nodesRef, updateNodeData, saveImmediately]);

  const handleStrategyNodeGenerateSection = useCallback(async (nodeId: string, sectionType: string) => {
    const node = nodesRef.current.find(n => n.id === nodeId);
    if (!node || node.type !== 'strategy') return;

    const strategyData = node.data as any;
    const brandPrompt = strategyData.prompt || '';
    
    if (!brandPrompt.trim()) {
      toast.error('Please enter a brand description', { duration: 3000 });
      return;
    }

    // Check if this section is already being generated
    const currentGeneratingSteps = strategyData.generatingSteps || [];
    if (currentGeneratingSteps.includes(sectionType)) {
      // Already generating this section, skip
      return;
    }

    // Prevent generating multiple sections at once
    if (currentGeneratingSteps.length > 0) {
      toast.error('Please wait for the current section to finish generating', { duration: 3000 });
      return;
    }

    // Reset cancel flag for this specific section
    if (!cancelGenerationRef.current[nodeId] || typeof cancelGenerationRef.current[nodeId] === 'boolean') {
      cancelGenerationRef.current[nodeId] = {};
    }
    (cancelGenerationRef.current[nodeId] as Record<string, boolean>)[sectionType] = false;
    
    // Add this section to the generating steps array
    const newGeneratingSteps = [...currentGeneratingSteps, sectionType];
    updateNodeData<StrategyNodeData>(nodeId, { 
      isGenerating: true, 
      generatingSteps: newGeneratingSteps 
    }, 'strategy');

    let cancelFlags: Record<string, boolean> | boolean | undefined;
    try {
      // Check if generation was cancelled before starting
      cancelFlags = cancelGenerationRef.current[nodeId];
      if (cancelFlags && typeof cancelFlags === 'object' && cancelFlags[sectionType]) {
        // Remove this section from generating steps
        const updatedSteps = newGeneratingSteps.filter(s => s !== sectionType);
        updateNodeData<StrategyNodeData>(nodeId, { 
          isGenerating: updatedSteps.length > 0,
          generatingSteps: updatedSteps.length > 0 ? updatedSteps : undefined
        }, 'strategy');
        toast.info('Generation cancelled');
        return;
      }
      const { 
        generatePersona, 
        generateArchetypes, 
        generateMarketResearch, 
        generateCompetitors, 
        generateReferences, 
        generateSWOT, 
        generateColorPalettes, 
        generateVisualElements, 
        generateMockupIdeas, 
      } = await import('../../services/brandingService');
      
      const newStrategyData: any = { ...strategyData.strategyData };
      const marketResearch = getMarketResearchString(newStrategyData.marketResearch);

      switch (sectionType) {
        case 'persona':
          newStrategyData.persona = await generatePersona(brandPrompt, marketResearch || brandPrompt);
          break;
        case 'archetypes':
          newStrategyData.archetypes = await generateArchetypes(brandPrompt, marketResearch || brandPrompt);
          break;
        case 'marketResearch':
          newStrategyData.marketResearch = await generateMarketResearch(brandPrompt);
          break;
        case 'competitors':
          newStrategyData.competitors = await generateCompetitors(brandPrompt, marketResearch || brandPrompt, []);
          break;
        case 'references':
          newStrategyData.references = await generateReferences(brandPrompt, marketResearch || brandPrompt, newStrategyData.competitors || []);
          break;
        case 'swot':
          newStrategyData.swot = await generateSWOT(brandPrompt, marketResearch || brandPrompt, newStrategyData.competitors || []);
          break;
        case 'colorPalettes':
          newStrategyData.colorPalettes = await generateColorPalettes(brandPrompt, newStrategyData.swot || {}, newStrategyData.references || []);
          break;
        case 'visualElements':
          newStrategyData.visualElements = await generateVisualElements(brandPrompt, newStrategyData.colorPalettes || []);
          break;
        case 'mockupIdeas': {
          // For backward compatibility, extract old format fields if they exist
          const mr = newStrategyData.marketResearch;
          const mockupData: BrandingData = {
            prompt: brandPrompt,
            marketResearch: typeof mr === 'string' ? mr : undefined,
            mercadoNicho: typeof mr === 'object' && mr?.mercadoNicho ? mr.mercadoNicho : undefined,
            publicoAlvo: typeof mr === 'object' && mr?.publicoAlvo ? mr.publicoAlvo : undefined,
            posicionamento: typeof mr === 'object' && mr?.posicionamento ? mr.posicionamento : undefined,
            insights: typeof mr === 'object' && mr?.insights ? mr.insights : undefined,
            competitors: newStrategyData.competitors,
            references: newStrategyData.references,
            swot: newStrategyData.swot,
            colorPalettes: newStrategyData.colorPalettes,
            visualElements: newStrategyData.visualElements,
            persona: newStrategyData.persona,
            archetypes: newStrategyData.archetypes,
          };
          newStrategyData.mockupIdeas = await generateMockupIdeas(brandPrompt, mockupData, []);
          break;
        }
      }

      // Check if generation was cancelled before finalizing
      cancelFlags = cancelGenerationRef.current[nodeId];
      const wasCancelled = cancelFlags && typeof cancelFlags === 'object' && cancelFlags[sectionType];
      
      // Remove this section from generating steps
      const updatedSteps = newGeneratingSteps.filter(s => s !== sectionType);
      
      if (!wasCancelled) {
        updateNodeData<StrategyNodeData>(nodeId, { 
          strategyData: newStrategyData, 
          isGenerating: updatedSteps.length > 0,
          generatingSteps: updatedSteps.length > 0 ? updatedSteps : undefined
        }, 'strategy');

        if (saveImmediately) {
          setTimeout(() => saveImmediately(), 100);
        }
      } else {
        updateNodeData<StrategyNodeData>(nodeId, { 
          isGenerating: updatedSteps.length > 0,
          generatingSteps: updatedSteps.length > 0 ? updatedSteps : undefined
        }, 'strategy');
        toast.info('Generation cancelled');
      }
    } catch (error: any) {
      console.error(`Error generating ${sectionType}:`, error);
      toast.error(error?.message || `Failed to generate ${sectionType}`, { duration: 5000 });
      
      // Remove this section from generating steps on error
      const node = nodesRef.current.find(n => n.id === nodeId);
      if (node && node.type === 'strategy') {
        const currentStrategyData = node.data as any;
        const currentSteps = currentStrategyData.generatingSteps || [];
        const updatedSteps = currentSteps.filter((s: string) => s !== sectionType);
        updateNodeData<StrategyNodeData>(nodeId, { 
          isGenerating: updatedSteps.length > 0,
          generatingSteps: updatedSteps.length > 0 ? updatedSteps : undefined
        }, 'strategy');
      }
    } finally {
      // Clean up cancel flag for this section
      cancelFlags = cancelGenerationRef.current[nodeId];
      if (cancelFlags && typeof cancelFlags === 'object') {
        delete cancelFlags[sectionType];
        // If no more sections are being cancelled, clean up the node entry
        if (Object.keys(cancelFlags).length === 0) {
          delete cancelGenerationRef.current[nodeId];
        }
      } else {
        delete cancelGenerationRef.current[nodeId];
      }
    }
  }, [nodesRef, updateNodeData, saveImmediately]);

  const handleStrategyNodeGenerateAll = useCallback(async (nodeId: string) => {
    const node = nodesRef.current.find(n => n.id === nodeId);
    if (!node || node.type !== 'strategy') return;

    const strategyData = node.data as any;
    const brandPrompt = strategyData.prompt || '';
    
    if (!brandPrompt.trim()) {
      toast.error('Please enter a brand description', { duration: 3000 });
      return;
    }

    // Reset cancel flag
    cancelGenerationRef.current[nodeId] = false;
    updateNodeData<StrategyNodeData>(nodeId, { isGenerating: true, generatingStep: 'all' }, 'strategy');

    try {
      const { 
        generatePersona, 
        generateArchetypes, 
        generateMarketResearch, 
        generateCompetitors, 
        generateReferences, 
        generateSWOT, 
        generateColorPalettes, 
        generateVisualElements, 
        generateMockupIdeas, 
      } = await import('../../services/brandingService');
      
      const newStrategyData: any = { ...strategyData.strategyData };

      // Helper function to check if a section has data
      const hasSectionData = (sectionType: string): boolean => {
        switch (sectionType) {
          case 'marketResearch':
            return !!(newStrategyData.marketResearch);
          case 'persona':
            return !!(newStrategyData.persona);
          case 'archetypes':
            return !!(newStrategyData.archetypes);
          case 'competitors':
            return !!(newStrategyData.competitors && newStrategyData.competitors.length > 0);
          case 'references':
            return !!(newStrategyData.references && newStrategyData.references.length > 0);
          case 'swot':
            return !!(newStrategyData.swot);
          case 'colorPalettes':
            return !!(newStrategyData.colorPalettes && newStrategyData.colorPalettes.length > 0);
          case 'visualElements':
            return !!(newStrategyData.visualElements && newStrategyData.visualElements.length > 0);
          case 'mockupIdeas':
            return !!(newStrategyData.mockupIdeas && newStrategyData.mockupIdeas.length > 0);
          default:
            return false;
        }
      };  

      // Define sections in order with their types
      const allSections = [
        { type: 'marketResearch', label: 'Market Research' },
        { type: 'persona', label: 'Persona' },
        { type: 'archetypes', label: 'Archetypes' },
        { type: 'competitors', label: 'Competitors' },
        { type: 'references', label: 'References' },
        { type: 'swot', label: 'SWOT' },
        { type: 'colorPalettes', label: 'Color Palettes' },
        { type: 'visualElements', label: 'Visual Elements' },
        { type: 'mockupIdeas', label: 'Mockup Ideas' },
        { type: 'moodboard', label: 'Moodboard' },
      ];

      // Filter to only generate sections that don't have data yet
      const sectionsToGenerate = allSections.filter(section => !hasSectionData(section.type));

      if (sectionsToGenerate.length === 0) {
        updateNodeData<StrategyNodeData>(nodeId, { 
          isGenerating: false, 
          generatingStep: undefined 
        }, 'strategy');
        toast.info('All sections have already been generated');
        return;
      }

      // Generate only missing sections sequentially with delay and step tracking
      for (let i = 0; i < sectionsToGenerate.length; i++) {
        // Check if generation was cancelled
        if (cancelGenerationRef.current[nodeId]) {
          updateNodeData<StrategyNodeData>(nodeId, { 
            isGenerating: false, 
            generatingStep: undefined 
          }, 'strategy');
          toast.info('Generation cancelled');
          return;
        }

        const section = sectionsToGenerate[i];
        
        // Update generating step to show current section
        updateNodeData<StrategyNodeData>(nodeId, { 
          generatingStep: section.type,
          strategyData: newStrategyData 
        }, 'strategy');

        // Small delay before starting next section (except first)
        if (i > 0) {
          await new Promise(resolve => setTimeout(resolve, 300));
          // Check again after delay
          if (cancelGenerationRef.current[nodeId]) {
            updateNodeData<StrategyNodeData>(nodeId, { 
              isGenerating: false, 
              generatingStep: undefined 
            }, 'strategy');
            toast.info('Generation cancelled');
            return;
          }
        }

        try {
          switch (section.type) {
            case 'marketResearch':
              newStrategyData.marketResearch = await generateMarketResearch(brandPrompt);
              break;
            case 'persona': {
              const marketResearch = getMarketResearchString(newStrategyData.marketResearch) || brandPrompt;
              newStrategyData.persona = await generatePersona(brandPrompt, marketResearch);
              break;
            }
            case 'archetypes': {
              const marketResearch = getMarketResearchString(newStrategyData.marketResearch) || brandPrompt;
              newStrategyData.archetypes = await generateArchetypes(brandPrompt, marketResearch);
              break;
            }
            case 'competitors': {
              const marketResearch = getMarketResearchString(newStrategyData.marketResearch) || brandPrompt;
              newStrategyData.competitors = await generateCompetitors(brandPrompt, marketResearch, []);
              break;
            }
            case 'references': {
              const marketResearch = getMarketResearchString(newStrategyData.marketResearch) || brandPrompt;
              newStrategyData.references = await generateReferences(brandPrompt, marketResearch, newStrategyData.competitors || []);
              break;
            }
            case 'swot': {
              const marketResearch = getMarketResearchString(newStrategyData.marketResearch) || brandPrompt;
              newStrategyData.swot = await generateSWOT(brandPrompt, marketResearch, newStrategyData.competitors || []);
              break;
            }
            case 'colorPalettes':
              newStrategyData.colorPalettes = await generateColorPalettes(brandPrompt, newStrategyData.swot || {}, newStrategyData.references || []);
              break;
            case 'visualElements':
              newStrategyData.visualElements = await generateVisualElements(brandPrompt, newStrategyData.colorPalettes || []);
              break;
            case 'mockupIdeas': {
              // For backward compatibility, extract old format fields if they exist
              const mr = newStrategyData.marketResearch;
              const allData: BrandingData = {
                prompt: brandPrompt,
                marketResearch: typeof mr === 'string' ? mr : undefined,
                mercadoNicho: typeof mr === 'object' && mr?.mercadoNicho ? mr.mercadoNicho : undefined,
                publicoAlvo: typeof mr === 'object' && mr?.publicoAlvo ? mr.publicoAlvo : undefined,
                posicionamento: typeof mr === 'object' && mr?.posicionamento ? mr.posicionamento : undefined,
                insights: typeof mr === 'object' && mr?.insights ? mr.insights : undefined,
                competitors: newStrategyData.competitors,
                references: newStrategyData.references,
                swot: newStrategyData.swot,
                colorPalettes: newStrategyData.colorPalettes,
                visualElements: newStrategyData.visualElements,
                persona: newStrategyData.persona,
                archetypes: newStrategyData.archetypes,
              };
              newStrategyData.mockupIdeas = await generateMockupIdeas(brandPrompt, allData);
              break;
            }
            case 'moodboard': {
              const allData: BrandingData = {
                prompt: brandPrompt,
                mercadoNicho: newStrategyData.marketResearch?.mercadoNicho,
                publicoAlvo: newStrategyData.marketResearch?.publicoAlvo,
                posicionamento: newStrategyData.marketResearch?.posicionamento,
                insights: newStrategyData.marketResearch?.insights,
                competitors: newStrategyData.competitors,
                references: newStrategyData.references,
                swot: newStrategyData.swot,
                colorPalettes: newStrategyData.colorPalettes,
                visualElements: newStrategyData.visualElements,
                persona: newStrategyData.persona,
                archetypes: newStrategyData.archetypes,
                mockupIdeas: newStrategyData.mockupIdeas,
              };
              break;
            }
          }

          // Update data after each section is generated
          updateNodeData<StrategyNodeData>(nodeId, { 
            strategyData: newStrategyData 
          }, 'strategy');
        } catch (sectionError: any) {
          console.error(`Error generating ${section.type}:`, sectionError);
          // Continue with next section even if one fails
        }
      }

      // Check one more time before finalizing
      if (!cancelGenerationRef.current[nodeId]) {
        updateNodeData<StrategyNodeData>(nodeId, { 
          isGenerating: false, 
          generatingStep: undefined 
        }, 'strategy');

        if (saveImmediately) {
          setTimeout(() => saveImmediately(), 100);
        }
        toast.success('All sections generated successfully');
      } else {
        updateNodeData<StrategyNodeData>(nodeId, { 
          isGenerating: false, 
          generatingStep: undefined 
        }, 'strategy');
        toast.info('Generation cancelled');
      }
    } catch (error: any) {
      console.error('Error generating all sections:', error);
      toast.error(error?.message || 'Failed to generate all sections', { duration: 5000 });
      updateNodeData<StrategyNodeData>(nodeId, { isGenerating: false, generatingStep: undefined }, 'strategy');
    } finally {
      // Clean up cancel flag
      delete cancelGenerationRef.current[nodeId];
    }
  }, [nodesRef, updateNodeData, saveImmediately]);

  const handleStrategyNodeCancelGeneration = useCallback((nodeId: string, sectionType?: string) => {
    const node = nodesRef.current.find(n => n.id === nodeId);
    if (!node || node.type !== 'strategy') return;
    
    const strategyData = node.data as any;
    const currentGeneratingSteps = strategyData.generatingSteps || [];
    
    if (sectionType) {
      // Cancel specific section
      if (!cancelGenerationRef.current[nodeId]) {
        cancelGenerationRef.current[nodeId] = {};
      }
      cancelGenerationRef.current[nodeId][sectionType] = true;
      
      // Remove from generating steps immediately
      const updatedSteps = currentGeneratingSteps.filter((s: string) => s !== sectionType);
      updateNodeData<StrategyNodeData>(nodeId, { 
        isGenerating: updatedSteps.length > 0,
        generatingSteps: updatedSteps.length > 0 ? updatedSteps : undefined
      }, 'strategy');
    } else {
      // Cancel all sections
      if (!cancelGenerationRef.current[nodeId]) {
        cancelGenerationRef.current[nodeId] = {};
      }
      currentGeneratingSteps.forEach((step: string) => {
        cancelGenerationRef.current[nodeId][step] = true;
      });
      
      updateNodeData<StrategyNodeData>(nodeId, { 
        isGenerating: false, 
        generatingSteps: undefined,
        generatingStep: undefined // Legacy support
      }, 'strategy');
    }
  }, [updateNodeData, nodesRef]);

  const handleStrategyNodeGeneratePDF = useCallback(async (nodeId: string) => {
    const node = nodesRef.current.find(n => n.id === nodeId);
    if (!node || node.type !== 'strategy') return;

    const strategyData = node.data as any;
    if (!strategyData.strategyData) {
      toast.error('No strategy data to export', { duration: 3000 });
      return;
    }

    try {
      // Convert StrategyNodeData to BrandingData format
      const brandingData: BrandingData = {
        prompt: strategyData.prompt || '',
        name: strategyData.name,
        mercadoNicho: strategyData.strategyData.marketResearch?.mercadoNicho,
        publicoAlvo: strategyData.strategyData.marketResearch?.publicoAlvo,
        posicionamento: strategyData.strategyData.marketResearch?.posicionamento,
        insights: strategyData.strategyData.marketResearch?.insights,
        competitors: strategyData.strategyData.competitors,
        references: strategyData.strategyData.references,
        swot: strategyData.strategyData.swot,
        colorPalettes: strategyData.strategyData.colorPalettes,
        visualElements: strategyData.strategyData.visualElements,
        persona: strategyData.strategyData.persona,
        mockupIdeas: strategyData.strategyData.mockupIdeas,
        moodboard: strategyData.strategyData.moodboard,
        archetypes: strategyData.strategyData.archetypes,
      };

      const { generateBrandingPDF } = await import('../../utils/generateBrandingPDF');
      
      // Get default steps for PDF
      const defaultSteps = [
        { id: 1, title: 'Mercado e Nicho' },
        { id: 2, title: 'Público Alvo' },
        { id: 3, title: 'Posicionamento' },
        { id: 4, title: 'Insights' },
        { id: 5, title: 'Competitors' },
        { id: 6, title: 'References' },
        { id: 7, title: 'SWOT Analysis' },
        { id: 8, title: 'Color Palettes' },
        { id: 9, title: 'Visual Elements' },
        { id: 10, title: 'Persona' },
        { id: 11, title: 'Mockup Ideas' },
        { id: 12, title: 'Moodboard' },
        { id: 13, title: 'Archetypes' },
      ];

      const t = (key: string) => key; // Simple translation function
      generateBrandingPDF(brandingData, brandingData.prompt, t, defaultSteps);
      toast.success('PDF generated successfully');
    } catch (error: any) {
      console.error('Error generating PDF:', error);
      toast.error(error?.message || 'Failed to generate PDF', { duration: 5000 });
    }
  }, [nodesRef]);

  const handleStrategyNodeSave = useCallback(async (nodeId: string) => {
    const node = nodesRef.current.find(n => n.id === nodeId);
    if (!node || node.type !== 'strategy') return;

    const strategyData = node.data as any;
    const prompt = strategyData.prompt || '';
    const strategyDataContent = strategyData.strategyData || {};
    const projectId = strategyData.projectId;

    if (!prompt.trim()) {
      toast.error('Please enter a brand description', { duration: 3000 });
      return;
    }

    try {
      // Convert StrategyNodeData to BrandingData format
      const { brandingApi } = await import('../../services/brandingApi');
      const mr = strategyDataContent.marketResearch;
      const brandingData: any = {
        prompt,
        ...(mr && {
          // Support both new (string) and old (object) formats
          ...(typeof mr === 'string' 
            ? { marketResearch: mr }
            : {
                mercadoNicho: mr.mercadoNicho,
                publicoAlvo: mr.publicoAlvo,
                posicionamento: mr.posicionamento,
                insights: mr.insights,
              }
          ),
        }),
        ...(strategyDataContent.persona && {
          persona: strategyDataContent.persona,
        }),
        ...(strategyDataContent.archetypes && {
          archetypes: strategyDataContent.archetypes,
        }),
        ...(strategyDataContent.competitors && {
          competitors: strategyDataContent.competitors,
        }),
        ...(strategyDataContent.references && {
          references: strategyDataContent.references,
        }),
        ...(strategyDataContent.swot && {
          swot: strategyDataContent.swot,
        }),
        ...(strategyDataContent.colorPalettes && {
          colorPalettes: strategyDataContent.colorPalettes,
        }),
        ...(strategyDataContent.visualElements && {
          visualElements: strategyDataContent.visualElements,
        }),
        ...(strategyDataContent.mockupIdeas && {
          mockupIdeas: strategyDataContent.mockupIdeas,
        }),
        ...(strategyDataContent.moodboard && {
          moodboard: strategyDataContent.moodboard,
        }),
      };

      // Save to branding_projects table
      const savedProject = await brandingApi.save(brandingData, projectId, `Strategy Node - ${new Date().toLocaleDateString()}`);
      const savedProjectId = savedProject._id || (savedProject as any).id;

      // Update node with projectId
      updateNodeData<StrategyNodeData>(nodeId, { projectId: savedProjectId }, 'strategy');

      // Also save canvas if saveImmediately is available
      if (saveImmediately) {
        await saveImmediately();
      }

      toast.success('Strategy saved to branding project successfully');
      return savedProjectId;
    } catch (error: any) {
      console.error('Error saving strategy node:', error);
      toast.error(error?.message || 'Failed to save strategy', { duration: 5000 });
      return undefined;
    }
  }, [nodesRef, updateNodeData, saveImmediately]);

  return {
    handleStrategyNodeGenerate,
    handleStrategyNodeDataUpdate,
    handleStrategyNodeGenerateSection,
    handleStrategyNodeGenerateAll,
    handleStrategyNodeInitialAnalysis,
    handleStrategyNodeCancelGeneration,
    handleStrategyNodeGeneratePDF,
    handleStrategyNodeSave,
  };
};
