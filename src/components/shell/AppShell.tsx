/**
 * AppShell (plano APP-SHELL-REALIGNMENT, F1 + F5 mobile).
 * Compõe o rail lateral persistente + top bar contextual + área de conteúdo,
 * para as rotas de app em modo `full` (dashboards). No mobile o rail vira
 * drawer com backdrop (F5). Editores (modo `focus`) não usam este shell —
 * mantêm o próprio chrome full-bleed (F3).
 */
import React, { useEffect, useState } from 'react';
import { AppSidebar } from './AppSidebar';
import { AppTopBar } from './AppTopBar';
import { InAppShellContext } from './InAppShellContext';
import { ShellHeaderContext } from './ShellHeaderContext';
import { RailSlotContext } from './RailSlotContext';
import { GlobalCommandPalette } from './GlobalCommandPalette';

interface AppShellProps {
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({ children }) => {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  // Slot pras ações da página (PageShell teleporta pra cá — ver ShellHeaderContext).
  const [actionsSlot, setActionsSlot] = useState<HTMLElement | null>(null);
  // Slot da rail — a página injeta conteúdo abaixo da nav da seção (ver RailSlotContext).
  const [railSlot, setRailSlot] = useState<HTMLElement | null>(null);

  // a11y do drawer mobile (P4): Escape fecha e o scroll do body trava enquanto
  // aberto (evita o conteúdo rolar atrás do overlay).
  useEffect(() => {
    if (!mobileNavOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileNavOpen(false);
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [mobileNavOpen]);

  return (
    <InAppShellContext.Provider value={true}>
      <ShellHeaderContext.Provider value={{ actionsSlot, setActionsSlot }}>
        <RailSlotContext.Provider value={{ railSlot, setRailSlot }}>
          <div className="flex-1 min-h-0 flex">
            <AppSidebar />
            <div className="flex-1 min-w-0 flex flex-col">
              <AppTopBar onMenuClick={() => setMobileNavOpen(true)} />
              <main className="flex-1 min-h-0 overflow-auto relative">{children}</main>
            </div>

            {/* Cmd+K global — navegar/trocar marca de qualquer rota do shell */}
            <GlobalCommandPalette />

            {/* Drawer mobile — backdrop + rail deslizante (F5, a11y P4) */}
            {mobileNavOpen && (
              <div
                className="md:hidden fixed inset-0 z-50 flex"
                role="dialog"
                aria-modal="true"
                aria-label="Navigation"
              >
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
        </RailSlotContext.Provider>
      </ShellHeaderContext.Provider>
    </InAppShellContext.Provider>
  );
};
