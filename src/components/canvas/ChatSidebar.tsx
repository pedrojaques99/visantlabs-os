import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { MessageSquare, FileText, Image as ImageIcon, CheckCircle2, Target, ChevronDown, ChevronUp, Diamond, Settings2 } from 'lucide-react';
import type { ChatNodeData } from '@/types/reactFlow';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/hooks/useTranslation';
import { Button } from '@/components/ui/button';
import { ConnectedImagesDisplay } from '../reactflow/ConnectedImagesDisplay';
import { getMessagesUntilNextCredit } from '@/utils/creditCalculator';
import { toast } from 'sonner';
import { GlitchLoader } from '@/components/ui/GlitchLoader';
import { Input } from '@/components/ui/input';
import { MicroTitle } from '@/components/ui/MicroTitle';
import { Textarea } from '@/components/ui/textarea';
import { fileToBase64 } from '@/utils/fileUtils';

import { ChatMessage } from '../shared/chat/ChatMessage';
import { ChatInput } from '../shared/chat/ChatInput';

interface ChatSidebarProps {
  nodeData: ChatNodeData;
  nodeId: string;
  onUpdateData?: (nodeId: string, newData: Partial<ChatNodeData>) => void;
  variant?: 'standalone' | 'stacked' | 'embedded';
  sidebarRef?: React.RefObject<HTMLElement>;
}

/**
 * Chat Sidebar component
 */
export const ChatSidebar = ({
  sidebarRef,
  nodeData,
  nodeId,
  onUpdateData,
  variant,
}: ChatSidebarProps) => {
  const { t } = useTranslation();
  const [inputMessage, setInputMessage] = useState('');
  const messagesAreaRef = useRef<HTMLDivElement>(null);
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const [showSystemPromptEditor, setShowSystemPromptEditor] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState(nodeData.systemPrompt || '');
  const [expandedStrategy, setExpandedStrategy] = useState(false);
  const internalSidebarRef = useRef<HTMLElement>(null);
  const actualSidebarRef = sidebarRef || internalSidebarRef;

  const isLoading = nodeData.isLoading || false;
  const userMessageCount = nodeData.userMessageCount || 0;
  const messages = nodeData.messages || [];

  // Sync connected images and context from nodeData
  const [connectedImage1, setConnectedImage1] = useState(nodeData.connectedImage1);
  const [connectedImage2, setConnectedImage2] = useState(nodeData.connectedImage2);
  const [connectedImage3, setConnectedImage3] = useState(nodeData.connectedImage3);
  const [connectedImage4, setConnectedImage4] = useState(nodeData.connectedImage4);
  const [connectedText, setConnectedText] = useState(nodeData.connectedText);
  const [connectedStrategyData, setConnectedStrategyData] = useState(nodeData.connectedStrategyData);

  useEffect(() => {
    setConnectedImage1(nodeData.connectedImage1);
    setConnectedImage2(nodeData.connectedImage2);
    setConnectedImage3(nodeData.connectedImage3);
    setConnectedImage4(nodeData.connectedImage4);
    setConnectedText(nodeData.connectedText);
    setConnectedStrategyData(nodeData.connectedStrategyData);
  }, [
    nodeData.connectedImage1,
    nodeData.connectedImage2,
    nodeData.connectedImage3,
    nodeData.connectedImage4,
    nodeData.connectedText,
    nodeData.connectedStrategyData,
  ]);

  // Sync system prompt from nodeData
  useEffect(() => {
    setSystemPrompt(nodeData.systemPrompt || '');
  }, [nodeData.systemPrompt]);

  // Get all connected images
  const connectedImages = [
    connectedImage1,
    connectedImage2,
    connectedImage3,
    connectedImage4,
  ].filter((img): img is string => !!img);

  const hasContext = connectedImages.length > 0 || !!connectedText || !!connectedStrategyData;
  const messagesUntilNextCredit = getMessagesUntilNextCredit(userMessageCount);

  // Get strategy data sections summary
  const strategySections = useMemo(() => {
    if (!connectedStrategyData) return [];
    const sections: string[] = [];
    if (connectedStrategyData.persona) sections.push('Persona');
    if (connectedStrategyData.archetypes) sections.push('Archetypes');
    if (connectedStrategyData.marketResearch) sections.push('Market Research');
    if (connectedStrategyData.competitors) sections.push('Competitors');
    if (connectedStrategyData.swot) sections.push('SWOT');
    if (connectedStrategyData.colorPalettes) sections.push('Color Palettes');
    if (connectedStrategyData.visualElements) sections.push('Visual Elements');
    if (connectedStrategyData.mockupIdeas) sections.push('Mockup Ideas');
    if (connectedStrategyData.moodboard) sections.push('Moodboard');
    return sections;
  }, [connectedStrategyData]);

  // Save system prompt
  const handleSaveSystemPrompt = useCallback(() => {
    if (onUpdateData) {
      onUpdateData(nodeId, { systemPrompt: systemPrompt.trim() || undefined });
      setShowSystemPromptEditor(false);
      toast.success(t('canvasNodes.chatNode.systemPromptSaved') || 'System prompt saved', { duration: 2000 });
    }
  }, [nodeId, onUpdateData, systemPrompt, t]);

  // Reset to default system prompt
  const handleResetSystemPrompt = useCallback(() => {
    if (onUpdateData) {
      onUpdateData(nodeId, { systemPrompt: undefined });
      setSystemPrompt('');
      setShowSystemPromptEditor(false);
      toast.success(t('canvasNodes.chatNode.systemPromptReset') || 'System prompt reset to default', { duration: 2000 });
    }
  }, [nodeId, onUpdateData, t]);

  const handleSuggestMockups = useCallback(() => {
    if (isLoading || !nodeData.onSendMessage) return;

    const message = "Suggest 5 creative and specific mockups for this brand based on the context. For each mockup, create a detailed prompt following this structure: camera positioning, main object, screen content (if applicable), textures and materials, color palette and aesthetics, lighting and environment, and photographic style. Use the format **[ACTION:prompt]** with detailed descriptions in a single continuous paragraph.";
    setInputMessage(message);

    const context = {
      images: connectedImages.length > 0 ? connectedImages : undefined,
      text: connectedText,
      strategyData: connectedStrategyData,
    };

    nodeData.onSendMessage(nodeId, message, context);
    setInputMessage('');
  }, [isLoading, nodeData, nodeId, connectedImages, connectedText, connectedStrategyData]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesAreaRef.current) {
      messagesAreaRef.current.scrollTop = messagesAreaRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const handleSend = async () => {
    if (!inputMessage.trim() || isLoading || !nodeData.onSendMessage) return;

    const messageToSend = inputMessage.trim();
    setInputMessage('');

    const context = {
      images: connectedImages.length > 0 ? connectedImages : undefined,
      text: connectedText,
      strategyData: connectedStrategyData,
    };

    await nodeData.onSendMessage(nodeId, messageToSend, context);
  };

  const handleImageRemove = useCallback((index: number) => {
    const handleMap: Record<number, 'input-1' | 'input-2' | 'input-3' | 'input-4'> = {
      0: 'input-1',
      1: 'input-2',
      2: 'input-3',
      3: 'input-4',
    };

    const targetHandle = handleMap[index];
    if (!targetHandle || !nodeData.onRemoveEdge) return;

    nodeData.onRemoveEdge(nodeId, targetHandle);
  }, [nodeId, nodeData]);

  const handleAttachMediaClick = useCallback(() => {
    mediaInputRef.current?.click();
  }, []);

  const handleMediaFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (mediaInputRef.current) {
      mediaInputRef.current.value = '';
    }

    if (!file.type.startsWith('image/')) {
      toast.error(t('upload.unsupportedFileType') || 'Please select an image file', { duration: 3000 });
      return;
    }

    const MAX_FILE_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE) {
      toast.error(t('upload.imageTooLarge') || 'File size exceeds 10MB limit', { duration: 5000 });
      return;
    }

    try {
      const imageData = await fileToBase64(file);

      if (nodeData.onAttachMedia) {
        const newNodeId = nodeData.onAttachMedia(nodeId, imageData.base64, imageData.mimeType);
        if (newNodeId) {
          toast.success(t('canvasNodes.chatNode.mediaAttached') || 'Image node created!', { duration: 2000 });
        }
      } else if (nodeData.onCreateNode) {
        const newNodeId = nodeData.onCreateNode(nodeId, 'image', {
          mockup: {
            imageBase64: imageData.base64,
            mimeType: imageData.mimeType,
          }
        } as any, true);
        if (newNodeId) {
          toast.success(t('canvasNodes.chatNode.mediaAttached') || 'Image node created!', { duration: 2000 });
        }
      } else {
        toast.error('Unable to attach media. Feature not available.', { duration: 3000 });
      }
    } catch (error: any) {
      console.error('Failed to process media:', error);
      toast.error(error?.message || 'Failed to process image', { duration: 5000 });
    }
  }, [nodeId, nodeData, t, fileToBase64]);

  return (
    <aside
      ref={actualSidebarRef as React.RefObject<HTMLDivElement>}
      data-chat-sidebar="true"
      className={cn(
        "relative",
        variant === 'embedded' ? "border-none shadow-none bg-transparent" : "z-50 backdrop-blur-xl border-l border-neutral-800/50 shadow-2xl bg-neutral-950/70",
        "transition-all duration-300 ease-out",
        "flex flex-col",
        "flex-shrink-0",
        "w-full"
      )}
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: variant === 'embedded' ? 'transparent' : 'var(--sidebar)',
      }}
    >
      <div className="flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-neutral-700/30 bg-gradient-to-r from-neutral-900/40 to-neutral-900/20 backdrop-blur-sm min-w-0">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="p-1.5 rounded-md bg-brand-cyan/10 border border-brand-cyan/20 shrink-0">
              <MessageSquare size={16} className="text-brand-cyan" />
            </div>
            <h3 className="text-sm font-semibold text-neutral-200 font-mono tracking-tight truncate">{t('canvasNodes.chatNode.title')}</h3>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="ghost" onClick={() => setShowSystemPromptEditor(!showSystemPromptEditor)}
              className={cn(
                "p-2 rounded-md border transition-all bg-neutral-900/60 border-neutral-700/40 text-neutral-400 hover:border-neutral-600/60 hover:text-neutral-200 hover:bg-neutral-800/70 backdrop-blur-sm shadow-sm hover:shadow-md hover:scale-105 active:scale-95",
                showSystemPromptEditor && "border-brand-cyan/50 text-brand-cyan bg-brand-cyan/10"
              )}
              title={t('canvasNodes.chatNode.systemPromptSettings') || 'System Prompt Settings'}
            >
              <Settings2 size={14} />
            </Button>
          </div>
        </div>

        {/* System Prompt Editor */}
        {showSystemPromptEditor && (
          <div className="px-4 py-3 border-b border-neutral-700/30 bg-gradient-to-r from-neutral-900/50 to-neutral-900/30 backdrop-blur-sm animate-in slide-in-from-top-1 duration-200">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-mono text-neutral-300 font-semibold uppercase ">
                {t('canvasNodes.chatNode.systemPrompt') || 'System Prompt (Agent Personality)'}
              </label>
              <div className="flex items-center gap-2">
                {systemPrompt && (
                  <Button variant="ghost" onClick={handleResetSystemPrompt}
                    className="text-[10px] px-2 py-1 rounded border border-neutral-600/40 text-neutral-400 hover:text-neutral-200 hover:border-neutral-500/60 transition-all"
                  >
                    {t('canvasNodes.chatNode.resetToDefault') || 'Reset to Default'}
                  </Button>
                )}
                <Button variant="brand" onClick={handleSaveSystemPrompt}
                  className="text-[10px] px-2 py-1 rounded bg-brand-cyan/20 border border-brand-cyan/40 text-brand-cyan hover:bg-brand-cyan/30 transition-all"
                >
                  {t('canvasNodes.chatNode.save') || 'Save'}
                </Button>
              </div>
            </div>
            <Textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder={t('canvasNodes.chatNode.systemPromptPlaceholder') || 'Enter custom system prompt to personalize the agent personality. Leave empty to use default.'}
              className="resize-none bg-neutral-900/60 border-neutral-700/40 focus:border-brand-cyan/50 focus:ring-1 focus:ring-brand-cyan/20 backdrop-blur-sm text-xs font-mono min-h-[120px] max-h-[300px]"
              disabled={isLoading}
            />
            <MicroTitle className="text-[10px] mt-2 "> {t('canvasNodes.chatNode.systemPromptHint') || 'This prompt defines how the AI assistant behaves. Use it to customize tone, style, and expertise.'} </MicroTitle>
          </div>
        )}

        {/* Credit Indicator */}
        <div className="px-4 py-2.5 border-b border-neutral-700/30 bg-gradient-to-r from-neutral-900/50 to-neutral-900/30 backdrop-blur-sm">
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="text-neutral-300 font-medium"> {t('canvasNodes.chatNode.messages')}: <span className="text-brand-cyan">{userMessageCount}</span> </span>
            <span className="text-neutral-400 text-[10px]"> {t('canvasNodes.chatNode.nextCreditIn')} {messagesUntilNextCredit} {messagesUntilNextCredit > 1 ? t('canvasNodes.chatNode.messagesPlural') : t('canvasNodes.chatNode.message')} </span>
          </div>
          <div className="h-1.5 bg-neutral-800/40 rounded-full overflow-hidden shadow-inner">
            <div className="h-full bg-gradient-to-r from-brand-cyan to-brand-cyan/80 transition-all duration-300 ease-out shadow-sm" style={{ width: `${((userMessageCount % 4) / 4) * 100}%` }} />
          </div>
        </div>

        {/* Messages Area */}
        <div ref={messagesAreaRef} className="flex-1 p-4 overflow-y-auto overflow-x-hidden space-y-4 min-h-0 min-w-0 scroll-smooth bg-gradient-to-b from-transparent via-neutral-900/10 to-transparent" onWheel={(e) => e.stopPropagation()} >
          {messages.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-12">
              {hasContext ? (
                <div className="space-y-3">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-brand-cyan/10 border border-brand-cyan/20 mb-2">
                    <MessageSquare size={20} className="text-brand-cyan/70" />
                  </div>
                  <p className="text-neutral-300 font-medium">{t('canvasNodes.chatNode.startConversationWithContext')}</p>
                  <p className="text-xs ">{t('canvasNodes.chatNode.chatWillUseImagesAndTexts')}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-neutral-800/50 border border-neutral-700/30 mb-2">
                    <MessageSquare size={20} className="" />
                  </div>
                  <p className="text-neutral-300 font-medium">{t('canvasNodes.chatNode.startConversationWithAI')}</p>
                  <p className="text-xs ">{t('canvasNodes.chatNode.connectImagesOrTexts')}</p>
                </div>
              )}
            </div>
          ) : (
            messages.map((msg) => (
              <ChatMessage
                key={msg.id}
                role={msg.role}
                content={msg.content}
                nodeId={nodeId}
                onAddPrompt={nodeData.onAddPromptNode}
                onCreateNode={nodeData.onCreateNode}
                t={t}
              />
            ))
          )}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-muted/80 border-neutral-700/40 max-w-[85%] min-w-0 p-3.5 rounded-md backdrop-blur-sm shadow-sm flex items-center gap-2.5">
                <GlitchLoader size={16} />
                <span className="text-sm text-neutral-400">{t('canvasNodes.chatNode.thinking')}</span>
              </div>
            </div>
          )}
        </div>

        {/* Compact Context Preview at the bottom */}
        {hasContext && (
          <div className="px-4 py-3 border-t border-neutral-700/30 bg-gradient-to-r from-neutral-900/40 to-neutral-900/20 backdrop-blur-sm min-w-0">
            <div className="flex items-center justify-between gap-4 min-w-0">
              <div className="flex items-center gap-3 overflow-x-auto py-0.5 min-w-0 flex-1">
                <div className="flex items-center gap-1.5 text-[10px] text-neutral-400 shrink-0 border-r border-neutral-700/40 pr-3 mr-1">
                  <CheckCircle2 size={11} className="text-brand-cyan" />
                  <span className="font-medium">{t('canvasNodes.chatNode.context')}</span>
                </div>

                {connectedImages.length > 0 && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 bg-brand-cyan/10 border border-brand-cyan/30 rounded-full shrink-0 backdrop-blur-sm shadow-sm">
                    <ImageIcon size={11} className="text-brand-cyan" />
                    <MicroTitle className="text-[10px] text-brand-cyan font-bold">{connectedImages.length}</MicroTitle>
                  </div>
                )}
                {connectedText && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 bg-purple-500/10 border border-purple-500/30 rounded-full shrink-0 backdrop-blur-sm shadow-sm">
                    <FileText size={11} className="text-purple-400" />
                    <span className="text-[10px] text-purple-400 font-bold">{connectedText.length}</span>
                  </div>
                )}
                {connectedStrategyData && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/10 border border-amber-500/30 rounded-full shrink-0 backdrop-blur-sm shadow-sm">
                    <Target size={11} className="text-amber-400" />
                    <span className="text-[10px] text-amber-400 font-bold">{strategySections.length}</span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button variant="brand" onClick={handleSuggestMockups} disabled={isLoading} className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-cyan/10 hover:bg-brand-cyan/20 border border-brand-cyan/40 rounded-md text-[10px] text-brand-cyan transition-all disabled:opacity-50 tracking-tighter backdrop-blur-sm shadow-sm hover:shadow-md hover:scale-105 active:scale-95">
                  <Diamond size={11} />
                  <span>{t('canvasNodes.chatNode.suggestMockups')}</span>
                </Button>

                <Button variant="ghost" onClick={() => setExpandedStrategy(!expandedStrategy)}
                  className="p-1.5 text-neutral-500 hover:text-neutral-300 transition-all rounded-md hover:bg-neutral-800/50"
                  title="Toggle details"
                >
                  {expandedStrategy ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                </Button>
              </div>
            </div>

            {/* Expanded Details */}
            {expandedStrategy && (
              <div className="mt-3 pt-3 border-t border-neutral-700/20 space-y-3 animate-in slide-in-from-bottom-1 duration-200">
                {connectedImages.length > 0 && (
                  <div className="bg-neutral-900/60 p-2 rounded-md border border-brand-cyan/20 backdrop-blur-sm shadow-sm">
                    <ConnectedImagesDisplay
                      images={connectedImages}
                      label=""
                      maxThumbnails={4}
                      onImageRemove={handleImageRemove}
                      showLabel={false}
                    />
                  </div>
                )}

                <div className="flex flex-col gap-2">
                  {connectedText && (
                    <div className="text-[10px] text-neutral-300 font-mono line-clamp-2 bg-purple-500/10 p-2 rounded-md border border-purple-500/20 backdrop-blur-sm">
                      <span className="text-purple-400 mr-1.5 uppercase font-semibold">Text:</span>
                      {connectedText}
                    </div>
                  )}
                  {connectedStrategyData && (
                    <div className="flex flex-wrap gap-1.5">
                      {strategySections.map((s, i) => (
                        <span key={i} className="text-[9px] px-2 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded-md font-mono uppercase backdrop-blur-sm shadow-sm">
                          {s}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Input Area */}
        <div className="p-4 border-t border-neutral-700/30 bg-gradient-to-r from-neutral-900/60 to-neutral-900/40 backdrop-blur-sm relative z-10">
          <Input
            ref={mediaInputRef}
            type="file"
            accept="image/*"
            onChange={handleMediaFileChange}
            className="hidden"
          />
          <ChatInput
            value={inputMessage}
            onChange={setInputMessage}
            onSend={handleSend}
            isLoading={isLoading}
            placeholder={hasContext ? t('canvasNodes.chatNode.askAboutContext') : t('canvasNodes.chatNode.typeYourMessage')}
            showAttach={(nodeData.onAttachMedia || nodeData.onCreateNode) !== undefined}
            onAttachClick={handleAttachMediaClick}
          />
        </div>
      </div>
    </aside>
  );
};
