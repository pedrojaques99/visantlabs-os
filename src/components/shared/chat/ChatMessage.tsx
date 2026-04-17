import React, { useState, useCallback } from 'react';
import { Bot, User, Copy, Check, FileText, ThumbsUp, ThumbsDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MarkdownRenderer } from '@/utils/markdownRenderer';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { ActionDetector } from './ActionDetector';
import { parseActionsFromResponse, type DetectedAction } from '@/services/chatService';
import { FlowNodeType } from '@/types/reactFlow';
import { useGenerationFeedback, type UseGenerationFeedbackParams } from '@/hooks/useGenerationFeedback';


export interface ChatMessageProps {
  id?: string;
  role: 'user' | 'assistant' | 'model'; // 'model' is used in BrandingExpertChat
  content: string;
  nodeId?: string;
  onAddPrompt?: (nodeId: string, prompt: string) => void;
  onCreateNode?: (chatNodeId: string, nodeType: FlowNodeType, initialData?: any, connectToChat?: boolean) => string | undefined;
  t: any;
  showAvatar?: boolean;
  attachments?: Array<{ type: 'image' | 'pdf'; dataUrl: string; name: string; }>;
  creativeProjects?: Array<{ creativeProjectId: string; imageUrl: string; editUrl: string; prompt: string }>;
  generationId?: string;
  feature?: 'chat' | 'admin-chat';
}

export const ChatMessage: React.FC<ChatMessageProps> = ({
  id,
  role,
  content,
  nodeId,
  onAddPrompt,
  onCreateNode,
  t,
  showAvatar = true,
  attachments,
  creativeProjects,
  generationId,
  feature = 'chat',
}) => {
  const [isCopied, setIsCopied] = useState(false);
  const isAssistant = role === 'assistant' || role === 'model';

  // Feedback hook — only for assistant messages with generationId
  const feedback = useGenerationFeedback({
    generationId: isAssistant ? generationId : null,
    feature,
    context: {
      prompt: content.substring(0, 500),
      imageUrl: creativeProjects?.[0]?.imageUrl,
      extra: { hasAttachments: !!attachments?.length }
    }
  });
  
  const handleCopy = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(content);
      setIsCopied(true);
      toast.success(t('canvasNodes.chatNode.messageCopied') || 'Copiado!');
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      toast.error(t('canvasNodes.chatNode.copyFailed') || 'Erro ao copiar');
    }
  }, [content, t]);

  const actions = isAssistant ? parseActionsFromResponse(content) : [];

  return (
    <div className={cn("flex gap-3 w-full", !isAssistant ? "flex-row-reverse" : "flex-row")}>
      {showAvatar && (
        <div className={cn(
          "w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-sm border",
          !isAssistant ? "bg-neutral-800 border-white/5" : "bg-neutral-900 border-brand-cyan/20"
        )}>
          {!isAssistant ? (
            <User size={16} className="text-neutral-400" />
          ) : (
            <Bot size={16} className="text-brand-cyan" />
          )}
        </div>
      )}
      
      <div className={cn(
        "max-w-[85%] md:max-w-[80%] rounded-2xl p-4 text-sm leading-relaxed relative group transition-all border",
        !isAssistant 
          ? "bg-brand-cyan/10 border-brand-cyan/20 text-neutral-100" 
          : "bg-white/5 border-white/5 text-neutral-300"
      )}>
        {/* Copy Button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={handleCopy}
          className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity bg-neutral-900/50 hover:bg-neutral-800"
        >
          {isCopied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
        </Button>

        <div className="select-text whitespace-pre-wrap">
          {isAssistant ? (
            <MarkdownRenderer content={content} />
          ) : (
             <p>{content}</p>
          )}
        </div>

        {/* Attachments */}
        {attachments && attachments.length > 0 && (
          <div className="mt-3 pt-3 border-t border-white/10">
            <div className="grid grid-cols-2 gap-2">
              {attachments.map((attachment, idx) => (
                <div key={idx} className="group relative">
                  {attachment.type === 'image' ? (
                    <img
                      src={attachment.dataUrl}
                      alt={attachment.name}
                      className="rounded-lg max-h-48 w-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
                      onClick={() => window.open(attachment.dataUrl)}
                    />
                  ) : (
                    <div className="bg-white/5 rounded-lg p-3 flex items-center gap-2 text-xs hover:bg-white/10 transition-colors">
                      <FileText size={14} className="text-amber-400" />
                      <span className="truncate">{attachment.name}</span>
                    </div>
                  )}
                  <p className="text-xs text-neutral-500 mt-1 group-hover:text-neutral-400">{attachment.name}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Generated Creative Projects */}
        {creativeProjects && creativeProjects.length > 0 && (
          <div className="mt-3 pt-3 border-t border-white/10 space-y-3">
            {creativeProjects.map((proj, idx) => (
              <div key={idx} className="group space-y-2">
                <img
                  src={proj.imageUrl}
                  alt={proj.prompt}
                  className="rounded-lg max-h-64 w-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
                  onClick={() => window.open(proj.editUrl, '_blank')}
                />
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-neutral-500 line-clamp-1 flex-1">{proj.prompt.substring(0, 60)}...</span>
                  <a
                    href={proj.editUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-brand-cyan hover:text-brand-cyan/80 font-mono whitespace-nowrap underline"
                  >
                    EDITAR ✏️
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Feedback buttons */}
        {isAssistant && generationId && (
          <div className="mt-3 flex items-center gap-1">
            <button
              onClick={() => feedback.submit('up')}
              disabled={feedback.isLoading}
              className={cn(
                'p-1.5 rounded transition-colors',
                feedback.rating === 'up'
                  ? 'bg-green-400/20 text-green-400'
                  : 'text-neutral-500 hover:text-green-400 hover:bg-green-400/10'
              )}
              title={feedback.rating === 'up' ? 'Undo feedback' : 'Helpful'}
            >
              <ThumbsUp size={14} fill={feedback.rating === 'up' ? 'currentColor' : 'none'} />
            </button>
            <button
              onClick={() => feedback.submit('down')}
              disabled={feedback.isLoading}
              className={cn(
                'p-1.5 rounded transition-colors',
                feedback.rating === 'down'
                  ? 'bg-red-400/20 text-red-400'
                  : 'text-neutral-500 hover:text-red-400 hover:bg-red-400/10'
              )}
              title={feedback.rating === 'down' ? 'Undo feedback' : 'Not helpful'}
            >
              <ThumbsDown size={14} fill={feedback.rating === 'down' ? 'currentColor' : 'none'} />
            </button>
          </div>
        )}

        {isAssistant && actions.length > 0 && nodeId && (
          <ActionDetector
            actions={actions}
            nodeId={nodeId}
            onAddPrompt={onAddPrompt}
            onCreateNode={onCreateNode}
            t={t}
          />
        )}
      </div>
    </div>
  );
};
