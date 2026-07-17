import React from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { usePluginStore } from '../../store';
import { useChatSend } from '../../hooks/useChatSend';
import { MessageList } from './MessageList';
import { ChatInput } from './ChatInput';
import { TypingIndicator } from './TypingIndicator';
import { Layers, Trash2, MessageSquare, Brain, ChevronDown, History } from 'lucide-react';
import { useAutoScrollToBottom } from '@/hooks/chat/useAutoScrollToBottom';
import { getGuidelineLabel } from '../../lib/brandHydration';

export function ChatView() {
  const { t } = useTranslation();
  const { chatHistory, selectionDetails, clearChatHistory, sessionContext } = usePluginStore();
  const brandGuideline = usePluginStore((s) => s.brandGuideline);
  const setActiveView = usePluginStore((s) => s.setActiveView);
  const { sendMessage } = useChatSend();
  const isGenerating = usePluginStore((s) => s.isGenerating);
  const scrollAnchorRef = useAutoScrollToBottom([chatHistory, isGenerating]);

  // Frame pills: show ~2 rows by default, collapse the rest behind a toggle
  const COLLAPSED_FRAMES_MAX = 46; // ≈ 2 rows of pills
  const EXPANDED_FRAMES_MAX = 132; // scrollable when expanded
  const [framesExpanded, setFramesExpanded] = React.useState(false);
  const framesRef = React.useRef<HTMLDivElement>(null);
  const [framesOverflow, setFramesOverflow] = React.useState(false);

  React.useLayoutEffect(() => {
    const el = framesRef.current;
    if (!el) return;
    // scrollHeight reflects full content regardless of the maxHeight clamp
    setFramesOverflow(el.scrollHeight > COLLAPSED_FRAMES_MAX + 2);
  }, [selectionDetails]);

  const brandLogo = brandGuideline
    ? (
        brandGuideline.logos?.find((l: any) => l.variant === 'icon' || l.variant === 'primary') ??
        brandGuideline.logos?.[0]
      )?.url || (brandGuideline.logos?.[0] as any)?.thumbnailUrl
    : null;
  const brandName = brandGuideline ? getGuidelineLabel(brandGuideline) : null;

  return (
    <div className="flex flex-col h-full min-h-0 bg-background">
      {/* One bar: which brand is answering, plus this chat's own controls. History lives here
          now — it's a chat concern, and the header no longer carries navigation. */}
      <div className="shrink-0 flex items-center gap-2 px-3 py-1.5 border-b border-border/50 bg-muted/30">
        {brandGuideline ? (
          <>
            {brandLogo ? (
              <img
                src={brandLogo}
                alt=""
                className="w-5 h-5 rounded object-contain bg-muted p-0.5 shrink-0"
              />
            ) : (
              <div className="w-5 h-5 rounded bg-muted border border-border/50 flex items-center justify-center shrink-0">
                <span className="text-[10px] font-semibold text-foreground/70">
                  {brandName?.[0]?.toUpperCase() || '?'}
                </span>
              </div>
            )}
            {/* A brand name is a proper noun, not a technical value — so it's sans, not mono. */}
            <span className="text-[11px] text-foreground/80 truncate">{brandName}</span>
          </>
        ) : (
          <button
            onClick={() => setActiveView('brand')}
            className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
          >
            {t('plugin.chat.noBrandPick')}
          </button>
        )}

        <div className="ml-auto flex items-center gap-1 shrink-0">
          <button
            onClick={() => setActiveView('sessions')}
            title={t('plugin.header.sessions')}
            aria-label={t('plugin.header.openSessions')}
            className="flex items-center justify-center h-6 w-6 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <History size={12} />
          </button>
          {chatHistory.length > 0 && (
            <button
              onClick={clearChatHistory}
              title={t('plugin.common.clear')}
              aria-label={t('plugin.common.clear')}
              className="flex items-center justify-center h-6 w-6 rounded text-muted-foreground hover:text-destructive hover:bg-muted transition-colors"
            >
              <Trash2 size={12} />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
        {chatHistory.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center max-w-xs space-y-4">
              <div className="mx-auto w-10 h-10 rounded-xl bg-brand-cyan/10 border border-brand-cyan/20 flex items-center justify-center">
                <MessageSquare size={20} className="text-brand-cyan" />
              </div>
              <p className="text-sm text-muted-foreground">
                {t('plugin.chat.emptyDescription')}
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                {[
                  t('plugin.chat.promptBusinessCard'),
                  t('plugin.chat.promptInstagram'),
                  t('plugin.chat.promptPackaging'),
                  t('plugin.chat.promptBanner'),
                ].map((prompt) => (
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
      {sessionContext &&
        sessionContext.messageCount > 0 &&
        (() => {
          const pct = Math.min(
            100,
            Math.round((sessionContext.tokenEstimate / sessionContext.contextLimit) * 100)
          );
          // "4 msgs · 0%" is not something a user can act on — the row only earns its space
          // once the context is close to degrading and clearing is the actual next step.
          if (pct < 80) return null;
          return (
            <div className="px-3 py-1 border-t border-border/30 flex items-center gap-2">
              <Brain size={10} className="text-destructive" />
              <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-destructive transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="text-[9px] font-mono tabular-nums text-destructive">
                {sessionContext.messageCount === 1 ? t('plugin.chat.contextUsageOne', { pct, count: sessionContext.messageCount }) : t('plugin.chat.contextUsageOther', { pct, count: sessionContext.messageCount })}
              </span>
              <span className="text-[9px] font-mono text-destructive">{t('plugin.chat.clearRecommended')}</span>
            </div>
          );
        })()}
      <ChatInput onSend={sendMessage} />
      {selectionDetails.length > 0 && (
        <div className="border-t border-border/50 bg-muted/30">
          <div className="flex items-center gap-1.5 px-3 pt-1.5 pb-1">
            <Layers size={10} className="text-muted-foreground shrink-0" />
            <span className="text-[10px] text-muted-foreground font-mono shrink-0">
              {selectionDetails.length === 1 ? t('plugin.common.frameCountOne', { count: selectionDetails.length }) : t('plugin.common.frameCountOther', { count: selectionDetails.length })}
            </span>
            {framesOverflow && (
              <button
                type="button"
                onClick={() => setFramesExpanded((v) => !v)}
                className="ml-auto flex items-center gap-0.5 text-[10px] font-mono text-muted-foreground hover:text-foreground transition-colors shrink-0"
              >
                {framesExpanded ? t('plugin.chat.collapse') : t('plugin.chat.seeAll')}
                <ChevronDown
                  size={10}
                  className={`transition-transform ${framesExpanded ? 'rotate-180' : ''}`}
                />
              </button>
            )}
          </div>
          <div
            ref={framesRef}
            className={`px-3 pb-1.5 flex flex-wrap gap-1.5 ${
              framesExpanded ? 'overflow-y-auto' : 'overflow-hidden'
            }`}
            style={{ maxHeight: framesExpanded ? EXPANDED_FRAMES_MAX : COLLAPSED_FRAMES_MAX }}
          >
            {selectionDetails.map((f) => (
              <span
                key={f.id}
                className="text-[10px] font-mono bg-background border border-border/60 rounded px-1 py-0.5 text-foreground/70 truncate max-w-[90px]"
                title={`${f.id} · ${f.name}`}
              >
                {f.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
