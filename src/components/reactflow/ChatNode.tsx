import React, { useState, useEffect, useRef, memo, useCallback, useMemo } from 'react';
import { Handle, Position, type NodeProps, NodeResizer, useReactFlow } from '@xyflow/react';
import { Send, MessageSquare, FileText, Image as ImageIcon, CheckCircle2, Target, ChevronDown, ChevronUp, Sparkles, Plus, Wand2, Layers, Paperclip, Copy, Check, Settings2, PanelRight, Maximize2 } from 'lucide-react';
import { GlitchLoader } from '@/components/ui/GlitchLoader';
import type { ChatNodeData, FlowNodeType } from '@/types/reactFlow';
import { cn } from '@/lib/utils';
import { NodeContainer } from './shared/NodeContainer';
import { NodeButton } from './shared/node-button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { ConnectedImagesDisplay } from './ConnectedImagesDisplay';
import { LabeledHandle } from './shared/LabeledHandle';
import { getMessagesUntilNextCredit } from '@/utils/creditCalculator';
import { useTranslation } from '@/hooks/useTranslation';
import { MarkdownRenderer } from '@/utils/markdownRenderer';
import { parseActionsFromResponse, type DetectedAction } from '@/services/chatService';
import { toast } from 'sonner';
import { fileToBase64 } from '@/utils/fileUtils';
import { useNodeResize } from '@/hooks/canvas/useNodeResize';
import { GEMINI_MODELS } from '@/constants/geminiModels';
import { Input } from '@/components/ui/input';
import { MicroTitle } from '@/components/ui/MicroTitle';

// Auto-resize textarea component
const AutoResizeTextarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
    minHeight?: number;
    maxHeight?: number;
    onWheel?: (e: React.WheelEvent<HTMLTextAreaElement>) => void;
}>(({ onChange, minHeight = 40, maxHeight = 400, onWheel, ...props }, ref) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const combinedRef = (node: HTMLTextAreaElement | null) => {
        textareaRef.current = node;
        if (typeof ref === 'function') {
            ref(node);
        } else if (ref) {
            ref.current = node;
        }
    };

    const adjustHeight = useCallback(() => {
        const textarea = textareaRef.current;
        if (textarea) {
            textarea.style.height = 'auto';
            const newHeight = Math.max(textarea.scrollHeight, minHeight);
            textarea.style.height = `${Math.min(newHeight, maxHeight)}px`;
        }
    }, [minHeight, maxHeight]);

    useEffect(() => {
        adjustHeight();
    }, [props.value, adjustHeight]);

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        adjustHeight();
        onChange?.(e);
    };

    return (
        <Textarea
            {...props}
            ref={combinedRef}
            onChange={handleChange}
            onWheel={onWheel}
            className={cn(props.className, 'overflow-y-auto')}
            style={{
                ...props.style,
                minHeight: `${minHeight}px`,
                maxHeight: `${maxHeight}px`,
            }}
        />
    );
});

AutoResizeTextarea.displayName = 'AutoResizeTextarea';

const getActionIcon = (type: DetectedAction['type']) => {
    switch (type) {
        case 'prompt': return <Wand2 size={10} />;
        case 'mockup': return <Layers size={10} />;
        case 'strategy': return <Target size={10} />;
        case 'text': return <FileText size={10} />;
        default: return <Plus size={10} />;
    }
};

const getActionColor = (type: DetectedAction['type']) => {
    switch (type) {
        case 'prompt': return 'text-purple-400 border-purple-400/30 bg-purple-400/10 hover:bg-purple-400/20';
        case 'mockup': return 'text-brand-cyan border-[brand-cyan]/30 bg-brand-cyan/10 hover:bg-brand-cyan/20';
        case 'strategy': return 'text-amber-400 border-amber-400/30 bg-amber-400/10 hover:bg-amber-400/20';
        case 'text': return 'text-green-400 border-green-400/30 bg-green-400/10 hover:bg-green-400/20';
        default: return 'text-neutral-400 border-neutral-400/30 bg-neutral-400/10 hover:bg-neutral-400/20';
    }
};

const ActionDetector = ({
    content,
    onAddPrompt,
    onCreateNode,
    nodeId,
    t
}: {
    content: string;
    onAddPrompt?: (nodeId: string, prompt: string) => void;
    onCreateNode?: (chatNodeId: string, nodeType: FlowNodeType, initialData?: any, connectToChat?: boolean) => string | undefined;
    nodeId: string;
    t: any;
}) => {
    const actions = useMemo(() => {
        if (!content) return [];
        const structuredActions = parseActionsFromResponse(content);
        if (structuredActions.length > 0) return structuredActions;

        // Fallback detection
        const lines = content.split('\n');
        const results: DetectedAction[] = [];
        lines.forEach(line => {
            const match = line.match(/^[-*•\d.]*\s*(?:\*\*)?([^*:]+)(?:\*\*)?:\s*(.+)$/i);
            if (match) {
                const title = match[1].trim();
                const description = match[2].trim();
                if (title.length > 3 && (title.toLowerCase().includes('mockup') || description.toLowerCase().includes('mockup'))) {
                    results.push({
                        type: 'prompt',
                        title,
                        description,
                        fullPrompt: `${title}: ${description}`
                    });
                }
            }
        });
        return results;
    }, [content]);

    const handleActionClick = useCallback((action: DetectedAction) => {
        if (action.type === 'prompt' && onAddPrompt) {
            onAddPrompt(nodeId, action.fullPrompt);
        } else if (onCreateNode) {
            const initialData = action.type === 'prompt'
                ? { prompt: action.fullPrompt }
                : action.type === 'text'
                    ? { text: action.fullPrompt }
                    : undefined;
            onCreateNode(nodeId, action.type, initialData, true);
        }
    }, [nodeId, onAddPrompt, onCreateNode]);

    if (actions.length === 0) return null;

    return (
        <div className="mt-4 pt-3 border-t border-neutral-700/20 space-y-2.5 min-w-0">
            <MicroTitle className="text-[10px] text-brand-cyan/80 flex items-center gap-1.5 mb-2 min-w-0">
                <Sparkles size={11} className="animate-pulse text-brand-cyan shrink-0" />
                <span className=" truncate uppercase">
                    {t('canvasNodes.chatNode.detectedActions') || 'Detected Actions'}
                </span>
            </MicroTitle>
            <div className="flex flex-wrap gap-2 min-w-0">
                {actions.map((action, i) => (
                    <NodeButton
                        variant="ghost"
                        size="xs"
                        key={i}
                        onClick={(e) => {
                            e.stopPropagation();
                            handleActionClick(action);
                        }}
                        className={cn(
                            "flex items-center gap-1.5 border rounded-md transition-all nodrag",
                            getActionColor(action.type)
                        )}
                        title={action.description}
                    >
                        {getActionIcon(action.type)}
                        <span className="max-w-[180px] truncate font-medium">{action.title}</span>
                        <Plus size={8} className="opacity-50 group-hover:opacity-300" />
                    </NodeButton>
                ))}
            </div>
        </div>
    );
};

export const ChatNode = memo(({ data, selected, id, dragging }: NodeProps<any>) => {
    const nodeId = id as string;
    const isSelected = selected as boolean;
    const isDragging = dragging as boolean;
    const { t } = useTranslation();
    const { handleResize: handleResizeWithDebounce } = useNodeResize();
    const nodeData = data as ChatNodeData;
    const [inputMessage, setInputMessage] = useState('');
    const messagesAreaRef = useRef<HTMLDivElement>(null);
    const mediaInputRef = useRef<HTMLInputElement>(null);
    const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
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
    const [expandedStrategy, setExpandedStrategy] = useState(false);

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

    const handleCopyMessage = useCallback(async (msgId: string, content: string) => {
        try {
            await navigator.clipboard.writeText(content);
            setCopiedMessageId(msgId);
            toast.success(t('canvasNodes.chatNode.messageCopied'));
            setTimeout(() => setCopiedMessageId(null), 2000);
        } catch (e) {
            toast.error(t('canvasNodes.chatNode.copyFailed'));
        }
    }, [t]);

    return (
        <NodeContainer selected={isSelected} dragging={isDragging} className="h-full overflow-hidden">
            <LabeledHandle type="target" position={Position.Left} id="text-input" label="Text" handleType="text" style={{ top: 60 }} />
            <LabeledHandle type="target" position={Position.Left} id="strategy-input" label="Strategy" handleType="strategy" style={{ top: 100 }} />
            {[1, 2, 3, 4].map(idx => (
                <LabeledHandle key={idx} type="target" position={Position.Left} id={`input-${idx}`} label={`Image ${idx}`} handleType="image" style={{ top: 120 + idx * 60 }} />
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
                    <div className="flex items-center gap-1.5 ml-4">
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

                {/* System Prompt Editor */}
                {showSystemPromptEditor && (
                    <div className="px-4 py-3 border-b border-neutral-700/30 bg-neutral-900/50 backdrop-blur-sm animate-in slide-in-from-top-1">
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-[10px] font-mono text-neutral-400 font-semibold uppercase ">System Prompt</label>
                            <div className="flex items-center gap-2">
                                <NodeButton variant="ghost" size="xs" onClick={handleResetSystemPrompt} className="text-[9px]">Reset</NodeButton>
                                <NodeButton variant="primary" size="xs" onClick={handleSaveSystemPrompt} className="text-[9px]">Save</NodeButton>
                            </div>
                        </div>
                        <AutoResizeTextarea
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
                            <div key={msg.id} className={cn("flex", msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                                <div className={cn("max-w-[85%] p-3.5 rounded-md relative group border transition-all",
                                    msg.role === 'user' ? 'bg-brand-cyan/10 border-brand-cyan/30 text-neutral-200' : 'bg-neutral-800/80 border-neutral-700/40 text-neutral-300')}>
                                    <NodeButton
                                        variant="ghost"
                                        size="xs"
                                        onClick={() => handleCopyMessage(msg.id, msg.content)}
                                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-300 transition-opacity"
                                    >
                                        {copiedMessageId === msg.id ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
                                    </NodeButton>
                                    <div className="text-sm leading-relaxed whitespace-pre-wrap select-text">
                                        {msg.role === 'assistant' ? <MarkdownRenderer content={msg.content} /> : msg.content}
                                    </div>
                                    {msg.role === 'assistant' && <ActionDetector content={msg.content} nodeId={nodeId} onAddPrompt={nodeData.onAddPromptNode} onCreateNode={nodeData.onCreateNode} t={t} />}
                                </div>
                            </div>
                        ))
                    )}
                    {isLoading && <div className="flex justify-start"><GlitchLoader size={16} /></div>}
                </div>

                {/* Context & Input */}
                <div className="p-4 border-t border-neutral-700/30 bg-neutral-900/60 backdrop-blur-sm space-y-3">
                    {hasContext && (
                        <div className="flex items-center justify-between pb-3 border-b border-neutral-700/20">
                            <div className="flex gap-2">
                                <span className="text-[10px] text-brand-cyan flex items-center gap-1 uppercase font-bold tracking-widest"><CheckCircle2 size={10} /> Context</span>
                                {connectedImages.length > 0 && <span className="text-[10px] bg-brand-cyan/10 text-brand-cyan px-2 rounded-full border border-brand-cyan/20">Images: {connectedImages.length}</span>}
                            </div>
                            <NodeButton variant="primary" size="xs" onClick={handleSuggestMockups} disabled={isLoading}>
                                <Sparkles size={11} className="mr-1.5" /> Suggest
                            </NodeButton>
                        </div>
                    )}
                    <div className="flex gap-2">
                        <AutoResizeTextarea
                            value={inputMessage}
                            onChange={(e) => setInputMessage(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
                            className="bg-neutral-900/40 border-neutral-700/40 flex-1 min-h-[44px]"
                            placeholder="Ask anything..."
                        />
                        <NodeButton variant="primary" size="xs" onClick={handleSend} disabled={!inputMessage.trim() || isLoading} className="h-11 w-11 shrink-0">
                            <Send size={16} />
                        </NodeButton>
                    </div>
                </div>
            </div>

            {isSelected && !isDragging && (
                <NodeResizer color="brand-cyan" isVisible={isSelected} minWidth={500} minHeight={600} onResize={(_, { width, height }) => handleResizeWithDebounce(nodeId, width, height, nodeData.onResize)} />
            )}
        </NodeContainer>
    );
});

ChatNode.displayName = 'ChatNode';
