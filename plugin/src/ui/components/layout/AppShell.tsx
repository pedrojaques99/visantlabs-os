import React from 'react';
import { usePluginStore } from '../../store';
import { Header } from './Header';
import { ChatView } from '../chat/ChatView';
import { SettingsView } from '../settings/SettingsView';
import { ToastProvider } from './ToastProvider';

export function AppShell() {
  const { activeView } = usePluginStore();

  return (
    <ToastProvider>
      <div className="flex flex-col h-screen bg-background text-foreground">
        <Header />
        <main className="flex-1 overflow-hidden">
          {activeView === 'main' ? <ChatView /> : <SettingsView />}
        </main>
      </div>
    </ToastProvider>
  );
}
