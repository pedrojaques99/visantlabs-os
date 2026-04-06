import React, { useState, useMemo, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Diamond, Calendar, Eye, Trash2, Plus, Pickaxe } from 'lucide-react';
import { toast } from 'sonner';
import { SEO } from '../components/SEO';
import { SkeletonLoader } from '../components/ui/SkeletonLoader';
import { SearchBar } from '../components/ui/SearchBar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  BreadcrumbWithBack,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '../components/ui/BreadcrumbWithBack';
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0C0C0C] text-neutral-300 pt-14 relative overflow-hidden">
        <div className="max-w-[1800px] mx-auto px-4 md:px-6 py-4 md:py-6 relative z-10">
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
        </div>
      </div>
    );
  }

  return (
    <>
      <SEO
        title="My Creatives"
        description="Manage, edit and revisit your AI-generated creatives."
        noindex={true}
      />
      <div
        className="min-h-screen bg-[#0C0C0C] text-neutral-300 pt-14 relative overflow-hidden"
        data-vsn-component="creative-projects-grid"
      >
        <div className="max-w-[1800px] mx-auto px-4 md:px-6 py-4 md:py-6 relative z-10">
          {/* Header */}
          <div className="mb-4">
            <BreadcrumbWithBack to="/create">
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <Link to="/">Home</Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <Link to="/create">Creative Studio</Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>Projects</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </BreadcrumbWithBack>
          </div>

          <div className="flex items-start gap-4 mb-6">
            <div className="flex-1">
              <h1 className="text-3xl md:text-4xl font-semibold font-manrope text-neutral-300 mb-2">
                My Creatives
              </h1>
              <p className="text-neutral-500 font-mono text-sm md:text-base mb-4">
                {projects.length === 0
                  ? 'No creatives yet'
                  : searchQuery.trim()
                  ? `${filteredProjects.length} of ${projects.length} ${
                      projects.length === 1 ? 'creative' : 'creatives'
                    }`
                  : `${projects.length} ${projects.length === 1 ? 'creative' : 'creatives'}`}
              </p>
              {projects.length > 0 && (
                <div className="max-w-md">
                  <SearchBar
                    value={searchQuery}
                    onChange={setSearchQuery}
                    placeholder="Search by name or prompt…"
                    iconSize={16}
                    className="bg-neutral-950/70 border-neutral-800/50 text-neutral-300 placeholder:text-neutral-500"
                  />
                </div>
              )}
            </div>
            <div className="flex flex-col gap-2 flex-shrink-0">
              <Button
                variant="brand"
                onClick={handleCreateNew}
                className="px-4 py-2 bg-brand-cyan/90 hover:bg-brand-cyan text-black font-semibold rounded-md text-sm font-mono transition-all duration-300 hover:scale-[1.02] active:scale-95 flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                New Creative
              </Button>
            </div>
          </div>

          {/* Empty states */}
          {filteredProjects.length === 0 && projects.length > 0 ? (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
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
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
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
                    className="bg-[#141414] border border-neutral-800/60 rounded-md p-6 md:p-8 hover:border-neutral-700/60 transition-all duration-300 group cursor-pointer overflow-hidden"
                    onClick={() => {
                      if (editingProjectId !== project._id) handleOpen(project._id);
                    }}
                  >
                    {/* Thumbnail */}
                    {thumbnail ? (
                      <div className="w-full h-48 mb-4 rounded-md overflow-hidden bg-neutral-900/50 border border-neutral-800/60">
                        <img
                          src={thumbnail}
                          alt={project.name || 'Creative preview'}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      </div>
                    ) : (
                      <div className="w-full h-48 mb-4 rounded-md bg-neutral-900/50 border border-neutral-800/60 flex items-center justify-center">
                        <Diamond className="h-12 w-12 text-neutral-700" strokeWidth={1} />
                      </div>
                    )}

                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <Diamond className="h-5 w-5 text-brand-cyan flex-shrink-0" />
                          {editingProjectId === project._id ? (
                            <Input
                              ref={editingInputRef}
                              type="text"
                              value={editingName}
                              onChange={(e) => setEditingName(e.target.value)}
                              onBlur={() => handleNameEditSave(project._id)}
                              onKeyDown={(e) => handleNameEditKeyDown(e, project._id)}
                              onClick={(e) => e.stopPropagation()}
                              className="flex-1 font-semibold text-neutral-200 font-manrope text-lg bg-transparent border-b border-neutral-600 focus:border-brand-cyan focus:outline-none px-1"
                            />
                          ) : (
                            <h3
                              className="font-semibold text-neutral-200 font-manrope text-lg line-clamp-2 cursor-text hover:text-brand-cyan transition-colors"
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
                          className="flex items-center gap-2 text-xs text-neutral-400 font-mono mb-3"
                          title={`Last edited: ${formatDate(project.updatedAt || project.createdAt)}`}
                        >
                          <Calendar className="h-3.5 w-3.5" />
                          <span>
                            Last edited: {formatDate(project.updatedAt || project.createdAt)}
                          </span>
                        </div>
                        {project.prompt && (
                          <p className="text-[11px] text-neutral-500 font-mono line-clamp-2 mb-3">
                            {project.prompt}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-xs text-neutral-500 font-mono mb-4">
                      <span className="px-2 py-0.5 rounded bg-neutral-900 border border-white/5 text-brand-cyan">
                        {project.format}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpen(project._id);
                        }}
                        className="flex-1 px-4 py-2 bg-neutral-950/70 border border-neutral-800/60 hover:border-brand-cyan/50 hover:text-brand-cyan rounded-md text-sm font-mono text-neutral-300 transition-all duration-300 hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2"
                      >
                        <Eye className="h-4 w-4" />
                        Open
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={(e) => handleDeleteClick(project._id, e)}
                        disabled={deleteMutation.isPending}
                        className="px-4 py-2 bg-neutral-950/70 border border-neutral-800/60 hover:border-red-500/50 hover:text-red-400 rounded-xl text-sm font-mono text-neutral-300 transition-all duration-300 hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
      </div>

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
    </>
  );
};
