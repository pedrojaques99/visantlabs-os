import React from 'react';
import { usePluginStore } from '../../store';
import { Header } from './Header';
import { ChatView } from '../chat/ChatView';
import { SettingsView } from '../settings/SettingsView';
import { ProfileTab } from '../settings/ProfileTab';
import { ToastProvider } from './ToastProvider';

export function AppShell() {
  const { activeView } = usePluginStore();

  return (
    <ToastProvider>
      <div className="flex flex-col h-screen bg-background text-foreground">
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
      </div>
    </ToastProvider>
  );
}
