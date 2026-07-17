import { createContext, useContext } from 'react';

/**
 * RailSlotContext — a page→rail injection seam, mirroring ShellHeaderContext.
 *
 * The drill-in rail (AppSidebar) exposes a DOM slot below its section nav; a
 * page portals content into it (e.g. /references injects its tag chips under the
 * category items). Ref-based portal host, same pattern as the top-bar actions
 * slot — no node-in-context re-render coupling.
 */
export interface RailSlotContextValue {
  railSlot: HTMLElement | null;
  setRailSlot: (el: HTMLElement | null) => void;
}

export const RailSlotContext = createContext<RailSlotContextValue | null>(null);

export const useRailSlot = (): RailSlotContextValue | null => useContext(RailSlotContext);
