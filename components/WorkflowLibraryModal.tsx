import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Search, Loader2, Users, Layout, Globe, BookMarked } from 'lucide-react';
import { Input } from './ui/input';
import { WorkflowCard } from './WorkflowCard';
import { ConfirmationModal } from './ConfirmationModal';
import type { CanvasWorkflow } from '../services/workflowApi';
import { workflowApi } from '../services/workflowApi';
import { clearWorkflowCache } from '../services/workflowService';
import type { WorkflowCategory } from '../types/workflow';
import { WORKFLOW_CATEGORY_CONFIG } from '../types/workflow';
import { toast } from 'sonner';
import { cn } from '../lib/utils';

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
    const [activeTab, setActiveTab] = useState<'my' | 'community' | 'all'>('community');
    const [selectedCategory, setSelectedCategory] = useState<WorkflowCategory>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [myWorkflows, setMyWorkflows] = useState<CanvasWorkflow[]>([]);
    const [communityWorkflows, setCommunityWorkflows] = useState<CanvasWorkflow[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [deleteConfirmation, setDeleteConfirmation] = useState<{ workflowId: string; workflowName: string } | null>(null);

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
            } else if (activeTab === 'community' || activeTab === 'all') {
                const workflows = await workflowApi.getPublic(selectedCategory);
                setCommunityWorkflows(workflows);
            }
        } catch (error) {
            console.error('Error loading workflows:', error);
            toast.error(t('workflows.errors.failedToLoad') || 'Failed to load workflows');
        } finally {
            setIsLoading(false);
        }
    };

    const handleToggleLike = async (workflowId: string) => {
        if (!isAuthenticated) {
            toast.error(t('workflows.errors.mustBeAuthenticated') || 'You must be logged in to like workflows');
            return;
        }

        try {
            const liked = await workflowApi.toggleLike(workflowId);

            // Update local state
            const updateWorkflows = (workflows: CanvasWorkflow[]) =>
                workflows.map(w =>
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

            toast.success(liked ? t('workflows.messages.liked') || 'Workflow liked!' : t('workflows.messages.unliked') || 'Workflow unliked');
        } catch (error) {
            console.error('Error toggling like:', error);
            toast.error(t('workflows.errors.failedToToggleLike') || 'Failed to toggle like');
        }
    };

    const handleDuplicate = async (workflowId: string) => {
        if (!isAuthenticated) {
            toast.error(t('workflows.errors.mustBeAuthenticated') || 'You must be logged in to duplicate workflows');
            return;
        }

        try {
            const duplicated = await workflowApi.duplicate(workflowId);
            toast.success(t('workflows.messages.duplicated') || 'Workflow added to your library!');

            // Refresh my workflows if on that tab
            if (activeTab === 'my') {
                loadWorkflows();
            }
        } catch (error) {
            console.error('Error duplicating workflow:', error);
            toast.error(t('workflows.errors.failedToDuplicate') || 'Failed to duplicate workflow');
        }
    };

    const handleDelete = async (workflowId: string) => {
        try {
            await workflowApi.delete(workflowId);
            toast.success(t('workflows.messages.deleted') || 'Workflow deleted');

            // Remove from local state
            setMyWorkflows(prev => prev.filter(w => w._id !== workflowId));
            setCommunityWorkflows(prev => prev.filter(w => w._id !== workflowId));

            // Clear cache
            clearWorkflowCache();

            setDeleteConfirmation(null);
        } catch (error) {
            console.error('Error deleting workflow:', error);
            toast.error(t('workflows.errors.failedToDelete') || 'Failed to delete workflow');
        }
    };

    const handleLoadWorkflow = (workflow: CanvasWorkflow) => {
        onLoadWorkflow(workflow);
        onClose();
    };

    if (!isOpen) return null;

    // Filter workflows by search query
    const filterWorkflows = (workflows: CanvasWorkflow[]) => {
        if (!searchQuery.trim()) return workflows;

        const query = searchQuery.toLowerCase();
        return workflows.filter(
            w =>
                w.name.toLowerCase().includes(query) ||
                w.description.toLowerCase().includes(query) ||
                w.tags.some(tag => tag.toLowerCase().includes(query))
        );
    };

    const displayedWorkflows = activeTab === 'my'
        ? filterWorkflows(myWorkflows)
        : filterWorkflows(communityWorkflows);

    const modalContent = (
        <>
            <div
                className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4"
                style={{ animation: 'fadeIn 0.2s ease-out' }}
                onClick={onClose}
            >
                <div
                    className="relative max-w-6xl w-full max-h-[90vh] bg-black/95 backdrop-blur-xl border border-zinc-800/50 rounded-md shadow-2xl overflow-hidden flex flex-col"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between p-4 border-b border-zinc-800/50 bg-zinc-900/20">
                        <div className="flex items-center gap-2">
                            <Layout size={20} className="text-brand-cyan" />
                            <div>
                                <h2 className="text-sm font-mono text-zinc-300 uppercase tracking-wider">
                                    {t('workflows.library.title') || 'Workflow Library'}
                                </h2>
                                <p className="text-[10px] text-zinc-500 font-mono hidden sm:block">
                                    {t('workflows.library.description') || 'Browse and load reusable workflow templates'}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 text-zinc-500 hover:text-white transition-colors hover:bg-zinc-800/50 rounded-full"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    {/* Tabs */}
                    <div className="flex gap-1 px-4 pt-4 border-b border-zinc-800/50 bg-zinc-900/10">
                        <button
                            onClick={() => setActiveTab('community')}
                            className={cn(
                                'px-4 py-2 text-xs font-mono uppercase transition-all duration-200 border-b-2 flex items-center gap-1.5 relative rounded-t-md',
                                activeTab === 'community'
                                    ? 'text-brand-cyan border-[brand-cyan] bg-brand-cyan/5'
                                    : 'text-zinc-400 border-transparent hover:text-zinc-300 hover:bg-zinc-800/30'
                            )}
                        >
                            <Globe size={12} />
                            {t('workflows.library.tabs.community') || 'Community'}
                        </button>

                        <button
                            onClick={() => setActiveTab('all')}
                            className={cn(
                                'px-4 py-2 text-xs font-mono uppercase transition-all duration-200 border-b-2 flex items-center gap-1.5 relative rounded-t-md',
                                activeTab === 'all'
                                    ? 'text-brand-cyan border-[brand-cyan] bg-brand-cyan/5'
                                    : 'text-zinc-400 border-transparent hover:text-zinc-300 hover:bg-zinc-800/30'
                            )}
                        >
                            <Layout size={12} />
                            {t('workflows.library.tabs.all') || 'All'}
                        </button>

                        {isAuthenticated && (
                            <button
                                onClick={() => setActiveTab('my')}
                                className={cn(
                                    'px-4 py-2 text-xs font-mono uppercase transition-all duration-200 border-b-2 flex items-center gap-1.5 relative rounded-t-md',
                                    activeTab === 'my'
                                        ? 'text-brand-cyan border-[brand-cyan] bg-brand-cyan/5'
                                        : 'text-zinc-400 border-transparent hover:text-zinc-300 hover:bg-zinc-800/30'
                                )}
                            >
                                <BookMarked size={12} />
                                {t('workflows.library.tabs.my') || 'My Workflows'}
                            </button>
                        )}
                    </div>

                    {/* Controls Row: Search & Filters */}
                    <div className="flex flex-col sm:flex-row gap-4 p-4 border-b border-zinc-800/50 bg-zinc-900/5">
                        <div className="relative flex-1 max-w-md">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
                            <Input
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder={t('workflows.library.search') || 'Search workflows...'}
                                className="pl-9 h-9 bg-zinc-900/50 border-zinc-800/50 focus:border-brand-cyan/30 focus:ring-1 focus:ring-brand-cyan/30 font-mono text-xs w-full"
                            />
                        </div>

                        {/* Category filters */}
                        {(activeTab === 'community' || activeTab === 'all') && (
                            <div className="flex gap-2 overflow-x-auto scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent items-center">
                                {Object.entries(WORKFLOW_CATEGORY_CONFIG).map(([key, config]) => {
                                    const Icon = config.icon;
                                    return (
                                        <button
                                            key={key}
                                            onClick={() => setSelectedCategory(key as WorkflowCategory)}
                                            className={cn(
                                                'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-mono uppercase transition-all whitespace-nowrap border',
                                                selectedCategory === key
                                                    ? 'bg-brand-cyan/10 text-brand-cyan border-brand-cyan/30'
                                                    : 'bg-zinc-900/50 text-zinc-400 border-zinc-800 hover:bg-zinc-800 hover:border-zinc-700'
                                            )}
                                        >
                                            <Icon size={12} />
                                            {config.label}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto p-4 relative custom-scrollbar bg-black/50">
                        {isLoading ? (
                            <div className="flex flex-col items-center justify-center h-64 gap-2">
                                <div className="w-6 h-6 border-2 border-brand-cyan/30 border-t-brand-cyan rounded-full animate-spin"></div>
                                <p className="text-xs font-mono text-zinc-500">Loading workflows...</p>
                            </div>
                        ) : displayedWorkflows.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-64 text-zinc-500">
                                <Search className="w-8 h-8 opacity-20 mb-2" />
                                <p className="text-sm font-mono">
                                    {searchQuery
                                        ? t('workflows.library.noResults') || 'No workflows found'
                                        : activeTab === 'my'
                                            ? t('workflows.library.noWorkflows') || 'No workflows yet'
                                            : t('workflows.library.noCommunityWorkflows') || 'No community workflows available'}
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
                                                ? () => setDeleteConfirmation({ workflowId: workflow._id, workflowName: workflow.name })
                                                : undefined
                                        }
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
                    title={t('workflows.deleteConfirmation.title') || 'Delete Workflow'}
                    message={
                        t('workflows.deleteConfirmation.message') ||
                        `Are you sure you want to delete "${deleteConfirmation.workflowName}"? This action cannot be undone.`
                    }
                    confirmText={t('workflows.deleteConfirmation.confirm') || 'Delete'}
                    cancelText={t('workflows.deleteConfirmation.cancel') || 'Cancel'}
                    onConfirm={() => handleDelete(deleteConfirmation.workflowId)}
                    onClose={() => setDeleteConfirmation(null)}
                    variant="danger"
                />
            )}
        </>
    );

    return createPortal(modalContent, document.body);
};
