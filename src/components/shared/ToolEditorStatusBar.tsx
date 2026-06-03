import React from 'react';
import { AppShellStatusBar } from '@/components/ui/AppShell';

export interface StatusItem {
  label: string;
  color?: string;
  truncate?: boolean;
}

export interface ToolEditorStatusBarProps {
  items: StatusItem[];
  fileName?: string;
}

export const ToolEditorStatusBar: React.FC<ToolEditorStatusBarProps> = ({ items, fileName }) => (
  <AppShellStatusBar>
    {items.map((item, i) => (
      <React.Fragment key={i}>
        {i > 0 && <span>•</span>}
        <span
          className={item.color || undefined}
          style={item.truncate ? { maxWidth: 120 } : undefined}
        >
          {item.label}
        </span>
      </React.Fragment>
    ))}
    {fileName && (
      <>
        <span>•</span>
        <span className="max-w-[120px] truncate">{fileName}</span>
      </>
    )}
  </AppShellStatusBar>
);
