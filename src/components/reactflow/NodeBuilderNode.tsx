import React, { useState, useRef, useEffect, memo, useCallback } from 'react';
import { useAutoScrollToBottom } from '@/hooks/chat/useAutoScrollToBottom';
import { type NodeProps } from '@xyflow/react';
import {
  Blocks,
  Diamond,
  CheckCircle2,
  RotateCcw,
  Send,
  Grid3x3,
  GitBranch,
  Zap,
  MessageSquare,
  Plus,
  ChevronRight,
  Brain,
  Cpu,
  Layers,
} from '@/lib/ui/icons';

// Rótulos em canvasNodes.nodeBuilderNode.steps.<key>
const PROCESSING_STEPS = [
  { icon: Brain, key: 'intent' },
  { icon: Cpu, key: 'logic' },
  { icon: Layers, key: 'schema' },
  { icon: Zap, key: 'node' },
];
import { NodeContainer } from './shared/NodeContainer';
import { NodeButton } from './shared/node-button';
import { GlitchLoader } from '@/components/ui/GlitchLoader';
import type { NodeBuilderData } from '@/types/reactFlow';
import type { CustomNodeDefinition } from '@/types/customNode';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/hooks/useTranslation';

// Nome e exemplos em canvasNodes.nodeBuilderNode.categories.<id>.{name,hint0..2}
const CATEGORIES = [
  { id: 'gen', icon: Diamond },
  { id: 'trans', icon: Diamond },
  { id: 'matrix', icon: Grid3x3 },
  { id: 'pipe', icon: GitBranch },
];
const HINT_INDEXES = [0, 1, 2];

export const NodeBuilderNode = memo(({ data, selected, id, dragging }: NodeProps<any>) => {
  const nodeData = data as NodeBuilderData;
  const { t } = useTranslation();
  const [input, setInput] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isLoading = nodeData.isLoading ?? false;
  const messages = nodeData.messages ?? [];
  const pendingDefinition = nodeData.pendingDefinition;
  const [processingStep, setProcessingStep] = useState(0);

  const messagesEndRef = useAutoScrollToBottom<HTMLDivElement>([messages.length, isLoading]);

  useEffect(() => {
    if (!isLoading) {
      setProcessingStep(0);
      return;
    }
    const id = setInterval(() => setProcessingStep((s) => (s + 1) % PROCESSING_STEPS.length), 1200);
    return () => clearInterval(id);
  }, [isLoading]);

  const handleSend = useCallback(async () => {
    const trimmedInput = input.trim();
    if (!trimmedInput || isLoading || !!pendingDefinition || !nodeData.onSendMessage) return;

    setInput('');
    // Auto-reset height
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    await nodeData.onSendMessage(id, trimmedInput);
  }, [input, isLoading, pendingDefinition, id, nodeData]);

  const stepLabel = (i: number) =>
    t(`canvasNodes.nodeBuilderNode.steps.${PROCESSING_STEPS[i].key}`);
  const categoryName = (catId: string) => t(`canvasNodes.nodeBuilderNode.categories.${catId}.name`);
  const categoryHint = (catId: string, i: number) =>
    t(`canvasNodes.nodeBuilderNode.categories.${catId}.hint${i}`);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSpawn = useCallback(() => {
    if (pendingDefinition && nodeData.onSpawnCustomNode) {
      nodeData.onSpawnCustomNode(id, pendingDefinition);
    }
  }, [id, pendingDefinition, nodeData]);

  const handleReset = useCallback(() => {
    nodeData.onUpdateData?.(id, { messages: [], pendingDefinition: undefined });
    setActiveCategory(null);
  }, [id, nodeData]);

  const adjustTextareaHeight = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const target = e.target;
    target.style.height = 'auto';
    target.style.height = `${Math.min(target.scrollHeight, 120)}px`;
    setInput(target.value);
  };

  return (
    <NodeContainer
      selected={selected}
      dragging={dragging}
      className="min-w-[400px] max-w-[440px] !bg-neutral-950/90 border-neutral-800"
    >
      {/* Header */}
      <div className="flex items-center justify-between node-margin-lg border-b border-neutral-800 pb-3">
        <div className="flex items-center gap-3">
          <div className="p-1.5 rounded-xl bg-muted ring-1 ring-ring">
            <Blocks size={18} className="text-muted-foreground" />
          </div>
          <div>
            <h3 className="text-sm font-semibold node-text-primary tracking-tight">
              {t('canvasNodes.nodeBuilderNode.title')}
            </h3>
            <p className="text-2xs text-neutral-500">
              {isLoading ? stepLabel(processingStep) : t('canvasNodes.nodeBuilderNode.ready')}
            </p>
          </div>
        </div>
        {messages.length > 0 && (
          <NodeButton
            variant="ghost"
            size="xs"
            onClick={handleReset}
            aria-label={t('common.reset')}
            className="nodrag nopan opacity-40 hover:opacity-100 focus-visible:opacity-100 shrink-0 hover:bg-neutral-900"
          >
            <RotateCcw size={13} />
          </NodeButton>
        )}
      </div>

      {/* Main Content Area */}
      <div className="min-h-[120px] flex flex-col justify-end">
        {isLoading && messages.length === 0 ? (
          <div className="node-margin py-4 space-y-4 animate-in fade-in duration-300">
            <div className="flex flex-col gap-2">
              {PROCESSING_STEPS.map((step, i) => {
                const StepIcon = step.icon;
                const isActive = i === processingStep;
                const isPast = i < processingStep;
                return (
                  <div
                    key={i}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2 rounded-md border-node transition-[color,background-color,border-color,box-shadow,opacity] duration-500',
                      isActive
                        ? 'bg-muted border-neutral-700'
                        : isPast
                          ? 'bg-neutral-900/30 border-neutral-800 opacity-40'
                          : 'bg-transparent border-transparent opacity-20'
                    )}
                  >
                    <StepIcon
                      size={13}
                      className={cn(
                        'shrink-0 transition-colors duration-300',
                        isActive
                          ? 'text-foreground'
                          : isPast
                            ? 'text-neutral-500'
                            : 'text-neutral-700'
                      )}
                    />
                    <span
                      className={cn(
                        'text-2xs transition-colors duration-300',
                        isActive
                          ? 'text-foreground'
                          : isPast
                            ? 'text-neutral-500'
                            : 'text-neutral-700'
                      )}
                    >
                      {stepLabel(i)}
                    </span>
                    {isActive && (
                      <span className="ml-auto">
                        <GlitchLoader size={11} />
                      </span>
                    )}
                    {isPast && <CheckCircle2 size={11} className="ml-auto text-neutral-600" />}
                  </div>
                );
              })}
            </div>
          </div>
        ) : messages.length === 0 && !pendingDefinition ? (
          <div className="node-margin space-y-4 py-2">
            {!activeCategory ? (
              <>
                <p className="text-2xs text-neutral-400 px-1">
                  {t('canvasNodes.nodeBuilderNode.chooseCategory')}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setActiveCategory(cat.id)}
                      className="nodrag nopan flex items-center gap-3 p-2.5 rounded-md bg-neutral-900/50 border-node border-neutral-800 hover:border-neutral-700 hover:bg-neutral-900 transition-colors group text-left"
                    >
                      <div className="p-2 rounded-xl bg-muted group-hover:bg-accent transition-colors">
                        <cat.icon size={16} className="text-neutral-400" />
                      </div>
                      <span className="text-2xs font-medium text-neutral-300">
                        {categoryName(cat.id)}
                      </span>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <div className="space-y-3 animate-in fade-in slide-in-from-left-2 duration-300">
                <div className="flex items-center justify-between px-1">
                  <p className="text-2xs font-medium text-neutral-300">
                    {categoryName(activeCategory)}
                  </p>
                  <button
                    onClick={() => setActiveCategory(null)}
                    className="nodrag nopan text-2xs text-neutral-500 hover:text-neutral-300"
                  >
                    {t('common.back')}
                  </button>
                </div>
                <div className="space-y-1.5">
                  {HINT_INDEXES.map((i) => categoryHint(activeCategory, i)).map((hint, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setInput(hint);
                        textareaRef.current?.focus();
                      }}
                      className="nodrag nopan w-full flex items-center justify-between p-2 rounded-md bg-neutral-900/30 border-node border-neutral-800 hover:border-neutral-700 hover:bg-neutral-900 transition-colors group"
                    >
                      <span className="text-2xs text-neutral-400 group-hover:text-foreground transition-colors truncate">
                        {hint}
                      </span>
                      <Plus
                        size={10}
                        className="text-neutral-600 group-hover:text-foreground shrink-0"
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="node-margin max-h-[300px] overflow-y-auto space-y-3 pr-1 scrollbar-thin">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={cn(
                  'flex flex-col gap-1',
                  msg.role === 'user' ? 'items-end ml-8' : 'items-start mr-8'
                )}
              >
                <div
                  className={cn(
                    'rounded-xl px-3 py-2 text-2xs leading-relaxed border-node',
                    msg.role === 'user'
                      ? 'bg-neutral-900 border-neutral-800 text-neutral-200 rounded-tr-none'
                      : 'bg-neutral-800/50 border-neutral-800 text-neutral-200 rounded-tl-none'
                  )}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex items-center gap-3 px-3 py-2 bg-neutral-800/50 border-node border-neutral-800 rounded-xl rounded-tl-none mr-8">
                <GlitchLoader size={14} />
                <span className="text-muted-foreground text-2xs">{stepLabel(processingStep)}</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Result / Success Area */}
      {pendingDefinition && !isLoading && (
        <div className="node-margin pt-2 animate-in zoom-in-95 duration-300">
          <div
            className={cn(
              'flex flex-col gap-3 p-4 rounded-xl border-node bg-neutral-900/50 border-neutral-700'
            )}
          >
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-md bg-muted border-node border-neutral-800">
                <Zap size={20} className="text-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground tracking-tight">
                  {pendingDefinition.name}
                </p>
                <p className="text-2xs text-muted-foreground leading-tight mt-0.5">
                  {pendingDefinition.description}
                </p>
              </div>
            </div>

            <div className="pt-2 border-t border-neutral-800">
              <button
                onClick={handleSpawn}
                className="nodrag nopan w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-md bg-brand-cyan hover:bg-brand-cyan/90 text-black font-medium text-xs transition-colors"
              >
                <Plus size={14} strokeWidth={3} />
                {t('canvasNodes.nodeBuilderNode.deploy')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="node-margin mt-auto">
        <div
          className={cn(
            'relative flex items-end gap-2 p-2 rounded-xl border-node bg-background/80 transition-[color,background-color,border-color,box-shadow,opacity] duration-300',
            isLoading || !!pendingDefinition
              ? 'opacity-50 pointer-events-none'
              : 'hover:border-neutral-700',
            selected ? 'border-neutral-600' : 'border-border'
          )}
        >
          <textarea
            ref={textareaRef}
            value={input}
            onChange={adjustTextareaHeight}
            onKeyDown={handleKeyDown}
            disabled={isLoading || !!pendingDefinition}
            placeholder={
              pendingDefinition
                ? t('canvasNodes.nodeBuilderNode.blueprintReady')
                : t('canvasNodes.nodeBuilderNode.placeholder')
            }
            rows={1}
            className="nodrag nopan flex-1 resize-none bg-transparent px-2 py-1.5 text-2xs text-neutral-200 placeholder:text-neutral-600 focus:outline-none min-h-[32px] max-h-[120px]"
          />
          <NodeButton
            variant="primary"
            size="sm"
            onClick={handleSend}
            disabled={isLoading || !input.trim() || !!pendingDefinition}
            aria-label={t('canvasNodes.nodeBuilderNode.send')}
            className="nodrag nopan rounded-md p-2 h-9 w-9 bg-brand-cyan hover:bg-brand-cyan/90 disabled:bg-neutral-800 disabled:text-neutral-600"
          >
            <Send size={16} />
          </NodeButton>
        </div>
      </div>
    </NodeContainer>
  );
});

NodeBuilderNode.displayName = 'NodeBuilderNode';
