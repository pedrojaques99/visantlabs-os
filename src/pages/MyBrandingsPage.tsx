import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { GridDotsBackground } from '../components/ui/GridDotsBackground';
import { SkeletonLoader } from '../components/ui/SkeletonLoader';
import { brandingApi, type BrandingProject } from '../services/brandingApi';
import { useLayout } from '@/hooks/useLayout';
import { useTranslation } from '@/hooks/useTranslation';
import { AuthModal } from '../components/AuthModal';
import { ConfirmationModal } from '../components/ConfirmationModal';
import {
  BreadcrumbWithBack,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "../components/ui/BreadcrumbWithBack";
import { toast } from 'sonner';
import { FileText, Calendar, Eye, Trash2, FilePenLine } from 'lucide-react';
import { SEO } from '../components/SEO';

export const MyBrandingsPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isAuthenticated } = useLayout();
  const [projects, setProjects] = useState<BrandingProject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthenticated === false) {
      setShowAuthModal(true);
    } else if (isAuthenticated === true) {
      loadProjects();
    }
  }, [isAuthenticated]);

  const loadProjects = async () => {
    setIsLoading(true);
    try {
      const data = await brandingApi.getAll();
      setProjects(data);
    } catch (error: any) {
      console.error('Error loading branding projects:', error);
      if (error?.status === 401) {
        setShowAuthModal(true);
      } else {
        toast.error(t('branding.myBrandings.errors.failedToLoad') || 'Failed to load branding projects');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleView = (project: BrandingProject) => {
    if (project._id && project._id.trim() !== '') {
      navigate(`/branding-machine?projectId=${project._id}`);
    } else {
      toast.error(t('branding.myBrandings.errors.invalidProjectId') || 'Invalid project ID');
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
      await brandingApi.delete(projectToDelete);
      setProjects(prev => prev.filter(p => p._id !== projectToDelete));
      toast.success(t('branding.myBrandings.deleted') || 'Project deleted successfully');
    } catch (error: any) {
      console.error('Error deleting project:', error);
      toast.error(t('branding.myBrandings.errors.failedToDelete') || 'Failed to delete project');
    } finally {
      setDeletingId(null);
      setProjectToDelete(null);
      setShowDeleteModal(false);
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

  const truncateText = (text: string, maxLength: number = 120) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0C0C0C] text-neutral-300 pt-14 relative">
        <div className="fixed inset-0 z-0">
          <GridDotsBackground />
        </div>
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-8 relative z-10">
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-card border border-neutral-800/60 rounded-md p-6">
                <SkeletonLoader height="1.5rem" className="w-3/4 mb-2" />
                <SkeletonLoader height="1rem" className="w-1/2" />
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
        title={t('branding.myBrandings.seoTitle')}
        description={t('branding.myBrandings.seoDescription')}
        noindex={true}
      />
      <div className="min-h-screen bg-[#0C0C0C] text-neutral-300 pt-14 relative overflow-hidden">
        <div className="fixed inset-0 z-0">
          <GridDotsBackground />
        </div>
        <div className="max-w-[1800px] mx-auto px-4 md:px-6 py-4 md:py-6 relative z-10">
          {/* Breadcrumb with Back Button */}
          <div className="mb-6">
            <BreadcrumbWithBack to="/branding-machine">
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <Link to="/">Home</Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <Link to="/branding-machine">Branding Machine</Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>My Brandings</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </BreadcrumbWithBack>
          </div>
          {/* Header */}
          <div className="flex items-start gap-4 mb-6">
            <div className="flex-1">
              <h1 className="text-3xl md:text-4xl font-semibold font-manrope text-neutral-300 mb-2">
                {t('branding.myBrandings.title') || 'My Branding Projects'}
              </h1>
              <p className="text-neutral-500 font-mono text-sm md:text-base">
                {projects.length === 0
                  ? t('branding.myBrandings.noProjects') || 'No projects yet'
                  : `${projects.length} ${projects.length === 1 ? 'project' : 'projects'}`}
              </p>
            </div>
            <button
              onClick={() => navigate('/branding-machine')}
              className="px-4 py-2 bg-brand-cyan/90 hover:bg-brand-cyan text-black font-semibold rounded-md text-sm font-mono transition-all duration-300 hover:scale-[1.02] active:scale-95 flex items-center gap-2 cursor-pointer flex-shrink-0"
            >
              <FilePenLine className="h-4 w-4" />
              {t('branding.myBrandings.createNew') || 'Create New'}
            </button>
          </div>

          {/* Projects Grid */}
          {projects.length === 0 ? (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
              <FileText size={64} className="text-neutral-700 mb-4" strokeWidth={1} />
              <h2 className="text-xl font-semibold font-mono uppercase text-neutral-500 mb-2">
                {t('branding.myBrandings.emptyTitle') || 'NO PROJECTS YET'}
              </h2>
              <p className="text-sm text-neutral-600 font-mono mb-6">
                {t('branding.myBrandings.emptyDescription') || 'Create your first branding project to see it here.'}
              </p>
              <button
                onClick={() => navigate('/branding-machine')}
                className="px-6 py-3 bg-brand-cyan/90 hover:bg-brand-cyan text-black font-semibold rounded-md text-sm font-mono transition-all duration-300 hover:scale-[1.02] active:scale-95 flex items-center gap-2 cursor-pointer"
              >
                <FilePenLine className="h-4 w-4" />
                {t('branding.myBrandings.createFirst') || 'Create Your First Project'}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              {projects.map((project) => (
                <div
                  key={project._id}
                  className="bg-[#141414] border border-neutral-800/60 rounded-md p-6 md:p-8 hover:border-neutral-700/60 transition-all duration-300 group cursor-pointer"
                  onClick={() => handleView(project)}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <FileText className="h-5 w-5 text-brand-cyan" />
                        <h3 className="font-semibold text-neutral-200 font-manrope text-lg line-clamp-2">
                          {project.name ? truncateText(project.name, 60) : truncateText(project.prompt, 60)}
                        </h3>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-neutral-400 font-mono mb-3">
                        <Calendar className="h-3.5 w-3.5" />
                        <span>{formatDate(project.createdAt)}</span>
                      </div>
                    </div>
                  </div>

                  <p className="text-sm text-neutral-400 font-mono mb-4 line-clamp-3">
                    {truncateText(project.prompt, 120)}
                  </p>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleView(project);
                      }}
                      className="flex-1 px-4 py-2 bg-neutral-950/70 border border-neutral-800/60 hover:border-brand-cyan/50 hover:text-brand-cyan rounded-md text-sm font-mono text-neutral-300 transition-all duration-300 hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Eye className="h-4 w-4" />
                      {t('branding.myBrandings.view') || 'View'}
                    </button>
                    <button
                      onClick={(e) => handleDeleteClick(project._id, e)}
                      disabled={deletingId === project._id}
                      className="px-4 py-2 bg-neutral-950/70 border border-neutral-800/60 hover:border-red-500/50 hover:text-red-400 rounded-md text-sm font-mono text-neutral-300 transition-all duration-300 hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Auth Modal */}
        {showAuthModal && (
          <AuthModal
            isOpen={showAuthModal}
            onClose={() => setShowAuthModal(false)}
            onSuccess={async () => {
              setShowAuthModal(false);
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
          title={t('branding.myBrandings.confirmDeleteTitle')}
          message={t('branding.myBrandings.confirmDelete')}
          confirmText={t('branding.myBrandings.delete')}
          cancelText={t('branding.cancel') || t('common.cancel')}
          variant="danger"
        />
      </div>
    </>
  );
};

