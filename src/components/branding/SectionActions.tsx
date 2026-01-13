import React, { useState } from 'react';
import { Save, Edit2, RotateCw, Copy, Check, X, ThumbsUp } from 'lucide-react';
import { Tooltip } from '@/components/ui/Tooltip';
import { useTranslation } from '@/hooks/useTranslation';
import { useTheme } from '@/hooks/useTheme';
import { toast } from 'sonner';
import { extractTextFromContent } from '@/utils/brandingHelpers';

interface SectionActionsProps {
  hasData: boolean;
  canEdit: boolean;
  isEditing: boolean;
  isGenerating: boolean;
  isSaving: boolean;
  content: any;
  onEdit: () => void;
  onRegenerate?: () => void;
  onSave: () => void;
  // Feedback props
  prompt?: string;
  stepNumber?: number;
  onFeedback?: (type: 'up' | 'down') => void;
}

export const SectionActions: React.FC<SectionActionsProps> = ({
  hasData,
  canEdit,
  isEditing,
  isGenerating,
  isSaving,
  content,
  onEdit,
  onRegenerate,
  onSave,
  prompt,
  stepNumber,
  onFeedback,
}) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const [copied, setCopied] = useState(false);
  const [feedbackGiven, setFeedbackGiven] = useState<'up' | 'down' | null>(null);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const text = extractTextFromContent(content);
      if (!text.trim()) {
        toast.error(t('branding.copyEmpty') || 'No content to copy');
        return;
      }
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success(t('branding.copied') || 'Copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
      toast.error(t('branding.copyFailed') || 'Failed to copy');
    }
  };

  // When editing, show only Check (save) and Dismiss (cancel)
  if (isEditing) {
    return (
      <div className="flex items-center gap-1 opacity-100 transition-opacity duration-200">
        <Tooltip content={t('branding.save') || 'Save'} position="top">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSave();
            }}
            disabled={isSaving}
            className="h-7 w-7 px-2 hover:bg-brand-cyan/20 rounded-md flex items-center justify-center text-brand-cyan hover:bg-brand-cyan/30 flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            <Check className="h-4 w-4" />
          </button>
        </Tooltip>
        <Tooltip content={t('branding.cancelEdit') || 'Cancel'} position="top">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit(); // Toggle edit mode off (dismiss)
            }}
            className={`h-7 w-7 px-2 hover:bg-red-500/20 rounded-md flex items-center justify-center flex-shrink-0 transition-all ${theme === 'dark' ? 'text-zinc-400 hover:text-red-400' : 'text-zinc-600 hover:text-red-500'
              }`}
          >
            <X className="h-4 w-4" />
          </button>
        </Tooltip>
      </div>
    );
  }

  // Normal mode: show all actions
  return (
    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
      {hasData && onRegenerate && (
        <Tooltip content={t('branding.regenerate') || 'Regenerate'} position="top">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRegenerate();
            }}
            disabled={isGenerating}
            className={`h-7 w-7 px-2 rounded-md flex items-center justify-center flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed relative transition-all duration-300 hover:text-brand-cyan ${theme === 'dark'
              ? 'hover:bg-black/40 text-zinc-400 shadow-[0_0_8px_rgba(82,221,235,0.3)] hover:shadow-[0_0_12px_rgba(82,221,235,0.5)]'
              : 'hover:bg-zinc-200 text-zinc-600'
              }`}
          >
            <RotateCw className="h-4 w-4" />
          </button>
        </Tooltip>
      )}
      {hasData && (
        <Tooltip content={copied ? (t('branding.copied') || 'Copied!') : (t('branding.copy') || 'Copy text')} position="top">
          <button
            onClick={handleCopy}
            className={`h-7 w-7 px-2 rounded-md flex items-center justify-center flex-shrink-0 transition-colors hover:text-brand-cyan ${theme === 'dark'
              ? 'hover:bg-black/40 text-zinc-400'
              : 'hover:bg-zinc-200 text-zinc-600'
              }`}
          >
            {copied ? (
              <Check className="h-4 w-4 text-brand-cyan" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </button>
        </Tooltip>
      )}
      {canEdit && (
        <Tooltip content={t('branding.edit') || 'Edit'} position="top">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            className={`h-7 w-7 px-2 rounded-md flex items-center justify-center flex-shrink-0 hover:text-brand-cyan ${theme === 'dark'
              ? 'hover:bg-black/40 text-zinc-400'
              : 'hover:bg-zinc-200 text-zinc-600'
              }`}
          >
            <Edit2 className="h-4 w-4" />
          </button>
        </Tooltip>
      )}
      {hasData && onFeedback && prompt && stepNumber && (
        <Tooltip content={feedbackGiven === 'up' ? (t('branding.feedbackGiven') || 'Thanks for your feedback!') : (t('branding.thumbsUp') || 'Good result')} position="top">
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (feedbackGiven !== null) return;
              onFeedback('up');
              setFeedbackGiven('up');
            }}
            disabled={feedbackGiven !== null || isGenerating}
            className={`h-7 w-7 px-2 rounded-md flex items-center justify-center flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 ${feedbackGiven === 'up'
              ? 'text-brand-cyan'
              : theme === 'dark'
                ? 'hover:bg-black/40 text-zinc-400 hover:text-brand-cyan'
                : 'hover:bg-zinc-200 text-zinc-600 hover:text-brand-cyan'
              }`}
          >
            <ThumbsUp className={`h-4 w-4 ${feedbackGiven === 'up' ? 'fill-current' : ''}`} />
          </button>
        </Tooltip>
      )}
    </div>
  );
};

