import React, { useState, useEffect, useMemo } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import {
  ChevronLeft,
  PanelRightOpen,
  PanelRightClose,
  RotateCcw,
  type LucideIcon,
} from '@/lib/ui/icons';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/Tooltip';
import { MicroTitle } from '@/components/ui/MicroTitle';
import { AppShell, AppShellTopBar, AppShellPanel } from '@/components/ui/AppShell';
import { AppShellMobileSheet } from '@/components/ui/AppShellMobileSheet';
import { AppShellLegalMenu } from '@/components/ui/AppShellLegalMenu';
import { StageDock, StageDockDivider, stageDockButton } from '@/components/shared/StageDock';
import { DropOverlay } from '@/components/ui/DropOverlay';
import { useIsMobile } from '@/hooks/use-media-query';
import { useInAppShell } from '@/components/shell/InAppShellContext';
import { BrandFunnelBanner } from '@/components/funnel/BrandFunnelBanner';
import { glassSurface } from '@/lib/ui/glass';
import { useTranslation } from '@/hooks/useTranslation';

export interface MiniAppShellDragDrop {
  onDrop: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  isDragOver: boolean;
}

export interface MiniAppShellProps {
  title: string;
  /**
   * Identificador ESTÁVEL da tool (ex.: 'qr-code-generator') — dimensão do
   * analytics de funil e chave do dismiss em localStorage. Obrigatório de
   * propósito: nunca derive de `title`, que é label de UI e vai ser traduzido
   * (a métrica se bifurcaria por idioma e o dismiss do usuário perderia valor).
   */
  toolId: string;
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

  /** Opt-out do banner de funil "conecte sua marca" (Fase 5). Default: mostra. */
  hideFunnelBanner?: boolean;

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
  toolId,
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
  hideFunnelBanner = false,
  centerContent = true,
  className,
  canvasClassName,
  children,
}) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  // Dentro do app shell o header (AppSpine, com brand-select) já existe no topo —
  // o header próprio do mini-app empilharia dois. Só mostramos back+título quando
  // rodando FORA do shell (ex.: tool standalone). Ver DESIGN §6 (sem header duplo).
  const inShell = useInAppShell();
  const hasPanel = !!panel;
  const [panelVisible, setPanelVisible] = useState(defaultPanelVisible);
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const [mobileSheetHeight, setMobileSheetHeight] = useState(45);

  useEffect(() => {
    if (documentTitle) document.title = documentTitle;
  }, [documentTitle]);

  useHotkeys('tab', (e) => {
    if (!hasPanel || isMobile) return;
    e.preventDefault();
    setPanelVisible((v) => !v);
  });
  useHotkeys('r', () => onReset?.(), { enableOnFormTags: false });

  const showPanelToggle = hasPanel && !isMobile;
  const hasDock = Boolean(statusBar || onReset || showPanelToggle);

  const canvasPadding = useMemo(
    () => ({
      paddingRight: !isMobile && hasPanel && panelVisible ? panelWidth + 24 : 0,
      // A percentage in padding is measured against the width, and the sheet's height is a
      // percentage of the height. `bottom` is measured against the height, so the two line up.
      bottom: isMobile && mobileSheetOpen ? `${mobileSheetHeight}%` : undefined,
      // Room for the dock, and on a phone for the closed sheet's bar under it.
      paddingBottom: isMobile ? (mobileSheetOpen ? 72 : hasPanel ? 120 : 72) : hasDock ? 64 : 16,
    }),
    [isMobile, hasPanel, panelVisible, panelWidth, hasDock, mobileSheetOpen, mobileSheetHeight]
  );

  return (
    // AppShell's base surface is the always-dark editor canvas; mini-tools are
    // tokenized, so they take the theme background.
    <AppShell className={cn('bg-background', className)}>
      {/* In the app the bar above already says where we are. */}
      {!inShell && (
        <AppShellTopBar
          left={
            <>
              <Tooltip content={t('common.backToApps')}>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t('common.backToApps')}
                  className="h-7 w-7 text-muted-foreground"
                  onClick={() => navigate(backTo)}
                >
                  <ChevronLeft size={16} />
                </Button>
              </Tooltip>
              {Icon && <Icon size={14} className="text-muted-foreground ml-0.5" />}
              <MicroTitle className="text-xs text-muted-foreground ml-1.5">{title}</MicroTitle>
            </>
          }
          right={<AppShellLegalMenu />}
        />
      )}

      {!hideFunnelBanner && <BrandFunnelBanner toolId={toolId} />}

      <div
        className={cn(
          'absolute inset-0 overflow-auto transition-colors duration-300',
          inShell ? 'pt-3' : 'pt-10',
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
          <div
            className={cn(
              'h-full overflow-y-auto scrollbar-none rounded-xl p-5',
              glassSurface.panel
            )}
          >
            {panel}
          </div>
        </AppShellPanel>
      )}

      {hasPanel && isMobile && (
        <AppShellMobileSheet
          open={mobileSheetOpen}
          onToggle={() => setMobileSheetOpen((v) => !v)}
          height={`${mobileSheetHeight}%`}
          onHeightChange={setMobileSheetHeight}
          label={panelLabel || title}
        >
          <div className="p-5">{panel}</div>
        </AppShellMobileSheet>
      )}

      {hasDock && (
        <StageDock
          className="transition-[bottom] duration-[var(--dur-base)]"
          bottom={
            !isMobile || !hasPanel
              ? '12px'
              : mobileSheetOpen
                ? `calc(${mobileSheetHeight}% + 8px)`
                : '60px'
          }
        >
          {statusBar && (
            <div className="flex min-w-0 items-center gap-3 overflow-hidden whitespace-nowrap px-2 text-2xs text-muted-foreground">
              {statusBar}
            </div>
          )}
          {statusBar && (onReset || showPanelToggle) && <StageDockDivider />}
          {onReset && (
            <Tooltip content={t('common.resetShortcut')}>
              <Button
                variant="ghost"
                size="icon"
                aria-label={t('common.reset')}
                className={stageDockButton}
                onClick={onReset}
              >
                <RotateCcw size={14} />
              </Button>
            </Tooltip>
          )}
          {showPanelToggle && (
            <Tooltip
              content={panelVisible ? t('common.hidePanelShortcut') : t('common.showPanelShortcut')}
            >
              <Button
                variant="ghost"
                size="icon"
                aria-label={panelVisible ? t('common.hidePanel') : t('common.showPanel')}
                className={stageDockButton}
                onClick={() => setPanelVisible((v) => !v)}
              >
                {panelVisible ? <PanelRightClose size={14} /> : <PanelRightOpen size={14} />}
              </Button>
            </Tooltip>
          )}
        </StageDock>
      )}
    </AppShell>
  );
};
