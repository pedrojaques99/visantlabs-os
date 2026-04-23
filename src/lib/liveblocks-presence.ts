/**
 * Shared Liveblocks presence utilities.
 *
 * Import from here whenever you need consistent colors, coordinate conversion,
 * or ghost-drag rendering logic across canvas, brand guidelines, or future rooms.
 */
import type { ReactFlowInstance } from '@/types/reactflow-instance';

// ─── Color utilities ─────────────────────────────────────────────────────────

/** Deterministic color from any string ID (connectionId, userId, etc.) */
export function getPresenceColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  const saturation = 65 + (Math.abs(hash) % 20);
  const lightness = 50 + (Math.abs(hash) % 15);
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

/** Darker variant of a presence color — for label backgrounds */
export function getPresenceLabelColor(color: string): string {
  const match = color.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
  if (!match) return color;
  const [, hue, saturation, lightness] = match;
  return `hsl(${hue}, ${saturation}%, ${Math.max(35, parseInt(lightness) - 15)}%)`;
}

// ─── Coordinate conversion ────────────────────────────────────────────────────

export interface ScreenPoint { x: number; y: number }
export interface FlowViewport { x: number; y: number; zoom: number }

/**
 * Convert a flow-space coordinate to screen-space using the ReactFlow instance.
 * Falls back to manual viewport math if `flowToScreenPosition` is unavailable.
 */
export function flowToScreen(
  point: ScreenPoint,
  reactFlowInstance: ReactFlowInstance | null,
): ScreenPoint | null {
  if (!reactFlowInstance) return null;

  if (reactFlowInstance.flowToScreenPosition) {
    return reactFlowInstance.flowToScreenPosition(point);
  }

  if (reactFlowInstance.getViewport) {
    const vp = reactFlowInstance.getViewport();
    return { x: point.x * vp.zoom + vp.x, y: point.y * vp.zoom + vp.y };
  }

  return null;
}

/** Current zoom from the ReactFlow instance (1 if unavailable). */
export function getViewportZoom(reactFlowInstance: ReactFlowInstance | null): number {
  return reactFlowInstance?.getViewport?.()?.zoom ?? 1;
}

// ─── Ghost drag metrics ───────────────────────────────────────────────────────

export interface NodeDimensions { width: number; height: number }

/**
 * Extract display dimensions for a ReactFlow node.
 * Uses measured dimensions first, then stored, then safe fallback.
 */
export function getNodeDisplaySize(node: any): NodeDimensions {
  return {
    width: node?.measured?.width ?? node?.width ?? 200,
    height: node?.measured?.height ?? node?.height ?? 100,
  };
}

// ─── Shared ghost-drag styles ─────────────────────────────────────────────────

/**
 * Returns inline style for a ghost drag box.
 * Apply to a position:absolute div anchored at top:0/left:0.
 * The transform positions it; transition interpolates between presence snapshots.
 */
export function ghostBoxStyle(
  sx: number,
  sy: number,
  w: number,
  h: number,
  color: string,
): React.CSSProperties {
  return {
    position: 'absolute',
    top: 0,
    left: 0,
    transform: `translate(${sx}px, ${sy}px)`,
    transition: 'transform 40ms linear',
    willChange: 'transform',
    width: `${w}px`,
    height: `${h}px`,
    borderRadius: '8px',
    border: `2px solid ${color}`,
    backgroundColor: `${color}14`,
    boxShadow: `0 0 0 1px ${color}33, 0 6px 16px ${color}28`,
    pointerEvents: 'none',
  } as React.CSSProperties;
}

/** Returns inline style for the user-name label pinned above a ghost box. */
export function ghostLabelStyle(labelColor: string): React.CSSProperties {
  return {
    position: 'absolute',
    top: '-26px',
    left: 0,
    padding: '3px 8px',
    backgroundColor: labelColor,
    color: 'white',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: 600,
    whiteSpace: 'nowrap' as const,
    letterSpacing: '0.01em',
    boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
    userSelect: 'none' as const,
  };
}

/** Returns inline style for the cursor dot + label wrapper. */
export function cursorWrapperStyle(sx: number, sy: number): React.CSSProperties {
  return {
    position: 'absolute',
    top: 0,
    left: 0,
    transform: `translate(${sx + 20}px, ${sy - 5}px)`,
    transition: 'transform 40ms linear',
    willChange: 'transform',
    pointerEvents: 'none',
  } as React.CSSProperties;
}
