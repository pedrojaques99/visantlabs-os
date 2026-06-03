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

const noop = () => {};

export function useToolEditorHotkeys(config: ToolEditorHotkeyConfig) {
  const opts = { enableOnFormTags: false as const };

  useHotkeys(
    'mod+e',
    (e) => {
      e.preventDefault();
      config.onExport();
    },
    opts
  );
  useHotkeys(
    'tab',
    (e) => {
      e.preventDefault();
      config.setPanelVisible(!config.panelVisible);
    },
    opts
  );

  useHotkeys(
    'mod+z',
    (e) => {
      if (config.undo) {
        e.preventDefault();
        config.undo();
      }
    },
    { enableOnFormTags: !!config.undo }
  );
  useHotkeys(
    'mod+shift+z',
    (e) => {
      if (config.redo) {
        e.preventDefault();
        config.redo();
      }
    },
    { enableOnFormTags: !!config.redo }
  );

  useHotkeys(
    'mod+=',
    (e) => {
      if (config.zoom) {
        e.preventDefault();
        config.zoom.set(config.zoom.current * 1.2);
      }
    },
    opts
  );
  useHotkeys(
    'mod+-',
    (e) => {
      if (config.zoom) {
        e.preventDefault();
        config.zoom.set(config.zoom.current / 1.2);
      }
    },
    opts
  );
  useHotkeys(
    'mod+0',
    (e) => {
      if (config.zoom) {
        e.preventDefault();
        config.zoom.set(1);
        config.zoom.resetPan();
      }
    },
    opts
  );

  const e0 = config.extras?.[0];
  const e1 = config.extras?.[1];
  const e2 = config.extras?.[2];
  useHotkeys(e0?.keys ?? 'F19', e0?.handler ?? noop, e0?.options ?? opts, { enabled: !!e0 });
  useHotkeys(e1?.keys ?? 'F19', e1?.handler ?? noop, e1?.options ?? opts, { enabled: !!e1 });
  useHotkeys(e2?.keys ?? 'F19', e2?.handler ?? noop, e2?.options ?? opts, { enabled: !!e2 });
}
