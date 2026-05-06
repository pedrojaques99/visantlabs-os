import React, { useRef, useEffect } from 'react';
import { usePluginStore } from '../../store';
import { useChatSend } from '../../hooks/useChatSend';
import { MessageList } from './MessageList';
import { ChatInput } from './ChatInput';
import { TypingIndicator } from './TypingIndicator';
import { Layers, Trash2, MessageSquare } from 'lucide-react';

export function ChatView() {
  const { chatHistory, selectionDetails, clearChatHistory } = usePluginStore();
  const { sendMessage } = useChatSend();
  const scrollRef = useRef<HTMLDivElement>(null);
  const isGenerating = usePluginStore(s => s.isGenerating);

  useEffect(() => {
    // Auto-scroll to bottom
    if (scrollRef.current) {
      setTimeout(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
      }, 50);
    }
  }, [chatHistory]);

  return (
    <div className="flex flex-col h-full bg-background">
      {chatHistory.length > 0 && (
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
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
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
          </>
        )}
      </div>
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
