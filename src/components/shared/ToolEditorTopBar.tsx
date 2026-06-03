import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft,
  PanelRightOpen,
  PanelRightClose,
  RotateCcw,
  Undo2,
  Redo2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/Tooltip';
import { MicroTitle } from '@/components/ui/MicroTitle';
import { AppShellTopBar } from '@/components/ui/AppShell';
import { AppShellLegalMenu } from '@/components/ui/AppShellLegalMenu';

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
  const navigate = useNavigate();

  return (
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
          <MicroTitle className="text-[10px] text-neutral-600 uppercase tracking-widest ml-1">
            {title}
          </MicroTitle>
          {extraLeft}
        </>
      }
      right={
        <>
          {extraRight}
          {undo && (
            <Tooltip content="Undo (Ctrl+Z)">
              <Button
                variant="ghost"
                size="icon"
                aria-label="Undo"
                className="h-7 w-7 text-neutral-500 disabled:opacity-30"
                disabled={undo.disabled}
                onClick={undo.handler}
              >
                <Undo2 size={14} />
              </Button>
            </Tooltip>
          )}
          {redo && (
            <Tooltip content="Redo (Ctrl+Shift+Z)">
              <Button
                variant="ghost"
                size="icon"
                aria-label="Redo"
                className="h-7 w-7 text-neutral-500 disabled:opacity-30"
                disabled={redo.disabled}
                onClick={redo.handler}
              >
                <Redo2 size={14} />
              </Button>
            </Tooltip>
          )}
          <Tooltip content="Reset settings (R)">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Reset settings"
              className="h-7 w-7 text-neutral-500"
              onClick={onReset}
            >
              <RotateCcw size={14} />
            </Button>
          </Tooltip>
          {!isMobile && (
            <Tooltip content={panelVisible ? 'Hide panel (Tab)' : 'Show panel (Tab)'}>
              <Button
                variant="ghost"
                size="icon"
                aria-label={panelVisible ? 'Hide panel' : 'Show panel'}
                className="h-7 w-7 text-neutral-500"
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
