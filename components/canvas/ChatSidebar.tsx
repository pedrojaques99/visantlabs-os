import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { ChevronRight, MessageSquare, X, FileText, Image as ImageIcon, CheckCircle2, Target, ChevronDown, ChevronUp, Sparkles, Plus, Wand2, Layers, Paperclip, Copy, Check, Settings2, Send } from 'lucide-react';
import type { ChatNodeData, FlowNodeType } from '../../types/reactFlow';
import { cn } from '../../lib/utils';
import { useTranslation } from '../../hooks/useTranslation';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { Card, CardContent } from '../ui/card';
import { ConnectedImagesDisplay } from '../reactflow/ConnectedImagesDisplay';
import { getMessagesUntilNextCredit } from '../../utils/creditCalculator';
import { MarkdownRenderer } from '../../utils/markdownRenderer';
import { parseActionsFromResponse, type DetectedAction } from '../../services/chatService';
import { toast } from 'sonner';
import { fileToBase64 } from '../../utils/fileUtils';
import { GlitchLoader } from '../ui/GlitchLoader';

interface ChatSidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  nodeData: ChatNodeData;
  nodeId: string;
  onUpdateData?: (nodeId: string, newData: Partial<ChatNodeData>) => void;
  variant?: 'standalone' | 'stacked' | 'embedded';
  sidebarWidth?: number;
  onSidebarWidthChange?: (width: number) => void;
  sidebarRef?: React.RefObject<HTMLElement>;
}

const SIDEBAR_WIDTH = 400;
const COLLAPSED_WIDTH = 56;
const MIN_WIDTH = 320;
const MAX_WIDTH = 800;

// Auto-resize textarea component (reused from ChatNode)
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

/**
 * Icon mapping for different action types
 */
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
    default: return 'text-zinc-400 border-zinc-400/30 bg-zinc-400/10 hover:bg-zinc-400/20';
  }
};

/**
 * Component to detect and display actionable suggestions from AI messages
 */
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

    // First try to parse structured actions
    const structuredActions = parseActionsFromResponse(content);
    if (structuredActions.length > 0) {
      return structuredActions;
    }

    // Fallback to legacy detection for backwards compatibility
    const lines = content.split('\n');
    const results: DetectedAction[] = [];

    lines.forEach(line => {
      const match = line.match(/^[-*•\d.]*\s*(?:\*\*)?([^*:]+)(?:\*\*)?:\s*(.+)$/i);
      if (match) {
        const title = match[1].trim();
        const description = match[2].trim();
        if (title.length > 3 && (
          title.toLowerCase().includes('mockup') ||
          description.toLowerCase().includes('mockup') ||
          (description.length > 30 && title.length < 50)
        )) {
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
    <div className="pt-3 border-t border-zinc-700/20 space-y-2.5 min-w-0">
      <div className="text-[10px] font-mono text-brand-cyan/80 flex items-center gap-1.5 mb-2 min-w-0">
        <Sparkles size={11} className="animate-pulse text-brand-cyan shrink-0" />
        <span className="uppercase tracking-wider truncate">{t('canvasNodes.chatNode.detectedActions') || 'Detected Actions'}</span>
      </div>
      <div className="flex flex-wrap gap-2 min-w-0">
        {actions.map((action, i) => (
          <button
            key={i}
            onClick={(e) => {
              e.stopPropagation();
              handleActionClick(action);
            }}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1.5 border rounded-md text-[10px] transition-all group animate-in fade-in slide-in-from-bottom-1 duration-300",
              "backdrop-blur-sm shadow-sm hover:shadow-md hover:scale-[1.02] active:scale-[0.98]",
              getActionColor(action.type)
            )}
            style={{ animationDelay: `${i * 50}ms` }}
            title={action.description}
          >
            {getActionIcon(action.type)}
            <span className="max-w-[180px] truncate font-medium">{action.title}</span>
            <Plus size={8} className="opacity-50 group-hover:opacity-100 group-hover:scale-125 transition-all" />
          </button>
        ))}
      </div>
    </div>
  );
};

/**
 * Quick Actions panel for common node creation tasks
 */
const QuickActionsPanel = ({
  nodeId,
  onCreateNode,
  onAddPrompt,
  isLoading,
  t
}: {
  nodeId: string;
  onCreateNode?: (chatNodeId: string, nodeType: FlowNodeType, initialData?: any, connectToChat?: boolean) => string | undefined;
  onAddPrompt?: (nodeId: string, prompt: string) => void;
  isLoading: boolean;
  t: any;
}) => {
  const quickActions = [
    { type: 'prompt' as FlowNodeType, label: 'Prompt', icon: <Wand2 size={12} />, color: 'text-purple-400' },
    { type: 'mockup' as FlowNodeType, label: 'Mockup', icon: <Layers size={12} />, color: 'text-brand-cyan' },
    { type: 'strategy' as FlowNodeType, label: 'Strategy', icon: <Target size={12} />, color: 'text-amber-400' },
    { type: 'text' as FlowNodeType, label: 'Text', icon: <FileText size={12} />, color: 'text-green-400' },
  ];

  const handleQuickAction = (type: FlowNodeType) => {
    if (!onCreateNode) return;
    onCreateNode(nodeId, type, undefined, false);
  };

  if (!onCreateNode) return null;

  return (
    <div className="flex items-center gap-1.5">
      {quickActions.map((action) => (
        <button
          key={action.type}
          onClick={() => handleQuickAction(action.type)}
          disabled={isLoading}
          className={cn(
            "p-2 rounded-md border border-zinc-700/40 transition-all hover:border-zinc-600/60 disabled:opacity-50",
            "bg-zinc-900/60 hover:bg-zinc-800/70 backdrop-blur-sm",
            "hover:scale-105 active:scale-95 shadow-sm hover:shadow-md",
            action.color
          )}
          title={`Create ${action.label} Node`}
        >
          {action.icon}
        </button>
      ))}
    </div>
  );
};

export const ChatSidebar: React.FC<ChatSidebarProps & { width?: number }> = ({
  isCollapsed,
  onToggleCollapse,
  nodeData,
  nodeId,
  onUpdateData,
  variant = 'standalone',
  sidebarWidth = SIDEBAR_WIDTH,
  onSidebarWidthChange,
  sidebarRef,
  width,
}) => {
  const { t } = useTranslation();
  const [inputMessage, setInputMessage] = useState('');
  const messagesAreaRef = useRef<HTMLDivElement>(null);
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [showSystemPromptEditor, setShowSystemPromptEditor] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState(nodeData.systemPrompt || '');
  const [expandedStrategy, setExpandedStrategy] = useState(false);
  const [isLargeScreen, setIsLargeScreen] = useState(false);
  const resizerRef = useRef<HTMLDivElement>(null);
  const internalSidebarRef = useRef<HTMLElement>(null);
  const actualSidebarRef = sidebarRef || internalSidebarRef;

  const isLoading = nodeData.isLoading || false;
  const model = nodeData.model || 'gemini-2.5-flash';
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

  // Check screen size for responsive width
  useEffect(() => {
    const checkScreenSize = () => {
      setIsLargeScreen(window.innerWidth >= 1024);
    };

    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  // Setup resizer functionality
  useEffect(() => {
    if (isCollapsed || !onSidebarWidthChange) return;
    if (!resizerRef.current || !actualSidebarRef.current) return;

    const resizer = resizerRef.current;
    const sidebar = actualSidebarRef.current;

    const handleMouseDown = (e: MouseEvent) => {
      e.preventDefault();
      const startX = e.clientX;
      const startWidth = sidebar.offsetWidth;

      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const dx = moveEvent.clientX - startX;
        const newWidth = startWidth + dx;

        if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
          onSidebarWidthChange(newWidth);
        }
      };

      const handleMouseUp = () => {
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };

      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    };

    resizer.addEventListener('mousedown', handleMouseDown);

    return () => {
      resizer.removeEventListener('mousedown', handleMouseDown);
    };
  }, [isCollapsed, onSidebarWidthChange, actualSidebarRef]);

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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleCopyMessage = useCallback(async (messageId: string, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedMessageId(messageId);
      toast.success(t('canvasNodes.chatNode.messageCopied') || 'Message copied to clipboard', { duration: 2000 });
      setTimeout(() => setCopiedMessageId(null), 2000);
    } catch (error) {
      console.error('Failed to copy message:', error);
      toast.error(t('canvasNodes.chatNode.copyFailed') || 'Failed to copy message', { duration: 3000 });
    }
  }, [t]);

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

  // Handle media attachment
  const handleAttachMediaClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
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
  }, [nodeId, nodeData, t]);

  const currentWidth = isCollapsed ? COLLAPSED_WIDTH : (variant === 'embedded' && width ? width : sidebarWidth);

  return (
    <aside
      ref={actualSidebarRef as React.RefObject<HTMLDivElement>}
      data-chat-sidebar="true"
      className={cn(
        "relative",
        variant === 'embedded' ? "border-none shadow-none bg-transparent" : "z-50 backdrop-blur-xl border-l border-zinc-800/50 shadow-2xl bg-black/40",
        "transition-all duration-300 ease-out",
        "flex flex-col",
        "flex-shrink-0",
        isCollapsed ? "w-[56px]" : "w-full"
      )}
      style={{
        width: variant === 'embedded' ? '100%' : `${currentWidth}px`,
        height: '100%',
        backgroundColor: variant === 'embedded' ? 'transparent' : 'var(--sidebar)',
      }}
    >
      {/* Resizer - only show on large screens when expanded, positioned on left edge */}
      {!isCollapsed && isLargeScreen && onSidebarWidthChange && (
        <div
          ref={resizerRef}
          className="hidden lg:block absolute left-0 top-0 h-full w-2 cursor-col-resize group z-10"
          style={{ touchAction: 'none' }}
        >
          <div className="w-px h-full mx-auto bg-zinc-800/50 group-hover:bg-brand-cyan/50 transition-colors duration-200"></div>
        </div>
      )}
      {/* Toggle Button - Only visible when expanded */}
      {!isCollapsed && (
        <button
          onClick={onToggleCollapse}
          className={cn(
            "absolute left-2 z-50",
            "w-6 h-6 rounded-md",
            "bg-zinc-900/80 backdrop-blur-md border border-zinc-700/50",
            "flex items-center justify-center",
            "text-zinc-400 hover:text-zinc-200",
            "hover:bg-zinc-800/80 hover:border-zinc-600/60",
            "transition-all duration-200",
            "shadow-sm hover:shadow-md"
          )}
          title={t('canvasNodes.chatNode.collapse') || 'Collapse'}
        >
          <ChevronRight size={12} />
        </button>
      )}

      {isCollapsed ? (
        /* Collapsed State - Icon Only */
        <button
          onClick={onToggleCollapse}
          className="w-full h-full flex items-center justify-center text-brand-cyan hover:text-brand-cyan/80 transition-colors border-l border-zinc-800/50"
          title={t('canvasNodes.chatNode.expand') || 'Expand Chat'}
        >
          <MessageSquare size={20} />
        </button>
      ) : (
        /* Expanded State - Full Content */
        <div className="flex flex-col h-full overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-zinc-700/30 bg-gradient-to-r from-zinc-900/40 to-zinc-900/20 backdrop-blur-sm min-w-0">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <div className="p-1.5 rounded-md bg-brand-cyan/10 border border-brand-cyan/20 shrink-0">
                <MessageSquare size={16} className="text-brand-cyan" />
              </div>
              <h3 className="text-sm font-semibold text-zinc-200 font-mono tracking-tight truncate">{t('canvasNodes.chatNode.title')}</h3>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <QuickActionsPanel
                nodeId={nodeId}
                onCreateNode={nodeData.onCreateNode}
                onAddPrompt={nodeData.onAddPromptNode}
                isLoading={isLoading}
                t={t}
              />
              <button
                onClick={() => setShowSystemPromptEditor(!showSystemPromptEditor)}
                className={cn(
                  "p-2 rounded-md border transition-all bg-zinc-900/60 border-zinc-700/40 text-zinc-400 hover:border-zinc-600/60 hover:text-zinc-200 hover:bg-zinc-800/70 backdrop-blur-sm shadow-sm hover:shadow-md hover:scale-105 active:scale-95",
                  showSystemPromptEditor && "border-brand-cyan/50 text-brand-cyan bg-brand-cyan/10"
                )}
                title={t('canvasNodes.chatNode.systemPromptSettings') || 'System Prompt Settings'}
              >
                <Settings2 size={14} />
              </button>
            </div>
          </div>

          {/* System Prompt Editor */}
          {showSystemPromptEditor && (
            <div className="px-4 py-3 border-b border-zinc-700/30 bg-gradient-to-r from-zinc-900/50 to-zinc-900/30 backdrop-blur-sm animate-in slide-in-from-top-1 duration-200">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-mono text-zinc-300 font-semibold uppercase tracking-wider">
                  {t('canvasNodes.chatNode.systemPrompt') || 'System Prompt (Agent Personality)'}
                </label>
                <div className="flex items-center gap-2">
                  {systemPrompt && (
                    <button
                      onClick={handleResetSystemPrompt}
                      className="text-[10px] px-2 py-1 rounded border border-zinc-600/40 text-zinc-400 hover:text-zinc-200 hover:border-zinc-500/60 transition-all"
                    >
                      {t('canvasNodes.chatNode.resetToDefault') || 'Reset to Default'}
                    </button>
                  )}
                  <button
                    onClick={handleSaveSystemPrompt}
                    className="text-[10px] px-2 py-1 rounded bg-brand-cyan/20 border border-brand-cyan/40 text-brand-cyan hover:bg-brand-cyan/30 transition-all"
                  >
                    {t('canvasNodes.chatNode.save') || 'Save'}
                  </button>
                </div>
              </div>
              <AutoResizeTextarea
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                placeholder={t('canvasNodes.chatNode.systemPromptPlaceholder') || 'Enter custom system prompt to personalize the agent personality. Leave empty to use default.'}
                className="resize-none bg-zinc-900/60 border-zinc-700/40 focus:border-brand-cyan/50 focus:ring-1 focus:ring-brand-cyan/20 backdrop-blur-sm text-xs font-mono min-h-[120px] max-h-[300px]"
                minHeight={120}
                maxHeight={300}
                disabled={isLoading}
              />
              <p className="text-[10px] text-zinc-500 mt-2 font-mono">
                {t('canvasNodes.chatNode.systemPromptHint') || 'This prompt defines how the AI assistant behaves. Use it to customize tone, style, and expertise.'}
              </p>
            </div>
          )}

          {/* Credit Indicator */}
          <div className="px-4 py-2.5 border-b border-zinc-700/30 bg-gradient-to-r from-zinc-900/50 to-zinc-900/30 backdrop-blur-sm">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="text-zinc-300 font-mono font-medium">
                {t('canvasNodes.chatNode.messages')}: <span className="text-brand-cyan">{userMessageCount}</span>
              </span>
              <span className="text-zinc-400 font-mono text-[10px]">
                {t('canvasNodes.chatNode.nextCreditIn')} {messagesUntilNextCredit} {messagesUntilNextCredit > 1 ? t('canvasNodes.chatNode.messagesPlural') : t('canvasNodes.chatNode.message')}
              </span>
            </div>
            <div className="h-1.5 bg-zinc-800/40 rounded-full overflow-hidden shadow-inner">
              <div
                className="h-full bg-gradient-to-r from-brand-cyan to-brand-cyan/80 transition-all duration-500 ease-out shadow-sm"
                style={{ width: `${((userMessageCount % 4) / 4) * 100}%` }}
              />
            </div>
          </div>

          {/* Messages Area */}
          <div
            ref={messagesAreaRef}
            className="flex-1 p-4 overflow-y-auto overflow-x-hidden space-y-4 min-h-0 min-w-0 scroll-smooth bg-gradient-to-b from-transparent via-zinc-900/10 to-transparent"
            onWheel={(e) => e.stopPropagation()}
          >
            {messages.length === 0 ? (
              <div className="text-center text-sm text-muted-foreground py-12">
                {hasContext ? (
                  <div className="space-y-3">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-brand-cyan/10 border border-brand-cyan/20 mb-2">
                      <MessageSquare size={20} className="text-brand-cyan/70" />
                    </div>
                    <p className="text-zinc-300 font-medium">{t('canvasNodes.chatNode.startConversationWithContext')}</p>
                    <p className="text-xs text-zinc-500">{t('canvasNodes.chatNode.chatWillUseImagesAndTexts')}</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-zinc-800/50 border border-zinc-700/30 mb-2">
                      <MessageSquare size={20} className="text-zinc-500" />
                    </div>
                    <p className="text-zinc-300 font-medium">{t('canvasNodes.chatNode.startConversationWithAI')}</p>
                    <p className="text-xs text-zinc-500">{t('canvasNodes.chatNode.connectImagesOrTexts')}</p>
                  </div>
                )}
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    "flex",
                    msg.role === 'user' ? 'justify-end' : 'justify-start'
                  )}
                >
                  <Card
                    className={cn(
                      "max-w-[85%] min-w-0 p-3.5 rounded-lg shadow-sm relative group",
                      msg.role === 'user'
                        ? 'bg-primary text-primary-foreground border-primary/20'
                        : 'bg-muted/80 border-zinc-700/40 backdrop-blur-sm'
                    )}
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCopyMessage(msg.id, msg.content);
                      }}
                      className={cn(
                        "absolute top-2 right-2 p-1.5 rounded-md transition-all opacity-0 group-hover:opacity-100",
                        "backdrop-blur-sm shadow-sm hover:shadow-md",
                        msg.role === 'user'
                          ? 'bg-primary/20 hover:bg-primary/30 text-primary-foreground/80 hover:text-primary-foreground'
                          : 'bg-zinc-800/60 hover:bg-zinc-700/80 text-zinc-300 hover:text-zinc-100'
                      )}
                      title={t('canvasNodes.chatNode.copyMessage') || 'Copy message'}
                    >
                      {copiedMessageId === msg.id ? (
                        <Check size={14} className="text-green-400" />
                      ) : (
                        <Copy size={14} />
                      )}
                    </button>
                    <CardContent className="p-0 min-w-0 select-text">
                      <div className="text-sm break-words leading-relaxed min-w-0 select-text">
                        {msg.role === 'assistant' ? (
                          <MarkdownRenderer content={msg.content} preserveLines className="font-sans select-text" />
                        ) : (
                          <p className="whitespace-pre-wrap select-text">{msg.content}</p>
                        )}
                      </div>
                      {msg.role === 'assistant' && (nodeData.onAddPromptNode || nodeData.onCreateNode) && (
                        <ActionDetector
                          content={msg.content}
                          nodeId={nodeId}
                          onAddPrompt={nodeData.onAddPromptNode}
                          onCreateNode={nodeData.onCreateNode}
                          t={t}
                        />
                      )}
                    </CardContent>
                  </Card>
                </div>
              ))
            )}
            {isLoading && (
              <div className="flex justify-start">
                <Card className="bg-muted/80 border-zinc-700/40 max-w-[85%] min-w-0 p-3.5 rounded-lg backdrop-blur-sm shadow-sm">
                  <CardContent className="p-0 flex items-center gap-2.5 min-w-0">
                    <GlitchLoader size={16} color="currentColor" />
                    <span className="text-sm text-muted-foreground">{t('canvasNodes.chatNode.thinking')}</span>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>

          {/* Compact Context Preview at the bottom */}
          {hasContext && (
            <div className="px-4 py-3 border-t border-zinc-700/30 bg-gradient-to-r from-zinc-900/40 to-zinc-900/20 backdrop-blur-sm min-w-0">
              <div className="flex items-center justify-between gap-4 min-w-0">
                <div className="flex items-center gap-3 overflow-x-auto py-0.5 min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 font-mono shrink-0 uppercase tracking-wider border-r border-zinc-700/40 pr-3 mr-1">
                    <CheckCircle2 size={11} className="text-brand-cyan" />
                    <span className="font-medium">{t('canvasNodes.chatNode.context')}</span>
                  </div>

                  {connectedImages.length > 0 && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-brand-cyan/10 border border-brand-cyan/30 rounded-full shrink-0 backdrop-blur-sm shadow-sm">
                      <ImageIcon size={11} className="text-brand-cyan" />
                      <span className="text-[10px] text-brand-cyan font-mono font-bold">{connectedImages.length}</span>
                    </div>
                  )}

                  {connectedText && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-purple-500/10 border border-purple-500/30 rounded-full shrink-0 backdrop-blur-sm shadow-sm">
                      <FileText size={11} className="text-purple-400" />
                      <span className="text-[10px] text-purple-400 font-mono font-bold">{connectedText.length}</span>
                    </div>
                  )}

                  {connectedStrategyData && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/10 border border-amber-500/30 rounded-full shrink-0 backdrop-blur-sm shadow-sm">
                      <Target size={11} className="text-amber-400" />
                      <span className="text-[10px] text-amber-400 font-mono font-bold">{strategySections.length}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={handleSuggestMockups}
                    disabled={isLoading}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-cyan/10 hover:bg-brand-cyan/20 border border-brand-cyan/40 rounded-md text-[10px] text-brand-cyan transition-all disabled:opacity-50 font-mono uppercase tracking-tighter backdrop-blur-sm shadow-sm hover:shadow-md hover:scale-105 active:scale-95"
                  >
                    <Sparkles size={11} />
                    <span>{t('canvasNodes.chatNode.suggestMockups')}</span>
                  </button>

                  <button
                    onClick={() => setExpandedStrategy(!expandedStrategy)}
                    className="p-1.5 text-zinc-500 hover:text-zinc-300 transition-all rounded-md hover:bg-zinc-800/50"
                    title="Toggle details"
                  >
                    {expandedStrategy ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                  </button>
                </div>
              </div>

              {/* Expanded Details */}
              {expandedStrategy && (
                <div className="mt-3 pt-3 border-t border-zinc-700/20 space-y-3 animate-in slide-in-from-bottom-1 duration-200">
                  {connectedImages.length > 0 && (
                    <div className="bg-zinc-900/60 p-2 rounded-lg border border-brand-cyan/20 backdrop-blur-sm shadow-sm">
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
                      <div className="text-[10px] text-zinc-300 font-mono line-clamp-2 bg-purple-500/10 p-2 rounded-md border border-purple-500/20 backdrop-blur-sm">
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
          <div className="p-4 border-t border-zinc-700/30 bg-gradient-to-r from-zinc-900/60 to-zinc-900/40 backdrop-blur-sm relative z-10">
            <input
              ref={mediaInputRef}
              type="file"
              accept="image/*"
              onChange={handleMediaFileChange}
              className="hidden"
            />
            <div className="flex gap-2.5 min-w-0">
              {(nodeData.onAttachMedia || nodeData.onCreateNode) && (
                <Button
                  onClick={handleAttachMediaClick}
                  disabled={isLoading}
                  size="icon"
                  variant="outline"
                  className="self-end shrink-0 border-zinc-700/50 hover:border-brand-cyan/50 hover:bg-brand-cyan/10 text-zinc-400 hover:text-brand-cyan backdrop-blur-sm shadow-sm hover:shadow-md hover:scale-105 active:scale-95 transition-all"
                  title={t('canvasNodes.chatNode.attachMedia') || 'Attach Image'}
                >
                  <Paperclip className="w-4 h-4" />
                </Button>
              )}
              <AutoResizeTextarea
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={hasContext ? t('canvasNodes.chatNode.askAboutContext') : t('canvasNodes.chatNode.typeYourMessage')}
                className="resize-none bg-zinc-900/60 border-zinc-700/40 focus:border-brand-cyan/50 focus:ring-1 focus:ring-brand-cyan/20 backdrop-blur-sm min-w-0 flex-1"
                minHeight={60}
                maxHeight={200}
                disabled={isLoading}
              />
              <Button
                onClick={handleSend}
                disabled={!inputMessage.trim() || isLoading}
                size="icon"
                className="self-end shrink-0 bg-brand-cyan/20 hover:bg-brand-cyan/30 border border-brand-cyan/40 text-brand-cyan hover:text-brand-cyan shadow-sm hover:shadow-md hover:scale-105 active:scale-95 transition-all backdrop-blur-sm"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};

