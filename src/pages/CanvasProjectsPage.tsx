import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { SkeletonLoader } from '../components/ui/SkeletonLoader';
import { canvasApi, type CanvasProject } from '../services/canvasApi';
import { useLayout } from '@/hooks/useLayout';
import { usePremiumAccess } from '@/hooks/usePremiumAccess';
import { PageShell } from '../components/ui/PageShell';
import { AuthModal } from '../components/AuthModal';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { toast } from 'sonner';
import { FolderKanban, Calendar, Eye, Trash2, Plus, Pickaxe, FolderOpen, FileJson, Search } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { useDebouncedCallback } from '@/hooks/useDebouncedCallback';
import { SearchBar } from '../components/ui/SearchBar';
import type { Node } from '@xyflow/react';
import type { FlowNodeData, OutputNodeData, ImageNodeData } from '../types/reactFlow';
import { getImageUrl } from '@/utils/imageUtils';
import { WorkflowLibraryModal } from '../components/WorkflowLibraryModal';
import { type CanvasWorkflow } from '../services/workflowApi';
import { validateVisantJson, readJsonFile } from '@/utils/canvas/canvasJsonExport';
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

// Helper function to get project thumbnail
const getProjectThumbnail = (project: CanvasProject): string | null => {
  if (!project.nodes || !Array.isArray(project.nodes)) return null;

  const nodes = project.nodes as Node<FlowNodeData>[];

  // Priority: OutputNode > ImageNode > other nodes with images
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
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  const isLoadingRef = useRef(false);
  const [showWorkflowLibrary, setShowWorkflowLibrary] = useState(false);
  const [isAdmin] = useState(false);

  const handleLoadWorkflow = async (workflow: CanvasWorkflow) => {
    try {
      if (!isAuthenticated) {
        toast.error(t('workflows.errors.mustBeAuthenticated') || 'You must be logged in');
        return;
      }
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

  useEffect(() => {
    if (!isLoadingAccess && !hasAccess) {
      navigate('/waitlist', { replace: true });
    }
  }, [hasAccess, isLoadingAccess, navigate]);

  const loadProjects = useCallback(async () => {
    if (isLoadingRef.current) return;
    isLoadingRef.current = true;
    setIsLoading(true);
    try {
      const data = await canvasApi.getAll();
      setProjects(data);
      hasLoadedProjectsRef.current = true;
    } catch (error: any) {
      console.error('[CanvasProjects] Error loading canvas projects:', error);
      if (error?.status === 401) {
        setShowAuthModal(true);
      } else {
        toast.error(t('canvas.failedToLoadProjects') || 'Failed to load canvas projects');
      }
    } finally {
      isLoadingRef.current = false;
      setIsLoading(false);
    }
  }, [t]);

  const handleAuthAction = useDebouncedCallback((auth: boolean | null) => {
    if (auth === null || hasLoadedProjectsRef.current || isLoadingRef.current) return;
    if (auth === false) {
      setShowAuthModal(true);
    } else if (auth === true) {
      loadProjects();
    }
  }, 200);

  useEffect(() => {
    handleAuthAction(isAuthenticated);
  }, [isAuthenticated, handleAuthAction]);

  const handleView = (project: CanvasProject) => {
    if (project._id && project._id.trim() !== '') {
      navigate(`/canvas/${project._id}`);
    } else {
      toast.error(t('canvas.invalidProjectId') || 'Invalid project ID');
    }
  };

  const importJsonInputRef = useRef<HTMLInputElement>(null);

  const handleImportJsonClick = useCallback(() => {
    importJsonInputRef.current?.click();
  }, []);

  const handleImportJsonFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    try {
      const raw = await readJsonFile(file);
      if (!validateVisantJson(raw)) {
        toast.error('Invalid file — not a Visant canvas JSON.');
        return;
      }
      const newProject = await canvasApi.save(raw.name, raw.nodes, raw.edges, undefined, raw.drawings ?? []);
      toast.success(`Imported "${raw.name}" — opening canvas...`);
      navigate(`/canvas/${newProject._id}`);
    } catch (err: any) {
      console.error('JSON import failed:', err);
      toast.error(err?.message || 'Failed to import JSON file.');
    }
  }, [navigate]);

  const handleCreateNew = async () => {
    try {
      const newProject = await canvasApi.save('Untitled', [], []);
      navigate(`/canvas/${newProject._id}`);
    } catch (error: any) {
      console.error('[CanvasProjects] Error creating project:', error);
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

  const filteredProjects = useMemo(() => {
    let result = [...projects];
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(project =>
        project.name?.toLowerCase().includes(query)
      );
    }
    return result.sort((a, b) => {
      const dateA = new Date(a.updatedAt || a.createdAt).getTime();
      const dateB = new Date(b.updatedAt || b.createdAt).getTime();
      return dateB - dateA;
    });
  }, [projects, searchQuery]);

  const headerActions = (
    <div className="flex items-center gap-3">
      <div className="relative">
        <Button 
          variant="ghost" 
          onClick={() => setShowSearch(!showSearch)}
          className="p-2 text-neutral-500 hover:text-brand-cyan transition-colors rounded-md hover:bg-neutral-900/40"
          title="Search"
        >
          <Search size={18} />
        </Button>
        {showSearch && (
          <div className="absolute top-12 right-0 bg-neutral-950/90 backdrop-blur-sm border border-neutral-800/40 rounded-ml p-2 min-w-[240px] shadow-lg animate-[fadeInScale_0.2s_ease-out] z-50">
            <SearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder={t('canvas.searchProjects') || 'Search projects...'}
              iconSize={14}
              className="bg-transparent border-neutral-800/20 text-xs font-mono"
              containerClassName="w-full"
              autoFocus
            />
          </div>
        )}
      </div>
      
      <div className="h-6 w-[1px] bg-neutral-800/60 mx-1 hidden md:block" />

      <Button 
        variant="ghost" 
        onClick={() => setShowWorkflowLibrary(true)}
        className="h-10 px-3 hover:bg-neutral-900/40 text-neutral-400 hover:text-brand-cyan transition-all rounded-md flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest"
      >
        <FolderOpen className="h-4 w-4" />
        <span className="hidden lg:inline">{t('workflows.importWorkflow') || 'Library'}</span>
      </Button>

      <Button 
        variant="toolbar" 
        onClick={handleImportJsonClick}
        
      >
        <FileJson className="h-4 w-4" />
        <span className="hidden lg:inline">JSON</span>
      </Button>

      <Button variant="brand" onClick={handleCreateNew}
        className="h-10 px-6 bg-brand-cyan/90 hover:bg-brand-cyan text-black font-bold uppercase tracking-widest text-[10px] rounded-md transition-all duration-300 hover:scale-[1.02] flex items-center gap-2"
      >
        <Plus className="h-4 w-4" />
        {t('canvas.newProject') || 'New Project'}
      </Button>
      
      <Input
        ref={importJsonInputRef}
        type="file"
        accept=".json"
        style={{ display: 'none' }}
        onChange={handleImportJsonFileChange}
      />
    </div>
  );

  if (isLoadingAccess || isLoading) {
    return (
      <PageShell
        pageId="canvas-projects-loading"
        title={t('canvas.projects') || 'Projects'}
        microTitle="Canvas // Workspace"
        description="Manage your visual canvas projects."
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="bg-[#141414] border border-neutral-800/60 rounded-md p-6 md:p-8"
              style={{ animationDelay: `${i * 100}ms` }}
            >
              <SkeletonLoader height="12rem" className="w-full rounded-md mb-4" />
              <div className="flex items-center gap-2 mb-2">
                <SkeletonLoader height="1.25rem" className="w-5 rounded" />
                <SkeletonLoader height="1.5rem" className="flex-1" />
              </div>
              <div className="flex items-center gap-2 mb-4">
                <SkeletonLoader height="0.875rem" className="w-3.5 rounded" />
                <SkeletonLoader height="0.875rem" className="w-24" />
              </div>
              <div className="flex items-center gap-2">
                <SkeletonLoader height="2.5rem" className="flex-1 rounded-md" />
                <SkeletonLoader height="2.5rem" className="w-12 rounded-xl" />
              </div>
            </div>
          ))}
        </div>
      </PageShell>
    );
  }

  if (!hasAccess) return null;

  const countStr = (() => {
    const count = filteredProjects.length;
    const total = projects.length;
    const isSingular = count === 1;
    if (searchQuery.trim()) {
      return locale === 'pt-BR' 
        ? `${count} de ${total} ${isSingular ? 'projeto' : 'projetos'} encontrados`
        : `${count} of ${total} ${isSingular ? 'project' : 'projects'} found`;
    } else {
      return locale === 'pt-BR'
        ? `Gerencie ${count} ${isSingular ? 'projeto' : 'projetos'}`
        : `Manage ${count} ${isSingular ? 'project' : 'projects'}`;
    }
  })();

  return (
    <PageShell
      pageId="canvas-projects"
      seoTitle={t('canvas.seoTitle') || 'Canvas Editor'}
      seoDescription={t('canvas.seoDescription') || 'Editor visual baseado em fluxos.'}
      title={t('canvas.projects') || 'Projects'}
      microTitle="Canvas // Workspace"
      description={countStr}
      breadcrumb={[
        { label: t('apps.home') || 'Home', to: '/' },
        { label: t('canvas.title') || 'Canvas', to: '/canvas' },
        { label: t('canvas.projects') || 'Projects' }
      ]}
      actions={headerActions}
    >
      <div className="relative z-10">
        {filteredProjects.length === 0 && projects.length > 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[40vh] text-center">
            <FolderKanban size={64} className="text-neutral-700 mb-4" strokeWidth={1} />
            <h2 className="text-xl font-semibold font-mono uppercase text-neutral-500 mb-2">
              {t('canvas.noProjectsFound')?.toUpperCase() || 'NO PROJECTS FOUND'}
            </h2>
            <p className="text-sm text-neutral-600 font-mono mb-6">
              {t('canvas.noProjectsMatchSearch') || 'No projects match your search query.'}
            </p>
            <Button variant="ghost" onClick={() => setSearchQuery('')}
              className="px-6 py-3 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border border-neutral-700 hover:border-neutral-600 font-semibold rounded-md text-sm font-mono transition-all duration-300 hover:scale-[1.02] active:scale-95"
            >
              {t('canvas.clearSearch') || 'Clear Search'}
            </Button>
          </div>
        ) : projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[40vh] text-center">
            <FolderKanban size={64} className="text-neutral-700 mb-4" strokeWidth={1} />
            <h2 className="text-xl font-semibold font-mono uppercase text-neutral-500 mb-2">
              {t('canvas.noProjectsYet')?.toUpperCase() || 'NO PROJECTS YET'}
            </h2>
            <p className="text-sm text-neutral-600 font-mono mb-6">
              {t('canvas.createFirstProject') || 'Create your first canvas project to start working with nodes.'}
            </p>
            <Button variant="brand" onClick={handleCreateNew}
              className="px-6 py-3 bg-brand-cyan/90 hover:bg-brand-cyan text-black font-semibold rounded-md text-sm font-mono transition-all duration-300 hover:scale-[1.02] active:scale-95 flex items-center gap-2"
            >
              <Pickaxe className="h-4 w-4" />
              {t('canvas.createFirstProjectButton') || 'Create Your First Project'}
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {filteredProjects.map((project) => {
              const nodeCount = Array.isArray(project.nodes) ? project.nodes.length : 0;
              const edgeCount = Array.isArray(project.edges) ? project.edges.length : 0;
              const thumbnail = getProjectThumbnail(project);

              return (
                <div
                  key={project._id}
                  className="bg-[#141414]/40 backdrop-blur-sm border border-neutral-800/60 rounded-xl p-5 hover:border-brand-cyan/40 transition-all duration-500 group cursor-pointer overflow-hidden shadow-xl"
                  onClick={() => {
                    if (editingProjectId !== project._id) {
                      handleView(project);
                    }
                  }}
                >
                  <div className="relative w-full h-48 mb-6 rounded-lg overflow-hidden bg-neutral-900/50 border border-neutral-800/60">
                    {thumbnail ? (
                      <img
                        src={thumbnail}
                        alt={project.name || 'Project preview'}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <FolderKanban className="h-10 w-10 text-neutral-800" strokeWidth={1} />
                      </div>
                    )}
                  </div>

                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        {editingProjectId === project._id ? (
                          <Input
                            ref={editingInputRef}
                            type="text"
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            onBlur={() => handleNameEditSave(project._id)}
                            onKeyDown={(e) => handleNameEditKeyDown(e, project._id)}
                            onClick={(e) => e.stopPropagation()}
                            className="flex-1 font-bold text-neutral-200 font-manrope text-lg bg-transparent border-b border-brand-cyan/40 focus:border-brand-cyan focus:outline-none px-1 h-auto py-0"
                          />
                        ) : (
                          <h3
                            className="font-bold text-neutral-200 font-manrope text-lg line-clamp-1 cursor-text group-hover:text-brand-cyan transition-colors"
                            onClick={(e) => handleNameEditStart(project, e)}
                            title={t('canvas.clickToEdit') || 'Click to edit'}
                          >
                            {project.name || t('canvas.untitled') || 'Untitled'}
                          </h3>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-neutral-500 font-mono mb-4 uppercase tracking-widest" title={`${t('canvas.lastEdited')}: ${formatDate(project.updatedAt || project.createdAt)}`}>
                        <Calendar className="h-3 w-3" />
                        <span>{formatDate(project.updatedAt || project.createdAt)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-[10px] text-neutral-500 font-mono mb-6 uppercase tracking-widest opacity-60">
                    <span className="px-2 py-0.5 rounded bg-neutral-900 border border-white/5">{nodeCount} {nodeCount === 1 ? 'node' : 'nodes'}</span>
                    <span className="px-2 py-0.5 rounded bg-neutral-900 border border-white/5">{edgeCount} {edgeCount === 1 ? 'edge' : 'edges'}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button variant="ghost" onClick={(e) => {
                      e.stopPropagation();
                      handleView(project);
                    }}
                      className="flex-1 h-10 bg-white/5 border border-white/10 hover:border-brand-cyan/50 hover:bg-brand-cyan/10 hover:text-brand-cyan rounded-lg text-xs font-bold uppercase tracking-wider text-neutral-400 transition-all duration-300 flex items-center justify-center gap-2"
                    >
                      <Eye className="h-4 w-4" />
                      {t('canvas.open') || 'Open'}
                    </Button>
                    <Button variant="ghost" onClick={(e) => handleDeleteClick(project._id, e)}
                      disabled={deletingId === project._id}
                      className="w-10 h-10 bg-white/5 border border-white/10 hover:border-red-500/50 hover:bg-red-500/10 hover:text-red-400 rounded-lg text-neutral-500 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showAuthModal && (
        <AuthModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
          onSuccess={async () => {
            setShowAuthModal(false);
            hasLoadedProjectsRef.current = false;
            await loadProjects();
          }}
          isSignUp={false}
        />
      )}

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
    </PageShell>
  );
};

