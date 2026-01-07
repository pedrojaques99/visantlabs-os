import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Save, Share2, Tags, Folder, FileType, Info } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Select } from './ui/select';
import { Switch } from './ui/switch';
import type { Node, Edge } from '@xyflow/react';
import type { WorkflowCategory } from '../types/workflow';
import { WORKFLOW_CATEGORY_CONFIG } from '../types/workflow';
import { cn } from '../lib/utils';

interface SaveWorkflowDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (metadata: {
        name: string;
        description: string;
        category: WorkflowCategory;
        tags: string[];
        isPublic: boolean;
    }) => Promise<void>;
    nodes: Node[];
    edges: Edge[];
    t: (key: string) => string;
}

export const SaveWorkflowDialog: React.FC<SaveWorkflowDialogProps> = ({
    isOpen,
    onClose,
    onSave,
    nodes,
    edges,
    t,
}) => {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [category, setCategory] = useState<WorkflowCategory>('general');
    const [tagsInput, setTagsInput] = useState('');
    const [isPublic, setIsPublic] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // Reset form when opening
    useEffect(() => {
        if (isOpen) {
            setName('');
            setDescription('');
            setCategory('general');
            setTagsInput('');
            setIsPublic(false);

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
    }, [isOpen]);

    if (!isOpen) return null;

    const handleSave = async () => {
        if (!name.trim() || !description.trim()) {
            return;
        }

        setIsSaving(true);
        try {
            const tags = tagsInput
                .split(',')
                .map(tag => tag.trim())
                .filter(tag => tag.length > 0);

            await onSave({
                name: name.trim(),
                description: description.trim(),
                category,
                tags,
                isPublic,
            });

            onClose();
        } catch (error) {
            console.error('Error saving workflow:', error);
        } finally {
            setIsSaving(false);
        }
    };

    const nodeCount = nodes.length;
    const edgeCount = edges.length;

    const modalContent = (
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
            onClick={onClose}
        >
            <div
                className="relative w-full max-w-2xl bg-gradient-to-br from-[#1A1A1A] via-[#1A1A1A] to-[#1F1F1F] border border-zinc-800/60 rounded-xl shadow-2xl flex flex-col overflow-hidden animate-slide-up"
                onClick={(e) => e.stopPropagation()}
                style={{
                    backgroundImage: 'radial-gradient(circle at 50% 0%, rgba(82, 221, 235, 0.03), transparent 50%)',
                }}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-zinc-800/60 bg-zinc-900/20 backdrop-blur-sm">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-brand-cyan/10 rounded-lg border border-brand-cyan/20">
                            <Save size={20} className="text-brand-cyan" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-zinc-200 font-mono tracking-tight">
                                {t('workflows.saveDialog.title') || 'Save Workflow'}
                            </h2>
                            <p className="text-xs text-zinc-500 font-mono mt-0.5">
                                {t('workflows.saveDialog.description') || 'Save your canvas as a reusable workflow template'}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg hover:bg-zinc-800/50 text-zinc-400 hover:text-zinc-200 transition-all hover:scale-110 active:scale-95"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(85vh-140px)] custom-scrollbar">
                    {/* Stats */}
                    <div className="flex items-center gap-4 px-4 py-3 bg-zinc-900/40 border border-zinc-800/60 rounded-lg">
                        <div className="flex items-center gap-2 text-xs font-mono text-zinc-400">
                            <FileType size={14} className="text-brand-cyan/70" />
                            <span>{nodeCount} {t('workflows.saveDialog.nodes') || 'nodes'}</span>
                        </div>
                        <div className="w-px h-3 bg-zinc-800" />
                        <div className="flex items-center gap-2 text-xs font-mono text-zinc-400">
                            <Share2 size={14} className="text-brand-cyan/70" />
                            <span>{edgeCount} {t('workflows.saveDialog.connections') || 'connections'}</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Name */}
                        <div className="space-y-2 md:col-span-2">
                            <label className="text-xs font-mono text-zinc-400 ml-1">
                                {t('workflows.saveDialog.name') || 'Workflow Name'} <span className="text-red-400">*</span>
                            </label>
                            <Input
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder={t('workflows.saveDialog.namePlaceholder') || 'e.g., Brand Identity Workflow'}
                                className="font-mono bg-zinc-900/50 border-zinc-800 focus:border-brand-cyan/50 focus:ring-brand-cyan/20"
                            />
                        </div>

                        {/* Category */}
                        <div className="space-y-2">
                            <label className="text-xs font-mono text-zinc-400 ml-1 flex items-center gap-1.5">
                                <Folder size={12} />
                                {t('workflows.saveDialog.category') || 'Category'}
                            </label>
                            <Select
                                value={category}
                                onChange={(value) => setCategory(value as WorkflowCategory)}
                                options={Object.entries(WORKFLOW_CATEGORY_CONFIG)
                                    .filter(([key]) => key !== 'all')
                                    .map(([key, config]) => ({
                                        value: key,
                                        label: config.label
                                    }))}
                                className="w-full bg-zinc-900/50 border-zinc-800"
                            />
                        </div>

                        {/* Tags */}
                        <div className="space-y-2">
                            <label className="text-xs font-mono text-zinc-400 ml-1 flex items-center gap-1.5">
                                <Tags size={12} />
                                {t('workflows.saveDialog.tags') || 'Tags'}
                            </label>
                            <Input
                                value={tagsInput}
                                onChange={(e) => setTagsInput(e.target.value)}
                                placeholder={t('workflows.saveDialog.tagsPlaceholder') || 'branding, logo, identity'}
                                className="font-mono bg-zinc-900/50 border-zinc-800 focus:border-brand-cyan/50 focus:ring-brand-cyan/20"
                            />
                        </div>

                        {/* Description */}
                        <div className="space-y-2 md:col-span-2">
                            <label className="text-xs font-mono text-zinc-400 ml-1 flex items-center gap-1.5">
                                <Info size={12} />
                                {t('workflows.saveDialog.description') || 'Description'} <span className="text-red-400">*</span>
                            </label>
                            <Textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder={t('workflows.saveDialog.descriptionPlaceholder') || 'Describe what this workflow does...'}
                                className="font-mono min-h-[100px] bg-zinc-900/50 border-zinc-800 focus:border-brand-cyan/50 focus:ring-brand-cyan/20 resize-none"
                            />
                        </div>

                        {/* Public Toggle */}
                        <div className="md:col-span-2 p-4 bg-zinc-900/30 border border-zinc-800/50 rounded-lg hover:border-zinc-700/50 transition-colors">
                            <div className="flex items-center justify-between">
                                <div className="space-y-1">
                                    <label className="text-sm font-semibold text-zinc-300 flex items-center gap-2">
                                        <GlobeIcon isPublic={isPublic} />
                                        {t('workflows.saveDialog.makePublic') || 'Make Public'}
                                    </label>
                                    <p className="text-xs text-zinc-500 font-mono">
                                        {t('workflows.saveDialog.makePublicHint') || 'Share this workflow with the community (requires approval)'}
                                    </p>
                                </div>
                                <Switch
                                    checked={isPublic}
                                    onCheckedChange={setIsPublic}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-zinc-800/60 bg-zinc-900/30 backdrop-blur-sm flex justify-end gap-3">
                    <Button
                        variant="ghost"
                        onClick={onClose}
                        disabled={isSaving}
                        className="font-mono hover:bg-zinc-800/50 text-zinc-400 hover:text-zinc-200"
                    >
                        {t('common.cancel') || 'Cancel'}
                    </Button>
                    <Button
                        variant="brand"
                        onClick={handleSave}
                        disabled={!name.trim() || !description.trim() || isSaving}
                        className="font-mono min-w-[140px] shadow-lg shadow-brand-cyan/10"
                    >
                        {isSaving ? (
                            <span className="flex items-center gap-2">
                                <Loader2Icon />
                                {t('workflows.saveDialog.saving') || 'Saving...'}
                            </span>
                        ) : (
                            <span className="flex items-center gap-2">
                                <Save size={16} />
                                {t('workflows.saveDialog.save') || 'Save Workflow'}
                            </span>
                        )}
                    </Button>
                </div>
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
};

// Helper components
const GlobeIcon = ({ isPublic }: { isPublic: boolean }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={cn("transition-colors", isPublic ? "text-brand-cyan" : "text-zinc-500")}
    >
        <circle cx="12" cy="12" r="10" />
        <line x1="2" x2="22" y1="12" y2="12" />
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1 4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
);

const Loader2Icon = () => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="animate-spin"
    >
        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
);
