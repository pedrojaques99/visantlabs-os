import React, { useState, useEffect } from 'react';
import { Save, Share2, Tags, Folder, FileType, Info, Globe } from '@/lib/ui/icons';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Select } from './ui/select';
import { Switch } from './ui/switch';
import type { Node, Edge } from '@xyflow/react';
import type { WorkflowCategory } from '../types/workflow';
import { WORKFLOW_CATEGORY_CONFIG } from '../types/workflow';
import { cn } from '../lib/utils';
import { MicroTitle } from './ui/MicroTitle';
import { Modal } from './ui/Modal';
import { GlassPanel } from './ui/GlassPanel';

import { GlitchLoader } from '@/components/ui/GlitchLoader';
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
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0);

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

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      title={t('workflows.saveDialog.title')}
      description={t('workflows.saveDialog.description')}
      footer={
        <>
          <Button
            variant="ghost"
            onClick={onClose}
            disabled={isSaving}
            className="font-mono text-neutral-400 hover:text-neutral-200"
          >
            {t('common.cancel')}
          </Button>
          <Button
            variant="primary"
            onClick={handleSave}
            disabled={!name.trim() || !description.trim() || isSaving}
            className="font-mono min-w-[140px]"
          >
            {isSaving ? (
              <span className="flex items-center gap-2">
                <GlitchLoader size={16} />
                {t('workflows.saveDialog.saving')}
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Save size={16} />
                {t('workflows.saveDialog.save')}
              </span>
            )}
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        {/* Stats */}
        <div className="flex items-center gap-4 px-4 py-3 bg-neutral-900/40 border border-neutral-800/60 rounded-md">
          <MicroTitle className="flex items-center gap-2 text-2xs  text-neutral-400">
            <FileType size={14} className="text-neutral-500" />
            <span>
              {nodeCount} {t('workflows.saveDialog.nodes')}
            </span>
          </MicroTitle>
          <div className="w-px h-3 bg-neutral-800" />
          <MicroTitle className="flex items-center gap-2 text-2xs  text-neutral-400">
            <Share2 size={14} className="text-neutral-500" />
            <span>
              {edgeCount} {t('workflows.saveDialog.connections')}
            </span>
          </MicroTitle>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Name */}
          <div className="space-y-2 md:col-span-2">
            <MicroTitle as="label" className="ml-1">
              {t('workflows.saveDialog.name')} <span className="text-destructive">*</span>
            </MicroTitle>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('workflows.saveDialog.namePlaceholder')}
              className="bg-neutral-900/50 border-neutral-800 focus:border-neutral-600 focus:ring-brand-cyan/20"
            />
          </div>

          {/* Category */}
          <div className="space-y-2">
            <MicroTitle as="label" className="ml-1 flex items-center gap-1.5 lowercase">
              <Folder size={12} className="uppercase" />
              {t('workflows.saveDialog.category')}
            </MicroTitle>
            <Select
              value={category}
              onChange={(value) => setCategory(value as WorkflowCategory)}
              options={Object.entries(WORKFLOW_CATEGORY_CONFIG)
                .filter(([key]) => key !== 'all')
                .map(([key, config]) => ({
                  value: key,
                  label: config.label,
                }))}
              className="w-full bg-neutral-900/50 border-neutral-800"
            />
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <MicroTitle as="label" className="ml-1 flex items-center gap-1.5 lowercase">
              <Tags size={12} className="uppercase" />
              {t('workflows.saveDialog.tags')}
            </MicroTitle>
            <Input
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder={t('workflows.saveDialog.tagsPlaceholder')}
              className="bg-neutral-900/50 border-neutral-800 focus:border-neutral-600 focus:ring-brand-cyan/20"
            />
          </div>

          {/* Description */}
          <div className="space-y-2 md:col-span-2">
            <MicroTitle as="label" className="ml-1 flex items-center gap-1.5 lowercase">
              <Info size={12} className="uppercase" />
              {t('workflows.saveDialog.description')} <span className="text-destructive">*</span>
            </MicroTitle>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('workflows.saveDialog.descriptionPlaceholder')}
              className="min-h-[100px] bg-neutral-900/50 border-neutral-800 focus:border-neutral-600 focus:ring-brand-cyan/20 resize-none"
            />
          </div>

          {/* Public Toggle */}
          <GlassPanel padding="sm" className="md:col-span-2 rounded-md">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <label className="text-sm font-medium text-neutral-300 flex items-center gap-2">
                  <Globe
                    size={16}
                    className={cn(
                      'transition-colors',
                      isPublic ? 'text-brand-cyan' : 'text-neutral-500'
                    )}
                  />
                  {t('workflows.saveDialog.makePublic')}
                </label>
                <p className="text-2xs text-neutral-500 font-mono">
                  {t('workflows.saveDialog.makePublicHint')}
                </p>
              </div>
              <Switch checked={isPublic} onCheckedChange={setIsPublic} />
            </div>
          </GlassPanel>
        </div>
      </div>
    </Modal>
  );
};
