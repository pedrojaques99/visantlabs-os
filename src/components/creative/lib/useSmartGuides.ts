import { useCallback, useRef, useState } from 'react';
import type Konva from 'konva';

const SNAP_THRESHOLD = 6;

export interface GuideLine {
  orientation: 'V' | 'H';
  start: { x: number; y: number };
  end: { x: number; y: number };
}

interface SnapEdge {
  guide: number;
  offset: number;
  snap: 'start' | 'center' | 'end';
}

interface NodeBounds {
  vertical: { start: number; center: number; end: number };
  horizontal: { start: number; center: number; end: number };
}

const getNodeBounds = (rect: { x: number; y: number; width: number; height: number }): NodeBounds => ({
  vertical: { start: rect.x, center: rect.x + rect.width / 2, end: rect.x + rect.width },
  horizontal: { start: rect.y, center: rect.y + rect.height / 2, end: rect.y + rect.height },
});

const getStageGuides = (width: number, height: number) => ({
  vertical: [0, width / 2, width],
  horizontal: [0, height / 2, height],
});

const getOtherNodeGuides = (others: Konva.Node[]) => {
  const vertical: number[] = [];
  const horizontal: number[] = [];
  for (const node of others) {
    // relativeTo: stage keeps these in logical coords so they line up with the
    // dragged-node bounds (also queried relativeTo:stage) and the stage guides
    // even when the viewport is zoomed/panned.
    const r = node.getClientRect({
      skipShadow: true,
      skipStroke: true,
      relativeTo: node.getStage() ?? undefined,
    });
    vertical.push(r.x, r.x + r.width / 2, r.x + r.width);
    horizontal.push(r.y, r.y + r.height / 2, r.y + r.height);
  }
  return { vertical, horizontal };
};

const findClosest = (axisGuides: number[], itemBounds: { start: number; center: number; end: number }): SnapEdge | null => {
  let best: SnapEdge | null = null;
  for (const guide of axisGuides) {
    for (const snap of ['start', 'center', 'end'] as const) {
      const offset = Math.abs(itemBounds[snap] - guide);
      if (offset < SNAP_THRESHOLD && (!best || offset < best.offset)) {
        best = { guide, offset, snap };
      }
    }
  }
  return best;
};

interface UseSmartGuidesArgs {
  stageWidth: number;
  stageHeight: number;
  shapeRefs: React.MutableRefObject<Map<string, Konva.Node>>;
  /** Grid spacing in creative-coord px. 0 or undefined = no grid snap. */
  gridSize?: number;
}

/**
 * Smart-guide snapping hook. Returns:
 * - guides: GuideLine[] for the live overlay layer
 * - onDragMove: pass to draggable nodes — snaps node position and pushes guides
 * - clear: call on dragEnd / transformEnd to hide guides
 */
export function useSmartGuides({ stageWidth, stageHeight, shapeRefs, gridSize }: UseSmartGuidesArgs) {
  const [guides, setGuides] = useState<GuideLine[]>([]);
  const draggingIdsRef = useRef<Set<string>>(new Set());

  const setDraggingIds = useCallback((ids: string[]) => {
    draggingIdsRef.current = new Set(ids);
  }, []);

  const computeAndSnap = useCallback(
    (node: Konva.Node) => {
      const stage = getStageGuides(stageWidth, stageHeight);

      const others: Konva.Node[] = [];
      shapeRefs.current.forEach((n, id) => {
        if (!draggingIdsRef.current.has(id) && n !== node) others.push(n);
      });
      const otherGuides = getOtherNodeGuides(others);

      const allV = [...stage.vertical, ...otherGuides.vertical];
      const allH = [...stage.horizontal, ...otherGuides.horizontal];

      // Bounds in stage-inner (logical) coords — matches stage.width()/height()
      // and other-node bounds even when the user has zoomed/panned the viewport.
      const rect = node.getClientRect({ skipShadow: true, skipStroke: true, relativeTo: node.getStage() ?? undefined });
      const bounds = getNodeBounds(rect);

      const closestV = findClosest(allV, bounds.vertical);
      const closestH = findClosest(allH, bounds.horizontal);

      const nextGuides: GuideLine[] = [];
      const local = node.position();

      if (closestV) {
        const itemValue = bounds.vertical[closestV.snap];
        const diff = closestV.guide - itemValue;
        node.position({ x: local.x + diff, y: node.y() });
        nextGuides.push({
          orientation: 'V',
          start: { x: closestV.guide, y: 0 },
          end: { x: closestV.guide, y: stageHeight },
        });
      }
      if (closestH) {
        const itemValue = bounds.horizontal[closestH.snap];
        const diff = closestH.guide - itemValue;
        node.position({ x: node.x(), y: local.y + diff });
        nextGuides.push({
          orientation: 'H',
          start: { x: 0, y: closestH.guide },
          end: { x: stageWidth, y: closestH.guide },
        });
      }

      // Grid snap (creative-coord local position) — only on axes that smart
      // guides did not already claim. Threshold matches SNAP_THRESHOLD so the
      // pull is consistent with edge/center snap.
      if (gridSize && gridSize > 0) {
        const x0 = node.x();
        const y0 = node.y();
        if (!closestV) {
          const sx = Math.round(x0 / gridSize) * gridSize;
          if (Math.abs(sx - x0) < SNAP_THRESHOLD) node.x(sx);
        }
        if (!closestH) {
          const sy = Math.round(y0 / gridSize) * gridSize;
          if (Math.abs(sy - y0) < SNAP_THRESHOLD) node.y(sy);
        }
      }
      setGuides(nextGuides);
    },
    [stageWidth, stageHeight, shapeRefs, gridSize]
  );

  const onDragMove = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      computeAndSnap(e.target);
    },
    [computeAndSnap]
  );

  const onTransform = useCallback(
    (e: Konva.KonvaEventObject<Event>) => {
      computeAndSnap(e.target);
    },
    [computeAndSnap]
  );

  const clear = useCallback(() => {
    draggingIdsRef.current = new Set();
    setGuides([]);
  }, []);

  return { guides, onDragMove, onTransform, clear, setDraggingIds };
}
