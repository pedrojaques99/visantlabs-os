import React, { useState, useCallback } from 'react';
import { Bot, User, Copy, Check, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MarkdownRenderer } from '@/utils/markdownRenderer';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { ActionDetector } from './ActionDetector';
import { parseActionsFromResponse, type DetectedAction } from '@/services/chatService';
import { FlowNodeType } from '@/types/reactFlow';

export interface ChatMessageProps {
  id?: string;
  role: 'user' | 'assistant' | 'model'; // 'model' is used in BrandingExpertChat
  content: string;
  nodeId?: string;
  onAddPrompt?: (nodeId: string, prompt: string) => void;
  onCreateNode?: (chatNodeId: string, nodeType: FlowNodeType, initialData?: any, connectToChat?: boolean) => string | undefined;
  t: any;
  showAvatar?: boolean;
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
}) => {
  const [isCopied, setIsCopied] = useState(false);
  const isAssistant = role === 'assistant' || role === 'model';
  
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
