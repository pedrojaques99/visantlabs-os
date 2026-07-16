import { createContext, useContext } from 'react';

/**
 * Slot de ações do AppTopBar. O `PageShell` (dentro do AppShell) esconde o
 * próprio header — redundante com o AppTopBar que já mostra o label da seção —
 * e teleporta suas `actions` (ex.: "+ Adicionar App") pra este slot via portal.
 * Mantém a página como dona das ações, sem duplicar título/descrição.
 * Plano APP-SHELL-REALIGNMENT (fim do header dobrado).
 */
interface ShellHeaderContextValue {
  actionsSlot: HTMLElement | null;
  setActionsSlot: (el: HTMLElement | null) => void;
}

export const ShellHeaderContext = createContext<ShellHeaderContextValue | null>(null);

export const useShellHeader = (): ShellHeaderContextValue | null => useContext(ShellHeaderContext);
