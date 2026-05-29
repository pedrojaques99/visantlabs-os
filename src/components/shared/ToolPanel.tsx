import React, { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { Button } from '@/components/ui/button';
import { ChevronDown, Eye, EyeOff, Download, Clipboard, Copy } from 'lucide-react';

export const ToolPanel: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <GlassPanel className={cn('h-full overflow-hidden flex flex-col', className)}>
    {children}
  </GlassPanel>
);

export const ToolPanelHeader: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="shrink-0 border-b border-neutral-800/50 px-4 py-3">
    {children}
  </div>
);

export const ToolPanelContent: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6 scrollbar-thin scrollbar-thumb-neutral-700 scrollbar-track-transparent">
    {children}
  </div>
);

export const ToolPanelSection: React.FC<{ title: string; children: React.ReactNode; className?: string; id?: string; onReset?: () => void }> = ({ title, children, className, id, onReset }) => (
  <div id={id} className={cn('space-y-3 scroll-mt-2', className)}>
    <div className="group -mx-4 px-4 py-1.5 flex items-center justify-between">
      <span className="text-[10px] font-mono uppercase tracking-widest text-neutral-500">{title}</span>
      {onReset && (
        <button
          onClick={onReset}
          className="text-[10px] font-mono text-neutral-700 hover:text-neutral-400 transition-colors uppercase tracking-wider opacity-0 group-hover:opacity-100"
        >
          Reset
        </button>
      )}
    </div>
    {children}
  </div>
);

export const ToolPanelDisclosure: React.FC<{
  label: string;
  icon?: React.ReactNode;
  id?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  badge?: React.ReactNode;
}> = ({ label, icon, id, children, defaultOpen = false, badge }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div id={id} className="rounded-md border border-neutral-800/50 transition-all duration-200 scroll-mt-2">
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          'w-full flex items-center justify-between text-left px-3 py-2.5 transition-all duration-200 rounded-md',
          'hover:bg-neutral-800/10',
          open && 'bg-neutral-800/20'
        )}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {icon && <span className="text-neutral-500">{icon}</span>}
          <span className="text-[10px] font-mono uppercase tracking-widest text-neutral-500">{label}</span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {badge}
          <ChevronDown size={14} className={cn('text-neutral-500 transition-transform duration-200', open && 'rotate-180')} />
        </div>
      </button>
      {open && (
        <div className="px-3 pb-3 pt-1 animate-fade-in space-y-3">
          {children}
        </div>
      )}
    </div>
  );
};

export const ToolPanelDivider: React.FC = () => (
  <div className="h-px bg-neutral-800/50" />
);

export const ToolPanelActions: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="shrink-0 border-t border-neutral-800/50 px-4 py-3 space-y-2">
    {children}
  </div>
);

export const ToolPanelGrid: React.FC<{ children: React.ReactNode; cols?: 2 | 3 | 4 | 5 }> = ({ children, cols = 2 }) => (
  <div className={cn('grid gap-1.5', {
    'grid-cols-2': cols === 2,
    'grid-cols-3': cols === 3,
    'grid-cols-4': cols === 4,
    'grid-cols-5': cols === 5,
  })}>
    {children}
  </div>
);

export const ToolPanelChip: React.FC<{
  children: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
  className?: string;
}> = ({ children, active, onClick, className }) => (
  <button
    onClick={onClick}
    className={cn(
      'px-2.5 py-2 rounded-md text-[10px] font-mono uppercase tracking-wider transition-all duration-200 text-left border',
      active
        ? 'bg-white/10 text-white border-white/20'
        : 'bg-neutral-900/50 text-neutral-400 border-neutral-800/50 hover:bg-neutral-800/30 hover:text-neutral-200 hover:border-neutral-700/50',
      className
    )}
  >
    {children}
  </button>
);

export const ToolPanelRow: React.FC<{
  label: string;
  children: React.ReactNode;
}> = ({ label, children }) => (
  <div className="flex items-center justify-between py-1">
    <span className="text-[11px] text-neutral-400">{label}</span>
    {children}
  </div>
);

export const InlineColorPicker: React.FC<{
  value: string;
  onChange: (hex: string) => void;
  label?: string;
}> = ({ value, onChange, label }) => (
  <div className="flex items-center gap-2">
    <input
      type="color"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={label || 'Color'}
      className="w-6 h-6 rounded-md cursor-pointer bg-transparent border-0"
    />
    <span className="text-[10px] text-neutral-500 font-mono uppercase">{value}</span>
  </div>
);

export const ChannelRow: React.FC<{
  color: string;
  onColorChange: (hex: string) => void;
  label: string;
  visible: boolean;
  onToggleVisible: () => void;
  expanded: boolean;
  onToggleExpand: () => void;
  actions?: React.ReactNode;
  children: React.ReactNode;
}> = ({ color, onColorChange, label, visible, onToggleVisible, expanded, onToggleExpand, actions, children }) => (
  <div className={cn('rounded-lg border transition-colors', expanded ? 'border-neutral-700 bg-neutral-900/50' : 'border-transparent')}>
    <button
      onClick={onToggleExpand}
      className="flex items-center gap-3 w-full py-2 px-2 hover:bg-neutral-800/30 rounded-lg transition-colors"
    >
      <input
        type="color"
        value={color}
        aria-label={`${label} color`}
        onChange={(e) => { e.stopPropagation(); onColorChange(e.target.value); }}
        onClick={(e) => e.stopPropagation()}
        className="w-7 h-7 rounded-md cursor-pointer bg-transparent border-0 shrink-0"
      />
      <span className="text-[11px] text-neutral-400 font-mono uppercase flex-1 text-left tracking-wider">{label}</span>
      <div className="flex items-center gap-1">
        {actions}
        <span
          role="button"
          aria-label={`Toggle ${label} visibility`}
          onClick={(e) => { e.stopPropagation(); onToggleVisible(); }}
          className="text-neutral-500 hover:text-white transition-colors p-1"
        >
          {visible ? <Eye size={14} /> : <EyeOff size={14} />}
        </span>
        <ChevronDown size={14} className={cn('text-neutral-600 transition-transform', expanded && 'rotate-180')} />
      </div>
    </button>
    {expanded && (
      <div className="px-2 pb-2 pt-1 animate-fade-in space-y-2">
        {children}
      </div>
    )}
  </div>
);

export const ToolPanelExportActions: React.FC<{
  onExport: () => void;
  isExporting: boolean;
  disabled: boolean;
  sendTo?: React.ReactNode;
  onCopyAsPng?: () => void;
  children?: React.ReactNode;
}> = ({ onExport, isExporting, disabled, sendTo, onCopyAsPng, children }) => {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <ToolPanelActions>
      <div className="relative w-full">
        <div className="flex gap-2 w-full">
          <Button
            onClick={onExport}
            disabled={isExporting || disabled}
            aria-label="Export"
            className="flex-1 bg-white hover:bg-neutral-200 text-black font-medium h-9 text-xs gap-2"
          >
            <Download size={14} />
            {isExporting ? 'Exporting...' : 'Export'}
          </Button>
          <Button
            aria-label="More options"
            onClick={() => setMenuOpen(!menuOpen)}
            disabled={disabled}
            variant="outline"
            className="h-9 w-9 p-0 border-neutral-700 text-neutral-400 hover:text-white"
          >
            <ChevronDown size={14} className={cn('transition-transform', menuOpen && 'rotate-180')} />
          </Button>
          {onCopyAsPng && (
            <Button
              onClick={onCopyAsPng}
              disabled={disabled}
              variant="outline"
              aria-label="Copy as PNG"
              title="Copy as PNG"
              className="h-9 w-9 p-0 border-neutral-700 text-neutral-400 hover:text-white"
            >
              <Copy size={14} />
            </Button>
          )}
        </div>

        {menuOpen && (
          <div className="absolute bottom-full left-0 right-0 mb-1 bg-neutral-900 border border-neutral-700 rounded-lg p-1 shadow-xl z-20 animate-fade-in">
            {sendTo && (
              <div className="px-1 py-0.5">
                {sendTo}
              </div>
            )}
          </div>
        )}
      </div>
      {children}
    </ToolPanelActions>
  );
};
