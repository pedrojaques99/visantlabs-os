import React, { useState, useEffect, useRef, memo, useCallback, useMemo } from 'react';
import { Handle, Position, type NodeProps, NodeResizer, useReactFlow } from '@xyflow/react';
import { Send, MessageSquare, X, FileText, Image as ImageIcon, CheckCircle2, Target, ChevronDown, ChevronUp } from 'lucide-react';
import { Spinner } from '../ui/Spinner';
import type { ChatNodeData } from '../../types/reactFlow';
import { cn } from '../../lib/utils';
import { NodeContainer } from './shared/NodeContainer';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { Card, CardContent } from '../ui/card';
import { ConnectedImagesDisplay } from './ConnectedImagesDisplay';
import { LabeledHandle } from './shared/LabeledHandle';
import { NodeLabel } from './shared/node-label';
import { NodeButton } from './shared/node-button';
import { getMessagesUntilNextCredit } from '../../utils/creditCalculator';
import { useTranslation } from '../../hooks/useTranslation';

// Auto-resize textarea component (reused from StrategyNode)
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const ChatNode = memo(({ data, selected, id, dragging }: NodeProps<any>) => {
  // Type assertions for props
  const nodeId = id as string;
  const isSelected = selected as boolean;
  const isDragging = dragging as boolean;
  const { t } = useTranslation();
  const { setNodes } = useReactFlow();
  const nodeData = data as ChatNodeData;
  const [inputMessage, setInputMessage] = useState('');
  const messagesAreaRef = useRef<HTMLDivElement>(null);
  const isLoading = nodeData.isLoading || false;
  const model = nodeData.model || 'gemini-2.5-flash';
  const userMessageCount = nodeData.userMessageCount || 0;
  const messages = nodeData.messages || [];

  // Sync connected images
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

  const [expandedText, setExpandedText] = useState(false);
  const [expandedStrategy, setExpandedStrategy] = useState(false);

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

    // Collect context
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

  // Handle resize from NodeResizer
  const handleResize = useCallback((width: number, height: number) => {
    if (nodeData.onResize && typeof nodeData.onResize === 'function') {
      nodeData.onResize(nodeId, width, height);
    }

    setNodes((nds) => {
      return nds.map((n) => {
        if (n.id === nodeId && n.type === 'chat') {
          return {
            ...n,
            style: {
              ...n.style,
              width,
              height,
            },
          };
        }
        return n;
      });
    });
  }, [nodeId, nodeData, setNodes]);

  const maxImages = 4; // Chat supports up to 4 images

  return (
    <NodeContainer selected={isSelected} dragging={isDragging}>
      {/* Text Input Handle */}
      <LabeledHandle
        type="target"
        position={Position.Left}
        id="text-input"
        label="Text"
        handleType="text"
        style={{ top: 60 }}
      />

      {/* Strategy Input Handle */}
      <LabeledHandle
        type="target"
        position={Position.Left}
        id="strategy-input"
        label="Strategy"
        handleType="strategy"
        style={{ top: 100 }}
      />

      {/* Image Input Handles */}
      {maxImages >= 1 && (
        <LabeledHandle
          type="target"
          position={Position.Left}
          id="input-1"
          label="Image 1"
          handleType="image"
          style={{ top: 180 }}
        />
      )}
      {maxImages >= 2 && (
        <LabeledHandle
          type="target"
          position={Position.Left}
          id="input-2"
          label="Image 2"
          handleType="image"
          style={{ top: 240 }}
        />
      )}
      {maxImages >= 3 && (
        <LabeledHandle
          type="target"
          position={Position.Left}
          id="input-3"
          label="Image 3"
          handleType="image"
          style={{ top: 300 }}
        />
      )}
      {maxImages >= 4 && (
        <LabeledHandle
          type="target"
          position={Position.Left}
          id="input-4"
          label="Image 4"
          handleType="image"
          style={{ top: 360 }}
        />
      )}

      {/* Output Handle */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="node-handle handle-generic"
        data-handle-type="generic"
        style={{ left: '50%', marginLeft: -3 }}
      />

      <div className="flex flex-col h-full min-w-[500px] min-h-[600px]">
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-zinc-700/50">
          <div className="flex items-center gap-2">
            <MessageSquare size={18} className="text-[#52ddeb]" />
            <h3 className="text-sm font-semibold text-zinc-300 font-mono">{t('canvasNodes.chatNode.title')}</h3>
          </div>
          <div className="flex items-center gap-2">
            {messages.length > 0 && nodeData.onClearHistory && (
              <button
                onClick={() => nodeData.onClearHistory!(nodeId)}
                className="p-1.5 rounded border transition-all bg-zinc-900/50 border-zinc-700/30 text-zinc-400 hover:border-zinc-600/50 hover:text-zinc-300"
                title={t('canvasNodes.chatNode.clearHistory')}
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Credit Indicator */}
        <div className="p-2 border-b border-zinc-700/50 bg-zinc-900/30">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-zinc-400 font-mono">
              {t('canvasNodes.chatNode.messages')}: {userMessageCount}
            </span>
            <span className="text-zinc-500 font-mono">
              {t('canvasNodes.chatNode.nextCreditIn')} {messagesUntilNextCredit} {messagesUntilNextCredit > 1 ? t('canvasNodes.chatNode.messagesPlural') : t('canvasNodes.chatNode.message')}
            </span>
          </div>
          <div className="h-1 bg-zinc-800/50 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#52ddeb] transition-all duration-300"
              style={{ width: `${((userMessageCount % 4) / 4) * 100}%` }}
            />
          </div>
        </div>

        {/* Context Preview */}
        {hasContext && (
          <div className="p-3 border-b border-zinc-700/50 bg-gradient-to-b from-zinc-900/50 to-zinc-900/30 space-y-3">
            {/* Header with context summary */}
            <div className="flex items-center justify-between pb-2 border-b border-zinc-700/30">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#52ddeb]" />
                <span className="text-xs font-semibold text-zinc-300 font-mono">{t('canvasNodes.chatNode.connectedContext')}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-zinc-500 font-mono">
                {connectedImages.length > 0 && (
                  <span className="px-1.5 py-0.5 bg-[#52ddeb]/20 text-[#52ddeb] rounded">
                    {connectedImages.length} {connectedImages.length === 1 ? t('canvasNodes.chatNode.image') : t('canvasNodes.chatNode.imagesPlural')}
                  </span>
                )}
                {connectedText && (
                  <span className="px-1.5 py-0.5 bg-[#52ddeb]/20 text-[#52ddeb] rounded">{t('canvasNodes.chatNode.textContext')}</span>
                )}
                {connectedStrategyData && (
                  <span className="px-1.5 py-0.5 bg-[#52ddeb]/20 text-[#52ddeb] rounded">
                    {strategySections.length} {strategySections.length === 1 ? t('canvasNodes.chatNode.section') : t('canvasNodes.chatNode.sections')}
                  </span>
                )}
              </div>
            </div>

            {/* Images Display */}
            {connectedImages.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <ImageIcon className="w-3.5 h-3.5 text-[#52ddeb]" />
                  <span className="text-xs font-semibold text-zinc-400 font-mono">
                    {t('canvasNodes.chatNode.images')} ({connectedImages.length})
                  </span>
                </div>
                <div className="bg-zinc-900/50 p-2 rounded border border-[#52ddeb]/20">
                  <ConnectedImagesDisplay
                    images={connectedImages}
                    label=""
                    maxThumbnails={4}
                    onImageRemove={handleImageRemove}
                    showLabel={false}
                  />
                </div>
              </div>
            )}

            {/* Text Context */}
            {connectedText && (
              <div className="space-y-2">
                <button
                  onClick={() => setExpandedText(!expandedText)}
                  className="flex items-center justify-between w-full group"
                >
                  <div className="flex items-center gap-2">
                    <FileText className="w-3.5 h-3.5 text-[#52ddeb]" />
                    <span className="text-xs font-semibold text-zinc-400 font-mono">{t('canvasNodes.chatNode.textContext')}</span>
                    <span className="text-xs text-zinc-600 font-mono">
                      ({connectedText.length} {t('canvasNodes.chatNode.chars')})
                    </span>
                  </div>
                  {expandedText ? (
                    <ChevronUp className="w-3.5 h-3.5 text-zinc-500 group-hover:text-zinc-400 transition-colors" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5 text-zinc-500 group-hover:text-zinc-400 transition-colors" />
                  )}
                </button>
                <div className={cn(
                  "text-xs text-zinc-300 bg-zinc-900/50 p-2.5 rounded border border-[#52ddeb]/20 overflow-y-auto transition-all",
                  expandedText ? "max-h-48" : "max-h-20"
                )}>
                  <div className="whitespace-pre-wrap break-words font-mono leading-relaxed">
                    {expandedText ? connectedText : (
                      <>
                        {connectedText.substring(0, 150)}
                        {connectedText.length > 150 && '...'}
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Strategy Data */}
            {connectedStrategyData && (
              <div className="space-y-2">
                <button
                  onClick={() => setExpandedStrategy(!expandedStrategy)}
                  className="flex items-center justify-between w-full group"
                >
                  <div className="flex items-center gap-2">
                    <Target className="w-3.5 h-3.5 text-[#52ddeb]" />
                    <span className="text-xs font-semibold text-zinc-400 font-mono">{t('canvasNodes.chatNode.strategyData')}</span>
                    <span className="text-xs text-zinc-600 font-mono">
                      ({strategySections.length} {strategySections.length === 1 ? t('canvasNodes.chatNode.section') : t('canvasNodes.chatNode.sections')})
                    </span>
                  </div>
                  {expandedStrategy ? (
                    <ChevronUp className="w-3.5 h-3.5 text-zinc-500 group-hover:text-zinc-400 transition-colors" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5 text-zinc-500 group-hover:text-zinc-400 transition-colors" />
                  )}
                </button>
                <div className={cn(
                  "bg-zinc-900/50 p-2.5 rounded border border-[#52ddeb]/20 transition-all",
                  expandedStrategy ? "max-h-64 overflow-y-auto" : "min-h-[40px]"
                )}>
                  {expandedStrategy ? (
                    <div className="space-y-3 text-xs">
                      {connectedStrategyData.persona && (
                        <div>
                          <div className="font-semibold text-[#52ddeb] mb-1 font-mono">👤 Persona</div>
                          <div className="text-zinc-400 space-y-1 pl-2">
                            {connectedStrategyData.persona.demographics && (
                              <div><span className="text-zinc-500">Demographics:</span> {connectedStrategyData.persona.demographics}</div>
                            )}
                            {connectedStrategyData.persona.desires && connectedStrategyData.persona.desires.length > 0 && (
                              <div><span className="text-zinc-500">Desires:</span> {connectedStrategyData.persona.desires.join(', ')}</div>
                            )}
                            {connectedStrategyData.persona.pains && connectedStrategyData.persona.pains.length > 0 && (
                              <div><span className="text-zinc-500">Pains:</span> {connectedStrategyData.persona.pains.join(', ')}</div>
                            )}
                          </div>
                        </div>
                      )}
                      {connectedStrategyData.archetypes && (
                        <div>
                          <div className="font-semibold text-[#52ddeb] mb-1 font-mono">🎭 Archetypes</div>
                          <div className="text-zinc-400 space-y-1 pl-2">
                            {connectedStrategyData.archetypes.primary && (
                              <div><span className="text-zinc-500">Primary:</span> {connectedStrategyData.archetypes.primary.title}</div>
                            )}
                            {connectedStrategyData.archetypes.secondary && (
                              <div><span className="text-zinc-500">Secondary:</span> {connectedStrategyData.archetypes.secondary.title}</div>
                            )}
                          </div>
                        </div>
                      )}
                      {connectedStrategyData.marketResearch && (
                        <div>
                          <div className="font-semibold text-[#52ddeb] mb-1 font-mono">📊 Market Research</div>
                          <div className="text-zinc-400 space-y-1 pl-2">
                            {connectedStrategyData.marketResearch.mercadoNicho && (
                              <div><span className="text-zinc-500">Niche:</span> {connectedStrategyData.marketResearch.mercadoNicho}</div>
                            )}
                            {connectedStrategyData.marketResearch.publicoAlvo && (
                              <div><span className="text-zinc-500">Target:</span> {connectedStrategyData.marketResearch.publicoAlvo}</div>
                            )}
                            {connectedStrategyData.marketResearch.posicionamento && (
                              <div><span className="text-zinc-500">Positioning:</span> {connectedStrategyData.marketResearch.posicionamento}</div>
                            )}
                          </div>
                        </div>
                      )}
                      {connectedStrategyData.competitors && connectedStrategyData.competitors.length > 0 && (
                        <div>
                          <div className="font-semibold text-[#52ddeb] mb-1 font-mono">🏢 Competitors</div>
                          <div className="text-zinc-400 pl-2">
                            {Array.isArray(connectedStrategyData.competitors) &&
                              connectedStrategyData.competitors.map((comp, idx) => (
                                <div key={idx}>
                                  {typeof comp === 'string' ? comp : comp.name}
                                </div>
                              ))
                            }
                          </div>
                        </div>
                      )}
                      {connectedStrategyData.swot && (
                        <div>
                          <div className="font-semibold text-[#52ddeb] mb-1 font-mono">⚖️ SWOT Analysis</div>
                          <div className="text-zinc-400 space-y-1 pl-2 text-[10px]">
                            {connectedStrategyData.swot.strengths && connectedStrategyData.swot.strengths.length > 0 && (
                              <div><span className="text-green-400">Strengths:</span> {connectedStrategyData.swot.strengths.join(', ')}</div>
                            )}
                            {connectedStrategyData.swot.weaknesses && connectedStrategyData.swot.weaknesses.length > 0 && (
                              <div><span className="text-red-400">Weaknesses:</span> {connectedStrategyData.swot.weaknesses.join(', ')}</div>
                            )}
                            {connectedStrategyData.swot.opportunities && connectedStrategyData.swot.opportunities.length > 0 && (
                              <div><span className="text-blue-400">Opportunities:</span> {connectedStrategyData.swot.opportunities.join(', ')}</div>
                            )}
                            {connectedStrategyData.swot.threats && connectedStrategyData.swot.threats.length > 0 && (
                              <div><span className="text-orange-400">Threats:</span> {connectedStrategyData.swot.threats.join(', ')}</div>
                            )}
                          </div>
                        </div>
                      )}
                      {connectedStrategyData.colorPalettes && connectedStrategyData.colorPalettes.length > 0 && (
                        <div>
                          <div className="font-semibold text-[#52ddeb] mb-1 font-mono">🎨 Color Palettes</div>
                          <div className="text-zinc-400 space-y-1 pl-2">
                            {connectedStrategyData.colorPalettes.map((palette, idx) => (
                              <div key={idx}>
                                <span className="text-zinc-500">{palette.name}:</span> {palette.colors.join(', ')}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {connectedStrategyData.visualElements && connectedStrategyData.visualElements.length > 0 && (
                        <div>
                          <div className="font-semibold text-[#52ddeb] mb-1 font-mono">🎨 Visual Elements</div>
                          <div className="text-zinc-400 pl-2">{connectedStrategyData.visualElements.join(', ')}</div>
                        </div>
                      )}
                      {connectedStrategyData.mockupIdeas && connectedStrategyData.mockupIdeas.length > 0 && (
                        <div>
                          <div className="font-semibold text-[#52ddeb] mb-1 font-mono">💡 Mockup Ideas</div>
                          <div className="text-zinc-400 pl-2">{connectedStrategyData.mockupIdeas.join(', ')}</div>
                        </div>
                      )}
                      {connectedStrategyData.moodboard && (
                        <div>
                          <div className="font-semibold text-[#52ddeb] mb-1 font-mono">🎨 Moodboard</div>
                          <div className="text-zinc-400 space-y-1 pl-2">
                            {connectedStrategyData.moodboard.summary && (
                              <div><span className="text-zinc-500">Summary:</span> {connectedStrategyData.moodboard.summary}</div>
                            )}
                            {connectedStrategyData.moodboard.visualDirection && (
                              <div><span className="text-zinc-500">Direction:</span> {connectedStrategyData.moodboard.visualDirection}</div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {strategySections.map((section, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 bg-[#52ddeb]/10 text-[#52ddeb] border border-[#52ddeb]/30 rounded text-[10px] font-mono"
                        >
                          {section}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Messages Area */}
        <div
          ref={messagesAreaRef}
          className="flex-1 p-4 overflow-y-auto space-y-4 min-h-0 scroll-smooth"
          onWheel={(e) => e.stopPropagation()}
        >
          {messages.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-8">
              {hasContext ? (
                <div className="space-y-2">
                  <p>{t('canvasNodes.chatNode.startConversationWithContext')}</p>
                  <p className="text-xs">{t('canvasNodes.chatNode.chatWillUseImagesAndTexts')}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <p>{t('canvasNodes.chatNode.startConversationWithAI')}</p>
                  <p className="text-xs">{t('canvasNodes.chatNode.connectImagesOrTexts')}</p>
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
                    "max-w-[85%] p-3",
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  )}
                >
                  <CardContent className="p-0">
                    <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                  </CardContent>
                </Card>
              </div>
            ))
          )}
          {isLoading && (
            <div className="flex justify-start">
              <Card className="bg-muted max-w-[85%] p-3">
                <CardContent className="p-0 flex items-center gap-2">
                  <Spinner size={16} color="currentColor" />
                  <span className="text-sm text-muted-foreground">{t('canvasNodes.chatNode.thinking')}</span>
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="p-3 border-t border-zinc-700/50">
          <div className="flex gap-2">
            <AutoResizeTextarea
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={hasContext ? t('canvasNodes.chatNode.askAboutContext') : t('canvasNodes.chatNode.typeYourMessage')}
              className="resize-none nodrag nopan"
              minHeight={60}
              maxHeight={200}
              disabled={isLoading}
            />
            <Button
              onClick={handleSend}
              disabled={!inputMessage.trim() || isLoading}
              size="icon"
              className="self-end shrink-0"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
          {hasContext && (
            <p className="text-xs text-muted-foreground mt-2">
              💡 {t('canvasNodes.chatNode.chatWillUse')} {connectedImages.length > 0 ? `${connectedImages.length} ${connectedImages.length === 1 ? t('canvasNodes.chatNode.image') : t('canvasNodes.chatNode.imagesPlural')}` : ''}
              {connectedImages.length > 0 && (connectedText || connectedStrategyData) ? ` ${t('canvasNodes.chatNode.and')} ` : ''}
              {(connectedText || connectedStrategyData) ? t('canvasNodes.chatNode.connectedContextAsReference') : ''}
            </p>
          )}
        </div>
      </div>

      {isSelected && !isDragging && (
        <NodeResizer
          color="#52ddeb"
          isVisible={isSelected}
          minWidth={500}
          minHeight={1200}
          maxWidth={2000}
          maxHeight={2000}
          onResize={(_, { width, height }) => {
            handleResize(width, height);
          }}
        />
      )}
    </NodeContainer>
  );
});

ChatNode.displayName = 'ChatNode';

