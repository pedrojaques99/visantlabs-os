import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { GridDotsBackground } from '../components/ui/GridDotsBackground';
import { SkeletonLoader } from '../components/ui/SkeletonLoader';
import { canvasApi, type CanvasProject } from '../services/canvasApi';
import { useLayout } from '../hooks/useLayout';
import { usePremiumAccess } from '../hooks/usePremiumAccess';
import { AuthModal } from '../components/AuthModal';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { BreadcrumbWithBack, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbPage, BreadcrumbSeparator } from '../components/ui/BreadcrumbWithBack';
import { toast } from 'sonner';
import { FolderKanban, Calendar, Eye, Trash2, Plus, Pickaxe, FolderOpen } from 'lucide-react';
import { SEO } from '../components/SEO';
import { useTranslation } from '../hooks/useTranslation';
import { useDebouncedCallback } from '../hooks/useDebouncedCallback';
import type { Node } from '@xyflow/react';
import type { FlowNodeData, OutputNodeData, ImageNodeData } from '../types/reactFlow';
import { getImageUrl } from '../utils/imageUtils';
import { isLocalDevelopment } from '../utils/env';
import { WorkflowLibraryModal } from '../components/WorkflowLibraryModal';
import { workflowApi, type CanvasWorkflow } from '../services/workflowApi';

// Helper function to get project thumbnail
const getProjectThumbnail = (project: CanvasProject): string | null => {
  if (!project.nodes || !Array.isArray(project.nodes)) return null;

  const nodes = project.nodes as Node<FlowNodeData>[];

  // Priority: OutputNode > ImageNode > other nodes with images
  // First, try to find an OutputNode
  const outputNode = nodes.find(n => n.type === 'output') as Node<OutputNodeData> | undefined;
  if (outputNode) {
    const outputData = outputNode.data as OutputNodeData;
    if (outputData.resultImageUrl) return outputData.resultImageUrl;
    if (outputData.resultImageBase64) {
      return outputData.resultImageBase64.startsWith('data:')
        ? outputData.resultImageBase64
        : `data:image/png;base64,${outputData.resultImageBase64}`;
    }
  }

  // Second, try to find an ImageNode
  const imageNode = nodes.find(n => n.type === 'image') as Node<ImageNodeData> | undefined;
  if (imageNode) {
    const imageData = imageNode.data as ImageNodeData;
    if (imageData.mockup) {
      const imageUrl = getImageUrl(imageData.mockup);
      if (imageUrl) return imageUrl;
      if (imageData.mockup.imageBase64) {
        return imageData.mockup.imageBase64.startsWith('data:')
          ? imageData.mockup.imageBase64
          : `data:image/png;base64,${imageData.mockup.imageBase64}`;
      }
    }
  }

  // Third, try to find any node with resultImageUrl or resultImageBase64
  for (const node of nodes) {
    const nodeData = node.data as any;
    if (nodeData.resultImageUrl) return nodeData.resultImageUrl;
    if (nodeData.resultImageBase64) {
      return nodeData.resultImageBase64.startsWith('data:')
        ? nodeData.resultImageBase64
        : `data:image/png;base64,${nodeData.resultImageBase64}`;
    }
  }

  return null;
};

export const CanvasProjectsPage: React.FC = () => {
  const { t, locale } = useTranslation();
  const navigate = useNavigate();
  const { isAuthenticated } = useLayout();
  const { hasAccess, isLoading: isLoadingAccess } = usePremiumAccess();
  const [projects, setProjects] = useState<CanvasProject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<string | null>(null);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState<string>('');
  const editingInputRef = useRef<HTMLInputElement>(null);
  const hasLoadedProjectsRef = useRef(false);

  const isLoadingRef = useRef(false);
  const [showWorkflowLibrary, setShowWorkflowLibrary] = useState(false);

  // Placeholder/Check for admin status if needed, or pass false
  const [isAdmin, setIsAdmin] = useState(false);

  const handleLoadWorkflow = async (workflow: CanvasWorkflow) => {
    try {
      if (!isAuthenticated) {
        toast.error(t('workflows.errors.mustBeAuthenticated') || 'You must be logged in');
        return;
      }

      // Create a new project from this workflow
      const newProject = await canvasApi.save(
        workflow.name,
        workflow.nodes,
        workflow.edges
      );

      toast.success(t('workflows.messages.loaded', { name: workflow.name }) || `Workflow loaded: ${workflow.name}`);
      navigate(`/canvas/${newProject._id}`);
    } catch (error) {
      console.error('Failed to load workflow:', error);
      toast.error(t('workflows.errors.failedToLoad') || 'Failed to load workflow');
    }
  };

  // Redirect to waitlist if user doesn't have premium access
  useEffect(() => {
    if (!isLoadingAccess && !hasAccess) {
      navigate('/waitlist', { replace: true });
    }
  }, [hasAccess, isLoadingAccess, navigate]);

  const loadProjects = useCallback(async () => {
    // Prevent multiple simultaneous calls
    if (isLoadingRef.current) {
      console.log('[CanvasProjects] ⚠️ Already loading, skipping...');
      return;
    }

    console.log('[CanvasProjects] 📥 Loading projects...');
    isLoadingRef.current = true;
    setIsLoading(true);
    try {
      const data = await canvasApi.getAll();
      console.log('[CanvasProjects] ✅ Projects loaded successfully:', {
        count: data.length,
        projects: data.map(p => ({ id: p._id, name: p.name, isCollaborative: p.isCollaborative }))
      });
      setProjects(data);
      hasLoadedProjectsRef.current = true;
    } catch (error: any) {
      console.error('[CanvasProjects] ❌ Error loading canvas projects:', {
        error,
        status: error?.status,
        message: error?.message,
        stack: error?.stack
      });
      if (error?.status === 401) {
        console.log('[CanvasProjects] 🔐 Unauthorized - showing auth modal');
        setShowAuthModal(true);
      } else {
        toast.error(t('canvas.failedToLoadProjects') || 'Failed to load canvas projects');
      }
    } finally {
      isLoadingRef.current = false;
      setIsLoading(false);
      console.log('[CanvasProjects] ⏸️ Loading finished');
    }
  }, []);

  // Debounce the auth handling to give time for MongoDB/Auth to settle.
  // This prevents the "limbo" state where the user might see the auth modal 
  // or an empty state while the backend is still warming up.
  const handleAuthAction = useDebouncedCallback((auth: boolean | null) => {
    if (auth === null) return;

    // Skip if already loaded or currently loading
    if (hasLoadedProjectsRef.current || isLoadingRef.current) {
      return;
    }

    console.log('[CanvasProjects] 🔄 Auth action (debounced):', auth);
    if (auth === false) {
      console.log('[CanvasProjects] 🔐 Not authenticated - showing auth modal');
      setShowAuthModal(true);
    } else if (auth === true) {
      console.log('[CanvasProjects] ✅ Authenticated - loading projects');
      loadProjects();
    }
  }, 200); // 200ms debounce delay

  useEffect(() => {
    handleAuthAction(isAuthenticated);
  }, [isAuthenticated, handleAuthAction]);

  const handleView = (project: CanvasProject) => {
    if (isLocalDevelopment()) {
      console.log('[CanvasProjects] 👁️ Viewing project:', {
        id: project._id,
        name: project.name,
        isCollaborative: project.isCollaborative,
        nodeCount: Array.isArray(project.nodes) ? project.nodes.length : 0,
        edgeCount: Array.isArray(project.edges) ? project.edges.length : 0,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
        timestamp: new Date().toISOString()
      });
    }

    if (project._id && project._id.trim() !== '') {
      if (isLocalDevelopment()) {
        console.log('[CanvasProjects] 🚀 Navigating to canvas page:', {
          url: `/canvas/${project._id}`,
          projectId: project._id,
          timestamp: new Date().toISOString()
        });
      }
      navigate(`/canvas/${project._id}`);
    } else {
      if (isLocalDevelopment()) {
        console.error('[CanvasProjects] ❌ Invalid project ID:', {
          projectId: project._id,
          project: project,
          timestamp: new Date().toISOString()
        });
      }
      toast.error(t('canvas.invalidProjectId') || 'Invalid project ID');
    }
  };

  const handleCreateNew = async () => {
    console.log('[CanvasProjects] ➕ Creating new project...');
    try {
      const newProject = await canvasApi.save('Untitled', [], []);
      console.log('[CanvasProjects] ✅ New project created:', {
        id: newProject._id,
        name: newProject.name
      });
      navigate(`/canvas/${newProject._id}`);
    } catch (error: any) {
      console.error('[CanvasProjects] ❌ Error creating project:', {
        error,
        status: error?.status,
        message: error?.message
      });
      toast.error(t('canvas.failedToCreateProject') || 'Failed to create new project');
    }
  };

  const handleDeleteClick = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setProjectToDelete(id);
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    if (!projectToDelete) return;

    setDeletingId(projectToDelete);
    try {
      await canvasApi.delete(projectToDelete);
      setProjects(prev => prev.filter(p => p._id !== projectToDelete));
      toast.success(t('canvas.projectDeletedSuccessfully') || 'Project deleted successfully');
    } catch (error: any) {
      console.error('Error deleting project:', error);
      toast.error(t('canvas.failedToDeleteProject') || 'Failed to delete project');
    } finally {
      setDeletingId(null);
      setProjectToDelete(null);
      setShowDeleteModal(false);
    }
  };

  const handleNameEditStart = (project: CanvasProject, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingProjectId(project._id);
    setEditingName(project.name || 'Untitled');
    setTimeout(() => {
      editingInputRef.current?.focus();
      editingInputRef.current?.select();
    }, 0);
  };

  const handleNameEditSave = async (projectId: string) => {
    if (!editingName.trim()) {
      setEditingName('');
      setEditingProjectId(null);
      return;
    }

    const project = projects.find(p => p._id === projectId);
    if (!project) return;

    const trimmedName = editingName.trim();
    if (trimmedName === project.name) {
      setEditingProjectId(null);
      setEditingName('');
      return;
    }

    try {
      // Update project name using save method (it updates if projectId exists)
      await canvasApi.save(trimmedName, project.nodes, project.edges, projectId);
      setProjects(prev => prev.map(p =>
        p._id === projectId ? { ...p, name: trimmedName } : p
      ));
      toast.success(t('canvas.projectNameUpdated'), { duration: 1200 });
    } catch (error: any) {
      console.error('Error updating project name:', error);
      toast.error(t('canvas.failedToUpdateProjectName') || 'Failed to update project name');
    } finally {
      setEditingProjectId(null);
      setEditingName('');
    }
  };

  const handleNameEditCancel = () => {
    setEditingProjectId(null);
    setEditingName('');
  };

  const handleNameEditKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, projectId: string) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur();
    } else if (e.key === 'Escape') {
      handleNameEditCancel();
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Show loading state while checking access
  if (isLoadingAccess || isLoading) {
    return (
      <div className="min-h-screen bg-[#121212] text-zinc-300 pt-14 relative overflow-hidden">
        <div className="fixed inset-0 z-0">
          <GridDotsBackground />
        </div>
        <div className="max-w-[1800px] mx-auto px-4 md:px-6 py-4 md:py-6 relative z-10">
          {/* Header Skeleton */}
          <div className="mb-4">
            <SkeletonLoader height="1.25rem" className="w-48" />
          </div>
          <div className="flex items-start gap-4 mb-6">
            <div className="flex-1">
              <SkeletonLoader height="2.5rem" className="w-48 mb-2" />
              <SkeletonLoader height="1rem" className="w-24" />
            </div>
            <SkeletonLoader height="2.5rem" className="w-36 rounded-md" />
          </div>

          {/* Grid Skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="bg-[#141414] border border-zinc-800/60 rounded-2xl p-6 md:p-8"
                style={{ animationDelay: `${i * 100}ms` }}
              >
                {/* Thumbnail Skeleton */}
                <SkeletonLoader height="12rem" className="w-full rounded-md mb-4" />

                {/* Title Row */}
                <div className="flex items-center gap-2 mb-2">
                  <SkeletonLoader height="1.25rem" className="w-5 rounded" />
                  <SkeletonLoader height="1.5rem" className="flex-1" />
                </div>

                {/* Date Row */}
                <div className="flex items-center gap-2 mb-4">
                  <SkeletonLoader height="0.875rem" className="w-3.5 rounded" />
                  <SkeletonLoader height="0.875rem" className="w-24" />
                </div>

                {/* Stats Row */}
                <div className="flex items-center gap-4 mb-4">
                  <SkeletonLoader height="0.75rem" className="w-16" />
                  <SkeletonLoader height="0.75rem" className="w-16" />
                </div>

                {/* Buttons Row */}
                <div className="flex items-center gap-2">
                  <SkeletonLoader height="2.5rem" className="flex-1 rounded-md" />
                  <SkeletonLoader height="2.5rem" className="w-12 rounded-xl" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Don't render content if redirecting
  if (!hasAccess) {
    return null;
  }

  return (
    <>
      <SEO
        title={t('canvas.seoTitle') || 'Canvas Editor'}
        description={t('canvas.seoDescription') || 'Editor visual baseado em fluxos para criação de designs. Colabore em tempo real e crie projetos visuais profissionais.'}
        keywords={t('canvas.seoKeywords') || 'canvas editor, editor visual, design editor, colaboração, visual flow editor'}
        noindex={true}
      />
      <div className="min-h-screen bg-[#121212] text-zinc-300 pt-14 relative overflow-hidden">
        <div className="fixed inset-0 z-0">
          <GridDotsBackground />
        </div>
        <div className="max-w-[1800px] mx-auto px-4 md:px-6 py-4 md:py-6 relative z-10">
          {/* Header */}
          <div className="mb-4">
            <BreadcrumbWithBack to="/canvas">
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <Link to="/">{t('apps.home')}</Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <Link to="/canvas">{t('canvas.title') || 'Canvas'}</Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>{t('canvas.projects') || 'Projects'}</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </BreadcrumbWithBack>
          </div>
          <div className="flex items-start gap-4 mb-6">
            <div className="flex-1">
              <h1 className="text-3xl md:text-4xl font-semibold font-manrope text-zinc-300 mb-2">
                {t('canvas.projects') || 'Projects'}
              </h1>
              <p className="text-zinc-500 font-mono text-sm md:text-base">
                {projects.length === 0
                  ? (t('canvas.noProjectsYet') || 'No projects yet')
                  : (() => {
                    const count = projects.length;
                    const isSingular = count === 1;
                    if (locale === 'pt-BR') {
                      return `${count} ${isSingular ? 'projeto' : 'projetos'}`;
                    } else {
                      return `${count} ${isSingular ? 'project' : 'projects'}`;
                    }
                  })()}
              </p>
            </div>
            <button
              onClick={handleCreateNew}
              className="px-4 py-2 bg-brand-cyan/90 hover:bg-brand-cyan text-black font-semibold rounded-md text-sm font-mono transition-all duration-300 hover:scale-[1.02] active:scale-95 flex items-center gap-2 flex-shrink-0"
            >
              <Plus className="h-4 w-4" />
              {t('canvas.newProject') || 'New Project'}
            </button>
            <button
              onClick={() => setShowWorkflowLibrary(true)}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 hover:border-zinc-600 font-semibold rounded-md text-sm font-mono transition-all duration-300 hover:scale-[1.02] active:scale-95 flex items-center gap-2 flex-shrink-0"
            >
              <FolderOpen className="h-4 w-4" />
              {t('workflows.loadWorkflow') || 'Import'}
            </button>
          </div>

          {/* Projects Grid */}
          {projects.length === 0 ? (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
              <FolderKanban size={64} className="text-zinc-700 mb-4" strokeWidth={1} />
              <h2 className="text-xl font-semibold font-mono uppercase text-zinc-500 mb-2">
                {t('canvas.noProjectsYet')?.toUpperCase() || 'NO PROJECTS YET'}
              </h2>
              <p className="text-sm text-zinc-600 font-mono mb-6">
                {t('canvas.createFirstProject') || 'Create your first canvas project to start working with nodes.'}
              </p>
              <button
                onClick={handleCreateNew}
                className="px-6 py-3 bg-brand-cyan/90 hover:bg-brand-cyan text-black font-semibold rounded-md text-sm font-mono transition-all duration-300 hover:scale-[1.02] active:scale-95 flex items-center gap-2"
              >
                <Pickaxe className="h-4 w-4" />
                {t('canvas.createFirstProjectButton') || 'Create Your First Project'}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              {projects.map((project) => {
                const nodeCount = Array.isArray(project.nodes) ? project.nodes.length : 0;
                const edgeCount = Array.isArray(project.edges) ? project.edges.length : 0;

                return (
                  <div
                    key={project._id}
                    className="bg-[#141414] border border-zinc-800/60 rounded-2xl p-6 md:p-8 hover:border-zinc-700/60 transition-all duration-300 group cursor-pointer overflow-hidden"
                    onClick={() => {
                      if (editingProjectId !== project._id) {
                        handleView(project);
                      }
                    }}
                  >
                    {/* Thumbnail Preview */}
                    {(() => {
                      const thumbnail = getProjectThumbnail(project);
                      return thumbnail ? (
                        <div className="w-full h-48 mb-4 rounded-md overflow-hidden bg-zinc-900/50 border border-zinc-800/60">
                          <img
                            src={thumbnail}
                            alt={project.name || 'Project preview'}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              // Hide image on error
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        </div>
                      ) : (
                        <div className="w-full h-48 mb-4 rounded-md bg-zinc-900/50 border border-zinc-800/60 flex items-center justify-center">
                          <FolderKanban className="h-12 w-12 text-zinc-700" strokeWidth={1} />
                        </div>
                      );
                    })()}

                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <FolderKanban className="h-5 w-5 text-brand-cyan flex-shrink-0" />
                          {editingProjectId === project._id ? (
                            <input
                              ref={editingInputRef}
                              type="text"
                              value={editingName}
                              onChange={(e) => setEditingName(e.target.value)}
                              onBlur={() => handleNameEditSave(project._id)}
                              onKeyDown={(e) => handleNameEditKeyDown(e, project._id)}
                              onClick={(e) => e.stopPropagation()}
                              className="flex-1 font-semibold text-zinc-200 font-manrope text-lg bg-transparent border-b border-zinc-600 focus:border-brand-cyan focus:outline-none px-1"
                            />
                          ) : (
                            <h3
                              className="font-semibold text-zinc-200 font-manrope text-lg line-clamp-2 cursor-text hover:text-brand-cyan transition-colors"
                              onClick={(e) => handleNameEditStart(project, e)}
                              title={t('canvas.clickToEdit') || 'Click to edit'}
                            >
                              {project.name || t('canvas.untitled') || 'Untitled'}
                            </h3>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-zinc-400 font-mono mb-3">
                          <Calendar className="h-3.5 w-3.5" />
                          <span>{formatDate(project.createdAt)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-xs text-zinc-500 font-mono mb-4">
                      <span>{nodeCount} {nodeCount === 1 ? 'node' : 'nodes'}</span>
                      <span>•</span>
                      <span>{edgeCount} {edgeCount === 1 ? 'edge' : 'edges'}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleView(project);
                        }}
                        className="flex-1 px-4 py-2 bg-black/40 border border-zinc-800/60 hover:border-brand-cyan/50 hover:text-brand-cyan rounded-md text-sm font-mono text-zinc-300 transition-all duration-300 hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2"
                      >
                        <Eye className="h-4 w-4" />
                        {t('canvas.open') || 'Open'}
                      </button>
                      <button
                        onClick={(e) => handleDeleteClick(project._id, e)}
                        disabled={deletingId === project._id}
                        className="px-4 py-2 bg-black/40 border border-zinc-800/60 hover:border-red-500/50 hover:text-red-400 rounded-xl text-sm font-mono text-zinc-300 transition-all duration-300 hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Auth Modal */}
      {showAuthModal && (
        <AuthModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
          onSuccess={async () => {
            setShowAuthModal(false);
            hasLoadedProjectsRef.current = false; // Reset flag to allow reload
            await loadProjects();
          }}
          isSignUp={false}
        />
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setProjectToDelete(null);
        }}
        onConfirm={handleDeleteConfirm}
        title={t('canvas.deleteProject') || 'Delete Project'}
        message={t('canvas.deleteProjectMessage') || 'Are you sure you want to delete this project? This action cannot be undone.'}
        confirmText={t('canvas.delete') || 'Delete'}
        cancelText={t('common.cancel') || 'Cancel'}
        variant="danger"
      />

      <WorkflowLibraryModal
        isOpen={showWorkflowLibrary}
        onClose={() => setShowWorkflowLibrary(false)}
        onLoadWorkflow={handleLoadWorkflow}
        isAuthenticated={isAuthenticated === true}
        isAdmin={isAdmin}
        t={t}
      />
    </>
  );
};

