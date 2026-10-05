import React, { useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Diamond, Trash2, Plus, Search } from '@/lib/ui/icons';
import { toast } from 'sonner';
import { SkeletonLoader } from '../components/ui/SkeletonLoader';
import { SearchBar } from '../components/ui/SearchBar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageShell } from '../components/ui/PageShell';
import { AuthModal } from '../components/AuthModal';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { ErrorState } from '@/components/ui/ErrorState';
import { EmptyState } from '@/components/ui/EmptyState';
import { Thumb } from '@/components/ui/Thumb';
import { useLayout } from '@/hooks/useLayout';
import {
  useCreativeProjects,
  useDeleteCreativeProject,
  useUpdateCreativeProject,
} from '@/hooks/queries/useCreativeProjects';
import { useCreativeStore } from '@/components/creative/store/creativeStore';
import { useTranslation } from '@/hooks/useTranslation';
import { formatDateShort } from '@/utils/localeUtils';
import { useActiveBrand } from '@/contexts/ActiveBrandContext';

/**
 * Grid of the user's Creative Studio projects.
 * Mirrors CanvasProjectsPage design language for consistency across the app.
 * Route: /create/projects
 */
export const CreativeProjectsPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isAuthenticated } = useLayout();
  const reset = useCreativeStore((s) => s.reset);

  // Filtro opcional pela marca ativa (default global; server-side via hook).
  // Lista segue a marca ativa do BrandSwitcher (null = "Todas as marcas").
  const { activeBrandId: brandId } = useActiveBrand();
  const {
    data: projects = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useCreativeProjects(brandId ?? undefined);
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
    if (error) toast.error((error as Error).message || t('creative.projects.loadFailed'));
  }, [error, t]);

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

  const formatDate = (s: string) => formatDateShort(s);

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

  const handleNameEditStart = (project: { _id: string; name: string }, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingProjectId(project._id);
    setEditingName(project.name || '');
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

  const handleNameEditKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, projectId: string) => {
    if (e.key === 'Enter') e.currentTarget.blur();
    else if (e.key === 'Escape') {
      setEditingProjectId(null);
      setEditingName('');
    }
  };

  const headerActions = (
    <div className="flex items-center gap-1 sm:gap-3">
      {/* Mesma busca inline do /canvas: expande dentro do header e colapsa ao sair vazia. */}
      {showSearch ? (
        <SearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder={t('creative.projects.search_project_name')}
          iconSize={14}
          className="h-10 text-xs"
          containerClassName="min-w-0 flex-1 max-w-[8.5rem] sm:flex-initial sm:max-w-none sm:w-[180px] md:w-[140px] lg:w-[180px] xl:w-[200px]"
          autoFocus
          onBlur={() => {
            if (!searchQuery.trim()) setShowSearch(false);
          }}
        />
      ) : (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setShowSearch(true)}
          className="shrink-0 text-muted-foreground hover:text-foreground"
          title={t('common.search')}
          aria-label={t('common.search')}
        >
          <Search size={18} />
        </Button>
      )}
      <Button
        variant="brand"
        onClick={handleCreateNew}
        title={t('creative.projects.newCreative')}
        aria-label={t('creative.projects.newCreative')}
        className="shrink-0 px-2 sm:px-4 md:px-2 lg:px-4"
      >
        <Plus className="h-4 w-4" />
        <span className="hidden sm:inline md:hidden lg:inline">
          {t('creative.projects.newCreative')}
        </span>
      </Button>
    </div>
  );

  if (isLoading) {
    return (
      <PageShell
        pageId="creative-projects-loading"
        title={t('creative.projects.title')}
        description={t('creative.projects.manage_your_aigenerated_creative')}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-4">
              <SkeletonLoader height="12rem" className="w-full rounded-lg mb-4" />
              <SkeletonLoader height="1.25rem" className="w-2/3 mb-2" />
              <SkeletonLoader height="0.875rem" className="w-24" />
            </div>
          ))}
        </div>
      </PageShell>
    );
  }

  const countStr = searchQuery.trim()
    ? t('creative.projects.countFiltered', {
        count: filteredProjects.length,
        total: projects.length,
      })
    : projects.length === 1
      ? t('creative.projects.countOne')
      : t('creative.projects.countMany', { count: projects.length });

  return (
    <PageShell
      pageId="creative-projects"
      seoTitle={t('creative.projects.title')}
      seoDescription={t('creative.projects.seoDescription')}
      title={t('creative.projects.title')}
      description={projects.length === 0 ? t('creative.projects.emptyTitle') : countStr}
      breadcrumb={[
        { label: t('apps.home'), to: '/' },
        { label: t('creative.projects.studio'), to: '/create' },
        { label: t('creative.projects.title') },
      ]}
      actions={headerActions}
    >
      <div className="relative z-10" data-vsn-component="creative-projects-grid">
        {isError && projects.length === 0 ? (
          <ErrorState title={t('creative.projects.loadFailed')} onRetry={() => refetch()} />
        ) : filteredProjects.length === 0 && projects.length > 0 ? (
          <EmptyState
            icon={Diamond}
            title={t('creative.projects.noneFound')}
            description={t('creative.projects.noneMatchSearch')}
            actionLabel={t('common.clearSearch')}
            onAction={() => setSearchQuery('')}
          />
        ) : projects.length === 0 ? (
          <EmptyState
            icon={Diamond}
            title={t('creative.projects.emptyTitle')}
            description={t('creative.projects.emptyBody')}
            actionLabel={t('creative.projects.createFirst')}
            onAction={handleCreateNew}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {filteredProjects.map((project) => {
              const thumbnail = project.thumbnailUrl || project.backgroundUrl;
              const displayName = project.name || t('creative.projects.untitled');
              const isEditing = editingProjectId === project._id;
              const date = formatDate(project.updatedAt || project.createdAt);
              return (
                <div
                  key={project._id}
                  data-vsn-component="creative-project-card"
                  data-vsn-project-id={project._id}
                  role="button"
                  tabIndex={0}
                  className="group bg-card border border-border rounded-xl p-4 hover:border-ring transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => {
                    if (!isEditing) handleOpen(project._id);
                  }}
                  onKeyDown={(e) => {
                    if (e.target !== e.currentTarget || isEditing) return;
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleOpen(project._id);
                    }
                  }}
                >
                  <Thumb
                    src={thumbnail}
                    alt={displayName}
                    fallbackIcon={Diamond}
                    loading="lazy"
                    className="w-full h-48 mb-4 rounded-lg object-cover border border-border"
                  />

                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      {isEditing ? (
                        <Input
                          ref={editingInputRef}
                          type="text"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onBlur={() => handleNameEditSave(project._id)}
                          onKeyDown={(e) => handleNameEditKeyDown(e, project._id)}
                          onClick={(e) => e.stopPropagation()}
                          className="font-semibold text-foreground text-base bg-transparent border-0 border-b border-ring focus:outline-none px-1 h-auto py-0"
                        />
                      ) : (
                        <h3
                          className="font-semibold text-foreground text-base line-clamp-1 cursor-text"
                          onClick={(e) =>
                            handleNameEditStart({ _id: project._id, name: project.name }, e)
                          }
                          title={t('canvas.clickToEdit')}
                        >
                          {displayName}
                        </h3>
                      )}
                      <p
                        className="flex gap-2 text-xs text-muted-foreground mt-1"
                        title={`${t('canvas.lastEdited')}: ${date}`}
                      >
                        <span>{date}</span>
                        {project.format && <span>{project.format}</span>}
                      </p>
                      {project.prompt && (
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-2 leading-relaxed">
                          {project.prompt}
                        </p>
                      )}
                    </div>
                    <Button
                      variant="danger"
                      size="icon-sm"
                      onClick={(e) => handleDeleteClick(project._id, e)}
                      disabled={deleteMutation.isPending}
                      aria-label={t('creative.projects.delete_creative')}
                      title={t('creative.projects.delete_creative')}
                      className="shrink-0"
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
          title={t('creative.projects.delete_creative')}
          message={t('creative.projects.are_you_sure_you_want_to_delete_')}
          confirmText={t('common.delete')}
          cancelText={t('common.cancel')}
          variant="danger"
        />
      </div>
    </PageShell>
  );
};
