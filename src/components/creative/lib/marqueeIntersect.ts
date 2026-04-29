import type Konva from 'konva';

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const rectsIntersect = (a: Rect, b: Rect): boolean =>
  !(a.x + a.width < b.x || b.x + b.width < a.x || a.y + a.height < b.y || b.y + b.height < a.y);

/**
 * Returns IDs whose bounding rects intersect `marquee`. Both marquee and node
 * bounds are queried in stage-inner (logical) coords so the comparison is
 * stable under viewport zoom/pan. Skips locked layers.
 */
export function intersectingLayerIds(
  marquee: Rect,
  shapeRefs: Map<string, Konva.Node>,
  isLocked: (id: string) => boolean
): string[] {
  const hit: string[] = [];
  shapeRefs.forEach((node, id) => {
    if (isLocked(id)) return;
    const r = node.getClientRect({
      skipShadow: true,
      skipStroke: true,
      relativeTo: node.getStage() ?? undefined,
    });
    if (rectsIntersect(marquee, r)) hit.push(id);
  });
  return hit;
}
