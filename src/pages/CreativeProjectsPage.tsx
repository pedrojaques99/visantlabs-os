import React, { useState, useMemo, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Diamond, Calendar, Eye, Trash2, Plus, Pickaxe, Search } from 'lucide-react';
import { toast } from 'sonner';
import { SkeletonLoader } from '../components/ui/SkeletonLoader';
import { SearchBar } from '../components/ui/SearchBar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageShell } from '../components/ui/PageShell';
import { AuthModal } from '../components/AuthModal';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { useLayout } from '@/hooks/useLayout';
import { useCreativeProjects, useDeleteCreativeProject, useUpdateCreativeProject } from '@/hooks/queries/useCreativeProjects';
import { useCreativeStore } from '@/components/creative/store/creativeStore';

/**
 * Grid of the user's Creative Studio projects.
 * Mirrors CanvasProjectsPage design language for consistency across the app.
 * Route: /create/projects
 */
export const CreativeProjectsPage: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useLayout();
  const reset = useCreativeStore((s) => s.reset);

  const { data: projects = [], isLoading, error } = useCreativeProjects();
  const deleteMutation = useDeleteCreativeProject();
  const updateMutation = useUpdateCreativeProject();

  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<string | null>(null);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const editingInputRef = useRef<HTMLInputElement>(null);

  // Surface auth + query errors
  React.useEffect(() => {
    if (isAuthenticated === false) setShowAuthModal(true);
  }, [isAuthenticated]);

  React.useEffect(() => {
    if (error) toast.error((error as Error).message || 'Failed to load creatives');
  }, [error]);

  const filteredProjects = useMemo(() => {
    let result = [...projects];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (p) => p.name?.toLowerCase().includes(q) || p.prompt?.toLowerCase().includes(q)
      );
    }
    return result.sort((a, b) => {
      const dA = new Date(a.updatedAt || a.createdAt).getTime();
      const dB = new Date(b.updatedAt || b.createdAt).getTime();
      return dB - dA;
    });
  }, [projects, searchQuery]);

  const formatDate = (s: string) =>
    new Date(s).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });

  const handleOpen = (id: string) => navigate(`/create?project=${id}`);

  const handleCreateNew = () => {
    reset();
    navigate('/create');
  };

  const handleDeleteClick = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setProjectToDelete(id);
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    if (!projectToDelete) return;
    try {
      await deleteMutation.mutateAsync(projectToDelete);
    } finally {
      setProjectToDelete(null);
      setShowDeleteModal(false);
    }
  };

  const handleNameEditStart = (
    project: { _id: string; name: string },
    e: React.MouseEvent
  ) => {
    e.stopPropagation();
    setEditingProjectId(project._id);
    setEditingName(project.name || 'Untitled Creative');
    setTimeout(() => {
      editingInputRef.current?.focus();
      editingInputRef.current?.select();
    }, 0);
  };

  const handleNameEditSave = async (projectId: string) => {
    const current = projects.find((p) => p._id === projectId);
    if (!current) return setEditingProjectId(null);
    const trimmed = editingName.trim();
    if (!trimmed || trimmed === current.name) {
      setEditingProjectId(null);
      return;
    }
    try {
      await updateMutation.mutateAsync({ id: projectId, input: { name: trimmed } });
    } finally {
      setEditingProjectId(null);
      setEditingName('');
    }
  };

  const handleNameEditKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    projectId: string
  ) => {
    if (e.key === 'Enter') e.currentTarget.blur();
    else if (e.key === 'Escape') {
      setEditingProjectId(null);
      setEditingName('');
    }
  };

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
              placeholder="Search project name…"
              iconSize={14}
              className="bg-transparent border-neutral-800/20 text-xs font-mono"
              containerClassName="w-full"
              autoFocus
            />
          </div>
        )}
      </div>
      <Button
        variant="brand"
        onClick={handleCreateNew}
        className="h-10 px-6 bg-brand-cyan/90 hover:bg-brand-cyan text-black font-bold uppercase tracking-widest text-[10px] rounded-md transition-all duration-300 hover:scale-[1.02] flex items-center gap-2"
      >
        <Plus className="h-4 w-4" />
        New Creative
      </Button>
    </div>
  );

  if (isLoading) {
    return (
      <PageShell
        pageId="creative-projects-loading"
        title="My Creatives"
        microTitle="Creative Studio // Projects"
        description="Manage your AI-generated creatives."
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

  return (
    <PageShell
      pageId="creative-projects"
      seoTitle="My Creatives"
      seoDescription="Manage, edit and revisit your AI-generated creatives."
      title="My Creatives"
      microTitle="Creative Studio // Projects"
      description={
        projects.length === 0
          ? 'No creatives yet'
          : searchQuery.trim()
          ? `${filteredProjects.length} of ${projects.length} creatives found`
          : `Manage ${projects.length} ${projects.length === 1 ? 'creative' : 'creatives'}`
      }
      breadcrumb={[
        { label: 'Home', to: '/' },
        { label: 'Creative Studio', to: '/create' },
        { label: 'Projects' }
      ]}
      actions={headerActions}
    >
      <div className="relative z-10" data-vsn-component="creative-projects-grid">
        {/* Empty states */}
        {filteredProjects.length === 0 && projects.length > 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[40vh] text-center">
            <Diamond size={64} className="text-neutral-700 mb-4" strokeWidth={1} />
            <h2 className="text-xl font-semibold font-mono uppercase text-neutral-500 mb-2">
              NO CREATIVES FOUND
            </h2>
            <p className="text-sm text-neutral-600 font-mono mb-6">
              No creatives match your search query.
            </p>
            <Button
              variant="ghost"
              onClick={() => setSearchQuery('')}
              className="px-6 py-3 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border border-neutral-700 hover:border-neutral-600 font-semibold rounded-md text-sm font-mono transition-all duration-300 hover:scale-[1.02] active:scale-95"
            >
              Clear Search
            </Button>
          </div>
        ) : projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[40vh] text-center">
            <Diamond size={64} className="text-neutral-700 mb-4" strokeWidth={1} />
            <h2 className="text-xl font-semibold font-mono uppercase text-neutral-500 mb-2">
              NO CREATIVES YET
            </h2>
            <p className="text-sm text-neutral-600 font-mono mb-6">
              Generate your first brand-aware creative to get started.
            </p>
            <Button
              variant="brand"
              onClick={handleCreateNew}
              className="px-6 py-3 bg-brand-cyan/90 hover:bg-brand-cyan text-black font-semibold rounded-md text-sm font-mono transition-all duration-300 hover:scale-[1.02] active:scale-95 flex items-center gap-2"
            >
              <Pickaxe className="h-4 w-4" />
              Create Your First Creative
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {filteredProjects.map((project) => {
              const thumbnail = project.thumbnailUrl || project.backgroundUrl;
              return (
                <div
                  key={project._id}
                  data-vsn-component="creative-project-card"
                  data-vsn-project-id={project._id}
                  className="bg-[#141414]/40 backdrop-blur-sm border border-neutral-800/60 rounded-xl p-5 hover:border-brand-cyan/40 transition-all duration-500 group cursor-pointer overflow-hidden shadow-xl"
                  onClick={() => {
                    if (editingProjectId !== project._id) handleOpen(project._id);
                  }}
                >
                  {/* Thumbnail */}
                  <div className="relative w-full h-48 mb-6 rounded-lg overflow-hidden bg-neutral-900/50 border border-neutral-800/60">
                    {thumbnail ? (
                      <img
                        src={thumbnail}
                        alt={project.name || 'Creative preview'}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Diamond className="h-10 w-10 text-neutral-800" strokeWidth={1} />
                      </div>
                    )}
                    <div className="absolute top-3 left-3 px-2 py-1 rounded bg-black/60 backdrop-blur-md border border-white/10 text-[10px] font-mono text-brand-cyan uppercase tracking-wider">
                      {project.format}
                    </div>
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
                            onClick={(e) =>
                              handleNameEditStart(
                                { _id: project._id, name: project.name },
                                e
                              )
                            }
                            title="Click to edit"
                          >
                            {project.name || 'Untitled Creative'}
                          </h3>
                        )}
                      </div>
                      <div
                        className="flex items-center gap-2 text-[10px] text-neutral-500 font-mono mb-4 uppercase tracking-widest"
                        title={`Last edited: ${formatDate(project.updatedAt || project.createdAt)}`}
                      >
                        <Calendar className="h-3 w-3" />
                        <span>
                          {formatDate(project.updatedAt || project.createdAt)}
                        </span>
                      </div>
                      {project.prompt && (
                        <p className="text-[11px] text-neutral-500 font-mono line-clamp-2 mb-5 leading-relaxed opacity-60">
                          {project.prompt}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpen(project._id);
                      }}
                      className="flex-1 h-10 bg-white/5 border border-white/10 hover:border-brand-cyan/50 hover:bg-brand-cyan/10 hover:text-brand-cyan rounded-lg text-xs font-bold uppercase tracking-wider text-neutral-400 transition-all duration-300 flex items-center justify-center gap-2"
                    >
                      <Eye className="h-4 w-4" />
                      Open
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={(e) => handleDeleteClick(project._id, e)}
                      disabled={deleteMutation.isPending}
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

        {showAuthModal && (
          <AuthModal
            isOpen={showAuthModal}
            onClose={() => setShowAuthModal(false)}
            onSuccess={() => setShowAuthModal(false)}
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
          title="Delete Creative"
          message="Are you sure you want to delete this creative? This action cannot be undone."
          confirmText="Delete"
          cancelText="Cancel"
          variant="danger"
        />
      </div>
    </PageShell>
  );
};

