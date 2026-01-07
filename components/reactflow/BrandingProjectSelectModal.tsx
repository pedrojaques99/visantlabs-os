import React, { useState, useEffect } from 'react';
import { X, FolderOpen, Plus } from 'lucide-react';
import { GlitchLoader } from '../ui/GlitchLoader';
import { toast } from 'sonner';
import { useTranslation } from '../../hooks/useTranslation';

interface BrandingProject {
  _id?: string;
  id?: string;
  name?: string;
  prompt?: string;
  createdAt?: string;
}

interface BrandingProjectSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectProject: (projectId: string) => void;
  onCreateNew: () => void;
}

export const BrandingProjectSelectModal: React.FC<BrandingProjectSelectModalProps> = ({
  isOpen,
  onClose,
  onSelectProject,
  onCreateNew,
}) => {
  const { t } = useTranslation();
  const [projects, setProjects] = useState<BrandingProject[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadProjects();
    }
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => {
        document.removeEventListener('keydown', handleEscape);
      };
    }
  }, [isOpen, onClose]);

  const loadProjects = async () => {
    setIsLoading(true);
    try {
      const { brandingApi } = await import('../../services/brandingApi');
      const projectsData = await brandingApi.getAll();
      setProjects(projectsData);
    } catch (error: any) {
      console.error('Failed to load branding projects:', error);
      if (error?.status !== 401) {
        toast.error(t('canvasNodes.brandingProjectSelectModal.failedToLoadProjects'), { duration: 3000 });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectProject = (project: BrandingProject) => {
    const projectId = project._id || (project as any).id;
    if (projectId) {
      onSelectProject(projectId);
      onClose();
    }
  };

  const handleCreateNew = () => {
    onCreateNew();
    onClose();
  };

  const filteredProjects = projects.filter((project) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    const name = (project.name || '').toLowerCase();
    const prompt = (project.prompt || '').toLowerCase();
    return name.includes(query) || prompt.includes(query);
  });

  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-[#141414] border border-zinc-800/60 rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-800/60">
          <h2 className="text-lg font-semibold text-zinc-200 font-mono">Select Branding Project</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded hover:bg-zinc-800/50 text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-zinc-800/60">
          <input
            type="text"
            placeholder={t('canvasNodes.brandingProjectSelectModal.searchProjectsPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-2 bg-zinc-900/50 border border-zinc-700/30 rounded text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-[brand-cyan]/50 transition-colors"
            autoFocus
          />
        </div>

        {/* Projects List */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <GlitchLoader size={20} color="brand-cyan" />
                <span className="ml-2 text-sm text-zinc-400">Loading projects...</span>
              </div>
            ) : filteredProjects.length > 0 ? (
              filteredProjects.map((project) => {
                const projectId = project._id || (project as any).id;
                return (
                  <button
                    key={projectId}
                    onClick={() => handleSelectProject(project)}
                    className="w-full px-4 py-3 text-left border rounded-md transition-all bg-zinc-900/50 border-zinc-700/30 text-zinc-300 hover:border-[brand-cyan]/50 hover:bg-zinc-800/50 group"
                  >
                    <div className="flex items-start gap-3">
                      <FolderOpen size={16} className="text-brand-cyan flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm text-zinc-200 truncate">
                          {project.name || 'Untitled'}
                        </div>
                        {project.prompt && (
                          <div className="text-xs text-zinc-500 mt-1 line-clamp-2">
                            {project.prompt}
                          </div>
                        )}
                        {project.createdAt && (
                          <div className="text-[10px] text-zinc-600 mt-1">
                            {formatDate(project.createdAt)}
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="col-span-full text-center py-8">
                <p className="text-sm text-zinc-500 font-mono">
                  {searchQuery ? 'No projects found matching your search' : 'No projects found'}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-800/60 flex gap-2">
          <button
            onClick={handleCreateNew}
            className="flex-1 px-4 py-2 bg-brand-cyan/90 hover:bg-brand-cyan text-black font-semibold rounded-md text-sm font-mono transition-all duration-300 hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2"
          >
            <Plus size={16} />
            Create New Project
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-zinc-800/50 hover:bg-zinc-700/50 text-zinc-300 rounded-md text-sm font-mono transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

