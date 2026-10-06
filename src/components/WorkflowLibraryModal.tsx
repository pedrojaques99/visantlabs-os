import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Search, Users, Layout, Globe, BookMarked } from '@/lib/ui/icons';
import { Input } from './ui/input';
import { WorkflowCard } from './WorkflowCard';
import { ConfirmationModal } from './ConfirmationModal';
import { EditWorkflowModal } from './EditWorkflowModal';
import type { CanvasWorkflow } from '../services/workflowApi';
import { workflowApi } from '../services/workflowApi';
import { clearWorkflowCache } from '../services/workflowService';
import type { WorkflowCategory } from '../types/workflow';
import { WORKFLOW_CATEGORY_CONFIG } from '../types/workflow';
import { toast } from 'sonner';
import { cn } from '../lib/utils';
import { glassSurface } from '@/lib/ui/glass';
import { Button } from '@/components/ui/button';

interface WorkflowLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoadWorkflow: (workflow: CanvasWorkflow) => void;
  isAuthenticated: boolean;
  isAdmin: boolean;
  t: (key: string) => string;
}

export const WorkflowLibraryModal: React.FC<WorkflowLibraryModalProps> = ({
  isOpen,
  onClose,
  onLoadWorkflow,
  isAuthenticated,
  isAdmin,
  t,
}) => {
  const [activeTab, setActiveTab] = useState<'my' | 'community'>('community');
  const [selectedCategory, setSelectedCategory] = useState<WorkflowCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [myWorkflows, setMyWorkflows] = useState<CanvasWorkflow[]>([]);
  const [communityWorkflows, setCommunityWorkflows] = useState<CanvasWorkflow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    workflowId: string;
    workflowName: string;
  } | null>(null);
  const [editingWorkflow, setEditingWorkflow] = useState<CanvasWorkflow | null>(null);

  // Load workflows when modal opens
  useEffect(() => {
    if (isOpen) {
      // Reset state when opening
      setSearchQuery('');
      loadWorkflows();

      // Lock body scroll
      document.body.style.overflow = 'hidden';

      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Escape') onClose();
      };
      window.addEventListener('keydown', handleKeyDown);

      return () => {
        document.body.style.overflow = '';
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [isOpen, activeTab, selectedCategory]);

  const loadWorkflows = async () => {
    setIsLoading(true);
    try {
      if (activeTab === 'my' && isAuthenticated) {
        const workflows = await workflowApi.getAll();
        setMyWorkflows(workflows);
      } else if (activeTab === 'community') {
        const workflows = await workflowApi.getPublic(
          selectedCategory === 'all' ? undefined : selectedCategory
        );
        setCommunityWorkflows(workflows);
      }
    } catch (error) {
      console.error('Error loading workflows:', error);
      toast.error(t('workflows.errors.failedToLoad'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleLike = async (workflowId: string) => {
    if (!isAuthenticated) {
      toast.error(t('workflows.errors.mustBeAuthenticated'));
      return;
    }

    try {
      const liked = await workflowApi.toggleLike(workflowId);

      // Update local state
      const updateWorkflows = (workflows: CanvasWorkflow[]) =>
        workflows.map((w) =>
          w._id === workflowId
            ? {
                ...w,
                isLikedByUser: liked,
                likesCount: liked ? w.likesCount + 1 : w.likesCount - 1,
              }
            : w
        );

      if (activeTab === 'my') {
        setMyWorkflows(updateWorkflows);
      } else {
        setCommunityWorkflows(updateWorkflows);
      }

      toast.success(liked ? t('workflows.messages.liked') : t('workflows.messages.unliked'));
    } catch (error) {
      console.error('Error toggling like:', error);
      toast.error(t('workflows.errors.failedToToggleLike'));
    }
  };

  const handleDuplicate = async (workflowId: string) => {
    if (!isAuthenticated) {
      toast.error(t('workflows.errors.mustBeAuthenticated'));
      return;
    }

    try {
      const duplicated = await workflowApi.duplicate(workflowId);

      // Append (Copy) to the duplicated workflow name to clarify it's a copy
      if (duplicated) {
        await workflowApi.update(duplicated._id, {
          name: `${duplicated.name} (Copy)`,
        });
      }

      toast.success(t('workflows.messages.duplicated'));

      // Refresh my workflows if on that tab
      if (activeTab === 'my') {
        loadWorkflows();
      }
    } catch (error) {
      console.error('Error duplicating workflow:', error);
      toast.error(t('workflows.errors.failedToDuplicate'));
    }
  };

  const handleDelete = async (workflowId: string) => {
    try {
      await workflowApi.delete(workflowId);
      toast.success(t('workflows.messages.deleted'));

      // Remove from local state
      setMyWorkflows((prev) => prev.filter((w) => w._id !== workflowId));
      setCommunityWorkflows((prev) => prev.filter((w) => w._id !== workflowId));

      // Clear cache
      clearWorkflowCache();

      setDeleteConfirmation(null);
    } catch (error) {
      console.error('Error deleting workflow:', error);
      toast.error(t('workflows.errors.failedToDelete'));
    }
  };

  const handleLoadWorkflow = (workflow: CanvasWorkflow) => {
    // Create a copy of the workflow with (Copy) in the name
    const workflowCopy = {
      ...workflow,
      name: workflow.name.endsWith(' (Copy)') ? workflow.name : `${workflow.name} (Copy)`,
    };
    onLoadWorkflow(workflowCopy);
    onClose();
  };

  if (!isOpen) return null;

  // Filter workflows by search query
  const filterWorkflows = (workflows: CanvasWorkflow[]) => {
    if (!searchQuery.trim()) return workflows;

    const query = searchQuery.toLowerCase();
    return workflows.filter(
      (w) =>
        w.name.toLowerCase().includes(query) ||
        w.description.toLowerCase().includes(query) ||
        w.tags.some((tag) => tag.toLowerCase().includes(query))
    );
  };

  const displayedWorkflows =
    activeTab === 'my' ? filterWorkflows(myWorkflows) : filterWorkflows(communityWorkflows);

  const modalContent = (
    <>
      <div
        className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4"
        style={{ animation: 'fadeIn 0.2s ease-out' }}
        onClick={onClose}
      >
        <div
          className={cn(
            glassSurface.panelStrong,
            'relative max-w-6xl w-full max-h-[90vh] rounded-md overflow-hidden flex flex-col'
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border bg-card/20">
            <div className="flex items-center gap-2">
              <Layout size={20} className="text-muted-foreground" />
              <h2 className="text-sm font-medium text-foreground">
                {t('workflows.library.title')}
              </h2>
            </div>
            <Button
              variant="ghost"
              onClick={onClose}
              className="p-2 text-muted-foreground hover:text-foreground transition-colors hover:bg-accent rounded-full"
            >
              <X size={20} />
            </Button>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 px-4 pt-4 border-b border-border bg-card/10">
            <Button
              variant="ghost"
              onClick={() => setActiveTab('community')}
              className={cn(
                'px-4 py-2 text-xs transition-colors duration-200 border-b-2 flex items-center gap-1.5 relative rounded-t-md',
                activeTab === 'community'
                  ? 'text-brand-cyan border-ring bg-brand-cyan/5'
                  : 'text-muted-foreground border-transparent hover:text-foreground hover:bg-accent'
              )}
            >
              <Globe size={12} />
              {t('common.community')}
            </Button>

            {isAuthenticated && (
              <Button
                variant="ghost"
                onClick={() => setActiveTab('my')}
                className={cn(
                  'px-4 py-2 text-xs transition-colors duration-200 border-b-2 flex items-center gap-1.5 relative rounded-t-md',
                  activeTab === 'my'
                    ? 'text-brand-cyan border-ring bg-brand-cyan/5'
                    : 'text-muted-foreground border-transparent hover:text-foreground hover:bg-accent'
                )}
              >
                <BookMarked size={12} />
                {t('workflows.library.tabs.my')}
              </Button>
            )}
          </div>

          {/* Controls Row: Search & Filters */}
          <div className="flex flex-col sm:flex-row gap-4 p-4 border-b border-border bg-card/5">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('workflows.library.search')}
                className="pl-9 h-9 bg-card/50 border-border focus:border-ring focus:ring-1 focus:ring-ring text-xs w-full"
              />
            </div>

            {/* Category filters */}
            {activeTab === 'community' && (
              <div className="flex gap-2 overflow-x-auto scrollbar-thin scrollbar-thumb-neutral-700 scrollbar-track-transparent items-center">
                <Button
                  variant="ghost"
                  onClick={() => setSelectedCategory('all')}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition-colors whitespace-nowrap border',
                    selectedCategory === 'all'
                      ? 'bg-brand-cyan/10 text-brand-cyan border-brand-cyan/30'
                      : 'bg-card/50 text-muted-foreground border-border hover:bg-accent hover:border-border-hover'
                  )}
                >
                  <Layout size={12} />
                  {t('workflows.library.tabs.all')}
                </Button>
                {Object.entries(WORKFLOW_CATEGORY_CONFIG).map(([key, config]) => {
                  const Icon = config.icon;
                  return (
                    <Button
                      variant="ghost"
                      key={key}
                      onClick={() => setSelectedCategory(key as WorkflowCategory)}
                      className={cn(
                        'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition-colors whitespace-nowrap border',
                        selectedCategory === key
                          ? 'bg-brand-cyan/10 text-brand-cyan border-brand-cyan/30'
                          : 'bg-card/50 text-muted-foreground border-border hover:bg-accent hover:border-border-hover'
                      )}
                    >
                      <Icon size={12} />
                      {config.label}
                    </Button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 relative custom-scrollbar bg-background/50">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center h-64 gap-2">
                <div className="w-6 h-6 border-2 border-muted border-t-foreground rounded-full animate-spin"></div>
                <p className="text-xs text-muted-foreground">{t('common.loading')}</p>
              </div>
            ) : displayedWorkflows.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                <Search className="w-8 h-8 opacity-40 mb-2" />
                <p className="text-sm">
                  {searchQuery
                    ? t('workflows.library.noResults')
                    : activeTab === 'my'
                      ? t('workflows.library.noWorkflows')
                      : t('workflows.library.noCommunityWorkflows')}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-20">
                {displayedWorkflows.map((workflow) => (
                  <WorkflowCard
                    key={workflow._id}
                    workflow={workflow}
                    onClick={() => handleLoadWorkflow(workflow)}
                    onToggleLike={() => handleToggleLike(workflow._id)}
                    onDuplicate={() => handleDuplicate(workflow._id)}
                    onDelete={
                      isAdmin || activeTab === 'my'
                        ? () =>
                            setDeleteConfirmation({
                              workflowId: workflow._id,
                              workflowName: workflow.name,
                            })
                        : undefined
                    }
                    onEdit={() => setEditingWorkflow(workflow)}
                    isAuthenticated={isAuthenticated}
                    canEdit={isAdmin}
                    t={t}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirmation && (
        <ConfirmationModal
          isOpen={true}
          title={t('workflows.deleteConfirmation.title')}
          message={t('workflows.deleteConfirmation.message')}
          confirmText={t('common.delete')}
          cancelText={t('common.cancel')}
          onConfirm={() => handleDelete(deleteConfirmation.workflowId)}
          onClose={() => setDeleteConfirmation(null)}
          variant="danger"
        />
      )}

      {/* Edit Workflow Modal */}
      {editingWorkflow && (
        <EditWorkflowModal
          isOpen={true}
          workflow={editingWorkflow}
          onClose={() => setEditingWorkflow(null)}
          onSave={(updated) => {
            // Refresh workflows to show updated info
            loadWorkflows();
            setEditingWorkflow(null);
          }}
          t={t}
        />
      )}
    </>
  );

  return createPortal(modalContent, document.body);
};
