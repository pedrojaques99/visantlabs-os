import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Maximize2, Pause, Play, Search, ZoomIn, ZoomOut } from '@/lib/ui/icons';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/Tooltip';
import { useTranslation } from '@/hooks/useTranslation';
import { cn } from '@/lib/utils';

/**
 * StageDock: the one row of controls over a tool's stage. It shows what is in use and hides the rest.
 *
 * It stays centered as it grows. While a mouse is over it, it holds its place and grows to the
 * right instead, so the button under the pointer never moves away; it recenters when the mouse
 * leaves.
 * `ToolDock` is the Canvas dock, themed by hex. This one uses the design tokens.
 */

/** How long a group stays open after someone stops using it. */
const HOLD_MS = 1800;
/** A pointer passing over the dock on its way somewhere else should not open anything. */
const HOVER_INTENT_MS = 150;
const IDLE_MS = 3000;
/** A little over `--dur-base`, the time a stretch of the dock takes to open. */
const SETTLE_MS = 220;
/** Changes while the stage first fits the window are not someone using the control. */
const MOUNT_QUIET_MS = 1000;

interface StageDockContextValue {
  /** The pointer is inside the dock: nothing collapses under it. */
  hovered: boolean;
}

const StageDockContext = createContext<StageDockContextValue>({
  hovered: false,
});

/** True while `active`, and for a moment after. */
function useHeld(active: boolean, holdMs = HOLD_MS): boolean {
  const [held, setHeld] = useState(active);
  useEffect(() => {
    if (active) {
      setHeld(true);
      return;
    }
    const timer = setTimeout(() => setHeld(false), holdMs);
    return () => clearTimeout(timer);
  }, [active, holdMs]);
  return active || held;
}

/** Hover from a real mouse, after a short pause. Fingers never set it. */
function useHoverIntent() {
  const [hovered, setHovered] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const onPointerEnter = useCallback((e: React.PointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setHovered(true), HOVER_INTENT_MS);
  }, []);
  const onPointerLeave = useCallback(() => {
    clearTimeout(timer.current);
    setHovered(false);
  }, []);
  return { hovered, hoverProps: { onPointerEnter, onPointerLeave } };
}

/** Button sizes shared by everything in the dock: small for a mouse, 44 px for a finger. */
export const stageDockButton =
  'h-7 w-7 shrink-0 text-muted-foreground disabled:opacity-30 [@media(pointer:coarse)]:h-11 [@media(pointer:coarse)]:w-11';

interface StageDockProps {
  children: React.ReactNode;
  /** Vertical position and any page-specific placement. */
  className?: string;
  /** For a position that depends on a value, such as the height of an open sheet. */
  bottom?: string;
}

export const StageDock: React.FC<StageDockProps> = ({ children, className, bottom }) => {
  const pillRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState<number | null>(null);
  // Where it sat when the mouse came in. Null means centered.
  const [heldAt, setHeldAt] = useState<number | null>(null);
  const hovered = heldAt !== null;

  useLayoutEffect(() => {
    const pill = pillRef.current;
    if (!pill) return;
    const measure = () => setWidth(pill.offsetWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(pill);
    return () => observer.disconnect();
  }, []);

  const value = useMemo(() => ({ hovered }), [hovered]);
  const halfWidth = heldAt ?? (width ?? 0) / 2;

  return (
    <StageDockContext.Provider value={value}>
      <div
        ref={pillRef}
        data-canvas-ui
        data-testid="stage-dock"
        onPointerEnter={(e) => {
          if (e.pointerType === 'mouse') setHeldAt(e.currentTarget.offsetWidth / 2);
        }}
        onPointerLeave={() => setHeldAt(null)}
        className={cn(
          'absolute left-1/2 z-30 flex items-center gap-0.5 rounded-xl p-1 cursor-default',
          'border border-border bg-card shadow-lg',
          className
        )}
        // A margin, not a transform: a transform would break the fixed position of the tooltips.
        style={
          width === null
            ? { transform: 'translateX(-50%)', bottom }
            : {
                bottom,
                marginLeft: -halfWidth,
                maxWidth: `calc(50% + ${halfWidth}px - 8px)`,
                transition: 'margin-left var(--dur-base) ease-out, bottom var(--dur-base) ease-out',
              }
        }
      >
        {children}
      </div>
    </StageDockContext.Provider>
  );
};

export const StageDockDivider: React.FC<{ className?: string }> = ({ className }) => (
  <span className={cn('mx-0.5 h-4 w-px shrink-0 bg-border', className)} aria-hidden />
);

interface StageDockRevealProps {
  open: boolean;
  children: React.ReactNode;
  className?: string;
}

/** A stretch of the dock that opens sideways. Closed, it takes no room and no focus. */
export const StageDockReveal: React.FC<StageDockRevealProps> = ({ open, children, className }) => {
  // It clips only while it moves, so a popover from something inside it is not cut off.
  const [settled, setSettled] = useState(open);
  useEffect(() => {
    if (!open) {
      setSettled(false);
      return;
    }
    const timer = setTimeout(() => setSettled(true), SETTLE_MS);
    return () => clearTimeout(timer);
  }, [open]);

  return (
    <div
      inert={!open || undefined}
      className={cn(
        'grid min-w-0 transition-[grid-template-columns,opacity] duration-[var(--dur-base)] ease-out',
        open ? 'grid-cols-[1fr] opacity-100' : 'grid-cols-[0fr] opacity-0',
        className
      )}
    >
      <div
        className={cn(
          'flex min-w-0 items-center gap-0.5 whitespace-nowrap',
          !settled && 'overflow-hidden'
        )}
      >
        {children}
      </div>
    </div>
  );
};

interface StageDockTransportProps {
  playing: boolean;
  onToggle: () => void;
  value: number;
  max: number;
  step: number;
  onSeek: (value: number) => void;
  /** The time, as text. */
  readout: string;
  onOpenChange?: (open: boolean) => void;
}

/** Play at rest. The timeline opens while playing, on hover, and for a moment after pausing. */
export const StageDockTransport: React.FC<StageDockTransportProps> = ({
  playing,
  onToggle,
  value,
  max,
  step,
  onSeek,
  readout,
  onOpenChange,
}) => {
  const { t } = useTranslation();
  const { hovered: dockHovered } = useContext(StageDockContext);
  const { hovered, hoverProps } = useHoverIntent();
  const [touched, setTouched] = useState(0);
  const [recent, setRecent] = useState(false);
  const wasOpen = useRef(false);
  const open = useHeld(playing || hovered || recent || (wasOpen.current && dockHovered));
  wasOpen.current = open;

  // Any touch of the timeline keeps it open a moment longer.
  useEffect(() => {
    if (!touched) return;
    setRecent(true);
    const timer = setTimeout(() => setRecent(false), HOLD_MS);
    return () => clearTimeout(timer);
  }, [touched]);

  useEffect(() => onOpenChange?.(open), [open, onOpenChange]);

  const label = t(playing ? 'toolDock.pause' : 'toolDock.play');
  return (
    <div className="flex min-w-0 items-center gap-0.5" {...hoverProps}>
      <Tooltip content={label}>
        <Button
          variant="ghost"
          size="icon"
          aria-label={label}
          className={cn(stageDockButton, 'text-foreground')}
          onClick={onToggle}
        >
          {playing ? <Pause size={14} /> : <Play size={14} />}
        </Button>
      </Tooltip>
      <StageDockReveal open={open}>
        <input
          type="range"
          min={0}
          max={max}
          step={step}
          value={value}
          aria-label={t('toolDock.timeline')}
          onPointerDown={() => setTouched((n) => n + 1)}
          onChange={(e) => {
            setTouched((n) => n + 1);
            onSeek(parseFloat(e.target.value));
          }}
          className="mx-1.5 h-1 w-[240px] min-w-0 max-md:w-[147px] shrink cursor-pointer appearance-none rounded-full bg-muted bg-clip-content accent-foreground [@media(pointer:coarse)]:h-11 [@media(pointer:coarse)]:py-5"
        />
        <span className="shrink-0 whitespace-nowrap pr-1.5 text-2xs font-mono tabular-nums text-muted-foreground">
          {readout}
        </span>
      </StageDockReveal>
    </div>
  );
};

interface StageDockGroupProps {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
  /** When this value changes, the group opens to show it. */
  pulse?: unknown;
  onOpenChange?: (open: boolean) => void;
}

/** One small button at rest. The rest opens on click, on hover, and when `pulse` changes. */
export const StageDockGroup: React.FC<StageDockGroupProps> = ({
  icon,
  label,
  children,
  pulse,
  onOpenChange,
}) => {
  const { hovered: dockHovered } = useContext(StageDockContext);
  const { hovered, hoverProps } = useHoverIntent();
  const [asked, setAsked] = useState(false);
  const wasOpen = useRef(false);
  const open = useHeld(asked || hovered || (wasOpen.current && dockHovered));
  wasOpen.current = open;

  const mountedAt = useRef(0);
  useEffect(() => {
    mountedAt.current = performance.now();
  }, []);
  const lastPulse = useRef(pulse);
  useEffect(() => {
    if (lastPulse.current === pulse) return;
    lastPulse.current = pulse;
    if (performance.now() - mountedAt.current > MOUNT_QUIET_MS) setAsked(true);
  }, [pulse]);

  useEffect(() => onOpenChange?.(open), [open, onOpenChange]);

  // Nothing stays open once nobody is using it. A new change restarts the wait.
  useEffect(() => {
    if (!asked) return;
    const timer = setTimeout(() => setAsked(false), IDLE_MS);
    return () => clearTimeout(timer);
  }, [asked, pulse]);

  return (
    <div className="flex min-w-0 items-center gap-0.5" {...hoverProps}>
      <Tooltip content={label}>
        <Button
          variant="ghost"
          size="icon"
          aria-label={label}
          aria-expanded={open}
          className={stageDockButton}
          onClick={() => setAsked((value) => !value)}
        >
          {icon}
        </Button>
      </Tooltip>
      <StageDockReveal open={open}>{children}</StageDockReveal>
    </div>
  );
};

interface StageDockZoomProps {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
  /** Something else worth seeing while zooming, such as the artwork's size. */
  detail?: React.ReactNode;
  onOpenChange?: (open: boolean) => void;
}

/** A magnifier at rest. A zoom from the wheel or a shortcut shows its value too. */
export const StageDockZoom: React.FC<StageDockZoomProps> = ({
  zoom,
  onZoomIn,
  onZoomOut,
  onFit,
  detail,
  onOpenChange,
}) => {
  const { t } = useTranslation();
  return (
    <StageDockGroup
      icon={<Search size={14} />}
      label={t('toolDock.zoom')}
      pulse={zoom}
      onOpenChange={onOpenChange}
    >
      <Tooltip content={t('toolDock.zoomOut')}>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t('toolDock.zoomOut')}
          className={stageDockButton}
          onClick={onZoomOut}
        >
          <ZoomOut size={13} />
        </Button>
      </Tooltip>
      <span className="w-9 shrink-0 text-center text-2xs font-mono tabular-nums text-muted-foreground">
        {Math.round(zoom * 100)}%
      </span>
      <Tooltip content={t('toolDock.zoomIn')}>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t('toolDock.zoomIn')}
          className={stageDockButton}
          onClick={onZoomIn}
        >
          <ZoomIn size={13} />
        </Button>
      </Tooltip>
      <Tooltip content={t('toolDock.fit')}>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t('toolDock.fit')}
          className={stageDockButton}
          onClick={onFit}
        >
          <Maximize2 size={13} />
        </Button>
      </Tooltip>
      {detail && <StageDockText>{detail}</StageDockText>}
    </StageDockGroup>
  );
};

/** A value in the dock, as small technical text. */
export const StageDockText: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="shrink-0 whitespace-nowrap px-1.5 text-2xs font-mono tabular-nums text-muted-foreground">
    {children}
  </span>
);
