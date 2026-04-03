import React, { useState, useRef, useEffect, memo, useCallback } from 'react';
import { type NodeProps } from '@xyflow/react';
import {
  Blocks, Sparkles, CheckCircle2, RotateCcw, Send,
  Wand2, Grid3x3, GitBranch, Zap, MessageSquare, Plus,
  ChevronRight, Brain, Cpu, Layers
} from 'lucide-react';

const PROCESSING_STEPS = [
  { icon: Brain, label: 'ANALYZING INTENT...' },
  { icon: Cpu, label: 'REASONING LOGIC...' },
  { icon: Layers, label: 'BUILDING SCHEMA...' },
  { icon: Zap, label: 'GENERATING NODE...' },
];
import { NodeContainer } from './shared/NodeContainer';
import { NodeButton } from './shared/node-button';
import { GlitchLoader } from '@/components/ui/GlitchLoader';
import type { NodeBuilderData } from '@/types/reactFlow';
import type { CustomNodeDefinition } from '@/types/customNode';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/hooks/useTranslation';

const CATEGORIES = [
  { 
    id: 'gen', 
    name: 'Generation', 
    icon: Sparkles, 
    color: 'var(--brand-cyan)',
    hints: [
      'Create 4 unique product concepts',
      'Generate a realistic logo variation',
      'Expand prompt into 4 artistic styles'
    ]
  },
  { 
    id: 'trans', 
    name: 'Transform', 
    icon: Wand2, 
    color: '#a855f7',
    hints: [
      'Apply a futuristic VHS glitch',
      'Convert to 8-bit dithered art',
      'Upscale to 4K with sharpening'
    ]
  },
  { 
    id: 'matrix', 
    name: 'Matrix', 
    icon: Grid3x3, 
    color: '#f97316',
    hints: [
      'Compare 4 different AI models',
      'Generate 3 camera angles',
      'Create 4 mockup placements'
    ]
  },
  { 
    id: 'pipe', 
    name: 'Pipeline', 
    icon: GitBranch, 
    color: '#22c55e',
    hints: [
      'Generate → Analyze → Refine loop',
      'Custom 3-step image pipeline',
      'Auto-branch based on brightness'
    ]
  },
];

export const NodeBuilderNode = memo(({ data, selected, id, dragging }: NodeProps<any>) => {
  const nodeData = data as NodeBuilderData;
  const { t } = useTranslation();
  const [input, setInput] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  const isLoading = nodeData.isLoading ?? false;
  const messages = nodeData.messages ?? [];
  const pendingDefinition = nodeData.pendingDefinition;
  const [processingStep, setProcessingStep] = useState(0);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, isLoading]);

  useEffect(() => {
    if (!isLoading) { setProcessingStep(0); return; }
    const id = setInterval(() => setProcessingStep(s => (s + 1) % PROCESSING_STEPS.length), 1200);
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
    <NodeContainer selected={selected} dragging={dragging} className="min-w-[400px] max-w-[440px] !bg-neutral-950/90 border-brand-cyan/20">
      {/* Header */}
      <div className="flex items-center justify-between node-margin-lg border-b border-white/5 pb-3">
        <div className="flex items-center gap-3">
          <div className="p-1.5 rounded-lg bg-brand-cyan/10 ring-1 ring-brand-cyan/20">
            <Blocks size={18} className="text-brand-cyan" />
          </div>
          <div>
            <h3 className="text-[12px] font-bold node-text-primary font-mono tracking-wider">NODE ARCHITECT</h3>
            <p className="text-[9px] text-neutral-500 font-mono flex items-center gap-1">
              {isLoading ? PROCESSING_STEPS[processingStep].label : 'READY TO CONSTRUCT'}
              {isLoading && <span className="w-1 h-1 bg-brand-cyan rounded-full animate-pulse" />}
            </p>
          </div>
        </div>
        {messages.length > 0 && (
          <NodeButton
            variant="ghost"
            size="xs"
            onClick={handleReset}
            className="nodrag nopan opacity-40 hover:opacity-100 shrink-0 hover:bg-neutral-900"
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
                      'flex items-center gap-3 px-3 py-2 rounded-xl border transition-all duration-500',
                      isActive
                        ? 'bg-brand-cyan/10 border-brand-cyan/30 shadow-[0_0_12px_rgba(0,195,255,0.08)]'
                        : isPast
                        ? 'bg-neutral-900/30 border-white/5 opacity-40'
                        : 'bg-transparent border-transparent opacity-20'
                    )}
                  >
                    <StepIcon
                      size={13}
                      className={cn(
                        'shrink-0 transition-colors duration-300',
                        isActive ? 'text-brand-cyan' : isPast ? 'text-neutral-500' : 'text-neutral-700'
                      )}
                    />
                    <span
                      className={cn(
                        'text-[10px] font-mono tracking-widest transition-colors duration-300',
                        isActive ? 'text-brand-cyan' : isPast ? 'text-neutral-500' : 'text-neutral-700'
                      )}
                    >
                      {step.label}
                    </span>
                    {isActive && (
                      <span className="ml-auto flex gap-0.5">
                        {[0, 1, 2].map(d => (
                          <span
                            key={d}
                            className="w-1 h-1 rounded-full bg-brand-cyan animate-bounce"
                            style={{ animationDelay: `${d * 150}ms` }}
                          />
                        ))}
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
                <p className="text-[11px] font-mono text-neutral-400 px-1">
                  Choose a logic blueprint to begin:
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setActiveCategory(cat.id)}
                      className="nodrag nopan flex items-center gap-3 p-2.5 rounded-xl bg-neutral-900/50 border border-white/5 hover:border-white/10 hover:bg-neutral-900 transition-all group text-left"
                    >
                      <div className="p-2 rounded-lg bg-white/5 group-hover:bg-white/10 transition-colors">
                        <cat.icon size={16} style={{ color: cat.color }} />
                      </div>
                      <span className="text-[11px] font-medium text-neutral-300 font-mono tracking-tight">{cat.name}</span>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <div className="space-y-3 animate-in fade-in slide-in-from-left-2 duration-300">
                <div className="flex items-center justify-between px-1">
                  <p className="text-[11px] font-mono font-bold uppercase tracking-widest" style={{ color: CATEGORIES.find(c => c.id === activeCategory)?.color }}>
                    {CATEGORIES.find(c => c.id === activeCategory)?.name} Presets
                  </p>
                  <button 
                    onClick={() => setActiveCategory(null)}
                    className="nodrag nopan text-[9px] font-mono text-neutral-500 hover:text-neutral-300"
                  >
                    Back
                  </button>
                </div>
                <div className="space-y-1.5">
                  {CATEGORIES.find(c => c.id === activeCategory)?.hints.map((hint, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setInput(hint);
                        textareaRef.current?.focus();
                      }}
                      className="nodrag nopan w-full flex items-center justify-between p-2 rounded-lg bg-neutral-900/30 border border-white/5 hover:border-brand-cyan/30 hover:bg-neutral-900 transition-all group group"
                    >
                      <span className="text-[10px] font-mono text-neutral-400 group-hover:text-brand-cyan transition-colors truncate">"{hint}"</span>
                      <Plus size={10} className="text-neutral-600 group-hover:text-brand-cyan shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="node-margin max-h-[300px] overflow-y-auto space-y-3 pr-1 scrollbar-thin">
            {messages.map((msg, i) => (
              <div key={i} className={cn(
                'flex flex-col gap-1',
                msg.role === 'user' ? 'items-end ml-8' : 'items-start mr-8'
              )}>
                <div className={cn(
                  'rounded-2xl px-3 py-2 text-[11px] font-mono leading-relaxed border shadow-sm',
                  msg.role === 'user'
                    ? 'bg-neutral-900 border-white/5 text-neutral-200 rounded-tr-none'
                    : 'bg-brand-cyan/5 border-brand-cyan/20 text-brand-cyan/90 rounded-tl-none'
                )}>
                  {msg.content}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex items-center gap-3 px-3 py-2 bg-brand-cyan/5 border border-brand-cyan/20 rounded-2xl rounded-tl-none mr-8">
                <GlitchLoader size={14} color="var(--brand-cyan)" />
                <span className="text-brand-cyan/70 text-[10px] font-mono uppercase tracking-widest font-bold">
                  {PROCESSING_STEPS[processingStep].label}
                </span>
                <span className="ml-auto flex gap-0.5">
                  {[0, 1, 2].map(d => (
                    <span key={d} className="w-1 h-1 rounded-full bg-brand-cyan/50 animate-bounce" style={{ animationDelay: `${d * 150}ms` }} />
                  ))}
                </span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Result / Success Area */}
      {pendingDefinition && !isLoading && (
        <div className="node-margin pt-2 animate-in zoom-in-95 duration-300">
          <div className={cn(
            'flex flex-col gap-3 p-4 rounded-2xl border bg-brand-cyan/[0.03] border-brand-cyan/30 shadow-[0_0_20px_rgba(0,195,255,0.05)]'
          )}>
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-brand-cyan/10 border border-brand-cyan/20">
                <Zap size={20} className="text-brand-cyan" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-bold text-brand-cyan font-mono uppercase tracking-tight">{pendingDefinition.name}</p>
                <p className="text-[10px] text-brand-cyan/60 font-mono leading-tight mt-0.5">{pendingDefinition.description}</p>
              </div>
            </div>
            
            <div className="pt-2 border-t border-brand-cyan/10">
              <button
                onClick={handleSpawn}
                className="nodrag nopan w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-brand-cyan text-black font-bold text-[11px] uppercase tracking-widest hover:scale-[1.02] active:scale-[0.98] transition-all shadow-[0_0_15px_rgba(0,195,255,0.3)]"
              >
                <Plus size={14} strokeWidth={3} />
                Deploy Node to Canvas
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="node-margin mt-auto">
        <div className={cn(
          "relative flex items-end gap-2 p-2 rounded-2xl border bg-black/40 transition-all duration-300",
          isLoading || !!pendingDefinition ? "opacity-50 pointer-events-none" : "hover:border-brand-cyan/40",
          selected ? "border-brand-cyan/40 shadow-[0_0_15px_rgba(0,195,255,0.05)]" : "border-white/10"
        )}>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={adjustTextareaHeight}
            onKeyDown={handleKeyDown}
            disabled={isLoading || !!pendingDefinition}
            placeholder={pendingDefinition ? 'Blueprint ready' : 'Describe the logic...'}
            rows={1}
            className="nodrag nopan flex-1 resize-none bg-transparent px-2 py-1.5 text-[11px] font-mono text-neutral-200 placeholder:text-neutral-600 focus:outline-none min-h-[32px] max-h-[120px]"
          />
          <NodeButton
            variant="primary"
            size="sm"
            onClick={handleSend}
            disabled={isLoading || !input.trim() || !!pendingDefinition}
            className="nodrag nopan rounded-xl p-2 h-9 w-9 bg-brand-cyan hover:bg-brand-cyan/90 disabled:bg-neutral-800 disabled:text-neutral-600"
          >
            <Send size={16} />
          </NodeButton>
        </div>
        <p className="text-[8px] font-mono text-neutral-600 mt-2 text-center uppercase tracking-tighter opacity-50">
          Enter to send • Shift+Enter for newline
        </p>
      </div>
    </NodeContainer>
  );
});

NodeBuilderNode.displayName = 'NodeBuilderNode';
