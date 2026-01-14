import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Save, Loader2, Globe, Lock } from 'lucide-react';
import { Button } from './ui/button';
import { Select } from './ui/select';
import { Textarea } from './ui/textarea';
import type { CanvasWorkflow } from '../services/workflowApi';
import { workflowApi } from '../services/workflowApi';
import type { WorkflowCategory } from '../types/workflow';
import { WORKFLOW_CATEGORY_CONFIG } from '../types/workflow';
import { cn } from '../lib/utils';
import { Input } from './ui/input';

interface EditWorkflowModalProps {
    isOpen: boolean;
    workflow: CanvasWorkflow;
    onClose: () => void;
    onSave: (updated: CanvasWorkflow) => void;
    t: (key: string) => string;
}

export const EditWorkflowModal: React.FC<EditWorkflowModalProps> = ({
    isOpen,
    workflow,
    onClose,
    onSave,
    t,
}) => {
    const [name, setName] = useState(workflow.name);
    const [description, setDescription] = useState(workflow.description);
    const [category, setCategory] = useState<WorkflowCategory>(workflow.category as WorkflowCategory);
    const [tags, setTags] = useState(workflow.tags.join(', '));
    const [isPublic, setIsPublic] = useState(workflow.isPublic);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (workflow) {
            setName(workflow.name);
            setDescription(workflow.description);
            setCategory(workflow.category as WorkflowCategory);
            setTags(workflow.tags.join(', '));
            setIsPublic(workflow.isPublic);
        }
    }, [workflow]);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const updated = await workflowApi.update(workflow._id, {
                name,
                description,
                category,
                tags: tags.split(',').map(tag => tag.trim()).filter(Boolean),
                isPublic,
            });
            onSave(updated);
            onClose();
        } catch (error) {
            console.error('Error updating workflow:', error);
        } finally {
            setIsSaving(false);
        }
    };

    if (!isOpen || !workflow) return null;

    return createPortal(
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[10000] flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
            <div className="relative max-w-md w-full bg-neutral-900 border border-neutral-800/60 rounded-xl shadow-2xl flex flex-col overflow-hidden animate-slide-up" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between p-6 border-b border-neutral-800/60 bg-neutral-900/20">
                    <h2 className="text-lg font-semibold text-neutral-200 font-manrope tracking-tight">{t('workflows.edit.title') || 'Edit Workflow'}</h2>
                    <button onClick={onClose} className="p-2 text-neutral-500 hover:text-white transition-all hover:bg-neutral-800/50 rounded-lg">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 space-y-5">
                    <div className="space-y-2">
                        <label className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest ml-1">{t('workflows.edit.name') || 'Name'}</label>
                        <Input value={name} onChange={e => setName(e.target.value)} className="bg-neutral-900/50 border-neutral-800 focus:border-brand-cyan/30" />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest ml-1">{t('workflows.edit.description') || 'Description'}</label>
                        <Textarea
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            className="bg-neutral-900/50 border-neutral-800 focus:border-brand-cyan/30 h-24 resize-none"
                        />
                    </div>
                    <div className="flex gap-4">
                        <div className="flex-1 space-y-2">
                            <label className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest ml-1">{t('workflows.edit.category') || 'Category'}</label>
                            <Select
                                value={category}
                                onChange={(val) => setCategory(val as WorkflowCategory)}
                                options={Object.entries(WORKFLOW_CATEGORY_CONFIG).map(([key, config]) => ({
                                    value: key,
                                    label: config.label
                                }))}
                                className="bg-neutral-900/50 border-neutral-800"
                            />
                        </div>
                        <div className="w-32 space-y-2">
                            <label className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest ml-1">{t('workflows.edit.visibility') || 'Visibility'}</label>
                            <button
                                onClick={() => setIsPublic(!isPublic)}
                                className={cn(
                                    "w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md border text-[10px] font-mono uppercase tracking-wider transition-all h-[40px]",
                                    isPublic
                                        ? "bg-brand-cyan/10 border-brand-cyan/30 text-brand-cyan"
                                        : "bg-neutral-900/50 border-neutral-800 text-neutral-500"
                                )}
                            >
                                {isPublic ? <Globe size={14} /> : <Lock size={14} />}
                                {isPublic ? t('workflows.visibility.public') || 'Public' : t('workflows.visibility.private') || 'Private'}
                            </button>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest ml-1">{t('workflows.edit.tags') || 'Tags (comma separated)'}</label>
                        <Input value={tags} onChange={e => setTags(e.target.value)} className="bg-neutral-900/50 border-neutral-800 focus:border-brand-cyan/30" />
                    </div>
                </div>

                <div className="p-6 border-t border-neutral-800/60 bg-neutral-900/20 flex justify-end gap-3">
                    <Button
                        variant="ghost"
                        onClick={onClose}
                        className="font-mono text-neutral-400 hover:text-neutral-200"
                    >
                        {t('common.cancel') || 'Cancel'}
                    </Button>
                    <Button
                        variant="brand"
                        onClick={handleSave}
                        disabled={isSaving}
                        className="min-w-[120px]"
                    >
                        {isSaving ? <Loader2 size={14} className="animate-spin mr-2" /> : <Save size={14} className="mr-2" />}
                        {t('common.save') || 'Save Changes'}
                    </Button>
                </div>
            </div>
        </div>,
        document.body
    );
};
