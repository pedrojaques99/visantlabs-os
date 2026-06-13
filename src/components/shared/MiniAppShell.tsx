import React, { useState, useEffect, useMemo } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import {
  ChevronLeft,
  PanelRightOpen,
  PanelRightClose,
  RotateCcw,
  type LucideIcon,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/Tooltip';
import { MicroTitle } from '@/components/ui/MicroTitle';
import {
  AppShell,
  AppShellTopBar,
  AppShellPanel,
  AppShellStatusBar,
} from '@/components/ui/AppShell';
import { AppShellMobileSheet } from '@/components/ui/AppShellMobileSheet';
import { DropOverlay } from '@/components/ui/DropOverlay';
import { useIsMobile } from '@/hooks/use-media-query';

export interface MiniAppShellDragDrop {
  onDrop: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  isDragOver: boolean;
}

export interface MiniAppShellProps {
  title: string;
  icon?: LucideIcon;
  documentTitle?: string;
  backTo?: string;

  /** Controls rendered in the floating right panel (desktop) / bottom sheet (mobile). */
  panel?: React.ReactNode;
  panelWidth?: number;
  panelLabel?: string;
  defaultPanelVisible?: boolean;

  /** Content of the floating bottom status/action pill. */
  statusBar?: React.ReactNode;
  onReset?: () => void;

  dragDrop?: MiniAppShellDragDrop;
  dropMessage?: string;

  /** Center the canvas children vertically + horizontally. Default true. */
  centerContent?: boolean;
  className?: string;
  canvasClassName?: string;
  children: React.ReactNode;
}

/**
 * App-like shell for mini-tools — fullscreen canvas + floating control panel +
 * floating status pill. Thin wrapper over the AppShell primitives (no new
 * low-level components). Lighter than ToolEditorShell: no undo/redo, no canvas
 * error boundary, no legal menu. See .agent/plans/MINI-APP-SHELL.md.
 */
export const MiniAppShell: React.FC<MiniAppShellProps> = ({
  title,
  icon: Icon,
  documentTitle,
  backTo = '/apps',
  panel,
  panelWidth = 320,
  panelLabel,
  defaultPanelVisible = true,
  statusBar,
  onReset,
  dragDrop,
  dropMessage,
  centerContent = true,
  className,
  canvasClassName,
  children,
}) => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const hasPanel = !!panel;
  const [panelVisible, setPanelVisible] = useState(defaultPanelVisible);
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);

  useEffect(() => {
    if (documentTitle) document.title = documentTitle;
  }, [documentTitle]);

  useHotkeys('tab', (e) => {
    if (!hasPanel || isMobile) return;
    e.preventDefault();
    setPanelVisible((v) => !v);
  });
  useHotkeys('r', () => onReset?.(), { enableOnFormTags: false });

  const canvasPadding = useMemo(
    () => ({
      paddingRight: !isMobile && hasPanel && panelVisible ? panelWidth + 24 : 0,
      paddingBottom: isMobile ? (mobileSheetOpen ? '45%' : 56) : statusBar ? 56 : 16,
    }),
    [isMobile, hasPanel, panelVisible, panelWidth, statusBar, mobileSheetOpen]
  );

  return (
    <AppShell className={className}>
      <AppShellTopBar
        left={
          <>
            <Tooltip content="Back to apps">
              <Button
                variant="ghost"
                size="icon"
                aria-label="Back to apps"
                className="h-7 w-7 text-neutral-500"
                onClick={() => navigate(backTo)}
              >
                <ChevronLeft size={16} />
              </Button>
            </Tooltip>
            {Icon && <Icon size={14} className="text-brand-cyan ml-0.5" />}
            <MicroTitle className="text-[10px] text-neutral-500 uppercase tracking-widest ml-1.5">
              {title}
            </MicroTitle>
          </>
        }
        right={
          <>
            {onReset && (
              <Tooltip content="Reset (R)">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Reset"
                  className="h-7 w-7 text-neutral-500"
                  onClick={onReset}
                >
                  <RotateCcw size={14} />
                </Button>
              </Tooltip>
            )}
            {hasPanel && !isMobile && (
              <Tooltip content={panelVisible ? 'Hide panel (Tab)' : 'Show panel (Tab)'}>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={panelVisible ? 'Hide panel' : 'Show panel'}
                  className="h-7 w-7 text-neutral-500"
                  onClick={() => setPanelVisible((v) => !v)}
                >
                  {panelVisible ? <PanelRightClose size={14} /> : <PanelRightOpen size={14} />}
                </Button>
              </Tooltip>
            )}
          </>
        }
      />

      <div
        className={cn(
          'absolute inset-0 pt-10 overflow-auto transition-all duration-300',
          centerContent && 'flex items-center justify-center',
          canvasClassName
        )}
        style={canvasPadding}
        {...(dragDrop && {
          onDrop: dragDrop.onDrop,
          onDragOver: dragDrop.onDragOver,
          onDragLeave: dragDrop.onDragLeave,
        })}
      >
        {children}
        {dragDrop && <DropOverlay visible={dragDrop.isDragOver} message={dropMessage} />}
      </div>

      {hasPanel && !isMobile && (
        <AppShellPanel side="right" visible={panelVisible} width={panelWidth}>
          <div className="h-full overflow-y-auto scrollbar-none rounded-2xl border border-neutral-800 bg-neutral-900/70 backdrop-blur-xl p-5">
            {panel}
          </div>
        </AppShellPanel>
      )}

      {hasPanel && isMobile && (
        <AppShellMobileSheet
          open={mobileSheetOpen}
          onToggle={() => setMobileSheetOpen((v) => !v)}
          label={panelLabel || title}
        >
          <div className="p-5">{panel}</div>
        </AppShellMobileSheet>
      )}

      {statusBar && <AppShellStatusBar>{statusBar}</AppShellStatusBar>}
    </AppShell>
  );
};
