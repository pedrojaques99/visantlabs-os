import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft,
  PanelRightOpen,
  PanelRightClose,
  RotateCcw,
  Undo2,
  Redo2,
} from '@/lib/ui/icons';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/Tooltip';
import { MicroTitle } from '@/components/ui/MicroTitle';
import { AppShellTopBar } from '@/components/ui/AppShell';
import { AppShellLegalMenu } from '@/components/ui/AppShellLegalMenu';
import { useTranslation } from '@/hooks/useTranslation';

export interface ToolEditorTopBarProps {
  title: string;
  backTo?: string;
  panelVisible: boolean;
  onTogglePanel: () => void;
  onReset: () => void;
  isMobile: boolean;
  undo?: { handler: () => void; disabled: boolean };
  redo?: { handler: () => void; disabled: boolean };
  extraLeft?: React.ReactNode;
  extraRight?: React.ReactNode;
  showLegalMenu?: boolean;
}

export const ToolEditorTopBar: React.FC<ToolEditorTopBarProps> = ({
  title,
  backTo = '/apps',
  panelVisible,
  onTogglePanel,
  onReset,
  isMobile,
  undo,
  redo,
  extraLeft,
  extraRight,
  showLegalMenu = true,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
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
          <MicroTitle className="text-2xs text-muted-foreground ml-1">{title}</MicroTitle>
          {extraLeft}
        </>
      }
      right={
        <>
          {extraRight}
          {undo && (
            <Tooltip content={t('toolEditor.undoHint')}>
              <Button
                variant="ghost"
                size="icon"
                aria-label={t('toolEditor.undo')}
                className="h-7 w-7 text-muted-foreground disabled:opacity-30"
                disabled={undo.disabled}
                onClick={undo.handler}
              >
                <Undo2 size={14} />
              </Button>
            </Tooltip>
          )}
          {redo && (
            <Tooltip content={t('toolEditor.redoHint')}>
              <Button
                variant="ghost"
                size="icon"
                aria-label={t('toolEditor.redo')}
                className="h-7 w-7 text-muted-foreground disabled:opacity-30"
                disabled={redo.disabled}
                onClick={redo.handler}
              >
                <Redo2 size={14} />
              </Button>
            </Tooltip>
          )}
          <Tooltip content={t('toolEditor.resetHint')}>
            <Button
              variant="ghost"
              size="icon"
              aria-label={t('common.resetSettingsTitle')}
              className="h-7 w-7 text-muted-foreground"
              onClick={onReset}
            >
              <RotateCcw size={14} />
            </Button>
          </Tooltip>
          {!isMobile && (
            <Tooltip
              content={panelVisible ? t('toolEditor.hidePanelHint') : t('toolEditor.showPanelHint')}
            >
              <Button
                variant="ghost"
                size="icon"
                aria-label={panelVisible ? t('common.hidePanel') : t('common.showPanel')}
                className="h-7 w-7 text-muted-foreground"
                onClick={onTogglePanel}
              >
                {panelVisible ? <PanelRightClose size={14} /> : <PanelRightOpen size={14} />}
              </Button>
            </Tooltip>
          )}
          {showLegalMenu && <AppShellLegalMenu />}
        </>
      }
    />
  );
};
