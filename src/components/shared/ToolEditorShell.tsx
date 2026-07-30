import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { AppShell, AppShellPanel } from '@/components/ui/AppShell';
import { AppShellMobileSheet } from '@/components/ui/AppShellMobileSheet';
import { DropOverlay } from '@/components/ui/DropOverlay';
import { ConfirmationModal } from '@/components/ConfirmationModal';
import { ToolEditorTopBar, type ToolEditorTopBarProps } from './ToolEditorTopBar';
import { ToolEditorStatusBar, type StatusItem } from './ToolEditorStatusBar';
import { CanvasErrorBoundary } from './CanvasErrorBoundary';
import { useIsMobile } from '@/hooks/use-media-query';
import { toast } from 'sonner';

export interface ToolEditorShellProps {
  title: string;
  documentTitle: string;
  backTo?: string;

  panelVisible: boolean;
  setPanelVisible: (v: boolean) => void;

  onReset: () => void;
  resetTitle?: string;
  resetMessage?: string;
  resetConfirmText?: string;

  undo?: ToolEditorTopBarProps['undo'];
  redo?: ToolEditorTopBarProps['redo'];

  extraTopBarLeft?: React.ReactNode;
  extraTopBarRight?: React.ReactNode;
  showLegalMenu?: boolean;

  controlsPanel: React.ReactNode;
  controlsPanelWidth?: number;
  mobileSheetLabel?: string;

  statusItems?: StatusItem[];
  fileName?: string;

  isDragOver?: boolean;
  dragProps?: Record<string, any>;
  dropMessage?: string;

  hideTopBar?: boolean;
  canvasClassName?: string;
  children: React.ReactNode;
}

export const ToolEditorShell: React.FC<ToolEditorShellProps> = ({
  title,
  documentTitle,
  backTo,
  panelVisible,
  setPanelVisible,
  onReset,
  resetTitle = 'Reset settings',
  resetMessage = 'All settings will return to defaults.',
  resetConfirmText = 'Reset',
  undo,
  redo,
  extraTopBarLeft,
  extraTopBarRight,
  showLegalMenu,
  controlsPanel,
  controlsPanelWidth = 300,
  mobileSheetLabel,
  statusItems,
  fileName,
  isDragOver = false,
  dragProps,
  dropMessage,
  hideTopBar = false,
  canvasClassName,
  children,
}) => {
  const isMobile = useIsMobile();
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    document.title = documentTitle;
  }, [documentTitle]);

  useHotkeys('r', () => setConfirmReset(true), { enableOnFormTags: false });

  const handleReset = useCallback(() => {
    onReset();
    setConfirmReset(false);
    toast.success('Settings reset');
  }, [onReset]);

  const canvasPadding = useMemo(
    () => ({
      paddingRight: !isMobile && panelVisible ? controlsPanelWidth + 16 : 0,
      paddingBottom: isMobile ? (mobileSheetOpen ? '45%' : 48) : 40,
    }),
    [isMobile, panelVisible, controlsPanelWidth, mobileSheetOpen]
  );

  // NOTE (motion): this padding is LAYOUT, not decoration — it reserves the strip
  // the controls panel / mobile sheet sits over, so the canvas content centers and
  // scrolls inside the remaining box. It cannot become a transform: a transform
  // would shift the painted content without resizing the box (breaking centering,
  // scroll extent and hit-testing) and would turn this element into the containing
  // block for any `position: fixed` descendant of the canvas.
  // What we can do is stop `transition-all` from sweeping every animatable property
  // into the same 300ms window — only padding actually changes here. Easing is left
  // at the Tailwind default on purpose: `AppShellPanel` (src/components/ui/AppShell.tsx)
  // slides with the same default curve, and the two must stay locked.
  const defaultCanvasClassName = hideTopBar
    ? 'absolute inset-0 transition-[padding] duration-[var(--dur-slow)]'
    : 'absolute inset-0 pt-10 transition-[padding] duration-[var(--dur-slow)]';

  return (
    <AppShell>
      {!hideTopBar && (
        <ToolEditorTopBar
          title={title}
          backTo={backTo}
          panelVisible={panelVisible}
          onTogglePanel={() => setPanelVisible(!panelVisible)}
          onReset={() => setConfirmReset(true)}
          isMobile={isMobile}
          undo={undo}
          redo={redo}
          extraLeft={extraTopBarLeft}
          extraRight={extraTopBarRight}
          showLegalMenu={showLegalMenu}
        />
      )}

      <div
        className={canvasClassName || defaultCanvasClassName}
        style={canvasPadding}
        {...dragProps}
      >
        <CanvasErrorBoundary>{children}</CanvasErrorBoundary>
        <DropOverlay visible={isDragOver} message={dropMessage || 'Drop file here'} />
      </div>

      {!isMobile && (
        <AppShellPanel side="right" visible={panelVisible} width={controlsPanelWidth}>
          {controlsPanel}
        </AppShellPanel>
      )}

      {isMobile && (
        <AppShellMobileSheet
          open={mobileSheetOpen}
          onToggle={() => setMobileSheetOpen(!mobileSheetOpen)}
          label={mobileSheetLabel || title}
        >
          {controlsPanel}
        </AppShellMobileSheet>
      )}

      {!isMobile && statusItems && statusItems.length > 0 && (
        <ToolEditorStatusBar items={statusItems} fileName={fileName} />
      )}

      <ConfirmationModal
        isOpen={confirmReset}
        onClose={() => setConfirmReset(false)}
        onConfirm={handleReset}
        title={resetTitle}
        message={resetMessage}
        confirmText={resetConfirmText}
        variant="warning"
      />
    </AppShell>
  );
};
