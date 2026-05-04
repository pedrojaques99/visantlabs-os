import React, { useState, useCallback } from 'react';
import { Bot, User, Copy, Check, FileText, ThumbsUp, ThumbsDown, Wrench, AlertCircle, ChevronDown, Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MarkdownRenderer } from '@/utils/markdownRenderer';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { ActionDetector } from './ActionDetector';
import { parseActionsFromResponse, type DetectedAction } from '@/services/chatService';
import { FlowNodeType } from '@/types/reactFlow';
import { useGenerationFeedback, type UseGenerationFeedbackParams } from '@/hooks/useGenerationFeedback';
import { FullScreenViewer } from '../../FullScreenViewer';


import { GlitchLoader } from '@/components/ui/GlitchLoader'
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
  toolCalls?: Array<{
    id: string;
    name: string;
    status: 'running' | 'done' | 'error';
    args?: any;
    startedAt?: string;
    endedAt?: string;
    errorMessage?: string;
    summary?: string;
  }>;
  generationId?: string;
  feature?: 'chat' | 'admin-chat';
}

const TOOL_LABELS: Record<string, string> = {
  generate_or_update_mockup: 'Gerando mockup',
};

const CreativeProjectCard: React.FC<{
  project: { creativeProjectId: string; imageUrl: string; editUrl: string; prompt: string };
  onViewImage: (url: string) => void;
}> = ({ project, onViewImage }) => {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="group space-y-3 p-4 bg-white/[0.03] rounded-xl border border-white/5 shadow-sm hover:border-white/10 transition-all duration-200">
      <img
        src={project.imageUrl}
        alt={project.prompt}
        className="rounded-lg max-h-[500px] w-full object-contain bg-black/20 cursor-pointer hover:opacity-90 transition-opacity"
        onClick={() => onViewImage(project.imageUrl)}
      />
      <div className="flex items-start justify-between gap-2 text-xs">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-left flex-1 text-neutral-500 hover:text-neutral-300 transition-colors flex items-start gap-1.5 min-w-0"
          aria-expanded={expanded}
        >
          <ChevronDown
            size={12}
            className={cn(
              'mt-0.5 shrink-0 transition-transform',
              expanded ? 'rotate-0' : '-rotate-90'
            )}
          />
          <span className={cn('break-words', !expanded && 'line-clamp-1')}>{project.prompt}</span>
        </button>
        <Button
          variant="ghost"
          size="xs"
          asChild
          className="shrink-0 text-brand-cyan/70 hover:text-brand-cyan hover:bg-brand-cyan/10 font-mono"
        >
          <a
            href={project.editUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Pencil size={10} className="mr-1" />
            EDITAR
          </a>
        </Button>
      </div>
    </div>
  );
};

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
  toolCalls,
  generationId,
  feature = 'chat',
}) => {
  const [isCopied, setIsCopied] = useState(false);
  const [viewerImage, setViewerImage] = useState<string | null>(null);
  const [expandedToolId, setExpandedToolId] = useState<string | null>(null);
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
        "max-w-[85%] md:max-w-[80%] rounded-2xl p-5 text-sm leading-relaxed relative group transition-all border",
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
                      className="rounded-lg max-h-[500px] w-full object-contain bg-black/20 cursor-pointer hover:opacity-90 transition-opacity"
                      onClick={() => setViewerImage(attachment.dataUrl)}
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

        {/* Tool Calls (expandable) */}
        {toolCalls && toolCalls.length > 0 && (
          <div className="mt-3 pt-3 border-t border-white/10 space-y-1.5">
            {toolCalls.map((call) => {
              const label = TOOL_LABELS[call.name] || call.name;
              const isRunning = call.status === 'running';
              const isError = call.status === 'error';
              const isExpanded = expandedToolId === call.id;
              const hasDuration = call.startedAt && call.endedAt;
              const durationMs = hasDuration
                ? new Date(call.endedAt!).getTime() - new Date(call.startedAt!).getTime()
                : null;
              const durationLabel = durationMs != null
                ? durationMs >= 1000 ? `${(durationMs / 1000).toFixed(1)}s` : `${durationMs}ms`
                : null;
              const hasDetail = !isRunning && call.args && Object.keys(call.args).length > 0;

              return (
                <div key={call.id}>
                  <button
                    type="button"
                    onClick={() => hasDetail && setExpandedToolId(isExpanded ? null : call.id)}
                    className={cn(
                      'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border text-[11px] font-mono transition-colors',
                      isError
                        ? 'bg-red-500/5 border-red-500/20 text-red-300'
                        : isRunning
                        ? 'bg-brand-cyan/5 border-brand-cyan/20 text-brand-cyan/80'
                        : isExpanded
                        ? 'bg-white/5 border-white/10 text-neutral-300'
                        : 'bg-white/[0.02] border-white/5 text-neutral-400',
                      hasDetail && !isRunning && 'hover:bg-white/5 hover:border-white/10 cursor-pointer'
                    )}
                  >
                    {isRunning ? (
                      <GlitchLoader size={12} className="shrink-0" />
                    ) : isError ? (
                      <AlertCircle size={12} className="shrink-0" />
                    ) : (
                      <Wrench size={12} className="shrink-0 text-green-400/70" />
                    )}
                    <span className="uppercase tracking-wider truncate flex-1 text-left">
                      {label}
                    </span>
                    {durationLabel && (
                      <span className="text-[10px] opacity-40 shrink-0">{durationLabel}</span>
                    )}
                    <span className="text-[10px] opacity-60 shrink-0 ml-1">
                      {isError ? (call.errorMessage || 'falhou').slice(0, 40) : call.summary || call.status}
                    </span>
                    {hasDetail && !isRunning && (
                      <ChevronDown size={11} className={cn('shrink-0 opacity-40 transition-transform', isExpanded && 'rotate-180')} />
                    )}
                  </button>

                  {isExpanded && call.args && (
                    <div className="mt-1 ml-3 px-3 py-2.5 rounded-lg bg-black/30 border border-white/5 text-[11px] space-y-2">
                      {call.name === 'propose_creative_plan' && (
                        <>
                          {call.args.summary && (
                            <p className="text-neutral-400 italic">{call.args.summary}</p>
                          )}
                          {call.args.proposals?.length > 0 && (
                            <div className="space-y-1">
                              <p className="text-[10px] font-semibold text-neutral-600 uppercase tracking-widest">Variações</p>
                              {call.args.proposals.map((p: any, i: number) => (
                                <div key={i} className="flex items-start gap-2">
                                  <span className="text-neutral-600 shrink-0">{i + 1}.</span>
                                  <div>
                                    <span className="text-neutral-300 font-medium">{p.title}</span>
                                    {p.aspectRatio && <span className="text-neutral-600 ml-2">{p.aspectRatio}</span>}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                          {call.args.questions?.length > 0 && (
                            <div className="space-y-0.5">
                              <p className="text-[10px] font-semibold text-neutral-600 uppercase tracking-widest">Perguntas feitas</p>
                              {call.args.questions.map((q: string, i: number) => (
                                <p key={i} className="text-neutral-500">— {q}</p>
                              ))}
                            </div>
                          )}
                        </>
                      )}
                      {call.name === 'update_session_memory' && (
                        <div className="space-y-1">
                          {(['brands', 'clients', 'decisions', 'references'] as const).map(key =>
                            call.args[key] ? (
                              <div key={key} className="flex gap-2">
                                <span className="text-neutral-600 capitalize shrink-0">{key}:</span>
                                <span className="text-neutral-400">{call.args[key]}</span>
                              </div>
                            ) : null
                          )}
                        </div>
                      )}
                      {call.name === 'generate_or_update_mockup' && (
                        <div className="space-y-1">
                          {call.args.prompt && <p className="text-neutral-400 line-clamp-3">{call.args.prompt}</p>}
                          <div className="flex gap-3 text-neutral-600">
                            {call.args.model && <span>model: {call.args.model.split('/').pop()}</span>}
                            {call.args.aspectRatio && <span>ratio: {call.args.aspectRatio}</span>}
                            {call.args.textMode && <span>texto: {call.args.textMode}</span>}
                          </div>
                        </div>
                      )}
                      {!['propose_creative_plan', 'update_session_memory', 'generate_or_update_mockup'].includes(call.name) && (
                        <pre className="text-neutral-500 whitespace-pre-wrap break-all text-[10px]">
                          {JSON.stringify(call.args, null, 2).slice(0, 400)}
                        </pre>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Generated Creative Projects */}
        {creativeProjects && creativeProjects.length > 0 && (
          <div className="mt-5 pt-5 border-t border-white/10 space-y-6">
            {creativeProjects.map((proj, idx) => (
              <CreativeProjectCard 
                key={idx} 
                project={proj} 
                onViewImage={(url) => setViewerImage(url)}
              />
            ))}
          </div>
        )}

        {/* Feedback buttons */}
        {isAssistant && generationId && content?.trim() && (
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

      {/* Image Full Screen Viewer */}
      {viewerImage && (
        <FullScreenViewer
          imageUrl={viewerImage}
          isLoading={false}
          onClose={() => setViewerImage(null)}
          showActions={false}
        />
      )}
    </div>
  );
};
