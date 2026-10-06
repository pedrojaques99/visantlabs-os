import React, { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { Button } from '@/components/ui/button';
import { ChevronDown, Eye, EyeOff, Download, Copy, Pipette, RotateCcw } from '@/lib/ui/icons';
import { HexColorPicker } from 'react-colorful';
import { BrandSwatchRow } from './BrandSwatchRow';
import { hexToRgb, rgbToHex, parseHex } from '@/utils/colorUtils';
import { useTranslation } from '@/hooks/useTranslation';
import { hoverReveal } from '@/lib/ui/hoverReveal';

// Minimal typing for the native EyeDropper API (Chromium). Feature-detected at runtime.
type EyeDropperResult = { sRGBHex: string };
interface EyeDropperCtor {
  new (): { open: () => Promise<EyeDropperResult> };
}
const hasEyeDropper = () => typeof window !== 'undefined' && 'EyeDropper' in window;

/**
 * Editable hex text field with paste-first UX: select-all on focus, live-apply
 * on any valid value (paste or type), Enter to commit, revert on invalid blur.
 * Used by InlineColorPicker; ExpandableColorPicker shares the same parseHex logic.
 */
const HexTextInput: React.FC<{
  value: string;
  onChange: (hex: string) => void;
  ariaLabel?: string;
  className?: string;
}> = ({ value, onChange, ariaLabel, className }) => {
  const [draft, setDraft] = React.useState(value.replace('#', '').toUpperCase());
  React.useEffect(() => {
    setDraft(value.replace('#', '').toUpperCase());
  }, [value]);
  return (
    <input
      type="text"
      value={draft}
      onChange={(e) => {
        setDraft(e.target.value.replace(/^#/, '').toUpperCase());
        const hex = parseHex(e.target.value);
        if (hex) onChange(hex);
      }}
      onFocus={(e) => e.target.select()}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
      }}
      onBlur={() => {
        if (!parseHex(draft)) setDraft(value.replace('#', '').toUpperCase());
      }}
      spellCheck={false}
      aria-label={ariaLabel || 'Color hex'}
      className={cn(
        'bg-transparent text-2xs text-muted-foreground font-mono uppercase tracking-wider outline-none focus:text-foreground w-[8ch]',
        className
      )}
    />
  );
};

export const ToolPanel: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className,
}) => (
  <GlassPanel intensity="default" className={cn('h-full overflow-hidden flex flex-col', className)}>
    {children}
  </GlassPanel>
);

export const ToolPanelHeader: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="shrink-0 border-b border-border px-4 py-3">{children}</div>
);

export const ToolPanelContent: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6 scrollbar-thin">{children}</div>
);

export const SectionLabel: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className,
}) => (
  <span className={cn('text-xs font-medium text-muted-foreground', className)}>{children}</span>
);

export const SegmentedControl: React.FC<{
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
  variant?: 'glass' | 'brand';
  size?: 'sm' | 'md';
  className?: string;
}> = ({ options, value, onChange, variant = 'glass', size = 'md', className }) => (
  <div
    className={cn(
      'flex rounded-xl p-0.5 border',
      variant === 'brand' ? 'bg-muted/50 border-border' : 'bg-muted border-border',
      className
    )}
  >
    {options.map((opt) => (
      <button
        key={opt.value}
        onClick={() => onChange(opt.value)}
        className={cn(
          'font-medium rounded-md transition-colors flex-1 text-center',
          size === 'sm' ? 'px-2 py-1 text-2xs' : 'px-3 py-1 text-2xs',
          value === opt.value
            ? variant === 'brand'
              ? 'bg-brand-cyan text-black font-medium'
              : 'bg-accent text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
        )}
      >
        {opt.label}
      </button>
    ))}
  </div>
);

export const ToolPanelSection: React.FC<{
  title: string;
  children: React.ReactNode;
  className?: string;
  id?: string;
  onReset?: () => void;
}> = ({ title, children, className, id, onReset }) => {
  const { t } = useTranslation();
  return (
    <div id={id} className={cn('space-y-3 scroll-mt-2', className)}>
      <div className="group -mx-4 px-4 py-1.5 flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{title}</span>
        {onReset && (
          <button
            type="button"
            onClick={onReset}
            className={cn(
              hoverReveal,
              'text-2xs text-muted-foreground hover:text-foreground transition-colors'
            )}
          >
            {t('common.reset')}
          </button>
        )}
      </div>
      {children}
    </div>
  );
};

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
    <div
      id={id}
      className="rounded-md border border-border transition-colors duration-200 scroll-mt-2"
    >
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          'w-full flex items-center justify-between text-left px-3 py-2.5 transition-colors duration-200 rounded-md',
          'hover:bg-accent',
          open && 'bg-muted/50'
        )}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {icon && <span className="text-muted-foreground">{icon}</span>}
          <span className="text-xs font-medium text-muted-foreground">{label}</span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {badge}
          <ChevronDown
            size={14}
            className={cn(
              'text-muted-foreground transition-transform duration-200',
              open && 'rotate-180'
            )}
          />
        </div>
      </button>
      {open && <div className="px-3 pb-3 pt-1 animate-fade-in space-y-3">{children}</div>}
    </div>
  );
};

export const ToolPanelDivider: React.FC = () => <div className="h-px bg-border" />;

export const ToolPanelActions: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="shrink-0 border-t border-border px-4 py-3 space-y-2">{children}</div>
);

export const ToolPanelGrid: React.FC<{ children: React.ReactNode; cols?: 2 | 3 | 4 | 5 }> = ({
  children,
  cols = 2,
}) => (
  <div
    className={cn('grid gap-1.5', {
      'grid-cols-2': cols === 2,
      'grid-cols-3': cols === 3,
      'grid-cols-4': cols === 4,
      'grid-cols-5': cols === 5,
    })}
  >
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
      'px-2.5 py-2 rounded-md text-xs transition-colors duration-200 text-left border',
      active
        ? 'bg-accent text-foreground border-border-hover'
        : 'bg-muted/50 text-muted-foreground border-border hover:bg-accent hover:text-foreground hover:border-border-hover',
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
    <span className="text-2xs text-muted-foreground">{label}</span>
    {children}
  </div>
);

export const InlineColorPicker: React.FC<{
  value: string;
  onChange: (hex: string) => void;
  label?: string;
}> = ({ value, onChange, label }) => (
  <div className="space-y-1.5">
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label || 'Color'}
        className="w-6 h-6 rounded-md cursor-pointer bg-transparent border-0"
      />
      <span className="text-2xs text-muted-foreground font-mono">#</span>
      <HexTextInput
        value={value}
        onChange={onChange}
        ariaLabel={label ? `${label} hex` : 'Color hex'}
      />
    </div>
    <BrandSwatchRow onPick={onChange} current={value} />
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
}> = ({
  color,
  onColorChange,
  label,
  visible,
  onToggleVisible,
  expanded,
  onToggleExpand,
  actions,
  children,
}) => (
  <div
    className={cn(
      'rounded-xl border transition-colors',
      expanded ? 'border-border bg-muted/50' : 'border-transparent'
    )}
  >
    {/* Row background toggles on mouse-click for convenience; the accessible
        keyboard toggle is the chevron <button>. Interactive children stop
        propagation so they don't double-fire the toggle. */}
    <div
      onClick={onToggleExpand}
      className="flex items-center gap-2 w-full py-2 px-2 hover:bg-accent rounded-xl transition-colors cursor-pointer"
    >
      <input
        type="color"
        value={color}
        aria-label={`${label} color`}
        onChange={(e) => onColorChange(e.target.value)}
        onClick={(e) => e.stopPropagation()}
        className="w-7 h-7 rounded-md cursor-pointer bg-transparent border-0 shrink-0"
      />
      {/* Inline hex — edit without opening the native picker */}
      <span
        className="flex items-center gap-1"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <span className="text-2xs text-muted-foreground font-mono">#</span>
        <HexTextInput value={color} onChange={onColorChange} ariaLabel={`${label} hex`} />
      </span>
      {!label.startsWith('#') && (
        <span className="text-2xs text-muted-foreground truncate">{label}</span>
      )}
      <div className="flex items-center gap-1 ml-auto shrink-0">
        {actions}
        <button
          type="button"
          aria-label={`Toggle ${label} visibility`}
          aria-pressed={visible}
          onClick={(e) => {
            e.stopPropagation();
            onToggleVisible();
          }}
          className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan/60"
        >
          {visible ? <Eye size={14} /> : <EyeOff size={14} />}
        </button>
        <button
          type="button"
          aria-label={`${expanded ? 'Collapse' : 'Expand'} ${label}`}
          aria-expanded={expanded}
          onClick={(e) => {
            e.stopPropagation();
            onToggleExpand();
          }}
          className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan/60"
        >
          <ChevronDown size={14} className={cn('transition-transform', expanded && 'rotate-180')} />
        </button>
      </div>
    </div>
    {expanded && (
      <div className="px-2 pb-2 pt-1 animate-fade-in space-y-2">
        <BrandSwatchRow onPick={onColorChange} current={color} />
        {children}
      </div>
    )}
  </div>
);

/**
 * Expandable color picker with swatch, hex input, and optional presets.
 * Single source of truth for all color picker UIs across the app.
 */
export const ExpandableColorPicker: React.FC<{
  color: string;
  onChange: (hex: string) => void;
  label?: string;
  presets?: string[];
  onReset?: () => void;
  defaultExpanded?: boolean;
  /** Show the native eyedropper button (Chromium). Auto-hidden where unsupported. Default true. */
  eyedropper?: boolean;
  /** Recently used colors shown as a quick-pick row when expanded. */
  recentColors?: string[];
  /** Show editable R/G/B numeric fields under the picker. Default false. */
  showRgb?: boolean;
}> = ({
  color,
  onChange,
  label,
  presets,
  onReset,
  defaultExpanded = false,
  eyedropper = true,
  recentColors,
  showRgb = false,
}) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(defaultExpanded);
  const [hexInput, setHexInput] = useState(color.replace('#', '').toUpperCase());
  const eyedropperOn = eyedropper && hasEyeDropper();

  // Sync external changes
  React.useEffect(() => {
    setHexInput(color.replace('#', '').toUpperCase());
  }, [color]);

  // Paste-first: accept "#RRGGBB", "RRGGBB", or 3-digit shorthand, apply immediately.
  const handleHexInput = useCallback(
    (raw: string) => {
      setHexInput(
        raw
          .replace(/^#/, '')
          .replace(/[^0-9a-fA-F]/g, '')
          .slice(0, 6)
          .toUpperCase()
      );
      const hex = parseHex(raw);
      if (hex) onChange(hex);
    },
    [onChange]
  );

  const pickWithEyedropper = useCallback(async () => {
    const Ctor = (window as unknown as { EyeDropper?: EyeDropperCtor }).EyeDropper;
    if (!Ctor) return;
    try {
      const result = await new Ctor().open();
      if (result?.sRGBHex) onChange(result.sRGBHex.toUpperCase());
    } catch {
      /* user cancelled */
    }
  }, [onChange]);

  const rgb = React.useMemo(() => hexToRgb(color), [color]);
  const setChannel = useCallback(
    (index: number, raw: string) => {
      const n = Math.max(0, Math.min(255, parseInt(raw || '0', 10) || 0));
      const next: [number, number, number] = [...rgb] as [number, number, number];
      next[index] = n;
      onChange(rgbToHex(next[0], next[1], next[2]));
    },
    [rgb, onChange]
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="w-7 h-7 rounded-md border border-border shrink-0 cursor-pointer hover:border-border-hover transition-colors"
          style={{ backgroundColor: color }}
          aria-label={label ? `Toggle ${label} color picker` : 'Toggle color picker'}
        />
        <div className="flex items-center flex-1 bg-muted border border-border rounded px-2 py-0.5 min-w-0">
          <span className="text-2xs text-muted-foreground mr-1">#</span>
          <input
            type="text"
            value={hexInput}
            onChange={(e) => handleHexInput(e.target.value)}
            onFocus={(e) => e.target.select()}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur();
            }}
            onBlur={() => {
              if (hexInput.length !== 6) setHexInput(color.replace('#', '').toUpperCase());
            }}
            spellCheck={false}
            autoCapitalize="characters"
            aria-label={label || 'Color hex'}
            className="bg-transparent text-xs text-foreground font-mono tracking-wider w-full focus:outline-none uppercase"
          />
        </div>
        {eyedropperOn && (
          <button
            type="button"
            onClick={pickWithEyedropper}
            className="text-muted-foreground hover:text-foreground transition-colors p-1 shrink-0"
            aria-label={t('toolEditor.eyedropperHint')}
            title={t('toolEditor.eyedropper')}
          >
            <Pipette size={14} />
          </button>
        )}
        {onReset && (
          <button
            type="button"
            onClick={onReset}
            className="text-muted-foreground hover:text-foreground transition-colors p-1 shrink-0"
            aria-label={t('common.reset')}
          >
            <RotateCcw size={12} />
          </button>
        )}
        <ChevronDown
          size={14}
          className={cn(
            'text-muted-foreground transition-transform shrink-0',
            open && 'rotate-180'
          )}
        />
      </div>
      {open && (
        <div className="animate-fade-in space-y-2">
          <BrandSwatchRow onPick={onChange} current={color} />
          {presets && presets.length > 0 && (
            <div className="flex gap-1.5 flex-wrap">
              {presets.map((p) => (
                <button
                  key={p}
                  onClick={() => onChange(p)}
                  className={cn(
                    'w-5 h-5 rounded-full border transition-colors',
                    color.toLowerCase() === p.toLowerCase()
                      ? 'border-ring ring-1 ring-ring/50 ring-offset-1 ring-offset-background'
                      : 'border-border hover:border-border-hover'
                  )}
                  style={{ backgroundColor: p }}
                  aria-label={`Preset ${p}`}
                />
              ))}
            </div>
          )}
          <div className="custom-color-picker">
            <HexColorPicker
              color={color}
              onChange={onChange}
              style={{ width: '100%', height: '120px' }}
            />
          </div>
          {showRgb && (
            <div className="grid grid-cols-3 gap-1.5">
              {(['R', 'G', 'B'] as const).map((ch, i) => (
                <label
                  key={ch}
                  className="flex items-center gap-1 bg-muted border border-border rounded px-1.5 py-0.5"
                >
                  <span className="text-2xs font-mono text-muted-foreground">{ch}</span>
                  <input
                    type="number"
                    min={0}
                    max={255}
                    value={rgb[i]}
                    onChange={(e) => setChannel(i, e.target.value)}
                    aria-label={`${label ? label + ' ' : ''}${ch} channel`}
                    className="bg-transparent text-2xs text-foreground font-mono tabular-nums w-full focus:outline-none"
                  />
                </label>
              ))}
            </div>
          )}
          {recentColors && recentColors.length > 0 && (
            <div className="space-y-1">
              <span className="text-2xs text-muted-foreground">{t('common.recent')}</span>
              <div className="flex gap-1.5 flex-wrap">
                {recentColors.slice(0, 12).map((c, i) => (
                  <button
                    key={`${c}-${i}`}
                    onClick={() => onChange(c)}
                    className={cn(
                      'w-5 h-5 rounded-full border transition-colors',
                      color.toLowerCase() === c.toLowerCase()
                        ? 'border-ring ring-1 ring-ring/50'
                        : 'border-border hover:border-border-hover'
                    )}
                    style={{ backgroundColor: c }}
                    aria-label={`Recent ${c}`}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export const ToolPanelExportActions: React.FC<{
  onExport: () => void;
  isExporting: boolean;
  disabled: boolean;
  sendTo?: React.ReactNode;
  onCopyAsPng?: () => void;
  children?: React.ReactNode;
}> = ({ onExport, isExporting, disabled, sendTo, onCopyAsPng, children }) => {
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <ToolPanelActions>
      <div className="relative w-full">
        <div className="flex gap-2 w-full">
          <Button
            onClick={onExport}
            disabled={isExporting || disabled}
            className="flex-1 bg-foreground hover:bg-foreground/90 text-background font-medium h-9 text-xs gap-2"
          >
            <Download size={14} />
            {isExporting ? t('common.exporting') : t('common.export')}
          </Button>
          <Button
            aria-label={t('common.moreOptions')}
            onClick={() => setMenuOpen(!menuOpen)}
            disabled={disabled}
            variant="outline"
            className="h-9 w-9 p-0 border-border text-muted-foreground hover:text-foreground"
          >
            <ChevronDown
              size={14}
              className={cn('transition-transform', menuOpen && 'rotate-180')}
            />
          </Button>
          {onCopyAsPng && (
            <Button
              onClick={onCopyAsPng}
              disabled={disabled}
              variant="outline"
              aria-label={t('common.copyAsPng')}
              title={t('common.copyAsPng')}
              className="h-9 w-9 p-0 border-border text-muted-foreground hover:text-foreground"
            >
              <Copy size={14} />
            </Button>
          )}
        </div>

        {menuOpen && (
          <div className="absolute bottom-full left-0 right-0 mb-1 bg-popover border border-border rounded-xl p-1 shadow-xl z-20 animate-fade-in">
            {sendTo && <div className="px-1 py-0.5">{sendTo}</div>}
          </div>
        )}
      </div>
      {children}
    </ToolPanelActions>
  );
};
