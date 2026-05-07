import React from 'react';
import { usePluginStore } from '../../store';
import { useChatSend } from '../../hooks/useChatSend';
import { MessageList } from './MessageList';
import { ChatInput } from './ChatInput';
import { TypingIndicator } from './TypingIndicator';
import { Layers, Trash2, MessageSquare, Brain } from 'lucide-react';
import { useAutoScrollToBottom } from '@/hooks/chat/useAutoScrollToBottom';
import { getGuidelineLabel } from '../../lib/brandHydration';

export function ChatView() {
  const { chatHistory, selectionDetails, clearChatHistory, sessionContext } = usePluginStore();
  const brandGuideline = usePluginStore(s => s.brandGuideline);
  const { sendMessage } = useChatSend();
  const isGenerating = usePluginStore(s => s.isGenerating);
  const scrollAnchorRef = useAutoScrollToBottom([chatHistory, isGenerating]);

  const brandLogo = brandGuideline
    ? (brandGuideline.logos?.find((l: any) => l.variant === 'icon' || l.variant === 'primary') ?? brandGuideline.logos?.[0])?.url
      || (brandGuideline.logos?.[0] as any)?.thumbnailUrl
    : null;
  const brandName = brandGuideline ? getGuidelineLabel(brandGuideline) : null;

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Brand context bar */}
      {brandGuideline && (
        <div className="flex items-center gap-2 px-3 py-1.5 border-b border-white/5 bg-white/[0.02]">
          {brandLogo ? (
            <img src={brandLogo} alt="" className="w-5 h-5 rounded object-contain bg-white/5 p-0.5 shrink-0" />
          ) : (
            <div className="w-5 h-5 rounded bg-neutral-800 border border-white/5 flex items-center justify-center shrink-0">
              <span className="text-[10px] font-semibold text-neutral-300">{brandName?.[0]?.toUpperCase() || '?'}</span>
            </div>
          )}
          <span className="text-[10px] font-mono text-neutral-400 uppercase tracking-wider truncate">{brandName}</span>
          {chatHistory.length > 0 && (
            <button
              onClick={clearChatHistory}
              className="ml-auto flex items-center gap-1 text-[10px] font-mono text-muted-foreground hover:text-destructive transition-colors shrink-0"
            >
              <Trash2 size={10} />
              Clear
            </button>
          )}
        </div>
      )}

      {/* Clear button when no brand is linked */}
      {!brandGuideline && chatHistory.length > 0 && (
        <div className="flex justify-end px-3 pt-2">
          <button
            onClick={clearChatHistory}
            className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground hover:text-destructive transition-colors"
          >
            <Trash2 size={10} />
            Clear
          </button>
        </div>
      )}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {chatHistory.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center max-w-xs space-y-4">
              <div className="mx-auto w-10 h-10 rounded-xl bg-brand-cyan/10 border border-brand-cyan/20 flex items-center justify-center">
                <MessageSquare size={20} className="text-brand-cyan" />
              </div>
              <p className="text-sm text-muted-foreground">
                Descreva o que deseja criar e o Visant Copilot irá gerar designs no Figma.
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                {['Gerar mockup de cartão de visita', 'Criar post para Instagram', 'Design de embalagem', 'Banner para site'].map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => sendMessage(prompt)}
                    className="text-[11px] px-2.5 py-1.5 rounded-full border border-border bg-card hover:bg-muted hover:border-brand-cyan/30 text-muted-foreground hover:text-foreground transition-all"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <>
            <MessageList messages={chatHistory} />
            {isGenerating && <TypingIndicator />}
            <div ref={scrollAnchorRef} />
          </>
        )}
      </div>
      {sessionContext && sessionContext.messageCount > 0 && (() => {
        const pct = Math.min(100, Math.round((sessionContext.tokenEstimate / sessionContext.contextLimit) * 100));
        const isHigh = pct >= 80;
        const isMed = pct >= 50;
        return (
          <div className="px-3 py-1 border-t border-border/30 flex items-center gap-2">
            <Brain size={10} className={isHigh ? 'text-destructive' : 'text-muted-foreground'} />
            <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${isHigh ? 'bg-destructive' : isMed ? 'bg-amber-500' : 'bg-brand-cyan'}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className={`text-[9px] font-mono tabular-nums ${isHigh ? 'text-destructive' : 'text-muted-foreground'}`}>
              {pct}% · {sessionContext.messageCount} msg{sessionContext.messageCount !== 1 ? 's' : ''}
            </span>
            {isHigh && (
              <span className="text-[9px] font-mono text-destructive">Clear recommended</span>
            )}
          </div>
        );
      })()}
      <ChatInput onSend={sendMessage} />
      {selectionDetails.length > 0 && (
        <div className="px-3 py-1.5 border-t border-border/50 bg-muted/30 flex items-center gap-1.5 flex-wrap">
          <Layers size={10} className="text-muted-foreground shrink-0" />
          <span className="text-[10px] text-muted-foreground font-mono shrink-0">{selectionDetails.length} frame{selectionDetails.length > 1 ? 's' : ''}:</span>
          {selectionDetails.map((f) => (
            <span key={f.id} className="text-[10px] font-mono bg-background border border-border/60 rounded px-1 py-0.5 text-foreground/70 truncate max-w-[90px]" title={`${f.id} · ${f.name}`}>{f.name}</span>
          ))}
        </div>
      )}
    </div>
  );
}
