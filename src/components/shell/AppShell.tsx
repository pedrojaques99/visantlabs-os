/**
 * AppShell (plano APP-SHELL-REALIGNMENT, F1 + F5 mobile).
 * Compõe o rail lateral persistente + top bar contextual + área de conteúdo,
 * para as rotas de app em modo `full` (dashboards). No mobile o rail vira
 * drawer com backdrop (F5). Editores (modo `focus`) não usam este shell —
 * mantêm o próprio chrome full-bleed (F3).
 */
import React, { useState } from 'react';
import { AppSidebar } from './AppSidebar';
import { AppTopBar } from './AppTopBar';
import { InAppShellContext } from './InAppShellContext';

interface AppShellProps {
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({ children }) => {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <InAppShellContext.Provider value={true}>
      <div className="flex-1 min-h-0 flex">
        <AppSidebar />
        <div className="flex-1 min-w-0 flex flex-col">
          <AppTopBar onMenuClick={() => setMobileNavOpen(true)} />
          <main className="flex-1 min-h-0 overflow-auto relative">{children}</main>
        </div>

        {/* Drawer mobile — backdrop + rail deslizante (F5) */}
        {mobileNavOpen && (
          <div className="md:hidden fixed inset-0 z-50 flex">
            <div
              className="absolute inset-0 bg-black/50"
              onClick={() => setMobileNavOpen(false)}
              aria-hidden
            />
            <div className="relative z-10">
              <AppSidebar variant="mobile" onNavigate={() => setMobileNavOpen(false)} />
            </div>
          </div>
        )}
      </div>
    </InAppShellContext.Provider>
  );
};
