import React from 'react';
import { usePluginStore } from '../../store';
import { Header } from './Header';
import { ChatView } from '../chat/ChatView';
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
        <path d="M15 6 L6 15 M15 11 L11 15" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
      </svg>
    </div>
  );
}

export function AppShell() {
  const { activeView } = usePluginStore();

  return (
    <ToastProvider>
      <div className="relative flex flex-col h-screen bg-background text-foreground">
        <Header />
        <main className="flex-1 overflow-hidden overflow-y-auto">
          {activeView === 'main' && <ChatView />}
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
