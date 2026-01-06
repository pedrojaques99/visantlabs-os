import React, { useState } from 'react';
import { X } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Select } from './ui/select';
import { Switch } from './ui/switch';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/card';
import type { Node, Edge } from '@xyflow/react';
import type { WorkflowCategory } from '../types/workflow';
import { WORKFLOW_CATEGORY_CONFIG } from '../types/workflow';

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

            // Reset form
            setName('');
            setDescription('');
            setCategory('general');
            setTagsInput('');
            setIsPublic(false);
            onClose();
        } catch (error) {
            console.error('Error saving workflow:', error);
        } finally {
            setIsSaving(false);
        }
    };

    const nodeCount = nodes.length;
    const edgeCount = edges.length;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <Card className="w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>{t('workflows.saveDialog.title') || 'Save Workflow'}</CardTitle>
                        <CardDescription>
                            {t('workflows.saveDialog.description') || 'Save your canvas as a reusable workflow template'}
                        </CardDescription>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-zinc-800/50 rounded-md transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* Workflow preview */}
                    <div className="p-4 bg-zinc-900/30 border border-zinc-800/50 rounded-md">
                        <div className="flex items-center gap-4 text-sm font-mono text-zinc-400">
                            <span>{nodeCount} nodes</span>
                            <span>•</span>
                            <span>{edgeCount} connections</span>
                        </div>
                    </div>

                    {/* Name */}
                    <div className="space-y-2">
                        <label className="text-sm font-mono text-zinc-300">
                            {t('workflows.saveDialog.name') || 'Workflow Name'} *
                        </label>
                        <Input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder={t('workflows.saveDialog.namePlaceholder') || 'e.g., Brand Identity Workflow'}
                            className="font-mono"
                        />
                    </div>

                    {/* Description */}
                    <div className="space-y-2">
                        <label className="text-sm font-mono text-zinc-300">
                            {t('workflows.saveDialog.description') || 'Description'} *
                        </label>
                        <Textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder={t('workflows.saveDialog.descriptionPlaceholder') || 'Describe what this workflow does...'}
                            className="font-mono min-h-[100px]"
                        />
                    </div>

                    {/* Category */}
                    <div className="space-y-2">
                        <label className="text-sm font-mono text-zinc-300">
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
                        />
                    </div>

                    {/* Tags */}
                    <div className="space-y-2">
                        <label className="text-sm font-mono text-zinc-300">
                            {t('workflows.saveDialog.tags') || 'Tags'}
                        </label>
                        <Input
                            value={tagsInput}
                            onChange={(e) => setTagsInput(e.target.value)}
                            placeholder={t('workflows.saveDialog.tagsPlaceholder') || 'e.g., branding, logo, identity (comma-separated)'}
                            className="font-mono"
                        />
                        <p className="text-xs text-zinc-500 font-mono">
                            {t('workflows.saveDialog.tagsHint') || 'Separate tags with commas'}
                        </p>
                    </div>

                    {/* Public toggle */}
                    <div className="flex items-center justify-between p-4 bg-zinc-900/30 border border-zinc-800/50 rounded-md">
                        <div className="space-y-1">
                            <label className="text-sm font-mono text-zinc-300">
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

                    {/* Actions */}
                    <div className="flex gap-2 justify-end pt-4">
                        <Button
                            variant="outline"
                            onClick={onClose}
                            disabled={isSaving}
                        >
                            {t('common.cancel') || 'Cancel'}
                        </Button>
                        <Button
                            variant="brand"
                            onClick={handleSave}
                            disabled={!name.trim() || !description.trim() || isSaving}
                        >
                            {isSaving ? (t('workflows.saveDialog.saving') || 'Saving...') : (t('workflows.saveDialog.save') || 'Save Workflow')}
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};
