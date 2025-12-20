import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { Node, Edge } from '@xyflow/react';
import type { FlowNodeData } from '../../types/reactFlow';
import { cleanEdgeHandles } from '../../utils/canvas/canvasNodeUtils';
import { canvasApi } from '../../services/canvasApi';
import { processNodesForR2Upload } from '../../utils/canvas/processNodesForR2';
import { toast } from 'sonner';
import { useCanvasEditingState } from './useCanvasEditingState';
import { saveCanvasToLocalStorage } from '../../utils/canvas/canvasLocalStorage';
import { flushAllPendingUploads } from './utils/r2UploadUtils';

const STORAGE_KEY = 'canvas-flow-state';

// Size threshold for marking a node as oversized (in bytes of base64 data)
const OVERSIZED_THRESHOLD = 200 * 1024; // 200KB per node - large enough to cause issues when saving

export const useCanvasProject = (
  isAuthenticated: boolean | null,
  nodes: Node<FlowNodeData>[],
  edges: Edge[],
  setNodes: (nodes: Node<FlowNodeData>[] | ((prev: Node<FlowNodeData>[]) => Node<FlowNodeData>[])) => void,
  setEdges: (edges: Edge[] | ((prev: Edge[]) => Edge[])) => void
) => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [isLoadingProject, setIsLoadingProject] = useState(false);
  const [projectName, setProjectName] = useState<string>('Untitled');
  const [showMigrationModal, setShowMigrationModal] = useState(false);
  const [hasCheckedMigration, setHasCheckedMigration] = useState(false);
  const [shareId, setShareId] = useState<string | null>(null);
  const [isCollaborative, setIsCollaborative] = useState(false);
  const [canEdit, setCanEdit] = useState<string[]>([]);
  const [canView, setCanView] = useState<string[]>([]);
  const hasLoadedProject = useRef(false);
  const currentProjectIdRef = useRef<string | undefined>(undefined);
  const saveTimeoutRef = useRef<number | null>(null);
  const isSavingRef = useRef(false);
  const localStorageSaveTimeoutRef = useRef<number | null>(null);
  // Track if we've shown the oversized warning toast this session
  const hasShownOversizedWarningRef = useRef(false);

  // Detect editing state to optimize save behavior
  const { isEditing } = useCanvasEditingState({ nodes, edges });

  // Check for migration from localStorage if no ID
  useEffect(() => {
    if (!id && !hasCheckedMigration && isAuthenticated === true) {
      setHasCheckedMigration(true);
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const state = JSON.parse(saved);
          if (state.nodes && Array.isArray(state.nodes) && state.nodes.length > 0) {
            setShowMigrationModal(true);
          } else {
            navigate('/canvas');
          }
        } else {
          navigate('/canvas');
        }
      } catch (error) {
        console.error('Failed to check migration state:', error);
        navigate('/canvas');
      }
    } else if (!id && isAuthenticated === false) {
      navigate('/canvas');
    }
  }, [id, isAuthenticated, navigate, hasCheckedMigration]);

  // Handle migration modal
  const handleMigrationSave = async () => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const state = JSON.parse(saved);
        const newProject = await canvasApi.save(
          'Untitled',
          (state.nodes || []) as Node<FlowNodeData>[],
          (state.edges || []) as Edge[]
        );
        localStorage.removeItem(STORAGE_KEY);
        navigate(`/canvas/${newProject._id}`, { replace: true });
      }
      } catch (error) {
        console.error('Failed to migrate project:', error);
        toast.error('Failed to save project', { 
          id: 'migrate-project-error',
          duration: 5000 
        });
      }
  };

  const handleMigrationDiscard = () => {
    localStorage.removeItem(STORAGE_KEY);
    setShowMigrationModal(false);
    navigate('/canvas');
  };

  // Load project from backend when ID is available
  useEffect(() => {
    if (!id || !isAuthenticated) {
      setIsLoadingProject(false);
      return;
    }
    
    // Reset flag if project ID changed
    if (currentProjectIdRef.current !== id) {
      hasLoadedProject.current = false;
      currentProjectIdRef.current = id;
    }
    
    // Prevent duplicate calls
    if (hasLoadedProject.current) return;
    
    // Mark as loading immediately to prevent duplicate calls
    hasLoadedProject.current = true;
    
    const loadProject = async () => {
      setIsLoadingProject(true);
      
      
      // Add timeout to prevent infinite loading
      const timeoutId = setTimeout(() => {
        console.error('Project load timeout after 30 seconds');
        hasLoadedProject.current = false;
        setIsLoadingProject(false);
        toast.error('Timeout loading project. Please try again.', { 
          id: `load-project-timeout-${id}`,
          duration: 5000 
        });
        navigate('/canvas');
      }, 30000); // 30 second timeout
      
      try {
        const project = await canvasApi.getById(id);
        clearTimeout(timeoutId);
        
        setProjectName(project.name || 'Untitled');
        setShareId(project.shareId || null);
        setIsCollaborative(project.isCollaborative || false);
        setCanEdit(Array.isArray(project.canEdit) ? project.canEdit : []);
        setCanView(Array.isArray(project.canView) ? project.canView : []);
        
        if (project.nodes && Array.isArray(project.nodes)) {
          // Validate and fix node positions
          const validatedNodes = (project.nodes as Node<FlowNodeData>[]).map((node) => {
            if (!node.position || isNaN(node.position.x) || isNaN(node.position.y)) {
              return {
                ...node,
                position: { x: 0, y: 0 },
              };
            }
            return node;
          });
          setNodes(validatedNodes);
          
          // Validate and clean edges after nodes are set
          if (project.edges && Array.isArray(project.edges)) {
            const nodeIds = new Set(validatedNodes.map(n => n.id));
            const validatedEdges = (project.edges as Edge[])
              .filter((edge) => {
                // Filter out edges with invalid source or target
                if (!edge.source || !edge.target) return false;
                if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) return false;
                return true;
              })
              .map((edge) => cleanEdgeHandles(edge));
            setEdges(validatedEdges);
          }

          // Upload base64 images to R2 in background after project loads
          // This prevents loss of large images (especially 4K) on page reload
          if (id) {
            // Check if R2 is configured and if there are any base64 images
            const hasBase64Images = validatedNodes.some((node) => {
              const nodeData = node.data as any;
              return (
                (nodeData.type === 'upscale' && nodeData.resultImageBase64) ||
                (nodeData.type === 'merge' && nodeData.resultImageBase64) ||
                (nodeData.type === 'edit' && nodeData.resultImageBase64) ||
                (nodeData.type === 'mockup' && nodeData.resultImageBase64) ||
                (nodeData.type === 'prompt' && nodeData.resultImageBase64) ||
                (nodeData.type === 'output' && nodeData.resultImageBase64) ||
                (nodeData.type === 'image' && nodeData.mockup?.imageBase64)
              );
            });

            if (hasBase64Images) {
              // Upload in background without blocking UI
              canvasApi.checkR2Status().then((r2Status) => {
                if (r2Status.configured) {
                  console.log('[useCanvasProject] Uploading base64 images to R2 in background...');
                  processNodesForR2Upload(validatedNodes, id, () => {})
                    .then((result) => {
                      if (result.uploadedCount > 0) {
                        console.log(`[useCanvasProject] Uploaded ${result.uploadedCount} image(s) to R2`);
                        // Update nodes with R2 URLs (only update nodes that were actually modified)
                        setNodes((currentNodes) => {
                          // Create a map of processed nodes by ID for quick lookup
                          const processedMap = new Map(
                            result.processedNodes.map((node) => [node.id, node])
                          );
                          // Update only nodes that were processed and have R2 URLs
                          return currentNodes.map((node) => {
                            const processedNode = processedMap.get(node.id);
                            if (processedNode) {
                              const nodeData = node.data as any;
                              const processedData = processedNode.data as any;
                              // Only update if R2 URL was added (base64 was removed)
                              if (
                                (processedData.resultImageUrl && !nodeData.resultImageUrl) ||
                                (processedData.mockup?.imageUrl && !nodeData.mockup?.imageUrl)
                              ) {
                                return processedNode;
                              }
                            }
                            return node;
                          });
                        });
                      }
                    })
                    .catch((error) => {
                      console.warn('[useCanvasProject] Failed to upload some images to R2:', error);
                      // Silently fail - base64 will remain as fallback
                    });
                }
              });
            }
          }
        } else if (project.edges && Array.isArray(project.edges)) {
          // If no nodes, still validate edges but they'll be filtered out if source/target don't exist
          const validatedEdges = (project.edges as Edge[])
            .map((edge) => cleanEdgeHandles(edge));
          setEdges(validatedEdges);
        }
      } catch (error: any) {
        clearTimeout(timeoutId);
        console.error('Failed to load project:', error);
        // Reset flag on error so it can retry if needed
        hasLoadedProject.current = false;
        // Use unique ID to prevent duplicate toasts
        const errorMessage = error?.status === 404 
          ? 'Project not found' 
          : error?.message || 'Failed to load project';
        toast.error(errorMessage, { 
          id: `load-project-error-${id}`,
          duration: 5000 
        });
        navigate('/canvas');
      } finally {
        setIsLoadingProject(false);
      }
    };

    loadProject();
  }, [id, isAuthenticated, setNodes, setEdges, navigate]);

  // Save to localStorage during active editing (fast, non-blocking)
  useEffect(() => {
    if (!id || !isAuthenticated || !hasLoadedProject.current) return;
    if (nodes.length === 0 && edges.length === 0) return;

    // Clear previous timeout
    if (localStorageSaveTimeoutRef.current) {
      clearTimeout(localStorageSaveTimeoutRef.current);
    }

    // Save to localStorage with short debounce during editing
    localStorageSaveTimeoutRef.current = window.setTimeout(() => {
      saveCanvasToLocalStorage(id, nodes, edges, projectName);
    }, 500); // 500ms debounce for localStorage (very fast)

    return () => {
      if (localStorageSaveTimeoutRef.current) {
        clearTimeout(localStorageSaveTimeoutRef.current);
      }
    };
  }, [id, isAuthenticated, nodes, edges, projectName, isEditing]);

  // Save flow state to backend (debounced, longer delay during editing)
  useEffect(() => {
    if (!id || !isAuthenticated || isSavingRef.current) return;
    if (!hasLoadedProject.current && nodes.length === 0 && edges.length === 0) return;
    
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    // Use longer debounce during active editing to avoid blocking WebGL rendering
    const debounceDelay = isEditing ? 10000 : 2000; // 10s during editing, 2s otherwise
    
    saveTimeoutRef.current = window.setTimeout(async () => {
      // Flush all pending R2 uploads before saving to database
      // This ensures all shader results are uploaded when user stops editing
      if (!isEditing) {
        try {
          await flushAllPendingUploads();
        } catch (error) {
          console.warn('Failed to flush pending uploads:', error);
          // Continue with save even if flush fails
        }
      }
      try {
        isSavingRef.current = true;
        
        // Clean edges before saving: remove null or "null" string from sourceHandle/targetHandle
        const cleanedEdges = edges.map((edge) => cleanEdgeHandles(edge));
        
        // During active editing, skip R2 processing to avoid blocking WebGL
        // Only process nodes for R2 when user stops editing
        if (isEditing) {
          // Just save current state (with base64) - R2 processing will happen when editing stops
          await canvasApi.save(projectName, nodes, cleanedEdges, id);
          // Also update localStorage
          saveCanvasToLocalStorage(id, nodes, edges, projectName);
          isSavingRef.current = false;
          return;
        }
        
        // Check R2 status and process nodes proactively if needed
        let nodesToSave = nodes;
        const r2Status = await canvasApi.checkR2Status();
        const WARNING_SIZE = 10 * 1024 * 1024; // 10MB warning threshold
        const MAX_SIZE = 15 * 1024 * 1024; // 15MB max (MongoDB limit is 16MB)
        const VERCEL_LIMIT = 50 * 1024 * 1024; // 50MB Vercel Pro serverless function limit
        
        // Estimate initial payload size
        let payloadEstimate = {
          name: projectName || 'Untitled',
          nodes: nodesToSave,
          edges: cleanedEdges,
        };
        let estimatedSize = JSON.stringify(payloadEstimate).length;
        
        // If payload exceeds Vercel limit, process nodes immediately (even if below MongoDB limit)
        if (estimatedSize > VERCEL_LIMIT && r2Status.configured && id) {
          const progressToastId = `r2-upload-progress-${id}`;
          
          try {
            toast.loading('Otimizando imagens para evitar erro de tamanho...', {
              id: progressToastId,
              duration: Infinity,
            });
            
            const result = await processNodesForR2Upload(
              nodes,
              id,
              (current, total) => {
                if (total > 0) {
                  toast.loading(`Otimizando imagens... ${current} de ${total}`, {
                    id: progressToastId,
                    duration: Infinity,
                  });
                }
              }
            );
            
            nodesToSave = result.processedNodes;
            
            if (result.uploadedCount > 0) {
              setNodes(nodesToSave);
            }
            
            payloadEstimate = {
              name: projectName || 'Untitled',
              nodes: nodesToSave,
              edges: cleanedEdges,
            };
            estimatedSize = JSON.stringify(payloadEstimate).length;
            
            toast.dismiss(progressToastId);
            
            if (result.uploadedCount > 0 && result.failedCount === 0) {
              toast.success(`${result.uploadedCount} imagem(ns) otimizada(s)`, {
                duration: 3000,
              });
            } else if (result.failedCount > 0) {
              toast.warning(
                `${result.failedCount} imagem(ns) não puderam ser otimizadas.`,
                {
                  duration: 4000,
                }
              );
            }
          } catch (processError: any) {
            console.error('Error processing nodes for R2:', processError);
            toast.dismiss(progressToastId);
            toast.warning('Não foi possível otimizar algumas imagens.', {
              duration: 4000,
            });
            nodesToSave = nodes;
          }
        }
        
        // If payload is large and R2 is configured, process nodes proactively
        if (estimatedSize > WARNING_SIZE && r2Status.configured && id && estimatedSize <= VERCEL_LIMIT) {
          const progressToastId = `r2-upload-progress-${id}`;
          
          try {
            // Show initial loading toast
            toast.loading('Otimizando imagens para salvar...', {
              id: progressToastId,
              duration: Infinity,
            });
            
            // Process nodes with progress callback
            const result = await processNodesForR2Upload(
              nodes,
              id,
              (current, total) => {
                if (total > 0) {
                  toast.loading(`Otimizando imagens... ${current} de ${total}`, {
                    id: progressToastId,
                    duration: Infinity,
                  });
                }
              }
            );
            
            nodesToSave = result.processedNodes;
            
            // Update nodes in state if uploads were successful
            if (result.uploadedCount > 0) {
              setNodes(nodesToSave);
            }
            
            // Recalculate payload size after processing
            payloadEstimate = {
              name: projectName || 'Untitled',
              nodes: nodesToSave,
              edges: cleanedEdges,
            };
            estimatedSize = JSON.stringify(payloadEstimate).length;
            
            // Dismiss progress toast
            toast.dismiss(progressToastId);
            
            // Show success/warning messages
            if (result.uploadedCount > 0 && result.failedCount === 0) {
              toast.success(`${result.uploadedCount} imagem(ns) otimizada(s) com sucesso`, {
                duration: 3000,
              });
            } else if (result.uploadedCount > 0 && result.failedCount > 0) {
              toast.warning(
                `${result.uploadedCount} otimizada(s), ${result.failedCount} falharam. Tentando salvar mesmo assim...`,
                {
                  duration: 4000,
                }
              );
            } else if (result.failedCount > 0) {
              toast.warning(
                `${result.failedCount} imagem(ns) não puderam ser otimizadas. Tentando salvar mesmo assim...`,
                {
                  duration: 4000,
                }
              );
            }
          } catch (processError: any) {
            console.error('Error processing nodes for R2:', processError);
            toast.dismiss(progressToastId);
            
            // Show error but continue with original nodes (fallback)
            toast.warning(
              'Não foi possível otimizar algumas imagens. Tentando salvar mesmo assim...',
              {
                duration: 4000,
              }
            );
            // Continue with original nodes if processing fails
            nodesToSave = nodes;
          }
        }
        
        // Check final payload size and show user-friendly warning if needed
        const sizeMB = (estimatedSize / 1024 / 1024).toFixed(2);
        
        // Always check and mark oversized nodes (regardless of total project size)
        const oversizedWarningMessage = `Imagem muito grande para salvar. Reduza a resolução ou número de imagens no canvas.`;
        setNodes((currentNodes) => {
          let hasChanges = false;
          const updatedNodes = currentNodes.map((node) => {
            const nodeData = node.data as any;
            let nodeSize = 0;
            
            // Helper to calculate base64 string size (only count if it's actually base64, not URL)
            const addSizeIfBase64 = (value: any) => {
              if (!value || typeof value !== 'string') return;
              // Check if it's base64:
              // 1. Starts with data: (data URL)
              // 2. Is a long string that doesn't start with http/https (likely base64)
              // 3. Contains base64-like characters (A-Z, a-z, 0-9, +, /, =)
              const isDataUrl = value.startsWith('data:');
              const isUrl = value.startsWith('http://') || value.startsWith('https://');
              const looksLikeBase64 = value.length > 100 && !isUrl && /^[A-Za-z0-9+/=]+$/.test(value.replace(/\s/g, ''));
              
              if (isDataUrl || looksLikeBase64) {
                nodeSize += value.length;
              }
            };
            
            // Calculate size of this node's content - check all possible image fields
            addSizeIfBase64(nodeData.resultImageBase64);
            addSizeIfBase64(nodeData.imageBase64);
            addSizeIfBase64(nodeData.connectedImage);
            addSizeIfBase64(nodeData.connectedLogo);
            addSizeIfBase64(nodeData.connectedIdentity);
            addSizeIfBase64(nodeData.connectedImage1);
            addSizeIfBase64(nodeData.connectedImage2);
            addSizeIfBase64(nodeData.connectedImage3);
            addSizeIfBase64(nodeData.connectedImage4);
            addSizeIfBase64(nodeData.logoBase64);
            addSizeIfBase64(nodeData.logoImage);
            addSizeIfBase64(nodeData.pdfBase64);
            addSizeIfBase64(nodeData.identityPdfBase64);
            addSizeIfBase64(nodeData.identityImageBase64);
            addSizeIfBase64(nodeData.mockup?.imageBase64);
            
            // Check connectedImages array
            if (Array.isArray(nodeData.connectedImages)) {
              nodeData.connectedImages.forEach((img: any) => addSizeIfBase64(img));
            }
            
              // Mark as oversized if above threshold
              const isOversized = nodeSize > OVERSIZED_THRESHOLD;
              const currentWarning = nodeData.oversizedWarning;
              
              // Debug log
              if (nodeSize > 0) {
                console.log(`[Oversized Check] Node ${node.id} (${node.type}): ${(nodeSize / 1024).toFixed(2)}KB, threshold: ${(OVERSIZED_THRESHOLD / 1024).toFixed(2)}KB, isOversized: ${isOversized}`);
              }
              
              if (isOversized && !currentWarning) {
                console.log(`[Oversized Warning] Adding warning to node ${node.id}`);
                hasChanges = true;
                return {
                  ...node,
                  data: {
                    ...nodeData,
                    oversizedWarning: oversizedWarningMessage,
                  },
                };
              } else if (!isOversized && currentWarning) {
              // Clear warning if no longer oversized
              hasChanges = true;
              return {
                ...node,
                data: {
                  ...nodeData,
                  oversizedWarning: undefined,
                },
              };
            }
            
            return node;
          });
          
          return hasChanges ? updatedNodes : currentNodes;
        });
        
        if (estimatedSize > VERCEL_LIMIT) {
          // Vercel limit exceeded - this will cause 413 error
          // Only show toast once per session (never reset)
          if (!hasShownOversizedWarningRef.current) {
            hasShownOversizedWarningRef.current = true;
            const warningMessage = !r2Status.configured
              ? `Seu projeto está muito grande (${sizeMB}MB) para salvar. ` +
                `Configure o armazenamento R2 nas configurações do sistema para salvar projetos grandes.`
              : `Seu projeto ainda está muito grande (${sizeMB}MB) mesmo após otimização. ` +
                `Por favor, reduza o número de imagens ou elementos no canvas.`;
            toast.error(warningMessage, { 
              id: `payload-too-large-warning-global`,
              duration: 8000 
            });
          }
          // Still try to save - the API will handle the error and return a better message
        } else if (estimatedSize > MAX_SIZE) {
          // MongoDB limit exceeded - show toast only once per session (never reset)
          if (!hasShownOversizedWarningRef.current) {
            hasShownOversizedWarningRef.current = true;
            toast.error(
              `Seu projeto está muito grande (${sizeMB}MB) para salvar no banco de dados. ` +
              `Por favor, reduza o número de imagens no canvas.`,
              { 
                id: `payload-too-large-warning-global`,
                duration: 8000 
              }
            );
          }
        } else if (estimatedSize > WARNING_SIZE) {
          console.warn(`Payload size (${sizeMB}MB) is large, approaching limit`);
        } else {
          // Clear oversized warnings if project is now within limits
          setNodes((currentNodes) => {
            let hasChanges = false;
            const updatedNodes = currentNodes.map((node) => {
              const nodeData = node.data as any;
              if (nodeData.oversizedWarning) {
                hasChanges = true;
                return {
                  ...node,
                  data: {
                    ...nodeData,
                    oversizedWarning: undefined,
                  },
                };
              }
              return node;
            });
            return hasChanges ? updatedNodes : currentNodes;
          });
          // Don't reset warning flag - keep it true so toast only shows once per session
        }
        
        await canvasApi.save(projectName, nodesToSave, cleanedEdges, id);
        // Also save to localStorage (will clean base64 automatically)
        saveCanvasToLocalStorage(id, nodesToSave, cleanedEdges, projectName);
      } catch (error: any) {
        console.error('Failed to save project:', error);
        
        // Show user-friendly error message
        let errorMessage = 'Falha ao salvar projeto';
        if (error?.message) {
          errorMessage = error.message;
        } else if (error?.status === 413 || error?.status === 400) {
          // 413 is Payload Too Large, 400 might also indicate size issues
          if (error?.message?.toLowerCase().includes('payload') || error?.message?.toLowerCase().includes('request entity too large') || error?.status === 413) {
            errorMessage = 'Projeto muito grande para salvar. ' +
              'O limite é 50MB (Vercel Pro). ' +
              'Tente reduzir o número de imagens ou configure o R2 nas configurações do sistema.';
          } else {
            errorMessage = 'Não foi possível salvar. Verifique se o projeto não está muito grande.';
          }
        } else if (error?.status === 401) {
          errorMessage = 'Sessão expirada. Por favor, faça login novamente.';
        } else if (error?.status === 500) {
          errorMessage = 'Erro no servidor. Tente novamente em alguns instantes.';
        }
        
        toast.error(errorMessage, { 
          id: `save-project-error-${id}`,
          duration: 6000 
        });
      } finally {
        isSavingRef.current = false;
      }
    }, debounceDelay); // Dynamic debounce: 10s during editing, 2s otherwise

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [id, isAuthenticated, nodes, edges, projectName, isEditing]);

  // Immediate save function (bypasses debounce) - useful for critical saves
  const saveImmediately = useCallback(async () => {
    if (!id || !isAuthenticated || !hasLoadedProject.current) return;

    // Clear any pending debounced save
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }

    // Skip if already saving
    if (isSavingRef.current) return;

    try {
      isSavingRef.current = true;

      // Clean edges before saving
      const cleanedEdges = edges.map((edge) => cleanEdgeHandles(edge));

      // Check R2 and process nodes if needed (same logic as debounced save)
      let nodesToSave = nodes;
      const r2Status = await canvasApi.checkR2Status();
      const WARNING_SIZE = 10 * 1024 * 1024;
      const VERCEL_LIMIT = 50 * 1024 * 1024; // 50MB Vercel Pro
      
      let payloadEstimate = {
        name: projectName || 'Untitled',
        nodes: nodesToSave,
        edges: cleanedEdges,
      };
      let estimatedSize = JSON.stringify(payloadEstimate).length;
      
      // Process nodes if payload exceeds limits
      if ((estimatedSize > VERCEL_LIMIT || estimatedSize > WARNING_SIZE) && r2Status.configured && id) {
        try {
          const result = await processNodesForR2Upload(nodes, id, () => {});
          nodesToSave = result.processedNodes;
          if (result.uploadedCount > 0) {
            setNodes(nodesToSave);
          }
          
          // Recalculate size after processing
          payloadEstimate = {
            name: projectName || 'Untitled',
            nodes: nodesToSave,
            edges: cleanedEdges,
          };
          estimatedSize = JSON.stringify(payloadEstimate).length;
        } catch (processError) {
          console.error('Error processing nodes for R2 in immediate save:', processError);
          // Continue with original nodes
        }
      }

      await canvasApi.save(projectName, nodesToSave, cleanedEdges, id);
    } catch (error: any) {
      console.error('Failed to save project immediately:', error);
      
      let errorMessage = 'Falha ao salvar projeto';
      if (error?.message) {
        errorMessage = error.message;
      }
      
      toast.error(errorMessage, { 
        id: `save-project-error-${id}`,
        duration: 5000 
      });
      throw error; // Re-throw so caller can handle it
    } finally {
      isSavingRef.current = false;
    }
  }, [id, isAuthenticated, nodes, edges, projectName, setNodes]);

  return {
    isLoadingProject,
    projectName,
    setProjectName,
    showMigrationModal,
    handleMigrationSave,
    handleMigrationDiscard,
    projectId: id || undefined,
    saveImmediately,
    shareId,
    isCollaborative,
    canEdit,
    canView,
    setShareId,
    setIsCollaborative,
    setCanEdit,
    setCanView,
  };
};



