import React, { useState, useEffect, useRef, memo, useCallback, useMemo } from 'react';
import { Handle, Position, type NodeProps, NodeResizer, useReactFlow } from '@xyflow/react';
import { MessageSquare, CheckCircle2, Sparkles, Settings2, PanelRight } from 'lucide-react';
import { GlitchLoader } from '@/components/ui/GlitchLoader';
import type { ChatNodeData } from '@/types/reactFlow';
import { cn } from '@/lib/utils';
import { NodeContainer } from './shared/NodeContainer';
import { NodeButton } from './shared/node-button';
import { Textarea } from '@/components/ui/textarea';
import { LabeledHandle } from './shared/LabeledHandle';
import { useTranslation } from '@/hooks/useTranslation';
import { toast } from 'sonner';
import { useNodeResize } from '@/hooks/canvas/useNodeResize';

import { ChatMessage } from '../shared/chat/ChatMessage';
import { ChatInput } from '../shared/chat/ChatInput';
import { ModelSelector } from '../shared/ModelSelector';
import { GEMINI_MODELS } from '@/constants/geminiModels';

export const ChatNode = memo(({ data, selected, id, dragging }: NodeProps<any>) => {
    const nodeId = id as string;
    const isSelected = selected as boolean;
    const isDragging = dragging as boolean;
    const { t } = useTranslation();
    const { handleResize: handleResizeWithDebounce } = useNodeResize();
    const nodeData = data as ChatNodeData;
    const [inputMessage, setInputMessage] = useState('');
    const messagesAreaRef = useRef<HTMLDivElement>(null);
    const [showSystemPromptEditor, setShowSystemPromptEditor] = useState(false);
    const [systemPrompt, setSystemPrompt] = useState(nodeData.systemPrompt || '');
    const isLoading = nodeData.isLoading || false;
    const messages = nodeData.messages || [];
    const userMessageCount = nodeData.userMessageCount || 0;

    const connectedImages = [
        nodeData.connectedImage1,
        nodeData.connectedImage2,
        nodeData.connectedImage3,
        nodeData.connectedImage4,
    ].filter((img): img is string => !!img);

    const hasContext = connectedImages.length > 0 || !!nodeData.connectedText || !!nodeData.connectedStrategyData;

    useEffect(() => {
        setSystemPrompt(nodeData.systemPrompt || '');
    }, [nodeData.systemPrompt]);

    const handleSaveSystemPrompt = useCallback(() => {
        if (nodeData.onUpdateData) {
            nodeData.onUpdateData(nodeId, { systemPrompt: systemPrompt.trim() || undefined });
            setShowSystemPromptEditor(false);
            toast.success(t('canvasNodes.chatNode.systemPromptSaved') || 'System prompt saved');
        }
    }, [nodeId, nodeData, systemPrompt, t]);

    const handleResetSystemPrompt = useCallback(() => {
        if (nodeData.onUpdateData) {
            nodeData.onUpdateData(nodeId, { systemPrompt: undefined });
            setSystemPrompt('');
            setShowSystemPromptEditor(false);
            toast.success(t('canvasNodes.chatNode.systemPromptReset') || 'System prompt reset');
        }
    }, [nodeId, nodeData, t]);

    useEffect(() => {
        if (messagesAreaRef.current) {
            messagesAreaRef.current.scrollTop = messagesAreaRef.current.scrollHeight;
        }
    }, [messages, isLoading]);

    const handleSend = async () => {
        if (!inputMessage.trim() || isLoading || !nodeData.onSendMessage) return;
        const message = inputMessage.trim();
        setInputMessage('');
        await nodeData.onSendMessage(nodeId, message, {
            images: connectedImages.length > 0 ? connectedImages : undefined,
            text: nodeData.connectedText,
            strategyData: nodeData.connectedStrategyData,
        });
    };

    const handleSuggestMockups = useCallback(() => {
        if (isLoading || !nodeData.onSendMessage) return;
        const msg = "Suggest 5 creative mockups based on the context. Use **[ACTION:prompt]** status.";
        nodeData.onSendMessage(nodeId, msg, {
            images: connectedImages.length > 0 ? connectedImages : undefined,
            text: nodeData.connectedText,
            strategyData: nodeData.connectedStrategyData,
        });
    }, [isLoading, nodeData, nodeId, connectedImages]);

    const handleModelChange = useCallback((model: string) => {
        if (nodeData.onUpdateData) {
            nodeData.onUpdateData(nodeId, { model: model as any });
        }
    }, [nodeId, nodeData]);


    return (
        <NodeContainer selected={isSelected} dragging={isDragging} className="h-full overflow-hidden">
            <LabeledHandle type="target" position={Position.Left} id="text-input" label={t('canvasNodes.chatNode.textContext') || 'Text'} handleType="text" style={{ top: 60 }} />
            <LabeledHandle type="target" position={Position.Left} id="strategy-input" label={t('canvasNodes.chatNode.strategyData') || 'Strategy'} handleType="strategy" style={{ top: 100 }} />
            {[1, 2, 3, 4].map(idx => (
                <LabeledHandle key={idx} type="target" position={Position.Left} id={`input-${idx}`} label={`${t('canvasNodes.chatNode.image')} ${idx}`} handleType="image" style={{ top: 120 + idx * 60 }} />
            ))}
            <Handle type="source" position={Position.Bottom} className="node-handle handle-generic" style={{ left: '50%', marginLeft: -3 }} />

            <div className="flex flex-col h-full w-full min-h-[600px] overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-neutral-700/30 bg-gradient-to-r from-neutral-900/40 to-neutral-900/20 backdrop-blur-sm">
                    <div className="flex items-center gap-3 flex-1 truncate">
                        <div className="p-1.5 rounded-md bg-neutral-900/10 border border-neutral-900/20">
                            <MessageSquare size={14} className="text-neutral-200" />
                        </div>
                        <h3 className="text-xs font-semibold text-neutral-200 font-mono tracking-tight truncate uppercase">
                            {t('canvasNodes.chatNode.title')}
                        </h3>
                    </div>
                    <div className="flex items-center gap-4">
                        <ModelSelector
                            selectedModel={nodeData.model || GEMINI_MODELS.TEXT}
                            onModelChange={handleModelChange}
                            className="w-[120px]"
                        />
                        <div className="flex items-center gap-1.5 shrink-0">
                            {nodeData.onOpenSidebar && (
                                <NodeButton variant="ghost" size="xs" onClick={() => nodeData.onOpenSidebar!(nodeId)} title={t('canvasNodes.chatNode.openAsPanel')}>
                                    <PanelRight size={14} />
                                </NodeButton>
                            )}
                            <NodeButton
                                variant="ghost"
                                size="xs"
                                onClick={() => setShowSystemPromptEditor(!showSystemPromptEditor)}
                                className={cn(showSystemPromptEditor && "text-brand-cyan border-brand-cyan/30 bg-brand-cyan/5")}
                            >
                                <Settings2 size={14} />
                            </NodeButton>
                        </div>
                    </div>
                </div>

                {/* System Prompt Editor */}
                {showSystemPromptEditor && (
                    <div className="px-4 py-3 border-b border-neutral-700/30 bg-neutral-900/50 backdrop-blur-sm animate-in slide-in-from-top-1">
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-[10px] font-mono text-neutral-400 font-semibold uppercase ">{t('canvasNodes.chatNode.systemPrompt') || 'System Prompt'}</label>
                            <div className="flex items-center gap-2">
                                <NodeButton variant="ghost" size="xs" onClick={handleResetSystemPrompt} className="text-[9px]">{t('common.reset') || 'Reset'}</NodeButton>
                                <NodeButton variant="primary" size="xs" onClick={handleSaveSystemPrompt} className="text-[9px]">{t('common.save') || 'Save'}</NodeButton>
                            </div>
                        </div>
                        <Textarea
                            value={systemPrompt}
                            onChange={(e) => setSystemPrompt(e.target.value)}
                            className="text-xs font-mono bg-neutral-900/60 border-neutral-700/40 min-h-[100px]"
                        />
                    </div>
                )}

                {/* Messages */}
                <div ref={messagesAreaRef} className="flex-1 p-4 overflow-y-auto space-y-4 scroll-smooth">
                    {messages.length === 0 ? (
                        <div className="text-center py-12 text-neutral-500">
                            <MessageSquare size={32} className="mx-auto mb-4 opacity-40" />
                            <p className="text-sm font-medium">{t('canvasNodes.chatNode.startConversationWithAI')}</p>
                        </div>
                    ) : (
                        messages.map((msg: any) => (
                            <ChatMessage
                                key={msg.id}
                                role={msg.role}
                                content={msg.content}
                                nodeId={nodeId}
                                onAddPrompt={nodeData.onAddPromptNode}
                                onCreateNode={nodeData.onCreateNode}
                                t={t}
                                showAvatar={false}
                            />
                        ))
                    )}
                    {isLoading && <div className="flex justify-start"><GlitchLoader size={16} /></div>}
                </div>

                {/* Context & Input */}
                <div className="p-4 border-t border-neutral-700/30 bg-neutral-900/60 backdrop-blur-sm space-y-3">
                    {hasContext && (
                        <div className="flex items-center justify-between pb-3 border-b border-neutral-700/20">
                            <div className="flex gap-2">
                                <span className="text-[10px] text-brand-cyan flex items-center gap-1 uppercase font-bold tracking-widest"><CheckCircle2 size={10} /> {t('canvasNodes.chatNode.context') || 'Context'}</span>
                                {connectedImages.length > 0 && <span className="text-[10px] bg-brand-cyan/10 text-brand-cyan px-2 rounded-full border border-brand-cyan/20">{t('canvasNodes.chatNode.images')}: {connectedImages.length}</span>}
                            </div>
                            <NodeButton variant="primary" size="xs" onClick={handleSuggestMockups} disabled={isLoading}>
                                <Sparkles size={11} className="mr-1.5" /> {t('canvasNodes.chatNode.suggestMockups') || 'Suggest'}
                            </NodeButton>
                        </div>
                    )}
                    <ChatInput
                        value={inputMessage}
                        onChange={setInputMessage}
                        onSend={handleSend}
                        isLoading={isLoading}
                        placeholder={t('canvasNodes.chatNode.typeYourMessage') || "Pergunte algo..."}
                    />
                </div>
            </div>

            {isSelected && !isDragging && (
                <NodeResizer color="brand-cyan" isVisible={isSelected} minWidth={500} minHeight={600} onResize={(_, { width }) => handleResizeWithDebounce(nodeId, width, 'auto', nodeData.onResize)} />
            )}
        </NodeContainer>
    );
});

ChatNode.displayName = 'ChatNode';
