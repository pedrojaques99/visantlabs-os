import React, { useState, useEffect } from 'react';
import { Copy, Download, Edit2, Trash2, Heart, Play } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../lib/utils';
import { authService } from '../services/authService';
import type { CanvasWorkflow } from '../services/workflowApi';
import { WORKFLOW_CATEGORY_CONFIG } from '../types/workflow';

interface WorkflowCardProps {
    workflow: CanvasWorkflow;
    onClick?: () => void;
    onEdit?: () => void;
    onDelete?: () => void;
    onDuplicate?: () => void;
    onToggleLike?: () => void;
    isAuthenticated: boolean;
    canEdit: boolean;
    t: (key: string) => string;
}

export const WorkflowCard: React.FC<WorkflowCardProps> = ({
    workflow,
    onClick,
    onEdit,
    onDelete,
    onDuplicate,
    onToggleLike,
    isAuthenticated,
    canEdit,
    t,
}) => {
    const categoryConfig = WORKFLOW_CATEGORY_CONFIG[workflow.category as keyof typeof WORKFLOW_CATEGORY_CONFIG] || WORKFLOW_CATEGORY_CONFIG.general;
    const CategoryIcon = categoryConfig.icon;
    const isLiked = workflow.isLikedByUser || false;
    const likesCount = workflow.likesCount || 0;
    const usageCount = workflow.usageCount || 0;
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const isOwner = currentUserId && workflow.userId && currentUserId === workflow.userId;

    useEffect(() => {
        const getCurrentUser = async () => {
            if (isAuthenticated) {
                const user = await authService.verifyToken();
                if (user) {
                    setCurrentUserId(user.id);
                }
            }
        };
        getCurrentUser();
    }, [isAuthenticated]);

    const nodeCount = Array.isArray(workflow.nodes) ? workflow.nodes.length : 0;
    const edgeCount = Array.isArray(workflow.edges) ? workflow.edges.length : 0;

    return (
        <div
            className="bg-card border border-zinc-800/50 rounded-md p-4 hover:border-brand-cyan/30 hover:bg-card/80 transition-all group relative cursor-pointer"
            onClick={onClick}
        >
            <div className="mb-3">
                {workflow.thumbnailUrl ? (
                    <div className="relative w-full aspect-video rounded-md overflow-hidden border border-zinc-700/30 bg-zinc-900/30">
                        <img
                            src={workflow.thumbnailUrl}
                            alt={workflow.name}
                            className="w-full h-full object-cover bg-zinc-900/50 group-hover:scale-105 transition-transform duration-300"
                            onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                            }}
                        />
                    </div>
                ) : (
                    <div className="w-full aspect-video rounded-md border border-zinc-700/30 bg-zinc-900/30 flex items-center justify-center">
                        <div className="text-zinc-500">
                            <CategoryIcon size={32} />
                        </div>
                    </div>
                )}
            </div>

            <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                        <h3 className="text-base font-semibold text-zinc-200 mb-0.5 font-mono line-clamp-1">
                            {workflow.name}
                        </h3>
                        <p className="text-xs text-zinc-500 font-mono line-clamp-2 leading-snug">
                            {workflow.description}
                        </p>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                        {isAuthenticated && onDuplicate && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onDuplicate();
                                }}
                                className="p-1.5 text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-300 rounded transition-colors opacity-0 group-hover:opacity-100"
                                title={isOwner ? t('workflows.actions.duplicate') || 'Duplicate' : t('workflows.actions.addToLibrary') || 'Add to Library'}
                            >
                                {isOwner ? <Copy className="h-4 w-4" /> : <Download className="h-4 w-4" />}
                            </button>
                        )}
                        {isOwner && onEdit && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onEdit?.();
                                }}
                                className="p-1.5 text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-300 rounded transition-colors opacity-0 group-hover:opacity-100"
                                title={t('workflows.actions.edit') || 'Edit'}
                            >
                                <Edit2 className="h-4 w-4" />
                            </button>
                        )}
                        {canEdit && onEdit && onDelete && (
                            <>
                                {!isOwner && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onEdit?.();
                                        }}
                                        className="p-1.5 text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-300 rounded transition-colors opacity-0 group-hover:opacity-100"
                                        title={t('workflows.actions.edit') || 'Edit'}
                                    >
                                        <Edit2 className="h-4 w-4" />
                                    </button>
                                )}
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onDelete?.();
                                    }}
                                    className="p-1.5 text-zinc-500 hover:bg-red-500/10 hover:text-red-400 rounded transition-colors opacity-0 group-hover:opacity-100"
                                    title={t('workflows.actions.delete') || 'Delete'}
                                >
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {/* Tags and metadata */}
                <div className="flex items-center gap-2 overflow-x-auto scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent scroll-smooth">
                    <span
                        className={cn(
                            'px-2 py-0.5 rounded border font-mono text-xs flex-shrink-0 whitespace-nowrap',
                            categoryConfig.color.replace('text-', 'bg-').replace('-400', '-500/20'),
                            categoryConfig.color.replace('text-', 'border-').replace('-400', '-500/30'),
                            categoryConfig.color
                        )}
                    >
                        {categoryConfig.label}
                    </span>
                    <span className="px-2 py-0.5 bg-zinc-800/40 rounded border border-zinc-700/30 text-zinc-500 font-mono text-xs flex-shrink-0 whitespace-nowrap">
                        {nodeCount} nodes
                    </span>
                    <span className="px-2 py-0.5 bg-zinc-800/40 rounded border border-zinc-700/30 text-zinc-500 font-mono text-xs flex-shrink-0 whitespace-nowrap">
                        {edgeCount} edges
                    </span>
                    {usageCount > 0 && (
                        <span className="px-2 py-0.5 bg-zinc-800/40 rounded border border-zinc-700/30 text-zinc-500 font-mono text-xs flex-shrink-0 whitespace-nowrap flex items-center gap-1">
                            <Play size={10} />
                            {usageCount}
                        </span>
                    )}
                    {isAuthenticated && onToggleLike && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onToggleLike();
                            }}
                            className={`flex items-center gap-1 px-2 py-0.5 rounded-md transition-all text-xs font-mono flex-shrink-0 whitespace-nowrap ${isLiked
                                    ? 'bg-zinc-800/50 text-zinc-300 hover:bg-zinc-700/50'
                                    : 'bg-zinc-900/40 text-zinc-500 hover:bg-zinc-800/50 hover:text-zinc-400'
                                }`}
                            title={isLiked ? t('workflows.actions.unlike') || 'Unlike' : t('workflows.actions.like') || 'Like'}
                        >
                            <Heart size={12} className={isLiked ? 'fill-current' : ''} />
                            <span>{likesCount}</span>
                        </button>
                    )}
                </div>

                {/* Tags */}
                {workflow.tags && workflow.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                        {workflow.tags.map((tag, index) => (
                            <span
                                key={index}
                                className="px-1.5 py-0.5 bg-zinc-800/40 rounded border border-zinc-700/20 text-zinc-500 font-mono text-[10px] hover:border-zinc-600/40 hover:text-zinc-400 transition-colors"
                                title={tag}
                            >
                                #{tag}
                            </span>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};
