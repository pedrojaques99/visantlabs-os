import { useHotkeys } from 'react-hotkeys-hook';

export interface ToolEditorHotkeyConfig {
  onExport: () => void;
  panelVisible: boolean;
  setPanelVisible: (v: boolean) => void;
  undo?: () => void;
  redo?: () => void;
  zoom?: {
    current: number;
    set: (z: number) => void;
    resetPan: () => void;
  };
  extras?: Array<{
    keys: string;
    handler: (e: KeyboardEvent) => void;
    options?: { enableOnFormTags?: boolean };
  }>;
}

export function useToolEditorHotkeys(config: ToolEditorHotkeyConfig) {
  const opts = { enableOnFormTags: false as const };

  useHotkeys('mod+e', (e) => { e.preventDefault(); config.onExport(); }, opts);
  useHotkeys('tab', (e) => { e.preventDefault(); config.setPanelVisible(!config.panelVisible); }, opts);

  useHotkeys('mod+z', (e) => { if (config.undo) { e.preventDefault(); config.undo(); } }, { enableOnFormTags: !!config.undo });
  useHotkeys('mod+shift+z', (e) => { if (config.redo) { e.preventDefault(); config.redo(); } }, { enableOnFormTags: !!config.redo });

  useHotkeys('mod+=', (e) => { if (config.zoom) { e.preventDefault(); config.zoom.set(config.zoom.current * 1.2); } }, opts);
  useHotkeys('mod+-', (e) => { if (config.zoom) { e.preventDefault(); config.zoom.set(config.zoom.current / 1.2); } }, opts);
  useHotkeys('mod+0', (e) => { if (config.zoom) { e.preventDefault(); config.zoom.set(1); config.zoom.resetPan(); } }, opts);

  config.extras?.forEach(({ keys, handler, options }) => {
    useHotkeys(keys, handler, options || opts);
  });
}
