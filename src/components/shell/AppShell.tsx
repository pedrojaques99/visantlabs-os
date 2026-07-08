/**
 * AppShell (plano APP-SHELL-REALIGNMENT, F1).
 * Compõe o rail lateral persistente + top bar contextual + área de conteúdo,
 * para as rotas de app em modo `full` (dashboards). Editores (modo `focus`)
 * não usam este shell — mantêm o próprio chrome full-bleed (F3).
 */
import React from 'react';
import { AppSidebar } from './AppSidebar';
import { AppTopBar } from './AppTopBar';

interface AppShellProps {
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({ children }) => {
  return (
    <div className="flex-1 min-h-0 flex">
      <AppSidebar />
      <div className="flex-1 min-w-0 flex flex-col">
        <AppTopBar />
        <main className="flex-1 min-h-0 overflow-auto relative">{children}</main>
      </div>
    </div>
  );
};
