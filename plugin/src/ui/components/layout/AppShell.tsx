import React from 'react';
import { usePluginStore } from '../../store';
import { Header } from './Header';
import { ChatView } from '../chat/ChatView';
import { SessionsView } from '../chat/SessionsView';
import { SettingsView } from '../settings/SettingsView';
import { ProfileTab } from '../settings/ProfileTab';
import { ToastProvider } from './ToastProvider';

/** Bottom-right drag handle that resizes the Figma plugin window. */
function ResizeHandle() {
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const startX = e.clientX;
    const startY = e.clientY;
    const startW = window.innerWidth;
    const startH = window.innerHeight;

    const onMove = (ev: PointerEvent) => {
      parent.postMessage(
        {
          pluginMessage: {
            type: 'RESIZE_WINDOW',
            width: startW + (ev.clientX - startX),
            height: startH + (ev.clientY - startY),
          },
        },
        '*'
      );
    };
    const onUp = (ev: PointerEvent) => {
      (e.target as HTMLElement).releasePointerCapture?.(ev.pointerId);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  return (
    <div
      onPointerDown={onPointerDown}
      title="Redimensionar"
      className="absolute bottom-0 right-0 z-50 w-4 h-4 cursor-nwse-resize text-muted-foreground/40 hover:text-muted-foreground transition-colors"
    >
      <svg viewBox="0 0 16 16" fill="none" className="w-full h-full">
        <path
          d="M15 6 L6 15 M15 11 L11 15"
          stroke="currentColor"
          strokeWidth="1.25"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}

/** Collapsed state: a single round Visant Copilot logo bubble that expands on click. */
function CollapsedBubble() {
  const setCollapsed = usePluginStore((s) => s.setCollapsed);
  const isGenerating = usePluginStore((s) => s.isGenerating);

  const expand = () => {
    setCollapsed(false);
    parent.postMessage({ pluginMessage: { type: 'EXPAND_WINDOW' } }, '*');
  };

  return (
    <div className="flex items-center justify-center w-full h-screen bg-background">
      <button
        onClick={expand}
        title="Expandir Visant Copilot"
        aria-label="Expandir Visant Copilot"
        className="relative w-12 h-12 rounded-full bg-neutral-900 border border-brand-cyan/40 flex items-center justify-center shadow-lg hover:border-brand-cyan hover:scale-105 transition-all focus:outline-none"
      >
        <span className="text-brand-cyan font-bold text-lg leading-none select-none">V</span>
        {isGenerating && (
          <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-brand-cyan animate-pulse ring-2 ring-background" />
        )}
      </button>
    </div>
  );
}

export function AppShell() {
  const { activeView, collapsed } = usePluginStore();

  if (collapsed) {
    return (
      <ToastProvider>
        <CollapsedBubble />
      </ToastProvider>
    );
  }

  return (
    <ToastProvider>
      <div className="relative flex flex-col h-screen bg-background text-foreground">
        <Header />
        <main className="flex-1 overflow-hidden overflow-y-auto">
          {activeView === 'main' && <ChatView />}
          {activeView === 'sessions' && <SessionsView />}
          {activeView === 'settings' && <SettingsView />}
          {activeView === 'profile' && (
            <div className="p-4">
              <ProfileTab />
            </div>
          )}
        </main>
        <ResizeHandle />
      </div>
    </ToastProvider>
  );
}
