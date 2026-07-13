import { createContext, useContext } from 'react';

/**
 * Sinaliza que a árvore está sendo renderizada DENTRO do AppShell (rail + top
 * bar). Componentes de chrome de página (PageShell, BackButton, fundos
 * `fixed inset-0`) leem isto para se suprimir/conter e não dobrar o chrome nem
 * cobrir o rail. Fora do AppShell (marketing/focus) o valor é `false`.
 * Plano APP-SHELL-REALIGNMENT, P1.
 */
export const InAppShellContext = createContext(false);

export const useInAppShell = (): boolean => useContext(InAppShellContext);
